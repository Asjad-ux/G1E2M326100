import 'dotenv/config';

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, resolve } from 'node:path';

const backendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workerDirectory = resolve(backendDirectory, 'ocr-worker');
const requirementsPath = resolve(workerDirectory, 'requirements.txt');
const workerPath = resolve(workerDirectory, 'paddle_worker.py');
const virtualEnvironmentDirectory = resolve(workerDirectory, '.venv');
const virtualEnvironmentPython = resolve(
  virtualEnvironmentDirectory,
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);

function configuredBackendPath(value, fallback) {
  const configured = value?.trim();
  if (!configured) return fallback;
  return isAbsolute(configured) ? configured : resolve(backendDirectory, configured);
}

function configuredPythonPath() {
  return configuredBackendPath(process.env.PADDLEOCR_PYTHON_PATH, virtualEnvironmentPython);
}

function configuredWorkerPath() {
  return configuredBackendPath(process.env.PADDLEOCR_WORKER_PATH, workerPath);
}

function run(command, args, description) {
  console.log(`[OCR BUILD] ${description}`);
  const result = spawnSync(command, args, {
    cwd: backendDirectory,
    stdio: 'inherit',
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`${description} could not start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`${description} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

function bootstrapPython() {
  const configured = process.env.PADDLEOCR_PYTHON_PATH?.trim();
  if (configured) {
    const configuredPath = configuredPythonPath();
    if (!existsSync(configuredPath)) {
      throw new Error(`PADDLEOCR_PYTHON_PATH does not exist: ${configuredPath}`);
    }
    return configuredPath;
  }

  if (!existsSync(virtualEnvironmentPython)) {
    const command = process.platform === 'win32' ? 'py' : 'python3';
    const args = process.platform === 'win32'
      ? ['-3.11', '-m', 'venv', virtualEnvironmentDirectory]
      : ['-m', 'venv', virtualEnvironmentDirectory];
    run(command, args, 'Create the PaddleOCR virtual environment');
  }

  if (!existsSync(virtualEnvironmentPython)) {
    throw new Error(`PaddleOCR Python executable was not created at ${virtualEnvironmentPython}`);
  }

  return virtualEnvironmentPython;
}

function install() {
  if (!existsSync(requirementsPath)) {
    throw new Error(`PaddleOCR requirements file is missing: ${requirementsPath}`);
  }

  const python = bootstrapPython();
  run(python, ['-m', 'pip', 'install', '-r', requirementsPath], `Install PaddleOCR dependencies with ${python}`);
}

function verify() {
  const python = configuredPythonPath();
  const worker = configuredWorkerPath();
  if (!existsSync(python)) {
    throw new Error(`PaddleOCR Python executable is missing: ${python}. Run the install step first.`);
  }
  if (!existsSync(worker)) {
    throw new Error(`PaddleOCR worker is missing: ${worker}`);
  }

  run(
    python,
    ['-c', "import paddleocr; print('PaddleOCR available')"],
    `Verify PaddleOCR import with ${python}`,
  );
  run(
    python,
    [worker, '--self-check', '--device', process.env.PADDLEOCR_DEVICE?.trim() || 'cpu'],
    `Verify PaddleOCR worker startup with ${python}`,
  );
}

try {
  const action = process.argv[2];
  if (action === 'install') install();
  else if (action === 'verify') verify();
  else throw new Error('Usage: node scripts/paddle-ocr-runtime.mjs <install|verify>');
} catch (error) {
  console.error(`[OCR BUILD ERROR] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
