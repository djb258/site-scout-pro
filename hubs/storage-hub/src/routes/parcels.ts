import { Hono } from 'hono';
import type { Env } from '../types';
import {
  PARCEL_PASS_STATUSES,
  isEnumValue,
  isNonNegativeNumber,
  isZipCode,
  isoNow,
  jsonError,
  normalizePagination,
  parseJsonField,
  readJsonObject,
  uuid,
} from '../lib/http';

export const parcels = new Hono<{ Bindings: Env }>();

parcels.get('/api/parcels', async (c) => {
  const { limit, offset } = normalizePagination(c.req.query('limit'), c.req.query('offset'));
  const zipCode = c.req.query('zip');
  const passStatus = c.req.query('pass_status');

  if (zipCode && !isZipCode(zipCode)) {
    return jsonError('zip must be a 5-digit ZIP code', 400);
  }

  if (passStatus && !isEnumValue(passStatus, PARCEL_PASS_STATUSES)) {
    return jsonError('pass_status must be one of: candidate, passed, failed', 400);
  }

  const predicates: string[] = [];
  const bindings: unknown[] = [];

  if (zipCode) {
    predicates.push('zip_code = ?');
    bindings.push(zipCode);
  }

  if (passStatus) {
    predicates.push('pass_status = ?');
    bindings.push(passStatus);
  }

  const where = predicates.length > 0 ? `WHERE ${predicates.join(' AND ')}` : '';
  const sql = `
    SELECT *
    FROM parcels
    ${where}
    ORDER BY updated_at DESC
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

parcels.get('/api/parcels/:parcel_id', async (c) => {
  const { parcel_id } = c.req.param();
  const row = await c.env.STORAGE_OPS.prepare('SELECT * FROM parcels WHERE parcel_id = ?')
    .bind(parcel_id)
    .first<Record<string, unknown>>();

  if (!row) {
    return c.json({ error: 'Parcel not found', parcel_id }, 404);
  }

  return c.json({
    item: {
      ...row,
      metadata: parseJsonField(row.metadata, {}),
    },
  });
});

parcels.post('/api/parcels', async (c) => {
  const body = await readJsonObject(c.req.raw);
  if (body instanceof Response) {
    return body;
  }

  const zipCode = typeof body.zip_code === 'string' ? body.zip_code : null;

  if (!zipCode) {
    return jsonError('zip_code is required');
  }

  if (!isZipCode(zipCode)) {
    return jsonError('zip_code must be a 5-digit ZIP code', 400);
  }

  if (typeof body.pass_status === 'string' && !isEnumValue(body.pass_status, PARCEL_PASS_STATUSES)) {
    return jsonError('pass_status must be one of: candidate, passed, failed', 400);
  }

  if (body.acreage !== undefined && body.acreage !== null && !isNonNegativeNumber(body.acreage)) {
    return jsonError('acreage must be a non-negative number', 400);
  }

  if (body.shape_score !== undefined && body.shape_score !== null && !isNonNegativeNumber(body.shape_score)) {
    return jsonError('shape_score must be a non-negative number', 400);
  }

  if (body.slope_score !== undefined && body.slope_score !== null && !isNonNegativeNumber(body.slope_score)) {
    return jsonError('slope_score must be a non-negative number', 400);
  }

  if (body.access_score !== undefined && body.access_score !== null && !isNonNegativeNumber(body.access_score)) {
    return jsonError('access_score must be a non-negative number', 400);
  }

  const parcelId = typeof body.parcel_id === 'string' ? body.parcel_id : uuid();
  const now = isoNow();

  await c.env.STORAGE_OPS.prepare(
    `
      INSERT INTO parcels (
        parcel_id, zip_code, apn, county_fips, address, city, state, acreage,
        zoning_code, flood_zone, shape_score, slope_score, access_score,
        pass_status, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      parcelId,
      zipCode,
      typeof body.apn === 'string' ? body.apn : null,
      typeof body.county_fips === 'string' ? body.county_fips : null,
      typeof body.address === 'string' ? body.address : null,
      typeof body.city === 'string' ? body.city : null,
      typeof body.state === 'string' ? body.state : null,
      typeof body.acreage === 'number' ? body.acreage : null,
      typeof body.zoning_code === 'string' ? body.zoning_code : null,
      typeof body.flood_zone === 'string' ? body.flood_zone : null,
      typeof body.shape_score === 'number' ? body.shape_score : null,
      typeof body.slope_score === 'number' ? body.slope_score : null,
      typeof body.access_score === 'number' ? body.access_score : null,
      typeof body.pass_status === 'string' ? body.pass_status : 'candidate',
      JSON.stringify(body.metadata ?? {}),
      now,
      now
    )
    .run();

  const item = await c.env.STORAGE_OPS.prepare('SELECT * FROM parcels WHERE parcel_id = ?')
    .bind(parcelId)
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
