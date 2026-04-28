import { Hono } from 'hono';
import type { Env } from '../types';
import {
  isNonNegativeNumber,
  isZipCode,
  isoNow,
  jsonError,
  normalizePagination,
  parseJsonField,
  readJsonObject,
  uuid,
} from '../lib/http';

export const facilities = new Hono<{ Bindings: Env }>();

facilities.get('/api/facilities', async (c) => {
  const { limit, offset } = normalizePagination(c.req.query('limit'), c.req.query('offset'));
  const zipCode = c.req.query('zip');
  const marketDataId = c.req.query('market_data_id');

  if (zipCode && !isZipCode(zipCode)) {
    return jsonError('zip must be a 5-digit ZIP code', 400);
  }

  const predicates: string[] = [];
  const bindings: unknown[] = [];

  if (zipCode) {
    predicates.push('zip_code = ?');
    bindings.push(zipCode);
  }

  if (marketDataId) {
    predicates.push('market_data_id = ?');
    bindings.push(marketDataId);
  }

  const where = predicates.length > 0 ? `WHERE ${predicates.join(' AND ')}` : '';
  const sql = `
    SELECT *
    FROM facilities
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;

  const result = await c.env.STORAGE_OPS.prepare(sql)
    .bind(...bindings, limit, offset)
    .all<Record<string, unknown>>();

  return c.json({
    count: result.results.length,
    items: result.results.map((row) => ({
      ...row,
      metadata: parseJsonField(row.metadata, {}),
    })),
    limit,
    offset,
  });
});

facilities.get('/api/facilities/:facility_id', async (c) => {
  const { facility_id } = c.req.param();
  const row = await c.env.STORAGE_OPS.prepare('SELECT * FROM facilities WHERE facility_id = ?')
    .bind(facility_id)
    .first<Record<string, unknown>>();

  if (!row) {
    return c.json({ error: 'Facility not found', facility_id }, 404);
  }

  return c.json({
    item: {
      ...row,
      metadata: parseJsonField(row.metadata, {}),
    },
  });
});

facilities.post('/api/facilities', async (c) => {
  const body = await readJsonObject(c.req.raw);
  if (body instanceof Response) {
    return body;
  }

  const zipCode = typeof body.zip_code === 'string' ? body.zip_code : null;
  const name = typeof body.name === 'string' ? body.name : null;

  if (!zipCode || !name) {
    return jsonError('zip_code and name are required');
  }

  if (!isZipCode(zipCode)) {
    return jsonError('zip_code must be a 5-digit ZIP code', 400);
  }

  if (body.rentable_sqft !== undefined && body.rentable_sqft !== null && !isNonNegativeNumber(body.rentable_sqft)) {
    return jsonError('rentable_sqft must be a non-negative number', 400);
  }

  if (body.units !== undefined && body.units !== null && !isNonNegativeNumber(body.units)) {
    return jsonError('units must be a non-negative number', 400);
  }

  if (body.occupancy_rate !== undefined && body.occupancy_rate !== null && !isNonNegativeNumber(body.occupancy_rate)) {
    return jsonError('occupancy_rate must be a non-negative number', 400);
  }

  const facilityId = typeof body.facility_id === 'string' ? body.facility_id : uuid();
  const now = isoNow();

  await c.env.STORAGE_OPS.prepare(
    `
      INSERT INTO facilities (
        facility_id, zip_code, market_data_id, name, brand, address, city, state,
        latitude, longitude, units, rentable_sqft, occupancy_rate, source, metadata,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      facilityId,
      zipCode,
      typeof body.market_data_id === 'string' ? body.market_data_id : null,
      name,
      typeof body.brand === 'string' ? body.brand : null,
      typeof body.address === 'string' ? body.address : null,
      typeof body.city === 'string' ? body.city : null,
      typeof body.state === 'string' ? body.state : null,
      typeof body.latitude === 'number' ? body.latitude : null,
      typeof body.longitude === 'number' ? body.longitude : null,
      typeof body.units === 'number' ? body.units : null,
      typeof body.rentable_sqft === 'number' ? body.rentable_sqft : null,
      typeof body.occupancy_rate === 'number' ? body.occupancy_rate : null,
      typeof body.source === 'string' ? body.source : 'manual',
      JSON.stringify(body.metadata ?? {}),
      now,
      now
    )
    .run();

  const item = await c.env.STORAGE_OPS.prepare('SELECT * FROM facilities WHERE facility_id = ?')
    .bind(facilityId)
    .first<Record<string, unknown>>();

  return c.json(
    {
      item: {
        ...item,
        metadata: parseJsonField(item?.metadata, {}),
      },
    },
    201
  );
});
