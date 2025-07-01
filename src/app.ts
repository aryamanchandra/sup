import { App, LogLevel } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { Config } from './config.js';
import { logger } from './utils/logger.js';
import { createSummarizer } from './services/summarizer/openai.js';

// Command handlers
import { handleStandupInit } from './commands/standup-init.js';
import { createStandupTodayHandler } from './commands/standup-today.js';
import { createStandupSummaryHandler } from './commands/standup-summary.js';
import { handleStandupConfig } from './commands/standup-config.js';
import { handleStandupOptIn } from './commands/standup-optin.js';
import { handleStandupOptOut } from './commands/standup-optout.js';
import { handleStandupStatus } from './commands/standup-status.js';

// Event handlers
import { handleAppMention } from './events/app_mention.js';

// Modal handlers
import { createSetupConfigHandler } from './modals/setup-config.js';
import {
  handleOpenStandupModal,
  handleSkipStandup,
  handleStandupSubmission,
} from './modals/collect-standup.js';

export function createApp(config: Config): App {
  const app = new App({
    token: config.slackBotToken,
    appToken: config.slackAppToken,
    socketMode: true,
    signingSecret: config.slackSigningSecret,
    logLevel: config.logLevel === 'debug' ? LogLevel.DEBUG : LogLevel.INFO,
  });

  const client = new WebClient(config.slackBotToken);
  const summarizer = createSummarizer(config.openAiApiKey);

  // Middleware for logging
  app.use(async ({ next, context }) => {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    context.requestId = requestId;
    logger.debug({ requestId }, 'Incoming request');
    await next();
  });

  // Command listeners
  app.command('/standup', async ({ command, ack, respond }) => {
    await ack();

    const subcommand = command.text.trim().split(' ')[0] || 'help';

    switch (subcommand) {
      case 'help':
      case '':
        await respond({
          text:
            '📋 *Stand-up Bot Commands*\n\n' +
            '• `/standup init` - Set up stand-ups\n' +
            '• `/standup today` - Run stand-up now\n' +
            '• `/standup summary` - Generate summary\n' +
            '• `/standup config` - Update config\n' +
            '• `/standup optin` - Opt in\n' +
            '• `/standup optout` - Opt out\n' +
            '• `/standup status` - View status',
          response_type: 'ephemeral',
        });
        break;

      default:
        await respond({
          text: `❌ Unknown command: \`${subcommand}\`. Use \`/standup help\` to see available commands.`,
          response_type: 'ephemeral',
        });
    }
  });

  app.command('/standup-init', handleStandupInit);
  app.command(
    '/standup-today',
    createStandupTodayHandler(summarizer, config.collectionWindowMin)
  );
  app.command('/standup-summary', createStandupSummaryHandler(summarizer));
  app.command('/standup-config', handleStandupConfig);
  app.command('/standup-optin', handleStandupOptIn);
  app.command('/standup-optout', handleStandupOptOut);
  app.command('/standup-status', handleStandupStatus);

  // Event listeners
  app.event('app_mention', handleAppMention);

  // Action listeners
  app.action('open_standup_modal', handleOpenStandupModal);
  app.action('skip_standup', handleSkipStandup);

  // View submissions
  app.view(
    'standup_config_modal',
    createSetupConfigHandler(client, summarizer, config.collectionWindowMin)
  );
  app.view('standup_collection_modal', handleStandupSubmission);

  // Error handling
  app.error(async (error) => {
    logger.error({ error }, 'Unhandled error in Slack app');
  });

  return app;
}

