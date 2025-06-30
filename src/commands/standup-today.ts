import { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { logger } from '../utils/logger.js';
import { prisma } from '../db/prismaClient.js';
import { createStandup, collectFromUsers } from '../services/collector.js';
import { compileStandup } from '../services/compiler.js';
import { SummarizerProvider } from '../services/summarizer/provider.js';

export function createStandupTodayHandler(
  summarizer: SummarizerProvider | null,
  collectionWindowMin: number
) {
  return async function handleStandupToday({
    command,
    ack,
    client,
    respond,
  }: SlackCommandMiddlewareArgs & AllMiddlewareArgs): Promise<void> {
    try {
      await ack();

      const workspace = await prisma.workspace.findUnique({
        where: { teamId: command.team_id },
      });

      if (!workspace) {
        await respond({
          text: '❌ Workspace not configured. Please run `/standup init` first.',
          response_type: 'ephemeral',
        });
        return;
      }

      await respond({
        text: '⏳ Starting stand-up collection now...',
        response_type: 'ephemeral',
      });

      const standupId = await createStandup(
        workspace.id,
        workspace.defaultChannelId,
        workspace.timezone
      );

      await collectFromUsers(client, workspace.id, standupId);

      // Schedule compilation after a short delay
      setTimeout(async () => {
        try {
          await compileStandup(client, standupId, summarizer);
          logger.info({ standupId }, 'Ad-hoc stand-up compiled');
        } catch (error) {
          logger.error({ error, standupId }, 'Failed to compile ad-hoc stand-up');
        }
      }, collectionWindowMin * 60 * 1000);

      await respond({
        text: `✅ Stand-up collection started! Messages sent to opted-in members. Compilation scheduled in ${collectionWindowMin} minutes.`,
        response_type: 'ephemeral',
      });

      logger.info({ userId: command.user_id, standupId }, 'Ad-hoc stand-up started');
    } catch (error) {
      logger.error({ error, userId: command.user_id }, 'Failed to handle standup today');
      await respond({
        text: '❌ Failed to start stand-up. Please try again.',
        response_type: 'ephemeral',
      });
    }
  };
}

