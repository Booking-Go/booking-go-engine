/**
 * Test script — Verifies sentiment analysis end-to-end.
 * Inserts a review with a comment, analyzes sentiment, and reads the result.
 *
 * Usage: npx ts-node scripts/test-sentiment.ts
 */
import { connectPostgres, pgPool } from '../src/config';
import { connectOllama, closeOllama } from '../src/config/ollama';
import { sentimentService } from '../src/core/services/sentiment.service';
import { logger } from '../src/libs';

const run = async () => {
  await connectPostgres();
  await connectOllama();

  // 1. Ensure a test user exists
  const userResult = await pgPool.query(
    `INSERT INTO users (email, phone, password_hash, first_name, last_name, role)
     VALUES ('sentiment-test@example.com', '+10000000002', 'hash', 'Sentiment', 'Tester', 'customer')
     ON CONFLICT (email) DO UPDATE SET first_name = 'Sentiment'
     RETURNING id`,
  );
  const userId = userResult.rows[0].id;

  // 2. Ensure a test business exists
  const bizResult = await pgPool.query(
    `INSERT INTO businesses (name, slug, owner_id, category, phone, email, city, state, zip_code, country, address_line1)
     VALUES ('Sentiment Salon', 'sentiment-salon-test', $1, 'salon', '+10000000003', 'sentiment-salon@example.com', 'Test City', 'TS', '12345', 'US', '123 Test St')
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [userId],
  );
  const finalBizId = bizResult.rows[0]?.id
    || (await pgPool.query(`SELECT id FROM businesses WHERE slug = 'sentiment-salon-test'`)).rows[0].id;

  // 3. Create test slots, bookings, and reviews (full FK chain)
  const reviews = [
    { comment: 'Absolutely amazing experience! The stylist was professional and the result was perfect. Highly recommend!', rating: 5 },
    { comment: 'Decent service but nothing special. The wait was longer than expected.', rating: 3 },
    { comment: 'Terrible experience. They ruined my hair and were incredibly rude. Never going back.', rating: 1 },
  ];

  const reviewIds: string[] = [];
  const slotIds: string[] = [];
  const bookingIds: string[] = [];

  for (let i = 0; i < reviews.length; i++) {
    const r = reviews[i];

    const slotResult = await pgPool.query(
      `INSERT INTO slots (business_id, start_time, end_time, price)
       VALUES ($1, NOW() - INTERVAL '${i + 1} days', NOW() - INTERVAL '${i + 1} days' + INTERVAL '1 hour', 50.00)
       RETURNING id`,
      [finalBizId],
    );
    slotIds.push(slotResult.rows[0].id);

    const bookingResult = await pgPool.query(
      `INSERT INTO bookings (slot_id, business_id, customer_id, status, booking_date, start_time, end_time, total_price, customer_name, customer_email)
       VALUES ($1, $2, $3, 'completed', (CURRENT_DATE - ($4 || ' days')::interval)::date, NOW() - ($4 || ' days')::interval, NOW() - ($4 || ' days')::interval + INTERVAL '1 hour', 50.00, 'Sentiment Tester', 'sentiment-test@example.com')
       RETURNING id`,
      [slotResult.rows[0].id, finalBizId, userId, String(i + 1)],
    );
    bookingIds.push(bookingResult.rows[0].id);

    const reviewResult = await pgPool.query(
      `INSERT INTO reviews (booking_id, business_id, customer_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [bookingResult.rows[0].id, finalBizId, userId, r.rating, r.comment],
    );
    reviewIds.push(reviewResult.rows[0].id);
  }

  logger.info(`Inserted ${reviewIds.length} test reviews`);

  // 4. Analyze each review
  for (let i = 0; i < reviewIds.length; i++) {
    logger.info(`Analyzing review ${i + 1}: "${reviews[i].comment.substring(0, 50)}..."`);
    await sentimentService.analyzeReview(reviewIds[i], reviews[i].comment);
  }

  // 5. Read back the results
  const { rows } = await pgPool.query(
    `SELECT id, rating, sentiment, sentiment_score, LEFT(comment, 60) AS comment_preview
     FROM reviews
     WHERE id = ANY($1::uuid[])
     ORDER BY rating DESC`,
    [reviewIds],
  );

  console.log('\n=== Sentiment Analysis Results ===');
  for (const row of rows) {
    console.log(`  Rating: ${row.rating}★ | Sentiment: ${row.sentiment} (${row.sentiment_score}) | "${row.comment_preview}"`);
  }

  // 6. Test summary
  const summary = await sentimentService.getBusinessSentimentSummary(finalBizId);
  console.log('\n=== Business Sentiment Summary ===');
  console.log(`  Total analyzed: ${summary.total}`);
  for (const b of summary.breakdown) {
    console.log(`  ${b.sentiment}: ${b.count} reviews (${b.percentage}%), avg score: ${b.avgScore}`);
  }

  // 7. Cleanup test data
  await pgPool.query(`DELETE FROM reviews WHERE id = ANY($1::uuid[])`, [reviewIds]);
  await pgPool.query(`DELETE FROM bookings WHERE id = ANY($1::uuid[])`, [bookingIds]);
  await pgPool.query(`DELETE FROM slots WHERE id = ANY($1::uuid[])`, [slotIds]);
  await pgPool.query(`DELETE FROM businesses WHERE id = $1`, [finalBizId]);
  await pgPool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  logger.info('Cleaned up test data');

  await closeOllama();
  await pgPool.end();
  console.log('\n✅ Sentiment test complete!');
  process.exit(0);
};

run().catch((err) => {
  console.error('❌ Sentiment test failed:', err);
  process.exit(1);
});
