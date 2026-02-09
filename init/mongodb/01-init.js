// MongoDB Init Script
// Runs on first container start only

db = db.getSiblingDB('booking_go');

// ─── Activity Logs ──────────────────────────────
db.createCollection('activity_logs');
db.activity_logs.createIndex({ userId: 1, timestamp: -1 });
db.activity_logs.createIndex({ action: 1, timestamp: -1 });
db.activity_logs.createIndex({ resourceType: 1, resourceId: 1 });
db.activity_logs.createIndex({ timestamp: -1 });

// ─── Business Analytics ─────────────────────────
db.createCollection('business_analytics');
db.business_analytics.createIndex({ businessId: 1, date: -1 });
db.business_analytics.createIndex({ businessId: 1, period: 1, date: -1 });

// ─── Notifications ──────────────────────────────
db.createCollection('notifications');
db.notifications.createIndex({ userId: 1, createdAt: -1 });
db.notifications.createIndex({ userId: 1, isRead: 1 });
db.notifications.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

print('MongoDB initialized: booking_go database with collections and indexes');
