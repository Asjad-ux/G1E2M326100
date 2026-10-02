import { AppError } from './errors.js';

export async function fetchWithTimeout(input: string | URL, init: RequestInit, timeoutMs: number, service: string) {
  const timeout = Math.max(1000, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: AbortSignal.timeout(timeout) });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new AppError(504, `${service} request timed out after ${timeout}ms`);
    }
    throw error;
  }
}
