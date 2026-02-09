# Booking.go - System Architecture & Design Document

**Version:** 1.0  
**Date:** February 9, 2026  
**Status:** Draft - For Review

---

## Repository Structure

This project is split into **two separate repositories**:

1. **`booking-go-backend`** - Backend API (Node.js + Express + TypeScript)
2. **`booking-go-frontend`** - Frontend Web App (Next.js + TypeScript)

Each repository is independently deployable and versioned.

---

## 1. Project Vision & Goals

### Problem Statement
Small-scale business owners (salons, consultants, gyms, clinics, etc.) struggle with managing bookings efficiently. Customers find it difficult to book slots without calling or messaging. Both parties need a simple, modern solution.

### Solution
**Booking.go** - A multi-tenant SaaS platform where:
- Business owners can create their booking platform in minutes
- Customers can easily discover and book available slots
- Future: AI-powered chat interface for natural language booking

### Core Goals
1. **Simplicity First** - Easy for non-tech-savvy business owners
2. **Customer Experience** - Seamless booking flow
3. **Scalability** - Support for multiple businesses
4. **Future-Ready** - Architecture that supports AI integration

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                        │
│                     (Next.js + TypeScript)                   │
├───────────────────────────┬─────────────────────────────────┤
│  Business Owner Portal    │    Customer Booking Portal      │
│  - Dashboard              │    - Browse businesses          │
│  - Slot Management        │    - View available slots       │
│  - Booking Management     │    - Make bookings              │
│  - Analytics              │    - Manage bookings            │
└───────────────────────────┴─────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         API GATEWAY                          │
│                     Rate Limiting & Auth                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       BACKEND LAYER                          │
│                  (Node.js + Express + TypeScript)            │
├─────────────────────────────────────────────────────────────┤
│  Services:                                                   │
│  ├─ Authentication Service                                   │
│  ├─ Business Management Service                              │
│  ├─ Slot Management Service                                  │
│  ├─ Booking Service                                          │
│  ├─ Notification Service                                     │
│  └─ Analytics Service                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │PostgreSQL│  │ MongoDB  │  │  Redis   │
         │(Primary) │  │(Logs/Ana)│  │ (Cache)  │
         └──────────┘  └──────────┘  └──────────┘
```

### 2.2 Technology Stack Rationale

| Technology | Purpose | Why? |
|------------|---------|------|
| **Next.js** | Frontend Framework | SSR/SSG for SEO, great DX, API routes |
| **TypeScript** | Type Safety | Catch errors early, better IDE support |
| **PostgreSQL** | Primary Database | ACID compliance, complex queries, relationships |
| **MongoDB** | Logs & Analytics | Flexible schema, time-series data |
| **Redis** | Caching & Sessions | Fast read access, session management |
| **Express** | Backend Framework | Lightweight, flexible, large ecosystem |

---

## 3. Database Design

### 3.1 Data Storage Strategy

**PostgreSQL** (Relational Data):
- Users, Businesses, Services
- Slots, Bookings, Reviews
- Data requiring ACID transactions

**MongoDB** (Document Data):
- Activity Logs
- Business Analytics (time-series)
- Notifications
- Future: AI Chat conversations

**Redis** (Cached Data):
- Session tokens
- Available slots cache
- Business profile cache
- Rate limiting counters

### 3.2 Key Design Decisions

**Q: Why separate databases?**
- PostgreSQL for transactional integrity (bookings, payments)
- MongoDB for flexible, high-write analytics data
- Redis for ephemeral, fast-access data

**Q: How to handle slot availability?**
- Store slots in PostgreSQL
- Cache available slots in Redis (TTL: 5 minutes)
- Invalidate cache on booking creation/cancellation

**Q: How to prevent double-booking?**
- Database-level constraints
- Pessimistic locking during booking creation
- Atomic increment of `booked_count`

---

## 4. Core Entities & Relationships

### 4.1 Entity Relationship

```
User (1) ──────────── (M) Business
  │                        │
  │                        │
  │                   (1) ──┴── (M) Service
  │                        │
  │                        │
  └──── (M) Booking ─── (M)└────── (M) Slot
         │                           │
         │                           │
    (1) ─┴─ (1) Review          Associated with
                                 Service (optional)
```

### 4.2 Key Workflows

**Business Owner Onboarding:**
1. Register → Create Profile
2. Create Business → Configure Settings
3. Add Services → Create Slots
4. Receive Bookings → Manage Calendar

**Customer Booking Flow:**
1. Browse Businesses → Select Business
2. Choose Service → View Available Slots
3. Select Slot → Enter Details
4. Confirm Booking → Receive Confirmation

---

## 5. API Design Principles

### 5.1 Backend Layered Architecture

```
src/
  server.ts                        ← Express app entry point
  │
  config/                          ← DB connections, env validation
  │  postgres.ts, mongodb.ts, redis.ts, index.ts
  │
  middleware/                      ← Express middleware (auth, errors, rate limiting)
  │  auth.ts, errorHandler.ts, rateLimiter.ts, index.ts
  │
  routes/                          ← Thin route layer (req/res only, delegates to services)
  │  index.ts                      ← Mounts versioned routers
  │  v1/
  │    index.ts                    ← Barrel: wires all v1 domain routes
  │    auth.routes.ts, business.routes.ts, slot.routes.ts, booking.routes.ts, user.routes.ts
  │
  core/                            ← Business logic layer (no Express dependency)
  │  index.ts                      ← Barrel: re-exports constants, validators, repositories, services
  │  constants/                    ← Enums, HTTP status, cache keys, app config
  │  validators/                   ← Zod schemas per domain (auth, user, business, service, slot, booking, review)
  │  repositories/                 ← Data access layer — raw PG/Mongo queries per domain
  │  services/                     ← Business logic — orchestrates repos, libs, validators
  │
  libs/                            ← Shared non-domain utilities
  │  index.ts                      ← Barrel
  │  logger.ts, cache.ts, email.ts, hash.ts, jwt.ts, async-wrapper.ts
  │
  types/                           ← TypeScript interfaces per domain
  │  user.types.ts, business.types.ts, service.types.ts, slot.types.ts, ...
  │
  models/                          ← Mongoose models (MongoDB collections)
     activityLog.model.ts, notification.model.ts, analytics.model.ts
```

### 5.2 Request Flow

```
HTTP Request
  │
  ▼
Middleware (auth, rate limit)
  │
  ▼
Route (thin — extracts req params, calls service, sends res)
  │
  ▼
Service (business logic — validates, orchestrates, never touches req/res)
  │
  ▼
Repository (data access — SQL/Mongo queries, returns raw data)
  │         ↕
  │       Libs (logger, cache, email, jwt, hash)
  ▼
Database (PostgreSQL / MongoDB / Redis)
```

**Rules:**
- Routes never touch the database directly
- Services never know about `req` / `res`
- Repositories are the only layer that writes SQL or Mongo queries
- Validators run before service logic (via middleware or inside services)
- Libs are stateless utilities — no domain logic

### 5.3 RESTful Structure

```
/api/v1/auth/*           - Authentication endpoints
/api/v1/users/*          - User management
/api/v1/businesses/*     - Business CRUD + sub-resources
/api/v1/slots/*          - Slot management
/api/v1/bookings/*       - Booking operations
```

### 5.4 Authentication Flow

```
Registration → JWT Access Token (15m) + Refresh Token (30d)
                        │
                        ▼
Every Request → Bearer Token in Header
                        │
         ┌──────────────┴──────────────┐
         │ Valid?                       │
         ▼                              ▼
      Proceed                    Refresh with Refresh Token
                                        │
                                   Valid? → New Access Token
                                   Invalid? → Re-login
```

---

## 6. Future AI Integration (Phase 2)

### 6.1 AI Chat Feature Vision

**User Experience:**
```
Customer: "I need a haircut tomorrow afternoon"
AI Bot: "I found 3 salons available tomorrow afternoon:
         1. Hair Studio (2:00 PM, 3:00 PM available)
         2. Style Salon (2:30 PM, 4:00 PM available)
         Would you like to book one?"
Customer: "Book Hair Studio at 2 PM"
AI Bot: "Great! I'll book you at Hair Studio for tomorrow 2 PM.
         Please provide your contact details..."
```

### 6.2 AI Architecture (Planned)

```
┌──────────────┐
│ User Message │
└──────┬───────┘
       ▼
┌──────────────────┐
│  AI Chat Service │
│  (LLM Integration)│
└──────┬───────────┘
       ▼
┌──────────────────────────────┐
│ Intent Classification        │
│ - Search for business        │
│ - Check availability         │
│ - Make booking              │
│ - Cancel booking            │
└──────┬───────────────────────┘
       ▼
┌──────────────────┐
│  Booking API     │
│  (Existing)      │
└──────────────────┘
```

---

## 7. Scalability Considerations

### 7.1 Current Phase (MVP)

- **Expected Load:** 100-1000 businesses
- **Concurrent Users:** ~1000
- **Architecture:** Monolithic backend, separate frontend

### 7.2 Future Scaling Path

**When to scale:**
- \> 10,000 businesses
- \> 100,000 daily bookings
- International expansion

**Scaling Strategy:**
1. **Horizontal Scaling:** Add more backend instances (stateless design)
2. **Database:** Read replicas, connection pooling
3. **Caching:** Redis cluster, CDN for static assets
4. **Microservices:** Split into booking, notification, analytics services

---

## 8. Security Considerations

### 8.1 Authentication & Authorization

- JWT tokens with short expiry
- Role-based access control (Customer, Business Owner, Admin)
- Password hashing with bcrypt
- Rate limiting per IP

### 8.2 Data Protection

- SQL injection prevention (parameterized queries)
- XSS protection (input sanitization)
- CORS configuration
- HTTPS only in production

---

## 9. Development Phases

### Phase 1: MVP (Current)
- [ ] Core booking functionality
- [ ] Business owner dashboard
- [ ] Customer booking portal
- [ ] Basic authentication
- [ ] Email notifications

### Phase 2: Enhanced Features
- [ ] Payment integration
- [ ] Advanced analytics
- [ ] Mobile apps
- [ ] Multi-language support

### Phase 3: AI Integration
- [ ] AI chat interface
- [ ] Natural language booking
- [ ] Smart recommendations
- [ ] Automated customer support

---

## 10. Open Questions & Decisions Needed

### 10.1 Business Logic

1. **Slot Management:**
   - Should slots be recurring (daily/weekly)?
   - How to handle exceptions (holidays)?
   - Buffer time between bookings?

2. **Booking Policies:**
   - Auto-confirm or manual approval?
   - Cancellation deadlines?
   - No-show handling?

3. **Payment Integration:**
   - Phase 1 or Phase 2?
   - Full payment or deposit only?
   - Which payment gateway?

### 10.2 Technical Decisions

1. **Repository Management:**
   - [x] Separate repositories for backend and frontend
   - Git branching strategy (GitFlow, trunk-based)?
   - Monorepo tools if needed later?

2. **Deployment:**
   - Self-hosted or cloud (AWS/GCP/Azure)?
   - Docker containers?
   - CI/CD pipeline?

3. **Monitoring:**
   - Error tracking (Sentry)?
   - Analytics (Google Analytics, Mixpanel)?
   - Server monitoring (DataDog, New Relic)?

---

## 11. Next Steps

1. **Review & Refine** this architecture document
2. **Decide** on open questions above
3. **Create** detailed database schema
4. **Design** API contracts (request/response)
5. **Wireframe** key user interfaces
6. **Begin** implementation with approved design

---

## Questions for Discussion

1. Do you want automatic booking confirmation or manual approval by business owners?
2. Should we include payment processing in Phase 1 or keep it simple first?
3. Any specific business types you want to target initially (salons, consultants, gyms)?
4. What's your timeline for MVP launch?
5. Do you have preferences for deployment infrastructure?

