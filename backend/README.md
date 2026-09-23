# CPCL Procure Backend

Independent Express + TypeScript + MySQL 8 + Prisma API for the CPCL Tender Compliance platform. The root Vite frontend connects to this API.

## Setup

1. Install and start MySQL 8.x.
2. Create the database:

~~~sql
CREATE DATABASE cpcl_tender;
~~~

3. Copy .env.example to .env, configure the MySQL URL, JWT secrets, Gmail SMTP values, and Cloudinary values.
4. Install dependencies, generate Prisma Client, migrate, seed, and start:

~~~powershell
cd backend
npm install
Copy-Item .env.example .env
# configure MySQL, Gmail SMTP, and Cloudinary credentials in .env
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

Phone OTP is a development-only flow and always uses 123456. Email OTP uses Gmail SMTP through Nodemailer. Codes are generated with a cryptographically secure random number, hashed before storage, expire after 10 minutes, allow at most five failed attempts, and have a 60-second resend cooldown. The plaintext code is never stored or logged. If SMTP credentials are missing, the email send endpoint returns HTTP 503.

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
# configure MySQL credentials, Gmail SMTP values, and Cloudinary credentials
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
~~~

Verify GET http://localhost:5000/api/health, then test login with the seeded officer or bidder credentials and call a protected document endpoint with the returned bearer token.
