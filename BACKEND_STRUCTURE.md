# BACKEND_STRUCTURE.md — NestJS Backend Architecture

> **Project:** Local Delivery Platform  
> **Source of Truth:** `DELIVERY_APPS_REQUIREMENTS.md`, `ERD.md`, `API_CONTRACTS.md`, `DATABASE_SCHEMA.md`  
> **Date:** 2026-05-07  
> **Version:** 1.0  
> **Audience:** Backend Engineers, Tech Lead, DevOps

---

## Table of Contents

1. [Backend Overview](#1-backend-overview)
2. [Folder Structure](#2-folder-structure)
3. [Module Responsibilities](#3-module-responsibilities)
4. [Auth Architecture](#4-auth-architecture)
5. [Order Lifecycle Architecture](#5-order-lifecycle-architecture)
6. [Dispatch Architecture](#6-dispatch-architecture)
7. [Realtime Architecture](#7-realtime-architecture)
8. [Notification Architecture](#8-notification-architecture)
9. [Offline / Weak Internet Backend Support](#9-offline--weak-internet-backend-support)
10. [Payment Architecture](#10-payment-architecture)
11. [Security Architecture](#11-security-architecture)
12. [DevOps Notes](#12-devops-notes)
13. [Testing Strategy](#13-testing-strategy)
14. [Assumptions](#14-assumptions)
15. [Open Questions](#15-open-questions)

---

## 1. Backend Overview

### Architecture Style

The backend is a **modular monolith** — a single deployable NestJS application divided into well-isolated feature modules. This provides:

- **Simplicity:** One codebase, one deployment, one database connection pool, one Redis connection.
- **Low operational overhead:** Ideal for MVP and early-stage operation.
- **Clear path to microservices:** Each NestJS module can be extracted into a standalone service later if scale demands it. The module boundaries are designed with this in mind.

### Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | 20 LTS | JavaScript runtime |
| Framework | NestJS | 10.x | Modular server framework |
| Language | TypeScript | 5.x | Type safety |
| ORM | Prisma | 5.x | Database access and migrations |
| Database | PostgreSQL | 15 | Primary persistent store |
| Cache / Lock | Redis | 7 | Location cache, dispatch locking, rate limiting, session state |
| Realtime | Socket.IO | 4.x | Bidirectional event communication |
| Push Notifications | Firebase Admin SDK | 12.x | FCM push notifications |
| HTTP Server | Express (via NestJS) | — | Underlying HTTP adapter |
| Validation | class-validator + class-transformer | — | Request body validation and transformation |
| Auth | @nestjs/jwt + passport-jwt | — | JWT issuance and validation |
| File Storage | AWS SDK v3 (S3) | — | Document and image storage |
| SMS | Twilio / local provider | — | OTP delivery |
| Process Manager | PM2 | — | Production process management |
| Reverse Proxy | Nginx | — | SSL termination, WebSocket proxy |

### System Context

```
Mobile Apps (Flutter)
        │
        ├── HTTPS REST → Nginx → NestJS (port 3000)
        │                           │
        └── WSS Socket.IO ──────────┤
                                    │
                             ┌──────┴──────┐
                             │             │
                        PostgreSQL       Redis
                          (Prisma)    (ioredis)
                             │
                    Firebase Admin SDK
                             │
                            FCM → Mobile Devices
                             │
                        AWS S3 / R2
                    (files, images, docs)
```

---

## 2. Folder Structure

```
src/
├── main.ts                          # Bootstrap: validation pipe, guards, filters, Swagger
├── app.module.ts                    # Root module — imports all feature modules
│
├── config/
│   ├── app.config.ts                # App-level config (port, env)
│   ├── database.config.ts           # Prisma/PostgreSQL connection config
│   ├── redis.config.ts              # Redis connection config
│   ├── jwt.config.ts                # JWT secret, expiry config
│   ├── firebase.config.ts           # Firebase Admin SDK config
│   ├── storage.config.ts            # S3/R2 config
│   └── sms.config.ts                # SMS provider config
│
├── common/
│   ├── guards/
│   │   ├── jwt-auth.guard.ts        # Validates JWT access token
│   │   ├── roles.guard.ts           # Checks @Roles() decorator
│   │   └── ws-jwt.guard.ts          # Validates JWT on socket connection
│   ├── decorators/
│   │   ├── roles.decorator.ts       # @Roles(...roles)
│   │   ├── public.decorator.ts      # @Public() — bypasses auth guard
│   │   ├── current-user.decorator.ts # @CurrentUser() — injects JWT payload
│   │   └── idempotency-key.decorator.ts # @IdempotencyKey() — extracts header
│   ├── filters/
│   │   └── global-exception.filter.ts # Formats all errors to standard envelope
│   ├── interceptors/
│   │   ├── transform-response.interceptor.ts # Wraps data in { success, data }
│   │   ├── logging.interceptor.ts   # Request/response logging
│   │   └── audit-log.interceptor.ts # Auto-logs admin actions
│   ├── pipes/
│   │   └── parse-uuid.pipe.ts       # Validates UUID path parameters
│   ├── types/
│   │   ├── jwt-payload.type.ts      # JwtPayload interface
│   │   ├── api-response.type.ts     # ApiResponse<T> generic
│   │   └── paginated.type.ts        # PaginatedResponse<T>
│   └── utils/
│       ├── haversine.ts             # Distance calculation utility
│       ├── pagination.ts            # Prisma skip/take from page/limit
│       └── hash.ts                  # bcrypt helpers
│
├── prisma/
│   └── prisma.service.ts            # PrismaClient wrapper with lifecycle hooks
│
├── redis/
│   └── redis.service.ts             # ioredis wrapper with typed helpers
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   └── dto/
│   │       ├── otp-request.dto.ts
│   │       ├── otp-verify.dto.ts
│   │       ├── login.dto.ts
│   │       └── register-device-token.dto.ts
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   └── users.service.ts         # Shared user lookup used by other modules
│   │
│   ├── customers/
│   │   ├── customers.module.ts
│   │   ├── customers.controller.ts
│   │   ├── customers.service.ts
│   │   └── dto/
│   │       ├── update-profile.dto.ts
│   │       ├── create-address.dto.ts
│   │       └── update-address.dto.ts
│   │
│   ├── restaurants/
│   │   ├── restaurants.module.ts
│   │   ├── restaurants.controller.ts
│   │   ├── restaurants.service.ts
│   │   └── dto/
│   │       ├── update-restaurant.dto.ts
│   │       ├── update-status.dto.ts
│   │       └── update-working-hours.dto.ts
│   │
│   ├── menu/
│   │   ├── menu.module.ts
│   │   ├── menu.controller.ts
│   │   ├── menu.service.ts
│   │   └── dto/
│   │       ├── create-category.dto.ts
│   │       ├── create-product.dto.ts
│   │       └── update-availability.dto.ts
│   │
│   ├── orders/
│   │   ├── orders.module.ts
│   │   ├── orders.controller.ts
│   │   ├── orders.service.ts
│   │   ├── order-status.machine.ts  # Status transition validator
│   │   └── dto/
│   │       ├── create-order.dto.ts
│   │       ├── accept-order.dto.ts
│   │       ├── reject-order.dto.ts
│   │       └── cancel-order.dto.ts
│   │
│   ├── drivers/
│   │   ├── drivers.module.ts
│   │   ├── drivers.controller.ts
│   │   ├── drivers.service.ts
│   │   └── dto/
│   │       ├── update-profile.dto.ts
│   │       ├── update-availability.dto.ts
│   │       └── update-location.dto.ts
│   │
│   ├── dispatch/
│   │   ├── dispatch.module.ts
│   │   ├── dispatch.service.ts      # Core dispatch algorithm
│   │   └── dispatch-offer.service.ts # Offer management and timeout
│   │
│   ├── delivery/
│   │   ├── delivery.module.ts
│   │   ├── delivery.controller.ts
│   │   └── delivery.service.ts
│   │
│   ├── notifications/
│   │   ├── notifications.module.ts
│   │   ├── notifications.controller.ts
│   │   ├── notifications.service.ts # DB record + FCM dispatch
│   │   └── fcm/
│   │       └── fcm.service.ts       # Firebase Admin SDK wrapper
│   │
│   ├── payments/
│   │   ├── payments.module.ts
│   │   ├── payments.controller.ts
│   │   └── payments.service.ts
│   │
│   ├── locations/
│   │   ├── locations.module.ts
│   │   └── locations.service.ts     # Redis + DB location management
│   │
│   ├── reviews/
│   │   ├── reviews.module.ts
│   │   ├── reviews.controller.ts
│   │   └── reviews.service.ts
│   │
│   ├── support/
│   │   ├── support.module.ts
│   │   ├── support.controller.ts
│   │   └── support.service.ts
│   │
│   ├── admin/
│   │   ├── admin.module.ts
│   │   ├── admin.controller.ts
│   │   ├── admin.service.ts
│   │   └── audit/
│   │       └── audit.service.ts     # Writes to audit_logs
│   │
│   ├── storage/
│   │   ├── storage.module.ts
│   │   └── storage.service.ts       # S3/R2 file upload wrapper
│   │
│   └── realtime/
│       ├── realtime.module.ts
│       ├── realtime.gateway.ts      # Socket.IO @WebSocketGateway
│       └── realtime.service.ts      # Event emission helpers
│
└── jobs/
    └── cleanup/
        ├── otp-cleanup.job.ts       # Delete expired OTP codes (every hour)
        └── location-cleanup.job.ts  # Delete driver_locations older than 7 days (daily)
```

---

## 3. Module Responsibilities

### `AuthModule`
- **Controllers:** `POST /auth/otp/request`, `/otp/verify`, `/login`, `/refresh`, `/logout`, `/me`, `/device-token`
- **Services:** OTP generation + hashing, JWT issuance, refresh token rotation, device token upsert
- **DTOs:** `OtpRequestDto`, `OtpVerifyDto`, `LoginDto`, `RegisterDeviceTokenDto`
- **Tables used:** `users`, `otp_codes`, `refresh_tokens`, `device_tokens`, `customer_profiles`, `driver_profiles`
- **Events emitted:** None
- **Dependencies:** `PrismaService`, `RedisService`, `JwtService`, `SmsService`

---

### `UsersModule`
- **Controllers:** None (service-only module)
- **Services:** `findById(id)`, `findByPhone(phone)`, `findByEmail(email)`, `updateStatus(id, status)`, `softDelete(id)`
- **Tables used:** `users`
- **Purpose:** Shared user lookup consumed by `AuthModule`, `AdminModule`, `AuditModule`

---

### `CustomersModule`
- **Controllers:** `GET/PUT /customers/profile`, `GET/POST/PUT/DELETE /customers/addresses`, `PATCH /addresses/:id/default`
- **Services:** Profile CRUD, address CRUD with soft delete, default address management
- **Tables used:** `customer_profiles`, `customer_addresses`
- **Dependencies:** `PrismaService`

---

### `RestaurantsModule`
- **Controllers:** `GET /restaurants` (public), `GET /restaurants/:id` (public), `GET/PUT /restaurants/me`, `PATCH /restaurants/me/status`, `GET /restaurants/me/dashboard`, `GET/PUT /restaurants/me/working-hours`, `GET /restaurants/me/orders`, `GET /restaurants/me/orders/:id`, accept/reject/prepare/request-driver endpoints, `GET /restaurants/me/earnings`
- **Services:** Restaurant CRUD scoped to authenticated staff, `isCurrentlyOpen()` logic, dashboard aggregation, earnings aggregation
- **Tables used:** `restaurants`, `restaurant_staff`, `restaurant_working_hours`, `restaurant_categories`, `orders`, `payments`, `commissions`
- **Events emitted:** None directly (orders module emits on status changes)
- **Dependencies:** `PrismaService`, `OrdersModule`, `DispatchModule`

---

### `MenuModule`
- **Controllers:** Full CRUD for `menu-categories` and `products`, `PATCH /products/:id/availability`, `POST /products/:id/images`
- **Services:** Category CRUD with product-count guard, product CRUD with cascade modifier creation, availability toggle, image upload via `StorageService`, menu cache invalidation
- **Tables used:** `menu_categories`, `products`, `product_images`, `product_modifiers`, `product_modifier_options`
- **Events emitted:** None
- **Dependencies:** `PrismaService`, `RedisService` (cache bust), `StorageModule`

---

### `OrdersModule`
- **Controllers:** `POST /orders`, `GET /orders/active`, `GET /orders/:id`, `GET /orders`, `GET /orders/:id/tracking`, `POST /orders/:id/cancel`
- **Services:** Order creation (with transaction), status transition engine, idempotency check, cart validation, price/snapshot calculation, status history logging
- **DTOs:** `CreateOrderDto`, `CancelOrderDto`, `AcceptOrderDto`, `RejectOrderDto`
- **Tables used:** `orders`, `order_items`, `order_item_modifiers`, `order_status_history`, `order_cancellations`, `carts`, `cart_items`, `customer_addresses`, `products`, `payments`
- **Events emitted:** `order:new`, `order:accepted`, `order:rejected`, `order:preparing`, `order:cancelled`
- **Dependencies:** `PrismaService`, `RedisService`, `RealtimeModule`, `NotificationsModule`, `DispatchModule`

---

### `DriversModule`
- **Controllers:** `GET/POST /drivers/me/profile`, `POST /drivers/me/documents`, `GET /drivers/me/verification`, `PATCH /drivers/me/availability`, `PATCH /drivers/me/location`, `GET /drivers/me/earnings`, `GET /drivers/me/deliveries`
- **Services:** Driver profile CRUD, document upload, availability toggle with status history, location update (Redis + DB), earnings aggregation
- **Tables used:** `driver_profiles`, `driver_documents`, `driver_locations`, `driver_status_history`, `driver_earnings`, `deliveries`
- **Events emitted:** `driver:location_updated` (relayed via `RealtimeModule`)
- **Dependencies:** `PrismaService`, `RedisService`, `StorageModule`, `LocationsModule`, `RealtimeModule`

---

### `DispatchModule`
- **Controllers:** None (internal service only — called by `RestaurantsModule` and `DriversModule`)
- **Services:**
  - `DispatchService.initiateDispatch(orderId)`: finds candidates, sorts, calls `offerToDriver()`
  - `DispatchOfferService.offerToDriver(driverId, deliveryId)`: emits `driver:requested`, starts timeout
  - `DispatchOfferService.acceptOffer(offerId, driverId)`: atomic Redis lock, assigns driver
  - `DispatchOfferService.declineOffer(offerId, driverId)`: moves to next candidate
  - `DispatchOfferService.handleTimeout(offerId)`: auto-decline, retry or fail
- **Tables used:** `driver_offers`, `deliveries`, `driver_profiles`, `driver_locations` (Redis), `orders`
- **Events emitted:** `driver:requested`, `driver:assigned`
- **Dependencies:** `PrismaService`, `RedisService`, `RealtimeModule`, `NotificationsModule`, `LocationsModule`

---

### `DeliveryModule`
- **Controllers:** `POST /drivers/me/deliveries/:id/arrived-restaurant`, `/picked-up`, `/arrived-customer`, `/delivered`, `GET /drivers/me/active-delivery`
- **Services:** Delivery status transitions (validate assigned driver, update `deliveries` + `orders` + `order_status_history`), earnings calculation on delivery, driver availability reset
- **Tables used:** `deliveries`, `orders`, `order_status_history`, `driver_profiles`, `driver_earnings`
- **Events emitted:** `order:arrived_restaurant`, `order:picked_up`, `order:on_the_way`, `order:arrived_customer`, `order:delivered`
- **Dependencies:** `PrismaService`, `RealtimeModule`, `NotificationsModule`

---

### `NotificationsModule`
- **Controllers:** `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`
- **Services:**
  - `NotificationsService.send(userId, type, title, body, data)`: saves DB record + calls `FcmService`
  - `FcmService.sendToUser(userId, payload)`: fetches all device tokens, sends FCM, cleans stale tokens
  - `FcmService.sendToDevice(token, payload)`: sends single FCM message
- **Tables used:** `notifications`, `device_tokens`
- **Dependencies:** `PrismaService`, Firebase Admin SDK

---

### `PaymentsModule`
- **Controllers:** `GET /admin/payments` (admin only), `PATCH /admin/payments/:id/status` (admin only), `POST /admin/refunds` (admin only)
- **Services:** COD payment record management, status transitions, refund record creation, commission calculation
- **Tables used:** `payments`, `payment_events`, `refunds`, `commissions`
- **Dependencies:** `PrismaService`

---

### `LocationsModule`
- **Controllers:** None (service-only)
- **Services:**
  - `setDriverLocation(driverId, location)`: write to Redis with 2-minute TTL + insert to `driver_locations`
  - `getDriverLocation(driverId)`: read from Redis (fast path) → fall back to latest DB record
  - `getOnlineDriversNearLocation(lat, lng, radiusKm)`: query online driver Redis locations and compute distances
- **Tables used:** `driver_locations`, `driver_profiles`
- **Dependencies:** `PrismaService`, `RedisService`

---

### `ReviewsModule`
- **Controllers:** `POST /reviews`
- **Services:** Create review (validate order is DELIVERED + belongs to customer + not already reviewed), update restaurant rating and `total_reviews` counter, update driver rating counter
- **Tables used:** `reviews` (post-MVP table — not in MVP schema yet), `restaurants`, `driver_profiles`
- **Dependencies:** `PrismaService`

---

### `SupportModule`
- **Controllers:** `GET /admin/support/tickets`, `GET /admin/support/tickets/:id`, `PATCH /admin/support/tickets/:id/status`, `POST /admin/support/tickets/:id/messages`
- **Services:** Ticket CRUD, message threading, status management
- **Tables used:** `support_tickets`, `support_messages`
- **Dependencies:** `PrismaService`

---

### `AdminModule`
- **Controllers:** All `/admin/*` endpoints — users, restaurants, drivers, orders, reports, platform settings, audit logs, commissions
- **Services:** Admin-scoped wrappers around other module services, plus reporting aggregation, platform settings CRUD
- **Tables used:** All tables (read access); `audit_logs`, `platform_settings` (write)
- **Dependencies:** Most other modules + `AuditService`

---

### `StorageModule`
- **Controllers:** None (service-only)
- **Services:** `uploadFile(buffer, mimeType, folder)`, `deleteFile(key)`, file type validation, size validation, CDN URL generation
- **Dependencies:** AWS SDK v3 (`@aws-sdk/client-s3`)

---

### `RealtimeModule`
- **Gateway:** `@WebSocketGateway()` — authenticates connections, manages rooms
- **Services:** `RealtimeService.emitToRoom(room, event, payload)`, `emitToUser(userId, event, payload)`, `emitToRestaurant(restaurantId, event, payload)`, `emitToDriver(driverId, event, payload)`
- **Dependencies:** `RedisService` (for `@socket.io/redis-adapter`)

---

## 4. Auth Architecture

### 4.1 Token Lifecycle

```
OTP Request ──────────────────────────────────────────────────────────►
                                                            SMS → Phone
OTP Verify ───────────────────────────────────────────────────────────►
                                              ┌─────────────────────────┐
                                              │  access_token (15 min)  │
                                              │  refresh_token (30 days)│
                                              └─────────────────────────┘
                                                       │
Every API Request ──── Authorization: Bearer <access_token> ──────────►
                                                       │
Access token expires ─── POST /auth/refresh ──────────►
                                              ┌─────────────────────────┐
                                              │  new access_token       │
                                              │  new refresh_token      │
                                              │  old refresh_token ✗    │  (rotation)
                                              └─────────────────────────┘
```

### 4.2 JWT Payload Structure

```typescript
// common/types/jwt-payload.type.ts
export interface JwtPayload {
  sub: string;           // userId (UUID)
  role: UserRole;        // e.g., 'CUSTOMER', 'DRIVER', 'RESTAURANT_OWNER'
  restaurantId?: string; // Only for RESTAURANT_OWNER and RESTAURANT_STAFF
  status: UserStatus;    // Checked on every request for suspension
  iat: number;           // Issued at
  exp: number;           // Expiry
}
```

The `restaurantId` is embedded in the JWT for restaurant staff to avoid a database lookup on every request to validate which restaurant they belong to.

### 4.3 OTP Flow

```typescript
// modules/auth/auth.service.ts

async requestOtp(phone: string): Promise<void> {
  // 1. Rate limit check (Redis — 5 requests/min/phone)
  await this.checkOtpRateLimit(phone);

  // 2. Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // 3. Hash with bcrypt (10 rounds)
  const codeHash = await bcrypt.hash(otp, 10);

  // 4. Delete any existing unused OTP for this phone
  await this.prisma.otpCode.deleteMany({
    where: { phone, isUsed: false }
  });

  // 5. Store new OTP with 5-minute expiry
  await this.prisma.otpCode.create({
    data: {
      phone,
      codeHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    }
  });

  // 6. Send OTP via SMS provider
  await this.smsService.send(phone, `Your verification code is: ${otp}`);
}

async verifyOtp(phone: string, code: string, role: UserRole): Promise<AuthResponse> {
  // 1. Find latest valid OTP
  const otpRecord = await this.prisma.otpCode.findFirst({
    where: { phone, isUsed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) throw new ApiError('AUTH_OTP_EXPIRED');

  // 2. Check attempt limit
  if (otpRecord.attempts >= 5) throw new ApiError('AUTH_OTP_MAX_ATTEMPTS');

  // 3. Increment attempts BEFORE comparing (prevents timing abuse)
  await this.prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { attempts: { increment: 1 } }
  });

  // 4. Compare hash
  const isValid = await bcrypt.compare(code, otpRecord.codeHash);
  if (!isValid) throw new ApiError('AUTH_INVALID_OTP');

  // 5. Mark as used
  await this.prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { isUsed: true }
  });

  // 6. Find or create user
  const user = await this.findOrCreateUser(phone, role);

  // 7. Issue tokens
  return this.issueTokens(user);
}
```

### 4.4 Refresh Token Rotation

```typescript
async refreshTokens(rawToken: string): Promise<AuthResponse> {
  // 1. Hash the incoming token
  const tokenHash = await bcrypt.hash(rawToken, 10);

  // 2. Find the stored token
  const stored = await this.prisma.refreshToken.findFirst({
    where: { tokenHash, isRevoked: false, expiresAt: { gt: new Date() } },
    include: { user: true },
  });

  if (!stored) throw new ApiError('AUTH_TOKEN_REVOKED');

  // 3. Revoke the old token immediately (rotation)
  await this.prisma.refreshToken.update({
    where: { id: stored.id },
    data: { isRevoked: true },
  });

  // 4. Issue new token pair
  return this.issueTokens(stored.user);
}
```

### 4.5 Guard Setup in `main.ts`

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global guards registered via APP_GUARD providers (order matters):
  // 1. JwtAuthGuard — runs first on every request
  // 2. RolesGuard — runs second, reads @Roles() decorator

  // Global pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // Global filters
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(
    new TransformResponseInterceptor(),
    new LoggingInterceptor(),
  );

  // Helmet
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [],
    credentials: true,
  });

  await app.listen(3000);
}
```

### 4.6 `@Public()` Decorator Pattern

```typescript
// common/decorators/public.decorator.ts
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// common/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()]
    );
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

---

## 5. Order Lifecycle Architecture

### 5.1 Status Machine

The status machine is the most critical piece of business logic. It lives in `order-status.machine.ts` and is the **single authority** for which transitions are allowed and who can trigger them.

```typescript
// modules/orders/order-status.machine.ts

type Actor = 'CUSTOMER' | 'RESTAURANT' | 'DRIVER' | 'SYSTEM' | 'ADMIN';

interface Transition {
  allowedActors: Actor[];
  emitsEvent: string;
  nextStatus: OrderStatus;
}

export const ORDER_STATUS_MACHINE: Record<OrderStatus, Partial<Record<OrderStatus, Transition>>> = {
  [OrderStatus.PENDING_RESTAURANT]: {
    [OrderStatus.ACCEPTED_BY_RESTAURANT]: {
      allowedActors: ['RESTAURANT'],
      emitsEvent: 'order:accepted',
      nextStatus: OrderStatus.ACCEPTED_BY_RESTAURANT,
    },
    [OrderStatus.REJECTED_BY_RESTAURANT]: {
      allowedActors: ['RESTAURANT', 'SYSTEM'],
      emitsEvent: 'order:rejected',
      nextStatus: OrderStatus.REJECTED_BY_RESTAURANT,
    },
    [OrderStatus.CANCELLED]: {
      allowedActors: ['CUSTOMER', 'ADMIN'],
      emitsEvent: 'order:cancelled',
      nextStatus: OrderStatus.CANCELLED,
    },
  },
  [OrderStatus.ACCEPTED_BY_RESTAURANT]: {
    [OrderStatus.PREPARING]: {
      allowedActors: ['RESTAURANT'],
      emitsEvent: 'order:preparing',
      nextStatus: OrderStatus.PREPARING,
    },
    [OrderStatus.CANCELLED]: {
      allowedActors: ['ADMIN'],
      emitsEvent: 'order:cancelled',
      nextStatus: OrderStatus.CANCELLED,
    },
  },
  [OrderStatus.PREPARING]: {
    [OrderStatus.LOOKING_FOR_DRIVER]: {
      allowedActors: ['RESTAURANT'],
      emitsEvent: 'driver:requested',
      nextStatus: OrderStatus.LOOKING_FOR_DRIVER,
    },
  },
  [OrderStatus.LOOKING_FOR_DRIVER]: {
    [OrderStatus.DRIVER_OFFERED]: {
      allowedActors: ['SYSTEM'],
      emitsEvent: 'driver:dispatching',
      nextStatus: OrderStatus.DRIVER_OFFERED,
    },
    [OrderStatus.FAILED]: {
      allowedActors: ['SYSTEM'],
      emitsEvent: 'order:failed',
      nextStatus: OrderStatus.FAILED,
    },
  },
  [OrderStatus.DRIVER_OFFERED]: {
    [OrderStatus.DRIVER_ASSIGNED]: {
      allowedActors: ['DRIVER', 'ADMIN'],
      emitsEvent: 'driver:assigned',
      nextStatus: OrderStatus.DRIVER_ASSIGNED,
    },
    [OrderStatus.LOOKING_FOR_DRIVER]: {
      allowedActors: ['SYSTEM'],
      emitsEvent: null,
      nextStatus: OrderStatus.LOOKING_FOR_DRIVER, // Retry next driver
    },
  },
  [OrderStatus.DRIVER_ASSIGNED]: {
    [OrderStatus.DRIVER_ARRIVED_RESTAURANT]: {
      allowedActors: ['DRIVER'],
      emitsEvent: 'order:arrived_restaurant',
      nextStatus: OrderStatus.DRIVER_ARRIVED_RESTAURANT,
    },
  },
  [OrderStatus.DRIVER_ARRIVED_RESTAURANT]: {
    [OrderStatus.PICKED_UP]: {
      allowedActors: ['DRIVER'],
      emitsEvent: 'order:picked_up',
      nextStatus: OrderStatus.PICKED_UP,
    },
  },
  [OrderStatus.PICKED_UP]: {
    [OrderStatus.ON_THE_WAY]: {
      allowedActors: ['SYSTEM'],
      emitsEvent: 'order:on_the_way',
      nextStatus: OrderStatus.ON_THE_WAY,
    },
  },
  [OrderStatus.ON_THE_WAY]: {
    [OrderStatus.ARRIVED_CUSTOMER]: {
      allowedActors: ['DRIVER'],
      emitsEvent: 'order:arrived_customer',
      nextStatus: OrderStatus.ARRIVED_CUSTOMER,
    },
  },
  [OrderStatus.ARRIVED_CUSTOMER]: {
    [OrderStatus.DELIVERED]: {
      allowedActors: ['DRIVER'],
      emitsEvent: 'order:delivered',
      nextStatus: OrderStatus.DELIVERED,
    },
  },
  // Terminal states — no further transitions
  [OrderStatus.DELIVERED]: {},
  [OrderStatus.CANCELLED]: {},
  [OrderStatus.FAILED]: {},
  [OrderStatus.REJECTED_BY_RESTAURANT]: {},
};

export function validateTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: Actor,
): Transition {
  const allowed = ORDER_STATUS_MACHINE[from]?.[to];
  if (!allowed) {
    throw new BadRequestException({
      code: 'ORDER_INVALID_STATUS',
      message: `Cannot transition from ${from} to ${to}`,
    });
  }
  if (!allowed.allowedActors.includes(actor)) {
    throw new ForbiddenException({
      code: 'FORBIDDEN_ROLE',
      message: `Actor ${actor} cannot perform this transition`,
    });
  }
  return allowed;
}
```

### 5.2 Status Transition Execution

```typescript
// modules/orders/orders.service.ts

async transitionStatus(
  orderId: string,
  toStatus: OrderStatus,
  actor: Actor,
  actorId: string | null,
  metadata?: { reason?: string; estimatedPrepMinutes?: number },
): Promise<Order> {
  return this.prisma.$transaction(async (tx) => {
    // 1. Fetch current order with pessimistic lock
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
    });

    // 2. Validate transition
    const transition = validateTransition(order.status, toStatus, actor);

    // 3. Update order status
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: toStatus,
        ...(metadata?.estimatedPrepMinutes && {
          estimatedPrepMinutes: metadata.estimatedPrepMinutes
        }),
      },
    });

    // 4. Append to status history (append-only)
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        actorId,
        actorType: actor,
        fromStatus: order.status,
        toStatus,
        note: metadata?.reason,
      },
    });

    // 5. Emit Socket.IO event (after transaction commits)
    if (transition.emitsEvent) {
      // Events are queued and emitted after tx commit
      this.pendingEvents.push({
        event: transition.emitsEvent,
        room: `order:${orderId}`,
        payload: this.buildEventPayload(transition.emitsEvent, updated, metadata),
      });
    }

    return updated;
  }).then(async (order) => {
    // 6. Emit queued events after transaction commits
    for (const event of this.pendingEvents) {
      this.realtimeService.emitToRoom(event.room, event.event, event.payload);
    }
    this.pendingEvents = [];
    return order;
  });
}
```

### 5.3 Order Creation Transaction

```typescript
// modules/orders/orders.service.ts

async createOrder(customerId: string, dto: CreateOrderDto): Promise<Order> {
  // 1. Idempotency check (Redis first, then DB)
  const existing = await this.redis.get(`idempotency:${dto.idempotencyKey}`);
  if (existing) return JSON.parse(existing);

  return this.prisma.$transaction(async (tx) => {
    // 2. Validate restaurant is open
    const restaurant = await tx.restaurant.findUniqueOrThrow({
      where: { id: dto.cartSnapshot.restaurantId, deletedAt: null }
    });
    if (!['OPEN', 'BUSY'].includes(restaurant.status)) {
      throw new BadRequestException({ code: 'RESTAURANT_CLOSED' });
    }

    // 3. Validate products and compute totals (always re-fetch from DB)
    const productIds = dto.cartSnapshot.items.map(i => i.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, deletedAt: null },
      include: { modifiers: { include: { options: true } } },
    });

    // Validate all products found and available
    for (const item of dto.cartSnapshot.items) {
      const product = products.find(p => p.id === item.productId);
      if (!product || !product.isAvailable) {
        throw new BadRequestException({ code: 'PRODUCT_UNAVAILABLE' });
      }
    }

    // 4. Compute subtotal using DB prices (not client prices)
    const { subtotal, itemsWithPrices } = this.computeOrderTotals(
      dto.cartSnapshot.items, products);

    // 5. Fetch delivery fee
    const deliveryFee = restaurant.deliveryFeeOverride
      ?? await this.getDefaultDeliveryFee();

    const total = subtotal + deliveryFee;

    // 6. Validate minimum order
    if (subtotal < restaurant.minOrderAmount) {
      throw new BadRequestException({ code: 'MIN_ORDER_NOT_MET' });
    }

    // 7. Fetch and snapshot delivery address
    const address = await tx.customerAddress.findFirstOrThrow({
      where: { id: dto.addressId, customerId, deletedAt: null }
    });

    // 8. Create order and all related records
    const order = await tx.order.create({
      data: {
        customerId,
        restaurantId: restaurant.id,
        addressId: address.id,
        addressSnapshot: {
          street: address.street, city: address.city,
          district: address.district, latitude: address.latitude,
          longitude: address.longitude,
        },
        status: OrderStatus.PENDING_RESTAURANT,
        subtotal, deliveryFee, total,
        paymentMethod: dto.paymentMethod,
        deliveryNotes: dto.deliveryNotes,
        idempotencyKey: dto.idempotencyKey,
        autoRejectAt: new Date(Date.now() + autoRejectSeconds * 1000),
        items: {
          create: itemsWithPrices.map(item => ({
            productId: item.productId,
            productNameSnapshot: item.name,
            unitPriceSnapshot: item.unitPrice,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
            notes: item.notes,
            modifiers: { create: item.selectedModifiers },
          })),
        },
        statusHistory: {
          create: {
            actorId: customerId,
            actorType: 'CUSTOMER',
            toStatus: OrderStatus.PENDING_RESTAURANT,
          }
        },
      },
    });

    // 9. Create payment record
    await tx.payment.create({
      data: { orderId: order.id, method: dto.paymentMethod,
              status: 'PENDING', amount: total }
    });

    // 10. Clear the customer's cart
    await tx.cart.deleteMany({ where: { customerId } });

    // 11. Store idempotency key in Redis (24h TTL)
    await this.redis.setex(
      `idempotency:${dto.idempotencyKey}`, 86400, JSON.stringify(order));

    return order;
  }).then(async (order) => {
    // 12. Emit events and notifications AFTER transaction commits
    await this.realtimeService.emitToRestaurant(
      order.restaurantId, 'order:new', this.buildNewOrderPayload(order));
    await this.notificationsService.send(
      order.restaurantId, 'ORDER_PLACED', 'New Order', '...', { orderId: order.id });
    return order;
  });
}
```

---

## 6. Dispatch Architecture

### 6.1 Flow Overview

```
Restaurant calls POST /orders/:id/request-driver
        │
        ▼
OrdersService.transitionStatus(LOOKING_FOR_DRIVER)
        │
        ▼
DispatchService.initiateDispatch(orderId)
        │
        ├── 1. Create delivery record (status: PENDING)
        ├── 2. Query online, available, verified drivers from DB
        ├── 3. Fetch each driver's location from Redis
        ├── 4. Compute distances (Haversine)
        ├── 5. Sort by distance (nearest first)
        └── 6. Call offerToNextDriver(candidates, deliveryId, attemptIndex=0)
                        │
                        ▼
        DispatchOfferService.offerToDriver(driverId, deliveryId)
                        │
                        ├── Create driver_offer record (status: PENDING)
                        ├── Update order to DRIVER_OFFERED
                        ├── Emit socket event: driver:requested
                        ├── Send FCM: delivery request
                        └── Set Redis timer: lock:offer:{offerId} TTL=timeoutSeconds
                                        │
                              ┌─────────┴─────────┐
                              │                   │
                        Driver accepts        Timeout expires
                              │                   │
                    acceptOffer(offerId)    handleTimeout(offerId)
                              │                   │
                    ┌─────────┘         ┌─────────┘
                    │                   │
              Redis NX lock         Mark offer TIMED_OUT
              acquired?             offerToNextDriver(index+1)
              /       \                  │
            YES        NO            More candidates?
             │          │            /          \
       Assign driver  Return        YES           NO
       (DRIVER_ASSIGNED) DELIVERY_ALREADY         Expand radius
       Emit events     _ASSIGNED                  or FAILED
```

### 6.2 Redis Atomic Lock for Offer Acceptance

```typescript
// modules/dispatch/dispatch-offer.service.ts

async acceptOffer(offerId: string, driverId: string): Promise<Delivery> {
  // 1. Fetch the offer
  const offer = await this.prisma.driverOffer.findUniqueOrThrow({
    where: { id: offerId },
    include: { delivery: true },
  });

  if (offer.driverId !== driverId) {
    throw new ForbiddenException({ code: 'FORBIDDEN_ROLE' });
  }
  if (offer.status !== 'PENDING') {
    throw new BadRequestException({ code: 'OFFER_EXPIRED' });
  }
  if (new Date() > offer.expiresAt) {
    throw new BadRequestException({ code: 'OFFER_EXPIRED' });
  }

  // 2. Acquire Redis lock (NX = set only if not exists)
  const lockKey = `lock:delivery:${offer.deliveryId}`;
  const lockValue = driverId;
  const lockTtl = 10; // seconds

  const acquired = await this.redis.set(
    lockKey, lockValue, 'EX', lockTtl, 'NX'
  );

  if (!acquired) {
    // Another driver was faster
    throw new ConflictException({ code: 'DELIVERY_ALREADY_ASSIGNED' });
  }

  try {
    // 3. Execute assignment in a transaction
    const delivery = await this.prisma.$transaction(async (tx) => {
      // Update driver offer
      await tx.driverOffer.update({
        where: { id: offerId },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });

      // Update delivery
      const delivery = await tx.delivery.update({
        where: { id: offer.deliveryId },
        data: { driverId, status: 'DRIVER_ASSIGNED', assignedAt: new Date() },
      });

      // Update order
      await tx.order.update({
        where: { id: offer.delivery.orderId },
        data: { status: OrderStatus.DRIVER_ASSIGNED },
      });

      // Update driver availability
      await tx.driverProfile.update({
        where: { userId: driverId },
        data: { availabilityStatus: 'ON_DELIVERY' },
      });

      // Log status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: offer.delivery.orderId,
          actorId: driverId,
          actorType: 'DRIVER',
          fromStatus: OrderStatus.DRIVER_OFFERED,
          toStatus: OrderStatus.DRIVER_ASSIGNED,
        },
      });

      return delivery;
    });

    // 4. Emit events and notifications
    await this.realtimeService.emitToRoom(
      `order:${offer.delivery.orderId}`,
      'driver:assigned',
      await this.buildDriverAssignedPayload(delivery),
    );

    return delivery;
  } finally {
    // 5. Always release the lock (even on error)
    await this.redis.del(lockKey);
  }
}
```

### 6.3 Dispatch Timeout Handling

The timeout is managed via a Redis key TTL + a scheduled polling job (MVP approach). The production approach uses BullMQ delayed jobs:

**MVP approach (interval-based):**

```typescript
// jobs/cleanup/dispatch-timeout.job.ts
@Injectable()
export class DispatchTimeoutJob implements OnModuleInit {
  private intervalId: NodeJS.Timeout;

  onModuleInit() {
    // Check every 5 seconds for expired offers
    this.intervalId = setInterval(() => this.checkExpiredOffers(), 5000);
  }

  private async checkExpiredOffers() {
    const expiredOffers = await this.prisma.driverOffer.findMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      include: { delivery: true },
    });

    for (const offer of expiredOffers) {
      await this.dispatchOfferService.handleTimeout(offer.id);
    }
  }
}
```

**Post-MVP approach (BullMQ):**

```typescript
// Queue a delayed job when offer is created:
await this.offerQueue.add(
  'offer-timeout',
  { offerId },
  { delay: timeoutSeconds * 1000 }
);

// Worker processes the timeout:
@Processor('offer-timeout')
export class OfferTimeoutProcessor {
  @Process()
  async handle(job: Job<{ offerId: string }>) {
    await this.dispatchOfferService.handleTimeout(job.data.offerId);
  }
}
```

### 6.4 Nearest Driver Query

```typescript
// modules/locations/locations.service.ts

async getOnlineDriversNearLocation(
  lat: number, lng: number, radiusKm: number
): Promise<DriverCandidate[]> {
  // 1. Get all online, verified, available drivers from DB
  const onlineDrivers = await this.prisma.driverProfile.findMany({
    where: {
      availabilityStatus: 'ONLINE',
      verificationStatus: 'APPROVED',
    },
    select: { id: true, userId: true },
  });

  // 2. For each driver, get their location from Redis
  const candidates: DriverCandidate[] = [];

  for (const driver of onlineDrivers) {
    const locationJson = await this.redis.get(
      `driver:${driver.userId}:location`
    );
    if (!locationJson) continue; // Driver location stale/expired

    const location = JSON.parse(locationJson);
    const distance = haversineDistance(
      { lat, lng },
      { lat: location.latitude, lng: location.longitude }
    );

    if (distance <= radiusKm) {
      candidates.push({ ...driver, location, distanceKm: distance });
    }
  }

  // 3. Sort by distance ascending
  return candidates.sort((a, b) => a.distanceKm - b.distanceKm);
}
```

---

## 7. Realtime Architecture

### 7.1 Socket.IO Gateway Setup

```typescript
// modules/realtime/realtime.gateway.ts

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket'],
  namespace: '/',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // 1. Extract and validate JWT token
      const token = client.handshake.query.token as string;
      const payload = this.jwtService.verify<JwtPayload>(token);

      // 2. Attach user context to socket
      client.data.userId = payload.sub;
      client.data.role = payload.role;
      client.data.restaurantId = payload.restaurantId;

      // 3. Join role-based rooms
      await client.join(`user:${payload.sub}`);

      if (payload.restaurantId) {
        await client.join(`restaurant:${payload.restaurantId}`);
      }

      if (payload.role === 'DRIVER') {
        await client.join(`driver:${payload.sub}`);
      }

      // 4. Send sync payload on reconnect
      await this.sendReconnectSync(client, payload);

      // 5. Track connection in Redis (for admin monitoring)
      await this.redisService.setex(
        `socket:connected:${payload.sub}`, 300, client.id
      );

    } catch (err) {
      // Invalid or expired token — disconnect
      client.emit('error', { code: 'AUTH_TOKEN_EXPIRED' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    if (client.data.userId) {
      await this.redisService.del(`socket:connected:${client.data.userId}`);
    }
  }

  @SubscribeMessage('join:order')
  async handleJoinOrder(client: Socket, payload: { orderId: string }) {
    // Validate the user is authorized for this order before joining
    const authorized = await this.isAuthorizedForOrder(
      client.data, payload.orderId);
    if (authorized) {
      await client.join(`order:${payload.orderId}`);
    }
  }

  @SubscribeMessage('driver:location_update')
  async handleLocationUpdate(client: Socket, data: LocationUpdateDto) {
    if (client.data.role !== 'DRIVER') return;

    // Rate limit: max 30 location events per minute per connection
    const key = `rate:location:${client.id}`;
    const count = await this.redisService.incr(key);
    if (count === 1) await this.redisService.expire(key, 60);
    if (count > 30) return; // Silently drop

    // Update Redis and DB
    await this.locationsService.setDriverLocation(client.data.userId, data);

    // Relay to active order room
    const activeDelivery = await this.getActiveDeliveryForDriver(
      client.data.userId);
    if (activeDelivery) {
      this.server.to(`order:${activeDelivery.orderId}`).emit(
        'driver:location_updated',
        {
          orderId: activeDelivery.orderId,
          driverId: client.data.userId,
          ...data,
          estimatedArrivalMinutes: this.estimateArrival(data, activeDelivery),
        }
      );
    }
  }
}
```

### 7.2 Redis Adapter for Horizontal Scaling

```typescript
// modules/realtime/realtime.module.ts
import { createAdapter } from '@socket.io/redis-adapter';

@Module({})
export class RealtimeModule {
  static forRoot(): DynamicModule {
    return {
      module: RealtimeModule,
      providers: [
        {
          provide: 'SOCKET_ADAPTER',
          useFactory: (redis: RedisService) => {
            const pubClient = redis.client.duplicate();
            const subClient = redis.client.duplicate();
            return createAdapter(pubClient, subClient);
          },
          inject: [RedisService],
        },
        RealtimeGateway,
        RealtimeService,
      ],
      exports: [RealtimeService],
    };
  }
}

// In main.ts — apply the adapter:
const adapter = app.get<ReturnType<typeof createAdapter>>('SOCKET_ADAPTER');
const ioServer = app.get(Server);
ioServer.adapter(adapter);
```

### 7.3 `RealtimeService` — Emission Helpers

```typescript
// modules/realtime/realtime.service.ts

@Injectable()
export class RealtimeService {
  constructor(@InjectSocketServer() private readonly server: Server) {}

  emitToRoom(room: string, event: string, payload: unknown): void {
    this.server.to(room).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.emitToRoom(`user:${userId}`, event, payload);
  }

  emitToRestaurant(restaurantId: string, event: string, payload: unknown): void {
    this.emitToRoom(`restaurant:${restaurantId}`, event, payload);
  }

  emitToDriver(driverId: string, event: string, payload: unknown): void {
    this.emitToRoom(`driver:${driverId}`, event, payload);
  }

  emitToOrderRoom(orderId: string, event: string, payload: unknown): void {
    this.emitToRoom(`order:${orderId}`, event, payload);
  }
}
```

### 7.4 Reconnect Sync

```typescript
private async sendReconnectSync(client: Socket, payload: JwtPayload) {
  // For customers: send active order state
  if (payload.role === 'CUSTOMER') {
    const activeOrder = await this.prisma.order.findFirst({
      where: {
        customerId: payload.sub,
        status: { notIn: ['DELIVERED', 'CANCELLED', 'FAILED', 'REJECTED_BY_RESTAURANT'] },
      },
      include: { delivery: true, statusHistory: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (activeOrder) {
      await client.join(`order:${activeOrder.id}`);
      const driverLocation = activeOrder.delivery?.driverId
        ? await this.locationsService.getDriverLocation(activeOrder.delivery.driverId)
        : null;

      client.emit('connection:restored', {
        activeOrders: [{
          orderId: activeOrder.id,
          status: activeOrder.status,
          lastStatusAt: activeOrder.statusHistory[0]?.createdAt,
          driverLocation,
        }],
      });
    }
  }

  // For restaurant staff: send pending order count
  if (payload.restaurantId) {
    const pendingCount = await this.prisma.order.count({
      where: { restaurantId: payload.restaurantId, status: 'PENDING_RESTAURANT' },
    });
    client.emit('connection:restored', { pendingOrderCount: pendingCount });
  }
}
```

---

## 8. Notification Architecture

### 8.1 `NotificationsService` — Dual Channel Strategy

```typescript
// modules/notifications/notifications.service.ts

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
    private readonly realtime: RealtimeService,
  ) {}

  async send(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    // 1. Save notification to DB
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, data, sentAt: new Date() },
    });

    // 2. Check if the user is currently connected via socket
    const isConnected = await this.isUserConnected(userId);

    // 3. Always send FCM for critical notification types
    const alwaysFcm: NotificationType[] = [
      'ORDER_PLACED',        // Restaurant must get this even if app is closed
      'DELIVERY_REQUEST',    // Driver must get this even if app is closed
      'ORDER_REJECTED',      // Customer needs this urgently
      'ORDER_DELIVERED',
      'ORDER_CANCELLED',
    ];

    if (!isConnected || alwaysFcm.includes(type)) {
      await this.fcm.sendToUser(userId, { title, body, data: {
        ...data,
        notificationId: notification.id,
        type,
      }});
    }
  }

  private async isUserConnected(userId: string): Promise<boolean> {
    const socketId = await this.redis.get(`socket:connected:${userId}`);
    return !!socketId;
  }
}
```

### 8.2 `FcmService` — Token Management and Sending

```typescript
// modules/notifications/fcm/fcm.service.ts

@Injectable()
export class FcmService {
  private readonly messaging: Messaging;

  constructor(private readonly prisma: PrismaService) {
    this.messaging = getMessaging(firebaseApp);
  }

  async sendToUser(userId: string, payload: FcmPayload): Promise<void> {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { id: true, fcmToken: true },
    });

    if (!tokens.length) return;

    const results = await this.messaging.sendEachForMulticast({
      tokens: tokens.map(t => t.fcmToken),
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'orders' },
      },
      apns: {
        payload: {
          aps: { sound: 'default', contentAvailable: true, badge: 1 },
        },
      },
    });

    // Cleanup stale tokens
    const staleTokenIds: string[] = [];
    results.responses.forEach((response, idx) => {
      if (!response.success &&
          response.error?.code === 'messaging/registration-token-not-registered') {
        staleTokenIds.push(tokens[idx].id);
      }
    });

    if (staleTokenIds.length) {
      await this.prisma.deviceToken.deleteMany({
        where: { id: { in: staleTokenIds } },
      });
    }
  }
}
```

---

## 9. Offline / Weak Internet Backend Support

### 9.1 Idempotency Key Middleware

```typescript
// modules/orders/orders.service.ts

async createOrder(customerId: string, dto: CreateOrderDto): Promise<Order> {
  const idempotencyKey = dto.idempotencyKey;
  const cacheKey = `idempotency:order:${idempotencyKey}`;

  // 1. Check Redis cache
  const cached = await this.redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached); // Return original response — no duplicate
  }

  // 2. Check DB (in case Redis was cleared)
  const existing = await this.prisma.order.findUnique({
    where: { idempotencyKey }
  });
  if (existing) {
    await this.redis.setex(cacheKey, 86400, JSON.stringify(existing));
    return existing;
  }

  // 3. Proceed with creation...
  const order = await this.executeOrderCreation(customerId, dto);

  // 4. Store result in Redis for 24 hours
  await this.redis.setex(cacheKey, 86400, JSON.stringify(order));

  return order;
}
```

### 9.2 Compact API Responses

All list API responses use field projection to minimize payload size. The pattern:

```typescript
// Always select only the fields the client needs
const orders = await this.prisma.order.findMany({
  where: { customerId, deletedAt: null },
  select: {
    id: true,
    status: true,
    total: true,
    createdAt: true,
    restaurant: {
      select: { id: true, name: true, logoUrl: true },
    },
    items: { select: { quantity: true } },  // Just the count
  },
  orderBy: { createdAt: 'desc' },
  skip: (page - 1) * limit,
  take: limit,
});
```

### 9.3 Last Known State Sync (connection:restored)

Documented in Section 7.4 above. Every reconnected socket receives the current state of all active entities immediately — preventing the client from being stuck in a stale state.

### 9.4 Retry-Safe Endpoint Design

All state-mutating endpoints are designed to be safe to retry:

| Principle | Implementation |
|-----------|---------------|
| Idempotency keys | Order creation, offer acceptance |
| Status pre-check | Every status transition checks current status before updating |
| Upsert over insert | Device token registration uses upsert |
| 409 on duplicate | Explicit conflict detection before unique constraint violation |

### 9.5 Heartbeat and Driver Presence

```typescript
// Driver location TTL in Redis: 2 minutes
// If no location update for 2 minutes, driver is considered unreachable
// The dispatch algorithm skips drivers with no Redis location key

// Passive offline detection:
async isDriverReachable(driverId: string): Promise<boolean> {
  const location = await this.redis.get(`driver:${driverId}:location`);
  return !!location; // TTL expiry means driver is offline/unreachable
}
```

---

## 10. Payment Architecture

### 10.1 MVP — Cash on Delivery

The MVP payment flow is simple: the system tracks the **expected** payment amount. The driver collects cash from the customer. The admin manually marks the payment as collected in the dashboard.

```
Order Created
     │
     ▼
Payment record created: { method: CASH_ON_DELIVERY, status: PENDING, amount: total }
     │
     ▼
Order Delivered (driver marks delivered)
     │
     ▼
Payment status: stays PENDING until admin confirms
     │
     ▼
Admin marks collected: { status: COLLECTED, collectedAt: now() }
     │
     ▼
Payment event logged: PENDING → COLLECTED
```

### 10.2 Commission Calculation

```typescript
// modules/delivery/delivery.service.ts

private async calculateEarnings(orderId: string, driverId: string): Promise<{
  grossAmount: number;
  commissionDeducted: number;
  netAmount: number;
}> {
  const order = await this.prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { deliveryFee: true, restaurantId: true },
  });

  // Find applicable commission rule (restaurant-specific first, then global)
  const commission = await this.prisma.commission.findFirst({
    where: {
      OR: [
        { restaurantId: order.restaurantId, isActive: true },
        { restaurantId: null, isActive: true },
      ],
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
    },
    orderBy: { restaurantId: 'asc' }, // Restaurant-specific first
  });

  const grossAmount = Number(order.deliveryFee);
  const commissionRate = commission?.rate ?? 15; // Default 15% from platform_settings
  const commissionDeducted = Number(
    (grossAmount * commissionRate / 100).toFixed(2)
  );
  const netAmount = Number((grossAmount - commissionDeducted).toFixed(2));

  return { grossAmount, commissionDeducted, netAmount };
}
```

### 10.3 Post-MVP — Online Card Payment Integration

When online payments are added (Stripe or local gateway), the flow extends:

```
Checkout → POST /orders (with paymentIntentId from client SDK)
     │
     ▼
Backend verifies payment intent with Stripe
     │
     ├── Verified → create order with status ACCEPTED_BY_PAYMENT
     └── Failed   → return PAYMENT_FAILED error
          │
          ▼
     Order lifecycle continues as normal
          │
          ▼
     On delivered → capture payment (if using hold)
     or
     On cancellation → issue refund via Stripe API
```

The `payments` table already has `gateway_reference` and `refunds` table already exists — no schema change needed for online payments.

---

## 11. Security Architecture

### 11.1 Validation Pipeline

```typescript
// main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,              // Strip unknown fields
  forbidNonWhitelisted: true,   // Throw on unknown fields
  transform: true,              // Auto-coerce types
  transformOptions: {
    enableImplicitConversion: true,
  },
  exceptionFactory: (errors) => new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: errors.reduce((acc, err) => ({
      ...acc,
      [err.property]: Object.values(err.constraints ?? {}),
    }), {}),
  }),
}));
```

### 11.2 Rate Limiting with Redis

```typescript
// app.module.ts
ThrottlerModule.forRootAsync({
  useFactory: (redis: RedisService) => ({
    throttlers: [{ ttl: 60000, limit: 200 }],
    storage: new ThrottlerStorageRedisService(redis.client),
  }),
  inject: [RedisService],
}),
```

Custom throttler for OTP:
```typescript
// common/decorators/throttle.decorators.ts
export const OtpThrottle = () =>
  Throttle({ default: { ttl: 60000, limit: 5 } });

export const LocationThrottle = () =>
  Throttle({ default: { ttl: 60000, limit: 120 } });
```

### 11.3 Security Headers (Helmet)

```typescript
// main.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Needed for some mobile WebView clients
}));
```

### 11.4 Password Hashing

```typescript
// common/utils/hash.ts
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Same utility used for OTP hashing and refresh token hashing
```

### 11.5 Restaurant-Order Authorization Guard

```typescript
// modules/restaurants/guards/restaurant-order.guard.ts

@Injectable()
export class RestaurantOrderGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    const orderId = request.params.orderId;

    if (!orderId) return true; // No order ID param — let other guards handle

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { restaurantId: true },
    });

    if (!order) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND' });

    // Restaurant staff can only manage their own restaurant's orders
    if (order.restaurantId !== user.restaurantId) {
      throw new ForbiddenException({ code: 'ORDER_NOT_OWNED' });
    }

    return true;
  }
}
```

### 11.6 Driver-Delivery Authorization Guard

```typescript
// modules/delivery/guards/driver-delivery.guard.ts

@Injectable()
export class DriverDeliveryGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    const deliveryId = request.params.deliveryId;

    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { driver: { select: { userId: true } } },
    });

    if (!delivery) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND' });

    // Only the assigned driver can update this delivery
    if (delivery.driver?.userId !== user.sub) {
      throw new ForbiddenException({ code: 'FORBIDDEN_ROLE' });
    }

    return true;
  }
}
```

### 11.7 Audit Log Service

```typescript
// modules/admin/audit/audit.service.ts

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    adminId: string;
    action: string;
    entityType: string;
    entityId?: string;
    beforeValue?: unknown;
    afterValue?: unknown;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    // Audit logs are INSERT-only — no update or delete
    await this.prisma.auditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        beforeValue: params.beforeValue as Prisma.InputJsonValue,
        afterValue: params.afterValue as Prisma.InputJsonValue,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }
}

// Audit Interceptor — auto-logs all admin write operations
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const isAdminRoute = request.path.startsWith('/api/v1/admin');
    const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);

    if (isAdminRoute && isWriteMethod) {
      return next.handle().pipe(
        tap(() => {
          this.auditService.log({
            adminId: request.user.sub,
            action: `${request.method} ${request.path}`,
            entityType: this.extractEntityType(request.path),
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });
        }),
      );
    }

    return next.handle();
  }
}
```

---

## 12. DevOps Notes

### 12.1 Docker (Development)

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: delivery_dev
      POSTGRES_USER: delivery
      POSTGRES_PASSWORD: devpassword
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U delivery']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

### 12.2 Environment Variables Reference

```bash
# .env.example

# App
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://admin.yourdomain.com

# Database
DATABASE_URL=postgresql://user:password@host:5432/delivery_prod?sslmode=require

# Redis
REDIS_URL=rediss://user:password@host:6380

# JWT (RS256 — generate with: openssl genrsa -out private.pem 2048)
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."
JWT_ACCESS_EXPIRES_IN=900        # 15 minutes in seconds
JWT_REFRESH_EXPIRES_IN=2592000   # 30 days in seconds

# Firebase Admin
FIREBASE_PROJECT_ID=delivery-prod
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@delivery-prod.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# AWS S3 / Cloudflare R2
AWS_S3_BUCKET=delivery-uploads
AWS_S3_REGION=auto
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_ENDPOINT=https://your-account.r2.cloudflarestorage.com  # R2 only
CDN_BASE_URL=https://cdn.yourdomain.com

# SMS Provider
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Seed (only used in development/staging)
SEED_ADMIN_EMAIL=admin@platform.com
SEED_ADMIN_PASSWORD=ChangeMe123!
```

### 12.3 PM2 Configuration

```javascript
// pm2.config.js
module.exports = {
  apps: [{
    name: 'delivery-api',
    script: 'dist/main.js',
    instances: 1,               // Scale to 2+ when adding Redis adapter
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    log_file: '/var/log/delivery-api/combined.log',
    error_file: '/var/log/delivery-api/error.log',
    time: true,                 // Prefix logs with timestamp
  }],
};
```

### 12.4 Nginx Configuration

```nginx
# /etc/nginx/sites-available/delivery-api
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Strict-Transport-Security "max-age=31536000" always;

    # Gzip compression
    gzip on;
    gzip_types application/json;
    gzip_min_length 1024;

    # REST API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Request-ID $request_id;
        proxy_read_timeout 30s;
        client_max_body_size 10M;
    }

    # Socket.IO proxy (WebSocket upgrade required)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;   # Keep WebSocket connections alive
        proxy_send_timeout 86400s;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3000;
        access_log off;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

### 12.5 Logging Strategy

```typescript
// main.ts — structured JSON logging with Pino
import * as pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: 'delivery-api', env: process.env.NODE_ENV },
});

// Every request log includes:
// { level, time, service, requestId, method, path, statusCode, durationMs, userId }

// Error logs include:
// { level: 'error', message, stack, requestId, userId, path }
```

Log levels:
- `error`: 5xx errors, critical failures, dispatch failures
- `warn`: 4xx errors, rate limit hits, invalid OTP attempts
- `info`: Request/response lifecycle, status transitions, FCM sent
- `debug`: SQL queries (Prisma debug mode), Redis operations (development only)

### 12.6 Monitoring (MVP)

For MVP, basic monitoring is achieved with:

| Tool | Purpose |
|------|---------|
| PM2 built-in metrics | CPU/memory/restart count visible via `pm2 monit` |
| `GET /health` endpoint | Returns 200 with DB and Redis status — used by uptime monitor |
| Uptime Robot (free) | Pings `/health` every 5 minutes; alerts via email/Telegram on downtime |
| PostgreSQL `pg_stat_activity` | Manual query to check active connections and slow queries |

Post-MVP: integrate Datadog, Grafana + Prometheus, or Sentry for error tracking.

### 12.7 Database Backup

```bash
#!/bin/bash
# /home/deploy/scripts/backup-db.sh — run by cron at 2:00 AM UTC

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/delivery_backup_${TIMESTAMP}.dump"

# Dump
pg_dump \
  --host=$DB_HOST \
  --username=$DB_USER \
  --dbname=$DB_NAME \
  --format=custom \
  --compress=9 \
  --file="$BACKUP_FILE"

# Upload to S3/R2
aws s3 cp "$BACKUP_FILE" \
  "s3://$BACKUP_BUCKET/backups/daily/delivery_backup_${TIMESTAMP}.dump" \
  --endpoint-url="$AWS_S3_ENDPOINT"

# Delete local file
rm "$BACKUP_FILE"

# Delete backups older than 14 days from S3
aws s3 ls "s3://$BACKUP_BUCKET/backups/daily/" \
  | awk '{print $4}' \
  | sort \
  | head -n -14 \
  | xargs -I{} aws s3 rm "s3://$BACKUP_BUCKET/backups/daily/{}" \
      --endpoint-url="$AWS_S3_ENDPOINT"

echo "Backup completed: ${TIMESTAMP}"
```

---

## 13. Testing Strategy

### 13.1 Unit Tests

**Target:** All service methods with mocked Prisma and Redis. No database required.

```typescript
// modules/orders/orders.service.spec.ts

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: DeepMockProxy<PrismaClient>;
  let redis: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
        { provide: RedisService, useValue: { get: jest.fn(), setex: jest.fn() } },
        { provide: RealtimeService, useValue: { emitToRoom: jest.fn() } },
        { provide: NotificationsService, useValue: { send: jest.fn() } },
      ],
    }).compile();

    service = module.get(OrdersService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
  });

  describe('createOrder', () => {
    it('should return existing order for duplicate idempotency key', async () => {
      const existingOrder = { id: 'order-uuid', status: 'PENDING_RESTAURANT' };
      redis.get.mockResolvedValue(JSON.stringify(existingOrder));

      const result = await service.createOrder('customer-uuid', {
        idempotencyKey: 'existing-key',
        // ... other fields
      });

      expect(result).toEqual(existingOrder);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('should throw RESTAURANT_CLOSED when restaurant is not open', async () => {
      redis.get.mockResolvedValue(null);
      prisma.restaurant.findUniqueOrThrow.mockResolvedValue({
        status: 'CLOSED', // ...
      });

      await expect(service.createOrder('customer-uuid', {
        idempotencyKey: 'new-key',
        cartSnapshot: { restaurantId: 'restaurant-uuid', items: [] },
        // ...
      })).rejects.toMatchObject({ message: expect.stringContaining('RESTAURANT_CLOSED') });
    });
  });
});
```

**Coverage targets:**
- `OrdersService`: 90%+ branch coverage on status machine
- `DispatchService`: 85%+ — all retry paths tested
- `AuthService`: 90%+ — all OTP and token paths
- `FcmService`: 80%+ — token cleanup path included

### 13.2 Integration Tests

**Target:** Real PostgreSQL test database (via `docker-compose.test.yml`). No mocks for DB.

```typescript
// modules/orders/orders.integration.spec.ts

describe('Order Creation Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Start test DB, run migrations, seed minimal data
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    // Clean test data between tests
    await prisma.$executeRaw`TRUNCATE orders, order_items, payments CASCADE`;
  });

  it('should create order and all related records in a single transaction', async () => {
    const { customer, restaurant, product, address } = await seedTestData(prisma);

    const response = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customer.token}`)
      .set('Idempotency-Key', uuid())
      .send({
        addressId: address.id,
        paymentMethod: 'CASH_ON_DELIVERY',
        cartSnapshot: {
          restaurantId: restaurant.id,
          items: [{ productId: product.id, quantity: 2, selectedModifiers: [] }],
        },
      })
      .expect(201);

    // Verify all records created
    const order = await prisma.order.findUnique({ where: { id: response.body.data.id } });
    expect(order?.status).toBe('PENDING_RESTAURANT');

    const items = await prisma.orderItem.findMany({ where: { orderId: order!.id } });
    expect(items).toHaveLength(1);
    expect(items[0].productNameSnapshot).toBe(product.name);

    const payment = await prisma.payment.findUnique({ where: { orderId: order!.id } });
    expect(payment?.status).toBe('PENDING');
  });
});
```

### 13.3 Dispatch Race Condition Test

```typescript
// modules/dispatch/dispatch.race.spec.ts

describe('Dispatch Race Condition', () => {
  it('should assign exactly one driver when two accept simultaneously', async () => {
    const { delivery, driver1, driver2 } = await setupDispatchScenario(prisma);

    // Fire two concurrent accept requests
    const [result1, result2] = await Promise.allSettled([
      dispatchOfferService.acceptOffer(delivery.offerId, driver1.id),
      dispatchOfferService.acceptOffer(delivery.offerId, driver2.id),
    ]);

    const successes = [result1, result2].filter(r => r.status === 'fulfilled');
    const failures = [result1, result2].filter(r => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    // Verify exactly one assignment in DB
    const updatedDelivery = await prisma.delivery.findUnique({
      where: { id: delivery.id }
    });
    expect(updatedDelivery?.driverId).not.toBeNull();
    expect(updatedDelivery?.status).toBe('DRIVER_ASSIGNED');

    // Verify only one driver is ON_DELIVERY
    const driverStatuses = await prisma.driverProfile.findMany({
      where: { id: { in: [driver1.id, driver2.id] } },
      select: { availabilityStatus: true },
    });
    const onDelivery = driverStatuses.filter(d => d.availabilityStatus === 'ON_DELIVERY');
    expect(onDelivery).toHaveLength(1);
  });

  it('should reliably enforce the lock under high concurrency', async () => {
    // Run the race scenario 50 times — must never result in two assignments
    for (let i = 0; i < 50; i++) {
      await runRaceScenario(); // Each run uses fresh data
    }
  });
});
```

### 13.4 E2E Tests

```typescript
// test/e2e/order-lifecycle.e2e.spec.ts

describe('Full Order Lifecycle E2E', () => {
  it('should complete a full order cycle from placement to delivery', async () => {
    // 1. Customer places order
    const orderRes = await customerAgent.post('/api/v1/orders').send(orderData);
    const orderId = orderRes.body.data.id;
    expect(orderRes.status).toBe(201);

    // 2. Restaurant accepts
    await restaurantAgent.post(`/api/v1/restaurants/me/orders/${orderId}/accept`);
    let order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe('ACCEPTED_BY_RESTAURANT');

    // 3. Restaurant marks preparing and requests driver
    await restaurantAgent.post(`/api/v1/restaurants/me/orders/${orderId}/preparing`);
    await restaurantAgent.post(`/api/v1/restaurants/me/orders/${orderId}/request-driver`);
    await waitForStatus(prisma, orderId, 'DRIVER_OFFERED', 5000);

    // 4. Driver accepts
    const offer = await prisma.driverOffer.findFirst({ where: { status: 'PENDING' } });
    await driverAgent.post(`/api/v1/drivers/me/offers/${offer!.id}/accept`);
    await waitForStatus(prisma, orderId, 'DRIVER_ASSIGNED', 3000);

    // 5. Driver completes delivery steps
    const delivery = await prisma.delivery.findUnique({ where: { orderId } });
    await driverAgent.post(`/api/v1/drivers/me/deliveries/${delivery!.id}/arrived-restaurant`);
    await driverAgent.post(`/api/v1/drivers/me/deliveries/${delivery!.id}/picked-up`);
    await driverAgent.post(`/api/v1/drivers/me/deliveries/${delivery!.id}/arrived-customer`);
    await driverAgent.post(`/api/v1/drivers/me/deliveries/${delivery!.id}/delivered`);

    // 6. Verify final state
    order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe('DELIVERED');

    const earnings = await prisma.driverEarning.findUnique({
      where: { deliveryId: delivery!.id }
    });
    expect(earnings?.netAmount).toBeGreaterThan(0);
  });
});
```

### 13.5 Testing Summary

| Test Type | Tool | Coverage Target | Runs in CI |
|-----------|------|----------------|-----------|
| Unit tests | Jest + jest-mock-extended | 85%+ on services | Yes |
| Integration tests | Jest + real PostgreSQL (Docker) | All API endpoints | Yes |
| E2E tests | Jest + supertest | Full order cycle | Yes (on main branch) |
| Race condition tests | Jest + parallel promises | Dispatch lock | Yes |
| Load tests | autocannon or k6 | 200 concurrent sockets | Manual before release |

---

## 14. Assumptions

- The backend runs as a single Node.js process for MVP. Horizontal scaling is available by increasing PM2 `instances` and ensuring the `@socket.io/redis-adapter` is configured (it is, from day one).
- All database queries go through Prisma. No raw SQL except for partial index creation in migration files and the occasional complex aggregation.
- The `PrismaService` uses a single shared `PrismaClient` instance for the entire application. Connection pool size defaults to `min: 2, max: 10` — adjust via `DATABASE_URL?connection_limit=10`.
- The `SmsService` is implemented with a real provider in production. In development, it logs the OTP to the console instead of sending an SMS. This is controlled by `NODE_ENV`.
- Prisma `$transaction` is used for all multi-table writes. The transaction isolation level is `READ COMMITTED` (PostgreSQL default) — sufficient for all operations given the Redis lock for dispatch.
- The `audit_logs` table is INSERT-only. No service method should call `prisma.auditLog.update()` or `prisma.auditLog.delete()`. This is enforced by code review.
- Background jobs (OTP cleanup, location history cleanup) are implemented as `setInterval` jobs for MVP. BullMQ is introduced post-MVP to make them reliable and observable.

---

## 15. Open Questions

| # | Question | Impact | Who to Ask |
|---|---------|--------|-----------|
| 1 | Should the backend emit Socket.IO events before or after the database transaction commits? | Risk of orphaned events if DB fails after emit | Engineering (design decision) |
| 2 | Should dispatch retry logic use `setInterval` (MVP) or BullMQ from day one? | BullMQ adds complexity but is more reliable | Engineering Lead |
| 3 | Should the `StorageModule` use AWS S3 or Cloudflare R2? Both are S3-compatible. | Cost, latency, egress pricing | DevOps / Finance |
| 4 | Should restaurant staff be allowed to cancel orders, or only admins post-acceptance? | Order lifecycle policy | Product Owner |
| 5 | Should the backend validate that the driver's current GPS location is within a reasonable distance of the restaurant before allowing `arrived-restaurant`? | Anti-fraud geofencing | Product / Security |
| 6 | Should Socket.IO connections use a dedicated namespace per app type (e.g., `/customer`, `/driver`)? | Namespace isolation vs. simplicity | Engineering |
| 7 | Should the OTP SMS use a local SMS provider for lower cost/latency, or Twilio globally? | Cost and reliability trade-off | Business / Operations |
| 8 | Should `platform_settings` changes be cached in Redis to avoid DB reads on every request? | Performance vs. consistency | Engineering |
| 9 | Is the 30-second driver offer timeout the correct default? Should it be configurable per restaurant or per zone? | Dispatch success rate | Operations / Product |
| 10 | Should the admin dashboard have a read-only replica of PostgreSQL for heavy reports to avoid impacting the main DB? | Reporting performance, DB load | DevOps / Engineering |

---

## ملخص الملف

**ما هدف هذا الملف؟**

هذا الملف هو **الخريطة المعمارية للباكند** — يُجيب على سؤال: كيف مبني السيرفر من الداخل؟

يحتوي على:
- هيكل مجلدات المشروع الكامل (`src/modules/`, `src/config/`, `src/common/`...)
- مسؤولية كل Module: ماذا يفعل AuthModule؟ ماذا يفعل DispatchModule؟
- كيف يعمل نظام الـ JWT والصلاحيات (Guards, Decorators)
- كيف تعمل دورة حياة الأوردر على مستوى الكود
- كيف يعمل نظام توزيع السائقين (Dispatch) والـ Redis Locking
- كيف يتصل Socket.IO بالـ NestJS وكيف تُبنى الـ Rooms
- كيف يُرسل FCM من الباكند
- استراتيجية الأمان وتعقيم المدخلات
- ملاحظات الـ DevOps والـ Testing

**من يقرأه؟** المهندس الباكند قبل ما يبدأ يكتب أي Module. هو الدليل التقني الداخلي للسيرفر.

**القاعدة:** أي Module جديد يُبنى يجب أن يتبع الهيكل والأنماط الموثقة في هذا الملف.
