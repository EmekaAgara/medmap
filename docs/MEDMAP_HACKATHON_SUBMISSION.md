# MedMap — Hackathon Submission Doc (Slide-Ready)

Use this as your slide script. Replace placeholders with your real numbers and links.

---

## 1) Title
**MedMap** — Find care providers fast. Contact instantly. Pay securely.

**Team:** `<TEAM_NAME>`  
**Hackathon track:** `<TRACK>`  
**Region:** Nigeria (initial focus)  

---

## 2) Problem Statement
In urgent and everyday health situations, people struggle to:
- **Find nearby providers quickly** (doctors, pharmacies, hospitals).
- **Know what’s open** right now.
- **Contact a provider immediately** (call/chat).
- **Complete care actions** (book, pay) without friction.

This leads to:
- Delayed care and avoidable health risks.
- Time wasted calling/searching through unreliable directories.
- Poor continuity (no simple pathway from discovery → contact → appointment → payment).

---

## 3) The Solution
MedMap is a location-first care access platform that:
- Shows **nearby providers** on map + list with distance/ETA.
- Lets users **call or chat** in one tap.
- Supports **appointments**, **wallet**, and **payments** in-app.
- Includes an AI assistant (**Meddie**) to help users navigate care and information (with safety guardrails).

---

## 4) Target Users
- **Patients**: find care, contact providers, book, pay, manage history.
- **Providers (doctor/pharmacy/hospital admins)**: manage listing, respond to messages, manage appointments/orders.
- **Platform admin** (optional): oversight, approvals, moderation.

---

## 5) Key Features (What we built)

### Discovery & Urgent Access
- **Explore map**: nearby providers, callouts with key metadata.
- **Smart filters**: provider type, open-now, search.
- **Urgent care**: emergency contacts + nearest open providers first.

### Communication
- **Real-time chat (Socket.IO)** between patient and provider.
- **Unread indicators** + notification deep-linking into chat.

### Appointments
- Request/confirm flows for scheduling.
- Reminder jobs (server-side cron) + push notifications (when configured).

### Wallet & Payments (Interswitch)
- Fund wallet via in-app checkout.
- Verify transactions and show history.

### Commerce
- Provider product catalogs.
- Cart + checkout + orders.
- Prescription upload flow (for restricted items).

### UX / Product Quality
- Unified design system (token-based theme).
- Animated shimmer loaders.
- Haptic feedback on key interactions.

---

## 6) Why Now (Timing)
- Smartphone penetration + demand for quicker access to services.
- Fragmented provider directories and inconsistent availability information.
- Increasing expectation for end-to-end digital workflows (discovery → contact → payment).

---

## 7) Economic Value / Business Model
MedMap can generate value through:
- **Transaction fees**: take a platform commission (e.g., `PLATFORM_FEE_BPS`) on paid appointments/orders.
- **Provider subscriptions**: premium listing visibility, verified badges, enhanced storefronts.
- **B2B partnerships**: labs, diagnostics, logistics partners, HMO/insurance networks.

**Unit economics placeholders (fill in):**
- Avg. appointment value: `<₦X>`
- Conversion rate discovery→contact: `<X%>`
- Conversion rate contact→paid action: `<X%>`
- Platform take rate: `<X%>`
- Estimated revenue / 1,000 users: `<₦X>`

---

## 8) Impact (Social + Health Outcomes)
Expected impact:
- Reduce time to find an open provider.
- Improve access and continuity (contact → appointment).
- Lower friction for payment and commerce, especially in urgent contexts.

**Impact metrics placeholders:**
- Time-to-provider (median): `<X seconds>`
- Successful contact rate: `<X%>`
- Appointment completion rate: `<X%>`
- Wallet funding success rate: `<X%>`

---

## 9) Traction / Validation (Placeholders)
Add whatever you have (even small):
- Users onboarded: `<#>`
- Providers seeded/listed: `<#>`
- Cities covered: `<#>`
- Chats initiated: `<#>`
- Transactions simulated/completed: `<#>`
- Demo feedback: `<quotes>`

---

## 10) Differentiation
Why MedMap is different:
- **Fast path**: discovery → contact → appointment/payment in one app.
- **Urgency-first UX**: “open now” prioritization + emergency workflow.
- **Provider + commerce**: not just directory — it’s operational.
- **Unified experience**: consistent UI tokens + loading and interaction patterns.

---

## 11) Architecture (High level)

### Mobile (Expo / React Native)
- `expo-router` navigation
- Token-based theme + reusable UI components
- Location + maps (`react-native-maps`)
- Push registration via `expo-notifications` (requires dev build / release build)

### Backend (Node/Express)
- REST API mounted at `/api/v1`
- MongoDB persistence
- Socket.IO for chat
- Scheduled jobs (cron) for appointment reminders

### Integrations
- Interswitch payments (wallet funding + verification)
- Cloudinary (uploads)
- SMTP email (OTP / notifications)
- Expo Push API (server sends push to stored Expo tokens)

---

## 12) Security / Privacy Notes (Hackathon-level)
- JWT auth (access + refresh tokens).
- Role-based flows for patients vs providers.
- Secure storage on device (SecureStore).
- Payment verification logic on server-side.

**Planned next steps:**
- Stronger audit logs & admin controls
- Provider verification workflows
- Rate limiting & abuse prevention tuning

---

## 13) Demo Script (3–5 minutes)
1. Open app → onboarding → login
2. Home: quick actions + discovery search
3. Explore: map, filter provider type, open-now
4. Provider details: call/chat, services/products
5. Chat: message provider / Meddie
6. Wallet: fund wallet → checkout webview → verify transaction
7. Notifications: open notification deep-link into chat/appointment

---

## 14) Submission Links (fill in)
- **Mobile app:** `<ADD_LINK_HERE>`
- **Presentation:** `<ADD_LINK_HERE>`
- **GitHub:** `<ADD_LINK_HERE>`
- **Video demo:** `<ADD_LINK_HERE>`

