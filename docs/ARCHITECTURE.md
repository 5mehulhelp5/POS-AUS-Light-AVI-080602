# Australian Lighting & Fans - POS System Architecture

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STORE NETWORK (LAN)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  POS Terminal│    │  POS Terminal│    │   Manager    │                   │
│  │   (Browser)  │    │   (Browser)  │    │   Tablet     │                   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                   │
│         │                   │                   │                           │
│         └───────────────────┼───────────────────┘                           │
│                             │                                               │
│                             ▼                                               │
│              ┌─────────────────────────────┐                                │
│              │      NGINX (Reverse Proxy)   │                               │
│              │      Port 80/443             │                               │
│              └──────────────┬──────────────┘                                │
│                             │                                               │
│         ┌───────────────────┼───────────────────┐                          │
│         │                   │                   │                          │
│         ▼                   ▼                   ▼                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │   React     │    │   NestJS    │    │   Static    │                     │
│  │   Frontend  │    │   Backend   │    │   Assets    │                     │
│  │   :3000     │    │   :4000     │    │             │                     │
│  └─────────────┘    └──────┬──────┘    └─────────────┘                     │
│                            │                                               │
│                            ▼                                               │
│              ┌─────────────────────────────┐                               │
│              │       MySQL Database         │                              │
│              │       (Local Cache)          │                              │
│              │       Port 3306              │                              │
│              └─────────────────────────────┘                               │
│                                                                            │
└────────────────────────────────────────┬───────────────────────────────────┘
                                         │
                                         │ HTTPS (REST/GraphQL)
                                         ▼
                          ┌─────────────────────────────┐
                          │      MAGENTO (CLOUD)        │
                          │    Source of Truth          │
                          │                             │
                          │  • Products                 │
                          │  • Inventory                │
                          │  • Customers                │
                          │  • Orders                   │
                          └─────────────────────────────┘
```

## 2. Component Overview

### 2.1 Frontend (React)
- **Purpose**: POS-optimized touch-friendly UI
- **Key Features**:
  - Product search and browsing
  - Cart management
  - Customer lookup/creation
  - Payment processing
  - Receipt generation
  - Quote management
  - CRM inquiry logging

### 2.2 Backend (NestJS)
- **Purpose**: Business logic, API, sync orchestration
- **Key Modules**:
  - Auth (JWT-based)
  - Users & Roles
  - Products (cached)
  - Customers
  - Orders
  - Payments
  - Discounts (with audit)
  - Quotes
  - Inquiries
  - Sync Engine
  - Reports

### 2.3 MySQL Database
- **Purpose**: Fast local cache for store operations
- **Characteristics**:
  - Optimized for read-heavy POS operations
  - Stores synced Magento data
  - Maintains audit trails
  - Handles offline resilience

### 2.4 Magento Integration
- **Method**: REST API (primary), GraphQL (product queries)
- **Direction**:
  - Magento → POS: Products, inventory, prices, tax
  - POS → Magento: Customers, orders, inventory updates

## 3. Data Flow Diagrams

### 3.1 Product Sync Flow
```
Magento ──► Sync Service ──► Transform ──► MySQL Cache
                │
                ▼
           Sync Log (audit)
```

### 3.2 Order Creation Flow
```
Cart ──► Discount Engine ──► Validation ──► Order Created (POS DB)
                                                    │
                                                    ▼
                                           Magento Sync Queue
                                                    │
                                                    ▼
                                           Magento Order Created
                                                    │
                                                    ▼
                                           Inventory Updated (Both)
```

### 3.3 Customer Creation Flow
```
POS UI ──► Create Customer (POS DB) ──► Sync to Magento ──► Store Magento ID
```

## 4. Security Architecture

### 4.1 Authentication
- JWT tokens with role claims
- Token expiry: 8 hours (shift-based)
- Refresh token rotation
- Session invalidation on logout

### 4.2 Authorization
- Role-based access control (RBAC)
- Permission middleware on all routes
- Discount limits enforced server-side
- Action logging for audit

### 4.3 Network Security
- HTTPS for all Magento communication
- Internal network for POS terminals
- API rate limiting
- Input validation on all endpoints

## 5. Offline Resilience Strategy

```
┌─────────────────────────────────────────┐
│           NORMAL OPERATION              │
│  All data syncs in real-time            │
└─────────────────┬───────────────────────┘
                  │ Network failure detected
                  ▼
┌─────────────────────────────────────────┐
│           OFFLINE MODE                  │
│  • Use cached product data              │
│  • Queue orders locally                 │
│  • Queue customer creates               │
│  • Show offline indicator               │
└─────────────────┬───────────────────────┘
                  │ Network restored
                  ▼
┌─────────────────────────────────────────┐
│           SYNC RECOVERY                 │
│  • Process queued orders                │
│  • Sync pending customers               │
│  • Refresh product cache                │
│  • Reconcile inventory                  │
└─────────────────────────────────────────┘
```

## 6. Performance Targets

| Operation | Target | Strategy |
|-----------|--------|----------|
| Product search | < 100ms | Indexed MySQL, in-memory cache |
| Add to cart | < 50ms | Client-side optimistic update |
| Checkout total | < 200ms | Pre-calculated discounts |
| Order creation | < 500ms | Async Magento sync |
| Receipt generation | < 300ms | Client-side PDF |

## 7. Assumptions Made

1. **Single Terminal Concurrency**: While multiple terminals exist, cart collisions are rare (different customers)
2. **Network Reliability**: Store has stable internet; offline mode is backup only
3. **Magento Version**: 2.4.x with standard REST API enabled
4. **Tax**: Australian GST (10%) applied to all products
5. **Currency**: AUD only
6. **Receipt Printer**: Thermal printer accessible via browser print dialog
7. **EFTPOS**: External terminal (not integrated) - staff enters amount manually
8. **Business Hours**: System runs during store hours; sync jobs run overnight

## 8. Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend Framework | NestJS | Modular, TypeScript, dependency injection |
| ORM | TypeORM | MySQL support, migrations, decorators |
| Auth | JWT | Stateless, scalable, standard |
| API Style | REST | Simpler for CRUD operations |
| State Management | Redux Toolkit | Predictable, DevTools support |
| UI Components | Custom + Tailwind | POS-specific needs, fast styling |
| PDF Generation | React-PDF | Client-side receipt generation |
