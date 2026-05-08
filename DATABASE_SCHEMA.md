# DATABASE_SCHEMA.md — Implementation Database Schema

> **Project:** Local Delivery Platform  
> **Source of Truth:** `DELIVERY_APPS_REQUIREMENTS.md`, `ERD.md`  
> **Date:** 2026-05-07  
> **Version:** 1.0  
> **Audience:** Backend Engineers, Database Administrators, DevOps  
> **Database:** PostgreSQL 15+  
> **ORM:** Prisma 5+

---

## Table of Contents

1. [Schema Overview](#1-schema-overview)
2. [Naming Conventions](#2-naming-conventions)
3. [PostgreSQL Enums](#3-postgresql-enums)
4. [Table-by-Table Schema](#4-table-by-table-schema)
5. [Constraints Reference](#5-constraints-reference)
6. [Complete Index List](#6-complete-index-list)
7. [Prisma Mapping Notes](#7-prisma-mapping-notes)
8. [Initial Seed Data](#8-initial-seed-data)
9. [Migration Strategy](#9-migration-strategy)
10. [Assumptions](#10-assumptions)
11. [Open Questions](#11-open-questions)

---

## 1. Schema Overview

### Approach

The database layer uses **PostgreSQL 15** as the primary persistent store and **Prisma ORM 5** for type-safe access, schema management, and migrations. The schema is organized in a single PostgreSQL schema (`public`) for MVP simplicity, with a clear path to introduce additional schemas (e.g., `finance`, `audit`) as the platform scales.

### Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Primary keys | `UUID` (v4) | Safe for distributed systems, avoids enumeration |
| Soft delete | `deleted_at TIMESTAMPTZ` | Preserves business history; orders never hard-deleted |
| Money storage | `DECIMAL(10,2)` | Prevents floating-point rounding errors |
| Enums | PostgreSQL native enums | Database-level integrity; Prisma maps these natively |
| Timestamps | `TIMESTAMPTZ` (timezone-aware) | Avoids timezone bugs across regions |
| Audit fields | `created_at`, `updated_at` on all tables | Automatic via Prisma `@updatedAt` |
| JSONB | Used sparingly for snapshots and flexible config | `order.address_snapshot`, `platform_settings.value` |
| Location | `DECIMAL(10,7)` for lat/lng | ~1cm precision, sufficient for delivery use case |
| Realtime location | Redis (not PostgreSQL) | `driver_locations` table is history-only; live location served from Redis |

### Database Extensions Required

```sql
-- Run once on the PostgreSQL instance before first migration
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- Cryptographic functions (optional, for OTP hashing)
-- PostGIS is NOT required for MVP; add in future for polygon zone queries
```

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Table names | `snake_case`, plural | `orders`, `driver_profiles` |
| Column names | `snake_case` | `restaurant_id`, `created_at` |
| Primary key | `id UUID` | `id` on every table |
| Foreign keys | `{referenced_table_singular}_id` | `restaurant_id`, `driver_id` |
| Boolean columns | Prefix `is_` | `is_available`, `is_default`, `is_read` |
| Timestamp columns | Suffix `_at` | `created_at`, `updated_at`, `deleted_at`, `expires_at` |
| Soft delete column | `deleted_at` | `NULL` = active; not null = deleted |
| Enum type names | `snake_case` | `order_status`, `user_role` |
| Index names | `idx_{table}_{columns}` | `idx_orders_customer_id` |
| Unique index names | `uq_{table}_{columns}` | `uq_orders_idempotency_key` |
| Check constraint names | `chk_{table}_{rule}` | `chk_orders_total_positive` |
| Prisma model names | `PascalCase`, singular | `Order`, `DriverProfile` |

---

## 3. PostgreSQL Enums

All enums are created as native PostgreSQL `ENUM` types. Prisma maps them with `@db.Enum("enum_name")`.

```sql
-- Identity & Access
CREATE TYPE user_role AS ENUM (
  'CUSTOMER', 'RESTAURANT_OWNER', 'RESTAURANT_STAFF',
  'DRIVER', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT'
);

CREATE TYPE user_status AS ENUM (
  'ACTIVE', 'SUSPENDED', 'BANNED', 'PENDING_VERIFICATION'
);

-- Restaurant Domain
CREATE TYPE restaurant_status AS ENUM (
  'OPEN', 'CLOSED', 'BUSY', 'TEMPORARILY_CLOSED',
  'PENDING_APPROVAL', 'SUSPENDED'
);

CREATE TYPE restaurant_staff_role AS ENUM (
  'OWNER', 'MANAGER', 'STAFF'
);

-- Driver Domain
CREATE TYPE driver_verification_status AS ENUM (
  'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'
);

CREATE TYPE driver_availability_status AS ENUM (
  'OFFLINE', 'ONLINE', 'ON_DELIVERY'
);

CREATE TYPE document_type AS ENUM (
  'NATIONAL_ID', 'DRIVING_LICENSE', 'VEHICLE_REGISTRATION', 'PROFILE_PHOTO'
);

-- Order Domain
CREATE TYPE order_status AS ENUM (
  'PENDING_RESTAURANT', 'ACCEPTED_BY_RESTAURANT', 'REJECTED_BY_RESTAURANT',
  'PREPARING', 'LOOKING_FOR_DRIVER', 'DRIVER_OFFERED', 'DRIVER_ASSIGNED',
  'DRIVER_ARRIVED_RESTAURANT', 'PICKED_UP', 'ON_THE_WAY',
  'ARRIVED_CUSTOMER', 'DELIVERED', 'CANCELLED', 'FAILED'
);

-- Delivery Domain
CREATE TYPE delivery_status AS ENUM (
  'PENDING', 'DRIVER_ASSIGNED', 'DRIVER_HEADING_TO_RESTAURANT',
  'DRIVER_ARRIVED_RESTAURANT', 'PICKED_UP', 'ON_THE_WAY',
  'ARRIVED_CUSTOMER', 'DELIVERED', 'CANCELLED'
);

CREATE TYPE driver_offer_status AS ENUM (
  'PENDING', 'ACCEPTED', 'DECLINED', 'TIMED_OUT', 'CANCELLED'
);

-- Payment Domain
CREATE TYPE payment_method AS ENUM (
  'CASH_ON_DELIVERY', 'CARD', 'WALLET'
);

CREATE TYPE payment_status AS ENUM (
  'PENDING', 'COLLECTED', 'FAILED', 'REFUNDED',
  'PARTIALLY_REFUNDED', 'CANCELLED'
);

CREATE TYPE commission_type AS ENUM (
  'PERCENTAGE', 'FLAT_FEE'
);

CREATE TYPE payout_status AS ENUM (
  'PENDING', 'PROCESSING', 'PAID', 'FAILED'
);

-- Support Domain
CREATE TYPE support_ticket_status AS ENUM (
  'OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER',
  'RESOLVED', 'CLOSED', 'ESCALATED'
);

-- Notification Domain
CREATE TYPE notification_type AS ENUM (
  'ORDER_PLACED', 'ORDER_ACCEPTED', 'ORDER_REJECTED', 'ORDER_PREPARING',
  'DRIVER_ASSIGNED', 'DRIVER_ARRIVED_RESTAURANT', 'ORDER_PICKED_UP',
  'ORDER_ON_THE_WAY', 'ORDER_DELIVERED', 'ORDER_CANCELLED',
  'DELIVERY_REQUEST', 'DRIVER_APPROVED', 'DRIVER_REJECTED',
  'SYSTEM_ANNOUNCEMENT', 'SUPPORT_REPLY'
);
```

---

## 4. Table-by-Table Schema

---

### 4.1 Identity & Access

#### `users`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | Primary key |
| `phone` | `VARCHAR(20)` | YES | YES | `NULL` | — | YES | E.164 format; null for admin/staff using email only |
| `email` | `VARCHAR(255)` | YES | YES | `NULL` | — | YES | Optional; required for admin/staff |
| `password_hash` | `VARCHAR(255)` | YES | NO | `NULL` | — | NO | bcrypt hash; null for OTP-only users |
| `role` | `user_role` | NO | NO | — | — | YES | Enum role |
| `status` | `user_status` | NO | NO | `'ACTIVE'` | — | YES | Account status |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | Auto-updated by Prisma |
| `deleted_at` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | YES | Soft delete |

**Constraints:**
- `chk_users_phone_or_email`: `phone IS NOT NULL OR email IS NOT NULL` — at least one identifier required
- `uq_users_phone`: unique on `phone` where `phone IS NOT NULL AND deleted_at IS NULL`
- `uq_users_email`: unique on `email` where `email IS NOT NULL AND deleted_at IS NULL`

---

#### `refresh_tokens`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `user_id` | `UUID` | NO | NO | — | `users.id` CASCADE | YES | Token owner |
| `token_hash` | `VARCHAR(255)` | NO | YES | — | — | YES | bcrypt hash of the raw token |
| `device_fingerprint` | `VARCHAR(255)` | YES | NO | `NULL` | — | NO | Optional device identifier |
| `ip_address` | `INET` | YES | NO | `NULL` | — | NO | IP at token creation |
| `expires_at` | `TIMESTAMPTZ` | NO | NO | — | — | NO | 30-day TTL from creation |
| `is_revoked` | `BOOLEAN` | NO | NO | `FALSE` | — | NO | Revocation flag |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

---

#### `otp_codes`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `phone` | `VARCHAR(20)` | NO | NO | — | — | YES | Target phone number |
| `code_hash` | `VARCHAR(255)` | NO | NO | — | — | NO | bcrypt hash of the 6-digit OTP |
| `attempts` | `SMALLINT` | NO | NO | `0` | — | NO | Failed attempt count |
| `expires_at` | `TIMESTAMPTZ` | NO | NO | — | — | NO | 5 minutes from creation |
| `is_used` | `BOOLEAN` | NO | NO | `FALSE` | — | NO | Consumed flag |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

**Notes:** No FK to `users` — OTP may be for a pre-registration phone number. Old OTP records are cleaned up by a scheduled job (every hour, delete `expires_at < NOW()`).

---

#### `device_tokens`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `user_id` | `UUID` | NO | NO | — | `users.id` CASCADE | YES | Token owner |
| `fcm_token` | `VARCHAR(512)` | NO | YES | — | — | YES | Firebase device token |
| `platform` | `VARCHAR(10)` | NO | NO | — | — | NO | `android` or `ios` |
| `last_seen_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | Updated on each login/refresh |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

**Notes:** On FCM `NOT_REGISTERED` error, the backend deletes the stale token row.

---

#### `user_sessions`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `user_id` | `UUID` | NO | NO | — | `users.id` CASCADE | YES | Session owner |
| `device_fingerprint` | `VARCHAR(255)` | YES | NO | `NULL` | — | NO | Device identifier |
| `ip_address` | `INET` | YES | NO | `NULL` | — | NO | Last known IP |
| `last_active_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | Updated on each request |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

---

### 4.2 Customer Domain

#### `customer_profiles`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `user_id` | `UUID` | NO | YES | — | `users.id` CASCADE | YES | 1:1 with users |
| `display_name` | `VARCHAR(100)` | YES | NO | `NULL` | — | NO | Customer's chosen name |
| `profile_photo_url` | `TEXT` | YES | NO | `NULL` | — | NO | CDN URL |
| `default_address_id` | `UUID` | YES | NO | `NULL` | `customer_addresses.id` SET NULL | NO | FK set after first address creation |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |
| `updated_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

**Notes:** `default_address_id` creates a deferred FK cycle with `customer_addresses`. Handle in Prisma with `relationMode = "prisma"` or use a deferred constraint in PostgreSQL.

---

#### `customer_addresses`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `customer_id` | `UUID` | NO | NO | — | `customer_profiles.id` CASCADE | YES | Owner |
| `label` | `VARCHAR(50)` | NO | NO | — | — | NO | e.g., "Home", "Work" |
| `street` | `VARCHAR(255)` | NO | NO | — | — | NO | Street address |
| `city` | `VARCHAR(100)` | NO | NO | — | — | NO | City name |
| `district` | `VARCHAR(100)` | YES | NO | `NULL` | — | NO | Neighborhood/district |
| `landmark` | `VARCHAR(255)` | YES | NO | `NULL` | — | NO | Optional landmark description |
| `latitude` | `DECIMAL(10,7)` | NO | NO | — | — | NO | GPS coordinate |
| `longitude` | `DECIMAL(10,7)` | NO | NO | — | — | NO | GPS coordinate |
| `is_default` | `BOOLEAN` | NO | NO | `FALSE` | — | NO | Default address flag |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |
| `updated_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |
| `deleted_at` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | YES | Soft delete |

**Constraints:**
- `chk_customer_addresses_lat`: `latitude BETWEEN -90 AND 90`
- `chk_customer_addresses_lng`: `longitude BETWEEN -180 AND 180`

---

#### `carts`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `customer_id` | `UUID` | NO | NO | — | `customer_profiles.id` CASCADE | YES | Cart owner |
| `restaurant_id` | `UUID` | NO | NO | — | `restaurants.id` RESTRICT | YES | Cart's restaurant |
| `updated_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

**Constraints:**
- `uq_carts_customer_restaurant`: UNIQUE on `(customer_id, restaurant_id)` — one cart per customer per restaurant

---

#### `cart_items`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `cart_id` | `UUID` | NO | NO | — | `carts.id` CASCADE | YES | Parent cart |
| `product_id` | `UUID` | NO | NO | — | `products.id` RESTRICT | YES | Product reference |
| `quantity` | `SMALLINT` | NO | NO | `1` | — | NO | |
| `selected_modifiers` | `JSONB` | YES | NO | `NULL` | — | NO | Array of `{modifierId, optionId}` selections |
| `notes` | `VARCHAR(300)` | YES | NO | `NULL` | — | NO | Item-level special instructions |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |
| `updated_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

**Constraints:**
- `chk_cart_items_quantity`: `quantity >= 1 AND quantity <= 99`

---

### 4.3 Restaurant Domain

#### `restaurant_categories`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `name` | `VARCHAR(100)` | NO | YES | — | — | NO | e.g., "Fast Food", "Pharmacy" |
| `icon_url` | `TEXT` | YES | NO | `NULL` | — | NO | CDN URL for category icon |
| `sort_order` | `SMALLINT` | NO | NO | `0` | — | NO | Display ordering |
| `is_active` | `BOOLEAN` | NO | NO | `TRUE` | — | NO | Show/hide in app |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |
| `updated_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

---

#### `restaurants`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `category_id` | `UUID` | YES | NO | `NULL` | `restaurant_categories.id` SET NULL | YES | Platform category |
| `name` | `VARCHAR(150)` | NO | NO | — | — | NO | Restaurant display name |
| `description` | `TEXT` | YES | NO | `NULL` | — | NO | Short description |
| `logo_url` | `TEXT` | YES | NO | `NULL` | — | NO | CDN URL |
| `banner_url` | `TEXT` | YES | NO | `NULL` | — | NO | CDN URL |
| `address` | `VARCHAR(500)` | YES | NO | `NULL` | — | NO | Human-readable address text |
| `latitude` | `DECIMAL(10,7)` | YES | NO | `NULL` | — | YES | Restaurant GPS |
| `longitude` | `DECIMAL(10,7)` | YES | NO | `NULL` | — | YES | Restaurant GPS |
| `status` | `restaurant_status` | NO | NO | `'PENDING_APPROVAL'` | — | YES | Current status |
| `commission_rate` | `DECIMAL(5,2)` | YES | NO | `NULL` | — | NO | Override; NULL = use global rule |
| `avg_prep_time_minutes` | `SMALLINT` | YES | NO | `30` | — | NO | Default preparation estimate |
| `min_order_amount` | `DECIMAL(10,2)` | NO | NO | `0` | — | NO | Minimum order subtotal |
| `delivery_fee_override` | `DECIMAL(10,2)` | YES | NO | `NULL` | — | NO | NULL = use platform default |
| `rating` | `DECIMAL(3,2)` | NO | NO | `0.00` | — | NO | Computed average; updated on review |
| `total_reviews` | `INTEGER` | NO | NO | `0` | — | NO | Denormalized count for performance |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |
| `updated_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |
| `deleted_at` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | YES | Soft delete |

**Constraints:**
- `chk_restaurants_rating`: `rating BETWEEN 0 AND 5`
- `chk_restaurants_commission`: `commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 100)`

---

#### `restaurant_staff`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `user_id` | `UUID` | NO | NO | — | `users.id` RESTRICT | YES | Staff user account |
| `restaurant_id` | `UUID` | NO | NO | — | `restaurants.id` RESTRICT | YES | Assigned restaurant |
| `role` | `restaurant_staff_role` | NO | NO | `'STAFF'` | — | NO | Staff role level |
| `permissions` | `JSONB` | YES | NO | `NULL` | — | NO | Fine-grained overrides if needed |
| `is_active` | `BOOLEAN` | NO | NO | `TRUE` | — | NO | Active/deactivated |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |
| `updated_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

**Constraints:**
- `uq_restaurant_staff_user_restaurant`: UNIQUE on `(user_id, restaurant_id)`

---

#### `restaurant_working_hours`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `restaurant_id` | `UUID` | NO | NO | — | `restaurants.id` CASCADE | YES | Owner restaurant |
| `day_of_week` | `SMALLINT` | NO | NO | — | — | NO | 0=Sunday … 6=Saturday |
| `open_time` | `TIME` | YES | NO | `NULL` | — | NO | NULL when `is_closed = true` |
| `close_time` | `TIME` | YES | NO | `NULL` | — | NO | NULL when `is_closed = true` |
| `is_closed` | `BOOLEAN` | NO | NO | `FALSE` | — | NO | Day fully closed |

**Constraints:**
- `uq_restaurant_working_hours_day`: UNIQUE on `(restaurant_id, day_of_week)` — one row per day per restaurant
- `chk_restaurant_working_hours_day`: `day_of_week BETWEEN 0 AND 6`
- `chk_restaurant_working_hours_times`: `is_closed = TRUE OR (open_time IS NOT NULL AND close_time IS NOT NULL)`

---

#### `menu_categories`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `restaurant_id` | `UUID` | NO | NO | — | `restaurants.id` CASCADE | YES | Owner restaurant |
| `name` | `VARCHAR(100)` | NO | NO | — | — | NO | e.g., "Starters", "Mains" |
| `sort_order` | `SMALLINT` | NO | NO | `0` | — | NO | Display order |
| `is_active` | `BOOLEAN` | NO | NO | `TRUE` | — | NO | Show/hide category |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |
| `updated_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

---

#### `products`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `restaurant_id` | `UUID` | NO | NO | — | `restaurants.id` CASCADE | YES | Denormalized for fast queries |
| `menu_category_id` | `UUID` | NO | NO | — | `menu_categories.id` RESTRICT | YES | Menu grouping |
| `name` | `VARCHAR(150)` | NO | NO | — | — | NO | Product name |
| `description` | `TEXT` | YES | NO | `NULL` | — | NO | Product description |
| `price` | `DECIMAL(10,2)` | NO | NO | — | — | NO | Base price before modifiers |
| `is_available` | `BOOLEAN` | NO | NO | `TRUE` | — | YES | Availability toggle |
| `sort_order` | `SMALLINT` | NO | NO | `0` | — | NO | Display order within category |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |
| `updated_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |
| `deleted_at` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | YES | Soft delete |

**Constraints:**
- `chk_products_price`: `price >= 0`

---

#### `product_images`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `product_id` | `UUID` | NO | NO | — | `products.id` CASCADE | YES | Owner product |
| `url` | `TEXT` | NO | NO | — | — | NO | CDN image URL |
| `is_primary` | `BOOLEAN` | NO | NO | `FALSE` | — | NO | Primary display image |
| `sort_order` | `SMALLINT` | NO | NO | `0` | — | NO | Display order |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

---

#### `product_modifiers`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `product_id` | `UUID` | NO | NO | — | `products.id` CASCADE | YES | Owner product |
| `name` | `VARCHAR(100)` | NO | NO | — | — | NO | e.g., "Choose Size" |
| `is_required` | `BOOLEAN` | NO | NO | `FALSE` | — | NO | Customer must select |
| `min_selections` | `SMALLINT` | NO | NO | `0` | — | NO | Minimum selections required |
| `max_selections` | `SMALLINT` | NO | NO | `1` | — | NO | Maximum selections allowed |
| `sort_order` | `SMALLINT` | NO | NO | `0` | — | NO | Display order |

**Constraints:**
- `chk_product_modifiers_selections`: `min_selections <= max_selections AND min_selections >= 0`

---

#### `product_modifier_options`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `modifier_id` | `UUID` | NO | NO | — | `product_modifiers.id` CASCADE | YES | Parent modifier group |
| `name` | `VARCHAR(100)` | NO | NO | — | — | NO | e.g., "Large" |
| `price_adjustment` | `DECIMAL(10,2)` | NO | NO | `0` | — | NO | Added to base price; 0 = no change |
| `is_default` | `BOOLEAN` | NO | NO | `FALSE` | — | NO | Pre-selected option |
| `sort_order` | `SMALLINT` | NO | NO | `0` | — | NO | Display order |

---

### 4.4 Order Domain

#### `orders`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `customer_id` | `UUID` | NO | NO | — | `customer_profiles.id` RESTRICT | YES | Placing customer |
| `restaurant_id` | `UUID` | NO | NO | — | `restaurants.id` RESTRICT | YES | Receiving restaurant |
| `address_id` | `UUID` | YES | NO | — | `customer_addresses.id` SET NULL | NO | Delivery address reference |
| `address_snapshot` | `JSONB` | NO | NO | — | — | NO | Full address at order time |
| `status` | `order_status` | NO | NO | `'PENDING_RESTAURANT'` | — | YES | Current lifecycle status |
| `subtotal` | `DECIMAL(10,2)` | NO | NO | — | — | NO | Sum of item line totals |
| `delivery_fee` | `DECIMAL(10,2)` | NO | NO | — | — | NO | Applied delivery fee |
| `total` | `DECIMAL(10,2)` | NO | NO | — | — | NO | `subtotal + delivery_fee` |
| `payment_method` | `payment_method` | NO | NO | — | — | NO | Selected payment method |
| `delivery_notes` | `VARCHAR(500)` | YES | NO | `NULL` | — | NO | Customer delivery instructions |
| `idempotency_key` | `VARCHAR(100)` | NO | YES | — | — | YES | Client-generated UUID for dedup |
| `estimated_prep_minutes` | `SMALLINT` | YES | NO | `NULL` | — | NO | Set by restaurant on accept |
| `auto_reject_at` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | NO | Auto-reject deadline |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | YES | |
| `updated_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |
| `deleted_at` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | YES | Soft delete (admin only) |

**Constraints:**
- `chk_orders_subtotal_positive`: `subtotal >= 0`
- `chk_orders_delivery_fee_positive`: `delivery_fee >= 0`
- `chk_orders_total_positive`: `total >= 0`
- `chk_orders_total_sum`: `total = subtotal + delivery_fee`
- `uq_orders_idempotency_key`: UNIQUE on `idempotency_key`

---

#### `order_items`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `order_id` | `UUID` | NO | NO | — | `orders.id` CASCADE | YES | Parent order |
| `product_id` | `UUID` | YES | NO | `NULL` | `products.id` SET NULL | NO | Reference; may be null if product deleted |
| `product_name_snapshot` | `VARCHAR(150)` | NO | NO | — | — | NO | Name at order time |
| `unit_price_snapshot` | `DECIMAL(10,2)` | NO | NO | — | — | NO | Price at order time |
| `quantity` | `SMALLINT` | NO | NO | — | — | NO | Ordered quantity |
| `line_total` | `DECIMAL(10,2)` | NO | NO | — | — | NO | `(unit_price + modifier adjustments) × quantity` |
| `notes` | `VARCHAR(300)` | YES | NO | `NULL` | — | NO | Item-level instructions |

**Constraints:**
- `chk_order_items_quantity`: `quantity >= 1`
- `chk_order_items_price`: `unit_price_snapshot >= 0`
- `chk_order_items_line_total`: `line_total >= 0`

---

#### `order_item_modifiers`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `order_item_id` | `UUID` | NO | NO | — | `order_items.id` CASCADE | YES | Parent order item |
| `modifier_name_snapshot` | `VARCHAR(100)` | NO | NO | — | — | NO | Modifier group name at order time |
| `option_name_snapshot` | `VARCHAR(100)` | NO | NO | — | — | NO | Selected option name at order time |
| `price_adjustment_snapshot` | `DECIMAL(10,2)` | NO | NO | `0` | — | NO | Price delta at order time |

---

#### `order_status_history`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `order_id` | `UUID` | NO | NO | — | `orders.id` CASCADE | YES | Parent order |
| `actor_id` | `UUID` | YES | NO | `NULL` | `users.id` SET NULL | NO | Who triggered; null = system |
| `actor_type` | `VARCHAR(30)` | YES | NO | `NULL` | — | NO | `CUSTOMER`, `RESTAURANT`, `DRIVER`, `SYSTEM`, `ADMIN` |
| `from_status` | `order_status` | YES | NO | `NULL` | — | NO | NULL for initial status |
| `to_status` | `order_status` | NO | NO | — | — | NO | New status |
| `note` | `VARCHAR(500)` | YES | NO | `NULL` | — | NO | Optional reason or comment |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | YES | Transition timestamp |

**Notes:** This table is append-only. No UPDATE or DELETE operations are permitted on it.

---

#### `order_cancellations`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `order_id` | `UUID` | NO | YES | — | `orders.id` CASCADE | YES | Cancelled order (1:1) |
| `cancelled_by` | `UUID` | YES | NO | `NULL` | `users.id` SET NULL | NO | Actor user; null = system |
| `actor_type` | `VARCHAR(30)` | NO | NO | — | — | NO | `CUSTOMER`, `ADMIN`, `SYSTEM` |
| `reason` | `VARCHAR(500)` | YES | NO | `NULL` | — | NO | Cancellation reason |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

---

### 4.5 Delivery & Driver Domain

#### `driver_profiles`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `user_id` | `UUID` | NO | YES | — | `users.id` CASCADE | YES | 1:1 with users |
| `display_name` | `VARCHAR(100)` | YES | NO | `NULL` | — | NO | Driver's name |
| `profile_photo_url` | `TEXT` | YES | NO | `NULL` | — | NO | CDN URL |
| `vehicle_type` | `VARCHAR(50)` | YES | NO | `NULL` | — | NO | e.g., "Motorcycle", "Car" |
| `vehicle_plate` | `VARCHAR(30)` | YES | NO | `NULL` | — | NO | License plate number |
| `vehicle_color` | `VARCHAR(50)` | YES | NO | `NULL` | — | NO | Vehicle color |
| `verification_status` | `driver_verification_status` | NO | NO | `'PENDING_REVIEW'` | — | YES | Admin approval state |
| `rejection_reason` | `TEXT` | YES | NO | `NULL` | — | NO | Reason if REJECTED |
| `availability_status` | `driver_availability_status` | NO | NO | `'OFFLINE'` | — | YES | Real-time state |
| `rating` | `DECIMAL(3,2)` | NO | NO | `0.00` | — | NO | Computed average |
| `total_deliveries` | `INTEGER` | NO | NO | `0` | — | NO | Denormalized delivery count |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |
| `updated_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

**Constraints:**
- `chk_driver_profiles_rating`: `rating BETWEEN 0 AND 5`

---

#### `driver_documents`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `driver_id` | `UUID` | NO | NO | — | `driver_profiles.id` CASCADE | YES | Owner driver |
| `document_type` | `document_type` | NO | NO | — | — | NO | Document category |
| `url` | `TEXT` | NO | NO | — | — | NO | Secure CDN URL |
| `original_filename` | `VARCHAR(255)` | YES | NO | `NULL` | — | NO | For reference |
| `uploaded_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

**Constraints:**
- `uq_driver_documents_driver_type`: UNIQUE on `(driver_id, document_type)` — one of each type per driver

---

#### `driver_locations`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `driver_id` | `UUID` | NO | NO | — | `driver_profiles.id` CASCADE | YES | Owner driver |
| `latitude` | `DECIMAL(10,7)` | NO | NO | — | — | NO | GPS latitude |
| `longitude` | `DECIMAL(10,7)` | NO | NO | — | — | NO | GPS longitude |
| `accuracy` | `DECIMAL(6,2)` | YES | NO | `NULL` | — | NO | GPS accuracy in meters |
| `heading` | `DECIMAL(5,2)` | YES | NO | `NULL` | — | NO | Direction 0–360 degrees |
| `speed` | `DECIMAL(6,2)` | YES | NO | `NULL` | — | NO | Speed in km/h |
| `recorded_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | YES | GPS timestamp from device |

**Notes:** This table is append-only (INSERT only). No updates. The live location is always served from Redis (`driver:{driverId}:location`). This table is for audit and history purposes only. Data retention: 7 days (scheduled cleanup job).

---

#### `deliveries`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `order_id` | `UUID` | NO | YES | — | `orders.id` CASCADE | YES | 1:1 with orders |
| `driver_id` | `UUID` | YES | NO | `NULL` | `driver_profiles.id` RESTRICT | YES | Assigned driver; null until assigned |
| `status` | `delivery_status` | NO | NO | `'PENDING'` | — | YES | Delivery lifecycle status |
| `assigned_at` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | NO | When driver accepted |
| `arrived_restaurant_at` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | NO | |
| `picked_up_at` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | NO | |
| `arrived_customer_at` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | NO | |
| `delivered_at` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | NO | |
| `cancelled_at` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | NO | |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |
| `updated_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

---

#### `driver_offers`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `delivery_id` | `UUID` | NO | NO | — | `deliveries.id` CASCADE | YES | Parent delivery |
| `driver_id` | `UUID` | NO | NO | — | `driver_profiles.id` RESTRICT | YES | Offered driver |
| `status` | `driver_offer_status` | NO | NO | `'PENDING'` | — | YES | Offer outcome |
| `offered_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | When the offer was sent |
| `expires_at` | `TIMESTAMPTZ` | NO | NO | — | — | NO | Offer expiry (offered_at + timeout) |
| `responded_at` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | NO | When driver responded |

**Constraints:**
- `uq_driver_offers_delivery_driver`: UNIQUE on `(delivery_id, driver_id)` — same driver can only be offered once per delivery

---

#### `driver_status_history`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `driver_id` | `UUID` | NO | NO | — | `driver_profiles.id` CASCADE | YES | Owner driver |
| `from_status` | `driver_availability_status` | YES | NO | `NULL` | — | NO | Previous status |
| `to_status` | `driver_availability_status` | NO | NO | — | — | NO | New status |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | YES | Transition timestamp |

**Notes:** Append-only. Useful for driver hours worked analytics.

---

#### `driver_earnings`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `delivery_id` | `UUID` | NO | YES | — | `deliveries.id` CASCADE | YES | 1:1 with deliveries |
| `driver_id` | `UUID` | NO | NO | — | `driver_profiles.id` RESTRICT | YES | Earning driver |
| `gross_amount` | `DECIMAL(10,2)` | NO | NO | — | — | NO | Delivery fee charged to customer |
| `commission_deducted` | `DECIMAL(10,2)` | NO | NO | — | — | NO | Platform share |
| `net_amount` | `DECIMAL(10,2)` | NO | NO | — | — | NO | Driver's actual earning |
| `payout_status` | `payout_status` | NO | NO | `'PENDING'` | — | YES | Payment state to driver |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

**Constraints:**
- `chk_driver_earnings_net`: `net_amount = gross_amount - commission_deducted`
- `chk_driver_earnings_amounts`: `gross_amount >= 0 AND commission_deducted >= 0 AND net_amount >= 0`

---

### 4.6 Payment & Finance Domain

#### `payments`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `order_id` | `UUID` | NO | YES | — | `orders.id` RESTRICT | YES | 1:1 with orders |
| `method` | `payment_method` | NO | NO | — | — | NO | Payment method |
| `status` | `payment_status` | NO | NO | `'PENDING'` | — | YES | Current status |
| `amount` | `DECIMAL(10,2)` | NO | NO | — | — | NO | Total amount due |
| `gateway_reference` | `VARCHAR(255)` | YES | NO | `NULL` | — | NO | External payment gateway ID (post-MVP) |
| `collected_at` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | NO | When cash was collected (COD) |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |
| `updated_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

---

#### `payment_events`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `payment_id` | `UUID` | NO | NO | — | `payments.id` CASCADE | YES | Parent payment |
| `from_status` | `payment_status` | YES | NO | `NULL` | — | NO | Previous status |
| `to_status` | `payment_status` | NO | NO | — | — | NO | New status |
| `note` | `VARCHAR(500)` | YES | NO | `NULL` | — | NO | Reason or gateway message |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

**Notes:** Append-only.

---

#### `refunds`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `payment_id` | `UUID` | NO | NO | — | `payments.id` RESTRICT | YES | Parent payment |
| `issued_by` | `UUID` | YES | NO | `NULL` | `users.id` SET NULL | NO | Admin who issued refund |
| `amount` | `DECIMAL(10,2)` | NO | NO | — | — | NO | Refund amount |
| `reason` | `VARCHAR(500)` | YES | NO | `NULL` | — | NO | Reason for refund |
| `gateway_reference` | `VARCHAR(255)` | YES | NO | `NULL` | — | NO | External refund ID |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

---

#### `commissions`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `restaurant_id` | `UUID` | YES | NO | `NULL` | `restaurants.id` CASCADE | YES | NULL = global rule |
| `type` | `commission_type` | NO | NO | `'PERCENTAGE'` | — | NO | Calculation type |
| `rate` | `DECIMAL(5,2)` | YES | NO | `NULL` | — | NO | Percentage value (0–100); used when type = PERCENTAGE |
| `flat_amount` | `DECIMAL(10,2)` | YES | NO | `NULL` | — | NO | Fixed amount; used when type = FLAT_FEE |
| `effective_from` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | When this rule takes effect |
| `effective_to` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | NO | NULL = indefinite |
| `is_active` | `BOOLEAN` | NO | NO | `TRUE` | — | NO | Quick enable/disable |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |

**Constraints:**
- `chk_commissions_rate_or_flat`: `(type = 'PERCENTAGE' AND rate IS NOT NULL) OR (type = 'FLAT_FEE' AND flat_amount IS NOT NULL)`

---

### 4.7 Notification Domain

#### `notifications`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `user_id` | `UUID` | NO | NO | — | `users.id` CASCADE | YES | Recipient |
| `order_id` | `UUID` | YES | NO | `NULL` | `orders.id` SET NULL | NO | Related order (if any) |
| `type` | `notification_type` | NO | NO | — | — | NO | Notification category |
| `title` | `VARCHAR(150)` | NO | NO | — | — | NO | Push notification title |
| `body` | `VARCHAR(500)` | NO | NO | — | — | NO | Push notification body |
| `data` | `JSONB` | YES | NO | `NULL` | — | NO | Deep link payload (orderId, etc.) |
| `is_read` | `BOOLEAN` | NO | NO | `FALSE` | — | YES | Read status |
| `sent_at` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | NO | When FCM/socket send was attempted |
| `read_at` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | NO | When user read it |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | YES | |

---

### 4.8 Support & Admin Domain

#### `support_tickets`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `reporter_id` | `UUID` | NO | NO | — | `users.id` RESTRICT | YES | Who opened the ticket |
| `order_id` | `UUID` | YES | NO | `NULL` | `orders.id` SET NULL | YES | Related order (optional) |
| `assigned_to` | `UUID` | YES | NO | `NULL` | `users.id` SET NULL | NO | Support agent |
| `status` | `support_ticket_status` | NO | NO | `'OPEN'` | — | YES | Current status |
| `type` | `VARCHAR(50)` | NO | NO | — | — | NO | e.g., `ORDER_ISSUE`, `PAYMENT`, `OTHER` |
| `subject` | `VARCHAR(200)` | NO | NO | — | — | NO | Ticket subject |
| `description` | `TEXT` | NO | NO | — | — | NO | Detailed description |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | YES | |
| `updated_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | |
| `resolved_at` | `TIMESTAMPTZ` | YES | NO | `NULL` | — | NO | Resolution timestamp |

---

#### `support_messages`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `ticket_id` | `UUID` | NO | NO | — | `support_tickets.id` CASCADE | YES | Parent ticket |
| `sender_id` | `UUID` | NO | NO | — | `users.id` RESTRICT | NO | Message author |
| `message` | `TEXT` | NO | NO | — | — | NO | Message content |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | YES | |

---

#### `audit_logs`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `admin_id` | `UUID` | NO | NO | — | `users.id` RESTRICT | YES | Acting admin |
| `action` | `VARCHAR(100)` | NO | NO | — | — | NO | Action description e.g., `ORDER_CANCELLED` |
| `entity_type` | `VARCHAR(50)` | NO | NO | — | — | YES | e.g., `ORDER`, `USER`, `DRIVER` |
| `entity_id` | `UUID` | YES | NO | `NULL` | — | YES | Target entity's UUID |
| `before_value` | `JSONB` | YES | NO | `NULL` | — | NO | State before action |
| `after_value` | `JSONB` | YES | NO | `NULL` | — | NO | State after action |
| `ip_address` | `INET` | YES | NO | `NULL` | — | NO | Admin's IP |
| `user_agent` | `VARCHAR(500)` | YES | NO | `NULL` | — | NO | Browser/client info |
| `created_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | YES | Immutable timestamp |

**Notes:** This table is INSERT-only. No UPDATE or DELETE operations are ever permitted. Any attempt should be rejected at the service layer.

---

#### `platform_settings`

| Column | PG Type | Nullable | Unique | Default | FK | Index | Description |
|--------|---------|----------|--------|---------|-----|-------|-------------|
| `id` | `UUID` | NO | YES (PK) | `gen_random_uuid()` | — | PK | |
| `key` | `VARCHAR(100)` | NO | YES | — | — | YES | Setting key e.g., `dispatch_radius_km` |
| `value` | `TEXT` | NO | NO | — | — | NO | String representation of value |
| `data_type` | `VARCHAR(20)` | NO | NO | `'string'` | — | NO | `string`, `number`, `boolean`, `json` |
| `description` | `VARCHAR(500)` | YES | NO | `NULL` | — | NO | Human-readable purpose |
| `updated_at` | `TIMESTAMPTZ` | NO | NO | `NOW()` | — | NO | Last modified |
| `updated_by` | `UUID` | YES | NO | `NULL` | `users.id` SET NULL | NO | Admin who last changed this |

---

## 5. Constraints Reference

### Primary Keys (all tables)
Every table has `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.

### Unique Constraints

| Table | Columns | Constraint Name |
|-------|---------|----------------|
| `users` | `phone` (partial: not null + not deleted) | `uq_users_phone` |
| `users` | `email` (partial: not null + not deleted) | `uq_users_email` |
| `refresh_tokens` | `token_hash` | `uq_refresh_tokens_hash` |
| `device_tokens` | `fcm_token` | `uq_device_tokens_fcm` |
| `customer_profiles` | `user_id` | `uq_customer_profiles_user_id` |
| `carts` | `(customer_id, restaurant_id)` | `uq_carts_customer_restaurant` |
| `restaurant_staff` | `(user_id, restaurant_id)` | `uq_restaurant_staff_user_restaurant` |
| `restaurant_working_hours` | `(restaurant_id, day_of_week)` | `uq_restaurant_working_hours_day` |
| `driver_profiles` | `user_id` | `uq_driver_profiles_user_id` |
| `driver_documents` | `(driver_id, document_type)` | `uq_driver_documents_driver_type` |
| `driver_offers` | `(delivery_id, driver_id)` | `uq_driver_offers_delivery_driver` |
| `deliveries` | `order_id` | `uq_deliveries_order_id` |
| `driver_earnings` | `delivery_id` | `uq_driver_earnings_delivery_id` |
| `payments` | `order_id` | `uq_payments_order_id` |
| `orders` | `idempotency_key` | `uq_orders_idempotency_key` |
| `order_cancellations` | `order_id` | `uq_order_cancellations_order_id` |
| `restaurant_categories` | `name` | `uq_restaurant_categories_name` |
| `platform_settings` | `key` | `uq_platform_settings_key` |

### Check Constraints

| Table | Constraint Name | Rule |
|-------|----------------|------|
| `users` | `chk_users_phone_or_email` | `phone IS NOT NULL OR email IS NOT NULL` |
| `customer_addresses` | `chk_addresses_lat` | `latitude BETWEEN -90 AND 90` |
| `customer_addresses` | `chk_addresses_lng` | `longitude BETWEEN -180 AND 180` |
| `cart_items` | `chk_cart_items_quantity` | `quantity BETWEEN 1 AND 99` |
| `restaurants` | `chk_restaurants_rating` | `rating BETWEEN 0 AND 5` |
| `restaurants` | `chk_restaurants_commission` | `commission_rate IS NULL OR commission_rate BETWEEN 0 AND 100` |
| `restaurant_working_hours` | `chk_working_hours_day` | `day_of_week BETWEEN 0 AND 6` |
| `restaurant_working_hours` | `chk_working_hours_times` | `is_closed = TRUE OR (open_time IS NOT NULL AND close_time IS NOT NULL)` |
| `products` | `chk_products_price` | `price >= 0` |
| `product_modifiers` | `chk_modifiers_selections` | `min_selections >= 0 AND min_selections <= max_selections` |
| `orders` | `chk_orders_total_sum` | `total = subtotal + delivery_fee` |
| `orders` | `chk_orders_subtotal_positive` | `subtotal >= 0` |
| `order_items` | `chk_order_items_quantity` | `quantity >= 1` |
| `order_items` | `chk_order_items_price` | `unit_price_snapshot >= 0` |
| `driver_profiles` | `chk_driver_rating` | `rating BETWEEN 0 AND 5` |
| `driver_earnings` | `chk_earnings_net` | `net_amount = gross_amount - commission_deducted` |
| `driver_earnings` | `chk_earnings_amounts` | `gross_amount >= 0 AND commission_deducted >= 0 AND net_amount >= 0` |
| `commissions` | `chk_commissions_value` | `(type = 'PERCENTAGE' AND rate IS NOT NULL) OR (type = 'FLAT_FEE' AND flat_amount IS NOT NULL)` |

---

## 6. Complete Index List

```sql
-- users
CREATE UNIQUE INDEX uq_users_phone ON users(phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_users_email ON users(email) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- refresh_tokens
CREATE UNIQUE INDEX uq_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- device_tokens
CREATE UNIQUE INDEX uq_device_tokens_fcm ON device_tokens(fcm_token);
CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id);

-- otp_codes
CREATE INDEX idx_otp_codes_phone ON otp_codes(phone);
CREATE INDEX idx_otp_codes_expires_at ON otp_codes(expires_at);

-- customer_profiles
CREATE UNIQUE INDEX uq_customer_profiles_user_id ON customer_profiles(user_id);

-- customer_addresses
CREATE INDEX idx_customer_addresses_customer_id ON customer_addresses(customer_id);
CREATE INDEX idx_customer_addresses_deleted_at ON customer_addresses(deleted_at) WHERE deleted_at IS NOT NULL;

-- carts
CREATE UNIQUE INDEX uq_carts_customer_restaurant ON carts(customer_id, restaurant_id);
CREATE INDEX idx_carts_customer_id ON carts(customer_id);

-- cart_items
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);

-- restaurants
CREATE INDEX idx_restaurants_status ON restaurants(status);
CREATE INDEX idx_restaurants_category_id ON restaurants(category_id);
CREATE INDEX idx_restaurants_latitude_longitude ON restaurants(latitude, longitude);
CREATE INDEX idx_restaurants_deleted_at ON restaurants(deleted_at) WHERE deleted_at IS NOT NULL;

-- restaurant_staff
CREATE UNIQUE INDEX uq_restaurant_staff_user_restaurant ON restaurant_staff(user_id, restaurant_id);
CREATE INDEX idx_restaurant_staff_user_id ON restaurant_staff(user_id);
CREATE INDEX idx_restaurant_staff_restaurant_id ON restaurant_staff(restaurant_id);

-- restaurant_working_hours
CREATE UNIQUE INDEX uq_restaurant_working_hours_day ON restaurant_working_hours(restaurant_id, day_of_week);
CREATE INDEX idx_restaurant_working_hours_restaurant_id ON restaurant_working_hours(restaurant_id);

-- menu_categories
CREATE INDEX idx_menu_categories_restaurant_id ON menu_categories(restaurant_id);

-- products
CREATE INDEX idx_products_restaurant_id ON products(restaurant_id);
CREATE INDEX idx_products_menu_category_id ON products(menu_category_id);
CREATE INDEX idx_products_is_available ON products(is_available);
CREATE INDEX idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NOT NULL;

-- product_modifiers
CREATE INDEX idx_product_modifiers_product_id ON product_modifiers(product_id);

-- product_modifier_options
CREATE INDEX idx_product_modifier_options_modifier_id ON product_modifier_options(modifier_id);

-- orders
CREATE UNIQUE INDEX uq_orders_idempotency_key ON orders(idempotency_key);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_deleted_at ON orders(deleted_at) WHERE deleted_at IS NOT NULL;
-- Composite for restaurant order list (most common query):
CREATE INDEX idx_orders_restaurant_status ON orders(restaurant_id, status, created_at DESC);

-- order_items
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- order_item_modifiers
CREATE INDEX idx_order_item_modifiers_order_item_id ON order_item_modifiers(order_item_id);

-- order_status_history
CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_created_at ON order_status_history(created_at DESC);

-- order_cancellations
CREATE UNIQUE INDEX uq_order_cancellations_order_id ON order_cancellations(order_id);

-- driver_profiles
CREATE UNIQUE INDEX uq_driver_profiles_user_id ON driver_profiles(user_id);
CREATE INDEX idx_driver_profiles_verification_status ON driver_profiles(verification_status);
CREATE INDEX idx_driver_profiles_availability_status ON driver_profiles(availability_status);

-- driver_documents
CREATE UNIQUE INDEX uq_driver_documents_driver_type ON driver_documents(driver_id, document_type);
CREATE INDEX idx_driver_documents_driver_id ON driver_documents(driver_id);

-- driver_locations
CREATE INDEX idx_driver_locations_driver_id ON driver_locations(driver_id);
CREATE INDEX idx_driver_locations_recorded_at ON driver_locations(recorded_at DESC);

-- deliveries
CREATE UNIQUE INDEX uq_deliveries_order_id ON deliveries(order_id);
CREATE INDEX idx_deliveries_driver_id ON deliveries(driver_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);

-- driver_offers
CREATE UNIQUE INDEX uq_driver_offers_delivery_driver ON driver_offers(delivery_id, driver_id);
CREATE INDEX idx_driver_offers_delivery_id ON driver_offers(delivery_id);
CREATE INDEX idx_driver_offers_driver_id ON driver_offers(driver_id);
CREATE INDEX idx_driver_offers_status ON driver_offers(status);

-- driver_status_history
CREATE INDEX idx_driver_status_history_driver_id ON driver_status_history(driver_id);
CREATE INDEX idx_driver_status_history_created_at ON driver_status_history(created_at DESC);

-- driver_earnings
CREATE UNIQUE INDEX uq_driver_earnings_delivery_id ON driver_earnings(delivery_id);
CREATE INDEX idx_driver_earnings_driver_id ON driver_earnings(driver_id);
CREATE INDEX idx_driver_earnings_payout_status ON driver_earnings(payout_status);

-- payments
CREATE UNIQUE INDEX uq_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_method ON payments(method);

-- payment_events
CREATE INDEX idx_payment_events_payment_id ON payment_events(payment_id);

-- commissions
CREATE INDEX idx_commissions_restaurant_id ON commissions(restaurant_id);
CREATE INDEX idx_commissions_is_active ON commissions(is_active);

-- notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- support_tickets
CREATE INDEX idx_support_tickets_reporter_id ON support_tickets(reporter_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_order_id ON support_tickets(order_id);

-- support_messages
CREATE INDEX idx_support_messages_ticket_id ON support_messages(ticket_id);

-- audit_logs
CREATE INDEX idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- platform_settings
CREATE UNIQUE INDEX uq_platform_settings_key ON platform_settings(key);
```

---

## 7. Prisma Mapping Notes

### 7.1 Schema File Structure

```
prisma/
├── schema.prisma          # Main schema file
├── migrations/            # Auto-generated migration files
│   ├── 20260507000001_init/
│   └── 20260507000002_add_driver_earnings/
└── seed.ts                # Seed data script
```

### 7.2 Prisma Model Naming

| PostgreSQL Table | Prisma Model |
|-----------------|-------------|
| `users` | `User` |
| `refresh_tokens` | `RefreshToken` |
| `otp_codes` | `OtpCode` |
| `device_tokens` | `DeviceToken` |
| `customer_profiles` | `CustomerProfile` |
| `customer_addresses` | `CustomerAddress` |
| `carts` | `Cart` |
| `cart_items` | `CartItem` |
| `restaurants` | `Restaurant` |
| `restaurant_staff` | `RestaurantStaff` |
| `restaurant_categories` | `RestaurantCategory` |
| `restaurant_working_hours` | `RestaurantWorkingHours` |
| `menu_categories` | `MenuCategory` |
| `products` | `Product` |
| `product_images` | `ProductImage` |
| `product_modifiers` | `ProductModifier` |
| `product_modifier_options` | `ProductModifierOption` |
| `orders` | `Order` |
| `order_items` | `OrderItem` |
| `order_item_modifiers` | `OrderItemModifier` |
| `order_status_history` | `OrderStatusHistory` |
| `order_cancellations` | `OrderCancellation` |
| `driver_profiles` | `DriverProfile` |
| `driver_documents` | `DriverDocument` |
| `driver_locations` | `DriverLocation` |
| `deliveries` | `Delivery` |
| `driver_offers` | `DriverOffer` |
| `driver_status_history` | `DriverStatusHistory` |
| `driver_earnings` | `DriverEarning` |
| `payments` | `Payment` |
| `payment_events` | `PaymentEvent` |
| `refunds` | `Refund` |
| `commissions` | `Commission` |
| `notifications` | `Notification` |
| `support_tickets` | `SupportTicket` |
| `support_messages` | `SupportMessage` |
| `audit_logs` | `AuditLog` |
| `platform_settings` | `PlatformSetting` |

### 7.3 Decimal Handling for Money

```prisma
// Use Decimal type — never Float for monetary fields
subtotal    Decimal   @db.Decimal(10, 2)
delivery_fee Decimal  @db.Decimal(10, 2)
total       Decimal   @db.Decimal(10, 2)
price       Decimal   @db.Decimal(10, 2)
```

In service code, always use the `Decimal` class from `@prisma/client/runtime/library` for arithmetic — never convert to JavaScript `number` for money calculations.

### 7.4 JSONB Fields

```prisma
// JSONB fields use Json type in Prisma
address_snapshot  Json
selected_modifiers Json?
data              Json?
before_value      Json?
after_value       Json?
permissions       Json?
```

Define TypeScript interfaces for each JSONB payload in `src/common/types/json-fields.types.ts` to maintain type safety.

### 7.5 Enum Definition in Prisma

```prisma
enum UserRole {
  CUSTOMER
  RESTAURANT_OWNER
  RESTAURANT_STAFF
  DRIVER
  ADMIN
  SUPER_ADMIN
  SUPPORT
}

// In model:
model User {
  role UserRole
}
```

Prisma generates the PostgreSQL enum automatically during migration.

### 7.6 Soft Delete Convention

Prisma does not have built-in soft delete middleware in v5. Implement a Prisma extension or a global middleware:

```typescript
// In PrismaService, extend the client to filter soft-deleted records:
prisma.$extends({
  query: {
    user: {
      async findMany({ args, query }) {
        args.where = { ...args.where, deleted_at: null };
        return query(args);
      }
    }
  }
})
```

Or use the `prisma-soft-delete-middleware` package. Apply only to tables that have `deleted_at`.

### 7.7 Relation Fields

```prisma
model Order {
  id                String              @id @default(uuid())
  customer          CustomerProfile     @relation(fields: [customer_id], references: [id])
  customer_id       String
  restaurant        Restaurant          @relation(fields: [restaurant_id], references: [id])
  restaurant_id     String
  items             OrderItem[]
  status_history    OrderStatusHistory[]
  delivery          Delivery?
  payment           Payment?
  cancellation      OrderCancellation?
  @@map("orders")
}
```

### 7.8 Composite Unique in Prisma

```prisma
model Cart {
  @@unique([customer_id, restaurant_id])
}

model RestaurantWorkingHours {
  @@unique([restaurant_id, day_of_week])
}
```

### 7.9 Partial Unique Indexes

Prisma does not support partial indexes (WHERE clause) natively. Create them via raw SQL in a migration file:

```sql
-- In migration file (do not let Prisma manage these):
CREATE UNIQUE INDEX uq_users_phone
  ON users(phone)
  WHERE phone IS NOT NULL AND deleted_at IS NULL;
```

Mark these in the Prisma schema with `@@ignore` or add a comment so Prisma does not try to drop them.

---

## 8. Initial Seed Data

The seed script (`prisma/seed.ts`) runs once in development and staging to populate baseline data.

### 8.1 Platform Settings

```typescript
const settings = [
  { key: 'default_commission_rate',      value: '15',   data_type: 'number',  description: 'Platform commission % on each order' },
  { key: 'default_delivery_fee',         value: '2000', data_type: 'number',  description: 'Default delivery fee in local currency' },
  { key: 'dispatch_radius_km',           value: '5',    data_type: 'number',  description: 'Initial search radius for drivers (km)' },
  { key: 'dispatch_timeout_seconds',     value: '30',   data_type: 'number',  description: 'Seconds before a driver offer expires' },
  { key: 'auto_reject_timeout_seconds',  value: '180',  data_type: 'number',  description: 'Seconds before auto-rejecting a restaurant pending order' },
  { key: 'max_dispatch_retries',         value: '5',    data_type: 'number',  description: 'Max drivers to try before failing dispatch' },
  { key: 'dispatch_radius_expansion_km', value: '2',    data_type: 'number',  description: 'Radius increment on each retry (km)' },
  { key: 'max_saved_addresses',          value: '5',    data_type: 'number',  description: 'Max saved addresses per customer' },
  { key: 'driver_location_ttl_minutes',  value: '2',    data_type: 'number',  description: 'Redis TTL for live driver location' },
];
```

### 8.2 Restaurant Categories

```typescript
const categories = [
  { name: 'Fast Food',   icon_url: '/icons/fast-food.svg',  sort_order: 1 },
  { name: 'Grills',      icon_url: '/icons/grills.svg',     sort_order: 2 },
  { name: 'Shawarma',    icon_url: '/icons/shawarma.svg',   sort_order: 3 },
  { name: 'Pizza',       icon_url: '/icons/pizza.svg',      sort_order: 4 },
  { name: 'Burgers',     icon_url: '/icons/burger.svg',     sort_order: 5 },
  { name: 'Sandwiches',  icon_url: '/icons/sandwich.svg',   sort_order: 6 },
  { name: 'Sweets',      icon_url: '/icons/sweets.svg',     sort_order: 7 },
  { name: 'Drinks',      icon_url: '/icons/drinks.svg',     sort_order: 8 },
  { name: 'Grocery',     icon_url: '/icons/grocery.svg',    sort_order: 9 },
  { name: 'Pharmacy',    icon_url: '/icons/pharmacy.svg',   sort_order: 10 },
];
```

### 8.3 Super Admin User

```typescript
const superAdmin = {
  email: process.env.SEED_ADMIN_EMAIL,         // from .env
  password_hash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 12),
  role: 'SUPER_ADMIN',
  status: 'ACTIVE',
};
```

**Important:** `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` must be set in `.env` and must never be committed to the repository. The production admin account must be created with a strong, unique password that is immediately changed after first login.

### 8.4 Sample Restaurant (Development Only)

```typescript
// Only seeded when NODE_ENV = 'development'
const devRestaurant = {
  name: 'Test Restaurant',
  status: 'OPEN',
  latitude: 33.3152,
  longitude: 44.3661,
  avg_prep_time_minutes: 20,
  min_order_amount: 0,
  delivery_fee_override: 1000,
};
```

### 8.5 Global Commission Rule

```typescript
const globalCommission = {
  restaurant_id: null,       // null = global
  type: 'PERCENTAGE',
  rate: 15.0,
  is_active: true,
  effective_from: new Date(),
};
```

---

## 9. Migration Strategy

### 9.1 Migration Naming Convention

Migrations are named with a timestamp prefix and a descriptive slug:

```
20260507000001_init_identity_and_auth
20260507000002_init_restaurant_and_menu
20260507000003_init_orders
20260507000004_init_delivery_and_drivers
20260507000005_init_payments
20260507000006_init_notifications
20260507000007_init_support_and_admin
20260507000008_add_partial_indexes
```

### 9.2 Local Development Workflow

```bash
# 1. Modify prisma/schema.prisma
# 2. Generate a new migration (does NOT apply it yet)
npx prisma migrate dev --name add_driver_zone_support

# 3. Apply migration + regenerate Prisma client
npx prisma migrate dev

# 4. Run seed script
npx prisma db seed

# 5. Open Prisma Studio to inspect data
npx prisma studio
```

### 9.3 Staging / Production Workflow

```bash
# CI/CD pipeline step — runs migrations before deploying new code

# 1. Deploy migration only (no code change yet)
npx prisma migrate deploy

# 2. Deploy new application code
# 3. Verify application health
# 4. If something breaks: roll back application code (migration is NOT auto-rolled back)
```

### 9.4 Rollback Caution

**Prisma does not have automatic rollback.** Every migration is designed to be backward-compatible with the previous version of the application code (expand/contract pattern):

- **Expand phase:** Add new columns as NULLABLE or with defaults. Both old and new code can run.
- **Migrate phase:** Deploy new code that uses the new columns.
- **Contract phase:** After new code is fully deployed, add NOT NULL constraints or drop old columns.

Never drop a column and deploy new code in the same migration. Always separate them into two deployments.

### 9.5 Backup Before Migration

```bash
# Always run a full database backup before applying migrations to production:
pg_dump -Fc -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).dump

# Restore if needed:
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME backup_20260507_120000.dump
```

### 9.6 Manual SQL in Migrations

Some operations (partial indexes, custom sequences, triggers) cannot be expressed in Prisma schema. Add them as raw SQL in the migration file:

```sql
-- Inside generated migration SQL file, append:

-- Partial unique index for soft-deleted users
CREATE UNIQUE INDEX uq_users_phone
  ON users(phone)
  WHERE phone IS NOT NULL AND deleted_at IS NULL;

-- Set driver location retention policy (handled by cleanup job, not DB trigger)
-- No trigger needed — cleanup job is in the application layer.
```

### 9.7 Data-Only Migrations

When migrating data (not schema), use a separate migration with only DML:

```bash
npx prisma migrate dev --name backfill_order_address_snapshots
# Edit the generated migration file to add UPDATE statements
```

---

## 10. Assumptions

- PostgreSQL 15 is the minimum version. The schema uses `gen_random_uuid()` which requires the `pgcrypto` extension (included in pg 13+).
- All timestamps are stored as `TIMESTAMPTZ` (UTC internally). The application layer converts to the user's local timezone for display.
- The `driver_locations` table will grow rapidly. A background job must purge rows older than 7 days on a daily schedule.
- `DECIMAL(10,2)` for monetary fields assumes the local currency's smallest transaction is 0.01 of the base unit. If the currency uses no fractional units (e.g., IQD where 1 IQD ≈ the smallest practical amount), storing as `INTEGER` instead could be considered.
- The `address_snapshot` JSONB column on `orders` stores: `{ street, city, district, landmark, latitude, longitude }`.
- Prisma's `@updatedAt` decorator is used on all `updated_at` columns — Prisma automatically sets this field on every UPDATE.
- The `rating` and `total_reviews` on `restaurants` and `driver_profiles` are denormalized counters updated in the application layer after each review. They are eventually consistent but acceptable for this use case.

---

## 11. Open Questions

| # | Question | Impact | Who to Ask |
|---|---------|--------|-----------|
| 1 | Should `orders` use integer amounts (smallest currency unit) instead of DECIMAL to avoid any precision issue? | Schema-wide money type decision | Engineering / Finance |
| 2 | Is there a requirement to support multiple currencies in the future? | Would need a `currency` column on `orders` and `payments` | Product Owner |
| 3 | Should `driver_locations` use a time-series extension (TimescaleDB) for more efficient append-only queries? | Requires PostgreSQL extension setup | DevOps / Engineering |
| 4 | What is the legal data retention requirement for `audit_logs` and `driver_locations`? | Cleanup job schedules | Legal / Compliance |
| 5 | Should `restaurant_staff` support a driver being linked to a restaurant (e.g., for restaurant-owned delivery staff)? | Cross-domain role complexity | Product Owner |
| 6 | Is the `order_status` machine the same for both restaurant-owned delivery and platform-driver delivery? | Schema branching | Product Owner |
| 7 | Should `product_images` have a maximum count enforced at the database level? | `CHECK` constraint | Product / UX |
| 8 | Is there a requirement for multi-language product names/descriptions (Arabic + English)? | Would need `name_ar`, `name_en` columns or a separate `translations` table | Product Owner |
| 9 | Should `notifications` have a max retention period (e.g., 90 days)? | Cleanup job + storage cost | Product / DevOps |
| 10 | Should `commissions` support different rates for delivery fee vs. item subtotal? | Commission calculation complexity | Finance / Product Owner |

---

## ملخص الملف

**ما هدف هذا الملف؟**

هذا الملف هو **التعريف التفصيلي الكامل لكل جدول في قاعدة البيانات** — ينزل من مستوى التصميم إلى مستوى التنفيذ الفعلي.

يحتوي على:
- اسم كل جدول والأعمدة (columns) التي بداخله
- نوع البيانات لكل عمود (VARCHAR، INTEGER، DECIMAL، TIMESTAMP...)
- القيود (Constraints): NOT NULL، UNIQUE، FOREIGN KEY، CHECK
- الفهارس (Indexes) المطلوبة لتسريع الاستعلامات
- القيم الافتراضية والـ Enums (مثل حالات الأوردر)
- ملاحظات مهمة عن كل جدول وسبب قراراته التصميمية

**الفرق بينه وبين ERD:**
- ERD = رسم يوضح العلاقات بشكل مرئي عالي المستوى
- DATABASE_SCHEMA = الكود التفصيلي لكل جدول — هو ما يُترجم مباشرة إلى Prisma Schema

**من يقرأه؟** المهندس الباكند مباشرة عند كتابة `schema.prisma` وإنشاء الـ Migrations.

**القاعدة:** كل جدول في قاعدة البيانات يجب أن يكون موثقاً هنا قبل إنشائه في Prisma.
