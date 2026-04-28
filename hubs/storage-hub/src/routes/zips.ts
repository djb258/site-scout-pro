import { Hono } from 'hono';
import type { Env } from '../types';
import { ZIP_PASS_STATUSES, isEnumValue, isZipCode, jsonError, normalizePagination } from '../lib/http';

export const zips = new Hono<{ Bindings: Env }>();

zips.get('/api/zips', async (c) => {
  const { limit, offset } = normalizePagination(c.req.query('limit'), c.req.query('offset'));
  const state = c.req.query('state');
  const passStatus = c.req.query('pass_status');

  const predicates: string[] = [];
  const bindings: unknown[] = [];

  if (state) {
    predicates.push('zs.state = ?');
    bindings.push(state.toUpperCase());
  }

  if (passStatus && !isEnumValue(passStatus, ZIP_PASS_STATUSES)) {
    return jsonError('pass_status must be one of: pending, passed, failed', 400);
  }

  if (passStatus) {
    predicates.push('zs.pass_status = ?');
    bindings.push(passStatus);
  }

  const where = predicates.length > 0 ? `WHERE ${predicates.join(' AND ')}` : '';
  const sql = `
    SELECT
      zs.zip_code,
      zs.state,
      zs.county_fips,
      zs.county_name,
      zs.population,
      zs.median_household_income,
      zs.market_score,
      zs.signal_score,
      zs.composite_score,
      zs.pass_status,
      zs.market_data_id,
      zs.facility_count,
      zs.created_at,
      zs.updated_at,
      md.storage_sqft_per_capita,
      md.occupancy_estimate,
      md.median_rent,
      md.traffic_score
    FROM zip_scores zs
    LEFT JOIN market_data md ON md.market_data_id = zs.market_data_id
    ${where}
    ORDER BY zs.composite_score DESC, zs.zip_code ASC
    LIMIT ? OFFSET ?
  `;

  const result = await c.env.STORAGE_OPS.prepare(sql)
    .bind(...bindings, limit, offset)
    .all<Record<string, unknown>>();

  return c.json({
    count: result.results.length,
    items: result.results,
    limit,
    offset,
  });
});

zips.get('/api/zips/:zip', async (c) => {
  const { zip } = c.req.param();

  if (!isZipCode(zip)) {
    return jsonError('zip must be a 5-digit ZIP code', 400);
  }

  const row = await c.env.STORAGE_OPS.prepare(
    `
      SELECT
        zs.*,
        md.storage_sqft_per_capita,
        md.occupancy_estimate,
        md.median_rent,
        md.traffic_score,
        md.source,
        md.as_of_date
      FROM zip_scores zs
      LEFT JOIN market_data md ON md.market_data_id = zs.market_data_id
      WHERE zs.zip_code = ?
    `
  )
    .bind(zip)
    .first<Record<string, unknown>>();

  if (!row) {
    return c.json({ error: 'ZIP not found', zip }, 404);
  }

  return c.json({ item: row });
});
