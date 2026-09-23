import multer from 'multer';
import { AppError } from '../utils/errors.js';

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_SIZE, files: 1 },
});

export function singleDocumentUpload(req: any, res: any, next: any) {
  upload.single('file')(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return next(new AppError(413, 'Document file size must not exceed 10 MB.'));
    return next(new AppError(400, 'Unable to read the uploaded document.'));
  });
}
