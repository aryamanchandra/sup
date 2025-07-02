import 'dotenv/config';
import Fastify from 'fastify';
import formbody from '@fastify/formbody';
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

    // Create Slack app
    const app = createApp(config);

    // Create Fastify server
    const fastify = Fastify({
      logger: false, // We use pino directly
      bodyLimit: 10485760, // 10MB for Slack payloads
    });

    // Register form body parser for Slack's URL-encoded payloads
    await fastify.register(formbody);

    // Register health routes
    registerHealthRoutes(fastify);

    // Register Slack event endpoints
    fastify.post('/slack/events', async (request, reply) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      const slackEvent = request.body as any;

      // Handle URL verification challenge
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (slackEvent.type === 'url_verification') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        await reply.send({ challenge: slackEvent.challenge });
        return;
      }

      // Process the event with Bolt
      try {
        await app.processEvent({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          body: slackEvent,
          ack: async (response: any) => {
            if (!reply.sent) {
              await reply.send(response || '');
            }
          },
        });
      } catch (error) {
        logger.error({ error }, 'Error processing Slack event');
        if (!reply.sent) {
          await reply.code(500).send({ error: 'Internal server error' });
        }
      }
    });

    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    logger.info({ port: config.port }, 'HTTP server listening');
    logger.info('⚡️ Slack app is running in HTTP mode');

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
