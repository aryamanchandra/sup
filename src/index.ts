import 'dotenv/config';
import Fastify from 'fastify';
import { loadConfig } from './config.js';
import { logger } from './utils/logger.js';
import { connectDatabase, disconnectDatabase } from './db/prismaClient.js';
import { registerHealthRoutes } from './routes/health.js';
import { createApp } from './app.js';
import { scheduleWorkspaceJobs, stopAllJobs } from './services/scheduler.js';
import { createSummarizer } from './services/summarizer/openai.js';
import { WebClient } from '@slack/web-api';

async function main() {
  try {
    logger.info('Starting Stand-up Slack Bot...');

    // Load configuration
    const config = loadConfig();
    logger.info(
      {
        port: config.port,
        nodeEnv: config.nodeEnv,
        summaryEnabled: config.summaryEnabled,
        defaultTz: config.defaultTz,
      },
      'Configuration loaded'
    );

    // Connect to database
    await connectDatabase();

    // Create Fastify server for health checks
    const fastify = Fastify({
      logger: false, // We use pino directly
    });

    registerHealthRoutes(fastify);

    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    logger.info({ port: config.port }, 'HTTP server listening');

    // Create Slack app
    const app = createApp(config);

    // Start Socket Mode
    await app.start();
    logger.info('⚡️ Slack app is running in Socket Mode');

    // Initialize scheduler
    const client = new WebClient(config.slackBotToken);
    const summarizer = createSummarizer(config.openAiApiKey);

    await scheduleWorkspaceJobs(client, summarizer, config.collectionWindowMin);
    logger.info('Scheduler initialized');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutdown signal received');

      try {
        stopAllJobs();
        await app.stop();
        await fastify.close();
        await disconnectDatabase();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (error) {
    logger.error({ error }, 'Failed to start application');
    process.exit(1);
  }
}

void main();
