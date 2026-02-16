-- =========================================
-- Booking.go - AI Columns Migration
-- Adds vector embeddings & sentiment analysis
-- =========================================

-- Ensure vector extension is available
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Vector Embeddings ─────────────────────────────────
-- 768 dimensions = nomic-embed-text model output size

-- Business description embeddings (for semantic search)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS description_embedding vector(768);

-- Service description embeddings (for semantic search)
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS description_embedding vector(768);

-- ─── Sentiment Analysis ────────────────────────────────
-- Stored on reviews after async AI analysis

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20)
    CHECK (sentiment IN ('positive', 'neutral', 'negative'));

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2)
    CHECK (sentiment_score >= 0 AND sentiment_score <= 1);

-- ─── Vector Indexes (HNSW for fast approximate search) ──
-- cosine distance operator class for normalized embeddings

CREATE INDEX IF NOT EXISTS idx_businesses_embedding
  ON businesses USING hnsw (description_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_services_embedding
  ON services USING hnsw (description_embedding vector_cosine_ops);

-- ─── Sentiment query index ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reviews_sentiment
  ON reviews (business_id, sentiment)
  WHERE sentiment IS NOT NULL;
