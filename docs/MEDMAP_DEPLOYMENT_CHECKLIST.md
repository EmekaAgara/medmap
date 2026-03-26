# MedMap Deployment Checklist (Backend + Expo Mobile)

This is a release-ready checklist you can follow right before going live.

---

## 1) Before You Deploy (Both App + Backend)

### 1.1 Code & version
- Confirm you’re on the intended git commit/branch for release.
- Tag the release commit (optional but recommended).
- Confirm the mobile app `version` is correct in `mobile/app.json`.
- Confirm backend build/seed behavior is what you want in production (generally: do not run demo seeds unless intended).

### 1.2 Environment variables (no placeholders in prod)
- Backend: ensure all required secrets are set (JWT secrets, Mongo URI, Cloudinary, SMTP/email, Interswitch secrets).
- Mobile (Expo): ensure `EXPO_PUBLIC_API_URL` points to the live backend host.
- Mobile (Expo): if Socket.IO origin differs from REST, also set `EXPO_PUBLIC_SOCKET_URL`.

Quick reference (backend config is in `backend/src/config/env.js`):
- `MONGO_URI`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `CORS_ORIGINS`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`
- `APPOINTMENT_REMINDER_CRON`, `APPOINTMENT_REMINDERS_ENABLED`
- Interswitch:
  - `INTERSWITCH_WEBHOOK_SECRET`
  - `INTERSWITCH_MERCHANT_CODE`, `INTERSWITCH_PAYABLE_CODE`, `INTERSWITCH_MAC_KEY`, `INTERSWITCH_REDIRECT_URL`, `INTERSWITCH_WEBPAY_MODE`
  - `INTERSWITCH_WEBPAY_URL_TEST`, `INTERSWITCH_WEBPAY_URL_LIVE`
  - `INTERSWITCH_GETTRANSACTION_PATH`, `INTERSWITCH_REQUERY_BASE_TEST`, `INTERSWITCH_REQUERY_BASE_LIVE`
  - optional: `INTERSWITCH_CLIENT_ID`, `INTERSWITCH_CLIENT_SECRET`, `INTERSWITCH_BASE_URL`, etc.
- `PLATFORM_FEE_BPS`
- optional: `GEMINI_API_KEY` (or OpenAI fallback keys if you configured them)

### 1.3 External services “go live” checks
- MongoDB: confirm Atlas/managed Mongo user has access and network rules allow your production host.
- Cloudinary: confirm credentials and uploading works from your backend container.
- Email: confirm the SMTP credentials work (Gmail generally requires App Passwords).
- Interswitch:
  - Update `site_redirect_url` to your production redirect endpoint.
  - Update `webhook` URL to your production webhook endpoint.
  - Confirm your backend base URL and paths used by InterSwitch match production.
- Socket.IO: confirm your mobile app can reach the Socket.IO origin.

---

## 2) Backend Deployment (Node/Express + Socket.IO + Cron)

Your backend is already Dockerized (`backend/Dockerfile`) and runs:
- HTTP server on port `4000`
- MongoDB connection via `MONGO_URI`
- Socket.IO via `attachSocketIo(server)`
- Appointment reminder scheduling via `node-cron`

### Best platform recommendation
1. **Fly.io** (recommended): great for always-on Node services, websockets, and easy Docker-based deployments.
2. **Render**: very straightforward Docker “Web Service” deployment for Node apps (also supports websockets well).
3. **AWS (ECS/Fargate)**: most flexible but higher setup complexity.

If you want the fastest “ship it” path: **Render Web Service (Docker)** or **Fly.io**.

### 2.1 One-time setup for your chosen platform
- Create your production app/service (Docker build).
- Set all backend environment variables in the platform UI (or via secrets manager).
- Set the service to be always-on (important for cron).
- Confirm the platform routes traffic to the container port `4000`.

### 2.2 Deploy steps (Docker-based)
Pick one approach:

#### Option A: Platform builds from your repo
- Connect your GitHub repo to the platform.
- Set build to use the provided `backend/Dockerfile`.
- Ensure the runtime command is the container default (`CMD ["node", "src/server.js"]` in the Dockerfile).
- Deploy and verify logs.

#### Option B: Build/push your image, deploy that image
- Build: `docker build -t medmap-backend ./backend`
- Tag and push to your registry (DockerHub/GHCR/ECR).
- Deploy the image in your platform.

### 2.3 After deployment (backend)
- Verify server health: backend responds to `/` or a known endpoint.
- Verify Mongo is connected (logs should show successful connect).
- Verify Socket.IO:
  - Mobile app connects successfully (check backend logs for socket connections).
- Verify cron:
  - Ensure `APPOINTMENT_REMINDERS_ENABLED=true`.
  - Confirm reminder job starts (look for job scheduling/logs).
- Verify CORS:
  - Ensure your mobile app origin / domain is included in `CORS_ORIGINS`.

### 2.4 Interswitch production reconfiguration
- Update all Interswitch URLs to your production backend host.
- Confirm:
  - webhook endpoint uses the same `INTERSWITCH_WEBHOOK_SECRET` you set in the platform env
  - redirect URL matches `INTERSWITCH_REDIRECT_URL` expectation
  - pay/gettransaction/requery paths match what the InterSwitch dashboard calls

---

## 3) Expo Mobile Deployment (iOS + Android via EAS)

You’re using Expo; deployment should be done through **EAS Build**.

### 3.1 Required EAS setup
- Install EAS CLI:
  - `npm i -g eas-cli`
- Login:
  - `eas login`
- Ensure you have:
  - an Expo account
  - Apple Developer account (for iOS)
  - Google Play Console account (for Android)
- Ensure you have correct production config for `mobile/app.json` (versioning, scheme, etc).

### 3.2 Set production API endpoints
- Create `mobile/.env` for production (or set envs in your EAS config).
- At minimum, set:
  - `EXPO_PUBLIC_API_URL=https://YOUR_BACKEND_HOST`
  - (optional) `EXPO_PUBLIC_SOCKET_URL=https://YOUR_BACKEND_HOST`

Note: the mobile code expects `api/v1` appended automatically if you use “host only” style URLs.

### 3.3 Build profiles (recommended)
- If you don’t already have an `eas.json`, you can create one (recommended for consistent production/staging builds).
- For a release, you generally want:
  - Android: buildType `app-bundle`
  - iOS: release build

### 3.4 Build & submit
Typical flow:
- Build:
  - `eas build -p android --profile production`
  - `eas build -p ios --profile production`
- Submit:
  - Android: `eas submit -p android --latest --profile production`
  - iOS: `eas submit -p ios --latest --profile production`

### 3.5 Post-deploy mobile checks
- Fresh install:
  - confirm app opens
  - confirm theme matches device settings (if you support both)
- Auth:
  - login, signup, OTP flow (if used)
  - logout and re-login
- Core navigation:
  - Home, Explore (excluded from top-safe changes), Profile, Messages, Notifications, Wallet
- Location features:
  - permit location and confirm nearest provider sorting still works
- Payments (must test on production credentials):
  - wallet fund / checkout webview
  - ensure receipt/polling flow completes
- Push notifications:
  - confirm reminders/messages come through

---

## 4) QA “Release Gate” (Final checklist)

Use this to validate “ready for users”.

### 4.1 Must-pass user journeys
- New user sign up -> login -> home loads.
- Find providers and successfully view provider details.
- Call provider flow works.
- Chat flow:
  - start conversation
  - verify unread indicators
- Notifications flow:
  - unread badge/dots behavior
  - opening notification deep-links to the correct screen
- Wallet:
  - view transactions
  - open checkout webview and confirm payment success path
- Appointments:
  - request appointment
  - confirm provider acceptance/rejection notifications (if applicable)
  - ensure reminders trigger on schedule

### 4.2 Device sanity
- Test iPhone with Dynamic Island (top content not hidden).
- Test at least one Android device with a notch/cutout.
- Test both light/dark mode (where supported).

### 4.3 Observability & rollback readiness
- Confirm backend logs are accessible.
- Confirm error rates are acceptable.
- Have a rollback plan:
  - “pause new releases” and revert to previous build (if needed)

