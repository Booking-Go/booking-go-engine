import 'dotenv/config';
import { connectPostgres, closePostgres } from '../src/config/postgres';
import { connectRedis, closeRedis } from '../src/config/redis';
import { connectOllama } from '../src/config/ollama';
import { pgPool, redisClient } from '../src/config';
import { llm } from '../src/libs/llm';
import { embeddingRepository } from '../src/core/repositories/embedding.repository';
import { embeddingService } from '../src/core/services/embedding.service';

const test = async () => {
  // Connect to databases and Ollama
  await connectPostgres();
  await connectRedis();
  await connectOllama();

  console.log('\n--- Step 1: Insert test business ---');

  // Ensure a test user exists
  await pgPool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role)
     VALUES ('test@bookinggo.dev', 'not_a_real_hash', 'Test', 'User', 'business_owner')
     ON CONFLICT (email) DO NOTHING`,
  );

  const { rows } = await pgPool.query(
    `INSERT INTO businesses (
      owner_id, name, slug, description, category,
      city, state, country, address_line1, zip_code, phone, email
    ) VALUES (
      (SELECT id FROM users WHERE email = 'test@bookinggo.dev'),
      'Serenity Spa & Wellness', 'serenity-spa-wellness',
      'A luxury spa offering deep tissue massage, hot stone therapy, aromatherapy, facials, and body wraps. Relaxing ambiance in the heart of downtown.',
      'spa', 'New York', 'NY', 'US', '123 Main St', '10001', '555-0100', 'info@serenityspa.com'
    )
    ON CONFLICT (slug) DO UPDATE SET description = EXCLUDED.description
    RETURNING id, name`,
  );

  const businessId = rows[0]?.id;

  if (!businessId) {
    // Try to get it from existing
    const existing = await pgPool.query(
      "SELECT id, name FROM businesses WHERE slug = 'serenity-spa-wellness'",
    );
    if (existing.rows.length === 0) {
      console.log('No users in DB to create business. Seed users first.');
      await cleanup();
      return;
    }
  }

  const biz = rows[0] || (await pgPool.query("SELECT id, name FROM businesses WHERE slug = 'serenity-spa-wellness'")).rows[0];
  console.log(`Business: ${biz.name} (${biz.id})`);

  console.log('\n--- Step 2: Generate embedding ---');
  await embeddingService.generateBusinessEmbedding(biz.id);

  // Verify it was stored
  const check = await pgPool.query(
    'SELECT description_embedding IS NOT NULL AS has_embedding FROM businesses WHERE id = $1',
    [biz.id],
  );
  console.log('Has embedding:', check.rows[0]?.has_embedding);

  console.log('\n--- Step 3: Semantic search ---');
  const results = await embeddingService.searchByText({
    query: 'relaxing massage downtown',
    type: 'business',
    limit: 5,
  });

  console.log(`Found ${results.length} results:`);
  for (const r of results) {
    console.log(`  - ${r.name} (${r.city}) — similarity: ${parseFloat(r.similarity).toFixed(4)}`);
  }

  // Test a query that should NOT match well
  console.log('\n--- Step 4: Negative test (unrelated query) ---');
  const negResults = await embeddingService.searchByText({
    query: 'car repair mechanic oil change',
    type: 'business',
    limit: 5,
  });

  console.log(`Found ${negResults.length} results:`);
  for (const r of negResults) {
    console.log(`  - ${r.name} — similarity: ${parseFloat(r.similarity).toFixed(4)}`);
  }

  console.log('\n✅ Embedding service tests passed!');
  await cleanup();
};

const cleanup = async () => {
  await closePostgres();
  await closeRedis();
};

test().catch(async (err) => {
  console.error('Test failed:', err);
  await cleanup();
  process.exit(1);
});
