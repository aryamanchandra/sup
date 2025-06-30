import { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { logger } from '../utils/logger.js';
import { prisma } from '../db/prismaClient.js';
import { setUserOptIn } from '../services/users.js';

export async function handleStandupOptIn({
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
        text: '❌ Workspace not configured. Please ask an admin to run `/standup init` first.',
        response_type: 'ephemeral',
      });
      return;
    }

    await setUserOptIn(workspace.id, command.user_id, true);

    await respond({
      text: '✅ You have opted in to daily stand-ups! You will receive DMs when stand-ups are scheduled.',
      response_type: 'ephemeral',
    });

    logger.info({ userId: command.user_id, workspaceId: workspace.id }, 'User opted in');
  } catch (error) {
    logger.error({ error, userId: command.user_id }, 'Failed to handle standup optin');
    await respond({
      text: '❌ Failed to opt in. Please try again.',
      response_type: 'ephemeral',
    });
  }
}

