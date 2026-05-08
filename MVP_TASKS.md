# MVP_TASKS.md — Complete MVP Development Task Breakdown

> **Project:** Local Delivery Platform  
> **Source of Truth:** `DELIVERY_APPS_REQUIREMENTS.md`, `ERD.md`, `API_CONTRACTS.md`, `DATABASE_SCHEMA.md`  
> **Date:** 2026-05-07  
> **Version:** 1.0  
> **Audience:** Engineering Lead, Backend Engineers, Mobile Engineers, DevOps

---

## Table of Contents

1. [MVP Goal](#1-mvp-goal)
2. [MVP Boundaries](#2-mvp-boundaries)
3. [Task Complexity Scale](#3-task-complexity-scale)
4. [Phase 0 — Project Setup](#4-phase-0--project-setup)
5. [Phase 1 — Backend Foundation](#5-phase-1--backend-foundation)
6. [Phase 2 — Auth & Users](#6-phase-2--auth--users)
7. [Phase 3 — Restaurant & Menu](#7-phase-3--restaurant--menu)
8. [Phase 4 — Customer Ordering](#8-phase-4--customer-ordering)
9. [Phase 5 — Restaurant Order Handling](#9-phase-5--restaurant-order-handling)
10. [Phase 6 — Driver & Dispatch](#10-phase-6--driver--dispatch)
11. [Phase 7 — Realtime & Notifications](#11-phase-7--realtime--notifications)
12. [Phase 8 — Admin Dashboard](#12-phase-8--admin-dashboard)
13. [Phase 9 — Testing & QA](#13-phase-9--testing--qa)
14. [Phase 10 — Deployment](#14-phase-10--deployment)
15. [MVP Acceptance Criteria](#15-mvp-acceptance-criteria)
16. [Risks & Mitigations](#16-risks--mitigations)
17. [Dependency Graph Summary](#17-dependency-graph-summary)

---

## 1. MVP Goal

The first production version of the platform must demonstrate a **complete, end-to-end order delivery cycle**:

1. A customer downloads the Customer App, registers via phone OTP, browses restaurants, adds items to cart, and places an order with cash on delivery.
2. The restaurant receives the order in real time via the Restaurant App, accepts it, marks it as preparing, and requests a driver.
3. The dispatch system finds the nearest available driver and offers them the delivery.
4. The driver receives the request in the Driver App, accepts it, navigates to the restaurant, picks up the order, delivers it to the customer, and marks it as delivered.
5. The customer sees live driver tracking throughout the delivery.
6. An admin can view all orders and intervene if needed via the Admin Dashboard.

The MVP is **not** trying to be feature-complete. It is trying to prove the core value proposition works reliably on real hardware in the target market's network conditions.

---

## 2. MVP Boundaries

### Included in MVP

| Area | Included Features |
|------|------------------|
| Auth | Phone OTP login for customers and drivers; email/password for restaurant staff and admins |
| Customer App | Browse restaurants, view menu, cart, checkout (COD only), order tracking, live driver map, order history, notifications |
| Restaurant App | Receive orders, accept/reject, mark preparing, request driver, view assigned driver, basic menu availability toggle, store open/closed toggle |
| Driver App | Verification submission, online/offline toggle, receive delivery requests, full delivery lifecycle, basic earnings |
| Backend | All core APIs, order lifecycle state machine, dispatch algorithm, Socket.IO realtime, FCM notifications, idempotency |
| Database | All 37 MVP tables, all indexes, all constraints, enums |
| Admin | View orders, view users, view restaurants, view drivers, approve driver verification, cancel orders, basic platform settings |
| Infrastructure | Single VPS server, managed PostgreSQL, managed Redis, Cloudflare CDN, SSL |

### Excluded from MVP

| Feature | Reason |
|---------|--------|
| Online card payments | Integration complexity; COD covers launch market |
| Restaurant payout automation | Manual payout via admin is sufficient initially |
| Driver payout automation | Same as above |
| Customer reviews/ratings | Nice-to-have; does not block core flow |
| Restaurant special hours (holidays) | Standard working hours are sufficient |
| Zone-based dispatch | Nearest-driver algorithm is sufficient |
| Multi-language (Arabic RTL) | English-first for MVP; Arabic added post-MVP |
| Favorites | Not on critical path |
| Promo codes / discounts | Marketing feature, post-MVP |
| Support ticket in-app (customer side) | Phone/WhatsApp support is acceptable for MVP |
| Driver earnings payout tracking | Admin manually marks payouts |
| Refund processing | COD has no automated refund flow |
| Detailed analytics/reports | Basic order list is sufficient for admin |

### Postponed Post-MVP

| Feature | Target Phase |
|---------|-------------|
| In-app reviews | Phase 11 |
| Online card payment (Stripe) | Phase 12 |
| Automated payouts | Phase 13 |
| Arabic RTL support | Phase 11 |
| Zone-based dispatch | Phase 14 |
| BullMQ background jobs | Phase 12 |
| Customer support tickets | Phase 11 |

---

## 3. Task Complexity Scale

| Level | Label | Estimated Hours | Description |
|-------|-------|----------------|-------------|
| 1 | `XS` | 1–2h | Config change, simple script, 1 file |
| 2 | `S` | 2–4h | Single endpoint or simple component |
| 3 | `M` | 4–8h | Multi-file feature with validation and tests |
| 4 | `L` | 8–16h | Full module or complex integration |
| 5 | `XL` | 16–32h | Cross-cutting feature (dispatch, realtime, location) |

---

## 4. Phase 0 — Project Setup

> **Goal:** Empty repositories → runnable skeleton with consistent tooling.  
> **Team:** Engineering Lead + DevOps  
> **Duration estimate:** 3–5 days

---

### TASK-0001
**Title:** Initialize Git repositories and branch strategy  
**Description:** Create the main monorepo (if using Melos for Flutter) and the backend repository. Set up `main`, `develop`, and `feature/*` branch strategy. Configure branch protection rules (require PR review before merge to `main` and `develop`). Document the branching strategy in `CONTRIBUTING.md`.  
**Area:** All  
**Priority:** Critical  
**Dependencies:** None  
**Complexity:** `XS`  
**Acceptance Criteria:**
- Two repositories exist: `delivery-backend` and `delivery-apps`
- Branch protection is active on `main` and `develop`
- `CONTRIBUTING.md` documents the workflow

---

### TASK-0002
**Title:** Initialize NestJS backend project  
**Description:** Bootstrap a NestJS project with TypeScript strict mode. Install core dependencies: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `class-validator`, `class-transformer`, `@nestjs/config`. Configure `tsconfig.json` with strict settings. Add `.nvmrc` pinning Node.js 20 LTS.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-0001  
**Complexity:** `S`  
**Acceptance Criteria:**
- `npm run start:dev` serves a health check endpoint at `GET /health` returning `{ status: "ok" }`
- TypeScript compiles with zero errors in strict mode

---

### TASK-0003
**Title:** Initialize Flutter monorepo with Melos  
**Description:** Set up a Flutter monorepo using Melos. Create three app packages (`customer_app`, `restaurant_app`, `driver_app`) and five shared packages (`shared_ui`, `shared_models`, `shared_services`, `shared_theme`, `shared_utils`). Configure `melos.yaml` with bootstrap, clean, and test scripts. Pin Flutter version in `.fvmrc`.  
**Area:** Mobile  
**Priority:** Critical  
**Dependencies:** TASK-0001  
**Complexity:** `M`  
**Acceptance Criteria:**
- `melos bootstrap` runs without errors
- Each of the three apps can be launched on a simulator with a blank screen and no compile errors
- Shared packages are importable from app packages

---

### TASK-0004
**Title:** Configure environment variables for backend  
**Description:** Set up `@nestjs/config` with a `ConfigModule` that loads from `.env`. Create `.env.example` documenting all required variables: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`, `SMS_PROVIDER_URL`, `SMS_API_KEY`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`. Add `.env` to `.gitignore`.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-0002  
**Complexity:** `S`  
**Acceptance Criteria:**
- App fails to start with a clear error if any required env var is missing
- `.env` is confirmed absent from git history
- `.env.example` is committed with placeholder values

---

### TASK-0005
**Title:** Set up Docker Compose for local development  
**Description:** Create a `docker-compose.yml` that spins up PostgreSQL 15 and Redis 7 for local development. Add health checks for both services. Create a `docker-compose.test.yml` for isolated test database. Document the startup process in `README.md`.  
**Area:** Backend / DevOps  
**Priority:** Critical  
**Dependencies:** TASK-0002  
**Complexity:** `S`  
**Acceptance Criteria:**
- `docker compose up -d` starts PostgreSQL and Redis
- Both services pass their health checks within 30 seconds
- Backend can connect to both on startup

---

### TASK-0006
**Title:** Configure ESLint, Prettier, and commit hooks for backend  
**Description:** Install `eslint`, `@typescript-eslint/parser`, `prettier`, `husky`, `lint-staged`. Configure ESLint with TypeScript rules and NestJS-compatible settings. Configure Prettier for consistent formatting. Set up `husky` pre-commit hook to run `lint-staged` (lint + format on staged files only).  
**Area:** Backend  
**Priority:** High  
**Dependencies:** TASK-0002  
**Complexity:** `XS`  
**Acceptance Criteria:**
- `npm run lint` reports zero errors on the clean project
- Pre-commit hook blocks commits with lint errors
- Prettier format is enforced on save (VS Code settings committed)

---

### TASK-0007
**Title:** Configure Dart analysis and linting for Flutter monorepo  
**Description:** Add `flutter_lints` or `very_good_analysis` to all packages. Configure `analysis_options.yaml` at the root level with strict lint rules. Set up `melos run lint` to run `dart analyze` across all packages.  
**Area:** Mobile  
**Priority:** High  
**Dependencies:** TASK-0003  
**Complexity:** `XS`  
**Acceptance Criteria:**
- `melos run lint` passes with zero warnings on the empty project
- Rules documented in root `analysis_options.yaml`

---

### TASK-0008
**Title:** Set up basic CI pipeline  
**Description:** Configure GitHub Actions (or equivalent) with two workflows: (1) `ci-backend.yml`: on PR to `develop` and `main` — lint, type-check, run tests; (2) `ci-mobile.yml`: on PR — `flutter analyze`, `flutter test` for all packages. Both workflows must pass before merge.  
**Area:** DevOps  
**Priority:** High  
**Dependencies:** TASK-0006, TASK-0007  
**Complexity:** `M`  
**Acceptance Criteria:**
- Both CI workflows run automatically on PR creation
- A failing test or lint error blocks the merge
- CI runs in under 5 minutes for an empty project (baseline)

---

## 5. Phase 1 — Backend Foundation

> **Goal:** Runnable NestJS backend with database, Redis, validation, and error handling.  
> **Team:** Backend Engineers  
> **Duration estimate:** 4–6 days  
> **Prerequisite:** Phase 0 complete

---

### TASK-1001
**Title:** Set up Prisma ORM with PostgreSQL  
**Description:** Install `prisma` and `@prisma/client`. Initialize Prisma with `npx prisma init`. Configure `DATABASE_URL` from environment. Create `PrismaService` that extends `PrismaClient` and implements `OnModuleInit` and `OnModuleDestroy` for clean connection lifecycle management.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-0004, TASK-0005  
**Complexity:** `S`  
**Acceptance Criteria:**
- `PrismaService` injects cleanly into any module
- Connection established on app start; disconnected on app shutdown
- `npx prisma studio` opens and connects

---

### TASK-1002
**Title:** Write and apply the full database migration (Phase 1 — identity tables)  
**Description:** Write Prisma schema for the identity & access tables: `users`, `refresh_tokens`, `otp_codes`, `device_tokens`, `user_sessions`. Include all enums. Run `npx prisma migrate dev --name init_identity_and_auth`. Verify all columns, types, constraints, and indexes match `DATABASE_SCHEMA.md`.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-1001  
**Complexity:** `M`  
**Acceptance Criteria:**
- Migration applies cleanly on a fresh database
- All partial indexes are added manually in the migration SQL
- `npx prisma db pull` matches the schema file exactly

---

### TASK-1003
**Title:** Write and apply the full database migration (Phase 2 — all business tables)  
**Description:** Add remaining Prisma schema for all business tables: restaurant domain, customer domain, order domain, delivery domain, payment domain, notification domain, support domain. Apply in logical dependency order across multiple migration files. Run seed script.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-1002  
**Complexity:** `L`  
**Acceptance Criteria:**
- All 37 MVP tables exist with correct schema
- All check constraints and unique constraints pass
- Seed data inserted: platform settings, restaurant categories, global commission, super admin

---

### TASK-1004
**Title:** Configure Redis connection  
**Description:** Install `ioredis`. Create a `RedisService` wrapping `ioredis` for use across modules. Configure from `REDIS_URL` env var. Add health check for Redis alongside PostgreSQL health check.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-0004, TASK-0005  
**Complexity:** `S`  
**Acceptance Criteria:**
- `RedisService.set(key, value, ttl)` and `RedisService.get(key)` work correctly
- Connection error on startup produces a clear log and prevents the app from starting
- Health endpoint reports Redis status

---

### TASK-1005
**Title:** Configure global validation pipe  
**Description:** Register `ValidationPipe` globally in `main.ts` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. Configure global exception filter that converts `ValidationError` arrays into the standard error response format defined in `API_CONTRACTS.md`.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-0002  
**Complexity:** `S`  
**Acceptance Criteria:**
- Sending an invalid body returns HTTP 422 with `VALIDATION_ERROR` code and per-field error details
- Unknown fields are silently stripped from valid requests
- Correct types are coerced automatically (e.g., string `"true"` → boolean `true`)

---

### TASK-1006
**Title:** Configure global exception filter and standard response format  
**Description:** Create a `GlobalExceptionFilter` that catches all exceptions and returns the standard error envelope: `{ success: false, error: { code, message, details }, timestamp, path }`. Map NestJS built-in exceptions to appropriate error codes from the error catalog in `API_CONTRACTS.md`. Log all 5xx errors with full stack traces using `@nestjs/common` Logger.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-0002  
**Complexity:** `M`  
**Acceptance Criteria:**
- Every error response follows the standard format
- 4xx errors are not logged as errors (only as warnings)
- 5xx errors are logged with full context
- A test request to a non-existent route returns a proper 404 with `RESOURCE_NOT_FOUND`

---

### TASK-1007
**Title:** Configure rate limiting  
**Description:** Install `@nestjs/throttler`. Configure `ThrottlerModule` backed by Redis (`ThrottlerStorageRedisService`). Set global limit (200 req/min/IP). Create custom throttler decorators for stricter limits: `@OtpRateLimit()` (5/min), `@LocationUpdateRateLimit()` (120/min). Apply them on specific endpoints.  
**Area:** Backend  
**Priority:** High  
**Dependencies:** TASK-1004  
**Complexity:** `S`  
**Acceptance Criteria:**
- Exceeding the rate limit returns HTTP 429 with `RATE_LIMIT_EXCEEDED` and rate limit headers
- OTP endpoint is correctly limited independently from the global limit
- Rate limit state persists in Redis (survives app restart)

---

### TASK-1008
**Title:** Configure Helmet and CORS  
**Description:** Install `helmet`. Apply `helmet()` middleware in `main.ts`. Configure CORS to allow requests only from the admin dashboard domain (web) and with a permissive policy for mobile apps (mobile apps don't use CORS). Add `Content-Security-Policy` headers appropriate for an API server.  
**Area:** Backend  
**Priority:** High  
**Dependencies:** TASK-0002  
**Complexity:** `XS`  
**Acceptance Criteria:**
- Security headers are present on all responses (verify with browser dev tools)
- Requests from an unlisted origin return a CORS error on web clients
- Mobile API calls function normally (no CORS block on mobile HTTP clients)

---

### TASK-1009
**Title:** Set up AWS S3 (or Cloudflare R2) file upload service  
**Description:** Create a `StorageService` that wraps `@aws-sdk/client-s3`. Support: `uploadFile(buffer, mimeType, folder)` → returns CDN URL. `deleteFile(key)`. Configure bucket name, region, and CDN prefix from environment. Add file type and size validation (max 5MB, accept JPEG/PNG/PDF/WebP).  
**Area:** Backend  
**Priority:** High  
**Dependencies:** TASK-0004  
**Complexity:** `M`  
**Acceptance Criteria:**
- Uploading a JPEG file returns a valid CDN URL
- Files larger than 5MB are rejected before upload
- Invalid file types are rejected with `VALIDATION_ERROR`
- Uploaded files are accessible via the CDN URL

---

## 6. Phase 2 — Auth & Users

> **Goal:** Complete authentication flow — OTP, JWT, refresh tokens, RBAC, device tokens.  
> **Team:** Backend Engineer (1)  
> **Duration estimate:** 5–7 days  
> **Prerequisite:** Phase 1 complete

---

### TASK-2001
**Title:** Create `AuthModule` with JWT strategy  
**Description:** Install `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`. Create `AuthModule` with `JwtStrategy` that validates access tokens. Create `JwtAuthGuard` that applies the strategy. Configure JWT with RS256 algorithm (generate key pair) and 15-minute expiry. Store the private key in env var.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-1005  
**Complexity:** `M`  
**Acceptance Criteria:**
- `@UseGuards(JwtAuthGuard)` on any endpoint correctly rejects requests without a valid token with 401
- Expired tokens return `AUTH_TOKEN_EXPIRED`
- Token payload includes: `sub` (userId), `role`, `restaurantId` (for staff)

---

### TASK-2002
**Title:** Implement RBAC guard and `@Roles()` decorator  
**Description:** Create `RolesGuard` that reads the `@Roles()` decorator and compares against the JWT payload role. Create `@Roles(...roles)` decorator. Create `@CurrentUser()` parameter decorator to inject the authenticated user from the request. Apply guards globally with `APP_GUARD` provider ordering: `JwtAuthGuard` first, then `RolesGuard`.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-2001  
**Complexity:** `S`  
**Acceptance Criteria:**
- `@Roles('ADMIN')` on an endpoint returns 403 for a `CUSTOMER` JWT
- `@Public()` decorator bypasses `JwtAuthGuard` entirely
- `@CurrentUser()` correctly injects the full user object

---

### TASK-2003
**Title:** Implement OTP request endpoint  
**Description:** Create `POST /api/v1/auth/otp/request`. Service: generate a 6-digit OTP, hash it with bcrypt (10 rounds), store in `otp_codes` table with 5-minute expiry, delete any previous unused OTP for the same phone. Send the OTP via the configured SMS provider (create `SmsService` with a mock for development). Apply `@OtpRateLimit()`.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-2001, TASK-1007  
**Complexity:** `M`  
**Acceptance Criteria:**
- OTP is sent to the provided phone number (logged in dev mode)
- Previous OTP for the same phone is invalidated when a new one is requested
- Rate limit blocks more than 5 requests per minute from the same phone

---

### TASK-2004
**Title:** Implement OTP verify endpoint  
**Description:** Create `POST /api/v1/auth/otp/verify`. Service: find the latest unused, non-expired OTP for the phone. Increment `attempts` counter. Compare code hash. On success: mark OTP as used. If user doesn't exist, create `users` record and `customer_profiles` or `driver_profiles` based on `role`. Issue access token + refresh token. Store refresh token hash.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-2003  
**Complexity:** `M`  
**Acceptance Criteria:**
- Correct OTP returns access token, refresh token, and user object
- Wrong OTP increments attempt counter and returns `AUTH_INVALID_OTP`
- After 5 failed attempts, returns `AUTH_OTP_MAX_ATTEMPTS` and no further attempts are allowed for 15 minutes
- Expired OTP returns `AUTH_OTP_EXPIRED`

---

### TASK-2005
**Title:** Implement email/password login endpoint  
**Description:** Create `POST /api/v1/auth/login`. Find user by email; compare password with bcrypt. On success: issue access + refresh tokens. Used by restaurant staff and admin. Apply standard rate limiting.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-2001  
**Complexity:** `S`  
**Acceptance Criteria:**
- Correct credentials return tokens
- Wrong credentials return `AUTH_INVALID_CREDENTIALS` (same message for wrong email and wrong password — no enumeration)
- Suspended user returns `USER_SUSPENDED`

---

### TASK-2006
**Title:** Implement token refresh and logout endpoints  
**Description:** Create `POST /api/v1/auth/refresh`: validate refresh token hash, issue new access + refresh token pair, revoke old token (rotation). Create `POST /api/v1/auth/logout`: revoke the provided refresh token. Create `GET /api/v1/auth/me`: return current user profile based on JWT.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-2004, TASK-2005  
**Complexity:** `M`  
**Acceptance Criteria:**
- Refresh returns new token pair; old refresh token is rejected on reuse
- Logout marks the token as revoked; subsequent use returns `AUTH_TOKEN_REVOKED`
- `/me` returns the user object matching the JWT `sub`

---

### TASK-2007
**Title:** Implement FCM device token registration endpoint  
**Description:** Create `POST /api/v1/auth/device-token`. Upsert the FCM token in `device_tokens` — update `last_seen_at` if the token already exists for this user, create if new. Remove stale tokens for the same user on other devices if the platform matches and the token is different.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-2001  
**Complexity:** `S`  
**Acceptance Criteria:**
- Same token registered twice for the same user does not create duplicates
- New token from same user replaces old token on the same platform

---

### TASK-2008
**Title:** Create `UsersModule` with basic profile endpoints  
**Description:** Create `GET /api/v1/customers/profile` and `PUT /api/v1/customers/profile` for customer profile management. Create corresponding endpoints for driver profile (`GET /api/v1/drivers/me/profile`). All endpoints require authentication and correct role.  
**Area:** Backend  
**Priority:** High  
**Dependencies:** TASK-2002  
**Complexity:** `S`  
**Acceptance Criteria:**
- Customer can update their display name and email
- Profile updates are reflected immediately on subsequent GET calls
- Attempting to access another user's profile returns 403

---

## 7. Phase 3 — Restaurant & Menu

> **Goal:** Full restaurant and menu management APIs.  
> **Team:** Backend Engineer (1)  
> **Duration estimate:** 6–8 days  
> **Prerequisite:** Phase 2 complete

---

### TASK-3001
**Title:** Create `RestaurantsModule` — restaurant CRUD and status management  
**Description:** Create `GET /api/v1/restaurants` (public, paginated with filters), `GET /api/v1/restaurants/:id` (public), `GET /api/v1/restaurants/me` (restaurant owner), `PUT /api/v1/restaurants/me` (owner only), `PATCH /api/v1/restaurants/me/status` (owner and staff). Implement distance sorting using Haversine formula on lat/lng.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-2002, TASK-1003  
**Complexity:** `L`  
**Acceptance Criteria:**
- Public restaurant list returns paginated results sortable by distance, rating, or name
- Status toggle persists immediately
- Owner cannot set status to `SUSPENDED` (admin-only status)

---

### TASK-3002
**Title:** Create restaurant working hours endpoints  
**Description:** `GET /api/v1/restaurants/me/working-hours` and `PUT /api/v1/restaurants/me/working-hours`. The PUT replaces all 7 days at once. Add logic to `GET /api/v1/restaurants/:id` that computes `isCurrentlyOpen` based on current day/time vs. working hours.  
**Area:** Backend  
**Priority:** High  
**Dependencies:** TASK-3001  
**Complexity:** `S`  
**Acceptance Criteria:**
- Saving working hours replaces all previous records for the restaurant
- `isCurrentlyOpen` correctly reflects the current time in the local timezone
- A day with `isClosed: true` correctly marks the restaurant as closed

---

### TASK-3003
**Title:** Create `MenuModule` — menu categories CRUD  
**Description:** Implement full CRUD for `menu_categories`: `GET`, `POST`, `PUT`, `DELETE /api/v1/restaurants/me/menu-categories`. Enforce that a category with products cannot be deleted (return `CATEGORY_HAS_PRODUCTS`). All endpoints scoped to the authenticated restaurant staff's restaurant.  
**Area:** Backend  
**Priority:** High  
**Dependencies:** TASK-3001  
**Complexity:** `S`  
**Acceptance Criteria:**
- CRUD operations work correctly
- Deleting a non-empty category returns `CATEGORY_HAS_PRODUCTS`
- Staff from Restaurant A cannot manage Restaurant B's categories

---

### TASK-3004
**Title:** Create `MenuModule` — products CRUD  
**Description:** Implement full CRUD for `products` including image upload. Endpoints: `GET`, `POST`, `PUT`, `DELETE /api/v1/restaurants/me/products`, `PATCH /:id/availability`, `POST /:id/images`. Product images upload to S3 via `StorageService`. Soft delete on product DELETE. Cascade-delete modifiers on product delete.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-3003, TASK-1009  
**Complexity:** `L`  
**Acceptance Criteria:**
- Creating a product with modifiers and modifier options persists all nested data in a single transaction
- Soft-deleted products don't appear in `GET /restaurants/:id/menu` (public)
- Toggling `isAvailable` immediately affects customer-facing menu
- Image upload returns a CDN URL

---

### TASK-3005
**Title:** Create `GET /api/v1/restaurants/:id/menu` endpoint  
**Description:** Return the full nested menu structure: categories → products → images → modifiers → options. Filter out soft-deleted products and inactive categories. Order by `sort_order`. This is the most frequently called endpoint — add response caching (Redis, 60-second TTL) keyed by `restaurantId`. Cache is invalidated on any product/category change.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-3004, TASK-1004  
**Complexity:** `M`  
**Acceptance Criteria:**
- Returns correctly nested menu structure in a single API call
- Unavailable products are included but marked `isAvailable: false`
- Response is cached in Redis; cache is busted when a product changes
- Response time under 200ms with cache hit

---

### TASK-3006
**Title:** Create `GET /api/v1/restaurants/me/dashboard` endpoint  
**Description:** Return: today's order count, today's revenue, pending order count, active order count, restaurant status. Compute revenue by summing `orders.total` for today's delivered orders.  
**Area:** Backend  
**Priority:** High  
**Dependencies:** TASK-3001  
**Complexity:** `S`  
**Acceptance Criteria:**
- Numbers are accurate for the current calendar day
- Response returns within 300ms (acceptable for a dashboard query)

---

### TASK-3007
**Title:** Create `GET /api/v1/search` endpoint  
**Description:** Accept `q`, `type`, `lat`, `lng` query params. Search `restaurants.name` (ILIKE) and `products.name` (ILIKE) with the keyword. Filter soft-deleted records. Return up to 10 restaurant results and 20 product results. Add debounce note in API contract (client-side).  
**Area:** Backend  
**Priority:** High  
**Dependencies:** TASK-3001, TASK-3004  
**Complexity:** `S`  
**Acceptance Criteria:**
- Search returns relevant restaurant and product results
- Products include their parent restaurant info
- Soft-deleted or unavailable items do not appear in results

---

## 8. Phase 4 — Customer Ordering

> **Goal:** Full customer cart and order placement flow.  
> **Team:** Backend Engineer (1) + Mobile Engineer (Customer App)  
> **Duration estimate:** 7–10 days  
> **Prerequisite:** Phase 3 complete

---

### TASK-4001
**Title:** Implement customer address management APIs  
**Description:** Implement `GET`, `POST`, `PUT`, `DELETE /api/v1/customers/addresses` and `PATCH /:id/default`. Enforce max 5 saved addresses. Address delete is soft delete. Cannot delete the only remaining address if it is set as default.  
**Area:** Backend  
**Priority:** High  
**Dependencies:** TASK-2008  
**Complexity:** `M`  
**Acceptance Criteria:**
- Full CRUD works correctly
- Setting a new default clears the `is_default` flag on all other addresses
- Soft-deleted addresses don't appear in GET list

---

### TASK-4002
**Title:** Implement cart APIs  
**Description:** Implement `GET /api/v1/customers/cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id`, `DELETE /cart`. On add: validate that `restaurantId` matches existing cart (or create new cart); validate product availability; validate required modifier selections. Return full cart with computed subtotal on every mutation.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-3004  
**Complexity:** `M`  
**Acceptance Criteria:**
- Adding an item from a different restaurant returns `CART_RESTAURANT_CONFLICT`
- Adding an unavailable product returns `PRODUCT_UNAVAILABLE`
- Subtotal is correctly computed including modifier price adjustments
- Cart is scoped to the authenticated customer

---

### TASK-4003
**Title:** Implement `POST /api/v1/orders` — order creation  
**Description:** This is the most critical backend endpoint. Implementation steps: (1) Check idempotency key — return existing order if found. (2) Validate restaurant is OPEN or BUSY. (3) Validate all products are available with correct prices. (4) Validate minimum order amount. (5) Validate address belongs to customer. (6) Snapshot product names and prices. (7) Snapshot address. (8) Create `orders`, `order_items`, `order_item_modifiers`, `payments` records in a single Prisma transaction. (9) Clear the cart. (10) Log initial status in `order_status_history`. (11) Emit `order:new` Socket.IO event. (12) Send FCM to restaurant.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-4002, TASK-4001, TASK-2001  
**Complexity:** `XL`  
**Acceptance Criteria:**
- Order creation succeeds end-to-end (verifiable by checking all 5 tables)
- Duplicate request with same idempotency key returns the original order (no duplicate in DB)
- A request with an unavailable product returns `PRODUCT_UNAVAILABLE` and no partial records are created
- Cart is cleared after successful order
- Status history contains the initial `PENDING_RESTAURANT` entry

---

### TASK-4004
**Title:** Implement order retrieval APIs for customers  
**Description:** `GET /api/v1/orders/active`, `GET /api/v1/orders/:id`, `GET /api/v1/orders` (history, paginated), `GET /api/v1/orders/:id/tracking`, `POST /api/v1/orders/:id/cancel`. Tracking endpoint includes status history, driver info (if assigned), and last known driver location from Redis. Cancel only allowed in `PENDING_RESTAURANT` status.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-4003  
**Complexity:** `M`  
**Acceptance Criteria:**
- Tracking endpoint returns complete status history and driver location
- Cancel correctly transitions status and emits cancellation event
- History is paginated and sorted by `created_at DESC`
- Customer cannot access another customer's order

---

### TASK-4005
**Title:** Build Customer App — authentication screens  
**Description:** Implement C-01 (Splash), C-02 (Onboarding), C-03 (Login/OTP) screens in `customer_app`. Use `shared_services` for API calls. Store tokens in `flutter_secure_storage`. Implement auto-login on app start using cached token (call `/auth/me`). Handle all loading, error, and offline states.  
**Area:** Mobile — Customer App  
**Priority:** Critical  
**Dependencies:** TASK-2004, TASK-2006, TASK-0003  
**Complexity:** `L`  
**Acceptance Criteria:**
- Customer can register and log in via phone OTP
- Auto-login works on app restart with valid token
- Token refresh happens silently when access token expires
- Offline state shows appropriate message on login attempt

---

### TASK-4006
**Title:** Build Customer App — home, restaurant list, and search screens  
**Description:** Implement C-04 (Home), C-05 (Restaurant List), C-06 (Search), C-07 (Restaurant Details) screens. Implement category filter chips. Implement skeleton loading states. Cache restaurant list in Hive (10-minute TTL). Implement offline fallback to cached data with banner. Distance display using customer's GPS location.  
**Area:** Mobile — Customer App  
**Priority:** Critical  
**Dependencies:** TASK-3001, TASK-3007, TASK-4005  
**Complexity:** `L`  
**Acceptance Criteria:**
- Restaurant list loads with skeleton and then real data
- Offline mode shows cached restaurants with a visual indicator
- Category filter correctly filters the list
- Distance is shown when GPS is available

---

### TASK-4007
**Title:** Build Customer App — menu, product details, and cart screens  
**Description:** Implement C-07 (Menu tab), C-08 (Product Details modal), C-09 (Cart) screens. Menu loaded from `GET /restaurants/:id/menu`. Cart stored locally in Hive (persistent across restarts). Add to cart validates required modifier selections client-side. Cart badge updates in real time.  
**Area:** Mobile — Customer App  
**Priority:** Critical  
**Dependencies:** TASK-3005, TASK-4002, TASK-4006  
**Complexity:** `L`  
**Acceptance Criteria:**
- Tapping a product opens a modal with modifiers
- Adding to cart with missing required modifier shows validation error
- Cart persists after app close and reopen
- Cart badge count is accurate

---

### TASK-4008
**Title:** Build Customer App — address management and checkout screens  
**Description:** Implement C-11 (Address Management), C-12 (Add/Edit Address with map picker), C-10 (Checkout). Address map picker uses `flutter_map` with OpenStreetMap. Checkout validates all fields, generates idempotency key (UUID v4), and calls `POST /orders`. Handle all error states (restaurant closed, product unavailable, network error).  
**Area:** Mobile — Customer App  
**Priority:** Critical  
**Dependencies:** TASK-4001, TASK-4003, TASK-4007  
**Complexity:** `L`  
**Acceptance Criteria:**
- Customer can pick an address on a map or type it manually
- Checkout screen shows correct price breakdown
- Placing an order navigates to C-13 (Order Confirmation)
- Network error on checkout shows retry option without creating duplicate orders

---

### TASK-4009
**Title:** Build Customer App — order tracking and driver live map  
**Description:** Implement C-13 (Confirmation), C-14 (Order Tracking), C-15 (Driver Live Map). Order tracking connects to Socket.IO room and updates the status timeline in real time. Driver map marker animates smoothly between location updates. Fallback to 30-second HTTP polling when Socket.IO disconnects.  
**Area:** Mobile — Customer App  
**Priority:** Critical  
**Dependencies:** TASK-4004, TASK-7001  
**Complexity:** `L`  
**Acceptance Criteria:**
- Status timeline updates in real time without page refresh
- Driver marker moves smoothly on the map
- Polling kicks in automatically when Socket.IO disconnects
- "Reconnecting..." indicator shown during disconnect

---

### TASK-4010
**Title:** Build Customer App — order history, notifications, and profile  
**Description:** Implement C-16 (Order History), C-17 (Order Details), C-19 (Profile), C-20 (Notifications). Notification bell shows unread count badge. FCM notifications deep-link to the correct order tracking screen.  
**Area:** Mobile — Customer App  
**Priority:** High  
**Dependencies:** TASK-4004, TASK-4005  
**Complexity:** `M`  
**Acceptance Criteria:**
- Order history loads paginated and shows correct statuses
- Tapping a notification opens the relevant screen
- Profile update saves and reflects immediately

---

## 9. Phase 5 — Restaurant Order Handling

> **Goal:** Complete restaurant app order management flow.  
> **Team:** Backend Engineer (1) + Mobile Engineer (Restaurant App)  
> **Duration estimate:** 6–8 days  
> **Prerequisite:** Phase 4 complete

---

### TASK-5001
**Title:** Implement restaurant order management APIs  
**Description:** Implement: `GET /restaurants/me/orders` (with status filter), `GET /restaurants/me/orders/:id`, `POST /orders/:id/accept`, `POST /orders/:id/reject`, `POST /orders/:id/preparing`. Each status transition validates the current status, records in `order_status_history`, emits the correct Socket.IO event, and sends the appropriate FCM notification. Auto-reject logic: a scheduled check (interval-based for MVP, BullMQ later) marks `PENDING_RESTAURANT` orders as rejected after `auto_reject_at` timestamp passes.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-4003, TASK-2002  
**Complexity:** `L`  
**Acceptance Criteria:**
- Accept sets status to `ACCEPTED_BY_RESTAURANT` and emits `order:accepted`
- Reject sets status to `REJECTED_BY_RESTAURANT` with reason and emits `order:rejected`
- Invalid status transitions return `ORDER_INVALID_STATUS`
- Restaurant staff from the wrong restaurant cannot manage orders

---

### TASK-5002
**Title:** Build Restaurant App — auth, dashboard, and order list screens  
**Description:** Implement R-01 (Splash), R-02 (Login), R-03 (Dashboard), R-05 (Active Orders) screens. Dashboard connects to Socket.IO and shows real-time new order alerts with audio + vibration. Store status uses dropdown toggle. FCM-wakes the app for new orders.  
**Area:** Mobile — Restaurant App  
**Priority:** Critical  
**Dependencies:** TASK-5001, TASK-7001  
**Complexity:** `L`  
**Acceptance Criteria:**
- New order triggers loud alert regardless of whether the app is in foreground or background
- Dashboard shows correct order counts
- Store status toggle persists immediately

---

### TASK-5003
**Title:** Build Restaurant App — order detail, accept/reject flow  
**Description:** Implement R-04 (Order Details with Accept/Reject). Show full order items, customer district, payment method. Accept and Reject buttons with confirmation dialog. Auto-reject countdown timer visible on the order card.  
**Area:** Mobile — Restaurant App  
**Priority:** Critical  
**Dependencies:** TASK-5001, TASK-5002  
**Complexity:** `M`  
**Acceptance Criteria:**
- Accept/reject updates the order status immediately
- Countdown timer is visible and accurate
- If the customer cancels while viewing, the order is removed from the list via socket event

---

### TASK-5004
**Title:** Build Restaurant App — preparation status and request driver flow  
**Description:** Implement R-06 (Preparation + Request Driver). "Mark Preparing" and "Request Driver" buttons with loading states. Show dispatch status: "Looking for driver...", "Driver found!". Transition to R-07 after driver is assigned.  
**Area:** Mobile — Restaurant App  
**Priority:** Critical  
**Dependencies:** TASK-5003, TASK-6004  
**Complexity:** `M`  
**Acceptance Criteria:**
- Request Driver button triggers dispatch and shows appropriate status
- `driver:assigned` event transitions the screen to driver tracking
- "No driver found" state shown after retries exhausted

---

### TASK-5005
**Title:** Build Restaurant App — menu management  
**Description:** Implement R-08 (Menu Management), R-09 (Add/Edit Product), R-10 (Availability Toggle). Product availability toggle uses optimistic UI with API sync. Image upload with progress indicator.  
**Area:** Mobile — Restaurant App  
**Priority:** High  
**Dependencies:** TASK-3004, TASK-5002  
**Complexity:** `M`  
**Acceptance Criteria:**
- Full product CRUD works from the mobile app
- Availability toggle is instant (optimistic) and confirms via API
- Image upload shows progress and handles failures

---

## 10. Phase 6 — Driver & Dispatch

> **Goal:** Driver verification, online/offline, dispatch algorithm, and full delivery lifecycle.  
> **Team:** Backend Engineer (1, senior) + Mobile Engineer (Driver App)  
> **Duration estimate:** 8–12 days  
> **Prerequisite:** Phase 5 complete

---

### TASK-6001
**Title:** Implement driver profile and document submission APIs  
**Description:** `POST /api/v1/drivers/me/profile` (create/update profile), `POST /api/v1/drivers/me/documents` (upload to S3), `GET /api/v1/drivers/me/verification`. Document upload validates file type and size. Admin verification endpoint: `PATCH /api/v1/admin/drivers/:id/verification`.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-1009, TASK-2008  
**Complexity:** `M`  
**Acceptance Criteria:**
- Driver can submit profile and upload all required documents
- Admin can approve or reject with a reason
- Approved driver receives FCM notification

---

### TASK-6002
**Title:** Implement driver online/offline toggle and location update APIs  
**Description:** `PATCH /api/v1/drivers/me/availability`: validate verification is `APPROVED`, update `driver_profiles.availability_status`, log in `driver_status_history`. `PATCH /api/v1/drivers/me/location`: write to Redis (`driver:{id}:location` with 2-minute TTL) and insert into `driver_locations` table. Apply `@LocationUpdateRateLimit()`.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-6001, TASK-1004  
**Complexity:** `M`  
**Acceptance Criteria:**
- Unverified driver cannot go online (returns `DRIVER_NOT_VERIFIED`)
- Location update writes to Redis and PostgreSQL
- Location in Redis expires after 2 minutes with no update
- Status history is logged on every toggle

---

### TASK-6003
**Title:** Implement the dispatch algorithm  
**Description:** Create `DispatchService`. When `POST /restaurants/me/orders/:id/request-driver` is called: (1) Update order to `LOOKING_FOR_DRIVER`. (2) Query `driver_profiles` for drivers with `availability_status = ONLINE`, no active delivery, `verification_status = APPROVED`. (3) For each, fetch last known location from Redis. (4) Compute distances using Haversine formula. (5) Sort by distance. (6) Call `offerDelivery(driverId, deliveryId)`. Retry logic: expand radius by 2km after each full cycle of no accepts. After `max_dispatch_retries`, set order to `FAILED`.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-6002, TASK-5001  
**Complexity:** `XL`  
**Acceptance Criteria:**
- Nearest available driver receives the offer first
- If no online drivers exist within the initial radius, the radius expands and retries
- Order reaches `FAILED` status when retries are exhausted with FCM to customer and admin notification

---

### TASK-6004
**Title:** Implement driver offer accept/decline with Redis atomic lock  
**Description:** `POST /drivers/me/offers/:offerId/accept`: (1) Acquire Redis lock on `lock:delivery:{deliveryId}` with NX flag (atomic). (2) If lock not acquired, return `DELIVERY_ALREADY_ASSIGNED`. (3) If acquired: update `driver_offers` to ACCEPTED, create `delivery` with `driver_id`, update `driver_profiles.availability_status` to `ON_DELIVERY`, update order to `DRIVER_ASSIGNED`. (4) Emit `driver:assigned` event. (5) Release lock after 5 seconds (TTL). `POST /offers/:offerId/decline`: mark offer as DECLINED, trigger next driver offer.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-6003, TASK-1004  
**Complexity:** `XL`  
**Acceptance Criteria:**
- Two concurrent accepts for the same delivery result in exactly one success and one `DELIVERY_ALREADY_ASSIGNED`
- Declined offer immediately triggers offer to the next driver in the queue
- Accepted driver's availability status changes to `ON_DELIVERY`

---

### TASK-6005
**Title:** Implement delivery lifecycle update endpoints  
**Description:** Implement: `POST /drivers/me/deliveries/:id/arrived-restaurant`, `/picked-up`, `/arrived-customer`, `/delivered`. Each endpoint: validates the caller is the assigned driver (403 if not), validates the delivery is in the correct status, transitions both `deliveries.status` and `orders.status`, logs to `order_status_history`, emits Socket.IO event, sends FCM notifications to customer (and restaurant for arrived/pickup events). On `delivered`: create `driver_earnings` record, update `driver_profiles.availability_status` to `ONLINE`, clear active delivery state.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-6004  
**Complexity:** `L`  
**Acceptance Criteria:**
- Only the assigned driver can call delivery update endpoints
- All four steps work sequentially and update both delivery and order status
- `driver_earnings` record is created with correct gross, commission, and net amounts on delivery completion
- Driver availability returns to `ONLINE` after delivery

---

### TASK-6006
**Title:** Implement driver earnings and history APIs  
**Description:** `GET /api/v1/drivers/me/earnings?period=today|week|month`, `GET /api/v1/drivers/me/deliveries`. Earnings sum `driver_earnings.net_amount` for the period. Delivery history is paginated.  
**Area:** Backend  
**Priority:** High  
**Dependencies:** TASK-6005  
**Complexity:** `S`  
**Acceptance Criteria:**
- Earnings figures are accurate for the requested period
- Delivery history is paginated and includes restaurant name and earnings per delivery

---

### TASK-6007
**Title:** Build Driver App — auth, verification, and home screens  
**Description:** Implement D-01 (Splash), D-02 (Login), D-03 (Verification — profile form + document upload), D-04 (Driver Home with online/offline toggle). GPS permissions requested on first online toggle. Background location service configured for Android and iOS.  
**Area:** Mobile — Driver App  
**Priority:** Critical  
**Dependencies:** TASK-6001, TASK-6002  
**Complexity:** `L`  
**Acceptance Criteria:**
- New driver can register, submit documents, and see a pending status screen
- Approved driver can toggle online and share location
- App requests location permissions correctly on both platforms

---

### TASK-6008
**Title:** Build Driver App — delivery request and acceptance flow  
**Description:** Implement D-05 (Delivery Request overlay). Full-screen alert with countdown timer, restaurant name, distance, estimated earnings. Accept and Decline buttons. Timer auto-dismisses on expiry. FCM wakes the app for a request while backgrounded.  
**Area:** Mobile — Driver App  
**Priority:** Critical  
**Dependencies:** TASK-6004, TASK-7001  
**Complexity:** `M`  
**Acceptance Criteria:**
- Request appears as an overlay regardless of current screen
- Countdown is accurate and visible
- FCM delivery request wakes the app and shows the overlay
- Race condition: if offer is already taken when accepting, show "Offer no longer available" and return to home

---

### TASK-6009
**Title:** Build Driver App — full delivery lifecycle screens  
**Description:** Implement D-06 (Active Delivery hub), D-07 (Navigate to Restaurant), D-08 (Arrived + Pickup), D-09 (Navigate to Customer + Delivered). Each screen has a primary action button. "Open in Maps" launches the external maps app. GPS location updates sent every 5–20s depending on speed. Active delivery state persisted locally.  
**Area:** Mobile — Driver App  
**Priority:** Critical  
**Dependencies:** TASK-6005, TASK-6008  
**Complexity:** `L`  
**Acceptance Criteria:**
- Full delivery flow works end-to-end on a real device
- Location updates are sent at the correct frequency
- Active delivery state restored after app kill/restart
- "Mark Delivered" completes the flow and returns to the home screen

---

### TASK-6010
**Title:** Build Driver App — earnings and history screens  
**Description:** Implement D-10 (Earnings), D-11 (History), D-12 (Profile), D-13 (Notifications). Earnings show today/week/month with a toggle. History is paginated.  
**Area:** Mobile — Driver App  
**Priority:** High  
**Dependencies:** TASK-6006  
**Complexity:** `M`  
**Acceptance Criteria:**
- Earnings are accurate and match the backend calculation
- History loads with pagination
- Notifications deep-link to correct screens

---

## 11. Phase 7 — Realtime & Notifications

> **Goal:** End-to-end Socket.IO and FCM integration across all apps.  
> **Team:** Backend Engineer (1)  
> **Duration estimate:** 5–7 days  
> **Prerequisite:** Phase 5 and Phase 6 foundation complete

---

### TASK-7001
**Title:** Set up Socket.IO gateway with authentication  
**Description:** Create `RealtimeModule` with a `@WebSocketGateway()`. On connection: validate the JWT token from the query param. Reject invalid tokens with a connection error. On successful connection: join the user to their personal room (`driver:{id}`, `restaurant:{restaurantId}`, or `customer:{id}`). Use `@socket.io/redis-adapter` to support horizontal scaling from day one.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-2001, TASK-1004  
**Complexity:** `L`  
**Acceptance Criteria:**
- Connecting with a valid JWT joins the correct rooms
- Connecting with an invalid/expired JWT is rejected immediately
- Multiple backend instances share socket state via Redis adapter (test with two instances locally)

---

### TASK-7002
**Title:** Implement all Socket.IO order event emissions  
**Description:** Wire all order status transitions to emit the correct Socket.IO events defined in `API_CONTRACTS.md` Section 8. Each event is emitted to the correct room(s) with the correct payload. Also implement `connection:restored` — on client reconnect, emit the latest order status and driver location as a sync payload.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-7001, TASK-5001, TASK-6005  
**Complexity:** `M`  
**Acceptance Criteria:**
- Every order status change emits the correct event to the correct room
- Customer app receives events without polling when connected
- `connection:restored` sends the current order state on reconnect

---

### TASK-7003
**Title:** Implement driver location relay via Socket.IO  
**Description:** When the backend receives `driver:location_update` from the Driver App socket, update Redis and relay `driver:location_updated` to the order's room (customer + restaurant). Only relay if the driver has an active delivery. Implement rate-limiting at the socket event level (max 30 location events/minute per driver connection).  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-7001, TASK-6002  
**Complexity:** `M`  
**Acceptance Criteria:**
- Customer app map updates in real time when driver sends a location event
- Location events are throttled at the socket level
- Events are not relayed if the driver has no active delivery (privacy)

---

### TASK-7004
**Title:** Create `NotificationsModule` and FCM integration  
**Description:** Install Firebase Admin SDK (`firebase-admin`). Create `FcmService` with `sendToUser(userId, notification)` and `sendToDevice(fcmToken, notification)`. `sendToUser` fetches all `device_tokens` for the user and sends to each. Handle `NOT_REGISTERED` error by deleting the stale token. Create `NotificationService` that: saves a `notifications` record, then calls `FcmService`.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-2007, TASK-1003  
**Complexity:** `M`  
**Acceptance Criteria:**
- FCM notification reaches a real device (Android and iOS test required)
- Stale tokens are cleaned up automatically
- Notification record is saved in the `notifications` table
- High-priority FCM messages wake the app on Android

---

### TASK-7005
**Title:** Wire FCM to all order lifecycle events  
**Description:** For every order event that has FCM defined in `API_CONTRACTS.md` Section 11, wire the `NotificationService` call after the Socket.IO emit. FCM is always sent in parallel with Socket.IO — not as a fallback. For the restaurant's new order FCM, use HIGH priority and `contentAvailable: true`.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-7004, TASK-7002  
**Complexity:** `M`  
**Acceptance Criteria:**
- Every specified event triggers both a socket emission and an FCM send
- Restaurant receives FCM even when the app is killed
- Driver receives a HIGH priority FCM for delivery requests even when the app is backgrounded

---

### TASK-7006
**Title:** Implement notification list and read-status APIs  
**Description:** `GET /api/v1/notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`. These are used by all three apps for in-app notification inbox.  
**Area:** Backend  
**Priority:** High  
**Dependencies:** TASK-7004  
**Complexity:** `S`  
**Acceptance Criteria:**
- Notification list returns paginated, newest first
- Read status updates correctly and reflects in badge count
- Notifications are scoped to the authenticated user

---

### TASK-7007
**Title:** Integrate Socket.IO client in Flutter apps  
**Description:** Create `SocketService` in `shared_services`. Wrap `socket_io_client` package. Implement: connect with JWT, auto-reconnect with exponential backoff, join order room, listen for events, emit driver location. Implement `connection:restored` handler that syncs the latest order state. Expose a connectivity stream that the UI observes for the offline banner.  
**Area:** Mobile — All Apps  
**Priority:** Critical  
**Dependencies:** TASK-7001  
**Complexity:** `L`  
**Acceptance Criteria:**
- Socket reconnects automatically after network loss
- `connection:restored` handler refreshes UI state without full page reload
- Offline banner appears when socket is disconnected for more than 5 seconds
- Driver location events are throttled client-side before sending

---

## 12. Phase 8 — Admin Dashboard

> **Goal:** Minimal web admin panel sufficient for operations team to manage the platform at launch.  
> **Team:** Frontend Engineer (1)  
> **Duration estimate:** 6–8 days  
> **Prerequisite:** Phase 6 and Phase 7 complete

---

### TASK-8001
**Title:** Set up admin dashboard React project  
**Description:** Bootstrap a Next.js project for the admin dashboard. Install: `axios`, `react-query` (or `SWR`), `tailwindcss`, `react-table`, `react-hook-form`. Configure environment variables: `NEXT_PUBLIC_API_URL`. Set up authentication middleware (redirect to login if no admin token).  
**Area:** Admin Dashboard  
**Priority:** Critical  
**Dependencies:** TASK-2005  
**Complexity:** `S`  
**Acceptance Criteria:**
- Admin can log in at `/login` and is redirected to `/dashboard` on success
- Unauthenticated access to any page redirects to `/login`
- Token is stored in an HTTP-only cookie (or localStorage as MVP shortcut)

---

### TASK-8002
**Title:** Implement admin APIs — users, restaurants, drivers  
**Description:** Backend: implement admin user management (`GET /admin/users`, `PATCH /admin/users/:id/status`), restaurant management (`GET /admin/restaurants`, `PATCH /admin/restaurants/:id/status`), and driver management (`GET /admin/drivers`, `PATCH /admin/drivers/:id/verification`, `GET /admin/drivers/:id` with documents). All actions logged to `audit_logs`.  
**Area:** Backend + Admin Dashboard  
**Priority:** Critical  
**Dependencies:** TASK-2002  
**Complexity:** `L`  
**Acceptance Criteria:**
- Admin can view, search, and filter all users/restaurants/drivers
- Suspending a user revokes all their active sessions
- Driver document URLs are signed S3 URLs with 1-hour expiry

---

### TASK-8003
**Title:** Implement admin order APIs and order intervention  
**Description:** Backend: `GET /admin/orders` (full filter), `GET /admin/orders/:id`, `POST /admin/orders/:id/cancel`, `POST /admin/orders/:id/assign-driver`, `PATCH /admin/orders/:id/status`. All intervention actions logged to `audit_logs` with `before_value` and `after_value`.  
**Area:** Backend + Admin Dashboard  
**Priority:** Critical  
**Dependencies:** TASK-5001, TASK-6004  
**Complexity:** `M`  
**Acceptance Criteria:**
- Admin can view the full order list with filtering
- Manual driver assignment works and triggers the correct socket events
- All interventions are present in the audit log

---

### TASK-8004
**Title:** Implement admin platform settings API  
**Description:** `GET /api/v1/admin/settings` and `PUT /api/v1/admin/settings`. Admin dashboard settings page allows changing: dispatch radius, dispatch timeout, auto-reject timeout, default delivery fee, default commission rate. Changes are logged to `audit_logs`.  
**Area:** Backend + Admin Dashboard  
**Priority:** High  
**Dependencies:** TASK-8002  
**Complexity:** `S`  
**Acceptance Criteria:**
- Settings update persists in `platform_settings` table
- Dispatch service reads commission from `platform_settings` dynamically (not hardcoded)

---

### TASK-8005
**Title:** Build admin dashboard — driver verification workflow  
**Description:** Build the Drivers page (A-06) with: pending verification list, driver detail page with document viewer (show images/PDFs from signed S3 URLs), Approve/Reject buttons. Rejected status requires a reason. Approved driver receives FCM notification automatically.  
**Area:** Admin Dashboard  
**Priority:** Critical  
**Dependencies:** TASK-8002, TASK-7005  
**Complexity:** `M`  
**Acceptance Criteria:**
- Operations team can review and approve/reject drivers without database access
- Document images load correctly from signed URLs
- Approval FCM reaches the driver's device

---

### TASK-8006
**Title:** Build admin dashboard — orders list and order detail  
**Description:** Build A-07 (Orders with filters) and A-08 (Order Detail with full timeline, items, payment, driver, and intervention buttons). Intervention buttons: Cancel Order, Assign Driver (dropdown of online drivers).  
**Area:** Admin Dashboard  
**Priority:** Critical  
**Dependencies:** TASK-8003  
**Complexity:** `M`  
**Acceptance Criteria:**
- Full order timeline is visible with actor and timestamp for each step
- Admin can cancel an order from the UI
- Manual driver assignment works via a searchable dropdown

---

## 13. Phase 9 — Testing & QA

> **Goal:** Automated test coverage on critical paths; manual QA on real devices.  
> **Team:** All engineers + QA  
> **Duration estimate:** 7–10 days (runs parallel to Phase 8 backend work)

---

### TASK-9001
**Title:** Write unit tests for order status machine  
**Description:** Test every allowed and disallowed transition in the `OrdersService`. Mock Prisma and Redis. Verify that invalid transitions throw `ORDER_INVALID_STATUS`. Verify that the correct socket event is emitted for each transition. Aim for 100% branch coverage on the status machine.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-5001, TASK-6005  
**Complexity:** `M`  
**Acceptance Criteria:**
- All 14 order statuses are tested for their allowed transitions
- Each disallowed transition is tested to confirm it throws correctly
- Test suite runs in under 30 seconds

---

### TASK-9002
**Title:** Write integration tests for order creation (idempotency)  
**Description:** Use a real test PostgreSQL database. Test: (1) normal order creation; (2) duplicate idempotency key returns the same order; (3) unavailable product blocks creation; (4) closed restaurant blocks creation; (5) minimum order amount enforcement; (6) address snapshot is correctly stored.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-4003  
**Complexity:** `M`  
**Acceptance Criteria:**
- All 6 scenarios pass
- No partial database records remain after a failed order creation

---

### TASK-9003
**Title:** Write integration tests for dispatch and race condition prevention  
**Description:** Simulate two concurrent requests to accept the same delivery offer. Assert that exactly one succeeds with `DRIVER_ASSIGNED` and the other returns `DELIVERY_ALREADY_ASSIGNED`. Test the full dispatch retry flow: no drivers → radius expansion → timeout → `FAILED` status.  
**Area:** Backend  
**Priority:** Critical  
**Dependencies:** TASK-6004  
**Complexity:** `L`  
**Acceptance Criteria:**
- Race condition test passes reliably (run 50 times in CI without failure)
- Retry flow correctly reaches `FAILED` after exhausting retries
- Redis lock is cleaned up correctly in all code paths

---

### TASK-9004
**Title:** Write unit tests for auth — OTP and JWT  
**Description:** Test OTP generation, hashing, verification, expiry, and attempt limiting. Test JWT issuance, refresh rotation, and revocation. Test role guard correctly allows/blocks by role.  
**Area:** Backend  
**Priority:** High  
**Dependencies:** TASK-2004, TASK-2006  
**Complexity:** `M`  
**Acceptance Criteria:**
- OTP max attempts correctly blocks further attempts
- JWT refresh rotation revokes the old token
- Role guard tests cover all 7 roles

---

### TASK-9005
**Title:** Manual QA — end-to-end full order cycle on real devices  
**Description:** Test the complete order cycle on real Android devices: (1) Customer places order. (2) Restaurant receives and accepts. (3) Driver receives request, accepts, navigates, picks up, delivers. (4) Customer sees live tracking. (5) All FCM notifications arrive. Repeat in a simulated weak internet environment (throttle to 3G in Android developer options).  
**Area:** All  
**Priority:** Critical  
**Dependencies:** All Phase 4–7 tasks  
**Complexity:** `L`  
**Acceptance Criteria:**
- Full cycle completes without errors in normal network conditions
- Full cycle completes (with acceptable delays) under throttled 3G
- No duplicate orders, no stuck status, no missing notifications

---

### TASK-9006
**Title:** Manual QA — offline/weak internet scenarios  
**Description:** Test each offline scenario from `DELIVERY_APPS_REQUIREMENTS.md` Section 12: customer browses cached restaurants; cart persists after kill; order placement fails gracefully with retry; driver delivery action retries on reconnect; location updates batch and sync.  
**Area:** All  
**Priority:** High  
**Dependencies:** TASK-9005  
**Complexity:** `M`  
**Acceptance Criteria:**
- Each scenario has a written QA checklist item marked pass/fail
- No crashes occur in any offline scenario
- Retry queue successfully replays queued actions after reconnection

---

### TASK-9007
**Title:** Performance test — Socket.IO concurrent connections  
**Description:** Use `socket.io-client` in a Node.js load test script to open 200 concurrent authenticated socket connections and emit location updates at 1/second. Measure: CPU/memory on the backend, event delivery latency. Identify the connection limit of the current single-instance setup.  
**Area:** Backend / DevOps  
**Priority:** High  
**Dependencies:** TASK-7001  
**Complexity:** `M`  
**Acceptance Criteria:**
- 200 concurrent connections sustain without crashes
- Event delivery latency under 500ms at 200 connections
- Documented ceiling for horizontal scaling planning

---

## 14. Phase 10 — Deployment

> **Goal:** Platform running on production infrastructure, accessible to real users.  
> **Team:** DevOps + Engineering Lead  
> **Duration estimate:** 4–6 days

---

### TASK-10001
**Title:** Provision production server infrastructure  
**Description:** Provision on Hetzner (or DigitalOcean): one VPS (CX31: 2 vCPU, 8GB RAM) for the backend + Nginx. Managed PostgreSQL 15. Managed Redis 7. Configure firewall rules: only ports 80, 443, and 22 (SSH) open. Set up SSH key-based access only.  
**Area:** DevOps  
**Priority:** Critical  
**Dependencies:** None  
**Complexity:** `M`  
**Acceptance Criteria:**
- All three services are accessible from the backend VPS
- SSH password access is disabled
- Firewall rules verified with `nmap` scan

---

### TASK-10002
**Title:** Configure Nginx reverse proxy and SSL  
**Description:** Install Nginx. Configure reverse proxy to NestJS on port 3000. Set up SSL with Let's Encrypt via Certbot (auto-renewal). Configure WebSocket proxy settings for Socket.IO (`proxy_http_version 1.1`, `proxy_set_header Upgrade`, `proxy_set_header Connection`). Enable gzip compression.  
**Area:** DevOps  
**Priority:** Critical  
**Dependencies:** TASK-10001  
**Complexity:** `M`  
**Acceptance Criteria:**
- API is accessible via HTTPS only
- Socket.IO connections work over WSS
- SSL certificate auto-renews (test with `--dry-run`)
- gzip compression active (verify with `curl -H "Accept-Encoding: gzip" -I https://api.domain.com`)

---

### TASK-10003
**Title:** Configure Cloudflare CDN for S3 and API  
**Description:** Add the domain to Cloudflare. Set up DNS records. Point the API subdomain (`api.domain.com`) through Cloudflare (proxy enabled for DDoS protection). Set up the CDN subdomain (`cdn.domain.com`) pointing to the S3 bucket or R2 for image delivery. Configure Cloudflare cache rules (API = no cache; CDN = aggressive cache).  
**Area:** DevOps  
**Priority:** High  
**Dependencies:** TASK-10001  
**Complexity:** `S`  
**Acceptance Criteria:**
- API responses have `CF-Cache-Status: BYPASS` (not cached by Cloudflare)
- CDN image URLs load with correct `Cache-Control` headers
- Cloudflare DDoS protection is active

---

### TASK-10004
**Title:** Set up PM2 for process management and auto-restart  
**Description:** Install PM2 globally on the server. Create a `pm2.config.js` for the NestJS app with: `instances: 1` (MVP), `autorestart: true`, `max_memory_restart: 1G`, `log_file` path. Configure PM2 to start on system boot with `pm2 startup`. Add log rotation with `pm2-logrotate`.  
**Area:** DevOps  
**Priority:** Critical  
**Dependencies:** TASK-10001  
**Complexity:** `S`  
**Acceptance Criteria:**
- App restarts automatically after a crash (test by killing the process)
- App starts automatically after a server reboot
- Logs are rotated and don't fill the disk

---

### TASK-10005
**Title:** Apply all database migrations and seed data on production  
**Description:** Run `npx prisma migrate deploy` against the production database. Verify all tables, indexes, and constraints exist. Run the production seed script (platform settings, categories, global commission, admin user). Verify admin login works. Do NOT seed sample restaurant or test data.  
**Area:** DevOps  
**Priority:** Critical  
**Dependencies:** TASK-1003, TASK-10001  
**Complexity:** `S`  
**Acceptance Criteria:**
- All 37 tables exist with correct schema
- Admin can log into the admin dashboard
- Platform settings have correct default values

---

### TASK-10006
**Title:** Set up centralized logging with structured output  
**Description:** Configure the NestJS logger to output structured JSON logs (use `nest-winston` or Pino). Log format includes: timestamp, level, context (module name), message, request ID (from `x-request-id` header). Ship logs to a file on the server. Set up basic log monitoring with `tail -f` access documented for the ops team. (Centralized log service like Papertrail or Logtail is post-MVP.)  
**Area:** Backend / DevOps  
**Priority:** High  
**Dependencies:** TASK-10004  
**Complexity:** `S`  
**Acceptance Criteria:**
- All log lines are valid JSON with required fields
- Error logs include the full stack trace
- Logs are persisted to file and accessible to the ops team

---

### TASK-10007
**Title:** Prepare and submit mobile apps to app stores  
**Description:** Generate release keystores (Android) and distribution certificates (iOS). Configure `--flavor production` Flutter build. Build signed APK/AAB and iOS IPA. Prepare app store metadata: app name, description, screenshots (minimum required), privacy policy URL. Submit to Google Play (internal testing track first) and Apple App Store (TestFlight first).  
**Area:** Mobile / DevOps  
**Priority:** Critical  
**Dependencies:** All mobile tasks complete  
**Complexity:** `L`  
**Acceptance Criteria:**
- Android AAB builds successfully with release signing
- iOS IPA builds without provisioning profile errors
- Both apps are submitted and accessible to internal testers
- App store listings have correct descriptions and screenshots

---

### TASK-10008
**Title:** Set up database backup automation  
**Description:** Configure a daily `pg_dump` cron job on the production server. Compress the dump with `gzip`. Upload to S3/R2 with a `backups/` prefix. Retain the last 14 daily backups. Test the restore process manually on a staging server. Document the restore procedure.  
**Area:** DevOps  
**Priority:** Critical  
**Dependencies:** TASK-10001  
**Complexity:** `M`  
**Acceptance Criteria:**
- Daily backup runs automatically at 2:00 AM UTC
- Backup file is present in S3 the next morning
- Restore test completes successfully on a staging database
- Restore procedure is documented in `RUNBOOK.md`

---

## 15. MVP Acceptance Criteria

The MVP is considered **complete and ready for launch** when ALL of the following are true:

### Functional Criteria

| # | Criterion |
|---|-----------|
| 1 | A new customer can register via phone OTP, browse restaurants, add items to cart, and place a COD order from end to end without errors |
| 2 | A restaurant receives the order in real time (within 5 seconds) on the restaurant app and can accept or reject it |
| 3 | An accepted order triggers the dispatch algorithm, and the nearest available driver receives the delivery request within 10 seconds |
| 4 | A driver can accept the offer, complete the full delivery lifecycle (4 status steps), and the order reaches `DELIVERED` status |
| 5 | The customer sees the driver's live location on a map with updates every 5–20 seconds during delivery |
| 6 | All FCM notifications arrive on real devices for the following events: new order (restaurant), delivery request (driver), order accepted/delivered (customer) |
| 7 | Duplicate order submissions with the same idempotency key do not create duplicate orders (verified in the database) |
| 8 | Two concurrent driver accepts for the same delivery result in exactly one assignment |
| 9 | An admin can view all orders, approve driver verification, and cancel an order from the admin dashboard |
| 10 | The dispatch algorithm correctly reaches `FAILED` status with customer notification when no drivers are available after all retries |

### Quality Criteria

| # | Criterion |
|---|-----------|
| 11 | All three mobile apps work correctly on Android (minimum API 26) with simulated 3G throttled connection |
| 12 | No crashes occur in the offline browse scenario (cached data displayed with appropriate banners) |
| 13 | Order placement fails gracefully when offline, with a retry option that does not duplicate the order |
| 14 | All automated tests pass in CI (unit + integration) with zero failures |
| 15 | The backend API responds to health check within 200ms under normal load |

### Operational Criteria

| # | Criterion |
|---|-----------|
| 16 | SSL is active on the API domain |
| 17 | Daily database backup is configured and has run at least once successfully |
| 18 | PM2 auto-restart is configured and tested |
| 19 | The super admin account exists and can log in to the admin dashboard |
| 20 | Both mobile apps are available on Google Play (internal testing track) and Apple TestFlight |

---

## 16. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| FCM delivery failure on Android with aggressive battery optimization | High | High | Guide users during onboarding to disable battery optimization for the app. Use HIGH priority FCM messages. |
| Weak internet causes missed new order alerts to restaurant | High | High | Dual channel: Socket.IO + FCM simultaneously. Restaurant app shows "You may be offline" banner prominently. |
| Dispatch race condition (two drivers accept simultaneously) | Medium | Critical | Redis atomic NX lock on delivery accept. Integration test runs 50 concurrent accepts without failure. |
| Driver app GPS drains battery on long shifts | High | Medium | Adaptive accuracy: `balanced` when idle, `high` during active delivery. Stop GPS when offline. |
| PostgreSQL migration failure on production | Low | Critical | Run `pg_dump` backup before every migration. Test migration on staging first. Use expand/contract pattern. |
| App store rejection (iOS) | Medium | High | Follow Apple guidelines strictly. Submit TestFlight first. Include privacy policy and request only necessary permissions. |
| Idempotency key collision (two different orders with same key) | Very Low | High | Keys are UUID v4 — collision probability is astronomically low. Add monitoring alert if it ever occurs. |
| Driver accepts offer but loses internet before backend confirms | Medium | Medium | Client retries the accept request with exponential backoff. Redis lock TTL ensures the lock is eventually released if backend fails. |
| Restaurant doesn't respond to new orders (no staff watching the app) | Medium | High | Auto-reject timer (3 minutes). Admin dashboard shows pending orders older than 2 minutes with an alert. |
| Socket.IO server overload from many concurrent location updates | Medium | Medium | Rate limit location update events at 30/minute/connection at the socket gateway level. Use Redis adapter from day one for easy horizontal scaling. |

---

## 17. Dependency Graph Summary

```
Phase 0 (Setup)
    └── Phase 1 (Backend Foundation)
            ├── Phase 2 (Auth)
            │       ├── Phase 3 (Restaurant & Menu)
            │       │       └── Phase 4 (Customer Ordering)
            │       │               └── Phase 5 (Restaurant Order Handling)
            │       │                       └── Phase 6 (Driver & Dispatch)
            │       │                               └── Phase 7 (Realtime & Notifications)
            │       │                                       └── Phase 8 (Admin Dashboard)
            │       │                                               └── Phase 9 (Testing & QA)
            │       │                                                       └── Phase 10 (Deployment)
            │       └── Phase 7 (Socket.IO gateway — can start in parallel with Phase 3)
            └── Phase 6 (Redis lock — can be set up in parallel with Phase 2)
```

**Parallelization opportunities:**
- Phase 3 backend work can start while Phase 4 mobile work is in progress (backend ahead of mobile)
- Phase 7 Socket.IO gateway setup can start as soon as Phase 1 is complete
- Phase 8 admin dashboard can start as soon as Phase 6 APIs are complete
- Phase 9 testing runs in parallel with Phase 8 dashboard build
- Phase 10 infrastructure provisioning (TASK-10001, TASK-10002) can start at any time — it does not depend on code

**Critical path (longest sequential chain):**
```
TASK-0002 → TASK-1001 → TASK-1003 → TASK-2001 → TASK-2004 → TASK-3001 →
TASK-4003 → TASK-5001 → TASK-6003 → TASK-6004 → TASK-6005 → TASK-7002 →
TASK-7005 → TASK-9003 → TASK-10005
```
This chain represents the core order flow from backend setup to production deployment.

---

## ملخص الملف

**ما هدف هذا الملف؟**

هذا الملف هو **خطة العمل التفصيلية للـ MVP** — يُجيب على سؤال: ماذا نبني، بأي ترتيب، ومن يفعل ماذا؟

يحتوي على:
- تقسيم كامل لكل مهمة في المشروع إلى Tasks مرقمة (TASK-XXXX)
- كل Task لها: وصف واضح، حجم التعقيد (XS/S/M/L/XL)، والـ Phase التي تنتمي إليها
- ترتيب الـ Phases من 0 (إعداد المشروع) حتى 10 (النشر على الإنتاج)
- ما هو داخل الـ MVP وما هو خارجه بشكل صريح
- الـ Critical Path — سلسلة المهام التي لو تأخرت واحدة منها يتأخر كل شيء
- معايير القبول (Acceptance Criteria) — متى نقول إن الـ MVP اكتمل؟

**من يقرأه؟** Tech Lead وكل مهندس في الفريق لمعرفة ما يعمل عليه الآن وما يليه.

**القاعدة:** لا تُضاف ميزة جديدة للـ MVP إلا بعد مراجعة هذا الملف والتأكد أنها ليست خارج الـ Scope المحدد.
