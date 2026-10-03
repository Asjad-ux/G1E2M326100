from __future__ import annotations

import argparse
import contextlib
import io
import json
import re
import sys
from pathlib import Path
from typing import Any


class WorkerInferenceError(Exception):
    def __init__(self, cause: Exception, stderr: str = ""):
        super().__init__(str(cause))
        self.cause = cause
        self.stderr = stderr


def as_json_value(value: Any) -> Any:
    if hasattr(value, "tolist"):
        return value.tolist()
    if isinstance(value, tuple):
        return [as_json_value(item) for item in value]
    if isinstance(value, list):
        return [as_json_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): as_json_value(item) for key, item in value.items()}
    return value


def diagnostic_text(value: Any, input_path: Path | None = None, limit: int = 2000) -> str:
    """Keep worker diagnostics useful without emitting document data or secrets."""
    text = str(value or "").replace("\r", " ").replace("\n", " ")
    if input_path:
        text = text.replace(str(input_path), "<input>")
        text = text.replace(str(input_path.parent), "<input-dir>")
    text = re.sub(r"(?i)(api[_-]?key|authorization|password|secret|token)\s*[:=]\s*[^\s,;]+", r"\1=<redacted>", text)
    return text[:limit]


def result_data(result: Any) -> dict[str, Any]:
    value = getattr(result, "json", None)
    if callable(value):
        value = value()
    if isinstance(value, str):
        value = json.loads(value)
    if not isinstance(value, dict):
        raise ValueError("PaddleOCR returned a malformed result object")
    value = as_json_value(value)
    if isinstance(value.get("res"), dict):
        return value["res"]
    return value


def page_lines(data: dict[str, Any], page_index: int) -> list[dict[str, Any]]:
    texts = data.get("rec_texts") or []
    scores = data.get("rec_scores") or []
    boxes = data.get("rec_boxes") or data.get("rec_polys") or []
    lines: list[dict[str, Any]] = []
    for index, text in enumerate(texts):
        if not isinstance(text, str) or not text.strip():
            continue
        score = scores[index] if index < len(scores) else None
        bbox = boxes[index] if index < len(boxes) else None
        lines.append({
            "text": text,
            "confidence": float(score) if isinstance(score, (int, float)) else None,
            "bbox": as_json_value(bbox),
            "pageIndex": page_index,
        })

    return sorted(lines, key=line_sort_key)


def line_sort_key(line: dict[str, Any]) -> tuple[float, float]:
    bbox = line.get("bbox")
    if isinstance(bbox, list) and bbox and isinstance(bbox[0], list):
        points = [point for point in bbox if isinstance(point, list) and len(point) >= 2]
        if points:
            return (float(min(point[1] for point in points)), float(min(point[0] for point in points)))
    if isinstance(bbox, list) and len(bbox) >= 4 and all(isinstance(item, (int, float)) for item in bbox[:4]):
        return (float(bbox[1]), float(bbox[0]))
    return (float("inf"), float("inf"))


def run_inference(input_path: Path, device: str) -> dict[str, Any]:
    # Paddle/PaddleX can print model and inference diagnostics. Keep those out
    # of the JSON protocol and out of the Node backend logs.
    quiet_stdout = io.StringIO()
    quiet_stderr = io.StringIO()
    try:
        with contextlib.redirect_stdout(quiet_stdout), contextlib.redirect_stderr(quiet_stderr):
            from paddleocr import PaddleOCR

            ocr = PaddleOCR(
                lang="en",
                device=device,
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
                enable_mkldnn=False,
            )
            results = ocr.predict(
                input=str(input_path),
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
            )
            pages = list(results)
    except Exception as error:
        raise WorkerInferenceError(error, quiet_stderr.getvalue()) from error

    if not pages:
        raise ValueError("PaddleOCR returned no pages")

    lines: list[dict[str, Any]] = []
    for index, result in enumerate(pages):
        data = result_data(result)
        page_index = data.get("page_index", index)
        if not isinstance(page_index, int):
            page_index = index
        lines.extend(page_lines(data, page_index))

    lines.sort(key=lambda line: (int(line.get("pageIndex", 0)), *line_sort_key(line)))
    text = "\n".join(line["text"] for line in lines).strip()
    if not text:
        raise ValueError("PaddleOCR returned no readable text")
    return {"provider": "PaddleOCR", "text": text, "lines": lines, "pageCount": len(pages)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--self-check", action="store_true")
    args = parser.parse_args()

    try:
        if args.self_check:
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                import paddle
                import paddleocr
            print(json.dumps({
                "ok": True,
                "provider": "PaddleOCR",
                "device": args.device,
                "paddleVersion": paddle.__version__,
                "paddleOcrVersion": getattr(paddleocr, "__version__", "unknown"),
            }))
            return 0
        if not args.input or not args.input.is_file() or args.input.stat().st_size <= 0:
            raise ValueError("Input document is missing or empty")
        # Escape non-ASCII OCR output so Windows console encoding cannot break
        # the JSON protocol; Node decodes the JSON back to Unicode text.
        print(json.dumps({"ok": True, **run_inference(args.input, args.device)}, ensure_ascii=True))
        return 0
    except Exception as error:
        cause = error.cause if isinstance(error, WorkerInferenceError) else error
        stderr = error.stderr if isinstance(error, WorkerInferenceError) else ""
        # Keep the protocol diagnostic, but never emit document contents, secrets,
        # or an unbounded Paddle traceback to the Node process.
        print(json.dumps({
            "ok": False,
            "errorType": type(cause).__name__,
            "errorMessage": diagnostic_text(cause, args.input),
            "stderr": diagnostic_text(stderr, args.input),
        }, ensure_ascii=True))
        return 1


if __name__ == "__main__":
    sys.exit(main())
