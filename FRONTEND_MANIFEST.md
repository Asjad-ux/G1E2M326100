# CPCL Frontend-Only Manifest

## Source

- Original project root: `C:\Users\Asjadzia\Downloads\cpcl\cpcl-main`
- Copy destination: `C:\Users\Asjadzia\Downloads\cpcl\cpcl-main\frontend-only`

## Detected frontend

- Build tool: Vite (`vite.config.js`)
- Frontend implementation: root-level static JavaScript UI plus a React source tree under `src/`
- Active HTML entry point: `index.html`
- Active static scripts referenced by `index.html`: `backend-api.js`, then `app.js`
- React source entry point: `src/main.jsx` (preserved as frontend source; the current `index.html` does not reference it)
- Package manager: npm (`package.json` and `package-lock.json`)

## Copied frontend files and directories

- `package.json`
- `package-lock.json`
- `vite.config.js`
- `index.html`
- `app.js`
- `backend-api.js`
- `styles.css`
- `src/`
  - `src/main.jsx`
  - `src/App.jsx`
  - `src/styles.css`
  - `src/services/api.js`

No `public/`, `assets/`, local image, icon, or font directory was found in the original project. The React stylesheet references Google Fonts remotely; no local font files were copied.

## Excluded backend, database, and generated content

- `backend/` (including server source, document/OCR processing, Cloudinary services, Prisma schema, migrations, scripts, and backend dependencies)
- `verification-database/` (including generated Prisma client, schema, migrations, SQL, and scripts)
- `node_modules/`
- `backend/node_modules/`
- `verification-database/node_modules/`
- `dist/` and `backend/dist/`
- `tmp/` and `tmp/pdfs/`
- Environment files, secrets, and API-key files, including `backend/.env`
- `flow.pdf` and `tmp/pdfs/flow-1.png` (unreferenced/generated artifacts)
- `README.md` (project documentation, not required to run the frontend)

## Ambiguous classifications

- `backend-api.js` was copied because it is a browser-side API client loaded by `index.html` and used by `app.js`; it is not the backend/API server implementation.
- `src/` was copied because it is a complete frontend React source tree and is referenced by the Vite package setup, even though the current `index.html` uses the root static entry instead of `src/main.jsx`.
- `src/services/api.js` was copied because it is a browser-side API client imported by `src/main.jsx` and `src/App.jsx`.
- PDF names such as `CPCL_Industrial_Pumps_Tender.pdf` in `app.js` are runtime record strings; no corresponding local PDF assets were found, so no PDF asset was copied.
- The root `README.md` was excluded because it contains only project documentation and no frontend runtime content.

## Copy scope

Only the files listed above were copied. No JSX, JavaScript, CSS, package metadata, API endpoint, route, component, or asset content was changed.
