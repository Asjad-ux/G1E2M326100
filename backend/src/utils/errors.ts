export class AppError extends Error {
  constructor(public statusCode: number, message: string, public errors: unknown[] = []) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFound(message = 'Resource not found'): never { throw new AppError(404, message); }
export function badRequest(message: string, errors: unknown[] = []): never { throw new AppError(400, message, errors); }
export function unauthorized(message = 'Authentication required'): never { throw new AppError(401, message); }
export function forbidden(message = 'You do not have permission to perform this action'): never { throw new AppError(403, message); }
export function conflict(message: string): never { throw new AppError(409, message); }
