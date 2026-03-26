# MedMap Build Phases

MedMap is a mobile app that helps users quickly find and connect with nearby healthcare providers such as doctors, pharmacies, and hospitals. It uses location data to display nearby options with key details like services offered, distance, availability, and contact information, with options to call or chat instantly.

Healthcare professionals, hospitals, and pharmacies can list their services and products. Users can pay for products and services using Interswitch APIs, store money in an in-app wallet, and use an AI chat assistant with context from medical information such as appointment history and treatment records.

---

## Phase 0: Product Definition (1-2 weeks)

- Define user roles:
  - Patient
  - Doctor
  - Hospital Admin
  - Pharmacy Admin
  - Platform Admin
  - When a user creates an account they can select their role and also complete their profile later
- Lock core use cases:
  - Find care fast
  - Contact provider immediately
  - Book and pay quickly
  - Access medical history
- Select initial launch region/city and provider categories.
- Define legal, compliance, and privacy requirements early (health data + payments).

---

## Phase 1: MVP Discovery + Fast Contact

**Goal:** users can find and contact relevant providers quickly.

- Patient onboarding (phone/email, basic profile, location permissions).
- Provider listings (doctor, pharmacy, hospital):
  - Services offered
  - Working hours
  - Distance and location
  - Contact information
- Map view + list view.
- Filters (provider type, open now, distance, availability where possible).
- One-tap actions:
  - Call provider
  - Send quick message
- Provider mini-portal:
  - Create/claim listing
  - Update profile and services
- Basic admin dashboard:
  - Approve/verify listings
  - Moderate content

**Success metric:** a user can discover and contact a provider in under 60 seconds.

---

## Phase 2: Chat, Scheduling, and Urgent Access

**Goal:** convert discovery into real care interactions.

- Real-time in-app chat between patient and provider.
- Appointment booking flow:
  - Request slot
  - Confirm/reject by provider
  - Reschedule/cancel
- Push notifications:
  - New messages
  - Appointment updates
  - Reminders
- Urgent care mode:
  - Nearest open providers first
  - Fast-call options
  - Emergency-friendly UX shortcuts

**Success metric:** increase in contact-to-appointment conversion rate.

---

## Phase 3: Payments + Wallet (Interswitch Integration)

**Goal:** enable full in-app transactions.

- Integrate Interswitch APIs for:
  - Appointment payments
  - Product/service checkout
  - Payment confirmations and receipts
- In-app wallet:
  - Fund wallet
  - Pay via wallet
  - View transaction history
  - Handle refunds/reversals
- Provider settlement features:
  - Platform fee/commission model
  - Payout and reconciliation reports
- Payment reliability and risk controls:
  - Retry flow for failed payments
  - Fraud/risk checks

**Success metric:** high payment success rate and low failed transaction rate.

---

## Phase 4: Commerce system

**Goal:** support medicine/product purchases end-to-end.

- Pharmacy product catalog:
  - Medicines and health products
  - Pricing and stock availability
- Prescription upload flow (for restricted medicines).
- Cart + checkout.
- Delivery/pickup options and order status tracking.
- product order management dashboard.

**Success metric:** order completion rate and repeat product purchases.

---

## Phase 5: Medical Timeline + AI Health Assistant

**Goal:** improve continuity of care and personalized support.

- Patient medical timeline:
  - Appointments history
  - Treatment history
  - Medications
  - Allergies/conditions
- Provider-authored notes and visit summaries (role-based access).
- AI chat assistant with patient consent:
  - Uses medical context for better support
  - Reminders and follow-up guidance
  - Symptom triage suggestions with safety guardrails
- Safety policy:
  - AI provides assistance, not final diagnosis
  - Escalate to licensed providers where needed
  - The Ai should me called Meddie he should be in the messages he should be able to access the patients full medical info medical history allergies etc to be able to provide help and recommendations when they chat with it
  - Also patients should be able to add allergies and other key info needed like weight height bood group etc wehn completing their profile and the ai should be able to get and use all these info for recomendations and conversatipons the ai should be a medical expert and should respond as such

**Success metric:** better retention and fewer missed appointments.

---

## Phase 6: Scale and Ecosystem Expansion (Ongoing)

- Stronger provider verification (licenses/certifications).
- Ratings and reviews.
- Multi-city rollout and localization.
- Operational analytics:
  - Demand hotspots
  - Wait times
  - Service coverage gaps
- Integrations:
  - Labs/diagnostics
  - Insurance
  - Telemedicine video calls

---

## Cross-Cutting Foundations (Apply from Day 1)

- Security and privacy:
  - Encryption at rest and in transit
  - Audit logs
  - Consent and permissions model
  - Role-based access controls
- Compliance:
  - Healthcare data regulations
  - Financial/payment regulations
- Reliability:
  - Monitoring and alerting
  - Backups and disaster recovery
  - Incident response process
- Data architecture:
  - Separate domains for identity, clinical records, chat, and payments ledger
- Operations:
  - Provider onboarding workflows
  - Dispute and support handling

---

## Recommended Build Sequence

1. Phase 0 + Phase 1 (launchable MVP)
2. Phase 2 (engagement and repeat usage)
3. Phase 3 (monetization and wallet)
4. Phase 4 (pharmacy commerce)
5. Phase 5 (AI + longitudinal care)
6. Phase 6 (scale and ecosystem integrations)

npm run seed:nigeria:500

1. Webhook URL (status webhook)
   POST /api/v1/wallets/webhooks/interswitch

So the full URL you must set in the Interswitch dashboard is:

https://<YOUR_API_HOST>[/<PORT_IF_NEEDED>]/api/v1/wallets/webhooks/interswitch

2. Web Checkout “redirect notification” URL (site_redirect_url callback)
   POST /api/v1/wallets/webpay/redirect

Full URL: https://<YOUR_API_HOST>[/<PORT_IF_NEEDED>]/api/v1/wallets/webpay/redirect
