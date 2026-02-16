/**
 * AI Seed Script — generates embeddings and analyzes sentiment for seeded data.
 *
 * Run this AFTER the main seed script to populate AI features:
 *   npx ts-node -r dotenv/config scripts/seed-ai.ts
 *
 * What it does:
 *   1. Generates vector embeddings for all businesses (pgvector)
 *   2. Generates vector embeddings for all services (pgvector)
 *   3. Analyzes sentiment for all reviews that don't have sentiment yet
 *
 * Requirements:
 *   - PostgreSQL running with pgvector extension
 *   - Ollama running with llama3.1:8b and nomic-embed-text models
 *   - Main seed script already executed (npx ts-node -r dotenv/config scripts/seed.ts)
 */

import { connectPostgres, pgPool } from '../src/config';
import { connectOllama, closeOllama, isOllamaAvailable } from '../src/config/ollama';
import { connectRedis, closeRedis } from '../src/config/redis';
import { embeddingService } from '../src/core/services/embedding.service';
import { sentimentService } from '../src/core/services/sentiment.service';
import { logger } from '../src/libs';

const DIVIDER = '─'.repeat(50);

const run = async () => {
  console.log('\n🤖 Booking.go — AI Seed\n');
  console.log(DIVIDER);

  // 1. Connect to infrastructure
  console.log('🔌 Connecting to databases and Ollama...');
  await connectPostgres();
  await connectRedis();
  await connectOllama();

  if (!isOllamaAvailable()) {
    console.error('❌ Ollama is not available. Make sure it is running on localhost:11434');
    console.error('   Run: docker compose up ollama -d');
    process.exit(1);
  }

  console.log('   ✓ All connections established\n');

  // 2. Count what needs processing
  const bizCount = await pgPool.query(
    `SELECT COUNT(*)::int AS count FROM businesses WHERE description_embedding IS NULL`,
  );
  const svcCount = await pgPool.query(
    `SELECT COUNT(*)::int AS count FROM services WHERE description_embedding IS NULL`,
  );
  const reviewCount = await pgPool.query(
    `SELECT COUNT(*)::int AS count FROM reviews WHERE sentiment IS NULL AND comment IS NOT NULL AND comment != ''`,
  );

  console.log(`📊 Data to process:`);
  console.log(`   Businesses without embeddings: ${bizCount.rows[0].count}`);
  console.log(`   Services without embeddings:   ${svcCount.rows[0].count}`);
  console.log(`   Reviews without sentiment:     ${reviewCount.rows[0].count}`);
  console.log('');

  // 3. Generate embeddings
  console.log(DIVIDER);
  console.log('🧠 Step 1: Generating embeddings...');
  console.log('   (This uses the nomic-embed-text model — ~2s per item)\n');

  const startEmbed = Date.now();
  const embedResult = await embeddingService.generateAllEmbeddings();
  const embedTime = ((Date.now() - startEmbed) / 1000).toFixed(1);

  console.log(`   ✓ ${embedResult.businesses} business embeddings generated`);
  console.log(`   ✓ ${embedResult.services} service embeddings generated`);
  console.log(`   ⏱  Completed in ${embedTime}s\n`);

  // 4. Analyze sentiment
  console.log(DIVIDER);
  console.log('💬 Step 2: Analyzing review sentiment...');
  console.log('   (This uses the llama3.1:8b model — ~5-10s per review)\n');

  const startSentiment = Date.now();
  const analyzed = await sentimentService.analyzeAllPending();
  const sentimentTime = ((Date.now() - startSentiment) / 1000).toFixed(1);

  console.log(`   ✓ ${analyzed} reviews analyzed`);
  console.log(`   ⏱  Completed in ${sentimentTime}s\n`);

  // 5. Show results summary
  console.log(DIVIDER);
  console.log('📈 Results Summary:\n');

  // Embedding stats
  const embedStats = await pgPool.query(`
    SELECT 'businesses' AS type, COUNT(*)::int AS total,
           COUNT(description_embedding)::int AS with_embedding
    FROM businesses
    UNION ALL
    SELECT 'services', COUNT(*)::int, COUNT(description_embedding)::int
    FROM services
  `);
  for (const row of embedStats.rows) {
    console.log(`   ${row.type}: ${row.with_embedding}/${row.total} have embeddings`);
  }

  // Sentiment stats
  const sentimentStats = await pgPool.query(`
    SELECT sentiment, COUNT(*)::int AS count
    FROM reviews
    WHERE sentiment IS NOT NULL
    GROUP BY sentiment
    ORDER BY count DESC
  `);
  console.log(`\n   Review sentiment breakdown:`);
  for (const row of sentimentStats.rows) {
    const emoji = row.sentiment === 'positive' ? '😊' : row.sentiment === 'neutral' ? '😐' : '😞';
    console.log(`     ${emoji} ${row.sentiment}: ${row.count}`);
  }

  // Quick semantic search test
  console.log(`\n   Quick semantic search test:`);
  const testQuery = 'I need a haircut and styling';
  const searchResults = await embeddingService.searchByText({
    query: testQuery,
    type: 'business',
    limit: 3,
  });
  console.log(`   Query: "${testQuery}"`);
  if (searchResults.length > 0) {
    for (const r of searchResults) {
      const rec = r as Record<string, unknown>;
      const sim = rec.similarity ? `${Math.round((rec.similarity as number) * 100)}%` : '?';
      console.log(`     → ${rec.name} (${sim} match)`);
    }
  } else {
    console.log(`     (no results — businesses may not match this query)`);
  }

  // Cleanup
  await closeOllama();
  await closeRedis();
  await pgPool.end();

  const totalTime = ((Date.now() - startEmbed) / 1000).toFixed(0);

  console.log('\n' + DIVIDER);
  console.log(`\n🎉 AI seed complete! (${totalTime}s total)\n`);
  console.log('You can now use:');
  console.log('  POST /api/v1/ai/chat    — Chat with the AI assistant');
  console.log('  POST /api/v1/ai/search  — Semantic search for businesses/services');
  console.log('  GET  /api/v1/ai/chat/history — View chat history\n');

  process.exit(0);
};

run().catch((err) => {
  console.error('\n❌ AI seed failed:', err);
  process.exit(1);
});
