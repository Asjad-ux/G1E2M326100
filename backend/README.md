# CPCL Procure Backend

Independent Express + TypeScript + MySQL 8 + Prisma API for the CPCL Tender Compliance platform. The root Vite frontend connects to this API.

## Setup

1. Install and start MySQL 8.x.
2. Create the database:

~~~sql
CREATE DATABASE cpcl_tender;
~~~

3. Copy .env.example to .env, configure the MySQL URL, JWT secrets, Resend values, Cloudinary values, and the server-only OCR provider settings.
4. Install dependencies, generate Prisma Client, migrate, seed, and start:

~~~powershell
cd backend
npm install
Copy-Item .env.example .env
# configure MySQL, Resend, Cloudinary, and OCR provider credentials in .env
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
~~~

The MySQL URL format is mysql://USER:PASSWORD@localhost:3306/cpcl_tender. The API runs at http://localhost:5000; health check: GET /api/health.

## Cloudinary document storage

Document binaries are not stored in MySQL or in a permanent backend uploads directory. The backend accepts an in-memory multipart upload, sends it to Cloudinary using the official Node SDK, and stores only document metadata plus the Cloudinary public_id, resource type, and HTTPS delivery URL in MySQL.

### Cloudinary setup

1. Create or sign in to a Cloudinary account.
2. From the Cloudinary dashboard, copy the cloud name, API key, and API secret into backend/.env:

~~~dotenv
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
~~~

3. Keep these values server-only. Never commit them or expose them to the frontend.
4. Restart the backend after changing .env.

Uploads are organized under CPCL-Procure/bidders/user_<userId>/<documentType>. Supported files are PDF, JPG, JPEG, PNG, DOC, and DOCX, up to 10 MB. Bidder endpoints enforce ownership. Officer view/download endpoints only allow documents attached to applications for tenders owned by the authenticated officer.

Document Vault uploads store document metadata and the Cloudinary object, then run the first-stage pipeline `Cloudinary -> PaddleOCR -> JSON document definition extraction -> non-null User-field persistence`. The separate `Document.extractionStatus` is `SUCCESS` when all required JSON-defined fields are extracted, `REVIEW` when OCR succeeds but a required field is missing or ambiguous, and `FAILED` when the document/OCR processing fails. Existing `Document.status`, validation, verification, and final status rules are not changed by this stage. PaddleOCR configuration is server-only and is documented in `.env.example`.

## PaddleOCR worker

OCR runs in the isolated Python worker at `ocr-worker/paddle_worker.py`. The Node service downloads the Cloudinary bytes to a temporary file, invokes the worker, receives structured line text, confidence, bounding boxes, and page count as JSON, then removes the temporary file. The worker uses CPU inference on this Windows development machine and supports PDF, JPEG, and PNG input.

The verified development setup is Python 3.11.9 with PaddlePaddle 3.3.1 and PaddleOCR 3.7.0:

~~~powershell
cd backend
py -3.11 -m venv ocr-runtime/.venv
ocr-runtime/.venv/Scripts/python.exe -m pip install -r ocr-worker/requirements.txt
~~~

The first OCR run may download the official PaddleOCR models. Keep `PADDLEOCR_WORKER_PATH`, `PADDLEOCR_DEVICE`, and `PADDLEOCR_TIMEOUT_MS` server-side in `.env`. The Python executable is not configurable: the backend always uses the absolute path resolved from the backend root to `ocr-runtime/.venv/bin/python` on Render/Linux (or `ocr-runtime/.venv/Scripts/python.exe` on Windows).

For the Render backend service, set the service root directory to `backend`, use `npm install && npm run build:render` as the Build Command, and use `npm run start` as the Start Command. `build:render` creates or reuses `ocr-runtime/.venv`, installs `ocr-worker/requirements.txt`, verifies `import paddleocr`, runs the worker self-check, and then builds the TypeScript backend. The running backend uses the same exact `ocr-runtime/.venv/bin/python` executable; it never falls back to `python`, `python3`, or another system interpreter.

## Document API

Bidder document uploads use multipart/form-data with a file field and documentType:

- GET /api/bidder/documents
- POST /api/bidder/documents
- GET /api/bidder/documents/:id
- GET /api/bidder/documents/:id/view
- GET /api/bidder/documents/:id/download
- PATCH /api/bidder/documents/:id (multipart replacement)
- DELETE /api/bidder/documents/:id
- POST /api/bidder/applications/:applicationId/documents (reuse a documentId or upload a new file)

Replacement uploads the new object, updates MySQL, and then removes the old Cloudinary object. A document attached to an application cannot be deleted.

## OTP verification

Phone OTP is a development-only flow and always uses 123456. Email OTP uses the Resend HTTPS API. Codes are generated with a cryptographically secure random number, hashed before storage, expire after 10 minutes, allow at most five failed attempts, and have a 60-second resend cooldown. The plaintext code is never stored or logged. If Resend is not configured, the email send endpoint returns HTTP 503.

## Seed credentials

- Officer: rahul.sharma@cpcl.co.in / DemoPassword123!
- Bidder: abc@demo.cpcl.in / DemoPassword123!

Seeded users are already marked verified so protected flows can be tested. Newly registered users start with both verification flags false; verify email before login.

## API groups

- /api/auth: register, login, refresh, logout, email OTP, development phone OTP, forgot/reset password
- /api/officer: tender CRUD, requirements, applications, accept/reject, blacklist
- /api/bidder: active tenders, applications, documents, tender-specific documents
- /api/notifications: list, mark one read, mark all read

All responses use the shape { success, data, message, errors }. Protected endpoints use Authorization: Bearer accessToken.

## Postman

Import CPCL-Backend.postman_collection.json. Set baseUrl to http://localhost:5000, then store accessToken, refreshToken, tenderId, applicationId, and companyId from responses.

## Verification checklist

~~~powershell
cd backend
npm install
Copy-Item .env.example .env
# configure MySQL credentials, Resend values, Cloudinary credentials, and OCR provider credentials
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
~~~

Verify GET http://localhost:5000/api/health, then test login with the seeded officer or bidder credentials and call a protected document endpoint with the returned bearer token.
