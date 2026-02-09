# Database Design - Booking.go

**Version:** 1.0  
**Date:** February 9, 2026

---

## Overview

This document provides detailed database schema design for the Booking.go platform, covering PostgreSQL (primary transactional data), MongoDB (analytics and logs), and Redis (caching strategy).

---

## 1. PostgreSQL Schema Design

### 1.1 Design Principles

- **Normalization:** 3NF for data integrity
- **ACID Compliance:** Critical for booking transactions
- **Indexing Strategy:** Optimize for common queries
- **Constraints:** Enforce business rules at DB level
- **UUID Primary Keys:** Better for distributed systems and security

### 1.2 Core Tables

#### **users**
Stores all user accounts (customers, business owners, admins)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'business_owner', 'admin')),
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    profile_image VARCHAR(500),
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);
```

**Key Decisions:**
- Store password hash, never plain text
- Support for email/phone verification
- Timezone for personalized scheduling
- Soft delete via `is_active`

---

#### **businesses**
Business profiles created by business owners

```sql
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL, -- For SEO-friendly URLs
    description TEXT,
    category VARCHAR(100) NOT NULL,
    
    -- Location
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Contact
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    
    -- Branding
    logo_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    primary_color VARCHAR(7), -- Hex color code
    
    -- Settings (JSONB for flexible schema)
    settings JSONB DEFAULT '{
        "timezone": "UTC",
        "currency": "USD",
        "bookingAdvanceTime": 30,
        "cancellationDeadline": 24,
        "slotDuration": 60,
        "autoConfirm": false,
        "requireDeposit": false,
        "depositAmount": 0,
        "bufferTime": 0
    }'::jsonb,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_businesses_owner ON businesses(owner_id);
CREATE INDEX idx_businesses_slug ON businesses(slug);
CREATE INDEX idx_businesses_category ON businesses(category);
CREATE INDEX idx_businesses_location ON businesses(city, state, country);
CREATE INDEX idx_businesses_is_active ON businesses(is_active);
```

**Key Decisions:**
- Unique slug for public URLs (e.g., `/book/johns-salon`)
- Geolocation for future location-based search
- JSONB for flexible settings without schema changes
- Verification flag for quality control

---

#### **services**
Services offered by businesses

```sql
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL, -- minutes
    price DECIMAL(10, 2) NOT NULL,
    deposit_amount DECIMAL(10, 2) DEFAULT 0,
    
    -- Configuration
    max_capacity INTEGER DEFAULT 1, -- How many people can book this service simultaneously
    buffer_time INTEGER DEFAULT 0, -- Minutes of buffer after service
    
    -- Display
    image_url VARCHAR(500),
    display_order INTEGER DEFAULT 0,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_services_business ON services(business_id);
CREATE INDEX idx_services_is_active ON services(is_active);
CREATE INDEX idx_services_display_order ON services(business_id, display_order);
```

**Key Decisions:**
- Duration-based pricing
- Support for group services (max_capacity > 1)
- Buffer time between appointments
- Display order for custom sorting

---

#### **slots**
Available time slots created by business owners

```sql
CREATE TABLE slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    
    capacity INTEGER NOT NULL DEFAULT 1,
    booked_count INTEGER NOT NULL DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    
    price DECIMAL(10, 2) NOT NULL,
    
    -- For recurring slots
    recurrence_pattern VARCHAR(50), -- 'daily', 'weekly', 'monthly', null
    recurrence_end_date DATE,
    parent_slot_id UUID REFERENCES slots(id) ON DELETE CASCADE,
    
    -- Metadata
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_capacity CHECK (booked_count <= capacity),
    CONSTRAINT check_times CHECK (end_time > start_time)
);

CREATE INDEX idx_slots_business ON slots(business_id);
CREATE INDEX idx_slots_service ON slots(service_id);
CREATE INDEX idx_slots_start_time ON slots(start_time);
CREATE INDEX idx_slots_available ON slots(is_available, start_time);
CREATE INDEX idx_slots_business_time ON slots(business_id, start_time);
```

**Key Decisions:**
- Support for single and group bookings (capacity)
- Recurring slots with parent-child relationship
- Price can override service default price
- Composite indexes for availability queries

---

#### **bookings**
Customer booking records

```sql
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- References
    slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE RESTRICT,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    
    -- Booking Details
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
    booking_date DATE NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    
    number_of_people INTEGER DEFAULT 1,
    total_price DECIMAL(10, 2) NOT NULL,
    deposit_paid DECIMAL(10, 2) DEFAULT 0,
    
    -- Customer Info (denormalized for records)
    customer_name VARCHAR(200) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    notes TEXT,
    
    -- Status Tracking
    cancellation_reason TEXT,
    cancelled_by VARCHAR(20), -- 'customer', 'business', 'system'
    cancelled_at TIMESTAMP,
    confirmed_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Reminders
    reminder_sent BOOLEAN DEFAULT false,
    reminder_sent_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_business ON bookings(business_id);
CREATE INDEX idx_bookings_slot ON bookings(slot_id);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_start_time ON bookings(start_time);
CREATE INDEX idx_bookings_business_date ON bookings(business_id, booking_date);
```

**Key Decisions:**
- Denormalize customer info for historical records
- Track who cancelled (customer, business, or system)
- Reminder system integration
- Prevent slot deletion if bookings exist (RESTRICT)

---

#### **reviews**
Customer reviews for completed bookings

```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    
    -- Moderation
    is_published BOOLEAN DEFAULT true,
    is_flagged BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reviews_business ON reviews(business_id);
CREATE INDEX idx_reviews_customer ON reviews(customer_id);
CREATE INDEX idx_reviews_rating ON reviews(business_id, rating);
CREATE INDEX idx_reviews_published ON reviews(is_published, business_id);
```

**Key Decisions:**
- One review per booking
- Moderation support (flagging, unpublishing)
- Separate table for better querying

---

#### **business_hours**
Operating hours for businesses

```sql
CREATE TABLE business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    is_closed BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(business_id, day_of_week)
);

CREATE INDEX idx_business_hours_business ON business_hours(business_id);
```

---

#### **business_holidays**
Closed dates for businesses

```sql
CREATE TABLE business_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    holiday_date DATE NOT NULL,
    reason VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(business_id, holiday_date)
);

CREATE INDEX idx_business_holidays_business ON business_holidays(business_id);
CREATE INDEX idx_business_holidays_date ON business_holidays(holiday_date);
```

---

### 1.3 Relationship Summary

```
users (1) ──┬──── (M) businesses ──┬──── (M) services
            │                       ├──── (M) slots
            │                       ├──── (M) business_hours
            │                       └──── (M) business_holidays
            │
            └──── (M) bookings ──── (1) reviews

slots (1) ──── (M) bookings
services (1) ──── (M) bookings
```

---

## 2. MongoDB Schema Design

### 2.1 Collections

#### **activity_logs**
Track all user and system activities

```javascript
{
  _id: ObjectId,
  userId: String,        // UUID from PostgreSQL
  userRole: String,      // 'customer', 'business_owner', 'admin'
  action: String,        // 'booking_created', 'slot_updated', etc.
  resourceType: String,  // 'booking', 'slot', 'business', etc.
  resourceId: String,    // UUID of resource
  ipAddress: String,
  userAgent: String,
  metadata: {            // Flexible data
    oldValue: Object,
    newValue: Object,
    // ... any relevant data
  },
  timestamp: ISODate,
  createdAt: ISODate
}

// Indexes
db.activity_logs.createIndex({ userId: 1, timestamp: -1 })
db.activity_logs.createIndex({ action: 1, timestamp: -1 })
db.activity_logs.createIndex({ resourceType: 1, resourceId: 1 })
db.activity_logs.createIndex({ timestamp: -1 })
```

---

#### **business_analytics**
Daily/hourly metrics for businesses

```javascript
{
  _id: ObjectId,
  businessId: String,    // UUID from PostgreSQL
  date: ISODate,         // Aggregation date
  period: String,        // 'daily', 'weekly', 'monthly'
  
  metrics: {
    totalBookings: Number,
    confirmedBookings: Number,
    cancelledBookings: Number,
    completedBookings: Number,
    noShowBookings: Number,
    
    totalRevenue: Number,
    averageBookingValue: Number,
    
    newCustomers: Number,
    returningCustomers: Number,
    
    averageRating: Number,
    totalReviews: Number,
    
    // Time-based metrics
    peakHours: [Number],  // Hours with most bookings
    occupancyRate: Number // Percentage of slots booked
  },
  
  topServices: [
    {
      serviceId: String,
      serviceName: String,
      bookingCount: Number,
      revenue: Number
    }
  ],
  
  createdAt: ISODate,
  updatedAt: ISODate
}

// Indexes
db.business_analytics.createIndex({ businessId: 1, date: -1 })
db.business_analytics.createIndex({ businessId: 1, period: 1, date: -1 })
```

---

#### **notifications**
User notifications

```javascript
{
  _id: ObjectId,
  userId: String,        // UUID from PostgreSQL
  type: String,          // 'booking_confirmed', 'booking_cancelled', etc.
  title: String,
  message: String,
  
  data: {                // Additional data for notification
    bookingId: String,
    businessId: String,
    // ... contextual data
  },
  
  channels: {            // Multi-channel notifications
    email: {
      sent: Boolean,
      sentAt: ISODate,
      error: String
    },
    sms: {
      sent: Boolean,
      sentAt: ISODate,
      error: String
    },
    push: {
      sent: Boolean,
      sentAt: ISODate,
      error: String
    }
  },
  
  isRead: Boolean,
  readAt: ISODate,
  
  createdAt: ISODate,
  expiresAt: ISODate     // TTL for auto-deletion
}

// Indexes
db.notifications.createIndex({ userId: 1, createdAt: -1 })
db.notifications.createIndex({ userId: 1, isRead: 1 })
db.notifications.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // TTL
```

---

## 3. Redis Caching Strategy

### 3.1 Cache Keys Design

```
Pattern: {resource}:{id}:{optional_detail}

Examples:
- business:550e8400-e29b-41d4-a716-446655440000
- business:550e8400-e29b-41d4-a716-446655440000:services
- available_slots:550e8400-e29b-41d4-a716-446655440000:2026-02-15
- user:session:abc123...
- rate_limit:ip:192.168.1.1
```

### 3.2 Cached Data

#### **Session Storage**
```
Key: session:{token}
TTL: 15 minutes (access token)
Value: {
  userId: string,
  email: string,
  role: string
}
```

#### **Business Profiles**
```
Key: business:{businessId}
TTL: 1 hour
Value: Full business JSON
```

#### **Available Slots**
```
Key: available_slots:{businessId}:{date}
TTL: 5 minutes
Value: Array of available slot objects
```

#### **Rate Limiting**
```
Key: rate_limit:{ip}
TTL: 15 minutes
Value: Request count
```

### 3.3 Cache Invalidation Rules

| Event | Invalidate |
|-------|------------|
| Business updated | `business:{id}` |
| Slot created/updated | `available_slots:{businessId}:{date}` |
| Booking created | `available_slots:{businessId}:{date}` |
| Booking cancelled | `available_slots:{businessId}:{date}` |
| Service updated | `business:{id}:services` |

---

## 4. Data Migration Strategy

### 4.1 Initial Setup

1. Run PostgreSQL schema creation
2. Create MongoDB collections and indexes
3. Set up Redis connection
4. Seed initial data (categories, admin user)

### 4.2 Future Migrations

- Use migration tool (e.g., `node-pg-migrate`)
- Version control all migration scripts
- Test migrations on staging before production
- Keep rollback scripts ready

---

## 5. Backup & Recovery

### 5.1 PostgreSQL
- Daily automated backups
- Point-in-time recovery enabled
- 30-day retention policy

### 5.2 MongoDB
- Daily snapshots
- Replica set for high availability
- 30-day retention policy

### 5.3 Redis
- Snapshot every 6 hours
- Append-only file (AOF) enabled
- Data can be rebuilt from PostgreSQL if needed

---

## 6. Performance Considerations

### 6.1 Query Optimization

**Most Frequent Queries:**
1. Get available slots for business on date
2. Get bookings for customer
3. Get bookings for business on date range
4. Get business profile with services

**Optimization:**
- Composite indexes on frequently filtered columns
- Materialized views for complex analytics
- Query result caching in Redis
- Connection pooling (max 20 connections)

### 6.2 Scaling Considerations

**When to scale:**
- Database connections > 80%
- Query response time > 500ms
- Storage > 80% capacity

**Scaling path:**
- Read replicas for PostgreSQL
- MongoDB sharding by businessId
- Redis cluster for distributed caching

---

## 7. Open Questions

1. **Payment Data:** Where to store payment transactions? (Separate table or external provider?)
2. **File Storage:** Where to store logos/images? (S3, Cloudinary, local?)
3. **Multi-tenancy:** Should each business have isolated data or shared tables?
4. **Audit Trail:** Should we keep full history of all changes?
5. **Data Retention:** How long to keep cancelled bookings? Completed bookings?

---

## Next Steps

1. Review and approve schema design
2. Answer open questions
3. Create SQL migration scripts
4. Set up development databases
5. Create seed data for testing
