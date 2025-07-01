import { prisma } from '../db/prismaClient.js';
import { logger } from './logger.js';

const LOCK_TIMEOUT_MS = 60000; // 1 minute

export async function acquireLock(key: string, heldBy: string): Promise<boolean> {
  try {
    const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS);

    // Try to create the lock
    await prisma.jobLock.create({
      data: {
        key,
        heldBy,
        expiresAt,
      },
    });

    logger.debug({ key, heldBy }, 'Lock acquired');
    return true;
  } catch (error) {
    // Lock already exists or expired, try to clean up expired locks
    await cleanupExpiredLocks();

    // Try again
    try {
      const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS);
      await prisma.jobLock.create({
        data: {
          key,
          heldBy,
          expiresAt,
        },
      });
      logger.debug({ key, heldBy }, 'Lock acquired after cleanup');
      return true;
    } catch {
      logger.debug({ key, heldBy }, 'Failed to acquire lock');
      return false;
    }
  }
}

export async function releaseLock(key: string, heldBy: string): Promise<void> {
  try {
    await prisma.jobLock.delete({
      where: {
        key,
      },
    });
    logger.debug({ key, heldBy }, 'Lock released');
  } catch (error) {
    logger.debug({ error, key, heldBy }, 'Failed to release lock (may not exist)');
  }
}

export async function cleanupExpiredLocks(): Promise<void> {
  try {
    const result = await prisma.jobLock.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    if (result.count > 0) {
      logger.debug({ count: result.count }, 'Cleaned up expired locks');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to cleanup expired locks');
  }
}

export async function extendLock(key: string, heldBy: string): Promise<boolean> {
  try {
    const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS);
    await prisma.jobLock.update({
      where: {
        key,
      },
      data: {
        expiresAt,
      },
    });
    logger.debug({ key, heldBy }, 'Lock extended');
    return true;
  } catch (error) {
    logger.debug({ error, key, heldBy }, 'Failed to extend lock');
    return false;
  }
}
