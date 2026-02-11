# Booking.go — Project Roadmap

**Version:** 1.0  
**Date:** February 10, 2026  
**Methodology:** Agile (2-week sprints)  
**Sprint Duration:** 2 weeks

---

## Overview

This roadmap breaks the project into **6 phases** with clear dependencies. Each phase builds on the previous one. Sprints within a phase can overlap slightly, but cross-phase dependencies must be respected.

```
Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4 ──▶ Phase 5 ──▶ Phase 6
Foundation   Core        Booking     Engagement   Frontend    AI &
& Auth       Business    Engine      & Insights   App         Future
```

---

## Phase 1: Foundation & Authentication

> **Goal:** Bootable server, database connectivity, auth flow — the base everything depends on.  
> **Duration:** 4 weeks (Sprint 1–2)  
> **Milestone:** User can register, login, get a JWT, and refresh tokens.

### Sprint 1 — Project Bootstrap & Infrastructure (Week 1–2)

| ID   | Task                                          | Priority | Depends On |
|------|-----------------------------------------------|----------|------------|
| S1.1 | Finalize Docker compose (Postgres, Mongo, Redis) | P0       | —          |
| S1.2 | Verify DB connections (postgres.ts, mongodb.ts, redis.ts) | P0 | S1.1 |
| S1.3 | Setup environment config validation (Zod schema for .env) | P0 | — |
| S1.4 | Implement global error handler (AppError classes, async wrapper) | P0 | — |
| S1.5 | Setup request logging (Morgan + MongoDB activity log) | P1 | S1.2 |
| S1.6 | Setup ESLint + Prettier + Husky pre-commit hooks | P1 | — |
| S1.7 | Add health-check endpoint with DB status | P1 | S1.2 |
| S1.8 | Setup Jest/Vitest + Supertest for integration tests | P1 | — |

**Deliverable:** `docker compose up` boots everything. Server starts, connects to all DBs, and returns health status.

---

### Sprint 2 — Authentication Module (Week 3–4)

| ID   | Task                                          | Priority | Depends On |
|------|-----------------------------------------------|----------|------------|
| S2.1 | Implement `POST /auth/register` (hash password, create user in PG) | P0 | S1.2, S1.4 |
| S2.2 | Implement `POST /auth/login` (verify credentials, issue JWT + refresh token) | P0 | S2.1 |
| S2.3 | Implement `POST /auth/refresh` (rotate refresh token) | P0 | S2.2 |
| S2.4 | Implement `POST /auth/logout` (invalidate refresh token in Redis) | P0 | S2.3 |
| S2.5 | Implement `authenticate` middleware (verify JWT on every protected route) | P0 | S2.2 |
| S2.6 | Implement `authorize` middleware (role-based access) | P0 | S2.5 |
| S2.7 | Implement `POST /auth/forgot-password` (generate reset token, send email stub) | P1 | S2.1 |
| S2.8 | Implement `POST /auth/reset-password` (verify token, update password) | P1 | S2.7 |
| S2.9 | Write auth integration tests (register → login → refresh → logout flow) | P0 | S2.1–S2.4 |
| S2.10 | Redis session/token blacklist caching | P1 | S2.4 |

**Deliverable:** Full auth cycle works end-to-end. Protected routes reject unauthenticated requests.

**[MILESTONE] Phase 1: "Walking Skeleton"**  
Server boots, connects to all databases, users can register/login, JWTs are issued and validated.

---

## Phase 2: Core Business Logic

> **Goal:** Business owners can onboard, configure their business, and manage services.  
> **Duration:** 4 weeks (Sprint 3–4)  
> **Milestone:** A business owner can create a business with services and business hours.  
> **Depends On:** Phase 1 complete (auth works)

### Sprint 3 — User & Business Management (Week 5–6)

| ID   | Task                                          | Priority | Depends On |
|------|-----------------------------------------------|----------|------------|
| S3.1 | Implement `GET /users/me` (fetch own profile) | P0 | Phase 1 |
| S3.2 | Implement `PUT /users/me` (update own profile) | P0 | S3.1 |
| S3.3 | Implement `POST /businesses` (create business, auto-assign owner) | P0 | Phase 1 |
| S3.4 | Implement `GET /businesses/:id` (public business profile) | P0 | S3.3 |
| S3.5 | Implement `PUT /businesses/:id` (owner updates business) | P0 | S3.3 |
| S3.6 | Implement `GET /businesses` (search & filter businesses) | P1 | S3.3 |
| S3.7 | Implement `DELETE /businesses/:id` (soft delete) | P1 | S3.3 |
| S3.8 | Add business slug uniqueness & validation | P1 | S3.3 |
| S3.9 | Implement business hours CRUD (nested under business) | P0 | S3.3 |
| S3.10 | Implement business holidays CRUD (nested under business) | P1 | S3.3 |
| S3.11 | Write business module integration tests | P0 | S3.3–S3.5 |

**Deliverable:** Business owners can fully onboard and configure their business profile.

---

### Sprint 4 — Service Management (Week 7–8)

| ID   | Task                                          | Priority | Depends On |
|------|-----------------------------------------------|----------|------------|
| S4.1 | Implement `POST /businesses/:id/services` (create service) | P0 | Sprint 3 |
| S4.2 | Implement `GET /businesses/:id/services` (list services) | P0 | S4.1 |
| S4.3 | Implement `PUT /businesses/:id/services/:serviceId` (update service) | P0 | S4.1 |
| S4.4 | Implement `DELETE /businesses/:id/services/:serviceId` (deactivate) | P1 | S4.1 |
| S4.5 | Input validation with Zod schemas (service create/update) | P0 | S4.1 |
| S4.6 | Implement request validation middleware (generic Zod validator) | P0 | — |
| S4.7 | Add pagination helper (cursor-based or offset) | P1 | — |
| S4.8 | Write service module integration tests | P0 | S4.1–S4.3 |

**Deliverable:** Business owners can manage their service catalog.

**[MILESTONE] Phase 2: "Business Onboarding"**  
A business owner can register → create business → set hours → add services. Ready for slot generation.

---

## Phase 3: Booking Engine

> **Goal:** The core value — slot management and the booking flow.  
> **Duration:** 4 weeks (Sprint 5–6)  
> **Milestone:** Customers can discover available slots and make bookings.  
> **Depends On:** Phase 2 complete (businesses & services exist)

### Sprint 5 — Slot Management (Week 9–10)

| ID   | Task                                          | Priority | Depends On |
|------|-----------------------------------------------|----------|------------|
| S5.1 | Implement `POST /slots` (create single slot) | P0 | Phase 2 |
| S5.2 | Implement `POST /slots/bulk` (auto-generate slots from business hours + service duration) | P0 | S5.1 |
| S5.3 | Implement `GET /slots/available` (public — query available slots by business, service, date range) | P0 | S5.1 |
| S5.4 | Implement `GET /slots` (owner view — all slots with status) | P0 | S5.1 |
| S5.5 | Implement `PUT /slots/:id` (update slot status / block slot) | P1 | S5.1 |
| S5.6 | Implement `DELETE /slots/:id` (cancel slot) | P1 | S5.1 |
| S5.7 | Redis caching for available slots (cache invalidation on booking/slot change) | P1 | S5.3 |
| S5.8 | Handle timezone-aware slot generation & display | P0 | S5.2 |
| S5.9 | Write slot module integration tests | P0 | S5.1–S5.3 |

**Deliverable:** Slots can be generated, queried publicly, and managed by owners.

---

### Sprint 6 — Booking Flow (Week 11–12)

| ID   | Task                                          | Priority | Depends On |
|------|-----------------------------------------------|----------|------------|
| S6.1 | Implement `POST /bookings` (customer creates booking → slot status changes to "booked") | P0 | Sprint 5 |
| S6.2 | Implement optimistic locking / concurrency control (prevent double-booking) | P0 | S6.1 |
| S6.3 | Implement `GET /bookings` (role-based: customer sees own, owner sees their business) | P0 | S6.1 |
| S6.4 | Implement `GET /bookings/:id` (booking details) | P0 | S6.1 |
| S6.5 | Implement `POST /bookings/:id/confirm` (owner confirms pending booking) | P0 | S6.1 |
| S6.6 | Implement `POST /bookings/:id/cancel` (customer or owner cancels) | P0 | S6.1 |
| S6.7 | Implement `POST /bookings/:id/complete` (owner marks as completed) | P1 | S6.1 |
| S6.8 | Booking status state machine (pending → confirmed → completed / cancelled / no_show) | P0 | S6.1 |
| S6.9 | Invalidate slot cache on booking state change | P1 | S6.1, S5.7 |
| S6.10 | Write booking flow integration tests (full lifecycle) | P0 | S6.1–S6.6 |

**Deliverable:** Complete booking lifecycle works. Double-bookings are prevented.

**[MILESTONE] Phase 3: "Core Product"**  
End-to-end flow: register → create business → add services → generate slots → customer books → owner confirms → completed. **This is the MVP.**

---

## Phase 4: Engagement & Insights

> **Goal:** Reviews, notifications, analytics — features that make the platform sticky.  
> **Duration:** 4 weeks (Sprint 7–8)  
> **Milestone:** Users get notified, can leave reviews, and owners see analytics.  
> **Depends On:** Phase 3 complete (bookings work)

### Sprint 7 — Reviews & Notifications (Week 13–14)

| ID   | Task                                          | Priority | Depends On |
|------|-----------------------------------------------|----------|------------|
| S7.1 | Implement `POST /bookings/:id/review` (customer leaves review after completed booking) | P0 | Phase 3 |
| S7.2 | Implement `GET /businesses/:id/reviews` (public reviews for a business) | P0 | S7.1 |
| S7.3 | Calculate and update business average rating | P1 | S7.1 |
| S7.4 | Implement in-app notifications (MongoDB-backed) | P0 | Phase 3 |
| S7.5 | Implement `GET /users/me/notifications` | P0 | S7.4 |
| S7.6 | Implement `PUT /users/me/notifications/:id/read` | P1 | S7.4 |
| S7.7 | Trigger notifications on booking events (created, confirmed, cancelled, completed) | P0 | S7.4, Phase 3 |
| S7.8 | Email notification service (stub / integration with SendGrid or Resend) | P2 | S7.4 |
| S7.9 | Write reviews & notifications tests | P0 | S7.1, S7.4 |

**Deliverable:** Users receive notifications on booking events. Customers can review businesses.

---

### Sprint 8 — Analytics & Admin (Week 15–16)

| ID   | Task                                          | Priority | Depends On |
|------|-----------------------------------------------|----------|------------|
| S8.1 | Implement `GET /businesses/:id/analytics` (bookings count, revenue, trends) | P0 | Phase 3 |
| S8.2 | Build analytics aggregation pipeline (MongoDB) | P0 | S8.1 |
| S8.3 | Track activity logs (MongoDB — login, booking, business events) | P1 | Phase 1 |
| S8.4 | Implement admin endpoints: `GET /users` (list all), `DELETE /users/:id` | P1 | Phase 1 |
| S8.5 | Implement admin dashboard data endpoint | P2 | S8.1 |
| S8.6 | Redis caching for analytics (5-min TTL) | P1 | S8.1 |
| S8.7 | Rate limiting per-user and per-endpoint tuning | P1 | — |
| S8.8 | Write analytics integration tests | P0 | S8.1 |

**Deliverable:** Business owners see meaningful analytics. Admin can manage the platform.

**[MILESTONE] Phase 4: "Complete Backend"**  
All backend APIs are functional, tested, and documented. Backend is production-ready.

---

## Phase 5: Frontend Application

> **Goal:** Customer-facing and business-owner-facing web application.  
> **Duration:** 6 weeks (Sprint 9–11)  
> **Milestone:** Fully functional web app connected to the backend.  
> **Depends On:** Phase 3 minimum (Phase 4 preferred)

### Sprint 9 — Frontend Foundation & Auth (Week 17–18)

| ID   | Task                                          | Priority | Depends On |
|------|-----------------------------------------------|----------|------------|
| S9.1 | Setup Next.js 15 project with App Router | P0 | — |
| S9.2 | Configure NextAuth.js v5 (credentials provider → backend API) | P0 | Phase 1 |
| S9.3 | Build Login & Register pages | P0 | S9.2 |
| S9.4 | Setup TanStack Query provider + Axios/Fetch wrapper | P0 | — |
| S9.5 | Build responsive layout shell (header, sidebar, footer) | P0 | — |
| S9.6 | Implement auth guards (protected routes, role-based redirects) | P0 | S9.2 |
| S9.7 | Setup Zustand stores (auth, UI state) | P1 | — |
| S9.8 | Configure Tailwind CSS + design tokens | P1 | — |

**Deliverable:** Users can register, login, and see role-appropriate layouts.

---

### Sprint 10 — Business Owner Portal (Week 19–20)

| ID   | Task                                          | Priority | Depends On |
|------|-----------------------------------------------|----------|------------|
| S10.1 | Business creation / onboarding wizard | P0 | Sprint 9, Phase 2 |
| S10.2 | Business profile edit page | P0 | S10.1 |
| S10.3 | Business hours & holidays management UI | P0 | S10.1 |
| S10.4 | Service catalog management (CRUD) | P0 | S10.1 |
| S10.5 | Slot generation UI (bulk create from schedule) | P0 | S10.1, Phase 3 |
| S10.6 | Booking management dashboard (list, confirm, cancel, complete) | P0 | Phase 3 |
| S10.7 | Analytics dashboard (charts, metrics) | P1 | Phase 4 |
| S10.8 | Owner notification center | P1 | Phase 4 |

**Deliverable:** Business owners can fully manage their business from the web app.

---

### Sprint 11 — Customer Portal (Week 21–22)

| ID   | Task                                          | Priority | Depends On |
|------|-----------------------------------------------|----------|------------|
| S11.1 | Business discovery / browse page (search, filter, categories) | P0 | Phase 2 |
| S11.2 | Business detail page (info, services, reviews) | P0 | S11.1 |
| S11.3 | Slot availability calendar view | P0 | Phase 3 |
| S11.4 | Booking flow UI (select service → pick slot → confirm) | P0 | S11.3 |
| S11.5 | My Bookings page (upcoming, past, cancelled) | P0 | Phase 3 |
| S11.6 | Review submission UI (post-completion) | P1 | Phase 4 |
| S11.7 | Customer notification center | P1 | Phase 4 |
| S11.8 | Responsive / mobile optimization | P0 | S11.1–S11.5 |

**Deliverable:** Customers can browse, book, and manage their bookings.

**[MILESTONE] Phase 5: "Launch-Ready App"**  
Full-stack application is functional. Ready for beta testing.

---

## Phase 6: AI Integration & Future

> **Goal:** AI-powered chat interface for natural language booking.  
> **Duration:** 4+ weeks (Sprint 12–13)  
> **Milestone:** Users can book via chat prompts.  
> **Depends On:** Phase 5 complete

### Sprint 12 — AI Chat Foundation (Week 23–24)

| ID   | Task                                          | Priority | Depends On |
|------|-----------------------------------------------|----------|------------|
| S12.1 | Research & select LLM provider (OpenAI / Anthropic / local) | P0 | — |
| S12.2 | Design chat-to-booking intent mapping | P0 | S12.1 |
| S12.3 | Build chat API endpoint (`POST /chat/message`) | P0 | S12.2 |
| S12.4 | Implement intent extraction (find business, check availability, make booking) | P0 | S12.3 |
| S12.5 | Connect chat intents to existing booking APIs internally | P0 | S12.4, Phase 3 |
| S12.6 | Chat context management (conversation history) | P1 | S12.3 |

### Sprint 13 — AI Chat Frontend & Polish (Week 25–26)

| ID   | Task                                          | Priority | Depends On |
|------|-----------------------------------------------|----------|------------|
| S13.1 | Build chat widget UI (floating / embedded) | P0 | Sprint 12 |
| S13.2 | Real-time chat UX (streaming responses) | P1 | S13.1 |
| S13.3 | Chat-to-booking confirmation flow (AI suggests → user confirms) | P0 | S13.1 |
| S13.4 | Fallback handling (unclear intent → suggest options) | P1 | S13.1 |
| S13.5 | Chat history persistence | P2 | S13.1 |
| S13.6 | End-to-end AI booking tests | P0 | S13.1–S13.3 |

**[MILESTONE] Phase 6: "AI-Powered Booking"**  
Users can type "Book me a haircut at Salon X tomorrow at 3pm" and the system handles it.

---

## Sprint Calendar Overview

```
Week  1-2   │ Sprint 1  │ Phase 1 │ Bootstrap & Infrastructure
Week  3-4   │ Sprint 2  │ Phase 1 │ Authentication Module
Week  5-6   │ Sprint 3  │ Phase 2 │ User & Business Management
Week  7-8   │ Sprint 4  │ Phase 2 │ Service Management
Week  9-10  │ Sprint 5  │ Phase 3 │ Slot Management
Week 11-12  │ Sprint 6  │ Phase 3 │ Booking Flow
Week 13-14  │ Sprint 7  │ Phase 4 │ Reviews & Notifications
Week 15-16  │ Sprint 8  │ Phase 4 │ Analytics & Admin
Week 17-18  │ Sprint 9  │ Phase 5 │ Frontend Foundation & Auth
Week 19-20  │ Sprint 10 │ Phase 5 │ Business Owner Portal
Week 21-22  │ Sprint 11 │ Phase 5 │ Customer Portal
Week 23-24  │ Sprint 12 │ Phase 6 │ AI Chat Foundation
Week 25-26  │ Sprint 13 │ Phase 6 │ AI Chat Frontend & Polish
```

---

## Dependency Graph

```
S1 (Infrastructure)
 └──▶ S2 (Auth) ─────────────────────────────────────────────────▶ S9 (FE Auth)
       └──▶ S3 (User & Business)                                    └──▶ S10 (Owner Portal)
             └──▶ S4 (Services)                                           └──▶ S11 (Customer Portal)
                   └──▶ S5 (Slots)
                         └──▶ S6 (Bookings) ──────────────────────▶ S12 (AI Chat)
                               ├──▶ S7 (Reviews & Notifications)        └──▶ S13 (AI FE)
                               └──▶ S8 (Analytics & Admin)
```

---

## Priority Legend

| Priority | Meaning                                 |
|----------|-----------------------------------------|
| **P0**   | Must-have for sprint completion         |
| **P1**   | Should-have — important but not blocking|
| **P2**   | Nice-to-have — can defer to next sprint |

---

## Definition of Done (per Sprint)

- [ ] All P0 tasks completed and code reviewed
- [ ] Integration tests pass for the module
- [ ] No TypeScript errors (`tsc --noEmit` clean)
- [ ] API endpoints match the API contract doc
- [ ] Error handling follows the global pattern
- [ ] Environment variables documented in `.env.example`

---

## Current Status

| Phase   | Status         | Notes                                |
|---------|----------------|--------------------------------------|
| Phase 1 | COMPLETE    | Auth, JWT, refresh tokens, password reset |
| Phase 2 | COMPLETE    | Business CRUD, services, hours, holidays |
| Phase 3 | COMPLETE    | Booking lifecycle, slots, double-booking prevention |
| Phase 4 | COMPLETE    | Reviews, notifications, analytics, admin endpoints |
| Phase 5 | IN PROGRESS | Frontend app — dashboard, explore, auth pages done |
| Phase 6 | NOT STARTED | AI features — blocked on Phase 5 completion |

---

## What We Have So Far (Pre-Sprint 1)

The following scaffolding is already in place:

- [x] Project structure with barrel exports
- [x] Docker Compose (Postgres, MongoDB, Redis + admin UIs)
- [x] DB init scripts (schema.sql, mongodb init)
- [x] Config files (postgres.ts, mongodb.ts, redis.ts)
- [x] Middleware stubs (auth, errorHandler, rateLimiter)
- [x] Versioned route structure (`routes/v1/`)
- [x] Type definitions (per-domain)
- [x] Mongoose models (activityLog, notification, analytics)
- [x] Design docs (Architecture, Database Design, API Contract, Authentication)

**Next step → Sprint 1: Make it actually boot and connect.**
