import { FastifyInstance } from 'fastify';
import { healthCheckDatabase } from '../db/prismaClient.js';
import { logger } from '../utils/logger.js';

export function registerHealthRoutes(fastify: FastifyInstance): void {
  fastify.get('/healthz', async (_request, reply) => {
    await reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  fastify.get('/readyz', async (_request, reply) => {
    try {
      const dbHealthy = await healthCheckDatabase();

      if (!dbHealthy) {
        await reply.code(503).send({
          status: 'unhealthy',
          reason: 'Database connection failed',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await reply.send({
        status: 'ready',
        checks: {
          database: 'ok',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error }, 'Readiness check failed');
      await reply.code(503).send({
        status: 'unhealthy',
        reason: 'Health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  });
}
