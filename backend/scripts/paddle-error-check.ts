import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { env } from '../src/config/env.js';
import { extractDocumentText, OcrWorkerError } from '../src/services/ocr.service.js';

const server = createServer((request, response) => {
  if (request.url === '/empty') {
    response.writeHead(200, { 'Content-Type': 'image/png' });
    return response.end();
  }
  response.writeHead(200, { 'Content-Type': 'image/png' });
  return response.end(Buffer.from('synthetic-input'));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address !== 'string');
const baseUrl = `http://127.0.0.1:${address.port}`;
const originalPythonPath = env.paddlePythonPath;
const originalTimeout = env.paddleTimeoutMs;

try {
  await assert.rejects(
    extractDocumentText({ documentType: 'PAN', sourceUrl: `${baseUrl}/input`, mimeType: 'application/msword', fileName: 'synthetic.doc' }),
    (error: unknown) => error instanceof OcrWorkerError && error.stage === 'unsupported-format',
  );
  await assert.rejects(
    extractDocumentText({ documentType: 'PAN', sourceUrl: `${baseUrl}/empty`, mimeType: 'image/png', fileName: 'empty.png' }),
    (error: unknown) => error instanceof OcrWorkerError && error.stage === 'empty-document',
  );
  env.paddlePythonPath = 'missing-paddle-python';
  await assert.rejects(
    extractDocumentText({ documentType: 'PAN', sourceUrl: `${baseUrl}/input`, mimeType: 'image/png', fileName: 'synthetic.png' }),
    (error: unknown) => error instanceof OcrWorkerError && error.stage === 'worker-unavailable',
  );
  env.paddlePythonPath = originalPythonPath;
  env.paddleTimeoutMs = 10;
  await assert.rejects(
    extractDocumentText({ documentType: 'PAN', sourceUrl: `${baseUrl}/input`, mimeType: 'image/png', fileName: 'synthetic.png' }),
    (error: unknown) => error instanceof OcrWorkerError && error.stage === 'timeout',
  );
  console.log(JSON.stringify({ unsupportedFormat: 'controlled', emptyDocument: 'controlled', workerUnavailable: 'controlled', timeout: 'controlled' }));
} finally {
  env.paddlePythonPath = originalPythonPath;
  env.paddleTimeoutMs = originalTimeout;
  await new Promise<void>(resolve => server.close(() => resolve()));
}
