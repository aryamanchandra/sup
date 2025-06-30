import { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { logger } from '../utils/logger.js';
import { buildConfigModal } from '../utils/formatting.js';
import { openModal } from '../services/slack.js';

export async function handleStandupInit({
  command,
  ack,
  client,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs): Promise<void> {
  try {
    await ack();

    const modal = buildConfigModal();

    await openModal(client, command.trigger_id, modal);

    logger.info({ userId: command.user_id, teamId: command.team_id }, 'Init modal opened');
  } catch (error) {
    logger.error({ error, userId: command.user_id }, 'Failed to handle standup init');
  }
}

