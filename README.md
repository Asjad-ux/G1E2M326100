# CPCL Procurement / BidEazy

BidEazy is the CPCL procurement and tender-management platform in this repository. It provides separate role-protected workflows for:

- **Officer** — creates and manages tenders, defines requirements, reviews bidder applications, and accepts, rejects, or blacklists applications/companies.
- **Bidder** — registers a company account, discovers active tenders, uploads and reuses documents, submits applications, and tracks application and document status.

The repository contains a Vite frontend, an Express/TypeScript API, a CPCL tender database, a separate document-verification database, Cloudinary document storage, and a PaddleOCR worker.

## Features

The implemented features are:

- Officer and bidder registration/login.
- Email OTP verification for bidder registration and email verification.
- Password hashing, JWT access/refresh tokens, logout, and role-protected API routes.
- Officer dashboard and tender management: create, edit, publish, close, and delete tenders; manage requirements; upload/view/download/remove tender documents; review applications; accept/reject applications; blacklist a bidder company; and create/list document requests.
- Bidder dashboard: browse active tenders and requirements, view tender documents, apply to tenders, submit a bid/application, and view applications.
- Document Vault: upload, list, view, download, replace, and delete bidder documents; attach existing or newly uploaded documents to applications; and track extraction status.
- PDF, JPG, JPEG, PNG, DOC, and DOCX uploads up to 10 MB.
- Cloudinary document storage, with document metadata in MySQL and server-side signed delivery URLs.
- JSON-defined document extraction and validation for PAN, Aadhaar, Passport, GSTIN, CIN, and MSME documents.
- PaddleOCR processing through `backend/ocr-worker/paddle_worker.py`.
- External verification against the separate verification database for PAN, GSTIN, Aadhaar, CIN, and MSME. The verification service also contains phone and email record lookups; Passport is defined for extraction but is currently unsupported by external verification.
- Extraction statuses (`SUCCESS`, `REVIEW`, `FAILED`) and document statuses including `PENDING`, `VERIFIED`, `INVALID`, `REVIEW`, `FAILED`, and `EXPIRED`.
- Periodic document-expiry checks, in-app notifications, password-recovery route placeholders, and role-specific application dashboards.

## Architecture

The active browser entry point is the root static frontend loaded by `index.html` (`backend-api.js`, `app.js`, and `styles.css`). A React source tree is also present under `src/`, but the current `index.html` does not load `src/main.jsx`.

```text
Vite frontend (index.html + app.js)
              |
              v
Express / TypeScript backend API
       |             |             |
       v             v             v
CPCL tender     Cloudinary     PaddleOCR Python worker
MySQL + Prisma  documents      (configured runtime)
       |
       v
Separate CPCL verification MySQL + generated Prisma client
```

The backend owns authentication, tender and application workflows, document metadata, validation, OCR orchestration, notifications, and signed document access. Cloudinary stores uploaded document binaries. The separate verification database stores synthetic external verification records and is accessed with a generated Prisma client loaded dynamically by the backend.

## Technology Stack

### Frontend

- Vite `^8.3.1`.
- React `latest`, React DOM `latest`, React Router DOM `latest`, and Lucide React `latest` are declared for the preserved React source tree.
- The active entry point is the root static JavaScript UI (`app.js`) loaded by `index.html`.

### Backend

- Node.js with TypeScript `^5.9.2` and `tsx` `^4.20.5`.
- Express `^5.1.0`, Prisma `^6.16.0`, and `@prisma/client` `^6.16.0`.
- Zod `^4.1.5`, `bcryptjs` `^3.0.2`, `jsonwebtoken` `^9.0.2`, and `multer` `^2.4.0`.
- Helmet, CORS, Morgan, and `express-rate-limit`.

### Database

- MySQL accessed through Prisma.
- Backend schema: `backend/prisma/schema.prisma`.
- Verification schema: `verification-database/prisma/schema.prisma`, with a separate generated client output.

### Document Processing / OCR

- PaddlePaddle `3.3.1`.
- PaddleOCR `3.7.0`.
- A Python worker returns structured OCR text, confidence, bounding boxes, and page count to the Node backend.

### Storage

- Cloudinary Node SDK `^2.11.0` for document upload, deletion, and signed delivery URLs.
- Document metadata is stored in the CPCL tender database.

### Email

The current bidder OTP provider is the **Resend HTTPS API** at `https://api.resend.com/emails`.

It is **not** Gmail SMTP and does **not** use Nodemailer. The production environment variables are:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

The verified production sender domain is configured outside this repository. Do not hardcode it here or in source code.

### Deployment

The source contains Render-related environment handling and production frontend defaults, but it does not contain a `render.yaml`, Dockerfile, or committed Render service manifest. Exact service names, Render root directories, publish settings, and dashboard build settings cannot be confirmed from this repository alone. The repository-valid build and start commands are documented in [Deployment](#deployment).

## Project Structure

```text
/
├── package.json                    # Root Vite frontend package
├── index.html                      # Active frontend HTML entry point
├── app.js                          # Active browser UI
├── backend-api.js                  # Browser-side API client used by app.js
├── styles.css                      # Active frontend stylesheet
├── src/                            # Preserved React source tree and API client
├── vite.config.js                  # Vite build configuration and asset copying
├── backend/
│   ├── package.json                # Express/TypeScript API package
│   ├── src/                          # API, routes, controllers, middleware, and services
│   ├── prisma/schema.prisma          # CPCL tender database schema
│   ├── prisma/migrations/            # Backend migrations
│   ├── document-definitions/         # JSON extraction/validation rules
│   ├── ocr-worker/                   # PaddleOCR worker and requirements
│   ├── scripts/                      # Extraction, verification, OCR, and phone checks
│   └── CPCL-Backend.postman_collection.json
└── verification-database/
    ├── package.json                  # Separate verification package
    ├── prisma/schema.prisma          # Verification schema and client output
    ├── prisma/migrations/            # Verification migrations
    ├── prisma/seed.ts                # Synthetic fixtures
    ├── scripts/verify.ts             # Verification checks
    └── sql/                          # Database creation and query scripts
```

Generated directories such as `dist/`, `node_modules/`, the OCR virtual environment, and the generated verification client are build/runtime artifacts, not source-of-truth files.

## Environment Variables

Never commit `.env` files or print their values. The backend searches for `backend/.env` and repository-level `.env` files locally; on Render, variables are supplied by the service process.

### Database

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Backend | Required Prisma/MySQL connection for the CPCL tender database. |
| `VERIFICATION_DATABASE_URL` | Backend | Optional explicit connection for `cpcl_verification`; when omitted, the backend derives it from `DATABASE_URL`. Set it explicitly when databases are separate. |
| `DATABASE_URL` | Verification package | In `verification-database/.env`, must point to the separate `cpcl_verification` database. |

### Authentication

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Signs access tokens; required. |
| `JWT_EXPIRES_IN` | Access-token lifetime; defaults to `15m`. |
| `REFRESH_TOKEN_SECRET` | Signs refresh tokens; required. |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh-token lifetime; defaults to `7d`. |

### Cloudinary

| Variable | Purpose |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | Server-side Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Server-side Cloudinary API secret. |
| `CLOUDINARY_TIMEOUT_MS` | Cloudinary delivery timeout; defaults to `30000`. |

### Resend

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Server-side Resend API key for bidder email OTP delivery. |
| `RESEND_FROM_EMAIL` | Verified sender address used by Resend. |
| `RESEND_TIMEOUT_MS` | Resend request timeout; defaults to `15000`. |

### OCR

| Variable | Purpose |
| --- | --- |
| `PADDLEOCR_PYTHON_PATH` | Not used; the backend always resolves `ocr-runtime/.venv/bin/python` on Render/Linux (or the Windows equivalent) from the backend directory. |
| `PADDLEOCR_WORKER_PATH` | Worker script; defaults to `ocr-worker/paddle_worker.py` under `backend/`. |
| `PADDLEOCR_DEVICE` | PaddleOCR device; defaults to `cpu`. |
| `PADDLEOCR_TIMEOUT_MS` | OCR worker timeout; defaults to `300000`. |

### Other configuration

| Variable | Used by | Purpose |
| --- | --- | --- |
| `PORT` | Backend | HTTP port; defaults to `5000`. |
| `FRONTEND_URL` | Backend | Allowed frontend CORS origin. |
| `NODE_ENV` | Backend | Development/production behavior and logging. |
| `VITE_API_URL` | Frontend build | API base URL injected into the frontend. |

## Local Development Setup

The commands below are provided by the repository packages. Run each block from the directory shown.

### 1. Clone and install the frontend

Use your normal Git clone command and change into the repository directory. The remote URL is not committed in this checkout, so it is not reproduced here.

From the repository root:

```powershell
npm install
```

Create/update the root Vite environment file with:

```dotenv
VITE_API_URL=http://localhost:5000
```

The root `.env.example` contains this local value. Do not commit the local environment file.

### 2. Configure the backend

From `backend/`:

```powershell
Copy-Item .env.example .env
npm install
```

Set database, authentication, Cloudinary, Resend, and OCR values in `backend/.env`. `DATABASE_URL`, `JWT_SECRET`, and `REFRESH_TOKEN_SECRET` are required.

### 3. Prepare the CPCL tender database

Create the MySQL database described by `DATABASE_URL`, then from `backend/` run:

```powershell
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
```

The equivalent package scripts are:

```powershell
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

The backend `prisma:migrate` script maps to Prisma `migrate dev` and is for local development. No production backend migration script is committed.

### 4. Prepare the verification database

From `verification-database/`:

```powershell
Copy-Item .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

Set this package's `DATABASE_URL` to `cpcl_verification` before running the commands. The generated client is written to `verification-database/generated/client`.

### 5. Prepare PaddleOCR

The checked-in backend documentation verifies Python 3.11.9 with the pinned Paddle packages. From `backend/` on Windows:

```powershell
py -3.11 -m venv ocr-runtime/.venv
ocr-runtime/.venv/Scripts/python.exe -m pip install -r ocr-worker/requirements.txt
```

The first OCR run may download PaddleOCR models.

### 6. Start the backend

From `backend/`:

```powershell
npm run dev
```

The default health check is `GET http://localhost:5000/api/health`.

### 7. Start the frontend

In a second terminal, from the repository root:

```powershell
npm run dev
```

Open the local Vite URL printed by Vite.

## Database Architecture

### CPCL Tender Database

`backend/prisma/schema.prisma` uses `DATABASE_URL` for operational platform data, including the confirmed models `User`, `OfficerProfile`, `Company`, `Tender`, `TenderRequirement`, `TenderDocument`, `Application`, `ApplicationDocument`, `ComplianceResult`, `Document`, `DocumentRequest`, `Notification`, `RefreshToken`, and `EmailVerificationCode`.

### CPCL Verification Database

`verification-database/prisma/schema.prisma` uses its own connection and generated client. Confirmed models are `VerificationEntity`, `AadhaarRecord`, `GSTRecord`, `CINRecord`, `MSMERecord`, `PhoneRecord`, `EmailRecord`, and `PanVerification`.

The verification database is intentionally separate from the tender database and from the document-definition JSON files.

## Document Definitions

Document definitions and external verification records are separate:

1. **Document definitions/rules** are JSON files under `backend/document-definitions/`. They define document metadata, fields, required flags, OCR aliases, normalization, validation, and expiry behavior. The checked-in files are `aadhaar.json`, `cin.json`, `gstin.json`, `msme.json`, `pan.json`, and `passport.json`.
2. **External verification records** are rows in the separate verification database. For example, PAN verification uses the confirmed `PanVerification` model and compares the extracted PAN number and PAN name.

Changing a JSON definition changes extraction/validation rules; it does not create or migrate verification records.

## OCR Pipeline

```text
Document upload
  → Cloudinary storage and metadata persistence
  → Cloudinary retrieval into a temporary backend file/buffer
  → PaddleOCR Python worker
  → extracted text, lines, confidence, bounding boxes, and page count
  → JSON document definition field extraction
  → extracted user-field persistence
  → external verification when required fields are available
  → final extraction and document status
```

`SUCCESS` means required JSON-defined fields were extracted. `REVIEW` means OCR succeeded but required data is missing or ambiguous. `FAILED` means document/OCR processing failed. External verification outcomes then map to final document status.

PaddleOCR runs through the configured runtime and worker path. The default device is `cpu`; no separate GPU deployment path is implemented. If OCR fails in production, inspect the underlying worker exception and stage instead of bypassing OCR or validation.

## Email OTP Flow

```text
Generate OTP
  → hash OTP
  → create/update user, company, and OTP record inside a Prisma transaction
  → transaction commits
  → Resend HTTPS API
  → email delivery
  → compare submitted OTP with stored hash
  → mark OTP and user email verified
```

The Resend request happens **after** the Prisma transaction commits. If sending fails, the created OTP is marked used. OTPs expire after 10 minutes, have a 60-second resend cooldown, and allow at most five failed attempts. Plaintext OTPs are not stored or logged.

Phone OTP is explicitly development-only and uses the fixed code in `development-phone-otp.service.ts`.

## Deployment

### Repository-confirmed commands

- Frontend build from the root: `npm run build`; Vite writes `dist/`.
- Backend build from `backend/`: `npm run build`; this cleans `backend/dist/` and runs TypeScript compilation.
- Render backend build from `backend/`: `npm run build:render`; this generates Prisma, creates/uses `ocr-runtime/.venv`, installs the pinned Python requirements, verifies the PaddleOCR import and worker startup, then builds TypeScript.
- Backend start from `backend/`: `npm run start`; this runs `dist/src/server.js`.
- Backend Prisma generation from `backend/`: `npm run prisma:generate`.
- Verification Prisma generation from `verification-database/`: `npm run prisma:generate`.

The backend `build` script does not generate Prisma clients. The verification client is generated by a different package and must be present at runtime.

### Render configuration

No `render.yaml`, Dockerfile, or committed Render service manifest exists in this repository. Therefore service names, root directories, publish-directory settings, exact dashboard commands, and production URLs cannot be confirmed from source. Verify those values in the Render dashboard and deployment logs.

A repository-valid Render backend configuration is:

```text
Root Directory: backend
Build Command: npm install && npm run build:render
Start Command: npm run start
```

`build:render` installs the Python requirements before the Node backend is compiled. It uses `backend/ocr-runtime/.venv/bin/python` on Render/Linux, which is also the runtime path selected by the production backend. The runtime never falls back to system Python. The build fails if the exact executable is missing, `paddleocr` cannot be imported from it, or the worker self-check fails.

The equivalent preparation sequence is:

```powershell
# Backend dependencies, Prisma client, Python OCR runtime, verification, and build
cd backend
npm install
npm run build:render

# Separate verification dependencies and Prisma client
cd ..\verification-database
npm install
npm run prisma:generate
```

If Render builds from the repository root, its command must change into `backend/` before running the backend commands. If the backend and verification database are separate services, each service still needs the generated client required by the backend runtime. Do not assume `npm run build` generates either client.

Production must provide `DATABASE_URL`, `VERIFICATION_DATABASE_URL`, JWT secrets, Cloudinary values, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, OCR runtime settings, `FRONTEND_URL`, `VITE_API_URL`, and `NODE_ENV` as applicable to the service. Do not include credentials in deployment files or this README.

## Production Verification Database

- Schema: `verification-database/prisma/schema.prisma`.
- Generated client: `verification-database/generated/client`.
- Generate it with `npm run prisma:generate` from `verification-database/`.
- Apply its checked-in migrations with `npm run prisma:migrate` from `verification-database/`.
- Load synthetic fixtures with `npm run seed`.

`backend/src/services/mock-verification.service.ts` searches for the generated client in the repository's verification-database paths, dynamically imports it, and constructs it with `env.verificationDatabaseUrl`. If the generated client is absent, verification cannot complete.

## Troubleshooting

### API returns 401

Check the `Authorization: Bearer <access-token>` header, access-token expiry, and refresh-token handling. The backend rejects missing, malformed, invalid, and expired tokens.

### API returns 404

Check that the backend is running, that the requested route matches the mounted `/api` groups, and that `VITE_API_URL` points to the intended backend. Confirm `/api/health` first.

### API returns 502 during email OTP

Check `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, the verified sender domain, network access to Resend, and Render logs. The backend logs safe provider status/name/code diagnostics. Do not log API keys, authorization headers, or OTPs.

### Document validation fails in production

Check: (1) OCR logs, (2) PaddleOCR worker errors, (3) Cloudinary retrieval, (4) the matching document definition, (5) the generated verification Prisma client, and (6) verification database connectivity. Do not bypass document validation.

### PaddleOCR worker failure

Cloudinary retrieval may succeed while OCR fails. Inspect the underlying worker exception, Python path, worker path, input format, timeout, and deployment logs. `worker-failure/status=unknown` is not the root cause by itself.

### Verification database unavailable

Check that `verification-database/generated/client` exists in the deployed filesystem, that it was generated from the current schema, and that `VERIFICATION_DATABASE_URL` reaches `cpcl_verification`. Use connection/migration logs without exposing credentials.

## Production Logging

Safe logs include backend configuration-presence flags, Morgan request logs, OCR stage/provider/status/field counts, extraction and validation summaries, verification status and field counts, redacted Resend diagnostics, and safe Cloudinary status/request IDs.

Never log or commit API keys, API secrets, passwords, access/refresh tokens, authorization headers, plaintext OTPs, `DATABASE_URL`, database credentials, raw document contents, or sensitive document fields.

## Security

Implemented practices include:

- `bcryptjs` password hashing with cost factor 12.
- Separate JWT secrets for access and refresh tokens.
- Bearer authentication and officer/bidder role checks.
- Hashed/revocable refresh tokens.
- Hashed email OTPs with expiry, cooldown, and failed-attempt limits.
- Environment variables for secrets.
- Helmet, CORS allow-list handling, Zod validation, centralized errors, and rate limits on auth/OTP endpoints.
- Server-side Cloudinary access and signed delivery URLs.
- Safe error logging that redacts email addresses and bearer values and avoids document/OTP contents.

The fixed phone OTP is development-only and is not a production SMS security control.

## Testing

### Frontend

From the repository root:

```powershell
npm run build
```

### Backend

From `backend/`:

```powershell
npm run build
npm run test:extraction
npm run test:phone
npm run test:auth-phone
npm run test:verification
npm run test:paddle-errors
npm run test:paddle-worker
npm run test:paddle-node
```

OCR checks require the configured Python runtime. Verification checks require the generated verification client and reachable fixture database.

### Verification database

From `verification-database/`:

```powershell
npm run verify
```

No Jest, Vitest, Cypress, Playwright, or other test runner is declared in the package manifests.

## Production Checklist

- [ ] Environment variables configured
- [ ] CPCL tender database reachable
- [ ] Verification database reachable
- [ ] Verification Prisma client generated and present at runtime
- [ ] Cloudinary configured
- [ ] Resend configured with a verified sender
- [ ] Frontend points to the production API
- [ ] Backend build successful
- [ ] Frontend build successful
- [ ] OCR dependencies/runtime available
- [ ] `GET /api/health` responds
- [ ] Registration and OTP tested
- [ ] Document upload tested
- [ ] Document extraction/verification tested

## Important Development Rules

- Do not commit `.env` files.
- Do not expose API keys, passwords, tokens, or database credentials.
- Do not bypass document verification.
- Do not modify OCR simply to hide production failures.
- Keep the verification database separate from the tender database.
- Generate the verification Prisma client during deployment.
- Keep external email requests outside Prisma interactive transactions.
- Treat JSON document definitions as rules/configuration and the verification database as data.

## Troubleshooting Commands

### Local — frontend

```powershell
npm run build
npm run dev
```

### Backend

From `backend/`:

```powershell
npm run build
npm run start
npm run dev
npm run test:extraction
npm run test:paddle-errors
```

### Verification database

From `verification-database/`:

```powershell
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run verify
```

### Render/deployment

The repository has no Render service manifest. The safe repository-valid preparation commands are:

```powershell
cd backend
npm install
npm run prisma:generate
npm run build

cd ..\verification-database
npm install
npm run prisma:generate
```

Use `npm run start` from the backend service directory after a successful build. Do not run destructive production database commands from this README.

## Maintainers / Project Notes

Maintainer information is not present in the repository. Add the owning team, support channel, and deployment ownership here when formally assigned.
