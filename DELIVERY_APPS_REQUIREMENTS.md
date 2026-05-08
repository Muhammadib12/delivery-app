# DELIVERY PLATFORM — COMPLETE PRODUCT & TECHNICAL REQUIREMENTS

> **Document Status:** Draft v1.0  
> **Date:** 2026-05-07  
> **Audience:** Product Managers, Lead Developers, Backend Engineers, Mobile Engineers, DevOps  
> **Purpose:** Full product and technical specification for a local food/order delivery platform.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Platform Components](#2-platform-components)
3. [User Roles](#3-user-roles)
4. [Customer App Requirements](#4-customer-app-requirements)
5. [Restaurant / Store App Requirements](#5-restaurant--store-app-requirements)
6. [Driver App Requirements](#6-driver-app-requirements)
7. [Admin Dashboard Requirements](#7-admin-dashboard-requirements)
8. [Order Lifecycle](#8-order-lifecycle)
9. [Delivery Dispatch Flow](#9-delivery-dispatch-flow)
10. [Realtime Communication Requirements](#10-realtime-communication-requirements)
11. [Push Notification Requirements](#11-push-notification-requirements)
12. [Offline / Weak Internet Strategy](#12-offline--weak-internet-strategy)
13. [Location Tracking Strategy](#13-location-tracking-strategy)
14. [Authentication and Security](#14-authentication-and-security)
15. [Payment Requirements](#15-payment-requirements)
16. [Data Requirements](#16-data-requirements)
17. [API Requirements Overview](#17-api-requirements-overview)
18. [Suggested Backend Module Structure](#18-suggested-backend-module-structure)
19. [Suggested Flutter App Structure](#19-suggested-flutter-app-structure)
20. [MVP Scope](#20-mvp-scope)
21. [Infrastructure, Technologies & Cost Estimation](#21-infrastructure-technologies--cost-estimation)
22. [Risks and Important Notes](#22-risks-and-important-notes)
23. [Final Recommendation](#23-final-recommendation)

---

## 1. Project Overview

### Business Idea

This platform is a **local food and order delivery service** targeting a single city or country. It connects three primary actors:

- **Customers** who want to order food or products from local restaurants and stores.
- **Restaurants/Stores** who want to receive orders, manage preparation, and request drivers for delivery.
- **Drivers** who want to earn income by picking up orders from restaurants/stores and delivering them to customers.

The platform acts as the intermediary that coordinates the full delivery lifecycle — from the moment a customer places an order to the moment the driver hands it over.

### Business Goals

| Goal | Description |
|------|-------------|
| Increase restaurant reach | Allow local restaurants and stores to accept orders beyond walk-in customers |
| Enable driver income | Provide a structured, transparent way for independent drivers to earn |
| Create customer convenience | Offer fast, trackable delivery with cash or online payment |
| Platform monetization | Earn commission on each order and optionally subscription fees from restaurants |
| Build local trust | In markets with weak infrastructure, build a reliable and simple experience |

### How the Three Apps Work Together

```
Customer places order
        │
        ▼
Backend receives order → Notifies Restaurant App
        │
        ▼
Restaurant accepts → Marks preparing → Requests driver
        │
        ▼
Backend dispatches to nearby available Driver
        │
        ▼
Driver accepts → Navigates to restaurant → Picks up order
        │
        ▼
Driver navigates to customer → Delivers → Marks delivered
        │
        ▼
Customer receives delivery → Reviews service
```

All three apps communicate through the backend in real time via Socket.IO events and Firebase Cloud Messaging push notifications, ensuring that each actor is always aware of the current state of the order.

---

## 2. Platform Components

### 2.1 Customer App (Flutter — Mobile)

A mobile application for end customers. It is the primary revenue-generating interface. Customers use it to browse, order, pay, and track their deliveries. The app must be fast, simple, and functional even in poor connectivity conditions.

### 2.2 Restaurant / Store App (Flutter — Mobile)

A mobile application for restaurant owners and their staff. It receives incoming orders in real time, allows staff to manage preparation status, request drivers, manage the menu, and control restaurant availability. The app must work reliably with low data usage.

### 2.3 Driver App (Flutter — Mobile)

A mobile application for delivery drivers. It manages driver availability, presents delivery requests, provides navigation flow, and tracks earnings. The app must be extremely battery and data-efficient, since drivers use it for long shifts.

### 2.4 Admin Dashboard (Web — React or Next.js)

A web-based control panel for platform administrators. It provides full visibility into all orders, users, drivers, restaurants, payments, disputes, and platform settings. This is an internal tool used by operations and support teams.

### 2.5 Backend API (Node.js + NestJS + TypeScript)

The core API server. It handles all business logic, authentication, order management, dispatch logic, payment tracking, and serves as the bridge between all apps. Built on NestJS for modularity and scalability.

### 2.6 Database (PostgreSQL + Prisma ORM)

The primary persistent data store. PostgreSQL is chosen for its reliability, ACID compliance, strong support for relational data, and wide hosting availability. Prisma ORM provides type-safe database access and clean migration management.

### 2.7 Realtime Layer (Socket.IO)

Socket.IO is used for bidirectional, event-driven communication between the backend and the three mobile apps. It handles all live order status updates, driver location streaming to customers and restaurants, and any time-sensitive events.

### 2.8 Notification System (Firebase Cloud Messaging — FCM)

FCM is used to deliver push notifications to all three apps even when they are backgrounded or offline. It serves as the fallback channel when the Socket.IO connection is not available. Notifications are triggered server-side by the backend.

### 2.9 Location Tracking System

Driver location is tracked via the Driver App using the device GPS. Location updates are pushed to the backend via Socket.IO at a configurable frequency. The backend stores the latest known location in Redis for fast access and relays it to the Customer App and Restaurant App for live tracking.

---

## 3. User Roles

### 3.1 Guest Customer

| Attribute | Detail |
|-----------|--------|
| Description | An unauthenticated user browsing the app |
| Permissions | Browse restaurant list, view menus and products, view restaurant details |
| Limitations | Cannot place orders, cannot access cart, cannot view order history, cannot write reviews |
| Authentication required? | No, but required before checkout |

### 3.2 Registered Customer

| Attribute | Detail |
|-----------|--------|
| Description | An authenticated customer with a verified account |
| Permissions | Browse, search, add to cart, place orders, track orders, track driver, view order history, leave reviews, manage saved addresses, manage profile |
| Limitations | Cannot access restaurant management or driver functions |
| Authentication required? | Yes — via phone OTP or email/password |

### 3.3 Restaurant Owner

| Attribute | Detail |
|-----------|--------|
| Description | The owner of a registered restaurant or store |
| Permissions | Full control of restaurant settings, working hours, menu, product availability, order management, earnings view, staff management |
| Limitations | Cannot access other restaurants or admin settings |
| Authentication required? | Yes — dedicated restaurant app login |

### 3.4 Restaurant Staff

| Attribute | Detail |
|-----------|--------|
| Description | An employee assigned to a restaurant by the owner |
| Permissions | View incoming orders, accept/reject orders, update preparation status, request driver, view assigned driver |
| Limitations | Cannot modify menu, cannot access earnings, cannot manage working hours or restaurant profile (unless owner grants permission) |
| Authentication required? | Yes — staff credentials linked to a specific restaurant |

### 3.5 Driver

| Attribute | Detail |
|-----------|--------|
| Description | A verified independent delivery driver |
| Permissions | Go online/offline, receive delivery requests, accept/reject requests, update delivery status (arrived at restaurant, picked up, arrived at customer, delivered), view earnings and history |
| Limitations | Cannot manage restaurants, cannot place customer orders, cannot access admin |
| Authentication required? | Yes — must be verified before going online |

### 3.6 Admin

| Attribute | Detail |
|-----------|--------|
| Description | Platform operations manager with broad access |
| Permissions | View and manage all users, orders, restaurants, drivers, payments, disputes, commissions, platform settings, analytics |
| Limitations | Defined by sub-role; full admin has no functional limitations |
| Authentication required? | Yes — admin dashboard login with 2FA recommended |

### 3.7 Super Admin

| Attribute | Detail |
|-----------|--------|
| Description | Highest-privilege system administrator |
| Permissions | All admin permissions plus: create/delete admin accounts, modify commission rates, access audit logs, modify platform-level settings |
| Limitations | None |
| Authentication required? | Yes — mandatory 2FA |

### 3.8 Support Staff

| Attribute | Detail |
|-----------|--------|
| Description | Customer support agent handling disputes and tickets |
| Permissions | View orders, view customer/restaurant/driver details, update support tickets, escalate disputes, issue refunds (if authorized) |
| Limitations | Cannot modify restaurant menus, cannot manage platform settings, cannot access financial reports |
| Authentication required? | Yes — scoped admin credentials |

---

## 4. Customer App Requirements

### 4.1 Authentication

- Phone number + OTP login (primary method for markets with limited email usage)
- Email + password as alternative
- Social login (Google) as optional future addition
- Account registration collects: name, phone number, optional email
- Session maintained via JWT access token + refresh token stored securely
- Auto-login on app restart using valid refresh token
- Logout clears all local tokens and user cache

### 4.2 Browse Restaurants / Stores

- Home screen displays a curated list of restaurants/stores
- Restaurants are sorted by: distance, rating, estimated delivery time, or promotional priority
- Each restaurant card shows: logo, name, category, average rating, estimated delivery time, delivery fee, open/closed status
- Closed restaurants are shown at the bottom or marked clearly as unavailable
- "Busy" restaurants (accepting orders but with longer wait times) are marked with a visual badge
- Category filter bar (Food, Grocery, Pharmacy, etc.) at the top of the list
- Banner/promotional slots for featured restaurants

### 4.3 Search and Filters

- Global search bar that searches restaurant names and product names
- Filters available:
  - Category/cuisine type
  - Minimum order amount
  - Estimated delivery time
  - Rating (4+, 3+, etc.)
  - Free delivery
  - Open now only
- Search results are debounced to reduce API calls (minimum 300ms delay before firing)
- Results cached locally for 5 minutes to avoid repeat requests on the same query

### 4.4 Restaurant / Store Details Page

- Full banner image, logo, name, description, category, rating breakdown
- Operating hours display
- Estimated delivery time and fee
- Map pin or address text
- Tab navigation: Menu / Reviews / Info
- "Currently closed" or "Currently busy" state clearly visible
- Ability to set a reminder when the restaurant opens (future feature)

### 4.5 Menu / Products

- Menu organized into sections/categories (e.g., Starters, Mains, Drinks, Desserts)
- Each product shows: image (compressed), name, short description, price, availability toggle
- Unavailable items are shown grayed out and non-interactive
- Product detail modal/page supports: modifiers, extras, special instructions field
- Menu sections collapse/expand for easy navigation on long menus
- Images are lazy-loaded and cached locally

### 4.6 Cart

- Persistent cart stored locally (survives app close)
- Cart supports items from one restaurant at a time; switching restaurants prompts clear cart confirmation
- Real-time subtotal calculation
- Quantity increment/decrement per item
- Remove item with swipe or minus button
- Display item-level notes/modifiers in the cart
- Cart badge on the navigation bar showing item count
- "Go to Checkout" button is always visible when cart has items

### 4.7 Checkout

- Summary of cart items with final pricing
- Delivery address selection (saved or new)
- Estimated delivery time shown
- Delivery fee breakdown
- Payment method selection (Cash on Delivery, future: Online Card)
- Special delivery instructions field (optional)
- Idempotency key generated per checkout session to prevent double orders
- Order confirmation requires an active internet connection; graceful error if offline

### 4.8 Address Management

- Customer can save multiple delivery addresses
- Each address has a label (Home, Work, Other) and optional nickname
- Map-based address picker (Google Maps or OpenStreetMap)
- Manual address entry as fallback when GPS is unavailable
- Default address can be set
- Edit and delete saved addresses

### 4.9 Order Placement

- Placing an order requires: valid cart, selected address, selected payment method
- Backend validates: restaurant is open, items are available, minimum order amount met
- Backend generates a unique order ID and assigns a unique idempotency key
- Customer receives an in-app confirmation screen immediately after successful order placement
- If the request fails, the app shows a clear retry option (does not duplicate the order due to idempotency key)

### 4.10 Order Tracking

- Live order status screen updates in real time via Socket.IO
- Status timeline displayed visually (progress steps):
  - Waiting for restaurant → Restaurant accepted → Preparing → Driver assigned → Driver on the way → Delivered
- Each step shows timestamp when it was completed
- Estimated time remaining is shown where applicable
- Cancel order option available only in PENDING_RESTAURANT status
- Fallback to polling (every 30s) if Socket.IO is disconnected

### 4.11 Driver Tracking

- Once a driver is assigned, a live map appears on the order tracking screen
- Driver's location marker updates in real time via Socket.IO
- Estimated arrival time displayed dynamically
- If location data is stale (>2 minutes), a "location unavailable" message is shown
- Map uses cached tiles to remain functional with weak internet
- Tracking auto-stops after order is delivered or cancelled

### 4.12 Payment Options

| Method | Status | Notes |
|--------|--------|-------|
| Cash on Delivery | MVP | Customer pays driver directly; platform tracks collection status |
| Online Card | Post-MVP | Via Stripe or local payment gateway |
| Wallet / Credits | Future | Platform-managed balance |

### 4.13 Order History

- List of all past and active orders sorted by date (descending)
- Each entry shows: order ID, restaurant name, date, total amount, final status
- Tapping an order shows full order detail (items, timeline, receipt)
- "Reorder" shortcut to refill cart with the same items
- Infinite scroll or paginated loading

### 4.14 Reviews and Ratings

- After delivery, customer is prompted to rate:
  - Restaurant (1–5 stars + optional text)
  - Driver (1–5 stars + optional text)
- Review prompt appears on the next app open after a successful delivery
- Review can be skipped
- Customer can view their past reviews from profile settings
- Reviews are publicly visible on restaurant and driver profiles

### 4.15 Notifications

- Push notification via FCM for:
  - Order accepted by restaurant
  - Driver assigned
  - Driver arrived at restaurant
  - Driver on the way
  - Order delivered
  - Order cancelled
- In-app notification bell with history of all past notifications
- Deep link from notification opens the relevant order tracking screen

### 4.16 Offline / Weak Internet Behavior

- App loads home screen with cached restaurant list (last known data)
- Cached menus available for browsing offline
- Cart is always stored locally and never requires internet
- Order placement is blocked offline; user sees a clear "No internet connection" message with a retry button
- Order tracking falls back to polling if Socket.IO disconnects
- Banner/indicator shown when internet is weak or disconnected

### 4.17 Empty / Loading / Error States

| State | Behavior |
|-------|----------|
| Loading | Skeleton screens instead of blank pages or spinners |
| Empty restaurant list | "No restaurants available in your area" with an illustration |
| Empty order history | "You have not placed any orders yet" with a CTA to browse |
| Empty cart | "Your cart is empty" with a CTA to browse |
| Network error | Inline error message with a retry button |
| Server error (5xx) | Friendly error screen with support contact or retry |
| Order not found | Clear message with option to return to home |

---

## 5. Restaurant / Store App Requirements

### 5.1 Login

- Login via phone number + OTP or email + password
- A restaurant owner can log in and see all branches/stores they own
- A staff member logs in and sees only the restaurant they are linked to
- Remember session with secure refresh token storage
- Forced logout on permission changes by admin

### 5.2 Dashboard

- Summary cards: active orders count, pending orders, today's total revenue
- Quick status toggle: Open / Closed / Busy
- Live order feed below the summary cards
- Real-time order badge/sound alert when a new order arrives
- Battery-friendly background keep-alive to ensure orders are not missed

### 5.3 New Order Alerts

- Loud audio alert + vibration on new order
- Full-screen or prominent banner notification when app is in the foreground
- Push notification via FCM when app is backgrounded
- New order card shows: order ID, customer name, items summary, total, requested time
- Alert persists until staff takes an action (accept/reject)

### 5.4 Accept / Reject Orders

- Accept and Reject buttons prominently displayed on each new order
- Accepting an order immediately changes status to ACCEPTED_BY_RESTAURANT and notifies the customer
- Rejecting requires selecting a reason (out of stock, too busy, restaurant closing, other)
- Auto-reject timer: if no action is taken within a configurable window (e.g., 3 minutes), the order is auto-rejected and the customer is notified
- Rejected orders move to order history with "rejected" status

### 5.5 Preparation Status

- After acceptance, staff can mark the order as PREPARING
- Optional: set an estimated preparation time in minutes (shown to the customer)
- Staff can mark the order as READY FOR PICKUP (triggers driver dispatch if not already assigned)

### 5.6 Request Driver

- After accepting the order, a "Request Driver" button is available
- The system automatically dispatches to the nearest available driver
- Staff can see dispatch status: "Looking for driver...", "Driver offered", "Driver assigned"
- Manual cancel driver request allowed before assignment (admin-configured)

### 5.7 View Assigned Driver

- Once a driver is assigned, the app displays:
  - Driver name, phone number (tap to call), profile photo
  - Driver's live location on a small map
  - Estimated arrival time at the restaurant
  - Current driver status (heading to restaurant, arrived, picked up)
- Ability to call the driver directly from within the app

### 5.8 Menu / Product Management

- List all products grouped by category
- Add new product: name, description, images, price, category, availability
- Edit existing products: modify any field
- Toggle product availability (in stock / out of stock)
- Reorder categories and products via drag-and-drop (future enhancement)
- Bulk availability update: mark all items in a category as unavailable

### 5.9 Product Availability

- Each product has a toggle: Available / Unavailable
- Unavailable products are shown to customers but cannot be added to cart
- Quick-unavailable mode: temporarily disable a product without deleting it
- Availability changes take effect immediately on the customer app

### 5.10 Working Hours

- Set opening and closing hours for each day of the week
- Option to mark specific days as closed
- Holiday / special hours override support (future)
- Working hours are displayed on the customer-facing restaurant page

### 5.11 Store Status

| Status | Description | Customer-facing |
|--------|-------------|-----------------|
| OPEN | Accepting orders normally | "Open" badge |
| CLOSED | Not accepting orders | "Closed" shown, ordering blocked |
| BUSY | Accepting orders but longer wait times | "Busy — longer wait" badge |
| TEMPORARILY_CLOSED | Manually closed for the day | "Temporarily closed" |

Staff can toggle store status from the dashboard at any time.

### 5.12 Order History

- Full list of all past orders with status, date, and total
- Filter by date range and status
- View full detail of each past order
- Export summary (future — PDF or CSV)

### 5.13 Earnings Summary

- Today's earnings, this week's earnings, this month's earnings
- Per-order breakdown with order ID and amount
- Commission deducted vs. net earnings
- Payout history (future — when payout system is integrated)
- Note: detailed financial reporting is in the admin dashboard

### 5.14 Notifications

- New order alert (FCM + in-app)
- Driver assigned (in-app)
- Driver arrived at restaurant (in-app)
- Order cancelled by customer (FCM + in-app)
- System alerts from admin (e.g., policy changes)

### 5.15 Offline / Weak Internet Behavior

- Order list cached locally; visible when offline
- New order alerts require internet; app shows a prominent "You are offline — new orders may be missed" banner
- Menu edits queued locally and synced when reconnected
- Auto-reconnect Socket.IO with exponential backoff
- FCM ensures order notifications arrive even when Socket.IO drops

### 5.16 Empty / Loading / Error States

| State | Behavior |
|-------|----------|
| No orders today | "No orders yet today" with a helpful illustration |
| Empty menu | "Your menu is empty — add your first product" with CTA |
| Network error | Red banner with last sync time and retry button |
| Login error | Clear message and retry option |

---

## 6. Driver App Requirements

### 6.1 Login

- Phone number + OTP authentication
- On first login, driver must complete profile: name, photo, vehicle type, vehicle plate number
- Profile submitted for admin verification before driver can go online
- Login session persisted with refresh token

### 6.2 Driver Verification Status

- After registration, driver status is PENDING_VERIFICATION
- Admin reviews and either approves (VERIFIED) or rejects (REJECTED) with a reason
- VERIFIED drivers can toggle online/offline
- PENDING or REJECTED drivers see a clear status message and cannot go online

### 6.3 Online / Offline Status

- Large toggle switch on the home screen: Go Online / Go Offline
- Going online shares the driver's location with the backend
- Going offline stops location sharing and stops receiving delivery requests
- System automatically marks driver as offline if the app is killed and no location heartbeat is received for a configurable time (e.g., 5 minutes)

### 6.4 Current Location

- Driver's location is determined via device GPS
- High-accuracy mode enabled when the driver is online and on an active delivery
- Lower accuracy mode (battery-saving) when online but idle
- Location is displayed on a map in the driver app for self-reference

### 6.5 Receive Delivery Request

- New delivery request appears as a full-screen or prominent overlay
- Request shows:
  - Restaurant name and distance from driver
  - Customer area/district (not full address for privacy)
  - Estimated delivery distance
  - Estimated earnings for this delivery
- Accept and Decline buttons clearly displayed

### 6.6 Accept / Reject Delivery

- Accepting locks the order to this driver immediately (atomic lock in Redis to prevent race conditions)
- Rejecting returns the order to the dispatch queue for the next available driver
- Rejection reason is logged (optional — too far, personal reason, etc.)
- Repeat rejections may affect driver score (future)

### 6.7 Delivery Timeout Logic

- Driver has a configurable time window to accept or decline (e.g., 30 seconds)
- Timer countdown is visible on the request screen
- If the driver does not respond within the timeout, the request is automatically declined and offered to the next driver
- Repeated timeouts are logged and may affect dispatch priority (future)

### 6.8 Navigate to Restaurant / Store

- After accepting, the app shows:
  - Restaurant name, address, phone number
  - "Open in Maps" button (Google Maps or local maps app)
  - Estimated travel time
  - Order items summary for reference
- Driver status becomes ON_THE_WAY_TO_RESTAURANT

### 6.9 Mark Arrived at Restaurant

- A single large "Arrived at Restaurant" button
- Triggers status: DRIVER_ARRIVED_RESTAURANT
- Notifies restaurant staff that the driver is outside
- Triggers notification to the customer as well

### 6.10 Mark Order Picked Up

- After physically receiving the order from the restaurant, driver taps "Order Picked Up"
- Triggers status: PICKED_UP
- Customer and restaurant are notified
- Navigation screen switches to customer delivery destination

### 6.11 Navigate to Customer

- Customer delivery address shown (full address only after pickup for privacy)
- "Open in Maps" button
- Estimated travel time displayed
- Driver status: ON_THE_WAY

### 6.12 Mark Delivered

- Large "Mark as Delivered" button
- Optional photo confirmation (future feature)
- Triggers status: DELIVERED
- Customer receives delivery notification
- Driver earnings for the trip are calculated and added to balance
- Driver returns to idle/online state ready for the next request

### 6.13 Earnings

- Today's earnings, this week's earnings, this month's earnings
- Per-delivery breakdown: order ID, date, amount earned, distance
- Pending payout balance vs. already paid out
- Earnings are calculated after deducting platform commission

### 6.14 Delivery History

- List of all past deliveries with status, date, restaurant, and earnings
- Tap to view full delivery detail
- Filter by date range

### 6.15 Notifications

- New delivery request: FCM high-priority push + in-app alert + sound
- Delivery assignment confirmation
- Order updates from the restaurant (e.g., ready for pickup)
- Admin messages (account status changes, announcements)

### 6.16 Weak Internet Handling

- Last known location cached and displayed on the map
- Active delivery status cached so the driver knows their current task even if disconnected
- Location updates queued locally when offline and sent in batch when reconnected
- Socket.IO reconnects automatically with exponential backoff
- FCM delivery request arrives even when Socket.IO is down
- In-progress delivery state is never lost on app restart

### 6.17 Location Update Strategy

| Scenario | Update Frequency |
|----------|-----------------|
| Driver online, idle (no active delivery) | Every 30 seconds or 50m movement |
| Active delivery — heading to restaurant | Every 5 seconds or 20m movement |
| Active delivery — heading to customer | Every 5 seconds or 20m movement |
| Driver offline | No updates sent |

Distance-based triggering is the primary mechanism; time-based is the fallback. This dramatically reduces data usage in heavy traffic or slow-moving conditions.

### 6.18 Battery / Data Optimization

- Use `Geolocator` Flutter plugin with `LocationAccuracy.balanced` when idle
- Switch to `LocationAccuracy.high` during active delivery
- Stop GPS and Socket.IO when offline
- Batch location updates if the connection is unstable (send last 5 points at once)
- Minimize background wake-ups with efficient foreground service

### 6.19 Empty / Loading / Error States

| State | Behavior |
|-------|----------|
| No deliveries today | "No deliveries yet today" |
| Waiting for a request | Animated "Waiting for requests..." state |
| GPS unavailable | Warning: "Enable location to go online" |
| Network error on delivery action | Retry button, cached local state shown |

---

## 7. Admin Dashboard Requirements

The admin dashboard is a web application accessible by authorized admin and support staff only.

### 7.1 Manage Users

- View all registered customers with: name, phone, registration date, order count, account status
- Search and filter users
- View full profile of any user
- Suspend or ban accounts with a reason
- Reset user password (sends OTP/email)
- View complete order history per user

### 7.2 Manage Restaurants / Stores

- View all registered restaurants with: name, owner, category, status, order count, rating
- Approve new restaurant registrations
- Edit restaurant details (override)
- Suspend or permanently close a restaurant
- View full order history per restaurant
- View menu for any restaurant
- Set commission rate per restaurant (override global rate)
- Set featured/promoted status

### 7.3 Manage Drivers

- View all drivers with: name, phone, vehicle, verification status, active deliveries, rating
- Approve or reject driver verification applications
- View driver documents (ID, license) uploaded during registration
- Suspend or ban drivers
- View full delivery history per driver
- View current driver location on map (live, admin view)

### 7.4 Manage Orders

- View all orders with full filtering: by status, date range, restaurant, customer, driver
- Full order detail view: items, timeline, delivery address, payment, events log
- Manually update order status (for edge cases and operations)
- Assign a driver manually to an order
- Cancel an order on behalf of a customer or restaurant
- Flag an order for investigation

### 7.5 Manage Disputes / Support

- View all open support tickets
- View customer-reported issues linked to specific orders
- Respond to tickets and update status (open, in-progress, resolved, escalated)
- Issue refunds (triggers payment reversal)
- Link disputes to orders and affected parties

### 7.6 Manage Commissions

- Set a global platform commission rate (percentage per order)
- Override commission per restaurant or per category
- View commission earned per time period
- Download commission reports (CSV/PDF — future)

### 7.7 Manage Payments

- View all transactions: order ID, amount, method, status, date
- Manual payment status override (in case of payment gateway errors)
- View driver earnings and pending payouts
- Mark driver payouts as paid
- View restaurant net earnings after commission

### 7.8 Manage Platform Settings

- Configure global delivery fee formula (base fee + per-km rate)
- Configure auto-reject timer for restaurants
- Configure driver request timeout
- Configure minimum order amount (global or per restaurant)
- Manage categories and cuisines
- Manage geographic zones / delivery coverage areas
- Feature flag toggles (enable/disable online payments, ratings, etc.)

### 7.9 Reports and Analytics

- Orders report: total orders, by status, by time period, by restaurant, by area
- Revenue report: gross revenue, commissions, refunds, net revenue
- Driver performance report: deliveries count, average rating, active hours
- Restaurant performance report: acceptance rate, average preparation time, rating
- Customer report: new registrations, active users, repeat order rate
- Exportable to CSV

### 7.10 Live Order Monitoring

- Real-time map view showing all active orders and driver locations
- Color-coded order markers by status
- Ability to click on an order/driver marker to view details
- Auto-refresh without needing to reload the page

### 7.11 Manual Order Intervention

- Admins can manually:
  - Cancel any order at any stage
  - Change order status
  - Reassign a driver
  - Force-complete an order
  - Issue a partial or full refund
  - Add a note/reason for the intervention (logged in audit log)

---

## 8. Order Lifecycle

### 8.1 Status Flow Diagram

```
Customer places order
        │
        ▼
[PENDING_RESTAURANT] ──(auto-reject timeout or restaurant rejects)──► [REJECTED_BY_RESTAURANT]
        │
        │ Restaurant accepts
        ▼
[ACCEPTED_BY_RESTAURANT]
        │
        │ Restaurant marks preparing
        ▼
[PREPARING]
        │
        │ Restaurant requests driver (or system auto-dispatches)
        ▼
[LOOKING_FOR_DRIVER]
        │
        │ System offers to a driver
        ▼
[DRIVER_OFFERED] ──(driver timeout or declines)──► back to [LOOKING_FOR_DRIVER] or [FAILED] if no drivers
        │
        │ Driver accepts
        ▼
[DRIVER_ASSIGNED]
        │
        │ Driver marks arrived at restaurant
        ▼
[DRIVER_ARRIVED_RESTAURANT]
        │
        │ Driver marks picked up
        ▼
[PICKED_UP]
        │
        │ System or driver updates status
        ▼
[ON_THE_WAY]
        │
        │ Driver arrives at customer location
        ▼
[ARRIVED_CUSTOMER]
        │
        │ Driver marks delivered
        ▼
[DELIVERED] ──► Review prompt to customer
        
[CANCELLED] — can be triggered from PENDING_RESTAURANT or ACCEPTED_BY_RESTAURANT (by customer or admin)
[FAILED] — system-generated when no driver could be found after all retries
```

### 8.2 Status Reference Table

| Status | Who Triggers | What Happens Next |
|--------|-------------|-------------------|
| PENDING_RESTAURANT | System (on order placement) | Notify restaurant via FCM + Socket.IO |
| ACCEPTED_BY_RESTAURANT | Restaurant staff | Notify customer; restaurant begins preparation |
| REJECTED_BY_RESTAURANT | Restaurant staff or system (auto-reject) | Notify customer with reason; order closed |
| PREPARING | Restaurant staff | Optional: send estimated prep time to customer |
| LOOKING_FOR_DRIVER | Restaurant staff (manual request) or system | Dispatch algorithm begins |
| DRIVER_OFFERED | System (dispatch module) | Timeout timer starts; driver shown the request |
| DRIVER_ASSIGNED | Driver (accepts request) | Notify restaurant + customer; tracking starts |
| DRIVER_ARRIVED_RESTAURANT | Driver | Notify restaurant staff |
| PICKED_UP | Driver | Notify customer; tracking live map activates |
| ON_THE_WAY | System (auto after pickup) or driver | Customer tracking screen shows driver movement |
| ARRIVED_CUSTOMER | Driver | Notify customer |
| DELIVERED | Driver | Calculate earnings; trigger review prompt; close order |
| CANCELLED | Customer (early stages) or Admin | Notify all parties; reverse payment if online |
| FAILED | System | Notify admin; notify customer with apology + refund |

---

## 9. Delivery Dispatch Flow

### 9.1 Trigger

Dispatch is triggered when the restaurant taps "Request Driver" after marking the order as PREPARING or READY. The system can also be configured to auto-dispatch immediately upon order acceptance without waiting for the restaurant to request.

### 9.2 Driver Selection Algorithm

1. Query all drivers with status = ONLINE and no active delivery
2. Filter drivers within a configurable radius (e.g., 5 km from the restaurant)
3. Sort by distance (nearest first)
4. Optionally weight by: driver rating, acceptance rate, last active time
5. Select the top candidate

### 9.3 Offer Delivery to Driver

1. Backend sends a delivery offer to the selected driver via Socket.IO
2. If Socket.IO fails (driver not connected), fallback to FCM high-priority notification
3. A timer starts (configurable, e.g., 30 seconds)
4. Order status set to DRIVER_OFFERED

### 9.4 Timeout and Retry

- If the driver does not respond within the timeout window:
  - Mark the offer as expired for that driver
  - Move to the next driver in the sorted list
  - Repeat the offer process
- If all drivers within the radius have been tried and none accepted:
  - Expand the search radius (e.g., +2 km)
  - Retry with the expanded radius
- If still no driver after a maximum number of retries:
  - Order status set to FAILED
  - Notify the customer and admin

### 9.5 Preventing Race Conditions

- When a driver accepts an offer, the backend uses a **Redis atomic lock** on the order ID
- Only the first acceptance succeeds; subsequent concurrent accepts are rejected
- The locking TTL is set to the timeout window duration
- This ensures that even if two drivers accept simultaneously, only one is assigned

### 9.6 Manual Driver Assignment

- Admin can manually assign any online driver to an order via the admin dashboard
- This overrides the dispatch algorithm
- Manual assignments are logged in the audit log

### 9.7 Driver Availability Conditions

A driver is considered available for dispatch if ALL of the following are true:
- Status = ONLINE
- No active delivery (not assigned to another order)
- Verification status = VERIFIED
- App heartbeat received within the last 2 minutes

### 9.8 Fallback When Internet is Weak

- If the driver app loses connectivity after accepting, the local state is preserved
- The backend marks the order as DRIVER_ASSIGNED; only the driver's device is temporarily unreachable
- FCM notification serves as a redundant delivery mechanism to wake the driver app
- The driver can still complete delivery actions (mark arrived, mark picked up, etc.) via API calls that retry automatically

### 9.9 Zone / Area Support (Future)

- Define delivery zones as geographic polygons in the admin dashboard
- Assign specific drivers to specific zones
- Dispatch only to drivers within the same zone as the restaurant
- Cross-zone dispatch allowed as a fallback when no in-zone driver is available

---

## 10. Realtime Communication Requirements

All realtime events are transmitted over Socket.IO. Each app maintains an authenticated Socket.IO connection using a JWT token. Events are namespaced by role.

### 10.1 Event Table

| Event Name | Sender | Receiver | Trigger | Payload Summary |
|------------|--------|----------|---------|-----------------|
| `order:new` | Backend | Restaurant App | Customer places order | orderId, items, customer name, address, total, payment method |
| `order:accepted` | Backend | Customer App | Restaurant accepts order | orderId, estimatedPrepTime |
| `order:rejected` | Backend | Customer App | Restaurant rejects order | orderId, reason |
| `order:preparing` | Backend | Customer App | Restaurant marks preparing | orderId, estimatedReadyTime |
| `driver:requested` | Backend | Driver App | Restaurant requests dispatch | orderId, restaurantName, restaurantAddress, estimatedFee, distance |
| `driver:assigned` | Backend | Restaurant App + Customer App | Driver accepts | orderId, driverName, driverPhone, vehicleInfo, driverLocation |
| `driver:location_updated` | Driver App → Backend → Customers/Restaurant | Customer App + Restaurant App | Driver moves | orderId, latitude, longitude, timestamp |
| `order:arrived_restaurant` | Backend | Restaurant App + Customer App | Driver marks arrived | orderId, timestamp |
| `order:picked_up` | Backend | Customer App + Restaurant App | Driver picks up order | orderId, timestamp |
| `order:on_the_way` | Backend | Customer App | After pickup | orderId, estimatedArrival |
| `order:arrived_customer` | Backend | Customer App | Driver marks arrived at customer | orderId, timestamp |
| `order:delivered` | Backend | Customer App + Restaurant App | Driver marks delivered | orderId, timestamp |
| `order:cancelled` | Backend | All relevant parties | Cancellation triggered | orderId, cancelledBy, reason, timestamp |
| `connection:lost` | Client (local) | Self | Socket disconnected | — (client-side event) |
| `connection:restored` | Backend | Client | Reconnection successful | latestOrderStatus (sync payload) |

### 10.2 Connection Sync on Reconnect

When a client reconnects after a disconnection, the backend immediately sends a `connection:restored` event with the latest status of all active orders relevant to that user/role. This prevents the client from being stuck in a stale state after missing events.

### 10.3 Room Strategy

- Each order has a dedicated Socket.IO room: `order:{orderId}`
- Restaurant app joins rooms for all active orders assigned to its restaurant
- Customer app joins the room for their active order
- Driver app joins the room for their currently assigned order
- Admin can join any room for monitoring

---

## 11. Push Notification Requirements

Firebase Cloud Messaging (FCM) serves as the **out-of-band notification channel** — it works even when the user's app is closed, backgrounded, or the Socket.IO connection is unavailable.

### 11.1 Notification Events

| Event | Target App | Priority | When Triggered |
|-------|-----------|----------|---------------|
| New order received | Restaurant App | HIGH | When customer places an order |
| Delivery request | Driver App | HIGH | When dispatch module offers an order |
| Order accepted | Customer App | NORMAL | When restaurant accepts |
| Order rejected | Customer App | HIGH | When restaurant rejects |
| Driver assigned | Customer App + Restaurant App | NORMAL | When driver accepts delivery |
| Driver arrived at restaurant | Restaurant App | NORMAL | When driver marks arrived |
| Order picked up | Customer App | NORMAL | When driver picks up |
| Order on the way | Customer App | NORMAL | After pickup |
| Order delivered | Customer App | NORMAL | When driver marks delivered |
| Order cancelled | All parties | HIGH | When order is cancelled |
| Dispatch timed out | Restaurant App | HIGH | When no driver found |

### 11.2 FCM Implementation Notes

- FCM device tokens are stored in the backend per user/device, updated on each app login
- Multiple device tokens per user are supported (user logged in on multiple devices)
- Stale/invalid tokens are cleaned up automatically when FCM returns a `NOT_REGISTERED` error
- For HIGH priority events, use `priority: high` and `contentAvailable: true` (iOS) to wake background apps
- Notification payloads include `orderId` and `action` for deep linking
- Backend sends FCM after Socket.IO delivery attempt fails (dual-channel approach for critical events)

### 11.3 Fallback Strategy

If Socket.IO is confirmed disconnected (via Redis presence tracking), the backend immediately sends an FCM notification in parallel rather than waiting for the Socket.IO timeout. This minimizes delays in low-connectivity environments.

---

## 12. Offline / Weak Internet Strategy

This is a critical design concern for this platform. The target market may experience frequent disconnections, slow mobile data, or limited Wi-Fi.

### 12.1 Local Cache in Flutter Apps

- Use `flutter_secure_storage` for tokens
- Use `hive` or `sqflite` for local structured data (orders, menu, restaurants)
- Cache restaurant list on first load; expire after 10 minutes
- Cache menu per restaurant; expire after 5 minutes
- Cache current active order state persistently; update only when new data arrives

### 12.2 Retry Queue for Failed Actions

- All API-mutating actions (place order, update status, etc.) go through a local action queue
- If an action fails due to a network error, it is stored in the queue with a timestamp
- The app retries queued actions automatically when connectivity is restored
- Exponential backoff: retry at 5s, 15s, 30s, 60s, then every 5 minutes

### 12.3 Idempotency Keys

- Every state-changing action (order placement, status update) includes a client-generated UUID as an idempotency key
- The backend stores processed idempotency keys in Redis with a TTL (e.g., 24 hours)
- Duplicate submissions of the same key are ignored and return the original response
- This prevents double orders or duplicate status updates caused by retries

### 12.4 Small API Payloads

- API responses are designed to be compact (no unnecessary nested data)
- Paginate list responses (default page size: 10–20 items)
- Use field selection (`?fields=id,name,status`) where possible to reduce response size
- Compress API responses using gzip (enabled at the Nginx/load balancer level)
- Images are served from a CDN with multiple resolution variants; mobile apps request the smallest appropriate size

### 12.5 Image Compression and Caching

- Restaurant logos and product images stored on cloud storage (AWS S3 or equivalent)
- Images served via CDN
- Flutter apps use `cached_network_image` to cache images on device
- Fallback placeholder shown when image cannot be loaded
- Menu images are compressed to a maximum of 150KB per image

### 12.6 Last Known Driver Location

- The last received driver location is stored locally in the Customer App
- If real-time updates stop arriving, the last known location is displayed with a visual indicator ("Last seen X minutes ago")
- The map does not freeze or crash; it simply stops updating until data resumes

### 12.7 Connection Status Indicator

- A persistent, subtle banner shown when internet is disconnected or unstable
- Color coding: red for no connection, yellow for degraded connection
- Banner auto-dismisses when a stable connection is restored

### 12.8 Sync After Reconnection

- On reconnection, the app immediately:
  1. Fetches the latest status of any active order
  2. Processes any queued local actions (retries)
  3. Reconnects to the Socket.IO room for the active order
  4. Refreshes cached restaurant/menu data if the cache has expired

### 12.9 Per-App Offline Behavior

| App | Allowed Offline | Blocked Offline |
|-----|----------------|-----------------|
| Customer App | Browse cached restaurants, view cached menus, manage cart | Place orders, view live tracking, access order history |
| Restaurant App | View cached active orders list, view menu | Accept/reject orders, update status, request driver |
| Driver App | View current delivery details and destination | Update delivery status, receive new requests |

---

## 13. Location Tracking Strategy

### 13.1 Update Frequency

| Driver State | Trigger Method | Frequency |
|-------------|---------------|-----------|
| Online, idle | Distance-based | Every 50m moved |
| Active delivery — to restaurant | Distance-based | Every 20m moved |
| Active delivery — to customer | Distance-based | Every 15m moved |
| Stationary (traffic) | Time-based fallback | Every 30 seconds |

### 13.2 Backend Location Handling

- Driver app sends location via Socket.IO event: `driver:location_update`
- Backend receives update, stores in Redis with key `driver:{driverId}:location` (TTL: 2 minutes)
- Backend forwards the update to the relevant order room for the customer and restaurant to receive
- Last known location is also persisted in PostgreSQL `DriverLocation` table for audit/history

### 13.3 Battery Optimization

- Use Flutter's foreground service to keep GPS active during delivery
- Use `LocationAccuracy.balanced` when idle; switch to `LocationAccuracy.high` during active delivery
- Stop all GPS and updates when driver goes offline
- Batch multiple small location updates into a single Socket.IO message when network is unstable

### 13.4 Customer Tracking Screen

- Live map showing driver's real-time position
- Static marker for the customer's delivery address
- Estimated arrival time updated with each location update
- Smooth marker animation between location updates (interpolation)
- If no update received for 2+ minutes: show "Location temporarily unavailable"

### 13.5 Restaurant Tracking Screen

- Similar live map showing driver position relative to the restaurant
- Shows when driver is approaching; updates after pickup to show delivery phase

### 13.6 Privacy and Security Rules

- Customer's full address is revealed to the driver **only after order pickup**
- Driver's personal contact information is accessible to the restaurant and customer during an active delivery only
- After delivery is complete, driver's location data is no longer accessible to the customer
- Location history is stored server-side for audit purposes (7-day retention)
- Location data is transmitted over HTTPS/WSS (encrypted in transit)

### 13.7 Tracking Start and Stop

| Event | Action |
|-------|--------|
| Driver accepts delivery | Begin high-accuracy location tracking |
| Driver goes offline | Stop all location updates |
| Order marked DELIVERED or CANCELLED | Stop tracking; emit final event; clear Redis key |
| Driver app crashes mid-delivery | FCM wakes the app; on relaunch, active delivery state is restored |

---

## 14. Authentication and Security

### 14.1 JWT Token Strategy

- **Access Token:** Short-lived (15 minutes). Included in every API request as `Authorization: Bearer {token}`
- **Refresh Token:** Long-lived (30 days). Stored securely on the device. Used to obtain a new access token silently
- Refresh tokens are stored in the database and can be revoked individually (logout, suspension)
- Token rotation on each refresh: new refresh token issued, old one invalidated
- All tokens are signed with RS256 (asymmetric) for stronger security

### 14.2 OTP Authentication

- Phone-based OTP sent via SMS (using Twilio, local SMS gateway, or Firebase Auth)
- OTP is 6 digits, expires in 5 minutes
- Maximum 3 OTP attempts before a cooldown period
- After 5 failed attempts within 24 hours, the phone number is temporarily blocked

### 14.3 Role-Based Access Control (RBAC)

- Every API endpoint is annotated with required roles
- NestJS guards verify the role from the JWT payload on every protected request
- Roles: `CUSTOMER`, `RESTAURANT_OWNER`, `RESTAURANT_STAFF`, `DRIVER`, `ADMIN`, `SUPER_ADMIN`, `SUPPORT`
- Middleware rejects requests with insufficient role immediately with a 403 response

### 14.4 Password Hashing

- Passwords hashed with bcrypt (minimum 12 rounds)
- Raw passwords are never stored or logged
- Password reset via OTP (not via email link in markets with low email adoption)

### 14.5 Rate Limiting

- Global rate limit: 100 requests per minute per IP
- Auth endpoints (OTP request, login): 5 requests per minute per IP
- Order placement: 10 orders per hour per customer account
- Implemented via NestJS `ThrottlerModule` backed by Redis

### 14.6 Request Validation

- All incoming request bodies validated using NestJS + `class-validator` decorators
- Unknown fields stripped automatically (`whitelist: true`, `forbidNonWhitelisted: true`)
- Type coercion enforced (`transform: true`)
- SQL injection is prevented by Prisma's parameterized queries
- XSS is mitigated by input sanitization on text fields

### 14.7 Preventing Fake Status Updates

- Every status-changing API endpoint validates:
  - The requester's JWT role matches the allowed actor for that transition
  - The order is in the correct state for the requested transition
  - The requester is linked to the relevant order (e.g., only the assigned driver can mark PICKED_UP)

### 14.8 Driver-Order Authorization

- Only the driver with `delivery.driverId === jwt.userId` can update delivery status
- Any attempt by another driver is rejected with 403
- Backend logs the attempt for security audit

### 14.9 Restaurant-Order Authorization

- Only restaurant staff linked to the specific restaurant can manage that restaurant's orders
- Restaurant staff JWT includes `restaurantId` in the payload
- API validates that `order.restaurantId === jwt.restaurantId` on every order action

### 14.10 Admin Permissions

- Admin endpoints are protected by `@Roles('ADMIN', 'SUPER_ADMIN')`
- Super admin-only endpoints (e.g., create admin account) are protected by `@Roles('SUPER_ADMIN')`
- Admin actions that modify financial data require 2FA confirmation (future enhancement)

### 14.11 Audit Logs

- All sensitive admin actions are logged in the `AuditLog` table:
  - Actor (adminId)
  - Action description
  - Target entity (userId, orderId, etc.)
  - Before/after values
  - Timestamp and IP address
- Audit logs are immutable (no update/delete API)
- Retained for 1 year

---

## 15. Payment Requirements

### 15.1 MVP Payment Methods

| Method | Status | Implementation |
|--------|--------|---------------|
| Cash on Delivery (COD) | MVP | Driver collects cash; system records expected amount |

### 15.2 Post-MVP Payment Methods

| Method | Status | Notes |
|--------|--------|-------|
| Credit/Debit Card | Post-MVP | Via Stripe or local payment gateway |
| Platform Wallet | Future | Customer top-up balance used for orders |
| Mobile Money / Telecom | Future | Relevant for certain local markets |

### 15.3 Payment Status Flow (COD)

```
PENDING → (order delivered) → COLLECTED_BY_DRIVER → (driver settles with platform) → SETTLED
                           → FAILED_TO_COLLECT (if customer unable to pay)
```

### 15.4 Refund / Cancel Behavior

| Scenario | Action |
|----------|--------|
| Order cancelled before restaurant accepts | No charge; order closed |
| Order cancelled after restaurant accepts | COD: no charge. Online: full refund initiated |
| Order cancelled during delivery | COD: no charge. Online: full refund initiated |
| Order delivered but quality dispute | Admin reviews; partial or full refund at discretion |
| Refund processing time | Dependent on payment gateway (typically 3–7 business days for cards) |

### 15.5 Earnings Model

```
Order Total = Item Subtotal + Delivery Fee

Platform Commission = Order Total × Commission Rate (e.g., 15%)
Restaurant Net = Item Subtotal − Platform Commission on items
Driver Earnings = Delivery Fee − Platform Commission on delivery (e.g., 10%)
Platform Net = Total Commission − Operational Costs
```

- Commission rates are configurable per restaurant in the admin dashboard
- Driver earnings are tracked in the `Delivery` record
- Restaurant earnings are tracked in the `Order` record
- Payout to restaurants and drivers is handled manually in MVP (transfer + mark as paid in admin)
- Automated payout integration is a post-MVP feature

### 15.6 Invoice / Receipt

- Customer receives an in-app receipt after order delivery
- Receipt includes: order ID, items breakdown, delivery fee, total, payment method, date
- PDF generation and email receipt: post-MVP feature

---

## 16. Data Requirements

The following entities will form the core data model. No database schema is defined here; this is an entity-level inventory.

| Entity | Description |
|--------|-------------|
| `User` | Base user record for all actors. Contains: id, phone, email (optional), passwordHash, role, status, createdAt |
| `CustomerProfile` | Extended profile for customers. Contains: userId, displayName, profilePhoto, defaultAddressId |
| `Restaurant` | A registered restaurant or store. Contains: id, ownerId, name, description, category, logoUrl, bannerUrl, address, coordinates, status, workingHours, commissionRate |
| `RestaurantStaff` | Staff accounts linked to a restaurant. Contains: id, userId, restaurantId, role (OWNER, MANAGER, STAFF), permissions |
| `DriverProfile` | Extended profile for drivers. Contains: userId, displayName, photo, vehicleType, vehiclePlate, verificationStatus, rating, currentLocation |
| `Address` | A saved delivery address. Contains: id, userId, label, street, city, coordinates, isDefault |
| `Category` | Food/product categories (e.g., Fast Food, Pizza, Grocery). Contains: id, name, icon, sortOrder |
| `Product` (MenuItem) | An item on a restaurant's menu. Contains: id, restaurantId, categoryId, name, description, price, imageUrl, isAvailable, sortOrder |
| `ProductModifier` | Optional extras or variants for a product (e.g., size, toppings). Contains: id, productId, name, options, priceAdjustment |
| `Cart` | A customer's current cart. Contains: id, customerId, restaurantId, items (JSON), updatedAt |
| `Order` | A placed order. Contains: id, customerId, restaurantId, addressId, status, subtotal, deliveryFee, total, paymentMethod, paymentStatus, notes, idempotencyKey, createdAt |
| `OrderItem` | A single line item in an order. Contains: id, orderId, productId, productName (snapshot), price (snapshot), quantity, modifiers, notes |
| `Delivery` | The delivery record linked to an order. Contains: id, orderId, driverId, status, assignedAt, pickedUpAt, deliveredAt, earnedAmount |
| `DriverOffer` | A record of each time an order was offered to a driver. Contains: id, orderId, driverId, offeredAt, respondedAt, response (ACCEPTED / DECLINED / TIMEOUT) |
| `Payment` | Payment transaction record. Contains: id, orderId, method, status, amount, gatewayReference, createdAt |
| `Review` | A customer review of a restaurant or driver. Contains: id, customerId, targetId, targetType (RESTAURANT / DRIVER), orderId, rating, comment, createdAt |
| `Notification` | A push notification record. Contains: id, userId, type, title, body, data (JSON), sentAt, readAt |
| `DriverLocation` | Historical and current driver location. Contains: id, driverId, latitude, longitude, accuracy, recordedAt |
| `SupportTicket` | A customer or restaurant dispute or request. Contains: id, reporterId, orderId (optional), type, description, status, assignedTo, createdAt, resolvedAt |
| `Commission` | Commission configuration record. Contains: id, restaurantId (nullable for global), type, rate, effectiveFrom |
| `AuditLog` | Immutable log of sensitive admin actions. Contains: id, adminId, action, entityType, entityId, beforeValue, afterValue, ip, createdAt |
| `Zone` | Geographic delivery zone. Contains: id, name, polygon (GeoJSON), isActive |

---

## 17. API Requirements Overview

Full API contracts (request/response schemas, authentication requirements, error codes) will be defined in a separate API specification document. The following outlines the purpose of each API group.

### 17.1 Auth APIs
Handles user registration, login, token refresh, logout, OTP generation, and OTP verification across all three app types (customer, restaurant, driver).

### 17.2 Customer APIs
Handles customer profile management, saved addresses, favorite restaurants, order history, and review submission. All endpoints require the `CUSTOMER` role.

### 17.3 Restaurant APIs
Handles restaurant profile management, working hours, status changes (open/closed/busy), menu management (categories, products, modifiers), product availability, staff management, and earnings summary. Requires `RESTAURANT_OWNER` or `RESTAURANT_STAFF` role.

### 17.4 Driver APIs
Handles driver profile setup, document upload, online/offline toggle, active delivery state retrieval, delivery history, and earnings. Requires `DRIVER` role.

### 17.5 Order APIs
Handles order creation (customer), order listing (per role), order detail retrieval, status transitions (per allowed role), and order cancellation. Role-scoped access enforced on every endpoint.

### 17.6 Dispatch APIs
Handles the internal dispatch process: triggering driver search, recording driver offers, accepting/declining offers, and retry logic. These are partially internal (called by the system) and partially exposed to the driver app (for offer response).

### 17.7 Notification APIs
Handles FCM device token registration/update per user, notification history listing (customer inbox), and marking notifications as read.

### 17.8 Payment APIs
Handles payment status retrieval, COD collection confirmation, refund request initiation, and (post-MVP) integration with payment gateway webhooks.

### 17.9 Admin APIs
Handles all admin dashboard operations: user management, restaurant management, driver management, order intervention, support ticket management, commission configuration, platform settings, and reporting. Requires `ADMIN` or `SUPER_ADMIN` role.

---

## 18. Suggested Backend Module Structure

The backend follows NestJS's feature-module architecture. Each module is self-contained with its own controller, service, and DTOs.

```
src/
├── app.module.ts
├── modules/
│   ├── auth/                    # AuthModule
│   ├── users/                   # UsersModule
│   ├── customers/               # CustomersModule
│   ├── restaurants/             # RestaurantsModule
│   ├── menu/                    # MenuModule
│   ├── orders/                  # OrdersModule
│   ├── drivers/                 # DriversModule
│   ├── dispatch/                # DispatchModule
│   ├── delivery/                # DeliveryModule
│   ├── notifications/           # NotificationsModule
│   ├── payments/                # PaymentsModule
│   ├── locations/               # LocationsModule
│   ├── reviews/                 # ReviewsModule
│   ├── support/                 # SupportModule
│   ├── admin/                   # AdminModule
│   └── realtime/                # RealtimeModule
├── common/
│   ├── guards/                  # JWT guard, roles guard
│   ├── decorators/              # @Roles(), @CurrentUser()
│   ├── filters/                 # Global exception filter
│   ├── interceptors/            # Logging, transform
│   ├── pipes/                   # Validation pipe
│   └── utils/                   # Shared utilities
├── config/                      # Environment config (database, JWT, FCM, Redis)
└── prisma/                      # Prisma service + schema
```

### Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `AuthModule` | Registration, login, OTP, JWT issuance, token refresh, logout |
| `UsersModule` | User CRUD, role management, account status, profile retrieval |
| `CustomersModule` | Customer profile, saved addresses, order history, reviews |
| `RestaurantsModule` | Restaurant CRUD, working hours, status management, staff management, earnings |
| `MenuModule` | Product/category CRUD, product availability toggle, modifiers |
| `OrdersModule` | Order creation, status machine, lifecycle management, order detail retrieval |
| `DriversModule` | Driver profile, verification status, online/offline toggle, earnings |
| `DispatchModule` | Driver search algorithm, offer management, timeout/retry logic, Redis locking |
| `DeliveryModule` | Delivery record management, driver delivery status updates, pickup/delivery flow |
| `NotificationsModule` | FCM token management, notification dispatch (FCM + Socket.IO), notification history |
| `PaymentsModule` | Payment record management, COD flow, refund handling, gateway integration (post-MVP) |
| `LocationsModule` | Driver location ingestion, Redis caching, location history, customer tracking relay |
| `ReviewsModule` | Review creation, listing, aggregation, rating calculation |
| `SupportModule` | Ticket creation, ticket assignment, ticket resolution, dispute management |
| `AdminModule` | All admin CRUD operations, reporting aggregation, audit log access, platform config |
| `RealtimeModule` | Socket.IO gateway, room management, event emission, connection management |

---

## 19. Suggested Flutter App Structure

### Recommendation: Flutter Monorepo with Shared Packages

**Recommended approach:** A single Melos-managed Flutter monorepo with three application packages and multiple shared library packages.

**Why monorepo over three separate projects:**

| Concern | Separate Projects | Monorepo |
|---------|------------------|----------|
| Code sharing | Copy-paste or manual package publishing | Native, zero-friction |
| Consistent UI/theme | Maintain separately | One source of truth |
| Shared models (API types) | Duplicate or publish to pub | Single shared package |
| Dependency management | Three separate pubspec.yaml files | Centralized with Melos |
| CI/CD complexity | Three separate pipelines | One pipeline, per-app builds |
| Bug fix propagation | Fix in each project | Fix once, all apps benefit |

**Tooling:** [Melos](https://melos.invertase.io/) for workspace management, scripts, and versioning.

### Monorepo Structure

```
delivery_platform/
├── melos.yaml
├── apps/
│   ├── customer_app/          # Customer-facing Flutter app
│   ├── restaurant_app/        # Restaurant/store Flutter app
│   └── driver_app/            # Driver Flutter app
└── packages/
    ├── shared_models/         # API response models, enums, DTOs
    ├── shared_services/       # HTTP client, Socket.IO client, FCM setup, storage
    ├── shared_ui/             # Common widgets (buttons, cards, inputs, maps, loaders)
    ├── shared_theme/          # Colors, typography, spacing, dark/light theme
    └── shared_utils/          # Date formatting, validators, idempotency key gen, extensions
```

### Shared Package Details

| Package | Contents |
|---------|----------|
| `shared_models` | Dart classes for all API entities (Order, Restaurant, Driver, etc.), enums for statuses, JSON serialization |
| `shared_services` | Dio HTTP client with interceptors, Socket.IO wrapper, FCM initialization, secure storage service, connectivity service |
| `shared_ui` | AppButton, AppCard, AppTextField, LoadingOverlay, EmptyState, ErrorState, MapWidget, SkeletonLoader |
| `shared_theme` | ThemeData for light/dark modes, color constants, typography scale, spacing system |
| `shared_utils` | formatCurrency(), formatDate(), generateIdempotencyKey(), phoneNumberValidator(), distanceFormatter() |

### Per-App Structure (inside each app)

```
customer_app/
├── lib/
│   ├── main.dart
│   ├── app.dart
│   ├── features/
│   │   ├── auth/
│   │   ├── home/
│   │   ├── restaurant_detail/
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── order_tracking/
│   │   ├── order_history/
│   │   ├── profile/
│   │   └── reviews/
│   ├── core/
│   │   ├── router/          # go_router configuration
│   │   ├── di/              # Dependency injection (riverpod/getit)
│   │   └── config/          # App constants and env config
│   └── l10n/                # Localization (Arabic + English)
```

**State management recommendation:** Riverpod 2.x (type-safe, testable, no code generation required for simple cases)  
**Navigation:** go_router  
**HTTP:** Dio (with shared_services)  
**Local storage:** Hive (structured cache) + flutter_secure_storage (tokens)  
**Maps:** flutter_map with OpenStreetMap tiles (free) or Google Maps (paid)

---

## 20. MVP Scope

### Must Have for MVP

**Customer App:**
- Phone OTP registration and login
- Browse restaurants (list with basic filters: open/closed, category)
- View restaurant details and menu
- Add items to cart (single restaurant)
- Checkout with cash on delivery
- Order tracking screen (status timeline)
- Live driver tracking on map (after pickup)
- Order history
- Push notifications for all order events

**Restaurant App:**
- Login
- Receive new order alerts (push + in-app)
- Accept or reject orders
- Mark order as preparing and ready
- Request a driver
- View assigned driver info
- Basic menu availability toggle (per product)
- Store open/closed toggle

**Driver App:**
- Phone OTP registration and login
- Admin verification flow (submit name, photo, vehicle info)
- Online/offline toggle
- Receive delivery requests with accept/decline + timeout
- Full delivery flow: navigate to restaurant → arrived → picked up → navigate to customer → delivered
- Basic earnings summary (today and total)

**Backend:**
- All Auth APIs
- Customer, Restaurant, Driver APIs (core features)
- Order lifecycle management
- Dispatch algorithm (nearest driver, retry logic)
- Socket.IO realtime events
- FCM push notifications
- PostgreSQL database (Prisma migrations)
- Redis for driver location cache and dispatch locking

**Admin Dashboard:**
- View all orders with status
- View all users, restaurants, drivers
- Approve/reject driver verification
- Manually cancel an order
- Basic earnings view

### Should Have After MVP

- In-app reviews and ratings (post-delivery)
- Restaurant working hours management (full per-day schedule)
- Restaurant earnings summary (detailed)
- Customer saved addresses (multiple)
- Restaurant menu full management (add/edit/delete products)
- Driver delivery history (full list)
- Product modifiers and extras
- Admin reports and analytics
- Support ticket system
- Dispute resolution flow

### Future Advanced Features

- Online card payment integration
- Platform wallet and top-up
- Driver zone assignments
- Zone-based dispatch
- BullMQ background job queue for automated dispatch retries
- Automated restaurant payout system
- Scheduled/pre-order support
- Multi-language support (Arabic RTL + English)
- Promotional banners and discount codes
- Referral system
- Restaurant subscription tiers
- PDF invoice/receipt generation
- Admin 2FA enforcement
- Driver performance scoring and badge system

---

## 21. Infrastructure, Technologies & Cost Estimation

### 21.1 Technology Stack Summary

| Layer | Technology | Notes |
|-------|-----------|-------|
| Mobile (all 3 apps) | Flutter 3.x + Dart | Monorepo via Melos |
| Backend runtime | Node.js 20 LTS | Long-term support |
| Backend framework | NestJS + TypeScript | Modular, enterprise-grade |
| Primary database | PostgreSQL 15 | Managed via Prisma ORM |
| ORM | Prisma | Type-safe, migration-friendly |
| Cache & dispatch lock | Redis 7 | Key-value, pub/sub, atomic ops |
| Realtime | Socket.IO 4 | On top of NestJS + Redis adapter |
| Push notifications | Firebase Cloud Messaging (FCM) | Free at any scale for sends |
| Background jobs | BullMQ (Post-MVP) | Redis-backed job queues |
| File storage | AWS S3 or Cloudflare R2 | Restaurant logos, product images |
| CDN | Cloudflare | Image and static asset delivery |
| Maps (backend geocoding) | Google Maps Geocoding API or OpenStreetMap Nominatim | |
| Maps (mobile) | Google Maps SDK or flutter_map + OSM | |
| SMS / OTP | Twilio or local SMS provider | |
| Payment gateway | Stripe or local provider (Post-MVP) | |
| Admin dashboard | React + Next.js or Vite + React | Web SPA or SSR |

### 21.2 Hosting Infrastructure

#### Option A: VPS / Cloud VM (Recommended for MVP — Lower Cost)

| Service | Provider Options | Estimated Monthly Cost (USD) |
|---------|-----------------|------------------------------|
| Backend API Server (2 vCPU, 4GB RAM) | DigitalOcean Droplet / Hetzner CX31 / Linode | $20–$40 |
| PostgreSQL (managed) | DigitalOcean Managed DB / Supabase | $15–$50 |
| Redis (managed) | DigitalOcean Managed Redis / Upstash | $10–$30 |
| File Storage (S3-compatible) | DigitalOcean Spaces / Cloudflare R2 / AWS S3 | $5–$20 |
| CDN | Cloudflare (free plan sufficient for MVP) | $0–$20 |
| Domain + SSL | Cloudflare / Namecheap | $10–$15/year |
| Admin Dashboard Hosting | Vercel (free) / Netlify / same server | $0–$5 |
| **Total (MVP estimate)** | | **~$60–$160/month** |

#### Option B: AWS / GCP / Azure (Better for Scale — Higher Cost)

| Service | AWS Equivalent | Estimated Monthly Cost (USD) |
|---------|---------------|------------------------------|
| Backend API | EC2 t3.medium or ECS Fargate | $30–$80 |
| PostgreSQL | RDS PostgreSQL t3.small | $25–$60 |
| Redis | ElastiCache t3.micro | $15–$40 |
| File Storage | S3 | $5–$25 |
| CDN | CloudFront | $5–$20 |
| Load Balancer | ALB | $20–$30 |
| **Total** | | **~$100–$255/month** |

### 21.3 External Service Costs

| Service | Provider | Pricing Model | Estimated Monthly Cost |
|---------|---------|--------------|----------------------|
| Firebase Cloud Messaging | Google Firebase | **Free** (no limits on sends) | $0 |
| Firebase Realtime DB (optional for locations) | Google Firebase | Free up to 1GB storage, 10GB/month transfer | $0–$25 |
| Google Maps SDK (Mobile) | Google Cloud | $7/1000 map loads (Dynamic Maps). ~$200 free credit/month | $0–$50 |
| Google Maps Geocoding API | Google Cloud | $5/1000 requests | $0–$20 |
| OpenStreetMap (alternative maps) | Community / self-hosted tiles | **Free** (self-hosted) or $0–$20/month via tile providers | $0–$20 |
| Twilio SMS (OTP) | Twilio | ~$0.0075/SMS (varies by country) | $10–$50 |
| Local SMS Gateway | Local provider | Varies by country | $5–$30 |
| Stripe (Post-MVP) | Stripe | 2.9% + $0.30 per transaction | Revenue-dependent |
| Apple Developer Account | Apple | $99/year (required for iOS distribution) | ~$8/month |
| Google Play Developer Account | Google | $25 one-time fee | $0 (after initial) |

### 21.4 Development Cost Estimate (External Team / Freelancers)

| Role | Estimated Hours (MVP) | Rate (USD/hr, approx.) | Estimated Cost |
|------|-----------------------|------------------------|----------------|
| Backend Engineer (NestJS) | 300–400 hrs | $30–$60 | $9,000–$24,000 |
| Flutter Developer (all 3 apps) | 400–600 hrs | $25–$50 | $10,000–$30,000 |
| UI/UX Designer | 80–120 hrs | $20–$40 | $1,600–$4,800 |
| DevOps / Server Setup | 40–60 hrs | $30–$50 | $1,200–$3,000 |
| Admin Dashboard (React) | 100–150 hrs | $25–$50 | $2,500–$7,500 |
| QA Testing | 60–80 hrs | $15–$30 | $900–$2,400 |
| **Total MVP Development** | | | **~$25,000–$71,700** |

> Note: Costs vary significantly by developer location and experience. Local developers in the target country may have significantly lower rates.

### 21.5 Recommended MVP Infrastructure Setup

```
Internet → Cloudflare (CDN + DDoS) → Nginx (reverse proxy)
                                            │
                            ┌───────────────┼───────────────┐
                            │               │               │
                      NestJS API      PostgreSQL DB      Redis Cache
                      (Node.js)         (managed)        (managed)
                            │
                      Socket.IO (same process)
                            │
                    Firebase Admin SDK
                            │
                           FCM → Mobile Apps
```

---

## 22. Risks and Important Notes

### 22.1 Weak Internet Connectivity

**Risk:** Core features (order placement, real-time tracking, status updates) depend on internet connectivity. In markets with unstable connections, this directly affects usability and trust.

**Mitigation:**
- Aggressive local caching in all apps
- Idempotency keys preventing duplicate actions on retry
- FCM as a fallback notification channel independent of Socket.IO
- Optimistic UI: show updated state immediately, confirm with server in background
- Compact API payloads, gzip compression, image CDN

### 22.2 Driver Availability

**Risk:** If the pool of online drivers is small, orders may fail to be assigned, leading to customer frustration and restaurant order backlog.

**Mitigation:**
- Configurable retry with expanding radius
- Admin notification when an order fails dispatch
- Manual driver assignment from the admin dashboard
- Driver incentive systems (future: surge pay) to keep drivers online

### 22.3 Duplicate Orders

**Risk:** Network retries and poor connectivity can cause a customer to place the same order multiple times.

**Mitigation:**
- Idempotency keys (UUID) generated per checkout session
- Backend Redis stores processed keys with TTL
- Duplicate submissions return the original order response silently

### 22.4 Fake Delivery Updates

**Risk:** A driver could mark an order as delivered without actually delivering it.

**Mitigation:**
- Backend validates that the driver is the assigned driver for the order
- Optional: geofence validation (if driver location is too far from customer address when marking delivered, flag for review — future feature)
- Photo confirmation on delivery (future feature)
- Customer can dispute a delivery via support

### 22.5 Restaurant Delays

**Risk:** If a restaurant takes too long to prepare, the assigned driver waits, leading to driver frustration and multi-order inefficiency.

**Mitigation:**
- Restaurant can set estimated preparation time (shown to customer)
- Dispatch timing can be tuned to offer the driver closer to ready time (pre-dispatch vs. on-ready-dispatch — configurable per platform)
- Late preparation flagged in restaurant analytics

### 22.6 Payment Disputes

**Risk:** With cash on delivery, a customer may claim they paid but the driver claims they did not. With online payments, refund disputes can arise.

**Mitigation:**
- COD: driver confirms collection in app; platform monitors discrepancies
- Support ticket system with order event log for dispute resolution
- Admin override for refunds
- Financial audit trail for all transactions

### 22.7 App Battery Usage

**Risk:** The driver app must run continuously for extended shifts (8–12 hours) with GPS active. Poor battery management will cause drivers to stop using the app.

**Mitigation:**
- Foreground service with proper Android notification (keeps GPS alive without aggressive battery kills)
- Battery-efficient GPS accuracy modes (balanced when idle, high during delivery)
- Distance-based location updates instead of time-based
- Clear guidance in the driver app on battery optimization settings

### 22.8 Notification Failures

**Risk:** FCM delivery is not 100% guaranteed, especially on Android devices with aggressive battery-saver modes (common in certain markets with modified Android ROMs).

**Mitigation:**
- Configure FCM with `priority: high` and `wakeLockTimeout` for critical notifications
- Guide users to disable battery optimization for the app during onboarding
- Socket.IO as a parallel channel when the app is in the foreground
- Restaurant staff trained to check app periodically rather than relying solely on push

### 22.9 Scaling Realtime Connections

**Risk:** Socket.IO by default is single-process. A large number of concurrent connections (drivers + customers + restaurants all connected) can overload a single server instance.

**Mitigation:**
- Use the `@socket.io/redis-adapter` to share Socket.IO state across multiple backend instances
- This allows horizontal scaling (multiple NestJS instances behind a load balancer) without losing realtime functionality
- Start with a single instance for MVP; design with the Redis adapter from day one to make scaling seamless

### 22.10 Data Privacy and Compliance

**Risk:** Storing customer addresses, phone numbers, and driver locations constitutes sensitive personal data with legal implications.

**Mitigation:**
- Encrypt sensitive fields at rest
- Comply with local data protection laws
- Location data retention limited to 7 days for driver history
- Provide users with account deletion capability

---

## 23. Final Recommendation

### Recommended Full Platform Stack

| Layer | Choice | Justification |
|-------|--------|--------------|
| Mobile | Flutter (Melos Monorepo) | Single codebase, maximum code reuse, strong performance, active ecosystem |
| Backend | NestJS + TypeScript on Node.js 20 | Opinionated structure, excellent DI system, WebSocket support, large community |
| Database | PostgreSQL 15 | Battle-tested, ACID, spatial query support (PostGIS for future geolocation) |
| ORM | Prisma | Type safety, clean migrations, excellent DX |
| Cache & Locking | Redis 7 | Fast key-value, atomic operations, pub/sub for adapter |
| Realtime | Socket.IO 4 with Redis Adapter | Proven, scalable, room-based model fits this architecture perfectly |
| Push Notifications | Firebase Cloud Messaging | Free, reliable, cross-platform, battery-smart delivery |
| File Storage | Cloudflare R2 (S3-compatible) | Cheaper than AWS S3, zero egress fees, built-in CDN |
| Maps | flutter_map + OpenStreetMap (MVP) → Google Maps (post-MVP) | Zero cost for MVP; upgrade when budget allows |
| SMS OTP | Local SMS provider (market-specific) → Twilio as fallback | Lowest cost and latency with a local provider |
| Hosting | Hetzner or DigitalOcean (MVP) → AWS (scale) | Best cost/performance ratio for early stage |
| Admin Dashboard | Next.js + React | SSR capability, fast build, wide ecosystem |
| State Management (Flutter) | Riverpod 2.x | Type-safe, testable, no global context dependency |

### Development Approach

1. **Start with the backend.** Define the Prisma schema, implement Auth, Order, Dispatch, and Realtime modules first. The mobile apps can only be developed meaningfully once the API contract is stable.

2. **Build the restaurant app second.** It is the simplest of the three mobile apps and validates the order flow end-to-end. A working restaurant app + backend allows testing the entire order lifecycle.

3. **Build the driver app third.** The dispatch module and location tracking must be fully tested with the driver app before launching.

4. **Build the customer app in parallel with the driver app** once core APIs and the restaurant app are stable.

5. **Admin dashboard last** for MVP. Admins can use direct database queries and Prisma Studio during early testing.

6. **Deploy to a managed VPS** (DigitalOcean or Hetzner) from day one. Use managed PostgreSQL and Redis to avoid operational overhead. Cloudflare in front for free DDoS protection and CDN.

7. **Write integration tests** for the order lifecycle and dispatch flow before going live. These are the most business-critical paths and the hardest to debug in production.

8. **Plan for offline from day one.** Do not treat offline handling as a later enhancement. It must be part of the initial UI and API design, not retrofitted.

---

*This document defines the complete product and technical requirements for the delivery platform. The next documents to produce from this specification are:*

- *Entity Relationship Diagram (ERD)*
- *Page/Screen designs per app*
- *Full API contract specification (OpenAPI/Swagger)*
- *Development task breakdown and sprint plan*
- *Infrastructure setup runbook*

---

## ملخص الملف

**ما هدف هذا الملف؟**

هذا الملف هو **مرجع المشروع الأساسي** — الوثيقة الأم التي يُبنى عليها كل شيء آخر.

يشرح **ماذا نبني ولماذا**، من هم المستخدمون، وكيف يعمل النظام من البداية للنهاية.

يحتوي على:
- وصف كامل لكل تطبيق (Customer / Restaurant / Driver / Admin)
- دورة حياة الأوردر من لحظة الطلب حتى التسليم
- كيف يعمل نظام توزيع السائقين
- متطلبات الإشعارات والـ Realtime والـ Offline
- متطلبات الأمان والمصادقة والصلاحيات
- تقدير التكاليف والبنية التحتية
- حدود الـ MVP وما يأتي بعده

**من يقرأه؟** الفريق كله — المنتج، الباكند، الفرونتند، DevOps — قبل أي خطوة تقنية.

**القاعدة:** إذا نشأ خلاف حول أي قرار، هذا الملف هو المرجع الفاصل.
