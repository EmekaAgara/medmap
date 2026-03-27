# MedMap (Hackathon Submission)

MedMap is a mobile app that helps people **find nearby healthcare providers fast** (doctors, pharmacies, hospitals), **contact them instantly** (call/chat), and **complete care actions** like booking appointments and making payments via an in-app wallet.

MedMap helps users quickly find and connect with nearby healthcare providers such as doctors, pharmacies, and hospitals. Using location data, it displays nearby options with key details like services offered, distance, availability, and contact information. The app focuses on fast access to care, allowing users to filter results and instantly call or message providers, especially useful in urgent situations.

## Links

- **Mobile app build link (APK):** https://expo.dev/artifacts/eas/cxw9d5dRV5GELP3GA5dyxk.apk

-- **Google Drive** -- https://drive.google.com/drive/folders/1xyJgYja_nlB9WOkbV4rgGvaN4M01e7DV?usp=sharing

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

## How to run the app

- - **Download the apk file here:** https://expo.dev/artifacts/eas/cxw9d5dRV5GELP3GA5dyxk.apk

-- Create a new account or login with the details below to test the app

user account
emekaagara@gmail.com
Ea08094333881\*

hospital/admin account
emekaagara@gmail.com
Ea08094333881\*
