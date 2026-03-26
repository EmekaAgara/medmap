# MedMap End-to-End Test Plan

This document defines how to test MedMap across all major user flows and systems.

---

## 1) Scope

Test the app end-to-end across:

- Authentication and onboarding
- Profiles, KYC, and security
- Provider discovery, map, filters, urgent care
- Appointments (patient and provider)
- Wallet and Interswitch payment flow
- Commerce (catalog, cart, checkout, orders, prescriptions)
- Chat and Meddie AI
- Notifications (in-app, push, email triggers)
- Theme, UI consistency, haptics, and shimmer loaders
- Core API reliability and error handling

---

## 2) Test Environments

- **Backend:** local/staging with production-like config
- **Mobile:** iOS + Android (real devices preferred)
- **Payment mode:** Interswitch TEST mode
- **Network modes:** Wi-Fi, slow network, intermittent network
- **Build modes:** dev + release candidate

---

## 3) Test Accounts

Prepare and keep seeded accounts:

- `patient_1`
- `patient_2`
- `doctor_admin_1`
- `pharmacy_admin_1`
- `hospital_admin_1`
- `platform_admin_1` (if admin UI/API used)

Also ensure at least:

- 1 approved provider listing per provider type
- 1 unapproved listing
- 1 provider with products (in stock, out of stock, prescription-required)
- 1 provider with chat enabled

---

## 4) Preconditions Checklist

- Backend and mobile app boot successfully
- Database reachable and migrations/seed complete
- Push token registration works
- Notification channels configured
- Interswitch credentials set for TEST
- Redirect URL and verification endpoints configured
- Mail transport configured for email notification tests
- AI key configured for Meddie

---

## 5) Core Test Matrix

Run each suite on:

- iOS + Android
- Light + Dark mode
- Online + weak network

For each test case record:

- Pass/Fail
- Build version
- Device + OS
- Screenshots/video for failures
- Backend logs and request IDs where possible

---

## 6) Functional Suites

### A. Auth and Account Lifecycle

1. Register with valid patient data
2. Register with valid provider data
3. Email/OTP verification success and failure paths
4. Login with email and with phone
5. Forgot/reset password flow
6. Logout and re-login
7. Invalid credential error handling

Expected:

- Correct role routing
- Validation messages are clear
- No blocked flow after successful verification

---

### B. Profile, Edit Profile, KYC, Security

1. View profile data and avatar fallback
2. Edit profile fields and confirm persistence
3. Upload/change/remove profile image
4. KYC step progression (BVN/ID/docs/bank/submission)
5. KYC rejected/resubmission path
6. Security center routes (PIN/sessions/history where enabled)

Expected:

- Profile refresh reflects edits immediately
- KYC statuses update correctly
- Protected actions enforce auth

---

### C. Discovery and Provider Flows

1. Home provider cards load and route to details
2. Explore filters (type/open now) and map markers
3. Providers list pagination and load-more
4. Urgent flow shows open providers first
5. Call/chat actions invoke correct behavior

Expected:

- Filter state changes update results correctly
- Distances/ordering consistent with location and radius

---

### D. Appointment System

Patient:

1. Book appointment request
2. Cancel request
3. View appointment details and timeline

Provider:

1. See incoming requests
2. Confirm/reject/reschedule
3. Add visit summary/notes

Expected:

- Status transitions are valid and reflected in both roles
- Notification sent on each critical status change

---

### E. Wallet and Payments (Interswitch)

1. Start wallet top-up from app
2. Complete checkout via Web Redirect / WebView
3. Verify backend confirms payment server-side (`gettransaction.json`)
4. Confirm wallet balance and transaction history update
5. Test failed payment path (no wallet credit)
6. Retry pending verification path

Expected:

- Credit only when `ResponseCode === "00"` and amount matches
- No false positives from redirect params alone
- Transaction record consistent with wallet balance

---

### F. Commerce (Catalog, Cart, Checkout, Orders)

Provider:

1. Manage catalog (create/update products)
2. Set stock and prescription-required flags

Patient:

1. Browse provider shop and product details
2. Add to cart, update quantity
3. Checkout with pickup and delivery options
4. Prescription upload flow for restricted items
5. Order payment flow and order status tracking

Seller:

1. Process/advance order statuses
2. Fulfill order

Expected:

- Stock validation blocks over-purchase
- Prescription-required items enforce upload
- Status transitions and tracking history are correct

---

### G. Chat and Meddie AI

1. Start provider chat and exchange messages real-time
2. Start Meddie conversation
3. Verify Meddie intro message appears
4. Send patient query and receive AI response
5. Typing indicator and keyboard behavior
6. Consent-disabled behavior for AI

Expected:

- No duplicate message keys/render issues
- Chat list updates latest message/time correctly
- Meddie only uses allowed context and safe responses

---

### H. Notifications System

1. Trigger in-app notifications for payments/orders/appointments/messages
2. Verify notification page list and unread state
3. Verify unread badge count on Home icon
4. Verify deep-link behavior from notification tap
5. Verify push delivery for supported events
6. Verify email delivery for configured events

Expected:

- Event -> notification mapping is complete
- Unread count is accurate and updates after read

---

### I. UI/UX System Checks

1. Theme consistency across screens (light/dark)
2. Token-aligned spacing/buttons/inputs/headers
3. Shimmer loaders appear for major loading states
4. Haptic feedback on quick actions/toggles/primary interactions
5. Accessibility basics (touch targets, readable contrast, keyboard handling)

Expected:

- No jarring style drift between key screens
- Interactions feel responsive and consistent

---

## 7) Non-Functional Tests

### Performance

- Cold start time
- Screen transition latency
- Large list scrolling smoothness
- Chat message burst handling

### Reliability

- App behavior during backend timeout
- Recovery after reconnect
- Safe retries without duplicate actions

### Security and Data

- Auth guard on protected routes
- Role-based API access checks
- Sensitive data not leaked in UI/logs

---

## 8) Regression Pack (Must-Run Before Release)

Run this minimum set every release:

1. Register -> verify -> login
2. Home discover -> provider details
3. Book appointment -> provider confirm
4. Wallet top-up success and failed payment
5. Place order -> pay -> seller status updates
6. Chat provider + Meddie response
7. Notification badge + notification deep links
8. KYC submit + status visibility

---

## 9) Defect Reporting Format

For each bug capture:

- Title
- Environment (device, OS, build, branch)
- Repro steps
- Actual result
- Expected result
- Severity (Blocker/Critical/Major/Minor)
- Evidence (video/screenshot/log snippets)

---

## 10) Release Exit Criteria

Release can proceed only if:

- No Blocker/Critical open defects
- Regression pack passes on iOS and Android
- Payment verification is confirmed server-side
- Notifications, chat, and orders are stable under normal load
- Product owner signs off on key patient/provider journeys

