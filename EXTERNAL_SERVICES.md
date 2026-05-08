# EXTERNAL_SERVICES.md — External Services & Integration Guide

> **Project:** Local Delivery Platform  
> **Country:** Israel 🇮🇱 | **City:** Kabul / كابول  
> **Phone Country Code:** +972  
> **Currency:** ILS / ₪ (Israeli New Shekel)  
> **Source of Truth:** `DELIVERY_APPS_REQUIREMENTS.md`, `ERD.md`, `DATABASE_SCHEMA.md`, `API_CONTRACTS.md`, `BACKEND_STRUCTURE.md`, `MVP_TASKS.md`, `FRONTEND_STRUCTURE.md`  
> **Date:** 2026-05-07  
> **Version:** 1.0  
> **Audience:** Backend Engineers, DevOps, Tech Lead, Product

---

## 1. Purpose

This file lists every external service, third-party API, and cloud provider that is required or planned for the delivery platform.

The platform operates in **Israel** (city: **Kabul / كابول**), uses **+972** as the phone country code, and prices all transactions in **ILS / ₪ (Israeli New Shekel)**. Service choices — especially SMS providers and payment gateways — must be compatible with the Israeli market.

Its goal is to ensure the team knows:
- What accounts, credentials, and API keys need to be created before coding begins
- Which services are needed right now vs. which can wait
- What environment variables each service requires
- How to work locally without depending on every service being live
- What the production readiness checklist looks like before launch

This document is a decision reference — not implementation code.

---

## 2. Service Classification

| Service Category | Service Name / Options | Used For | MVP / Post-MVP / Future | Required Now (v0.1)? | Notes |
|---|---|---|---|---|---|
| Database Hosting | PostgreSQL (Docker / Supabase / Neon / Render / DigitalOcean / Railway) | Primary persistent store | MVP | Yes | Docker for local; managed for production |
| Redis Hosting | Redis (Docker / Upstash / Render Redis / DigitalOcean Redis) | Dispatch lock, location cache, rate limiting, idempotency | MVP | Yes | Docker for local; managed for production |
| Push Notifications | Firebase Cloud Messaging (FCM) | Push notifications to all 3 apps | MVP | Placeholder only in v0.1 | Real credentials needed in Phase 7 |
| SMS / OTP | Inforu / 019 Mobile / Vonage / Twilio (fallback) | Customer & driver OTP login via +972 | MVP | Mock in v0.1 | Israeli provider required for +972 numbers; real credentials needed before auth testing |
| Maps & Geocoding | Google Maps / OpenStreetMap / Mapbox | Address picker, driver navigation, admin live map | MVP (basic) / Post-MVP (full) | No | flutter_map + OSM free for MVP |
| File Storage | Cloudflare R2 / AWS S3 / Cloudinary | Restaurant logos, product images, driver documents | Post-MVP | No | Not needed in v0.1 |
| CDN | Cloudflare | Static assets, image delivery | Post-MVP | No | Free plan available when storage is added |
| Payment Gateway | Stripe / Cardcom / Tranzila / Allpay | Online card payments | Post-MVP / Future | No | MVP uses Cash on Delivery only |
| Email Service | SendGrid / Postmark / AWS SES / Resend | Receipts, password reset, notifications | Post-MVP | No | SMS OTP (+972) is primary auth; email is supplementary |
| Monitoring / Logging | Logtail / Better Stack / Datadog / Grafana | Server monitoring, log aggregation | Post-MVP | No | Console logs sufficient for v0.1 |
| Error Tracking | Sentry | Runtime error tracking and alerting | Post-MVP | No | Can add after first deployment |
| Hosting / Deployment | DigitalOcean / Hetzner / Render / Railway / AWS | Backend API, Socket.IO server | MVP | No (local for v0.1) | Needed before production launch |
| Domain / DNS | Cloudflare / Namecheap | Domain, SSL, DDoS protection | MVP | No | Needed before production launch |
| CI/CD | GitHub Actions / Render Auto-deploy / Railway | Automated deploy pipeline | Post-MVP | No | Manual deploy is fine for MVP |
| Analytics | Mixpanel / Amplitude / PostHog | User behavior, funnel analytics | Future | No | Not needed for launch |
| Apple Developer | Apple | iOS App Store distribution | MVP (before launch) | No | $99/year required for iOS distribution |
| Google Play Developer | Google | Android Play Store distribution | MVP (before launch) | No | $25 one-time fee |

---

## 3. MVP Required External Services

Only the services below are **truly required** for a working MVP. Everything else is deferred.

---

### 3.1 PostgreSQL — Primary Database

**Why we need it:** All persistent data lives here — users, orders, restaurants, drivers, deliveries, payments, and audit logs.

**Features that depend on it:** Every single feature in the platform.

**Required environment variables:**

| Variable | Example |
|---|---|
| `DATABASE_URL` | `postgresql://user:password@localhost:5432/delivery_db` |

**Account / dashboard setup:**
- Local: no account needed — Docker image `postgres:15`
- Production: create a managed PostgreSQL instance (Supabase, Neon, Render, DigitalOcean, Railway, or VPS PostgreSQL)

**Estimated complexity:** Low — standard setup  
**Can we mock locally?** No — use real PostgreSQL via Docker  
**Recommended provider:** Docker (local) → Neon or Railway (production, cheapest) → DigitalOcean Managed DB (more control)

---

### 3.2 Redis — Cache, Locks, Rate Limiting

**Why we need it:** The dispatch module uses Redis atomic locks to prevent race conditions when multiple drivers accept the same order simultaneously. Redis also caches driver locations, stores idempotency keys, and backs the NestJS `ThrottlerModule` for rate limiting.

**Features that depend on it:**
- Dispatch locking (critical — prevents double-assignment)
- Driver location cache (`driver:{driverId}:location`)
- Idempotency key storage (prevents duplicate orders)
- Rate limiting for all API endpoints
- Future: BullMQ background job queues

**Required environment variables:**

| Variable | Example |
|---|---|
| `REDIS_URL` | `redis://localhost:6379` |

**Account / dashboard setup:**
- Local: no account needed — Docker image `redis:7`
- Production: Upstash (serverless, free tier), Render Redis, DigitalOcean Managed Redis, or VPS Redis

**Estimated complexity:** Low — standard setup  
**Can we mock locally?** No — use real Redis via Docker. Do not mock the locking behavior.  
**Recommended provider:** Docker (local) → Upstash (production, cheapest, serverless) → DigitalOcean Managed Redis (more control)

---

### 3.3 Firebase Cloud Messaging (FCM) — Push Notifications

**Why we need it:** FCM delivers push notifications to customers, restaurant staff, and drivers even when their apps are backgrounded or the Socket.IO connection is unavailable. It is the out-of-band fallback notification channel for all critical order events.

**Features that depend on it:**
- New order alert to restaurant (HIGH priority)
- Delivery request to driver (HIGH priority)
- Order accepted / rejected / delivered to customer
- Order cancelled notifications to all parties
- Driver app wakeup after crash during active delivery

**Required environment variables:**

| Variable | Example / Notes |
|---|---|
| `FCM_PROJECT_ID` | Firebase project ID from Firebase console |
| `FCM_CLIENT_EMAIL` | Service account client email |
| `FCM_PRIVATE_KEY` | Service account private key (multiline, use JSON escape) |

**Account / dashboard setup:**
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Cloud Messaging
3. Go to Project Settings → Service Accounts → Generate new private key
4. Download the JSON file — extract `project_id`, `client_email`, `private_key`
5. Add `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) to each Flutter app

**Estimated complexity:** Medium — Firebase setup + Flutter integration + backend Admin SDK setup  
**Can we mock locally?** Yes — in v0.1, FCM can be stubbed to log notification payloads to console instead of sending real pushes. Real credentials are required in Phase 7 (Realtime & Notifications).  
**Recommended provider:** Firebase (Google) — only option; free at any send volume.

---

### 3.4 SMS / OTP Provider — Phone Authentication

**Why we need it:** Both customers and drivers authenticate via phone number + 6-digit OTP. SMS is the delivery channel for OTP codes. All phone numbers in this platform use the **+972** country code (Israel). Restaurant staff and admins use email/password instead.

**Features that depend on it:**
- Customer registration and login
- Driver registration and login
- Phone number verification
- Password reset fallback

**Required environment variables:**

| Variable | Example / Notes |
|---|---|
| `SMS_PROVIDER` | `mock` / `inforu` / `019mobile` / `twilio` |
| `SMS_API_KEY` | API key from the Israeli SMS provider (Inforu / 019 Mobile) |
| `SMS_SENDER_NAME` | Pre-approved Sender ID (e.g., `DELIVERY`) — must be approved by Israeli carriers |
| `SMS_PHONE_PREFIX` | `+972` — always prefix customer and driver phone numbers with this |
| `TWILIO_ACCOUNT_SID` | Only if using Twilio as fallback |
| `TWILIO_AUTH_TOKEN` | Only if using Twilio as fallback |

**Options:**

| Provider | Pros | Cons | Recommended For |
|---|---|---|---|
| Mock (local) | No cost, instant, no setup | Not real | v0.1 development |
| **019 Mobile (Israel)** | Israeli carrier, native +972 delivery, low cost | Local contract required | Production — preferred |
| **Inforu (info.co.il)** | Popular Israeli SMS gateway, Hebrew support, good API | Hebrew documentation | Production — alternative |
| **Vonage (Nexmo)** | Good +972 support, solid API | Higher cost than local | Fallback if local fails |
| Twilio | Global, reliable, good SDK | Higher cost per SMS, less reliable on +972 numbers | Last resort fallback |
| Firebase Auth Phone | Free, managed OTP flow | Ties auth to Firebase fully | Only if adopting Firebase Auth |

**Account / dashboard setup (for production — Israel):**
- **019 Mobile / Inforu:** Contact provider directly, sign agreement, get API key and Sender ID approved
- Sender ID must be pre-approved by Israeli carriers (cannot be a random name)
- Phone numbers must be in **+972** format (e.g., `+972501234567`)
- If using Twilio as fallback: create account at twilio.com, get Account SID + Auth Token, verify +972 route

**Estimated complexity:** Low for mock / Medium for Israeli provider integration (approval process takes 1–3 days)  
**Can we mock locally?** Yes — in v0.1, the SMS service logs the OTP to the server console. This is the default for local development.  
**Recommended provider:** Mock (v0.1 and local) → **Inforu or 019 Mobile** (production, Israel)

---

### 3.5 Hosting / Deployment — Backend Server

**Why we need it:** The NestJS backend API and Socket.IO server must be deployed to a publicly accessible server before mobile apps can connect to it.

**Features that depend on it:** All features — the backend is the platform.

**Notes on WebSocket support:** Not all hosting platforms support persistent WebSocket (Socket.IO) connections well. Verify that the chosen platform does not kill long-lived connections or require sticky sessions (or configure accordingly with the Redis adapter).

**Options:**

| Provider | WebSocket Support | Starting Cost | Notes |
|---|---|---|---|
| Render | Yes (with caveats on free tier) | $7/month (starter) | Easy deploy, auto-deploy from GitHub |
| Railway | Yes | ~$5–$20/month | Good DX, usage-based pricing |
| DigitalOcean Droplet | Yes (full control) | $12–$24/month | VPS — most control, more setup |
| Hetzner CX21 | Yes (full control) | ~$6/month | Best value VPS in Europe |
| AWS EC2 / ECS Fargate | Yes | $20–$80/month | Best for scale, most complexity |
| Azure / GCP | Yes | Similar to AWS | Overkill for MVP |

**Required environment variables:** All variables from all services above, plus:

| Variable | Example |
|---|---|
| `PORT` | `3000` |
| `NODE_ENV` | `production` |
| `CORS_ORIGINS` | `https://admin.yourdomain.com,capacitor://localhost` |

**Estimated complexity:** Medium (VPS) / Low (Render or Railway)  
**Can we mock locally?** Not applicable — local is `localhost:3000`  
**Recommended provider:** Hetzner CX21 or DigitalOcean Droplet (production MVP) — best cost/control balance. Render or Railway for rapid early testing.

---

## 4. Services NOT Required in v0.1 Backend Foundation

The following services should **not** be implemented in the initial backend foundation (Phase 1 of MVP development). They belong to dedicated modules that will be built later.

| Service | Why Deferred |
|---|---|
| AWS S3 / Cloudflare R2 / Cloudinary | File upload module not needed in v0.1; placeholder `imageUrl` strings are sufficient |
| File upload handling (multipart) | No product images, logos, or driver documents needed in v0.1 |
| Payment gateway (Stripe, Cardcom, etc.) | MVP uses Cash on Delivery only; no card processing needed |
| Online card payment flows | Post-MVP feature; adds significant compliance scope |
| Email service (SendGrid, Postmark, etc.) | OTP is via SMS; email receipts are post-MVP |
| Advanced monitoring (Datadog, Grafana) | Console logs and PM2 are sufficient during initial development |
| Error tracking (Sentry) | Add after first production deployment |
| Analytics (Mixpanel, Amplitude) | Not on the critical path |
| BullMQ job queues | Redis is set up; queues will be added when needed (post-MVP) |
| CDN configuration | No static assets or images served in v0.1 |

**Rule:** If a module is not in Phase 1–6 of `MVP_TASKS.md`, do not add its external service now.

---

## 5. File Storage Options

File storage will be needed **after** the core delivery flow is working. It is required for:
- Restaurant logos and banner images
- Product / menu item images
- Driver profile photos and verification documents (ID, license)
- Customer profile photos (optional)

**Comparison:**

| Provider | Best For | Pros | Cons | Estimated Cost | Recommended Usage |
|---|---|---|---|---|---|
| **Cloudflare R2** | MVP / Post-MVP production | S3-compatible API, **zero egress fees**, built-in CDN, global | Newer service, smaller ecosystem | ~$0.015/GB storage, $0 egress | **Recommended for this project** — best cost for image-heavy apps |
| **AWS S3** | Scale / enterprise | Industry standard, maximum ecosystem, fine-grained IAM | Egress fees ($0.09/GB out), more complex setup | ~$0.023/GB + egress costs | Use only if already on AWS heavily |
| **Cloudinary** | Image transformation | Auto-resize, auto-format, image CDN built-in, great SDK | Most expensive, vendor lock-in | Free tier limited; paid from ~$89/month | Good for complex image variants; overkill for MVP |
| **Local storage** | Development only | Zero cost, instant setup | Not scalable, not durable, not accessible publicly | $0 | Dev only — never production |

**Recommendation:** Use **Cloudflare R2** when file storage is implemented (post-MVP Phase 11+). It is S3-compatible, so switching to AWS S3 later requires minimal code change.

---

## 6. Payment Gateway Options

MVP starts with **Cash on Delivery (COD) only**. No payment gateway integration is needed now.

COD flow: driver collects cash (in **ILS / ₪**) → driver marks collected in app → admin marks settled manually.

All monetary values stored in the database are in **ILS (Israeli New Shekel / ₪)**. No multi-currency support is planned.

**Future payment options:**

| Provider | Use Case | Pros | Cons | Future Environment Variables | Notes |
|---|---|---|---|---|---|
| **Cardcom** | Israeli credit/debit cards (ILS) | Most popular Israeli gateway, supports Visa/Mastercard/Amex in ILS, Hebrew UI | Hebrew documentation, smaller global community | `CARDCOM_TERMINAL`, `CARDCOM_USERNAME`, `CARDCOM_API_KEY` | **Recommended first choice for Israel** |
| **Tranzila** | Israeli credit/debit cards (ILS) | Established local provider, supports all major Israeli card types | Older API style, less modern DX | `TRANZILA_TERMINAL`, `TRANZILA_PASSWORD` | Solid alternative to Cardcom |
| **Allpay** | Israeli market, mobile-first | Local gateway with mobile SDK support | Less documented, smaller ecosystem | `ALLPAY_SHOP_NUMBER`, `ALLPAY_API_KEY` | Worth evaluating for mobile-first flow |
| **Stripe** | International / fallback | Best DX, excellent API, React and mobile SDKs | Stripe supports Israel but settlement is in USD — requires currency conversion to ILS | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Only if local options are unavailable |
| **PayPal** | International | Known brand, global reach | High fees, not card-native, not standard in Israeli market | `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` | Low priority for this market |

**Important:** We must never store raw card data ourselves. All card processing must go through a PCI-DSS-compliant gateway using tokenization. The backend only stores a `gatewayReference` token, never card numbers.

---

## 7. Maps and Location Services

### What We Need Maps For

| Use Case | Required In | Can Mock? |
|---|---|---|
| Customer address picker (map UI) | Customer App | Yes — text input fallback |
| Restaurant location pin display | Customer App | Yes — coordinates stored in DB |
| Driver live tracking (customer view) | Customer App | Yes — hardcoded coords for testing |
| Driver navigation to restaurant | Driver App | Yes — "Open in Maps" deep link |
| Driver navigation to customer | Driver App | Yes — "Open in Maps" deep link |
| Admin live map (all drivers + orders) | Admin Dashboard | No — real map needed |
| Distance calculation (dispatch radius) | Backend | Yes — Haversine formula, no external API |
| Geocoding (address → coordinates) | Backend (optional) | Yes — store coordinates from client |

### Options

| Provider | Cost | Pros | Cons | Recommended For |
|---|---|---|---|---|
| **flutter_map + OpenStreetMap** | Free | No API key, no cost, open data | Tile quality varies, no Google-level precision | MVP — all mobile apps |
| **Google Maps SDK (Mobile)** | ~$7/1000 map loads ($200/month free credit) | Best quality, most familiar UX | Requires API key, cost at scale | Post-MVP upgrade if budget allows |
| **Google Maps Geocoding API** | $5/1000 requests | Precise address lookup | Requires API key, adds cost | Backend geocoding if needed |
| **OpenStreetMap Nominatim** | Free (usage limits) | Free, no key needed | Rate-limited (1 req/sec), not for production volume | Development / low-volume geocoding |
| **Mapbox** | Free tier then $0.50/1000 | Good style customization, good mobile SDK | Another vendor, another key | Alternative to Google post-MVP |
| **Waze / Google Maps deep links** | Free | Driver clicks → opens native maps app | No in-app tracking | Driver navigation (MVP) |

### MVP Recommendation

- **Mobile maps:** `flutter_map` + OpenStreetMap tiles — free, no API key, works offline with cached tiles.
- **Driver navigation:** Deep link to Google Maps or Waze (`geo:` or `https://maps.google.com/?q=`).
- **Distance calculation (dispatch):** Haversine formula in the backend — no external API needed.
- **Geocoding:** Store coordinates sent from the client app — no server-side geocoding API needed for MVP.

**Post-MVP:** Upgrade to Google Maps SDK if UX quality becomes a differentiator or if admin live map requires it.

---

## 8. Monitoring and Error Tracking

### MVP Recommendation

For v0.1 and the initial MVP, **console logs + PM2** are sufficient. Do not add monitoring infrastructure before the product is live.

| Tool | Type | When to Add | Notes |
|---|---|---|---|
| PM2 logs | Process logs | MVP (production) | Built-in with PM2; log rotation included |
| Nginx access logs | HTTP logs | MVP (production) | Automatic with Nginx |
| **Sentry** | Error tracking | After first production deploy | Free tier; add as the first monitoring tool |
| **Logtail / Better Stack** | Structured log aggregation | Post-MVP | Clean log search and alerting; free tier available |
| **Datadog** | Full observability | Scale phase | Excellent but expensive (~$15/host/month minimum) |
| **Grafana + Prometheus** | Metrics dashboards | Scale phase | Self-hosted, powerful, higher setup cost |
| **UptimeRobot** | Uptime monitoring | MVP (production) | Free tier; monitors health endpoint every 5 min |

**Recommended sequence:**
1. **v0.1 / local:** Console logs only
2. **First production deploy:** Add UptimeRobot (free) + Sentry (free tier)
3. **Post-MVP:** Add Logtail for structured log search
4. **Scale phase:** Evaluate Datadog or Grafana based on team size

---

## 9. Environment Variables Summary

| Variable Name | Service | Required in v0.1? | Required in MVP? | Example Value | Notes |
|---|---|---|---|---|---|
| `DATABASE_URL` | PostgreSQL | Yes | Yes | `postgresql://user:pass@localhost:5432/delivery` | Prisma connection string |
| `REDIS_URL` | Redis | Yes | Yes | `redis://localhost:6379` | ioredis connection string |
| `JWT_ACCESS_SECRET` | Auth (internal) | Yes | Yes | `super-secret-access-key-32chars` | Min 32 chars, random |
| `JWT_REFRESH_SECRET` | Auth (internal) | Yes | Yes | `super-secret-refresh-key-32chars` | Different from access secret |
| `JWT_ACCESS_EXPIRES_IN` | Auth (internal) | Yes | Yes | `15m` | Short-lived |
| `JWT_REFRESH_EXPIRES_IN` | Auth (internal) | Yes | Yes | `30d` | Long-lived |
| `PORT` | App | Yes | Yes | `3000` | NestJS HTTP port |
| `NODE_ENV` | App | Yes | Yes | `development` / `production` | Controls logging, errors |
| `CORS_ORIGINS` | App | Yes | Yes | `http://localhost:3001,capacitor://localhost` | Comma-separated allowed origins |
| `SMS_PROVIDER` | SMS | Yes (mock) | Yes (real) | `mock` | Set to `mock` in v0.1; use `inforu` or `019mobile` in production |
| `SMS_API_KEY` | SMS (Inforu / 019 Mobile) | No | Yes | `xxxxxxxxxxxxxxxx` | Israeli provider API key |
| `SMS_SENDER_NAME` | SMS | No | Yes | `DELIVERY` | Pre-approved Sender ID (Israeli carriers require approval) |
| `SMS_PHONE_PREFIX` | SMS | No | Yes | `+972` | Israel country code — prepend to all phone numbers |
| `TWILIO_ACCOUNT_SID` | Twilio (fallback) | No | If Twilio | `ACxxxxxxxxxx` | Only if using Twilio as fallback |
| `TWILIO_AUTH_TOKEN` | Twilio (fallback) | No | If Twilio | `xxxxxxxxxxxxxxxx` | Only if using Twilio as fallback |
| `FCM_PROJECT_ID` | Firebase FCM | No (placeholder) | Yes | `my-delivery-app` | From Firebase console |
| `FCM_CLIENT_EMAIL` | Firebase FCM | No (placeholder) | Yes | `firebase-adminsdk@project.iam.gserviceaccount.com` | Service account email |
| `FCM_PRIVATE_KEY` | Firebase FCM | No (placeholder) | Yes | `-----BEGIN PRIVATE KEY-----\n...` | JSON-escaped multiline key |
| `STORAGE_PROVIDER` | File storage | No | No | `r2` / `s3` | Added when file module is built |
| `STORAGE_ACCESS_KEY` | R2 / S3 | No | No | `xxxxxxxxxxxxxxxx` | Added with file module |
| `STORAGE_SECRET_KEY` | R2 / S3 | No | No | `xxxxxxxxxxxxxxxx` | Added with file module |
| `STORAGE_BUCKET_NAME` | R2 / S3 | No | No | `delivery-media` | Added with file module |
| `STORAGE_ENDPOINT` | R2 / S3 | No | No | `https://xxxx.r2.cloudflarestorage.com` | R2-specific endpoint |
| `PAYMENT_PROVIDER` | Payment gateway | No | No | `cardcom` / `tranzila` | Added when payments module is built; all amounts in ILS / ₪ |
| `CARDCOM_TERMINAL` | Cardcom (Israel) | No | No | `12345` | **Recommended Israeli gateway** |
| `CARDCOM_USERNAME` | Cardcom (Israel) | No | No | `myusername` | Cardcom merchant username |
| `CARDCOM_API_KEY` | Cardcom (Israel) | No | No | `xxxxxxx` | Cardcom API key |
| `TRANZILA_TERMINAL` | Tranzila (Israel) | No | No | `mystore` | Alternative Israeli gateway |
| `TRANZILA_PASSWORD` | Tranzila (Israel) | No | No | `xxxxxxx` | Tranzila terminal password |
| `STRIPE_SECRET_KEY` | Stripe (fallback) | No | No | `sk_live_xxxxxxx` | Only if local gateways unavailable; USD settlement |
| `STRIPE_WEBHOOK_SECRET` | Stripe (fallback) | No | No | `whsec_xxxxxxx` | Stripe webhook verification |
| `EMAIL_PROVIDER` | Email service | No | No | `sendgrid` / `postmark` | Post-MVP |
| `EMAIL_API_KEY` | SendGrid / Postmark | No | No | `SG.xxxxxxxxxxxxxxxx` | Post-MVP |
| `EMAIL_FROM` | Email service | No | No | `noreply@delivery.com` | Post-MVP |
| `SENTRY_DSN` | Sentry | No | No | `https://xxxx@sentry.io/xxx` | Add after first production deploy |
| `GOOGLE_MAPS_API_KEY` | Google Maps | No | No | `AIzaxxxxxxxxxxxxxxxx` | Only if switching from OSM post-MVP |

---

## 10. Local Development Strategy

The goal is to develop v0.1 with **zero paid external service accounts**. Everything runs locally via Docker or mock mode.

| Service | Local Strategy | How |
|---|---|---|
| **PostgreSQL** | Docker container | `docker run -p 5432:5432 -e POSTGRES_PASSWORD=pass postgres:15` |
| **Redis** | Docker container | `docker run -p 6379:6379 redis:7` |
| **SMS / OTP** | Mock provider | `SMS_PROVIDER=mock` → OTP logged to server console |
| **FCM** | Stub / disabled | FCM service logs notification payload to console instead of sending; no Firebase account needed in v0.1 |
| **File uploads** | Disabled | No file upload endpoints in v0.1; `imageUrl` fields accept any string |
| **Payment gateway** | Not implemented | COD only; no gateway calls |
| **Maps** | Placeholder coordinates | Tests use hardcoded lat/lng; no API key required |
| **Email** | Disabled | No email functionality in v0.1 |
| **Monitoring** | Console logs | `NODE_ENV=development` enables verbose NestJS logger |

**Recommended local setup:** Use `docker-compose.yml` to start PostgreSQL and Redis together with a single command.

```
# docker-compose.yml (reference — do not implement yet)
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: delivery_db
      POSTGRES_USER: delivery_user
      POSTGRES_PASSWORD: delivery_pass
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    ports:
      - "6379:6379"
```

---

## 11. Production Readiness Checklist

Before deploying to production and accepting real users, verify all items below:

### Infrastructure
- [ ] Managed PostgreSQL configured and connection tested
- [ ] Managed Redis configured and connection tested
- [ ] VPS or cloud server running with PM2 process manager
- [ ] Nginx configured as reverse proxy with WebSocket proxying enabled
- [ ] Domain name connected and DNS records set
- [ ] SSL certificate enabled (Let's Encrypt via Certbot or Cloudflare proxy)
- [ ] Cloudflare proxy enabled for DDoS protection

### Security
- [ ] `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` set to strong random values (min 32 chars)
- [ ] `NODE_ENV=production` set
- [ ] `CORS_ORIGINS` configured to only allow known app origins
- [ ] All secrets stored in server environment variables (not in `.env` files committed to git)
- [ ] Rate limiting enabled and tested
- [ ] `.env` files added to `.gitignore`

### External Services
- [ ] Firebase project created and FCM credentials added to production environment
- [ ] Real SMS provider configured and OTP delivery tested end-to-end
- [ ] FCM device token registration tested from each Flutter app

### Reliability
- [ ] `/health` endpoint returns 200 and tested
- [ ] PM2 configured with auto-restart on crash
- [ ] PostgreSQL daily backups enabled (managed DB usually handles this automatically)
- [ ] Redis persistence configured if needed (AOF or RDB snapshot)

### Monitoring
- [ ] UptimeRobot or equivalent configured to ping `/health` every 5 minutes
- [ ] Sentry DSN added and first test error verified in Sentry dashboard
- [ ] Server logs viewable via PM2 or log aggregation service

---

## 12. Final Recommendation

### For Backend v0.1 Foundation — Use Only These

| Service | Provider | Purpose |
|---|---|---|
| PostgreSQL | Docker (local) | Primary database |
| Redis | Docker (local) | Dispatch lock, cache, rate limiting |
| JWT | Internal (no external service) | Authentication |
| SMS | Mock (log to console) | OTP flow — no real SMS yet |
| FCM | Stub (log to console) | Notification flow — no real pushes yet |
| Docker Compose | Local dev tool | Run PostgreSQL + Redis together |

### Do NOT Implement in v0.1

| Service | Reason |
|---|---|
| AWS S3 / Cloudflare R2 / Cloudinary | File module is not part of v0.1 |
| Payment gateway (any) | COD requires no gateway; card payments are post-MVP |
| Email service | Not needed until post-MVP features (receipts, resets) |
| Advanced analytics | No user data to analyze yet |
| Production monitoring | Build the product first; monitor after deployment |
| Google Maps API | flutter_map + OSM is free and sufficient |
| BullMQ job queues | Redis is ready; queues added when dispatch retry module needs them |

### When to Add Each Service

| Service | When to Add |
|---|---|
| Real SMS provider | Phase 2 (Auth module — when OTP must actually send) |
| Real FCM credentials | Phase 7 (Realtime & Notifications module) |
| File storage (R2) | Phase 11+ (Restaurant & Product media module) |
| Payment gateway | Phase 12+ (Online payments module) |
| Sentry | After first production deployment |
| Email service | When email receipts or resets are prioritized |
| Google Maps | When OSM quality becomes a UX blocker |

---

*This document should be updated whenever a new external service is added or an existing integration decision changes.*

---

## ملخص الملف

**ما هدف هذا الملف؟**

هذا الملف هو **دليل كل خدمة خارجية يحتاجها المشروع** — يُجيب على سؤال: ما الحسابات والمفاتيح والمزودين التي نحتاجها قبل أن نبدأ؟

يحتوي على:
- جدول تصنيف لكل خدمة خارجية (قاعدة بيانات، SMS، إشعارات، خرائط، دفع...)
- تحديد واضح: ماذا نحتاج الآن في v0.1 وماذا يأتي لاحقاً
- لكل خدمة مطلوبة: لماذا نحتاجها، ما الـ Features التي تعتمد عليها، كيف نحاكيها محلياً
- مقارنة بين مزودي التخزين (R2 / S3 / Cloudinary)
- مقارنة بين بوابات الدفع الإسرائيلية (Cardcom / Tranzila / Allpay) بالـ ILS / ₪
- خيارات الخرائط وما يُستخدم مجاناً في الـ MVP
- جدول شامل لكل متغيرات البيئة (Environment Variables) في المشروع
- استراتيجية التطوير المحلي بدون حسابات خارجية
- قائمة جاهزية الإنتاج (Checklist) قبل الإطلاق

**من يقرأه؟** Tech Lead وDevOps قبل بداية أي مرحلة، وكل مهندس يحتاج يعرف أي متغير بيئة يضيف.

**القاعدة:** لا تُضاف خدمة خارجية جديدة للمشروع قبل توثيقها في هذا الملف وتحديد متى تُحتاج فعلاً.
