# CPCL Procure Backend

Independent Express + TypeScript + MySQL 8 + Prisma API for the CPCL Tender Compliance platform. The existing frontend is intentionally not connected in this phase.

## Setup

1. Install and start MySQL 8.x.
2. Create the database:

```sql
CREATE DATABASE cpcl_tender;
```

3. Copy `.env.example` to `.env` and replace `YOUR_PASSWORD` in `DATABASE_URL`. Set `JWT_SECRET` and `REFRESH_TOKEN_SECRET` as well. For Gmail email OTP delivery, set `SMTP_USER` to the Gmail account address, `SMTP_PASS` to its Google App Password, and `SMTP_FROM` to `CPCL Procure <same-gmail-address>`.
4. Install dependencies and generate Prisma Client:

```powershell
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
```

Then start the API:

```powershell
npm run dev
```

The MySQL URL format is `mysql://USER:PASSWORD@localhost:3306/cpcl_tender`.

The API runs at `http://localhost:5000`. Health check: `GET /api/health`.

## OTP verification

Phone OTP is a development-only flow and always uses `123456`. The send response includes that development code so local testing does not need an SMS provider. Replace this flow with an approved SMS provider before production use.

Email OTP uses Gmail SMTP through Nodemailer. Codes are generated with a cryptographically secure random number, hashed before storage, expire after 10 minutes, allow at most five failed attempts, and have a 60-second resend cooldown. Previous active codes are invalidated when a new code is sent. The plaintext code is never stored or logged. If SMTP credentials are missing, the email send endpoint returns HTTP 503.

## Seed credentials

- Officer: `rahul.sharma@cpcl.co.in` / `DemoPassword123!`
- Bidder: `abc@demo.cpcl.in` / `DemoPassword123!`

Seeded users are already marked verified so protected flows can be tested. Newly registered users start with both verification flags false; verify email before login. Phone verification remains a development-only prototype flow.

## API groups

- `/api/auth`: register, login, refresh, logout, email OTP, development phone OTP, forgot/reset password
- `/api/officer`: tender CRUD, requirements, applications, accept/reject, blacklist
- `/api/bidder`: active tenders, applications, documents, tender-specific documents
- `/api/notifications`: list, mark one read, mark all read

All responses use `{ success, data, message, errors }`. Protected endpoints use `Authorization: Bearer <accessToken>`.

## Postman

Import `CPCL-Backend.postman_collection.json`. Set `baseUrl` to `http://localhost:5000`, then store `accessToken`, `refreshToken`, `tenderId`, `applicationId`, and `companyId` from responses.

For OTP testing, register a bidder, call `/api/auth/otp/email/send` with the registered email, and verify using the six-digit code received through Gmail SMTP. Call `/api/auth/otp/phone/send` and `/api/auth/otp/phone/verify` with code `123456` when testing the development phone flow. Login is allowed after email verification; phone verification is not required by the current prototype login flow.

## Verification checklist

```powershell
cd backend
npm install
Copy-Item .env.example .env
# configure MySQL credentials and Gmail SMTP values in .env
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

Verify `GET http://localhost:5000/api/health`, then test login with the seeded officer or bidder credentials and call a protected endpoint with the returned bearer token.
