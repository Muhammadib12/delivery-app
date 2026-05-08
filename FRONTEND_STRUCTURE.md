# FRONTEND_STRUCTURE.md — Flutter Monorepo Architecture

> **Project:** Local Delivery Platform  
> **Source of Truth:** `DELIVERY_APPS_REQUIREMENTS.md`, `PAGES_ERD.md`, `API_CONTRACTS.md`  
> **Date:** 2026-05-07  
> **Version:** 1.0  
> **Audience:** Mobile Engineers, Flutter Developers, Tech Lead

---

## Table of Contents

1. [Frontend Overview](#1-frontend-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Shared Packages](#3-shared-packages)
4. [Per-App Folder Structure](#4-per-app-folder-structure)
5. [State Management](#5-state-management)
6. [API Layer](#6-api-layer)
7. [Realtime Layer](#7-realtime-layer)
8. [Notification Layer](#8-notification-layer)
9. [Offline / Weak Internet Layer](#9-offline--weak-internet-layer)
10. [Routing](#10-routing)
11. [UI / UX Rules](#11-ui--ux-rules)
12. [Build & Release](#12-build--release)
13. [Assumptions](#13-assumptions)
14. [Open Questions](#14-open-questions)

---

## 1. Frontend Overview

### Why Flutter

| Criterion | Flutter | React Native | Native (Android + iOS) |
|-----------|---------|-------------|------------------------|
| Single codebase for 3 apps | ✓ | ✓ | ✗ |
| Native performance | ✓ (Skia/Impeller renderer) | Partial (JS bridge) | ✓ |
| Offline/local storage support | ✓ (Hive, Isar, SQLite) | ✓ | ✓ |
| Background GPS (long-running service) | ✓ (foreground service) | Partial | ✓ |
| Low-bandwidth image loading | ✓ (cached_network_image) | ✓ | ✓ |
| Community & packages | Growing rapidly | Large | Platform-specific |
| Team skill alignment | Single Dart codebase | Two ecosystems | Separate teams |

Flutter is chosen because **one engineering team can build and maintain all three apps** from a single language and codebase. This is critical for a startup platform where engineering resources are limited. The Dart/Flutter ecosystem has mature packages for every requirement: location services, background execution, local storage, Socket.IO, Firebase, and maps.

### Why Monorepo

A **Melos-managed Flutter monorepo** is strongly recommended over three separate Flutter projects. The core reasons:

| Problem with Separate Projects | Monorepo Solution |
|-------------------------------|------------------|
| Data models (Order, Restaurant, Driver) duplicated in 3 places | `shared_models` package — one definition, three consumers |
| API client and auth logic copy-pasted | `shared_services` — one implementation |
| UI theme (colors, typography, spacing) diverges over time | `shared_theme` — one source of truth |
| Bug fix in a utility requires 3 PRs | Fix once in `shared_utils`, benefits all apps |
| Three separate CI pipelines | One pipeline with per-app build steps |
| Dependency version conflicts | Melos enforces consistent versions via `melos.yaml` |

The monorepo approach saves an estimated 30–40% of development time on a project of this scale.

---

## 2. Monorepo Structure

### Top-Level Directory Tree

```
delivery_platform/                    # Git repository root
├── melos.yaml                        # Melos workspace config
├── .fvmrc                            # Flutter version (e.g., "3.22.0")
├── analysis_options.yaml             # Root Dart lint rules
├── .github/
│   └── workflows/
│       ├── ci-mobile.yml             # Flutter CI workflow
│       └── cd-mobile.yml             # Release build workflow
├── apps/
│   ├── customer_app/                 # Customer-facing Flutter app
│   ├── restaurant_app/               # Restaurant/store Flutter app
│   └── driver_app/                   # Driver Flutter app
└── packages/
    ├── shared_models/                # Data transfer objects, enums, JSON
    ├── shared_services/              # HTTP client, socket, FCM, storage
    ├── shared_theme/                 # Design tokens, colors, typography
    ├── shared_ui/                    # Reusable widgets
    └── shared_utils/                 # Pure utility functions
```

### `melos.yaml`

```yaml
name: delivery_platform

packages:
  - apps/**
  - packages/**

scripts:
  bootstrap:
    run: melos exec -- flutter pub get
    description: Get dependencies for all packages

  lint:
    run: melos exec -- dart analyze --fatal-infos
    description: Analyze all packages

  test:
    run: melos exec -- flutter test --coverage
    description: Run tests in all packages

  build:customer:
    run: cd apps/customer_app && flutter build appbundle --flavor production --dart-define-from-file=.env.production.json
    description: Build customer app production AAB

  build:restaurant:
    run: cd apps/restaurant_app && flutter build appbundle --flavor production --dart-define-from-file=.env.production.json
    description: Build restaurant app production AAB

  build:driver:
    run: cd apps/driver_app && flutter build appbundle --flavor production --dart-define-from-file=.env.production.json
    description: Build driver app production AAB

  clean:
    run: melos exec -- flutter clean
    description: Clean all packages
```

---

## 3. Shared Packages

Each shared package is a standard Flutter/Dart package with its own `pubspec.yaml`. Apps declare them as path dependencies.

```yaml
# Example in customer_app/pubspec.yaml
dependencies:
  shared_models:
    path: ../../packages/shared_models
  shared_services:
    path: ../../packages/shared_services
  shared_ui:
    path: ../../packages/shared_ui
  shared_theme:
    path: ../../packages/shared_theme
  shared_utils:
    path: ../../packages/shared_utils
```

---

### 3.1 `shared_models`

**Purpose:** All data classes that map to API responses and request bodies. This is the single definition of every entity that flows through the system.

**Dependencies:** `freezed`, `json_serializable`, `json_annotation`

**Structure:**
```
shared_models/lib/
├── shared_models.dart            # Barrel export
├── src/
│   ├── enums/
│   │   ├── order_status.dart     # OrderStatus enum (matches backend enum exactly)
│   │   ├── delivery_status.dart
│   │   ├── user_role.dart
│   │   ├── restaurant_status.dart
│   │   ├── driver_availability_status.dart
│   │   ├── payment_method.dart
│   │   └── notification_type.dart
│   ├── models/
│   │   ├── user.dart
│   │   ├── customer_profile.dart
│   │   ├── customer_address.dart
│   │   ├── restaurant.dart
│   │   ├── restaurant_category.dart
│   │   ├── menu_category.dart
│   │   ├── product.dart
│   │   ├── product_modifier.dart
│   │   ├── product_modifier_option.dart
│   │   ├── cart.dart
│   │   ├── cart_item.dart
│   │   ├── order.dart
│   │   ├── order_item.dart
│   │   ├── order_status_history.dart
│   │   ├── delivery.dart
│   │   ├── driver_profile.dart
│   │   ├── driver_offer.dart
│   │   ├── driver_location.dart
│   │   ├── driver_earning.dart
│   │   ├── payment.dart
│   │   ├── notification.dart
│   │   └── platform_setting.dart
│   ├── requests/
│   │   ├── create_order_request.dart
│   │   ├── otp_request.dart
│   │   ├── otp_verify_request.dart
│   │   └── add_address_request.dart
│   └── responses/
│       ├── api_response.dart      # Generic wrapper: ApiResponse<T>
│       ├── paginated_response.dart
│       ├── auth_response.dart
│       └── order_tracking_response.dart
```

**Key Design Pattern — `freezed` for immutable models:**

```dart
// shared_models/lib/src/models/order.dart
import 'package:freezed_annotation/freezed_annotation.dart';
import '../enums/order_status.dart';

part 'order.freezed.dart';
part 'order.g.dart';

@freezed
class Order with _$Order {
  const factory Order({
    required String id,
    required String restaurantId,
    required String restaurantName,
    required OrderStatus status,
    required double subtotal,
    required double deliveryFee,
    required double total,
    required String paymentMethod,
    required DateTime createdAt,
    @Default([]) List<OrderItem> items,
    @Default([]) List<OrderStatusHistory> statusHistory,
    Delivery? delivery,
  }) = _Order;

  factory Order.fromJson(Map<String, dynamic> json) => _$OrderFromJson(json);
}
```

**Rules:**
- Every model is `@freezed` — immutable, with `copyWith`, `==`, `hashCode`, and `toString` generated
- Every model has `fromJson` for API deserialization
- Enums match the backend enum values exactly (same casing)
- No UI logic, no platform imports — pure Dart only

---

### 3.2 `shared_services`

**Purpose:** All communication with the outside world — HTTP, WebSocket, Firebase, local storage, connectivity, and location.

**Dependencies:** `dio`, `socket_io_client`, `firebase_messaging`, `flutter_secure_storage`, `hive_flutter`, `connectivity_plus`, `geolocator`

**Structure:**
```
shared_services/lib/
├── shared_services.dart
└── src/
    ├── api/
    │   ├── api_client.dart          # Configured Dio instance
    │   ├── interceptors/
    │   │   ├── auth_interceptor.dart        # Adds Bearer token to every request
    │   │   ├── idempotency_interceptor.dart # Adds Idempotency-Key header
    │   │   ├── retry_interceptor.dart       # Retries on network errors
    │   │   └── logging_interceptor.dart     # Dev-mode request/response logging
    │   └── api_exception.dart       # Typed exception from API error envelope
    ├── socket/
    │   ├── socket_service.dart      # Socket.IO connection management
    │   └── socket_events.dart       # Const event name strings
    ├── notifications/
    │   └── fcm_service.dart         # FCM initialization and token management
    ├── storage/
    │   ├── secure_storage.dart      # flutter_secure_storage wrapper (tokens)
    │   ├── cache_storage.dart       # Hive wrapper (restaurants, orders, menu)
    │   └── hive_boxes.dart          # Hive box name constants
    ├── connectivity/
    │   └── connectivity_service.dart # Network state stream
    └── location/
        └── location_service.dart    # Geolocator wrapper, foreground service
```

---

### 3.3 `shared_theme`

**Purpose:** Single source of truth for all visual design tokens. Prevents theme drift across the three apps.

**Dependencies:** `flutter` SDK only

**Structure:**
```
shared_theme/lib/
├── shared_theme.dart
└── src/
    ├── app_colors.dart        # Color palette
    ├── app_typography.dart    # TextStyle definitions
    ├── app_spacing.dart       # Spacing constants (4px grid)
    ├── app_radius.dart        # Border radius constants
    ├── app_shadows.dart       # Box shadow definitions
    ├── app_theme.dart         # ThemeData for light mode
    └── app_theme_dark.dart    # ThemeData for dark mode (post-MVP)
```

**Example:**

```dart
// shared_theme/lib/src/app_colors.dart
class AppColors {
  AppColors._();

  // Brand
  static const Color primary = Color(0xFF1E7F4E);      // Delivery green
  static const Color primaryLight = Color(0xFF4CAF50);
  static const Color primaryDark = Color(0xFF145C37);

  // Status colors
  static const Color success = Color(0xFF2E7D32);
  static const Color warning = Color(0xFFF57C00);
  static const Color error = Color(0xFFC62828);
  static const Color info = Color(0xFF1565C0);

  // Neutral
  static const Color background = Color(0xFFF5F5F5);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color onSurface = Color(0xFF212121);
  static const Color textSecondary = Color(0xFF757575);
  static const Color border = Color(0xFFE0E0E0);
  static const Color skeleton = Color(0xFFEEEEEE);

  // Order status chips
  static const Color statusPending = Color(0xFFFFF8E1);
  static const Color statusActive = Color(0xFFE8F5E9);
  static const Color statusDelivered = Color(0xFFE3F2FD);
  static const Color statusCancelled = Color(0xFFFFEBEE);
}
```

```dart
// shared_theme/lib/src/app_spacing.dart
class AppSpacing {
  AppSpacing._();
  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 16.0;
  static const double lg = 24.0;
  static const double xl = 32.0;
  static const double xxl = 48.0;
}
```

---

### 3.4 `shared_ui`

**Purpose:** Reusable, app-agnostic widgets used across all three apps. No business logic — presentation only.

**Dependencies:** `shared_theme`, `cached_network_image`, `shimmer`, `flutter_map` (for maps)

**Structure:**
```
shared_ui/lib/
├── shared_ui.dart
└── src/
    ├── buttons/
    │   ├── app_button.dart          # Primary, secondary, outlined, text variants
    │   ├── app_icon_button.dart
    │   └── app_loading_button.dart  # Button with built-in loading spinner
    ├── inputs/
    │   ├── app_text_field.dart
    │   ├── app_phone_field.dart     # Phone number with country prefix
    │   ├── app_otp_field.dart       # 6-digit OTP input
    │   └── app_search_bar.dart
    ├── cards/
    │   ├── restaurant_card.dart
    │   ├── order_card.dart
    │   ├── product_card.dart
    │   └── delivery_request_card.dart
    ├── feedback/
    │   ├── app_snack_bar.dart       # Success/error/info toasts
    │   ├── app_dialog.dart          # Confirmation dialogs
    │   └── app_bottom_sheet.dart    # Bottom sheets
    ├── states/
    │   ├── loading_skeleton.dart    # Shimmer skeleton wrapper
    │   ├── empty_state.dart         # Empty state with illustration + CTA
    │   ├── error_state.dart         # Error with retry button
    │   └── offline_banner.dart      # Persistent offline/reconnecting banner
    ├── images/
    │   ├── app_cached_image.dart    # cached_network_image with fallback
    │   └── app_avatar.dart          # Circular avatar with initials fallback
    ├── map/
    │   ├── delivery_map.dart        # flutter_map with driver/customer markers
    │   └── address_picker_map.dart  # Map with draggable pin for address selection
    ├── navigation/
    │   ├── app_bottom_nav_bar.dart  # Shared bottom navigation bar widget
    │   └── app_app_bar.dart         # Consistent AppBar
    └── indicators/
        ├── order_status_timeline.dart  # Visual status progress stepper
        ├── rating_stars.dart
        └── connectivity_indicator.dart
```

---

### 3.5 `shared_utils`

**Purpose:** Pure Dart utility functions with zero Flutter dependency. Fully unit-testable.

**Dependencies:** `intl`, `uuid`

**Structure:**
```
shared_utils/lib/
├── shared_utils.dart
└── src/
    ├── formatters/
    │   ├── currency_formatter.dart   # formatCurrency(amount, locale)
    │   ├── date_formatter.dart       # formatDate, formatTime, formatRelative
    │   └── distance_formatter.dart   # formatDistance(meters) → "1.2 km"
    ├── validators/
    │   ├── phone_validator.dart      # E.164 phone validation
    │   ├── email_validator.dart
    │   └── required_validator.dart
    ├── generators/
    │   └── idempotency_key.dart      # generateIdempotencyKey() → UUIDv4 string
    ├── geo/
    │   └── haversine.dart            # Client-side distance calculation
    └── extensions/
        ├── string_extensions.dart    # capitalize, truncate, isNullOrEmpty
        ├── datetime_extensions.dart  # isToday, formatDisplay, toApiString
        └── order_status_extensions.dart # humanLabel, color, icon per status
```

**Example:**

```dart
// shared_utils/lib/src/extensions/order_status_extensions.dart
extension OrderStatusExtension on OrderStatus {
  String get humanLabel {
    switch (this) {
      case OrderStatus.pendingRestaurant: return 'Waiting for restaurant';
      case OrderStatus.acceptedByRestaurant: return 'Order accepted';
      case OrderStatus.preparing: return 'Preparing your order';
      case OrderStatus.lookingForDriver: return 'Finding a driver';
      case OrderStatus.driverAssigned: return 'Driver on the way';
      case OrderStatus.pickedUp: return 'Order picked up';
      case OrderStatus.onTheWay: return 'Driver heading to you';
      case OrderStatus.delivered: return 'Delivered';
      case OrderStatus.cancelled: return 'Cancelled';
      case OrderStatus.failed: return 'Could not be delivered';
      default: return 'Unknown';
    }
  }

  Color get statusColor {
    switch (this) {
      case OrderStatus.delivered: return AppColors.success;
      case OrderStatus.cancelled:
      case OrderStatus.failed: return AppColors.error;
      default: return AppColors.primary;
    }
  }
}
```

---

## 4. Per-App Folder Structure

All three apps follow the same internal structure. The **feature-first** folder organization is used: each screen/feature has its own folder containing its UI, state (providers), and any feature-specific widgets.

### 4.1 Customer App

```
apps/customer_app/
├── pubspec.yaml
├── analysis_options.yaml
├── android/
│   ├── app/
│   │   ├── google-services.json         # FCM config (per flavor)
│   │   └── src/
│   │       ├── main/
│   │       ├── development/             # Dev flavor resources
│   │       └── production/             # Prod flavor resources
│   └── build.gradle
├── ios/
│   ├── GoogleService-Info.plist         # FCM config (per flavor)
│   └── Runner/
├── assets/
│   ├── images/                          # Local images and illustrations
│   ├── icons/                           # App icons
│   └── lottie/                          # Lottie animation files
├── lib/
│   ├── main.dart                        # Entry point; selects flavor config
│   ├── main_development.dart
│   ├── main_production.dart
│   ├── app.dart                         # MaterialApp + router setup
│   ├── core/
│   │   ├── config/
│   │   │   ├── app_config.dart          # Flavor-specific config (API URL, etc.)
│   │   │   └── app_constants.dart       # App-wide constants
│   │   ├── di/
│   │   │   └── providers.dart           # Global Riverpod providers (DI root)
│   │   ├── router/
│   │   │   ├── app_router.dart          # go_router configuration
│   │   │   └── route_names.dart         # Route path constants
│   │   └── observers/
│   │       └── app_observer.dart        # Navigator observer for analytics
│   ├── features/
│   │   ├── auth/
│   │   │   ├── data/
│   │   │   │   └── auth_repository.dart
│   │   │   ├── providers/
│   │   │   │   └── auth_provider.dart
│   │   │   └── ui/
│   │   │       ├── splash_screen.dart
│   │   │       ├── onboarding_screen.dart
│   │   │       └── login_screen.dart
│   │   ├── home/
│   │   │   ├── data/
│   │   │   │   └── home_repository.dart
│   │   │   ├── providers/
│   │   │   │   └── home_provider.dart
│   │   │   └── ui/
│   │   │       └── home_screen.dart
│   │   ├── restaurant/
│   │   │   ├── data/
│   │   │   │   └── restaurant_repository.dart
│   │   │   ├── providers/
│   │   │   │   ├── restaurant_list_provider.dart
│   │   │   │   └── restaurant_detail_provider.dart
│   │   │   └── ui/
│   │   │       ├── restaurant_list_screen.dart
│   │   │       ├── restaurant_detail_screen.dart
│   │   │       └── widgets/
│   │   │           └── menu_section_widget.dart
│   │   ├── cart/
│   │   │   ├── data/
│   │   │   │   └── cart_repository.dart
│   │   │   ├── providers/
│   │   │   │   └── cart_provider.dart
│   │   │   └── ui/
│   │   │       ├── cart_screen.dart
│   │   │       └── checkout_screen.dart
│   │   ├── orders/
│   │   │   ├── data/
│   │   │   │   └── order_repository.dart
│   │   │   ├── providers/
│   │   │   │   ├── order_tracking_provider.dart
│   │   │   │   └── order_history_provider.dart
│   │   │   └── ui/
│   │   │       ├── order_confirmation_screen.dart
│   │   │       ├── order_tracking_screen.dart
│   │   │       ├── driver_tracking_screen.dart
│   │   │       ├── order_history_screen.dart
│   │   │       └── order_detail_screen.dart
│   │   ├── address/
│   │   │   ├── data/
│   │   │   │   └── address_repository.dart
│   │   │   ├── providers/
│   │   │   │   └── address_provider.dart
│   │   │   └── ui/
│   │   │       ├── address_list_screen.dart
│   │   │       └── add_edit_address_screen.dart
│   │   ├── search/
│   │   │   ├── data/
│   │   │   │   └── search_repository.dart
│   │   │   ├── providers/
│   │   │   │   └── search_provider.dart
│   │   │   └── ui/
│   │   │       └── search_screen.dart
│   │   ├── profile/
│   │   │   └── ui/
│   │   │       └── profile_screen.dart
│   │   └── notifications/
│   │       ├── providers/
│   │       │   └── notification_provider.dart
│   │       └── ui/
│   │           └── notifications_screen.dart
│   └── l10n/
│       ├── app_en.arb                   # English strings
│       └── app_ar.arb                   # Arabic strings (post-MVP)
└── test/
    ├── unit/
    ├── widget/
    └── integration/
```

### 4.2 Restaurant App

```
apps/restaurant_app/
├── lib/
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── orders/
│   │   │   └── ui/
│   │   │       ├── orders_dashboard_screen.dart
│   │   │       ├── order_detail_screen.dart
│   │   │       ├── active_orders_screen.dart
│   │   │       ├── preparation_screen.dart
│   │   │       └── driver_tracking_screen.dart
│   │   ├── menu/
│   │   │   └── ui/
│   │   │       ├── menu_management_screen.dart
│   │   │       ├── add_edit_product_screen.dart
│   │   │       └── working_hours_screen.dart
│   │   ├── earnings/
│   │   └── profile/
│   └── core/
│       ├── config/
│       ├── di/
│       └── router/
```

### 4.3 Driver App

```
apps/driver_app/
├── lib/
│   ├── features/
│   │   ├── auth/
│   │   ├── verification/
│   │   │   └── ui/
│   │   │       └── verification_screen.dart
│   │   ├── home/
│   │   │   └── ui/
│   │   │       └── driver_home_screen.dart    # Online/offline toggle
│   │   ├── delivery/
│   │   │   └── ui/
│   │   │       ├── delivery_request_overlay.dart
│   │   │       ├── active_delivery_screen.dart
│   │   │       ├── navigate_to_restaurant_screen.dart
│   │   │       ├── arrived_restaurant_screen.dart
│   │   │       ├── navigate_to_customer_screen.dart
│   │   │       └── delivered_screen.dart
│   │   ├── earnings/
│   │   ├── history/
│   │   ├── profile/
│   │   └── notifications/
│   └── core/
│       ├── config/
│       ├── di/
│       ├── router/
│       └── services/
│           └── location_foreground_service.dart  # Android foreground service
```

---

## 5. State Management

### Choice: Riverpod 2.x

**Riverpod** is chosen over Bloc/Cubit for this project. Here is the justification:

| Criterion | Riverpod 2.x | Bloc/Cubit |
|-----------|-------------|------------|
| Boilerplate | Low (code gen optional) | Medium (events + states) |
| Compile-time safety | ✓ (provider references are type-safe) | Partial |
| Dependency injection | Built-in (providers replace DI containers) | Manual or with get_it |
| Testability | Excellent (ProviderContainer in tests) | Excellent |
| Async data (FutureProvider, StreamProvider) | First-class | Manual mapping |
| Scoped state (per-screen) | Excellent (AutoDisposeProvider) | Requires complex nesting |
| Reactivity granularity | Fine-grained (select()) | Coarser |
| Learning curve | Medium | Medium |

Riverpod's `AsyncNotifier`, `FutureProvider`, and `StreamProvider` align perfectly with this app's data patterns (async API calls, realtime streams). Its built-in `ProviderContainer` makes unit testing trivial.

### Provider Organization

Every feature folder has a `providers/` subdirectory. Providers follow this layered pattern:

```
feature/
├── data/
│   └── feature_repository.dart      # Layer 1: raw API calls, cache reads/writes
├── providers/
│   ├── feature_provider.dart        # Layer 2: state management, business logic
│   └── feature_state.dart           # Layer 2: state class (if complex)
└── ui/
    └── feature_screen.dart          # Layer 3: ConsumerWidget reading providers
```

### Provider Patterns Used

**1. AsyncNotifier for API-backed screen state:**
```dart
// orders/providers/order_tracking_provider.dart
@riverpod
class OrderTracking extends _$OrderTracking {
  @override
  Future<OrderTrackingResponse> build(String orderId) async {
    // Initial load
    return ref.read(orderRepositoryProvider).getOrderTracking(orderId);
  }

  void handleStatusUpdate(OrderStatus newStatus) {
    // Update state from socket event without re-fetching
    state = state.whenData((tracking) =>
      tracking.copyWith(status: newStatus));
  }
}
```

**2. StreamProvider for realtime connectivity:**
```dart
// core/di/providers.dart
@riverpod
Stream<ConnectivityStatus> connectivityStream(ConnectivityStreamRef ref) {
  return ref.read(connectivityServiceProvider).statusStream;
}
```

**3. StateNotifier for local cart (offline-capable):**
```dart
// cart/providers/cart_provider.dart
@riverpod
class Cart extends _$Cart {
  @override
  CartState build() {
    // Load from Hive on first access
    return ref.read(cartRepositoryProvider).loadFromCache();
  }

  Future<void> addItem(CartItem item) async {
    state = state.addItem(item);
    await ref.read(cartRepositoryProvider).saveToCache(state);
  }
}
```

**4. `ref.listen` for socket events in screens:**
```dart
// In ConsumerStatefulWidget:
@override
void initState() {
  super.initState();
  ref.listenManual(orderSocketEventsProvider(widget.orderId), (prev, next) {
    next.whenData((event) {
      ref.read(orderTrackingProvider(widget.orderId).notifier)
         .handleStatusUpdate(event.status);
    });
  });
}
```

### Global Providers (injected at app root)

```dart
// core/di/providers.dart — globally available across the app

@riverpod
ApiClient apiClient(ApiClientRef ref) => ApiClient(
  baseUrl: AppConfig.apiBaseUrl,
  secureStorage: ref.read(secureStorageProvider),
);

@riverpod
SocketService socketService(SocketServiceRef ref) => SocketService(
  url: AppConfig.socketBaseUrl,
  secureStorage: ref.read(secureStorageProvider),
);

@riverpod
ConnectivityService connectivityService(ConnectivityServiceRef ref) =>
  ConnectivityService();

@riverpod
CacheStorage cacheStorage(CacheStorageRef ref) => CacheStorage();
```

---

## 6. API Layer

### 6.1 Dio Client Setup

```dart
// shared_services/lib/src/api/api_client.dart
class ApiClient {
  late final Dio _dio;

  ApiClient({
    required String baseUrl,
    required SecureStorage secureStorage,
  }) {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.addAll([
      AuthInterceptor(secureStorage: secureStorage, dio: _dio),
      IdempotencyInterceptor(),
      RetryInterceptor(dio: _dio),
      if (kDebugMode) LoggingInterceptor(),
    ]);
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? queryParams,
      required T Function(Map<String, dynamic>) fromJson}) async { ... }

  Future<T> post<T>(String path, {dynamic data,
      required T Function(Map<String, dynamic>) fromJson,
      bool requiresIdempotency = false}) async { ... }
}
```

### 6.2 Auth Interceptor (Token Refresh)

```dart
// shared_services/lib/src/api/interceptors/auth_interceptor.dart
class AuthInterceptor extends Interceptor {
  final SecureStorage _secureStorage;
  final Dio _dio;
  bool _isRefreshing = false;
  final List<RequestOptions> _pendingRequests = [];

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _secureStorage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      // Queue request and attempt token refresh
      if (!_isRefreshing) {
        _isRefreshing = true;
        final refreshed = await _attemptRefresh();
        if (refreshed) {
          // Retry all queued requests with new token
          _retryPendingRequests();
        } else {
          // Refresh failed — log out user
          _signOut();
        }
        _isRefreshing = false;
      } else {
        _pendingRequests.add(err.requestOptions);
      }
    }
    handler.next(err);
  }
}
```

### 6.3 Idempotency Interceptor

```dart
// shared_services/lib/src/api/interceptors/idempotency_interceptor.dart
class IdempotencyInterceptor extends Interceptor {
  // Routes that require idempotency keys
  static const _idempotentRoutes = ['/orders', '/auth/otp/verify'];

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final needsKey = options.method == 'POST' &&
        _idempotentRoutes.any((r) => options.path.endsWith(r));

    if (needsKey && !options.headers.containsKey('Idempotency-Key')) {
      options.headers['Idempotency-Key'] = const Uuid().v4();
    }
    handler.next(options);
  }
}
```

### 6.4 Retry Interceptor

```dart
// shared_services/lib/src/api/interceptors/retry_interceptor.dart
class RetryInterceptor extends Interceptor {
  static const _maxRetries = 3;
  static const _retryDelays = [
    Duration(seconds: 1),
    Duration(seconds: 3),
    Duration(seconds: 8),
  ];

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final attempt = err.requestOptions.extra['retryCount'] as int? ?? 0;

    // Only retry on network errors (not 4xx or 5xx)
    final isNetworkError = err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.connectionError;

    // Only retry safe/idempotent methods or requests with idempotency key
    final isIdempotent = err.requestOptions.method == 'GET' ||
        err.requestOptions.headers.containsKey('Idempotency-Key');

    if (isNetworkError && isIdempotent && attempt < _maxRetries) {
      await Future.delayed(_retryDelays[attempt]);
      err.requestOptions.extra['retryCount'] = attempt + 1;
      // Retry the request
      final response = await _dio.fetch(err.requestOptions);
      handler.resolve(response);
      return;
    }

    handler.next(err);
  }
}
```

### 6.5 API Exception Handling

```dart
// shared_services/lib/src/api/api_exception.dart
class ApiException implements Exception {
  final String code;
  final String message;
  final int statusCode;
  final Map<String, dynamic>? details;

  const ApiException({
    required this.code,
    required this.message,
    required this.statusCode,
    this.details,
  });

  factory ApiException.fromDioException(DioException e) {
    final data = e.response?.data;
    if (data is Map<String, dynamic> && data['error'] != null) {
      return ApiException(
        code: data['error']['code'] ?? 'UNKNOWN_ERROR',
        message: data['error']['message'] ?? 'An error occurred',
        statusCode: e.response?.statusCode ?? 0,
        details: data['error']['details'],
      );
    }
    // Network-level error
    return ApiException(
      code: 'NETWORK_ERROR',
      message: 'No internet connection. Please try again.',
      statusCode: 0,
    );
  }

  bool get isNetworkError => statusCode == 0;
  bool get isUnauthorized => statusCode == 401;
  bool get isRestaurantClosed => code == 'RESTAURANT_CLOSED';
  bool get isProductUnavailable => code == 'PRODUCT_UNAVAILABLE';
}
```

### 6.6 Repository Pattern

Each feature has a repository that wraps `ApiClient` calls. Repositories handle:
- Calling the API
- Parsing responses into model objects
- Reading/writing to the local cache (`CacheStorage`)
- Throwing typed `ApiException` on errors

```dart
// customer_app/lib/features/restaurant/data/restaurant_repository.dart
class RestaurantRepository {
  final ApiClient _apiClient;
  final CacheStorage _cache;

  Future<List<Restaurant>> getRestaurants({String? categoryId}) async {
    try {
      final response = await _apiClient.get('/restaurants',
        queryParams: {'categoryId': categoryId},
        fromJson: (json) => (json['data'] as List)
          .map((r) => Restaurant.fromJson(r)).toList(),
      );
      // Cache the result
      await _cache.put('restaurants_list', response, ttlMinutes: 10);
      return response;
    } on ApiException catch (e) {
      if (e.isNetworkError) {
        // Return cached data on network failure
        final cached = await _cache.get<List<Restaurant>>('restaurants_list');
        if (cached != null) return cached;
      }
      rethrow;
    }
  }
}
```

---

## 7. Realtime Layer

### 7.1 SocketService

```dart
// shared_services/lib/src/socket/socket_service.dart
class SocketService {
  late final IO.Socket _socket;
  final SecureStorage _secureStorage;
  final _connectionController = StreamController<bool>.broadcast();

  Stream<bool> get connectionStream => _connectionController.stream;
  bool get isConnected => _socket.connected;

  Future<void> connect() async {
    final token = await _secureStorage.getAccessToken();
    _socket = IO.io(
      AppConfig.socketBaseUrl,
      IO.OptionBuilder()
        .setTransports(['websocket'])
        .setQuery({'token': token})
        .enableAutoConnect()
        .enableReconnection()
        .setReconnectionAttempts(double.infinity)
        .setReconnectionDelay(1000)         // Start at 1s
        .setReconnectionDelayMax(30000)      // Cap at 30s
        .build(),
    );

    _socket.onConnect((_) {
      _connectionController.add(true);
      _onReconnected();
    });

    _socket.onDisconnect((_) {
      _connectionController.add(false);
    });
  }

  void joinOrderRoom(String orderId) {
    _socket.emit('join:order', {'orderId': orderId});
  }

  void on(String event, Function(dynamic) handler) {
    _socket.on(event, handler);
  }

  void off(String event) {
    _socket.off(event);
  }

  void emit(String event, Map<String, dynamic> data) {
    _socket.emit(event, data);
  }

  void _onReconnected() {
    // Signal the app to sync the latest state
    _socket.emit('client:reconnected', {});
  }

  void dispose() {
    _socket.dispose();
    _connectionController.close();
  }
}
```

### 7.2 Socket Event Constants

```dart
// shared_services/lib/src/socket/socket_events.dart
class SocketEvents {
  SocketEvents._();

  // Server → Client (listen)
  static const String orderNew = 'order:new';
  static const String orderAccepted = 'order:accepted';
  static const String orderRejected = 'order:rejected';
  static const String orderPreparing = 'order:preparing';
  static const String driverRequested = 'driver:requested';
  static const String driverAssigned = 'driver:assigned';
  static const String driverLocationUpdated = 'driver:location_updated';
  static const String orderPickedUp = 'order:picked_up';
  static const String orderOnTheWay = 'order:on_the_way';
  static const String orderDelivered = 'order:delivered';
  static const String orderCancelled = 'order:cancelled';
  static const String connectionRestored = 'connection:restored';

  // Client → Server (emit)
  static const String driverLocationUpdate = 'driver:location_update';
  static const String joinOrder = 'join:order';
  static const String clientReconnected = 'client:reconnected';
}
```

### 7.3 Connecting Socket Events to Riverpod

Use a `StreamProvider` powered by a broadcast `StreamController` that the `SocketService` feeds:

```dart
// orders/providers/order_tracking_provider.dart

@riverpod
Stream<OrderStatusEvent> orderSocketEvents(
    OrderSocketEventsRef ref, String orderId) {
  final socket = ref.read(socketServiceProvider);
  final controller = StreamController<OrderStatusEvent>.broadcast();

  // Listen to all relevant events for this order
  final events = [
    SocketEvents.orderAccepted, SocketEvents.orderPreparing,
    SocketEvents.driverAssigned, SocketEvents.orderPickedUp,
    SocketEvents.orderDelivered, SocketEvents.orderCancelled,
  ];

  for (final event in events) {
    socket.on(event, (data) {
      final payload = data as Map<String, dynamic>;
      if (payload['orderId'] == orderId) {
        controller.add(OrderStatusEvent.fromJson(payload));
      }
    });
  }

  ref.onDispose(() {
    for (final event in events) { socket.off(event); }
    controller.close();
  });

  return controller.stream;
}
```

### 7.4 Driver Location Sending (Driver App Only)

The Driver App sends location updates via the socket AND via HTTP POST as a dual strategy:

```dart
// driver_app/lib/core/services/location_foreground_service.dart
class LocationForegroundService {
  final SocketService _socket;
  final ApiClient _apiClient;
  final _locationQueue = Queue<LocationUpdate>();
  Timer? _batchTimer;

  void startTracking(DeliveryMode mode) {
    final accuracy = mode == DeliveryMode.active
        ? LocationAccuracy.high
        : LocationAccuracy.balanced;

    Geolocator.getPositionStream(
      locationSettings: LocationSettings(
        accuracy: accuracy,
        distanceFilter: mode == DeliveryMode.active ? 15 : 50,
      ),
    ).listen((position) {
      _handleNewPosition(position);
    });
  }

  void _handleNewPosition(Position position) {
    final update = LocationUpdate(
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
      heading: position.heading,
      speed: position.speedAccuracy,
      timestamp: DateTime.now(),
    );

    // Try socket first (fast path)
    if (_socket.isConnected) {
      _socket.emit(SocketEvents.driverLocationUpdate, update.toJson());
    } else {
      // Queue for HTTP batch send when reconnected
      _locationQueue.add(update);
      _scheduleBatchSend();
    }
  }

  void _scheduleBatchSend() {
    _batchTimer ??= Timer(const Duration(seconds: 10), () {
      if (_locationQueue.isNotEmpty) {
        _flushQueueViaHttp();
      }
      _batchTimer = null;
    });
  }
}
```

---

## 8. Notification Layer

### 8.1 FCM Setup

```dart
// shared_services/lib/src/notifications/fcm_service.dart
class FcmService {
  static Future<void> initialize() async {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );

    // Request permission (iOS)
    await FirebaseMessaging.instance.requestPermission(
      alert: true, badge: true, sound: true,
    );

    // Get and register token
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null) {
      await _registerToken(token);
    }

    // Listen for token refresh
    FirebaseMessaging.instance.onTokenRefresh.listen(_registerToken);

    // Foreground message handler
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Background/terminated handler (registered before runApp)
    FirebaseMessaging.onBackgroundMessage(_handleBackgroundMessage);

    // Notification tap (app in background)
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    // Notification tap (app terminated)
    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage);
    }
  }

  static void _handleForegroundMessage(RemoteMessage message) {
    // Show in-app notification banner using a local notification package
    // (flutter_local_notifications) — FCM does not show banners in foreground
    LocalNotificationService.show(message);
  }

  static Future<void> _handleBackgroundMessage(RemoteMessage message) async {
    // Minimal processing — must be a top-level function
    // FCM handles the notification display automatically in background
  }

  static void _handleNotificationTap(RemoteMessage message) {
    final orderId = message.data['orderId'];
    if (orderId != null) {
      // Navigate to order tracking
      AppRouter.navigateTo('/orders/$orderId/tracking');
    }
  }
}
```

### 8.2 Android-Specific: Disable Battery Optimization Prompt

In the Driver App and Restaurant App, guide users to disable battery optimization during onboarding. Use `permission_handler` or `disable_battery_optimization` package to request the exemption on Android:

```dart
// driver_app: shown on first online toggle
Future<void> requestBatteryOptimizationExemption() async {
  if (Platform.isAndroid) {
    final status = await Permission.ignoreBatteryOptimizations.status;
    if (!status.isGranted) {
      await Permission.ignoreBatteryOptimizations.request();
    }
  }
}
```

### 8.3 iOS-Specific: Background App Refresh

Add the following to `ios/Runner/Info.plist`:
```xml
<key>UIBackgroundModes</key>
<array>
  <string>remote-notification</string>
  <string>fetch</string>
  <!-- Driver app only: -->
  <string>location</string>
</array>
```

---

## 9. Offline / Weak Internet Layer

### 9.1 Local Cache with Hive

```dart
// shared_services/lib/src/storage/cache_storage.dart
class CacheStorage {
  static const String _restaurantsBox = 'restaurants';
  static const String _menuBox = 'menus';
  static const String _ordersBox = 'orders';
  static const String _cartBox = 'cart';
  static const String _activeDeliveryBox = 'active_delivery';

  Future<void> init() async {
    await Hive.initFlutter();
    await Hive.openBox<String>(_restaurantsBox);
    await Hive.openBox<String>(_menuBox);
    await Hive.openBox<String>(_ordersBox);
    await Hive.openBox<String>(_cartBox);
    await Hive.openBox<String>(_activeDeliveryBox);
  }

  // Store JSON string with expiry metadata
  Future<void> put(String key, dynamic value, {int ttlMinutes = 10}) async {
    final box = Hive.box<String>(_resolveBox(key));
    final payload = jsonEncode({
      'data': value,
      'expiresAt': DateTime.now().add(Duration(minutes: ttlMinutes))
                      .toIso8601String(),
    });
    await box.put(key, payload);
  }

  T? get<T>(String key, T Function(dynamic) fromJson) {
    final box = Hive.box<String>(_resolveBox(key));
    final raw = box.get(key);
    if (raw == null) return null;
    final payload = jsonDecode(raw);
    final expiresAt = DateTime.parse(payload['expiresAt']);
    if (DateTime.now().isAfter(expiresAt)) {
      box.delete(key); // Expired
      return null;
    }
    return fromJson(payload['data']);
  }
}
```

### 9.2 Retry Queue for Failed Actions

```dart
// shared_services/lib/src/storage/retry_queue.dart
class RetryQueue {
  final Box<String> _box;

  Future<void> enqueue(QueuedAction action) async {
    await _box.put(action.id, jsonEncode(action.toJson()));
  }

  Future<void> processAll(ApiClient apiClient) async {
    final actions = _box.values
        .map((v) => QueuedAction.fromJson(jsonDecode(v)))
        .toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt)); // FIFO

    for (final action in actions) {
      try {
        await apiClient.post(action.endpoint, data: action.payload,
            fromJson: (_) => null);
        await _box.delete(action.id); // Success — remove from queue
      } on ApiException catch (e) {
        if (!e.isNetworkError) {
          // Non-network error (e.g., 409 conflict) — remove and don't retry
          await _box.delete(action.id);
        }
        // Network error — leave in queue for next attempt
      }
    }
  }
}

// Trigger on connectivity restore:
connectivityService.statusStream
    .where((status) => status == ConnectivityStatus.connected)
    .listen((_) => retryQueue.processAll(apiClient));
```

### 9.3 Connectivity Monitor

```dart
// shared_services/lib/src/connectivity/connectivity_service.dart
class ConnectivityService {
  final _statusController = StreamController<ConnectivityStatus>.broadcast();

  Stream<ConnectivityStatus> get statusStream => _statusController.stream;

  ConnectivityService() {
    Connectivity().onConnectivityChanged.listen((result) {
      final isConnected = result != ConnectivityResult.none;
      _statusController.add(
        isConnected ? ConnectivityStatus.connected : ConnectivityStatus.offline);
    });
  }
}
```

### 9.4 Offline Banner Widget

```dart
// shared_ui/lib/src/states/offline_banner.dart
class OfflineBanner extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final connectivity = ref.watch(connectivityStreamProvider);
    return connectivity.when(
      data: (status) => AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        child: status == ConnectivityStatus.offline
          ? Container(
              key: const ValueKey('offline'),
              color: AppColors.error,
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.wifi_off, color: Colors.white, size: 14),
                  const SizedBox(width: 6),
                  Text('No internet connection',
                    style: AppTypography.caption.copyWith(color: Colors.white)),
                ],
              ),
            )
          : const SizedBox.shrink(key: ValueKey('online')),
      ),
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}
```

### 9.5 Per-App Offline Behavior Summary

| App | What works offline | What is blocked offline |
|-----|--------------------|-------------------------|
| Customer App | Browse cached restaurants, view cached menu, manage cart | Order placement, order tracking updates |
| Restaurant App | View cached active orders, view menu | Accept/reject orders, status updates, request driver |
| Driver App | View active delivery details, see cached destination | Status updates (queued + retried), receive new requests |

---

## 10. Routing

All three apps use **`go_router`** for declarative, URL-based routing. Deep links from FCM notifications use URL schemes.

### 10.1 Customer App Routes

```dart
// customer_app/lib/core/router/app_router.dart
final appRouter = GoRouter(
  initialLocation: '/splash',
  redirect: _authRedirect,
  routes: [
    GoRoute(path: '/splash',      builder: (_, __) => const SplashScreen()),
    GoRoute(path: '/onboarding',  builder: (_, __) => const OnboardingScreen()),
    GoRoute(path: '/login',       builder: (_, __) => const LoginScreen()),
    ShellRoute(
      builder: (ctx, state, child) => AppScaffold(child: child),
      routes: [
        GoRoute(path: '/home',    builder: (_, __) => const HomeScreen()),
        GoRoute(path: '/search',  builder: (_, __) => const SearchScreen()),
        GoRoute(
          path: '/restaurants/:restaurantId',
          builder: (_, state) => RestaurantDetailScreen(
            restaurantId: state.pathParameters['restaurantId']!),
        ),
        GoRoute(path: '/cart',    builder: (_, __) => const CartScreen()),
        GoRoute(path: '/checkout', builder: (_, __) => const CheckoutScreen()),
        GoRoute(
          path: '/orders/:orderId/confirmation',
          builder: (_, state) => OrderConfirmationScreen(
            orderId: state.pathParameters['orderId']!),
        ),
        GoRoute(
          path: '/orders/:orderId/tracking',          // FCM deep link target
          builder: (_, state) => OrderTrackingScreen(
            orderId: state.pathParameters['orderId']!),
        ),
        GoRoute(path: '/orders',    builder: (_, __) => const OrderHistoryScreen()),
        GoRoute(
          path: '/orders/:orderId',
          builder: (_, state) => OrderDetailScreen(
            orderId: state.pathParameters['orderId']!),
        ),
        GoRoute(path: '/addresses', builder: (_, __) => const AddressListScreen()),
        GoRoute(
          path: '/addresses/add',
          builder: (_, __) => const AddEditAddressScreen()),
        GoRoute(
          path: '/addresses/:addressId/edit',
          builder: (_, state) => AddEditAddressScreen(
            addressId: state.pathParameters['addressId']),
        ),
        GoRoute(path: '/profile',        builder: (_, __) => const ProfileScreen()),
        GoRoute(path: '/notifications',  builder: (_, __) => const NotificationsScreen()),
      ],
    ),
  ],
);
```

### 10.2 Restaurant App Routes

```
/splash
/login
/dashboard                       # Root (main screen)
/orders/:orderId                 # Incoming order detail
/orders/:orderId/preparation     # Preparation + request driver
/orders/:orderId/driver          # Assigned driver tracking
/menu                            # Menu management
/menu/categories/add
/menu/products/add
/menu/products/:productId/edit
/working-hours
/earnings
/profile
/notifications
```

### 10.3 Driver App Routes

```
/splash
/login
/verification                    # Profile + document upload
/home                            # Online/offline + status
/delivery/request                # Delivery request overlay (pushed on top)
/delivery/active                 # Active delivery hub
/delivery/navigate-to-restaurant
/delivery/arrived-restaurant
/delivery/navigate-to-customer
/delivery/delivered
/earnings
/history
/profile
/notifications
```

### 10.4 Deep Link Configuration

**Android** (`android/app/src/main/AndroidManifest.xml`):
```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="deliveryapp" android:host="customer" />
</intent-filter>
```

**iOS** (`ios/Runner/Info.plist`):
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array><string>deliveryapp</string></array>
  </dict>
</array>
```

FCM notification `data` payload includes `deepLink: "deliveryapp://customer/orders/uuid/tracking"`. `go_router` handles this via `GoRouter.of(context).go(deepLink)`.

---

## 11. UI / UX Rules

### 11.1 Loading States — Always Use Skeletons

Never show a blank screen or a centered spinner for content loading. Use shimmer skeleton layouts that mirror the shape of the actual content:

```dart
// shared_ui/lib/src/states/loading_skeleton.dart
class LoadingSkeleton extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColors.skeleton,
      highlightColor: AppColors.skeleton.withOpacity(0.3),
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: AppColors.skeleton,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}
```

### 11.2 Empty States

Every list screen must define a clear empty state with:
- An illustration (Lottie animation or SVG)
- A brief human-readable message (no technical jargon)
- A clear call-to-action button when relevant

```dart
// Usage
EmptyState(
  illustration: Assets.lottie.emptyCart,
  title: 'Your cart is empty',
  subtitle: 'Add items from a restaurant to get started',
  actionLabel: 'Browse Restaurants',
  onAction: () => context.go('/home'),
)
```

### 11.3 Error States

Every async data screen must handle errors with:
- A clear, human-readable error message (derived from `ApiException.message`)
- A **Retry** button that re-triggers the data fetch
- No raw error codes or stack traces visible to users

```dart
// Using Riverpod's AsyncValue:
AsyncValueWidget<List<Restaurant>>(
  value: ref.watch(restaurantListProvider),
  data: (restaurants) => RestaurantListView(restaurants: restaurants),
  loading: () => const RestaurantListSkeleton(),
  error: (error, _) => ErrorState(
    message: error is ApiException ? error.message : 'Something went wrong',
    onRetry: () => ref.invalidate(restaurantListProvider),
  ),
)
```

### 11.4 Optimistic UI

For actions where the user should see immediate feedback (availability toggle, cart update, notification mark as read), update the local state immediately and sync with the server in the background:

```dart
// Optimistic availability toggle
Future<void> toggleProductAvailability(String productId, bool isAvailable) async {
  // 1. Update state immediately (optimistic)
  state = state.updateProductAvailability(productId, isAvailable);

  try {
    // 2. Confirm with server
    await _repository.setProductAvailability(productId, isAvailable);
  } on ApiException {
    // 3. Revert on failure
    state = state.updateProductAvailability(productId, !isAvailable);
    // Show snackbar error
  }
}
```

### 11.5 Loading Button

All submit buttons must disable and show a spinner while the async action is in progress to prevent double submissions:

```dart
// shared_ui/lib/src/buttons/app_loading_button.dart
class AppLoadingButton extends StatelessWidget {
  final String label;
  final bool isLoading;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: isLoading ? null : onPressed,   // Disable when loading
      child: isLoading
        ? const SizedBox(
            width: 20, height: 20,
            child: CircularProgressIndicator(strokeWidth: 2,
              color: Colors.white))
        : Text(label),
    );
  }
}
```

### 11.6 RTL Support (Post-MVP)

The apps are English-first for MVP. RTL Arabic support is added post-MVP. Prepare now by:
- Using `EdgeInsetsDirectional` instead of `EdgeInsets.only(left/right: ...)`
- Using `start`/`end` instead of `left`/`right` in `Row` alignments
- Using `Directionality` widget at the root of the app, controlled by locale
- Never hardcoding a left-to-right layout assumption in a shared widget

### 11.7 Image Loading Rules

- Always use `AppCachedImage` (the shared wrapper around `cached_network_image`)
- Always provide a fallback placeholder (colored container with initials or a generic icon)
- Request image sizes appropriate to the display size using URL query params if the CDN supports it (`?w=300&q=80`)
- Lazy load images — never preload an entire list of images at once

### 11.8 Map Rules

- Use `flutter_map` with OpenStreetMap tiles for MVP (free, no API key required)
- Cache map tiles locally using `flutter_map_tile_caching` package — critical for weak internet
- Driver marker animates between location updates using a `Tween<LatLng>` animation
- Always show the last known driver location when live updates pause (with a "Last seen X min ago" label)
- Restaurant and customer location markers are static
- Map always fits both the driver and destination in the viewport on first load

### 11.9 Low-Bandwidth Considerations

| Rule | Implementation |
|------|---------------|
| Paginate all lists (max 20 items/page) | `limit=20` default on all list APIs |
| Compress images before upload | Client-side compression before `POST /images` using `flutter_image_compress` |
| Request small image variants | Append `?w=150` for thumbnails, `?w=600` for product detail |
| Debounce search input | 300ms debounce before firing `GET /search` |
| Skeleton screens reduce perceived loading time | Use `shimmer` package |
| HTTP response gzip | Enabled on the server; Dio handles decompression automatically |

---

## 12. Build & Release

### 12.1 Flavors / Environments

Each app has two flavors: `development` and `production`. This controls:
- API base URL
- Socket.IO URL
- Firebase project (different FCM credentials per environment)
- App ID (`com.delivery.customer.dev` vs `com.delivery.customer`)
- App name displayed on device ("Delivery Dev" vs "Delivery")

**Flutter flavor setup:**

```dart
// customer_app/lib/core/config/app_config.dart
class AppConfig {
  static late final String apiBaseUrl;
  static late final String socketBaseUrl;
  static late final String appName;

  static void init({
    required String apiBaseUrl,
    required String socketBaseUrl,
    required String appName,
  }) {
    AppConfig.apiBaseUrl = apiBaseUrl;
    AppConfig.socketBaseUrl = socketBaseUrl;
    AppConfig.appName = appName;
  }
}

// customer_app/lib/main_development.dart
void main() {
  AppConfig.init(
    apiBaseUrl: 'https://staging-api.domain.com/api/v1',
    socketBaseUrl: 'wss://staging-api.domain.com',
    appName: 'Delivery Dev',
  );
  runApp(const ProviderScope(child: App()));
}

// customer_app/lib/main_production.dart
void main() {
  AppConfig.init(
    apiBaseUrl: 'https://api.domain.com/api/v1',
    socketBaseUrl: 'wss://api.domain.com',
    appName: 'Delivery',
  );
  runApp(const ProviderScope(child: App()));
}
```

### 12.2 Android Release Build

```bash
# Generate release keystore (one-time, store securely)
keytool -genkey -v -keystore release.keystore -alias delivery -keyalg RSA -keysize 2048 -validity 10000

# Build signed AAB for production
cd apps/customer_app
flutter build appbundle \
  --flavor production \
  --target lib/main_production.dart \
  --release
```

Configure signing in `android/app/build.gradle`:
```groovy
signingConfigs {
  release {
    keyAlias System.getenv("KEY_ALIAS")
    keyPassword System.getenv("KEY_PASSWORD")
    storeFile file(System.getenv("KEYSTORE_PATH"))
    storePassword System.getenv("STORE_PASSWORD")
  }
}
```

### 12.3 iOS Release Build

```bash
# Build IPA (requires macOS with Xcode)
cd apps/customer_app
flutter build ipa \
  --flavor production \
  --target lib/main_production.dart \
  --release \
  --export-options-plist=ios/ExportOptions.plist
```

`ExportOptions.plist` is committed per app (specifies distribution method: `app-store`).

### 12.4 CI/CD Release Workflow

```yaml
# .github/workflows/cd-mobile.yml
name: Release Mobile Apps

on:
  push:
    tags:
      - 'v*'       # Triggered by version tags: v1.0.0

jobs:
  build-android:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [customer_app, restaurant_app, driver_app]
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.22.0'
      - run: melos bootstrap
      - run: cd apps/${{ matrix.app }} && flutter build appbundle --flavor production --target lib/main_production.dart --release
      - uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT }}
          packageName: com.delivery.${{ matrix.app }}
          releaseFiles: apps/${{ matrix.app }}/build/app/outputs/bundle/productionRelease/*.aab
          track: internal    # Upload to internal testing track

  build-ios:
    runs-on: macos-latest
    # Similar structure for iOS...
```

### 12.5 Version Management

Version numbers follow `MAJOR.MINOR.PATCH+BUILD_NUMBER` (e.g., `1.0.0+42`).

- `MAJOR`: Incompatible API or architecture changes
- `MINOR`: New features (backward compatible)
- `PATCH`: Bug fixes
- `BUILD_NUMBER`: Auto-incremented by CI (GitHub Actions run number)

Managed in each app's `pubspec.yaml`:
```yaml
version: 1.0.0+1    # Updated by CI before each build
```

---

## 13. Assumptions

- FVM (Flutter Version Manager) is used to pin the Flutter SDK version. All developers must have FVM installed. The `.fvmrc` file is committed to the repo.
- All three apps share the same Firebase project for development but use separate Firebase projects for production. This requires two sets of `google-services.json` and `GoogleService-Info.plist` files per app.
- The `shared_ui` package contains no navigation logic. All navigation is handled by each app's `go_router` instance.
- Riverpod's `ProviderScope` is placed at the very root of each app's `main.dart`, above `MaterialApp`. This ensures all providers are accessible from any widget.
- The `shared_models` package uses `build_runner` for code generation. The generated files (`*.g.dart`, `*.freezed.dart`) are committed to the repository (not gitignored) to avoid requiring code generation on every developer setup.
- `flutter_map` with OpenStreetMap is used for MVP to avoid Google Maps API costs. This will be migrated to Google Maps SDK in a post-MVP phase if more advanced map features are needed.

---

## 14. Open Questions

| # | Question | Impact | Who to Ask |
|---|---------|--------|-----------|
| 1 | Should the cart be server-synced (current design) or fully client-side only? | Affects whether cart needs an API layer or only Hive | Engineering / Product |
| 2 | Is Arabic RTL required at launch or can it wait for post-MVP? | Affects widget choices and layout patterns from day one | Product Owner |
| 3 | Should the Driver App use Socket.IO or raw HTTP for location updates as the primary channel? | Battery and reliability trade-off | Engineering |
| 4 | Should the restaurant app and driver app support tablet/iPad layouts? | Responsive layout complexity | Product / UX |
| 5 | Is there a preferred maps provider (Google Maps vs OpenStreetMap) given potential costs? | Map package choice | Business / Finance |
| 6 | Should in-app call proxy be used for driver-customer communication, or direct phone number? | Privacy implications; package integration | Legal / Product |
| 7 | Does the restaurant app need multi-branch support (one account, multiple restaurant locations)? | Affects `restaurantId` scoping in all restaurant providers | Product Owner |
| 8 | What is the minimum supported Android API level? | Determines background service and location API choices | Product / Engineering |
| 9 | Should the apps support biometric authentication (Face ID / fingerprint) for returning users? | Post-MVP feature; needs planning if added later | Product Owner |
| 10 | Is Lottie animation approved for use, or should all illustrations be static SVGs? | Asset format, file size, and animation performance | UX / Engineering |

---

## ملخص الملف

**ما هدف هذا الملف؟**

هذا الملف هو **الخريطة المعمارية لتطبيقات Flutter الثلاثة** — يُجيب على سؤال: كيف تُبنى تطبيقات الجوال من الداخل؟

يحتوي على:
- هيكل الـ Monorepo بـ Melos (تطبيقات مشتركة في مشروع واحد)
- الحزم المشتركة بين التطبيقات الثلاثة (`shared_models`, `shared_ui`, `shared_services`...)
- هيكل مجلدات كل تطبيق (Customer / Restaurant / Driver) بالتفصيل
- إدارة الحالة بـ Riverpod — كيف تُبنى الـ Providers والـ Notifiers
- نظام التنقل بـ go_router — كيف تُعرَّف المسارات
- كيف يتصل Flutter بالـ API (Dio + interceptors)
- كيف يتصل Flutter بـ Socket.IO
- كيف يعمل النظام بدون إنترنت (Hive cache + retry queue)
- إدارة الـ FCM وإشعارات الجهاز
- استراتيجية GPS وتتبع الموقع في تطبيق السائق

**من يقرأه؟** مهندس Flutter قبل ما يبدأ بكتابة أي شاشة أو Feature. هو المرجع المعماري لكل التطبيقات.

**القاعدة:** أي Feature جديدة في Flutter تتبع نفس البنية والأنماط الموثقة في هذا الملف.
