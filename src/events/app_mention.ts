import { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';
import { logger } from '../utils/logger.js';

export async function handleAppMention({
  event,
  client,
}: SlackEventMiddlewareArgs<'app_mention'> & AllMiddlewareArgs): Promise<void> {
  try {
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.ts,
      text:
        "👋 Hi! I'm the Stand-up Bot. Here's what I can do:\n\n" +
        '*Commands:*\n' +
        '• `/standup init` - Set up stand-ups for your workspace\n' +
        '• `/standup today` - Run a stand-up now\n' +
        "• `/standup summary` - Generate AI summary of today's stand-up\n" +
        '• `/standup config` - Update configuration\n' +
        '• `/standup optin` - Opt in to daily stand-ups\n' +
        '• `/standup optout` - Opt out of daily stand-ups\n' +
        '• `/standup status` - View current configuration\n\n' +
        'Need help? Just mention me anytime!',
    });

    logger.info({ userId: event.user, channel: event.channel }, 'App mention handled');
  } catch (error) {
    logger.error({ error, event }, 'Failed to handle app mention');
  }
}
