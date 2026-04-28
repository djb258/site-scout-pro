import { Hono } from 'hono';
import type { Env } from '../types';

export const health = new Hono<{ Bindings: Env }>();

health.get('/health', async (c) => {
  const [storageResult, globalResult] = await Promise.allSettled([
    c.env.STORAGE_OPS.prepare('SELECT 1 AS ok').first<{ ok: number }>(),
    c.env.D1_GLOBAL.prepare('SELECT 1 AS ok').first<{ ok: number }>(),
  ]);

  const storageOk = storageResult.status === 'fulfilled' && storageResult.value?.ok === 1;
  const globalOk = globalResult.status === 'fulfilled' && globalResult.value?.ok === 1;
  const allHealthy = storageOk && globalOk;

  return c.json({
    status: allHealthy ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    bindings: {
      storage_ops: storageOk,
      d1_global: globalOk,
    },
  }, allHealthy ? 200 : 503);
});
