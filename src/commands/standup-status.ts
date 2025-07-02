import { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { logger } from '../utils/logger.js';
import { prisma } from '../db/prismaClient.js';
import { getNextCronTime } from '../utils/date.js';
import { getUserOptInStatus } from '../services/users.js';
import { safeAck } from '../utils/slack-helpers.js';
import { workspaceCache } from '../cache/simple-cache.js';

export async function handleStandupStatus({
  command,
  ack,
  respond,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs): Promise<void> {
  const ackSuccess = await safeAck(ack, 'standup-status');
  if (!ackSuccess) return;

  try {
    // Check cache first
    let workspace = workspaceCache.get(command.team_id);

    if (!workspace) {
      workspace = await prisma.workspace.findUnique({
        where: { teamId: command.team_id },
      });

      if (workspace) {
        workspaceCache.set(command.team_id, workspace);
      }
    }

    if (!workspace) {
      await respond({
        text: '❌ Workspace not configured. Please run `/standup-init` first.',
        response_type: 'ephemeral',
      });
      return;
    }

    // Parallel execution for speed
    const [isOptedIn, nextRun] = await Promise.all([
      getUserOptInStatus(workspace.id, command.user_id),
      Promise.resolve(getNextCronTime(workspace.cron, workspace.timezone)),
    ]);

    const nextRunText = nextRun
      ? new Intl.DateTimeFormat('en-US', {
          timeZone: workspace.timezone,
          dateStyle: 'full',
          timeStyle: 'short',
        }).format(nextRun)
      : 'Not scheduled';

    await respond({
      text:
        `📊 *Stand-up Status*\n\n` +
        `*Channel:* <#${workspace.defaultChannelId}>\n` +
        `*Timezone:* ${workspace.timezone}\n` +
        `*Next Run:* ${nextRunText}\n` +
        `*Summary Enabled:* ${workspace.summaryEnabled ? 'Yes' : 'No'}\n` +
        `*Your Status:* ${isOptedIn ? '✅ Opted In' : '❌ Opted Out'}`,
      response_type: 'ephemeral',
    });

    logger.info({ userId: command.user_id, workspaceId: workspace.id }, 'Status requested');
  } catch (error) {
    logger.error({ error, userId: command.user_id }, 'Failed to handle standup status');
    try {
      await respond({
        text: '❌ Failed to fetch status. Please try again.',
        response_type: 'ephemeral',
      });
    } catch (respondError) {
      logger.error({ error: respondError }, 'Failed to send error response');
    }
  }
}
