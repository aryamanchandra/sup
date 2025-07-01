import cron from 'node-cron';
import { WebClient } from '@slack/web-api';
import { prisma } from '../db/prismaClient.js';
import { logger } from '../utils/logger.js';
import { acquireLock, releaseLock } from '../utils/locks.js';
import { createStandup, collectFromUsers } from './collector.js';
import { compileStandup } from './compiler.js';
import { SummarizerProvider } from './summarizer/provider.js';

interface ScheduledJob {
  task: cron.ScheduledTask;
  compileTask: cron.ScheduledTask;
}

const jobs = new Map<string, ScheduledJob>();
const INSTANCE_ID = `scheduler-${Date.now()}-${Math.random().toString(36).substring(7)}`;

export async function scheduleWorkspaceJobs(
  client: WebClient,
  summarizer: SummarizerProvider | null,
  collectionWindowMin: number
): Promise<void> {
  try {
    const workspaces = await prisma.workspace.findMany();

    for (const workspace of workspaces) {
      await scheduleWorkspaceJob(workspace.id, client, summarizer, collectionWindowMin);
    }

    logger.info({ count: workspaces.length }, 'Scheduled jobs for workspaces');
  } catch (error) {
    logger.error({ error }, 'Failed to schedule workspace jobs');
    throw error;
  }
}

export async function scheduleWorkspaceJob(
  workspaceId: string,
  client: WebClient,
  summarizer: SummarizerProvider | null,
  collectionWindowMin: number
): Promise<void> {
  try {
    // Cancel existing job if any
    cancelWorkspaceJob(workspaceId);

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      logger.error({ workspaceId }, 'Workspace not found');
      return;
    }

    const lockKey = `standup-job-${workspaceId}`;

    // Schedule collection job
    const collectionTask = cron.schedule(
      workspace.cron,
      () => {
        void (async () => {
          const acquired = await acquireLock(lockKey, INSTANCE_ID);
          if (!acquired) {
            logger.debug({ workspaceId }, 'Another instance is handling this job');
            return;
          }

          try {
            logger.info({ workspaceId, cron: workspace.cron }, 'Starting scheduled stand-up');

            const standupId = await createStandup(
              workspaceId,
              workspace.defaultChannelId,
              workspace.timezone
            );

            await collectFromUsers(client, workspaceId, standupId);

            logger.info({ workspaceId, standupId }, 'Collection started');
          } catch (error) {
            logger.error({ error, workspaceId }, 'Failed to execute scheduled job');
          } finally {
            await releaseLock(lockKey, INSTANCE_ID);
          }
        })();
      },
      {
        timezone: workspace.timezone,
      }
    );

    // Calculate compilation cron (collection time + window)
    const cronParts = workspace.cron.split(' ');
    const collectionMinute = parseInt(cronParts[0], 10);
    const collectionHour = parseInt(cronParts[1], 10);

    let compileMinute = collectionMinute + collectionWindowMin;
    let compileHour = collectionHour;

    if (compileMinute >= 60) {
      compileHour += Math.floor(compileMinute / 60);
      compileMinute = compileMinute % 60;
    }

    if (compileHour >= 24) {
      compileHour = compileHour % 24;
    }

    const compileCron = `${compileMinute} ${compileHour} * * *`;

    // Schedule compilation job
    const compileTask = cron.schedule(
      compileCron,
      () => {
        void (async () => {
          const acquired = await acquireLock(`${lockKey}-compile`, INSTANCE_ID);
          if (!acquired) {
            logger.debug({ workspaceId }, 'Another instance is handling compilation');
            return;
          }

          try {
            logger.info({ workspaceId }, 'Starting scheduled compilation');

            // Find today's standup
            const standup = await prisma.standup.findFirst({
              where: {
                workspaceId,
                compiledAt: null,
              },
              orderBy: {
                startedAt: 'desc',
              },
            });

            if (standup) {
              await compileStandup(client, standup.id, summarizer);
              logger.info({ workspaceId, standupId: standup.id }, 'Compilation completed');
            } else {
              logger.warn({ workspaceId }, 'No standup found to compile');
            }
          } catch (error) {
            logger.error({ error, workspaceId }, 'Failed to execute compilation job');
          } finally {
            await releaseLock(`${lockKey}-compile`, INSTANCE_ID);
          }
        })();
      },
      {
        timezone: workspace.timezone,
      }
    );

    jobs.set(workspaceId, { task: collectionTask, compileTask });

    logger.info(
      { workspaceId, collectionCron: workspace.cron, compileCron, timezone: workspace.timezone },
      'Workspace job scheduled'
    );
  } catch (error) {
    logger.error({ error, workspaceId }, 'Failed to schedule workspace job');
    throw error;
  }
}

export function cancelWorkspaceJob(workspaceId: string): void {
  const job = jobs.get(workspaceId);
  if (job) {
    job.task.stop();
    job.compileTask.stop();
    jobs.delete(workspaceId);
    logger.info({ workspaceId }, 'Workspace job cancelled');
  }
}

export function getScheduledJobsCount(): number {
  return jobs.size;
}

export function stopAllJobs(): void {
  for (const [workspaceId, job] of jobs.entries()) {
    job.task.stop();
    job.compileTask.stop();
    logger.info({ workspaceId }, 'Job stopped');
  }
  jobs.clear();
  logger.info('All jobs stopped');
}
