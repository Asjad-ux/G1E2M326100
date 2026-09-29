import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { env } from '../src/config/env.js';
import { extractDocumentText } from '../src/services/ocr.service.js';

const directory = await mkdtemp(join(tmpdir(), 'cpcl-paddle-node-check-'));
const inputPath = join(directory, 'synthetic.png');
const imageScript = [
  'import sys',
  'from PIL import Image, ImageDraw',
  'image = Image.new("RGB", (1800, 700), "white")',
  'draw = ImageDraw.Draw(image)',
  'lines = ["PAN NUMBER: ABCDE1234F", "NAME: SYNTHETIC TEST PERSON", "FATHER NAME: SYNTHETIC PARENT", "DATE OF BIRTH: 01/01/1990"]',
  'for index, line in enumerate(lines): draw.text((80, 70 + index * 140), line, fill="black")',
  'image.save(sys.argv[1])',
].join('\n');
const generated = spawnSync(env.paddlePythonPath, ['-c', imageScript, inputPath], { encoding: 'utf8', windowsHide: true });
assert.equal(generated.status, 0, 'synthetic OCR fixture could not be created');

const server = createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'image/png' });
  response.end(readFileSync(inputPath));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const result = await extractDocumentText({ documentType: 'PAN', sourceUrl: `http://127.0.0.1:${address.port}/synthetic.png`, mimeType: 'image/png', fileName: 'synthetic.png' });
  assert.equal(result.provider, 'PaddleOCR');
  assert.equal(result.pageCount, 1);
  assert.ok(result.lines.length >= 1);
  assert.ok(result.rawText.length > 0);
  console.log(JSON.stringify({ provider: result.provider, pageCount: result.pageCount, lineCount: result.lines.length, characterCount: result.rawText.length }));
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
}
