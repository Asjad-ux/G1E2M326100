from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main() -> int:
    worker = Path(__file__).parents[1] / "ocr-worker" / "paddle_worker.py"
    font_path = Path("C:/Windows/Fonts/arial.ttf")
    font = ImageFont.truetype(str(font_path), 54) if font_path.exists() else ImageFont.load_default()
    def make_page(page_number: int) -> Image.Image:
        image = Image.new("RGB", (1800, 700), "white")
        draw = ImageDraw.Draw(image)
        for index, line in enumerate((
            f"SYNTHETIC PAGE {page_number}",
            "PAN NUMBER: ABCDE1234F",
            "NAME: SYNTHETIC TEST PERSON",
            "DATE OF BIRTH: 01/01/1990",
        )):
            draw.text((80, 70 + index * 140), line, fill="black", font=font)
        return image

    with tempfile.TemporaryDirectory(prefix="cpcl-paddle-check-") as directory:
        image_path = Path(directory) / "synthetic.png"
        pdf_path = Path(directory) / "synthetic.pdf"
        first_page = make_page(1)
        first_page.save(image_path)
        first_page.save(pdf_path, save_all=True, append_images=[make_page(2)])

        def run(input_path: Path) -> dict[str, object]:
            completed = subprocess.run(
                [sys.executable, str(worker), "--input", str(input_path), "--device", "cpu"],
                capture_output=True,
                text=True,
                check=False,
            )
            if completed.returncode != 0:
                raise RuntimeError("PaddleOCR worker returned a failure result")
            payload = json.loads(completed.stdout.strip().splitlines()[-1])
            if payload.get("ok") is not True or not payload.get("text") or not payload.get("lines"):
                raise RuntimeError("PaddleOCR worker returned an incomplete result")
            return payload

        image_payload = run(image_path)
        pdf_payload = run(pdf_path)
    if image_payload.get("pageCount") != 1 or pdf_payload.get("pageCount") != 2:
        raise RuntimeError("PaddleOCR worker did not preserve page counts")
    print(json.dumps({
        "provider": image_payload.get("provider"),
        "imagePageCount": image_payload.get("pageCount"),
        "pdfPageCount": pdf_payload.get("pageCount"),
        "imageLineCount": len(image_payload.get("lines", [])),
        "pdfLineCount": len(pdf_payload.get("lines", [])),
        "characterCount": len(image_payload.get("text", "")),
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
