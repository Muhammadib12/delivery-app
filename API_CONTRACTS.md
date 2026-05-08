# API_CONTRACTS.md — Complete API Specification

> **Project:** Local Delivery Platform  
> **Source of Truth:** `DELIVERY_APPS_REQUIREMENTS.md`, `ERD.md`, `PAGES_ERD.md`  
> **Date:** 2026-05-07  
> **Version:** 1.0  
> **Audience:** Backend Engineers, Mobile Engineers, Frontend Engineers

---

## Table of Contents

1. [API Overview](#1-api-overview)
2. [Auth APIs](#2-auth-apis)
3. [Customer APIs](#3-customer-apis)
4. [Restaurant APIs](#4-restaurant-apis)
5. [Driver APIs](#5-driver-apis)
6. [Order APIs](#6-order-apis)
7. [Admin APIs](#7-admin-apis)
8. [Realtime Socket.IO Events](#8-realtime-socketio-events)
9. [Error Code Catalog](#9-error-code-catalog)
10. [Assumptions](#10-assumptions)
11. [Open Questions](#11-open-questions)

---

## 1. API Overview

### 1.1 Base URL

```
Production:  https://api.yourdomain.com/api/v1
Staging:     https://staging-api.yourdomain.com/api/v1
Development: http://localhost:3000/api/v1
```

### 1.2 Versioning Strategy

All endpoints are prefixed with `/api/v1`. When a breaking change is required, a new version prefix `/api/v2` will be introduced and both versions will be maintained for a deprecation period. Non-breaking additions (new optional fields, new endpoints) do not require a version bump.

### 1.3 Authentication Strategy

All protected endpoints require a JWT access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

- **Access tokens** expire in **15 minutes**.
- **Refresh tokens** expire in **30 days** and are stored securely on-device.
- Token refresh is handled silently by the mobile app via `POST /api/v1/auth/refresh`.
- Socket.IO connections are authenticated by passing the access token as a query parameter on connection: `?token=<access_token>`.

### 1.4 Standard Error Response Format

Every error response follows this structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {}
  },
  "timestamp": "2026-05-07T10:00:00.000Z",
  "path": "/api/v1/orders"
}
```

### 1.5 Standard Success Response Format

```json
{
  "success": true,
  "data": { },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

`meta` is only included on paginated list endpoints. Non-paginated responses omit `meta`.

### 1.6 Pagination Convention

All list endpoints support cursor-based or offset-based pagination via query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number (1-indexed) |
| `limit` | integer | `20` | Items per page (max: 100) |
| `sortBy` | string | `createdAt` | Field to sort by |
| `sortOrder` | string | `desc` | `asc` or `desc` |

### 1.7 Filtering Convention

Filters are passed as query parameters. Boolean filters use `true`/`false`. Enum filters use exact enum values. Date filters use ISO 8601 format.

```
GET /api/v1/orders?status=DELIVERED&from=2026-05-01&to=2026-05-07&page=1&limit=20
```

### 1.8 Idempotency Strategy

For all state-mutating requests that could cause harm if duplicated (order creation, payment, status transitions), the client must include an `Idempotency-Key` header:

```
Idempotency-Key: <uuid-v4>
```

- The backend stores processed idempotency keys in Redis with a 24-hour TTL.
- Duplicate requests with the same key return the **original response** (HTTP 200) without re-executing the action.
- If a duplicate is detected while the original is still processing, the backend returns HTTP 409 with error code `IDEMPOTENCY_CONFLICT`.
- **Required on:** `POST /orders`, `POST /orders/:id/accept`, `POST /orders/:id/reject`, `POST /drivers/me/offers/:id/accept`, `POST /auth/otp/verify`.

### 1.9 Rate Limiting

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| Global (all endpoints) | 200 req | per minute per IP |
| `POST /auth/otp/request` | 5 req | per minute per phone |
| `POST /auth/otp/verify` | 5 req | per minute per phone |
| `POST /orders` | 10 req | per hour per user |
| `PATCH /drivers/me/location` | 120 req | per minute per driver |

Rate limit headers are returned on every response:
```
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 187
X-RateLimit-Reset: 1746612060
```

When exceeded: HTTP 429 with error code `RATE_LIMIT_EXCEEDED`.

### 1.10 Request Validation

- All request bodies are validated using NestJS `ValidationPipe` with `class-validator`.
- Unknown fields are stripped (`whitelist: true`).
- Invalid types return HTTP 422 with error code `VALIDATION_ERROR` and per-field details.

### 1.11 Content Type

All requests with a body must include:
```
Content-Type: application/json
```

File upload endpoints use `multipart/form-data`.

---

## 2. Auth APIs

Base path: `/api/v1/auth`

---

### 2.1 Request OTP

Sends a one-time password to the provided phone number. Works for both new and existing users.

```
POST /api/v1/auth/otp/request
```

**Auth Required:** No  
**Allowed Roles:** Public  
**Idempotency-Key:** Not required

**Request Body:**
```json
{
  "phone": "+9647001234567"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `phone` | string | Yes | E.164 format, 7–15 digits |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "message": "OTP sent successfully",
    "expiresInSeconds": 300
  }
}
```

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 422 | `VALIDATION_ERROR` | Invalid phone format |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many OTP requests for this phone |

**Notes:** The OTP is 6 digits and expires in 5 minutes. The actual SMS delivery is handled by a configured SMS provider (Twilio or local gateway). The backend stores a hashed OTP in `otp_codes`.

---

### 2.2 Verify OTP

Verifies the OTP and returns JWT tokens. Creates a new user account if the phone number is not yet registered.

```
POST /api/v1/auth/otp/verify
```

**Auth Required:** No  
**Allowed Roles:** Public  
**Idempotency-Key:** Required

**Request Body:**
```json
{
  "phone": "+9647001234567",
  "code": "482910",
  "role": "CUSTOMER"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `phone` | string | Yes | E.164 format |
| `code` | string | Yes | 6 digits |
| `role` | enum | Yes | `CUSTOMER`, `DRIVER` (restaurant staff use email login) |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2g...",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "phone": "+9647001234567",
      "role": "CUSTOMER",
      "status": "ACTIVE",
      "isNewUser": true
    }
  }
}
```

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | `AUTH_INVALID_OTP` | Code is wrong |
| 400 | `AUTH_OTP_EXPIRED` | Code has expired |
| 400 | `AUTH_OTP_MAX_ATTEMPTS` | Too many failed attempts — cooldown enforced |
| 422 | `VALIDATION_ERROR` | Missing or invalid fields |
| 403 | `USER_SUSPENDED` | Account is suspended or banned |

---

### 2.3 Login with Email/Password

Used by restaurant staff and admins who prefer email-based login.

```
POST /api/v1/auth/login
```

**Auth Required:** No  
**Allowed Roles:** Public

**Request Body:**
```json
{
  "email": "owner@restaurant.com",
  "password": "SecurePassword123"
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2g...",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "email": "owner@restaurant.com",
      "role": "RESTAURANT_OWNER",
      "status": "ACTIVE",
      "restaurantId": "uuid"
    }
  }
}
```

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 401 | `AUTH_INVALID_CREDENTIALS` | Wrong email or password |
| 403 | `USER_SUSPENDED` | Account is suspended |
| 422 | `VALIDATION_ERROR` | Missing fields |

---

### 2.4 Refresh Token

Silently obtain a new access token using a valid refresh token.

```
POST /api/v1/auth/refresh
```

**Auth Required:** No  
**Allowed Roles:** Public

**Request Body:**
```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2g..."
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiJ9...",
    "refreshToken": "bmV3UmVmcmVzaFRva2Vu...",
    "expiresIn": 900
  }
}
```

**Notes:** Token rotation — the old refresh token is invalidated, and a new one is issued. If the old token is already revoked (logout or suspicious reuse), returns 401 `AUTH_TOKEN_REVOKED`.

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 401 | `AUTH_TOKEN_EXPIRED` | Refresh token is expired |
| 401 | `AUTH_TOKEN_REVOKED` | Token was already used or revoked |
| 422 | `VALIDATION_ERROR` | Missing token |

---

### 2.5 Logout

Revokes the current refresh token and invalidates the session.

```
POST /api/v1/auth/logout
```

**Auth Required:** Yes  
**Allowed Roles:** All authenticated roles

**Request Body:**
```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2g..."
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

### 2.6 Get Current User (Token Validation)

Returns the authenticated user's profile. Used by apps on startup to validate the stored token.

```
GET /api/v1/auth/me
```

**Auth Required:** Yes  
**Allowed Roles:** All

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "phone": "+9647001234567",
    "email": null,
    "role": "CUSTOMER",
    "status": "ACTIVE",
    "profile": {
      "displayName": "Ahmed Hassan",
      "profilePhotoUrl": "https://cdn.domain.com/photos/uuid.jpg"
    }
  }
}
```

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 401 | `AUTH_TOKEN_EXPIRED` | Access token expired |
| 403 | `USER_SUSPENDED` | Account suspended after token was issued |

---

### 2.7 Register FCM Device Token

Registers or updates the device's FCM push notification token. Called after every login and on app foreground if the token has changed.

```
POST /api/v1/auth/device-token
```

**Auth Required:** Yes  
**Allowed Roles:** All

**Request Body:**
```json
{
  "fcmToken": "fXxY9zABC...",
  "platform": "android"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `fcmToken` | string | Yes | Non-empty string |
| `platform` | enum | Yes | `android`, `ios` |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "message": "Device token registered"
  }
}
```

---

## 3. Customer APIs

Base path: `/api/v1/customers`  
**Auth Required:** Yes (all endpoints)  
**Allowed Roles:** `CUSTOMER`

---

### 3.1 Get Customer Profile

```
GET /api/v1/customers/profile
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "displayName": "Ahmed Hassan",
    "profilePhotoUrl": "https://cdn.domain.com/...",
    "phone": "+9647001234567",
    "email": null,
    "defaultAddressId": "uuid",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

### 3.2 Update Customer Profile

```
PUT /api/v1/customers/profile
```

**Request Body:**
```json
{
  "displayName": "Ahmed Hassan",
  "email": "ahmed@example.com"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `displayName` | string | No | 2–60 characters |
| `email` | string | No | Valid email format |

**Response `200 OK`:** Updated profile object (same as GET).

---

### 3.3 List Addresses

```
GET /api/v1/customers/addresses
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "label": "Home",
      "street": "Al-Rasheed Street, Building 14",
      "city": "Baghdad",
      "district": "Karrada",
      "latitude": 33.3152,
      "longitude": 44.3661,
      "isDefault": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### 3.4 Add Address

```
POST /api/v1/customers/addresses
```

**Request Body:**
```json
{
  "label": "Home",
  "street": "Al-Rasheed Street, Building 14",
  "city": "Baghdad",
  "district": "Karrada",
  "latitude": 33.3152,
  "longitude": 44.3661,
  "isDefault": true
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `label` | string | Yes | Max 30 chars |
| `street` | string | Yes | Max 200 chars |
| `city` | string | Yes | Max 100 chars |
| `district` | string | No | Max 100 chars |
| `latitude` | float | Yes | -90 to 90 |
| `longitude` | float | Yes | -180 to 180 |
| `isDefault` | boolean | No | Defaults to false |

**Response `201 Created`:** The created address object.

---

### 3.5 Update Address

```
PUT /api/v1/customers/addresses/:addressId
```

**Request Body:** Same fields as Add Address (all optional).  
**Response `200 OK`:** Updated address object.

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 404 | `RESOURCE_NOT_FOUND` | Address not found or not owned by customer |

---

### 3.6 Delete Address

```
DELETE /api/v1/customers/addresses/:addressId
```

**Response `200 OK`:**
```json
{ "success": true, "data": { "message": "Address deleted" } }
```

**Notes:** Cannot delete the default address if it is the only address. Cannot delete an address referenced by an active order (soft-delete safe — order has address snapshot).

---

### 3.7 Set Default Address

```
PATCH /api/v1/customers/addresses/:addressId/default
```

**Response `200 OK`:** Updated address object with `isDefault: true`.

---

### 3.8 List Restaurants

```
GET /api/v1/restaurants
```

**Auth Required:** No (public endpoint)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `categoryId` | uuid | Filter by restaurant category |
| `status` | enum | `OPEN`, `BUSY`, `CLOSED` |
| `lat` | float | Customer latitude (for distance sort) |
| `lng` | float | Customer longitude (for distance sort) |
| `sort` | string | `distance`, `rating`, `name` |
| `featured` | boolean | Filter promoted restaurants |
| `page` | integer | Page number |
| `limit` | integer | Items per page |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Al-Mansour Grill",
      "description": "Traditional Iraqi grilled meats",
      "logoUrl": "https://cdn.domain.com/...",
      "bannerUrl": "https://cdn.domain.com/...",
      "category": { "id": "uuid", "name": "Grills" },
      "status": "OPEN",
      "rating": 4.7,
      "totalReviews": 234,
      "estimatedDeliveryMinutes": 35,
      "deliveryFee": 2000,
      "minOrderAmount": 5000,
      "distanceKm": 1.4,
      "isOpen": true
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 87, "totalPages": 5 }
}
```

---

### 3.9 Get Restaurant Categories

```
GET /api/v1/restaurant-categories
```

**Auth Required:** No

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "Fast Food", "iconUrl": "...", "sortOrder": 1 },
    { "id": "uuid", "name": "Grills", "iconUrl": "...", "sortOrder": 2 }
  ]
}
```

---

### 3.10 Get Restaurant Details

```
GET /api/v1/restaurants/:restaurantId
```

**Auth Required:** No

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Al-Mansour Grill",
    "description": "Traditional Iraqi grilled meats",
    "logoUrl": "https://cdn.domain.com/...",
    "bannerUrl": "https://cdn.domain.com/...",
    "category": { "id": "uuid", "name": "Grills" },
    "status": "OPEN",
    "rating": 4.7,
    "totalReviews": 234,
    "address": "Al-Mansour District, Baghdad",
    "latitude": 33.3180,
    "longitude": 44.3690,
    "estimatedDeliveryMinutes": 35,
    "deliveryFee": 2000,
    "minOrderAmount": 5000,
    "workingHours": [
      { "dayOfWeek": 0, "openTime": "08:00", "closeTime": "23:00", "isClosed": false },
      { "dayOfWeek": 6, "openTime": "10:00", "closeTime": "22:00", "isClosed": false }
    ],
    "isCurrentlyOpen": true
  }
}
```

---

### 3.11 Get Restaurant Menu

```
GET /api/v1/restaurants/:restaurantId/menu
```

**Auth Required:** No

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "restaurantId": "uuid",
    "categories": [
      {
        "id": "uuid",
        "name": "Grills",
        "sortOrder": 1,
        "products": [
          {
            "id": "uuid",
            "name": "Mixed Grill",
            "description": "A selection of grilled meats",
            "price": 15000,
            "isAvailable": true,
            "sortOrder": 1,
            "images": [
              { "url": "https://cdn.domain.com/...", "isPrimary": true }
            ],
            "modifiers": [
              {
                "id": "uuid",
                "name": "Choose Size",
                "isRequired": true,
                "minSelections": 1,
                "maxSelections": 1,
                "options": [
                  { "id": "uuid", "name": "Small", "priceAdjustment": 0, "isDefault": true },
                  { "id": "uuid", "name": "Large", "priceAdjustment": 5000, "isDefault": false }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

---

### 3.12 Search Restaurants and Products

```
GET /api/v1/search?q=burger&type=restaurant,product&lat=33.31&lng=44.36
```

**Auth Required:** No

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search keyword (min 2 chars) |
| `type` | string | `restaurant`, `product`, or `restaurant,product` |
| `lat` | float | For distance sorting |
| `lng` | float | For distance sorting |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "restaurants": [
      { "id": "uuid", "name": "Burger Palace", "logoUrl": "...", "rating": 4.2, "status": "OPEN" }
    ],
    "products": [
      {
        "id": "uuid",
        "name": "Cheese Burger",
        "price": 8000,
        "isAvailable": true,
        "restaurant": { "id": "uuid", "name": "Burger Palace", "status": "OPEN" }
      }
    ]
  }
}
```

---

### 3.13 Get Cart

```
GET /api/v1/customers/cart
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "restaurantId": "uuid",
    "restaurantName": "Al-Mansour Grill",
    "items": [
      {
        "id": "uuid",
        "productId": "uuid",
        "productName": "Mixed Grill",
        "unitPrice": 15000,
        "quantity": 2,
        "selectedModifiers": [
          { "modifierId": "uuid", "modifierName": "Choose Size", "optionId": "uuid", "optionName": "Large", "priceAdjustment": 5000 }
        ],
        "notes": "Extra spicy please",
        "lineTotal": 40000
      }
    ],
    "subtotal": 40000,
    "updatedAt": "2026-05-07T10:00:00.000Z"
  }
}
```

---

### 3.14 Add Item to Cart

```
POST /api/v1/customers/cart/items
```

**Request Body:**
```json
{
  "restaurantId": "uuid",
  "productId": "uuid",
  "quantity": 2,
  "selectedModifiers": [
    { "modifierId": "uuid", "optionId": "uuid" }
  ],
  "notes": "Extra spicy please"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `restaurantId` | uuid | Yes | If different from current cart restaurant, returns `CART_RESTAURANT_CONFLICT` |
| `productId` | uuid | Yes | Must be available |
| `quantity` | integer | Yes | 1–99 |
| `selectedModifiers` | array | No | Required only if modifier `isRequired = true` |
| `notes` | string | No | Max 200 chars |

**Response `200 OK`:** Full cart object (same as Get Cart).

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 409 | `CART_RESTAURANT_CONFLICT` | Item belongs to different restaurant than existing cart |
| 400 | `PRODUCT_UNAVAILABLE` | Product is currently unavailable |
| 400 | `RESTAURANT_CLOSED` | Restaurant is not accepting orders |
| 422 | `VALIDATION_ERROR` | Missing required modifier selection |

---

### 3.15 Update Cart Item

```
PATCH /api/v1/customers/cart/items/:itemId
```

**Request Body:**
```json
{
  "quantity": 3,
  "notes": "No onions"
}
```

**Response `200 OK`:** Full cart object.

---

### 3.16 Remove Cart Item

```
DELETE /api/v1/customers/cart/items/:itemId
```

**Response `200 OK`:** Full cart object (updated).

---

### 3.17 Clear Cart

```
DELETE /api/v1/customers/cart
```

**Response `200 OK`:**
```json
{ "success": true, "data": { "message": "Cart cleared" } }
```

---

### 3.18 Create Order

This is the most critical endpoint. It validates the cart, creates the order, and triggers the restaurant notification.

```
POST /api/v1/orders
```

**Auth Required:** Yes  
**Allowed Roles:** `CUSTOMER`  
**Idempotency-Key:** Required

**Request Body:**
```json
{
  "addressId": "uuid",
  "paymentMethod": "CASH_ON_DELIVERY",
  "deliveryNotes": "Call on arrival, gate code 1234",
  "cartSnapshot": {
    "restaurantId": "uuid",
    "items": [
      {
        "productId": "uuid",
        "quantity": 2,
        "selectedModifiers": [
          { "modifierId": "uuid", "optionId": "uuid" }
        ],
        "notes": "Extra spicy"
      }
    ]
  }
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `addressId` | uuid | Yes | Must belong to the customer |
| `paymentMethod` | enum | Yes | `CASH_ON_DELIVERY` (MVP) |
| `deliveryNotes` | string | No | Max 300 chars |
| `cartSnapshot` | object | Yes | Sent from client to allow server-side validation |

**Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "PENDING_RESTAURANT",
    "restaurant": {
      "id": "uuid",
      "name": "Al-Mansour Grill",
      "logoUrl": "https://cdn.domain.com/..."
    },
    "items": [
      {
        "productId": "uuid",
        "productName": "Mixed Grill",
        "unitPrice": 15000,
        "quantity": 2,
        "lineTotal": 40000
      }
    ],
    "address": {
      "street": "Al-Rasheed Street, Building 14",
      "city": "Baghdad",
      "latitude": 33.3152,
      "longitude": 44.3661
    },
    "subtotal": 40000,
    "deliveryFee": 2000,
    "total": 42000,
    "paymentMethod": "CASH_ON_DELIVERY",
    "deliveryNotes": "Call on arrival, gate code 1234",
    "createdAt": "2026-05-07T10:00:00.000Z"
  }
}
```

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | `RESTAURANT_CLOSED` | Restaurant is not OPEN or BUSY |
| 400 | `PRODUCT_UNAVAILABLE` | One or more products are unavailable |
| 400 | `MIN_ORDER_NOT_MET` | Subtotal is below restaurant minimum |
| 400 | `CART_EMPTY` | No items provided |
| 404 | `RESOURCE_NOT_FOUND` | Address not found |
| 409 | `IDEMPOTENCY_CONFLICT` | Duplicate request in processing |
| 422 | `VALIDATION_ERROR` | Missing or invalid fields |

---

### 3.19 Get Active Order

```
GET /api/v1/orders/active
```

**Response `200 OK`:** Full order object including current `status`, `delivery`, and assigned `driver` info (if any).  
**Response `404`:** `RESOURCE_NOT_FOUND` if no active order.

---

### 3.20 Get Order Tracking Detail

```
GET /api/v1/orders/:orderId/tracking
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "orderId": "uuid",
    "status": "ON_THE_WAY",
    "statusHistory": [
      { "status": "PENDING_RESTAURANT", "timestamp": "2026-05-07T10:00:00.000Z" },
      { "status": "ACCEPTED_BY_RESTAURANT", "timestamp": "2026-05-07T10:02:00.000Z" },
      { "status": "PREPARING", "timestamp": "2026-05-07T10:03:00.000Z" },
      { "status": "DRIVER_ASSIGNED", "timestamp": "2026-05-07T10:15:00.000Z" },
      { "status": "PICKED_UP", "timestamp": "2026-05-07T10:22:00.000Z" },
      { "status": "ON_THE_WAY", "timestamp": "2026-05-07T10:22:00.000Z" }
    ],
    "driver": {
      "id": "uuid",
      "displayName": "Mohammed Ali",
      "phone": "+9647001111111",
      "vehicleType": "Motorcycle",
      "vehiclePlate": "BGH 4521",
      "rating": 4.8,
      "currentLocation": {
        "latitude": 33.3200,
        "longitude": 44.3700,
        "recordedAt": "2026-05-07T10:25:00.000Z"
      }
    },
    "estimatedArrivalMinutes": 8
  }
}
```

---

### 3.21 Get Order History

```
GET /api/v1/orders?page=1&limit=20&status=DELIVERED
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "status": "DELIVERED",
      "restaurant": { "id": "uuid", "name": "Al-Mansour Grill", "logoUrl": "..." },
      "total": 42000,
      "itemCount": 2,
      "createdAt": "2026-05-07T10:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
}
```

---

### 3.22 Get Order Detail

```
GET /api/v1/orders/:orderId
```

**Response `200 OK`:** Full order object including items, modifiers, status history, payment info, delivery info.

---

### 3.23 Cancel Order

```
POST /api/v1/orders/:orderId/cancel
```

**Idempotency-Key:** Required

**Request Body:**
```json
{
  "reason": "I changed my mind"
}
```

**Notes:** Cancellation is only allowed when `status = PENDING_RESTAURANT`. After the restaurant accepts, the customer cannot cancel via app — must contact support.

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | `ORDER_INVALID_STATUS` | Order is past the cancellable status |
| 404 | `RESOURCE_NOT_FOUND` | Order not found |

---

### 3.24 Submit Review

```
POST /api/v1/reviews
```

**Request Body:**
```json
{
  "orderId": "uuid",
  "restaurantRating": 4,
  "restaurantComment": "Great food, but a bit slow",
  "driverRating": 5,
  "driverComment": "Very professional"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `orderId` | uuid | Yes | Must be DELIVERED order belonging to customer |
| `restaurantRating` | integer | Yes | 1–5 |
| `restaurantComment` | string | No | Max 500 chars |
| `driverRating` | integer | No | 1–5 |
| `driverComment` | string | No | Max 500 chars |

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | `ORDER_NOT_DELIVERED` | Order is not in DELIVERED status |
| 409 | `REVIEW_ALREADY_SUBMITTED` | Review for this order already exists |

---

### 3.25 List Notifications

```
GET /api/v1/notifications?isRead=false&page=1&limit=30
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "ORDER_ACCEPTED",
      "title": "Order Accepted",
      "body": "Al-Mansour Grill has accepted your order",
      "data": { "orderId": "uuid" },
      "isRead": false,
      "createdAt": "2026-05-07T10:02:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 30, "total": 12, "totalPages": 1 }
}
```

---

### 3.26 Mark Notification as Read

```
PATCH /api/v1/notifications/:notificationId/read
```

**Response `200 OK`:** `{ "success": true, "data": { "message": "Marked as read" } }`

---

### 3.27 Mark All Notifications as Read

```
PATCH /api/v1/notifications/read-all
```

**Response `200 OK`:** `{ "success": true, "data": { "count": 5 } }`

---

## 4. Restaurant APIs

Base path: `/api/v1/restaurants/me`  
**Auth Required:** Yes  
**Allowed Roles:** `RESTAURANT_OWNER`, `RESTAURANT_STAFF`

---

### 4.1 Get Restaurant Profile

```
GET /api/v1/restaurants/me
```

**Response `200 OK`:** Full restaurant object with working hours, category, stats.

---

### 4.2 Update Restaurant Profile

```
PUT /api/v1/restaurants/me
```

**Allowed Roles:** `RESTAURANT_OWNER` only

**Request Body:**
```json
{
  "name": "Al-Mansour Grill",
  "description": "Traditional Iraqi grilled meats",
  "address": "Al-Mansour District, Baghdad",
  "latitude": 33.3180,
  "longitude": 44.3690,
  "minOrderAmount": 5000,
  "deliveryFeeOverride": 2000,
  "avgPrepTimeMinutes": 30
}
```

---

### 4.3 Update Restaurant Status

```
PATCH /api/v1/restaurants/me/status
```

**Request Body:**
```json
{
  "status": "BUSY"
}
```

| Status | Allowed by |
|--------|-----------|
| `OPEN` | `RESTAURANT_OWNER`, `RESTAURANT_STAFF` |
| `CLOSED` | `RESTAURANT_OWNER`, `RESTAURANT_STAFF` |
| `BUSY` | `RESTAURANT_OWNER`, `RESTAURANT_STAFF` |
| `TEMPORARILY_CLOSED` | `RESTAURANT_OWNER` only |

---

### 4.4 Get Dashboard Summary

```
GET /api/v1/restaurants/me/dashboard
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "todayOrderCount": 24,
    "todayRevenue": 720000,
    "pendingOrderCount": 3,
    "activeOrderCount": 5,
    "restaurantStatus": "OPEN"
  }
}
```

---

### 4.5 List Orders

```
GET /api/v1/restaurants/me/orders?status=PENDING_RESTAURANT,ACCEPTED_BY_RESTAURANT&page=1
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string (comma-separated) | Filter by one or more order statuses |
| `from` | date | Start date filter |
| `to` | date | End date filter |
| `page` | integer | Page number |
| `limit` | integer | Items per page |

**Response `200 OK`:** Paginated list of order summaries.

---

### 4.6 Get Order Detail (Restaurant)

```
GET /api/v1/restaurants/me/orders/:orderId
```

**Response `200 OK`:** Full order including items, modifiers, customer first name, delivery address district, payment method.

**Note:** Customer's full phone number is NOT exposed. Only first name and delivery district are shown for privacy.

---

### 4.7 Accept Order

```
POST /api/v1/restaurants/me/orders/:orderId/accept
```

**Idempotency-Key:** Required  
**Request Body:**
```json
{
  "estimatedPrepMinutes": 20
}
```

**Response `200 OK`:** Updated order with `status: "ACCEPTED_BY_RESTAURANT"`.

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | `ORDER_INVALID_STATUS` | Order is not in `PENDING_RESTAURANT` |
| 403 | `FORBIDDEN_ROLE` | Staff without accept permission |

---

### 4.8 Reject Order

```
POST /api/v1/restaurants/me/orders/:orderId/reject
```

**Idempotency-Key:** Required  
**Request Body:**
```json
{
  "reason": "OUT_OF_STOCK"
}
```

| Reason Enum | Description |
|-------------|-------------|
| `OUT_OF_STOCK` | Items not available |
| `TOO_BUSY` | Restaurant cannot handle more orders |
| `CLOSING_SOON` | Restaurant closing soon |
| `OTHER` | Other reason |

**Response `200 OK`:** Updated order with `status: "REJECTED_BY_RESTAURANT"`.

---

### 4.9 Mark Order Preparing

```
POST /api/v1/restaurants/me/orders/:orderId/preparing
```

**Response `200 OK`:** Updated order with `status: "PREPARING"`.

---

### 4.10 Request Driver (Mark Ready)

```
POST /api/v1/restaurants/me/orders/:orderId/request-driver
```

**Response `200 OK`:** Updated order with `status: "LOOKING_FOR_DRIVER"`. Triggers dispatch algorithm.

---

### 4.11 Get Assigned Driver

```
GET /api/v1/restaurants/me/orders/:orderId/driver
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "driverId": "uuid",
    "displayName": "Mohammed Ali",
    "phone": "+9647001111111",
    "vehicleType": "Motorcycle",
    "vehiclePlate": "BGH 4521",
    "rating": 4.8,
    "currentLocation": {
      "latitude": 33.3200,
      "longitude": 44.3700,
      "recordedAt": "2026-05-07T10:20:00.000Z"
    },
    "estimatedArrivalMinutes": 5
  }
}
```

---

### 4.12 Get Working Hours

```
GET /api/v1/restaurants/me/working-hours
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    { "dayOfWeek": 0, "openTime": "08:00", "closeTime": "23:00", "isClosed": false },
    { "dayOfWeek": 1, "openTime": "08:00", "closeTime": "23:00", "isClosed": false },
    { "dayOfWeek": 5, "openTime": "10:00", "closeTime": "22:00", "isClosed": false },
    { "dayOfWeek": 6, "isClosed": true }
  ]
}
```

---

### 4.13 Update Working Hours

```
PUT /api/v1/restaurants/me/working-hours
```

**Allowed Roles:** `RESTAURANT_OWNER` only

**Request Body:**
```json
{
  "hours": [
    { "dayOfWeek": 0, "openTime": "08:00", "closeTime": "23:00", "isClosed": false },
    { "dayOfWeek": 6, "isClosed": true }
  ]
}
```

---

### 4.14 List Menu Categories

```
GET /api/v1/restaurants/me/menu-categories
```

**Response `200 OK`:** Array of menu categories with product counts.

---

### 4.15 Create Menu Category

```
POST /api/v1/restaurants/me/menu-categories
```

**Request Body:**
```json
{
  "name": "Grills",
  "sortOrder": 1
}
```

---

### 4.16 Update Menu Category

```
PUT /api/v1/restaurants/me/menu-categories/:categoryId
```

---

### 4.17 Delete Menu Category

```
DELETE /api/v1/restaurants/me/menu-categories/:categoryId
```

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | `CATEGORY_HAS_PRODUCTS` | Cannot delete category with existing products |

---

### 4.18 List Products

```
GET /api/v1/restaurants/me/products?categoryId=uuid&isAvailable=true
```

---

### 4.19 Create Product

```
POST /api/v1/restaurants/me/products
```

**Request Body:**
```json
{
  "menuCategoryId": "uuid",
  "name": "Mixed Grill",
  "description": "A selection of grilled meats",
  "price": 15000,
  "isAvailable": true,
  "sortOrder": 1,
  "modifiers": [
    {
      "name": "Choose Size",
      "isRequired": true,
      "minSelections": 1,
      "maxSelections": 1,
      "sortOrder": 1,
      "options": [
        { "name": "Small", "priceAdjustment": 0, "isDefault": true, "sortOrder": 1 },
        { "name": "Large", "priceAdjustment": 5000, "isDefault": false, "sortOrder": 2 }
      ]
    }
  ]
}
```

**Response `201 Created`:** Full product object.

---

### 4.20 Update Product

```
PUT /api/v1/restaurants/me/products/:productId
```

**Request Body:** Same as Create Product (all fields optional).

---

### 4.21 Delete Product

```
DELETE /api/v1/restaurants/me/products/:productId
```

Soft-deletes the product (`deleted_at` set). Does not affect historical order data.

---

### 4.22 Toggle Product Availability

```
PATCH /api/v1/restaurants/me/products/:productId/availability
```

**Request Body:**
```json
{
  "isAvailable": false
}
```

**Response `200 OK`:** `{ "success": true, "data": { "productId": "uuid", "isAvailable": false } }`

---

### 4.23 Upload Product Image

```
POST /api/v1/restaurants/me/products/:productId/images
Content-Type: multipart/form-data
```

**Form Fields:**

| Field | Type | Required |
|-------|------|----------|
| `image` | file | Yes |
| `isPrimary` | boolean | No |

**Response `201 Created`:** `{ "id": "uuid", "url": "https://cdn.domain.com/...", "isPrimary": true }`

---

### 4.24 Get Earnings Summary

```
GET /api/v1/restaurants/me/earnings?period=today
```

**Query Parameters:** `period` = `today`, `week`, `month`

**Allowed Roles:** `RESTAURANT_OWNER` only

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "period": "today",
    "grossRevenue": 450000,
    "commissionDeducted": 67500,
    "netRevenue": 382500,
    "orderCount": 18
  }
}
```

---

## 5. Driver APIs

Base path: `/api/v1/drivers/me`  
**Auth Required:** Yes  
**Allowed Roles:** `DRIVER`

---

### 5.1 Get Driver Profile

```
GET /api/v1/drivers/me/profile
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "displayName": "Mohammed Ali",
    "phone": "+9647001111111",
    "profilePhotoUrl": "https://cdn.domain.com/...",
    "vehicleType": "Motorcycle",
    "vehiclePlate": "BGH 4521",
    "verificationStatus": "APPROVED",
    "availabilityStatus": "ONLINE",
    "rating": 4.8,
    "totalDeliveries": 312
  }
}
```

---

### 5.2 Submit / Update Driver Profile (Verification)

```
POST /api/v1/drivers/me/profile
```

**Request Body:**
```json
{
  "displayName": "Mohammed Ali",
  "vehicleType": "Motorcycle",
  "vehiclePlate": "BGH 4521"
}
```

---

### 5.3 Upload Driver Document

```
POST /api/v1/drivers/me/documents
Content-Type: multipart/form-data
```

**Form Fields:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `document` | file | Yes | JPEG/PNG/PDF, max 5MB |
| `documentType` | enum | Yes | `NATIONAL_ID`, `DRIVING_LICENSE`, `VEHICLE_REGISTRATION`, `PROFILE_PHOTO` |

**Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "documentType": "NATIONAL_ID",
    "url": "https://cdn.domain.com/...",
    "uploadedAt": "2026-05-07T10:00:00.000Z"
  }
}
```

---

### 5.4 Get Verification Status

```
GET /api/v1/drivers/me/verification
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "verificationStatus": "PENDING_REVIEW",
    "rejectionReason": null,
    "submittedAt": "2026-05-07T09:00:00.000Z",
    "documents": [
      { "id": "uuid", "documentType": "NATIONAL_ID", "uploadedAt": "..." },
      { "id": "uuid", "documentType": "DRIVING_LICENSE", "uploadedAt": "..." }
    ]
  }
}
```

---

### 5.5 Toggle Online / Offline

```
PATCH /api/v1/drivers/me/availability
```

**Request Body:**
```json
{
  "status": "ONLINE"
}
```

| Status | Condition |
|--------|-----------|
| `ONLINE` | Only if `verificationStatus = APPROVED` |
| `OFFLINE` | Always allowed |

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 403 | `DRIVER_NOT_VERIFIED` | Driver verification is not APPROVED |

---

### 5.6 Update Driver Location

```
PATCH /api/v1/drivers/me/location
```

**Rate Limit:** 120 requests/minute per driver  
**Notes:** This endpoint is called by the driver app periodically when online. It updates Redis and persists to `driver_locations`.

**Request Body:**
```json
{
  "latitude": 33.3200,
  "longitude": 44.3700,
  "accuracy": 5.2,
  "heading": 270.0,
  "speed": 12.5
}
```

**Response `200 OK`:**
```json
{ "success": true, "data": { "message": "Location updated" } }
```

---

### 5.7 Accept Delivery Offer

```
POST /api/v1/drivers/me/offers/:offerId/accept
```

**Idempotency-Key:** Required

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "deliveryId": "uuid",
    "orderId": "uuid",
    "restaurant": {
      "id": "uuid",
      "name": "Al-Mansour Grill",
      "address": "Al-Mansour District, Baghdad",
      "phone": "+9647009876543",
      "latitude": 33.3180,
      "longitude": 44.3690
    },
    "orderItems": [
      { "productName": "Mixed Grill", "quantity": 2 }
    ],
    "estimatedEarnings": 3500
  }
}
```

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 409 | `DELIVERY_ALREADY_ASSIGNED` | Another driver was faster (Redis lock) |
| 400 | `OFFER_EXPIRED` | Offer timeout has passed |
| 400 | `DRIVER_ALREADY_ON_DELIVERY` | Driver is already on another delivery |

---

### 5.8 Decline Delivery Offer

```
POST /api/v1/drivers/me/offers/:offerId/decline
```

**Request Body:**
```json
{
  "reason": "TOO_FAR"
}
```

**Response `200 OK`:** `{ "success": true, "data": { "message": "Offer declined" } }`

---

### 5.9 Get Active Delivery

```
GET /api/v1/drivers/me/active-delivery
```

**Response `200 OK`:** Full delivery detail including order items, restaurant location, customer delivery district. Customer's full address is included only when `status >= PICKED_UP`.

```json
{
  "success": true,
  "data": {
    "deliveryId": "uuid",
    "orderId": "uuid",
    "status": "DRIVER_HEADING_TO_RESTAURANT",
    "restaurant": {
      "name": "Al-Mansour Grill",
      "address": "Al-Mansour District",
      "phone": "+9647009876543",
      "latitude": 33.3180,
      "longitude": 44.3690
    },
    "customerDeliveryDistrict": "Karrada",
    "customerFullAddress": null,
    "orderItems": [
      { "productName": "Mixed Grill", "quantity": 2 }
    ],
    "totalAmount": 42000,
    "paymentMethod": "CASH_ON_DELIVERY",
    "estimatedEarnings": 3500
  }
}
```

---

### 5.10 Mark Arrived at Restaurant

```
POST /api/v1/drivers/me/deliveries/:deliveryId/arrived-restaurant
```

**Response `200 OK`:** Updated delivery object with `status: "DRIVER_ARRIVED_RESTAURANT"`.

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 403 | `FORBIDDEN_ROLE` | Caller is not the assigned driver |
| 400 | `ORDER_INVALID_STATUS` | Delivery not in expected status |

---

### 5.11 Mark Order Picked Up

```
POST /api/v1/drivers/me/deliveries/:deliveryId/picked-up
```

**Response `200 OK`:** Updated delivery; customer full address is now included in `GET /active-delivery`.

---

### 5.12 Mark Arrived at Customer

```
POST /api/v1/drivers/me/deliveries/:deliveryId/arrived-customer
```

**Response `200 OK`:** Updated delivery with `status: "ARRIVED_CUSTOMER"`.

---

### 5.13 Mark Delivered

```
POST /api/v1/drivers/me/deliveries/:deliveryId/delivered
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "deliveryId": "uuid",
    "status": "DELIVERED",
    "earnings": {
      "grossAmount": 4000,
      "commissionDeducted": 500,
      "netAmount": 3500
    },
    "deliveredAt": "2026-05-07T10:45:00.000Z"
  }
}
```

---

### 5.14 Get Earnings Summary

```
GET /api/v1/drivers/me/earnings?period=today
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "period": "today",
    "grossAmount": 28000,
    "commissionDeducted": 3500,
    "netAmount": 24500,
    "deliveryCount": 7,
    "pendingPayoutAmount": 24500
  }
}
```

---

### 5.15 Get Delivery History

```
GET /api/v1/drivers/me/deliveries?page=1&limit=20&from=2026-05-01&to=2026-05-07
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "deliveryId": "uuid",
      "orderId": "uuid",
      "restaurantName": "Al-Mansour Grill",
      "status": "DELIVERED",
      "netEarnings": 3500,
      "deliveredAt": "2026-05-07T10:45:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 87, "totalPages": 5 }
}
```

---

## 6. Order APIs

The order creation endpoint is documented in [Section 3.18](#318-create-order). This section covers order-related endpoints accessible across roles.

---

### 6.1 Get Order (by ID)

```
GET /api/v1/orders/:orderId
```

**Allowed Roles:** `CUSTOMER` (own orders), `RESTAURANT_OWNER`, `RESTAURANT_STAFF` (restaurant's orders), `ADMIN`

**Response:** Full order object appropriate to the caller's role (customer sees customer view, restaurant sees restaurant view).

---

## 7. Admin APIs

Base path: `/api/v1/admin`  
**Auth Required:** Yes  
**Allowed Roles:** `ADMIN`, `SUPER_ADMIN` (unless noted)

All admin write actions are logged to `audit_logs`.

---

### 7.1 Admin Login

```
POST /api/v1/admin/auth/login
```

**Auth Required:** No

**Request Body:**
```json
{
  "email": "admin@platform.com",
  "password": "AdminPassword123"
}
```

**Response `200 OK`:** JWT tokens (same structure as Section 2.3).

---

### 7.2 Dashboard Summary

```
GET /api/v1/admin/dashboard/summary
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "todayOrders": 142,
    "todayRevenue": 4260000,
    "activeOrders": 18,
    "onlineDrivers": 24,
    "openRestaurants": 31,
    "pendingDriverApprovals": 5,
    "openSupportTickets": 8
  }
}
```

---

### 7.3 List Users

```
GET /api/v1/admin/users?role=CUSTOMER&status=ACTIVE&page=1&limit=20
```

**Response `200 OK`:** Paginated list of users with profile summaries.

---

### 7.4 Get User Detail

```
GET /api/v1/admin/users/:userId
```

**Response `200 OK`:** Full user + profile + stats (order count, delivery count).

---

### 7.5 Update User Status

```
PATCH /api/v1/admin/users/:userId/status
```

**Allowed Roles:** `ADMIN`, `SUPER_ADMIN`

**Request Body:**
```json
{
  "status": "SUSPENDED",
  "reason": "Fraudulent activity detected"
}
```

---

### 7.6 List Restaurants

```
GET /api/v1/admin/restaurants?status=PENDING_APPROVAL&page=1
```

---

### 7.7 Update Restaurant Status

```
PATCH /api/v1/admin/restaurants/:restaurantId/status
```

**Request Body:**
```json
{
  "status": "SUSPENDED",
  "reason": "Policy violation"
}
```

---

### 7.8 Set Restaurant Commission

```
PUT /api/v1/admin/restaurants/:restaurantId/commission
```

**Allowed Roles:** `SUPER_ADMIN` only

**Request Body:**
```json
{
  "type": "PERCENTAGE",
  "rate": 12.5,
  "effectiveFrom": "2026-06-01T00:00:00.000Z"
}
```

---

### 7.9 List Drivers

```
GET /api/v1/admin/drivers?verificationStatus=PENDING_REVIEW&page=1
```

---

### 7.10 Get Driver Detail with Documents

```
GET /api/v1/admin/drivers/:driverId
```

**Response `200 OK`:** Full driver profile including documents with signed URLs.

---

### 7.11 Update Driver Verification

```
PATCH /api/v1/admin/drivers/:driverId/verification
```

**Request Body:**
```json
{
  "verificationStatus": "APPROVED",
  "rejectionReason": null
}
```

When set to `APPROVED`, a push notification is sent to the driver via FCM.

---

### 7.12 List All Orders

```
GET /api/v1/admin/orders?status=LOOKING_FOR_DRIVER&restaurantId=uuid&from=2026-05-01&to=2026-05-07&page=1
```

---

### 7.13 Get Order Detail (Admin View)

```
GET /api/v1/admin/orders/:orderId
```

**Response `200 OK`:** Complete order including all items, full status history with actors, delivery info, all driver offers, full payment detail, cancellation info.

---

### 7.14 Cancel Order (Admin)

```
POST /api/v1/admin/orders/:orderId/cancel
```

**Request Body:**
```json
{
  "reason": "Customer complaint — restaurant did not prepare"
}
```

---

### 7.15 Manually Assign Driver

```
POST /api/v1/admin/orders/:orderId/assign-driver
```

**Request Body:**
```json
{
  "driverId": "uuid"
}
```

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | `DRIVER_NOT_AVAILABLE` | Driver is offline or already on a delivery |
| 400 | `ORDER_INVALID_STATUS` | Order is not in assignable status |

---

### 7.16 Override Order Status

```
PATCH /api/v1/admin/orders/:orderId/status
```

**Allowed Roles:** `SUPER_ADMIN` only

**Request Body:**
```json
{
  "status": "DELIVERED",
  "reason": "Manual resolution — confirmed delivery via phone"
}
```

---

### 7.17 List Support Tickets

```
GET /api/v1/admin/support/tickets?status=OPEN&page=1
```

---

### 7.18 Get Support Ticket

```
GET /api/v1/admin/support/tickets/:ticketId
```

---

### 7.19 Update Ticket Status

```
PATCH /api/v1/admin/support/tickets/:ticketId/status
```

**Request Body:**
```json
{
  "status": "RESOLVED",
  "resolution": "Refund issued to customer"
}
```

---

### 7.20 Reply to Ticket

```
POST /api/v1/admin/support/tickets/:ticketId/messages
```

**Request Body:**
```json
{
  "message": "We have reviewed your complaint and issued a refund."
}
```

---

### 7.21 List Payments

```
GET /api/v1/admin/payments?status=PENDING&method=CASH_ON_DELIVERY&from=2026-05-01&page=1
```

---

### 7.22 List Commissions

```
GET /api/v1/admin/commissions
```

---

### 7.23 Create Commission Rule

```
POST /api/v1/admin/commissions
```

**Allowed Roles:** `SUPER_ADMIN` only

**Request Body:**
```json
{
  "restaurantId": null,
  "type": "PERCENTAGE",
  "rate": 15.0,
  "effectiveFrom": "2026-06-01T00:00:00.000Z"
}
```

`restaurantId: null` creates a global rule. A specific `restaurantId` creates a per-restaurant override.

---

### 7.24 Get Reports

```
GET /api/v1/admin/reports/revenue?from=2026-05-01&to=2026-05-07&groupBy=day
GET /api/v1/admin/reports/orders?from=2026-05-01&to=2026-05-07
GET /api/v1/admin/reports/drivers?from=2026-05-01&to=2026-05-07
GET /api/v1/admin/reports/restaurants?from=2026-05-01&to=2026-05-07
```

---

### 7.25 Get Active Orders Map Data

```
GET /api/v1/admin/orders/active-map
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderId": "uuid",
        "status": "ON_THE_WAY",
        "restaurantLocation": { "latitude": 33.3180, "longitude": 44.3690 },
        "customerLocation": { "latitude": 33.3152, "longitude": 44.3661 },
        "driverLocation": { "latitude": 33.3200, "longitude": 44.3700 }
      }
    ]
  }
}
```

---

### 7.26 Get Platform Settings

```
GET /api/v1/admin/settings
```

**Allowed Roles:** `ADMIN`, `SUPER_ADMIN`

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "defaultCommissionRate": 15.0,
    "defaultDeliveryFee": 2000,
    "dispatchRadiusKm": 5.0,
    "dispatchTimeoutSeconds": 30,
    "autoRejectTimeoutSeconds": 180,
    "maxDispatchRetries": 5
  }
}
```

---

### 7.27 Update Platform Settings

```
PUT /api/v1/admin/settings
```

**Allowed Roles:** `SUPER_ADMIN` only

**Request Body:**
```json
{
  "dispatchRadiusKm": 7.0,
  "dispatchTimeoutSeconds": 45
}
```

---

### 7.28 Get Audit Logs

```
GET /api/v1/admin/audit-logs?adminId=uuid&entityType=order&from=2026-05-01&page=1
```

**Allowed Roles:** `SUPER_ADMIN` only

**Response `200 OK`:** Paginated immutable audit log entries.

---

## 8. Realtime Socket.IO Events

### 8.1 Connection

**Namespace:** `/` (default namespace)  
**Authentication:** Token passed as query param on connect:
```
wss://api.yourdomain.com?token=<access_token>
```

The gateway validates the token on connection. Invalid or expired tokens are rejected with a connection error. Clients must reconnect with a refreshed token after expiry.

**Rooms Strategy:**
- Each order has a room: `order:{orderId}`
- Each restaurant has a room: `restaurant:{restaurantId}`
- Each driver has a private room: `driver:{driverId}`
- Admin monitoring joins: `admin:monitoring`

---

### 8.2 Event Reference Table

| Event Name | Direction | Sender | Receiver Room | Description |
|-----------|-----------|--------|--------------|-------------|
| `order:new` | Server → Client | Backend | `restaurant:{restaurantId}` | New order placed by customer |
| `order:accepted` | Server → Client | Backend | `order:{orderId}` | Restaurant accepted the order |
| `order:rejected` | Server → Client | Backend | `order:{orderId}` | Restaurant rejected the order |
| `order:preparing` | Server → Client | Backend | `order:{orderId}` | Restaurant started preparing |
| `driver:requested` | Server → Client | Backend | `driver:{driverId}` | Dispatch offering a delivery |
| `driver:assigned` | Server → Client | Backend | `order:{orderId}` | Driver accepted the offer |
| `driver:location_updated` | Server → Client | Backend | `order:{orderId}` | Driver's new GPS coordinates |
| `order:arrived_restaurant` | Server → Client | Backend | `order:{orderId}` | Driver arrived at restaurant |
| `order:picked_up` | Server → Client | Backend | `order:{orderId}` | Driver picked up the order |
| `order:on_the_way` | Server → Client | Backend | `order:{orderId}` | Driver heading to customer |
| `order:arrived_customer` | Server → Client | Backend | `order:{orderId}` | Driver arrived at customer |
| `order:delivered` | Server → Client | Backend | `order:{orderId}` | Order delivered successfully |
| `order:cancelled` | Server → Client | Backend | `order:{orderId}` + `restaurant:{restaurantId}` | Order cancelled |
| `driver:location_update` | Client → Server | Driver App | Backend | Driver sends new location |
| `connection:restored` | Server → Client | Backend | Reconnecting client | Sync payload after reconnect |

---

### 8.3 Detailed Event Payloads

#### `order:new`
**Sender:** Backend (triggered by `POST /orders`)  
**Receiver:** Restaurant App (room: `restaurant:{restaurantId}`)  
**Auth Requirement:** Restaurant must be authenticated and in the restaurant room

```json
{
  "event": "order:new",
  "data": {
    "orderId": "uuid",
    "orderNumber": "ORD-20260507-0142",
    "customerFirstName": "Ahmed",
    "deliveryDistrict": "Karrada",
    "paymentMethod": "CASH_ON_DELIVERY",
    "totalAmount": 42000,
    "itemCount": 2,
    "items": [
      { "productName": "Mixed Grill", "quantity": 2, "lineTotal": 40000 }
    ],
    "deliveryNotes": "Call on arrival",
    "createdAt": "2026-05-07T10:00:00.000Z"
  }
}
```

---

#### `order:accepted`
**Sender:** Backend (triggered by `POST /restaurants/me/orders/:id/accept`)  
**Receiver:** Customer App (room: `order:{orderId}`)

```json
{
  "event": "order:accepted",
  "data": {
    "orderId": "uuid",
    "status": "ACCEPTED_BY_RESTAURANT",
    "estimatedPrepMinutes": 20,
    "timestamp": "2026-05-07T10:02:00.000Z"
  }
}
```

---

#### `order:rejected`
**Sender:** Backend  
**Receiver:** Customer App (room: `order:{orderId}`)

```json
{
  "event": "order:rejected",
  "data": {
    "orderId": "uuid",
    "status": "REJECTED_BY_RESTAURANT",
    "reason": "OUT_OF_STOCK",
    "timestamp": "2026-05-07T10:02:00.000Z"
  }
}
```

---

#### `order:preparing`
**Sender:** Backend  
**Receiver:** Customer App (room: `order:{orderId}`)

```json
{
  "event": "order:preparing",
  "data": {
    "orderId": "uuid",
    "status": "PREPARING",
    "timestamp": "2026-05-07T10:03:00.000Z"
  }
}
```

---

#### `driver:requested`
**Sender:** Backend (triggered by dispatch algorithm)  
**Receiver:** Driver App (room: `driver:{driverId}`)

```json
{
  "event": "driver:requested",
  "data": {
    "offerId": "uuid",
    "deliveryId": "uuid",
    "orderId": "uuid",
    "restaurant": {
      "name": "Al-Mansour Grill",
      "distanceKm": 1.2
    },
    "estimatedEarnings": 3500,
    "timeoutSeconds": 30,
    "offeredAt": "2026-05-07T10:15:00.000Z"
  }
}
```

---

#### `driver:assigned`
**Sender:** Backend (triggered by `POST /drivers/me/offers/:id/accept`)  
**Receiver:** Customer App + Restaurant App (room: `order:{orderId}`)

```json
{
  "event": "driver:assigned",
  "data": {
    "orderId": "uuid",
    "status": "DRIVER_ASSIGNED",
    "driver": {
      "id": "uuid",
      "displayName": "Mohammed Ali",
      "phone": "+9647001111111",
      "vehicleType": "Motorcycle",
      "vehiclePlate": "BGH 4521",
      "rating": 4.8
    },
    "timestamp": "2026-05-07T10:16:00.000Z"
  }
}
```

---

#### `driver:location_update` (Client → Server)
**Sender:** Driver App  
**Receiver:** Backend (processes and relays to order room)

```json
{
  "event": "driver:location_update",
  "data": {
    "latitude": 33.3200,
    "longitude": 44.3700,
    "accuracy": 5.2,
    "heading": 270.0,
    "speed": 12.5,
    "timestamp": "2026-05-07T10:20:00.000Z"
  }
}
```

---

#### `driver:location_updated` (Server → Clients)
**Sender:** Backend (relay from driver)  
**Receiver:** Customer App + Restaurant App (room: `order:{orderId}`)

```json
{
  "event": "driver:location_updated",
  "data": {
    "orderId": "uuid",
    "driverId": "uuid",
    "latitude": 33.3200,
    "longitude": 44.3700,
    "estimatedArrivalMinutes": 8,
    "timestamp": "2026-05-07T10:20:00.000Z"
  }
}
```

---

#### `order:picked_up`
**Sender:** Backend  
**Receiver:** Customer App + Restaurant App (room: `order:{orderId}`)

```json
{
  "event": "order:picked_up",
  "data": {
    "orderId": "uuid",
    "status": "PICKED_UP",
    "timestamp": "2026-05-07T10:22:00.000Z"
  }
}
```

---

#### `order:delivered`
**Sender:** Backend  
**Receiver:** Customer App + Restaurant App (room: `order:{orderId}`)

```json
{
  "event": "order:delivered",
  "data": {
    "orderId": "uuid",
    "status": "DELIVERED",
    "timestamp": "2026-05-07T10:45:00.000Z",
    "showReviewPrompt": true
  }
}
```

---

#### `order:cancelled`
**Sender:** Backend  
**Receiver:** All parties (room: `order:{orderId}` + `restaurant:{restaurantId}` + `driver:{driverId}` if assigned)

```json
{
  "event": "order:cancelled",
  "data": {
    "orderId": "uuid",
    "status": "CANCELLED",
    "cancelledBy": "CUSTOMER",
    "reason": "I changed my mind",
    "timestamp": "2026-05-07T10:01:00.000Z"
  }
}
```

---

#### `connection:restored`
**Sender:** Backend (emitted to a client on reconnect)  
**Receiver:** Reconnecting client

```json
{
  "event": "connection:restored",
  "data": {
    "activeOrders": [
      {
        "orderId": "uuid",
        "status": "ON_THE_WAY",
        "lastStatusAt": "2026-05-07T10:22:00.000Z",
        "driverLocation": {
          "latitude": 33.3200,
          "longitude": 44.3700,
          "recordedAt": "2026-05-07T10:25:00.000Z"
        }
      }
    ]
  }
}
```

---

## 9. Error Code Catalog

| HTTP Status | Error Code | Description | Common Triggers |
|-------------|-----------|-------------|----------------|
| 400 | `AUTH_INVALID_OTP` | OTP code is incorrect | Wrong digits entered |
| 400 | `AUTH_OTP_EXPIRED` | OTP has passed its expiry time | >5 minutes since request |
| 400 | `AUTH_OTP_MAX_ATTEMPTS` | Max failed attempts reached; cooldown active | 5 failed attempts |
| 401 | `AUTH_TOKEN_EXPIRED` | JWT access token has expired | >15 min since issue |
| 401 | `AUTH_TOKEN_REVOKED` | Refresh token was revoked or reused | Logout, suspicious reuse |
| 401 | `AUTH_INVALID_CREDENTIALS` | Wrong email or password | Login endpoint |
| 401 | `AUTH_UNAUTHENTICATED` | No token provided | Missing Authorization header |
| 403 | `FORBIDDEN_ROLE` | Authenticated but wrong role for endpoint | Customer calling restaurant API |
| 403 | `USER_SUSPENDED` | Account is suspended or banned | Suspended account login |
| 403 | `DRIVER_NOT_VERIFIED` | Driver trying to go online before approval | Verification pending |
| 403 | `ORDER_NOT_OWNED` | Attempting to access another user's order | Mismatched customer/order |
| 404 | `RESOURCE_NOT_FOUND` | Entity not found | Invalid UUID, soft-deleted |
| 400 | `RESTAURANT_CLOSED` | Restaurant is not accepting orders | CLOSED or SUSPENDED status |
| 400 | `PRODUCT_UNAVAILABLE` | Product is marked unavailable | `isAvailable = false` |
| 400 | `CART_EMPTY` | Order placed with empty cart | No items in request |
| 400 | `CART_RESTAURANT_CONFLICT` | Adding item from different restaurant | New restaurant != existing cart |
| 400 | `MIN_ORDER_NOT_MET` | Cart subtotal below minimum | Restaurant min order amount |
| 400 | `ORDER_INVALID_STATUS` | Requested status transition is not allowed | Wrong lifecycle step |
| 400 | `ORDER_NOT_DELIVERED` | Review submitted for non-delivered order | Status != DELIVERED |
| 409 | `REVIEW_ALREADY_SUBMITTED` | Review already exists for this order | Duplicate review attempt |
| 400 | `DRIVER_NOT_AVAILABLE` | Driver is offline or already on a delivery | Dispatch / manual assign |
| 409 | `DELIVERY_ALREADY_ASSIGNED` | Another driver accepted first (race condition) | Concurrent accepts |
| 400 | `OFFER_EXPIRED` | Driver offer timeout has passed | Slow accept response |
| 400 | `DRIVER_ALREADY_ON_DELIVERY` | Driver is currently on another delivery | Concurrent offer accept |
| 409 | `IDEMPOTENCY_CONFLICT` | Duplicate request being processed | Rapid retry |
| 400 | `CATEGORY_HAS_PRODUCTS` | Cannot delete non-empty menu category | Category with products |
| 422 | `VALIDATION_ERROR` | Request body fails schema validation | Missing fields, wrong types |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests | See rate limit table |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error | Backend exceptions |
| 503 | `SERVICE_UNAVAILABLE` | Backend temporarily unavailable | Maintenance / overload |
| 504 | `NETWORK_RETRY_REQUIRED` | Upstream timeout (e.g., SMS gateway) | External service delay |

---

## 10. Assumptions

- All monetary values are in the **local currency** (integer or DECIMAL, stored in the smallest unit if needed). For clarity in this document, amounts are shown as full currency units (e.g., 15000 = IQD 15,000).
- The `POST /orders` endpoint validates product prices server-side against the database — the client-sent cart is used for item composition only. Prices are always fetched fresh from the database on order creation.
- Phone numbers are always stored and transmitted in **E.164 format**.
- Image upload endpoints return a CDN URL immediately. Images are processed asynchronously (compression/resizing). A small upload delay is expected.
- The Driver App calls `PATCH /drivers/me/location` directly (HTTP, not Socket.IO) for reliability. The backend then relays via Socket.IO to the order room.
- Socket.IO reconnection is handled by the `socket.io-client` library using exponential backoff. The `connection:restored` event is emitted by the backend on each successful reconnection.
- Soft-deleted records (`deleted_at IS NOT NULL`) are never returned by any API endpoint to clients.

---

## 11. Open Questions

| # | Question | Impact | Who to Ask |
|---|---------|--------|-----------|
| 1 | Should `GET /restaurants` be fully public (no auth) or require at least guest token? | Auth guard on browse endpoints | Product / Security |
| 2 | Should the driver's full phone number be visible to the customer? Or only via an in-app call proxy? | Privacy, GDPR-like compliance | Legal / Product |
| 3 | When a restaurant rejects an order, should the platform automatically suggest an alternative restaurant? | New flow, complexity | Product Owner |
| 4 | Should the driver app use HTTP polling or Socket.IO as the primary location update channel? | Architecture decision | Engineering |
| 5 | Is there a maximum delivery radius enforced by the API? (e.g., cannot assign driver >15 km away) | Dispatch API validation | Product / Operations |
| 6 | Should `GET /orders` for customers return only delivered/cancelled orders, or include active orders too? | Order history vs. active tracking split | Product / UX |
| 7 | Should the platform expose an estimated delivery fee at the `GET /restaurants/:id` stage (before checkout)? | Pricing transparency | Product Owner |
| 8 | Are there plans for a referral or promo code system that would require a discount field on `POST /orders`? | Order API schema | Product Owner |
| 9 | Should the admin manual driver assignment log the reason? | Audit log completeness | Operations |
| 10 | What is the maximum file size and accepted formats for driver documents? | Document upload endpoint | Operations / Legal |

---

## ملخص الملف

**ما هدف هذا الملف؟**

هذا الملف هو **عقد الاتصال بين الفرونتند والباكند** — يُجيب على سؤال: كيف يتحدث التطبيق مع السيرفر؟

يحتوي على:
- كل نقطة نهاية API (Endpoint) في النظام مع المسار الكامل
- طريقة الطلب (GET، POST، PATCH، DELETE)
- ما يرسله الطلب في الـ Body أو Params أو Query
- شكل الـ Response الناجح بالضبط (JSON مع كل حقل ونوعه)
- رموز الخطأ المتوقعة وما تعنيه
- من يحق له استدعاء كل Endpoint (Customer / Driver / Restaurant / Admin)
- أمثلة حقيقية للـ Request والـ Response

**من يقرأه؟**
- مهندس الباكند: يبني الـ Controllers والـ Services بناءً عليه
- مهندس الفرونتند وFlutter: يعرف بالضبط ماذا يرسل وماذا يستقبل
- يُلغي الحاجة للتخمين أو التنسيق اليومي بين الفريقين

**القاعدة:** لا يُكتب ولا يُستدعى أي API قبل توثيقه في هذا الملف.
