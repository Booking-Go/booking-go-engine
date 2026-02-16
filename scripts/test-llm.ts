import { connectOllama, isOllamaAvailable, OllamaConfig } from '../src/config/ollama';
import { llm } from '../src/libs/llm';

const test = async () => {
  console.log('Config:', OllamaConfig);

  await connectOllama();
  console.log('Available:', isOllamaAvailable());

  // Test chat
  console.log('\n--- Chat Test ---');
  const chatResponse = await llm.chat('You are a booking assistant.', 'Hello!');
  console.log('Chat:', chatResponse);

  // Test embedding
  console.log('\n--- Embedding Test ---');
  const embedding = await llm.embed('luxury spa and massage downtown');
  console.log('Embedding dimensions:', embedding.length);
  console.log('First 3 values:', embedding.slice(0, 3));

  // Test intent extraction
  console.log('\n--- Intent Test ---');
  const intent = await llm.extractIntent('I need a haircut tomorrow at 2pm in New York');
  console.log('Intent:', JSON.stringify(intent, null, 2));

  // Test sentiment
  console.log('\n--- Sentiment Test ---');
  const sentiment = await llm.analyzeSentiment(
    'Amazing service! The staff was so friendly and professional. Will definitely come back.',
  );
  console.log('Sentiment:', JSON.stringify(sentiment, null, 2));

  console.log('\n✅ All LLM tests passed!');
};

test().catch(console.error);
