# BACKEND_AUDIT_REPORT.md

> **Audit Date:** 2026-05-08  
> **Auditor:** Senior QA / Security / Performance Engineer  
> **Project:** Local Delivery Platform — Israel 🇮🇱 | +972 | ILS ₪  
> **NestJS Version:** 11.0.1 | **Prisma:** 5.22.0 | **Node:** Latest LTS

---

## 1. Executive Summary

| Item | Status |
|------|--------|
| **Overall Backend Quality** | ⚠️ Near-production — 7 bugs fixed, 4 items need attention |
| **Ready for frontend integration** | ✅ YES — after applying the fixes in this report |
| **Ready for staging deployment** | ⚠️ CONDITIONAL — add rate-limit per-endpoint decorators + create staging `.env` |

The backend is architecturally solid. It implements a correct order lifecycle FSM, proper JWT strategy, modular NestJS structure, Redis-based idempotency, and financial accuracy. Seven bugs were found and fixed during this audit. The remaining issues are medium-to-low priority and do not block frontend integration.

---

## 2. Critical Issues (Fixed During Audit)

### BUG-001 — `cancelOrder` crashes with Prisma error at runtime
- **File:** `src/modules/orders/orders.service.ts:792`
- **Problem:** `OrderCancellation.create` did not supply the required `cancelledBy` field. Prisma would throw a constraint violation on every order cancellation.
- **Fix:** Added `cancelledBy: customerId` to the create payload.
- **Severity:** CRITICAL — broken endpoint

### BUG-002 — Error response format did not match API contract
- **File:** `src/common/filters/global-exception.filter.ts`
- **Problem:** Response shape was `{success, statusCode, message, errors, path, timestamp}`. API contract requires `{success, error:{code, message, details}, timestamp, path}`. Frontend developers would parse the wrong structure.
- **Fix:** Rewrote filter to produce the correct contract format with error code mapping.
- **Severity:** CRITICAL — breaks all frontend error handling

### BUG-003 — Helmet security headers not applied
- **File:** `src/main.ts`
- **Problem:** `helmet` was listed as a dependency but never `app.use(helmet())`. The app was missing X-Content-Type-Options, X-Frame-Options, HSTS, and was leaking `X-Powered-By: Express`.
- **Fix:** Added `import helmet from 'helmet'` and `app.use(helmet())` before CORS setup.
- **Severity:** CRITICAL — security

### BUG-004 — ThrottlerModule not configured despite being a dependency
- **File:** `src/app.module.ts`
- **Problem:** `@nestjs/throttler` was installed but never imported/configured. No rate limiting was active anywhere.
- **Fix:** Added `ThrottlerModule.forRoot([{name:'global', ttl:60000, limit:200}])` and `ThrottlerGuard` as first APP_GUARD.
- **Severity:** CRITICAL — security/abuse protection missing

### BUG-005 — Refresh token rotation bypass (security vulnerability)
- **File:** `src/modules/auth/auth.service.ts:refresh()`
- **Problem:** The service stored a bcrypt hash of the refresh token in the DB but **never compared** the presented token against the stored hash. Any non-revoked DB record for the user would succeed, regardless of which token was presented. Token rotation was cosmetic.
- **Fix:** Added `bcrypt.compare(rawRefreshToken, stored.tokenHash)`. On mismatch, all tokens for the user are revoked (reuse-attack protection).
- **Severity:** CRITICAL — authentication security bypass

### BUG-006 — Delivery status transitions had no guard
- **File:** `src/modules/delivery/delivery.service.ts:updateDeliveryStatus()`
- **Problem:** `markArrivedRestaurant`, `markPickedUp`, `markArrivedCustomer` called `updateDeliveryStatus()` which did not check if the transition was valid. A driver could call `picked-up` before `arrived-restaurant`, `arrived-customer` before `picked-up`, etc.
- **Fix:** Added static `DELIVERY_TRANSITIONS` map and `assertDeliveryTransition()` method. Called before any DB write.
- **Severity:** HIGH — data integrity

### BUG-007 — `markDelivered` hardcoded wrong `fromStatus`
- **File:** `src/modules/delivery/delivery.service.ts:markDelivered()`
- **Problem:** `orderStatusHistory.create` had `fromStatus: 'ON_THE_WAY'` hardcoded. Deliveries coming from `ARRIVED_CUSTOMER` (the primary production path) would record an incorrect status history.
- **Fix:** Changed to `fromStatus: delivery.order.status as any` to record the actual current status.
- **Severity:** HIGH — data integrity / audit log corruption

---

## 3. High Priority Issues (Unfixed — Requires Action)

### HIGH-001 — Per-endpoint rate limiting not implemented
- **Problem:** The API contract specifies:
  - `POST /auth/otp/request`: 5 req/min per phone
  - `POST /auth/otp/verify`: 5 req/min per phone
  - `POST /orders`: 10 req/hour per user
  - `PATCH /drivers/me/location`: 120 req/min per driver
  - Global: 200 req/min per IP
- The global throttler is now wired (BUG-004 fix), but per-endpoint `@Throttle()` decorators are not set.
- **Recommended fix:** Add `@Throttle({default: {limit: 5, ttl: 60000}})` on OTP endpoints; `@Throttle({default: {limit: 10, ttl: 3600000}})` on order creation.
- **Blocking:** No — but should be done before staging.

### HIGH-002 — Admin DTOs defined inline without `@ApiProperty`
- **File:** `src/modules/admin/admin.controller.ts:200-230`
- **Problem:** All admin DTOs (SetUserStatusDto, UpdateDriverVerificationDto, etc.) are anonymous classes without Swagger decorators. Swagger docs show empty/wrong schemas for admin endpoints.
- **Recommended fix:** Move DTOs to separate files under `src/modules/admin/dto/` and add `@ApiProperty()` decorators.
- **Blocking:** No — Swagger cosmetic issue.

### HIGH-003 — `adminController.listUsers` uses `query: any`
- **File:** `src/modules/admin/admin.controller.ts:253`
- **Problem:** `@Query() query: any` bypasses NestJS ValidationPipe, allowing arbitrary query params. Not a security risk with Prisma (parameterized queries), but it's a type-safety gap.
- **Recommended fix:** Create a typed `ListUsersQueryDto` with proper validation.
- **Blocking:** No.

### HIGH-004 — `finance.seedDefaultSettings` not called on fresh install
- **Problem:** `FinanceService.onModuleInit` loads settings from DB. On a fresh database with no platform settings, all calculations fall back to hardcoded defaults in `getNumberSetting(key, fallback)`. If the fallback values are wrong in production, pricing will be incorrect silently.
- **Recommended fix:** Either call `seedDefaultSettings()` in a migration seed, or add a startup assertion that logs a warning when settings are empty.
- **Blocking:** No — fallbacks are reasonable defaults.

---

## 4. Medium Priority Issues

### MED-001 — OTP max-attempts lockout timing is per-OTP-record, not per-phone
- After 3 failed attempts, the OTP record is locked. But a new OTP request creates a new record, resetting the counter. A determined attacker could bypass the 3-attempt limit by cycling OTP requests.
- **Recommended fix:** Add a Redis key `otp:lock:{phone}` with a 15-minute TTL after 3 failures.

### MED-002 — Missing database indexes for common queries
Based on query patterns, the following indexes are recommended:
```sql
-- Order queries by status (restaurant dashboard, admin)
CREATE INDEX idx_orders_restaurant_status ON "Order" ("restaurantId", "status");
-- Order queries by customer
CREATE INDEX idx_orders_customer_status ON "Order" ("customerId", "status");
-- Driver offer queries
CREATE INDEX idx_driver_offers_driver_status ON "DriverOffer" ("driverId", "status");
-- OTP lookup (called on every auth)
CREATE INDEX idx_otp_phone_used ON "OtpCode" ("phone", "isUsed");
-- Driver location history cleanup
CREATE INDEX idx_driver_location_driver ON "DriverLocation" ("driverId", "recordedAt");
```
These can be added to `schema.prisma` as `@@index([...])` directives.

### MED-003 — N+1 query in dispatch `findNearestDriver`
- **File:** `src/modules/dispatch/dispatch.service.ts:395-447`
- **Problem:** Gets all candidate driver IDs, then loops over them calling `redis.getDriverLocation()` one by one. With 100 drivers online, this is 100 sequential Redis calls.
- **Recommended fix:** Use Redis `MGET` with a batched keys array.

### MED-004 — `getOrderHistory` and `getRestaurantOrders` use `where: any`
- Type-unsafe query building. Prisma queries are still parameterized so no injection risk, but TypeScript benefits are lost.

### MED-005 — `DeliveryService.findOwnedDelivery` doesn't check active status
- A driver could theoretically update a completed delivery if they hold the right ID. The transition guard (BUG-006 fix) now prevents actual status changes, but the function still allows fetching completed deliveries.

### MED-006 — `markDelivered` in `OrdersService` is dead code
- `OrdersService.markDelivered()` exists but is never called by a controller. `DeliveryService.markDelivered()` handles the actual endpoint. The orphaned method could cause confusion. It should be removed or clearly documented.

---

## 5. Low Priority Issues

### LOW-001 — API contract phone example uses +964 (Iraq)
- `API_CONTRACTS.md` shows `+9647001234567` as an example but the backend validates `+972` only. The contracts doc needs updating to match Israel (+972).

### LOW-002 — Swagger description mixes Arabic text  
- `main.ts:44`: `'Local delivery platform — Israel 🇮🇱 | Kabul / كابول | +972 | ILS ₪'`
- Fine for development, but might confuse frontend devs. Consider a separate API description field.

### LOW-003 — `REJECTED_BY_RESTAURANT` missing from TRANSITIONS cancel rule
- In `order-status.machine.ts`, the `CANCELLED` transition is only allowed from `PENDING_RESTAURANT`. An order in `REJECTED_BY_RESTAURANT` state cannot be explicitly "cancelled" by anyone — it's a terminal state. This is actually correct behavior, but a comment explaining it would help.

### LOW-004 — Hard-coded OTP `111111` in mock mode is a contract risk
- The mock OTP is not documented anywhere. Tests assume `111111` works in mock mode, but the `SmsService` doesn't explicitly expose this contract.
- **Recommended fix:** Add a comment or env var `OTP_MOCK_CODE=111111` to make it explicit.

### LOW-005 — `Reflector` is imported but not used in `main.ts`
- `import { NestFactory, Reflector } from '@nestjs/core'` — `Reflector` is unused after the guards were moved to `app.module.ts`.

---

## 6. Test Coverage Summary

| Module | E2E Tests | Unit Tests | Coverage Status |
|--------|-----------|------------|-----------------|
| Health | ✅ health.e2e-spec.ts | — | Full endpoint coverage |
| Auth | ✅ auth.e2e-spec.ts | — | OTP, login, refresh, logout, me, device-token |
| Customers | ✅ customers.e2e-spec.ts | — | Profile, addresses, RBAC |
| Restaurants | ✅ restaurants.e2e-spec.ts | — | Public list, detail, menu, owner CRUD |
| Menu | ✅ menu.e2e-spec.ts | — | Categories, products, availability |
| Drivers | ✅ drivers.e2e-spec.ts | — | Profile, availability, location, earnings |
| Orders | ✅ orders.e2e-spec.ts | — | Create, active, history, cancel, idempotency |
| Restaurant Orders | ✅ restaurant-orders.e2e-spec.ts | — | Accept, reject, preparing, request-driver |
| Driver Delivery | ✅ driver-delivery.e2e-spec.ts | — | Full lifecycle, transition guard |
| Notifications | ✅ notifications.e2e-spec.ts | — | Device token CRUD |
| Admin | ✅ admin.e2e-spec.ts | — | RBAC, dashboard, user/driver/restaurant management |
| Rate Limiting | ✅ rate-limit.e2e-spec.ts | — | OTP attempts, error format |
| Security | ✅ security.e2e-spec.ts | — | Headers, auth, IDOR, injection, RBAC |
| Finance | ❌ No tests | — | Needs unit tests for calculation correctness |
| Dispatch | ❌ No tests | — | Complex algorithm — needs unit tests with mocked Redis |
| Realtime/WS | ❌ No tests | — | Manual testing or socket.io-client integration tests |

**Total test files created:** 13 e2e spec files + 4 setup files

---

## 7. Security Findings

| Finding | Severity | Status |
|---------|----------|--------|
| Refresh token hash not verified | CRITICAL | ✅ Fixed (BUG-005) |
| No Helmet security headers | CRITICAL | ✅ Fixed (BUG-003) |
| No rate limiting active | CRITICAL | ✅ Fixed (BUG-004) |
| Per-endpoint rate limits not set | HIGH | ⚠️ Pending |
| OTP lockout can be bypassed by re-requesting | MEDIUM | ⚠️ Pending |
| JWT secret weak in `.env` (uses "delivery-access-secret") | HIGH | ⚠️ Change before staging |
| Swagger exposed in non-production only | ✅ OK | — |
| CORS configured from env var | ✅ OK | — |
| Passwords hashed with bcrypt(10) | ✅ OK | — |
| OTP hashed with bcrypt(10) | ✅ OK | — |
| Prisma uses parameterized queries (no SQL injection) | ✅ OK | — |
| ValidationPipe whitelist=true (no mass assignment) | ✅ OK | — |
| JWT strategy validates user exists + status | ✅ OK | — |
| Admin endpoints isolated by Roles guard | ✅ OK | — |
| Delivery horizontal access enforced (only assigned driver) | ✅ OK | — |
| Order horizontal access enforced (only owner customer) | ✅ OK | — |
| passwordHash never returned in any response | ✅ OK | — |

---

## 8. Performance Findings

| Finding | Impact | Recommendation |
|---------|--------|----------------|
| N+1 Redis calls in dispatch | High | Batch with MGET |
| Missing indexes on Order(restaurantId, status) | High | Add @@index in schema.prisma |
| Missing index on OtpCode(phone, isUsed) | High | Very hot query path |
| finance.loadSettings() called once at startup | ✅ Good | In-memory caching is correct |
| Pagination enforced on all list endpoints (max 100) | ✅ Good | No unbounded arrays |
| Driver location in Redis TTL 120s | ✅ Good | Stale location excluded from dispatch |
| Orders count + findMany run in parallel (Promise.all) | ✅ Good | Correct pattern |
| FinanceService loads settings from DB at startup only | ✅ Good | Settings cached in memory |

**Run quick perf tests:**
```bash
npm run perf:health       # benchmark health endpoint
npm run perf:restaurants  # benchmark restaurant list
```

---

## 9. API Contract Mismatches

| Issue | Contract Says | Implementation |
|-------|---------------|----------------|
| Error format | `{success, error:{code,message,details}, timestamp, path}` | ✅ Fixed (BUG-002) |
| Phone validation | "E.164 format, 7–15 digits" in contracts | Implementation validates `+972` only — correct for Israel |
| Phone example in API_CONTRACTS.md | `+9647001234567` (Iraq) | Should be `+972...` (Israel) — LOW-001 |
| Rate limit headers (`X-RateLimit-*`) | Contract says returned on every response | ThrottlerModule sends them automatically — ✅ |
| Idempotency-Key on `/auth/otp/verify` | Required per contract | Not enforced on endpoint — cosmetic gap |
| Swagger auth | Bearer auth required | ✅ `@ApiBearerAuth('access-token')` on all protected controllers |
| `WALLET` payment method | Listed in PaymentMethod enum | CreateOrderDto only allows `CASH_ON_DELIVERY` — correct for MVP |

---

## 10. Recommended Fix Order

Complete these in order before frontend integration starts:

1. ✅ **[DONE]** Fix `cancelOrder` missing `cancelledBy` (BUG-001)
2. ✅ **[DONE]** Fix error response format (BUG-002)
3. ✅ **[DONE]** Add Helmet (BUG-003)
4. ✅ **[DONE]** Add ThrottlerModule (BUG-004)
5. ✅ **[DONE]** Fix refresh token hash verification (BUG-005)
6. ✅ **[DONE]** Add delivery transition guard (BUG-006)
7. ✅ **[DONE]** Fix markDelivered fromStatus (BUG-007)
8. ⚠️ **TODO** Add per-endpoint `@Throttle()` decorators (HIGH-001)
9. ⚠️ **TODO** Add missing Prisma indexes (MED-002)
10. ⚠️ **TODO** Add Redis MGET batch in dispatch (MED-003)
11. ⚠️ **TODO** Change JWT secrets before staging (use `openssl rand -base64 64`)
12. ⚠️ **TODO** Fix LOW-001: update API_CONTRACTS.md phone examples to +972
13. ⚠️ **TODO** Remove unused `Reflector` import from main.ts (LOW-005)

---

## How to Run Tests

### Prerequisites
```bash
# Create test database
createdb delivery_test_db
# Or via docker
docker exec -it <postgres-container> createdb -U delivery_user delivery_test_db

# Run migrations against test DB
DATABASE_URL="postgresql://delivery_user:delivery_pass@localhost:5432/delivery_test_db" npx prisma migrate deploy
```

### Unit tests (when added)
```bash
npm run test
npm run test:cov
```

### E2E tests
```bash
npm run test:e2e
npm run test:e2e:verbose   # with detailed output
```

### Performance tests (requires server running on port 3000)
```bash
npm run start:dev &
npm run perf:health
npm run perf:restaurants
```

### Static checks
```bash
npm run build              # TypeScript compilation
npm run lint               # ESLint
npx prisma validate        # Prisma schema validation
npx prisma generate        # Regenerate Prisma client
```

---

## ⚠️ WARNING

> **NEVER run tests against the production database.**  
> Always use `.env.test` with `DATABASE_URL` pointing to `delivery_test_db`.  
> The test setup automatically rejects `NODE_ENV=production`.

---

*Generated by backend audit — 2026-05-08*
