import { prisma } from '../db/prismaClient.js';
import { logger } from '../utils/logger.js';

export async function setUserOptIn(
  workspaceId: string,
  userId: string,
  optedIn: boolean
): Promise<void> {
  try {
    await prisma.member.upsert({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      create: {
        workspaceId,
        userId,
        optedIn,
      },
      update: {
        optedIn,
      },
    });

    logger.info({ workspaceId, userId, optedIn }, 'User opt-in status updated');
  } catch (error) {
    logger.error({ error, workspaceId, userId }, 'Failed to update user opt-in status');
    throw error;
  }
}

export async function getOptedInUsers(workspaceId: string): Promise<string[]> {
  try {
    const members = await prisma.member.findMany({
      where: {
        workspaceId,
        optedIn: true,
      },
      select: {
        userId: true,
      },
    });

    return members.map((m) => m.userId);
  } catch (error) {
    logger.error({ error, workspaceId }, 'Failed to get opted-in users');
    throw error;
  }
}

export async function getUserOptInStatus(workspaceId: string, userId: string): Promise<boolean> {
  try {
    const member = await prisma.member.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    return member?.optedIn ?? false;
  } catch (error) {
    logger.error({ error, workspaceId, userId }, 'Failed to get user opt-in status');
    return false;
  }
}

export async function ensureMembersExist(workspaceId: string, userIds: string[]): Promise<void> {
  try {
    const existingMembers = await prisma.member.findMany({
      where: {
        workspaceId,
        userId: {
          in: userIds,
        },
      },
      select: {
        userId: true,
      },
    });

    const existingUserIds = new Set(existingMembers.map((m) => m.userId));
    const newUserIds = userIds.filter((id) => !existingUserIds.has(id));

    if (newUserIds.length > 0) {
      await prisma.member.createMany({
        data: newUserIds.map((userId) => ({
          workspaceId,
          userId,
          optedIn: true, // Default to opted in
        })),
      });

      logger.info({ workspaceId, count: newUserIds.length }, 'Created new members');
    }
  } catch (error) {
    logger.error({ error, workspaceId }, 'Failed to ensure members exist');
    throw error;
  }
}
