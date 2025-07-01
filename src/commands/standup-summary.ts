import { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { logger } from '../utils/logger.js';
import { prisma } from '../db/prismaClient.js';
import { getTodayDate } from '../utils/date.js';
import { regenerateSummary } from '../services/compiler.js';
import { SummarizerProvider } from '../services/summarizer/provider.js';

export function createStandupSummaryHandler(summarizer: SummarizerProvider | null) {
  return async function handleStandupSummary({
    command,
    ack,
    respond,
    client,
  }: SlackCommandMiddlewareArgs & AllMiddlewareArgs): Promise<void> {
    try {
      await ack();

      if (!summarizer) {
        await respond({
          text: '❌ Summary feature is not enabled. Please set OPENAI_API_KEY and SUMMARY_ENABLED=true.',
          response_type: 'ephemeral',
        });
        return;
      }

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

      const date = getTodayDate(workspace.timezone);

      await respond({
        text: '⏳ Regenerating summary...',
        response_type: 'ephemeral',
      });

      await regenerateSummary(client, workspace.id, date, summarizer);

      await respond({
        text: '✅ Summary regenerated and posted to the stand-up thread!',
        response_type: 'ephemeral',
      });

      logger.info({ userId: command.user_id, workspaceId: workspace.id }, 'Summary regenerated');
    } catch (error) {
      logger.error({ error, userId: command.user_id }, 'Failed to handle standup summary');
      await respond({
        text: '❌ Failed to regenerate summary. Make sure a stand-up was compiled today.',
        response_type: 'ephemeral',
      });
    }
  };
}
