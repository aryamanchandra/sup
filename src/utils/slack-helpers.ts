import { logger } from './logger.js';

/**
 * Safely acknowledge a Slack command/interaction with retry logic
 * Returns true if successful, false otherwise
 */
export async function safeAck(ack: (...args: any[]) => Promise<any>, context?: string): Promise<boolean> {
  try {
    await ack();
    return true;
  } catch (error) {
    logger.error({ error, context }, 'Failed to acknowledge Slack command');
    return false;
  }
}

/**
 * Safely respond to a Slack command with error handling
 */
export async function safeRespond(
  respond: (message: any) => Promise<any>,
  message: any,
  context?: string
): Promise<boolean> {
  try {
    await respond(message);
    return true;
  } catch (error) {
    logger.error({ error, context }, 'Failed to send response');
    return false;
  }
}

