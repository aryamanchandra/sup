import { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { logger } from '../utils/logger.js';
import { prisma } from '../db/prismaClient.js';
import { setUserOptIn } from '../services/users.js';

export async function handleStandupOptOut({
  command,
  ack,
  respond,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs): Promise<void> {
  try {
    await ack();

    const workspace = await prisma.workspace.findUnique({
      where: { teamId: command.team_id },
    });

    if (!workspace) {
      await respond({
        text: '❌ Workspace not configured.',
        response_type: 'ephemeral',
      });
      return;
    }

    await setUserOptIn(workspace.id, command.user_id, false);

    await respond({
      text: '✅ You have opted out of daily stand-ups. You can opt back in anytime with `/standup optin`.',
      response_type: 'ephemeral',
    });

    logger.info({ userId: command.user_id, workspaceId: workspace.id }, 'User opted out');
  } catch (error) {
    logger.error({ error, userId: command.user_id }, 'Failed to handle standup optout');
    await respond({
      text: '❌ Failed to opt out. Please try again.',
      response_type: 'ephemeral',
    });
  }
}
