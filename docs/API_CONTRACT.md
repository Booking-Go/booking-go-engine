# API Contract Design - Booking.go Backend

**Version:** 1.0  
**Date:** February 9, 2026  
**Base URL:** `https://api.booking-go.com/api/v1`

---

## Table of Contents

1. [Authentication Flow](#1-authentication-flow)
2. [API Conventions](#2-api-conventions)
3. [Authentication Endpoints](#3-authentication-endpoints)
4. [User Endpoints](#4-user-endpoints)
5. [Business Endpoints](#5-business-endpoints)
6. [Service Endpoints](#6-service-endpoints)
7. [Slot Endpoints](#7-slot-endpoints)
8. [Booking Endpoints](#8-booking-endpoints)
9. [Review Endpoints](#9-review-endpoints)
10. [Analytics Endpoints](#10-analytics-endpoints)
11. [Error Handling](#11-error-handling)

---

## 1. Authentication Flow

### JWT Token Structure

```javascript
// Access Token (15 minutes expiry)
{
  "userId": "uuid",
  "email": "user@example.com",
  "role": "customer|business_owner|admin",
  "iat": 1707494400,
  "exp": 1707495300
}

// Refresh Token (30 days expiry)
{
  "userId": "uuid",
  "type": "refresh",
  "iat": 1707494400,
  "exp": 1710086400
}
```

### Authentication Header

```
Authorization: Bearer {access_token}
```

---

## 2. API Conventions

### Request Format

- **Content-Type:** `application/json`
- **Date Format:** ISO 8601 (`2026-02-09T10:30:00Z`)
- **Currency:** USD (decimal with 2 places)
- **Pagination:** Query params `?page=1&limit=20`

### Response Format

#### Success Response
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Optional success message",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful delete) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 429 | Too Many Requests (rate limit) |
| 500 | Internal Server Error |

---

## 3. Authentication Endpoints

### 3.1 Register User

**POST** `/auth/register`

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "role": "customer"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "customer",
      "createdAt": "2026-02-09T10:30:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc...",
      "expiresIn": 900
    }
  }
}
```

---

### 3.2 Login

**POST** `/auth/login`

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "customer"
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc...",
      "expiresIn": 900
    }
  }
}
```

---

### 3.3 Refresh Token

**POST** `/auth/refresh`

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

---

### 3.4 Logout

**POST** `/auth/logout`  
**Auth Required:** Yes

**Response:** `204 No Content`

---

## 4. User Endpoints

### 4.1 Get Current User

**GET** `/users/me`  
**Auth Required:** Yes

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "role": "customer",
    "emailVerified": true,
    "phoneVerified": false,
    "profileImage": "https://cdn.example.com/users/john.jpg",
    "timezone": "America/New_York",
    "language": "en",
    "createdAt": "2026-01-15T10:30:00Z",
    "updatedAt": "2026-02-09T10:30:00Z"
  }
}
```

---

### 4.2 Update Current User

**PUT** `/users/me`  
**Auth Required:** Yes

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+1234567890",
  "timezone": "America/New_York",
  "language": "en"
}
```

**Response:** `200 OK` (same as Get Current User)

---

### 4.3 Get User Notifications

**GET** `/users/me/notifications?page=1&limit=20&unreadOnly=true`  
**Auth Required:** Yes

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "type": "booking_confirmed",
      "title": "Booking Confirmed",
      "message": "Your booking at Hair Studio on Feb 10 at 2:00 PM is confirmed",
      "data": {
        "bookingId": "uuid",
        "businessId": "uuid"
      },
      "isRead": false,
      "createdAt": "2026-02-09T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

## 5. Business Endpoints

### 5.1 List Businesses (Public)

**GET** `/businesses?category=salon&city=NewYork&page=1&limit=20&search=hair`

**Query Parameters:**
- `category` (optional): Filter by business category
- `city` (optional): Filter by city
- `state` (optional): Filter by state
- `search` (optional): Search in name/description
- `page` (default: 1)
- `limit` (default: 20, max: 100)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Hair Studio",
      "slug": "hair-studio-nyc",
      "description": "Premium hair salon in downtown",
      "category": "salon",
      "address": {
        "line1": "123 Main St",
        "city": "New York",
        "state": "NY",
        "zipCode": "10001",
        "country": "USA"
      },
      "phone": "+1234567890",
      "email": "info@hairstudio.com",
      "website": "https://hairstudio.com",
      "logoUrl": "https://cdn.example.com/logos/hair-studio.jpg",
      "coverImageUrl": "https://cdn.example.com/covers/hair-studio.jpg",
      "rating": 4.8,
      "reviewCount": 127,
      "isVerified": true,
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

### 5.2 Get Business by ID/Slug

**GET** `/businesses/:idOrSlug`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "ownerId": "uuid",
    "name": "Hair Studio",
    "slug": "hair-studio-nyc",
    "description": "Premium hair salon...",
    "category": "salon",
    "address": {
      "line1": "123 Main St",
      "line2": "Suite 100",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA",
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "contact": {
      "phone": "+1234567890",
      "email": "info@hairstudio.com",
      "website": "https://hairstudio.com"
    },
    "branding": {
      "logoUrl": "https://cdn.example.com/logos/hair-studio.jpg",
      "coverImageUrl": "https://cdn.example.com/covers/hair-studio.jpg",
      "primaryColor": "#FF5733"
    },
    "settings": {
      "timezone": "America/New_York",
      "currency": "USD",
      "bookingAdvanceTime": 30,
      "cancellationDeadline": 24,
      "slotDuration": 60,
      "autoConfirm": false,
      "requireDeposit": false
    },
    "rating": 4.8,
    "reviewCount": 127,
    "isActive": true,
    "isVerified": true,
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-02-09T10:30:00Z"
  }
}
```

---

### 5.3 Create Business

**POST** `/businesses`  
**Auth Required:** Yes (business_owner or admin)

**Request:**
```json
{
  "name": "Hair Studio",
  "slug": "hair-studio-nyc",
  "description": "Premium hair salon in downtown",
  "category": "salon",
  "address": {
    "line1": "123 Main St",
    "line2": "Suite 100",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  },
  "phone": "+1234567890",
  "email": "info@hairstudio.com",
  "website": "https://hairstudio.com",
  "settings": {
    "timezone": "America/New_York",
    "currency": "USD",
    "bookingAdvanceTime": 30,
    "autoConfirm": false
  }
}
```

**Response:** `201 Created` (same structure as Get Business)

---

### 5.4 Update Business

**PUT** `/businesses/:id`  
**Auth Required:** Yes (business owner or admin)

**Request:** Same as Create Business  
**Response:** `200 OK` (same structure as Get Business)

---

### 5.5 Delete Business

**DELETE** `/businesses/:id`  
**Auth Required:** Yes (business owner or admin)

**Response:** `204 No Content`

---

### 5.6 Get Business Services

**GET** `/businesses/:id/services`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "businessId": "uuid",
      "name": "Men's Haircut",
      "description": "Classic men's haircut and styling",
      "duration": 30,
      "price": 35.00,
      "depositAmount": 0,
      "maxCapacity": 1,
      "bufferTime": 10,
      "imageUrl": "https://cdn.example.com/services/haircut.jpg",
      "displayOrder": 1,
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### 5.7 Get Business Hours

**GET** `/businesses/:id/hours`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "dayOfWeek": 1,
      "dayName": "Monday",
      "openTime": "09:00",
      "closeTime": "18:00",
      "isClosed": false
    },
    {
      "dayOfWeek": 0,
      "dayName": "Sunday",
      "isClosed": true
    }
  ]
}
```

---

## 6. Service Endpoints

### 6.1 Create Service

**POST** `/services`  
**Auth Required:** Yes (business owner)

**Request:**
```json
{
  "businessId": "uuid",
  "name": "Men's Haircut",
  "description": "Classic men's haircut and styling",
  "duration": 30,
  "price": 35.00,
  "depositAmount": 0,
  "maxCapacity": 1,
  "bufferTime": 10
}
```

**Response:** `201 Created`

---

### 6.2 Update Service

**PUT** `/services/:id`  
**Auth Required:** Yes (business owner)

**Request:** Same as Create Service  
**Response:** `200 OK`

---

### 6.3 Delete Service

**DELETE** `/services/:id`  
**Auth Required:** Yes (business owner)

**Response:** `204 No Content`

---

## 7. Slot Endpoints

### 7.1 Get Available Slots (Public)

**GET** `/slots/available?businessId=uuid&serviceId=uuid&date=2026-02-10`

**Query Parameters:**
- `businessId` (required)
- `serviceId` (optional)
- `date` (required): YYYY-MM-DD
- `endDate` (optional): For date range

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "businessId": "uuid",
      "serviceId": "uuid",
      "startTime": "2026-02-10T09:00:00Z",
      "endTime": "2026-02-10T09:30:00Z",
      "capacity": 1,
      "bookedCount": 0,
      "isAvailable": true,
      "price": 35.00,
      "service": {
        "id": "uuid",
        "name": "Men's Haircut",
        "duration": 30
      }
    }
  ]
}
```

---

### 7.2 Create Slot

**POST** `/slots`  
**Auth Required:** Yes (business owner)

**Request:**
```json
{
  "businessId": "uuid",
  "serviceId": "uuid",
  "startTime": "2026-02-10T09:00:00Z",
  "endTime": "2026-02-10T09:30:00Z",
  "capacity": 1,
  "price": 35.00
}
```

**Response:** `201 Created`

---

### 7.3 Create Bulk Slots

**POST** `/slots/bulk`  
**Auth Required:** Yes (business owner)

**Request:**
```json
{
  "businessId": "uuid",
  "serviceId": "uuid",
  "startDate": "2026-02-10",
  "endDate": "2026-02-17",
  "timeSlots": [
    {
      "startTime": "09:00",
      "endTime": "09:30"
    },
    {
      "startTime": "09:30",
      "endTime": "10:00"
    }
  ],
  "daysOfWeek": [1, 2, 3, 4, 5],
  "capacity": 1,
  "price": 35.00
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "created": 50,
    "message": "Successfully created 50 slots"
  }
}
```

---

### 7.4 Update Slot

**PUT** `/slots/:id`  
**Auth Required:** Yes (business owner)

**Request:**
```json
{
  "startTime": "2026-02-10T09:00:00Z",
  "endTime": "2026-02-10T09:30:00Z",
  "capacity": 2,
  "price": 40.00,
  "isAvailable": true
}
```

**Response:** `200 OK`

---

### 7.5 Delete Slot

**DELETE** `/slots/:id`  
**Auth Required:** Yes (business owner)

**Response:** `204 No Content`

---

## 8. Booking Endpoints

### 8.1 Create Booking

**POST** `/bookings`  
**Auth Required:** Yes

**Request:**
```json
{
  "slotId": "uuid",
  "numberOfPeople": 1,
  "notes": "Please use organic products"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "slotId": "uuid",
    "businessId": "uuid",
    "customerId": "uuid",
    "serviceId": "uuid",
    "status": "pending",
    "bookingDate": "2026-02-10",
    "startTime": "2026-02-10T14:00:00Z",
    "endTime": "2026-02-10T14:30:00Z",
    "numberOfPeople": 1,
    "totalPrice": 35.00,
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "customerPhone": "+1234567890",
    "notes": "Please use organic products",
    "business": {
      "id": "uuid",
      "name": "Hair Studio",
      "address": "123 Main St, New York, NY"
    },
    "service": {
      "id": "uuid",
      "name": "Men's Haircut"
    },
    "createdAt": "2026-02-09T10:30:00Z"
  }
}
```

---

### 8.2 Get User Bookings

**GET** `/bookings?status=confirmed&page=1&limit=20`  
**Auth Required:** Yes

**Query Parameters:**
- `status` (optional): Filter by status
- `startDate` (optional): From date
- `endDate` (optional): To date
- `page`, `limit`: Pagination

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "status": "confirmed",
      "bookingDate": "2026-02-10",
      "startTime": "2026-02-10T14:00:00Z",
      "endTime": "2026-02-10T14:30:00Z",
      "totalPrice": 35.00,
      "business": {
        "id": "uuid",
        "name": "Hair Studio",
        "logoUrl": "https://cdn.example.com/logos/hair-studio.jpg"
      },
      "service": {
        "id": "uuid",
        "name": "Men's Haircut"
      },
      "confirmedAt": "2026-02-09T11:00:00Z",
      "createdAt": "2026-02-09T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

---

### 8.3 Get Booking by ID

**GET** `/bookings/:id`  
**Auth Required:** Yes

**Response:** `200 OK` (detailed booking object)

---

### 8.4 Cancel Booking

**POST** `/bookings/:id/cancel`  
**Auth Required:** Yes

**Request:**
```json
{
  "reason": "Schedule conflict"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "cancelled",
    "cancellationReason": "Schedule conflict",
    "cancelledBy": "customer",
    "cancelledAt": "2026-02-09T10:30:00Z"
  }
}
```

---

### 8.5 Confirm Booking (Business Owner)

**POST** `/bookings/:id/confirm`  
**Auth Required:** Yes (business owner)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "confirmed",
    "confirmedAt": "2026-02-09T10:30:00Z"
  }
}
```

---

### 8.6 Complete Booking (Business Owner)

**POST** `/bookings/:id/complete`  
**Auth Required:** Yes (business owner)

**Response:** `200 OK`

---

## 9. Review Endpoints

### 9.1 Create Review

**POST** `/bookings/:bookingId/review`  
**Auth Required:** Yes (customer who made the booking)

**Request:**
```json
{
  "rating": 5,
  "comment": "Excellent service! Highly recommend."
}
```

**Response:** `201 Created`

---

### 9.2 Get Business Reviews

**GET** `/businesses/:id/reviews?page=1&limit=20`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "rating": 5,
      "comment": "Excellent service!",
      "customer": {
        "firstName": "John",
        "lastName": "D.",
        "profileImage": "https://cdn.example.com/users/john.jpg"
      },
      "createdAt": "2026-02-08T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 127,
    "totalPages": 7,
    "averageRating": 4.8
  }
}
```

---

## 10. Analytics Endpoints

### 10.1 Get Business Analytics

**GET** `/businesses/:id/analytics?startDate=2026-02-01&endDate=2026-02-28&period=daily`  
**Auth Required:** Yes (business owner)

**Query Parameters:**
- `startDate`, `endDate`: Date range
- `period`: `daily`, `weekly`, `monthly`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalBookings": 245,
      "confirmedBookings": 220,
      "cancelledBookings": 15,
      "completedBookings": 210,
      "totalRevenue": 8575.00,
      "averageBookingValue": 35.00,
      "averageRating": 4.8,
      "newCustomers": 45,
      "returningCustomers": 175
    },
    "timeline": [
      {
        "date": "2026-02-01",
        "bookings": 12,
        "revenue": 420.00
      }
    ],
    "topServices": [
      {
        "serviceId": "uuid",
        "serviceName": "Men's Haircut",
        "bookingCount": 150,
        "revenue": 5250.00
      }
    ]
  }
}
```

---

## 11. Error Handling

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed |
| `AUTHENTICATION_ERROR` | Invalid or missing authentication |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `DUPLICATE_ERROR` | Resource already exists |
| `SLOT_UNAVAILABLE` | Slot is fully booked |
| `BOOKING_CONFLICT` | Time slot conflict |
| `CANCELLATION_DEADLINE_PASSED` | Too late to cancel |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Server error |

### Example Error Responses

**Validation Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters"
      }
    ]
  }
}
```

**Authentication Error:**
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid or expired token"
  }
}
```

**Slot Unavailable:**
```json
{
  "success": false,
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "This time slot is no longer available"
  }
}
```

---

## Next Steps

1. Review and approve API contracts
2. Set up API documentation (Swagger/OpenAPI)
3. Create request/response validation schemas (Zod)
4. Implement API versioning strategy
5. Set up API testing suite (Jest + Supertest)
