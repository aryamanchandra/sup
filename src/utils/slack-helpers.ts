import { logger } from './logger.js';

/**
 * Safely acknowledge a Slack command/interaction with retry logic
 * Returns true if successful, false otherwise
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safeAck(
  ack: (...args: any[]) => Promise<any>,
  context?: string
): Promise<boolean> {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
