# MedMap (Hackathon Submission)

MedMap is a mobile app that helps people **find nearby healthcare providers fast** (doctors, pharmacies, hospitals), **contact them instantly** (call/chat), and **complete care actions** like booking appointments and making payments via an in-app wallet.

## Links (placeholders)
- **Mobile app build link (Expo / TestFlight / Play internal testing):** `<ADD_LINK_HERE>`
- **Presentation (slides):** `<ADD_LINK_HERE>`
- **GitHub repo:** `<ADD_LINK_HERE>`
- **Video demo:** `<ADD_LINK_HERE>`

## What it does
- **Discovery**: map + list provider discovery with filters (type, open-now, search) and distance/ETA when location is enabled.
- **Urgent care mode**: quick access to emergency contacts and nearest open providers.
- **Chat**: real-time messaging between patients and providers + Meddie AI assistant.
- **Appointments**: request/confirm flows with reminders.
- **Wallet & payments**: fund wallet and pay for services/products via Interswitch checkout flow.
- **Commerce**: provider product catalog, cart, checkout, orders, prescription upload (where required).

## Tech overview
- **Mobile**: Expo + React Native (`mobile/`) using `expo-router`, token-based theme, shimmer loaders, and haptics.
- **Backend**: Node.js + Express + MongoDB (`backend/`) with REST API (`/api/v1`) + Socket.IO for chat.
- **Payments**: Interswitch integration for wallet funding and transaction verification.
- **Media**: Cloudinary uploads for avatars/documents.
- **Notifications**: Expo push tokens stored on user profiles; backend sends via Expo Push API.

## Repository structure
- `mobile/` — Expo mobile app
- `backend/` — Node/Express API + Socket.IO
- `admin/` — Admin web app (Vite/React)
- `docs/` — test plan, build phases, deployment checklist, hackathon writeup

## Docs
- `docs/MEDMAP_HACKATHON_SUBMISSION.md` — slide-ready narrative (problem, solution, value, stats placeholders)
- `docs/MEDMAP_DEPLOYMENT_CHECKLIST.md` — backend + Expo deployment checklist
- `docs/MEDMAP_TEST_PLAN.md` — end-to-end test plan

