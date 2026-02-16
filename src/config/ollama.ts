import { Ollama } from 'ollama';
import chalk from 'chalk';

let ollamaClient: Ollama | null = null;

/** Ollama model configuration from environment variables. */
export const OllamaConfig = {
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
  chatModel: process.env.OLLAMA_CHAT_MODEL || 'llama3.2:3b',
  embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
  embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '768', 10),
} as const;

/**
 * Initializes the Ollama client and verifies connectivity.
 * Call once at startup (alongside connectPostgres, connectRedis, etc.).
 */
export const connectOllama = async (): Promise<void> => {
  try {
    ollamaClient = new Ollama({ host: OllamaConfig.host });

    // Verify connectivity by listing models
    const models = await ollamaClient.list();
    const modelNames = models.models.map((m) => m.name);

    console.log(chalk.green(`[Ollama] Connected to ${OllamaConfig.host}`)); // eslint-disable-line no-console
    console.log(chalk.green(`[Ollama] Available models: ${modelNames.join(', ')}`)); // eslint-disable-line no-console

    // Warn if expected models are missing
    const chatModelLoaded = modelNames.some((n) =>
      n.startsWith(OllamaConfig.chatModel.split(':')[0]),
    );
    const embedModelLoaded = modelNames.some((n) =>
      n.startsWith(OllamaConfig.embeddingModel.split(':')[0]),
    );

    if (!chatModelLoaded) {
      console.warn(
        chalk.yellow(
          `[Ollama] Chat model "${OllamaConfig.chatModel}" not found. Pull it with: ollama pull ${OllamaConfig.chatModel}`,
        ),
      );
    }
    if (!embedModelLoaded) {
      console.warn(
        chalk.yellow(
          `[Ollama] Embedding model "${OllamaConfig.embeddingModel}" not found. Pull it with: ollama pull ${OllamaConfig.embeddingModel}`,
        ),
      );
    }
  } catch (err: unknown) {
    console.error(chalk.red('[Ollama] Connection error:'), err);
    console.warn(
      chalk.yellow('[Ollama] AI features will be unavailable. Ensure Ollama is running.'),
    );
    // Don't throw — AI is optional, app should still start
  }
};

/**
 * Returns the active Ollama client.
 * @throws Error if Ollama was never connected.
 */
export const getOllamaClient = (): Ollama => {
  if (!ollamaClient) {
    throw new Error('Ollama client not initialized. Call connectOllama() first.');
  }
  return ollamaClient;
};

/**
 * Checks if Ollama is connected and available.
 * Use this to gracefully degrade when AI is unavailable.
 */
export const isOllamaAvailable = (): boolean => ollamaClient !== null;

/** Gracefully closes the Ollama client (no persistent connection, but resets state). */
export const closeOllama = (): void => {
  ollamaClient = null;
  console.log('Ollama client closed'); // eslint-disable-line no-console
};
