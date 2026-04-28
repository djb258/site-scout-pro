import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { deals } from './routes/deals';
import { facilities } from './routes/facilities';
import { health } from './routes/health';
import { parcels } from './routes/parcels';
import { zips } from './routes/zips';

const app = new Hono<{ Bindings: Env }>();

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    maxAge: 86400,
  })
);

app.route('/', health);
app.route('/', zips);
app.route('/', facilities);
app.route('/', parcels);
app.route('/', deals);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error(err.message);
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default app;
