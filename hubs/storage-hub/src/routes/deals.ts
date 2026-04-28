import { Hono } from 'hono';
import type { DealRecord, Env } from '../types';
import {
  DEAL_STAGES,
  DEAL_STATUSES,
  PASS_RESULT_STATUSES,
  isDateOnly,
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

export const deals = new Hono<{ Bindings: Env }>();

deals.get('/api/deals', async (c) => {
  const { limit, offset } = normalizePagination(c.req.query('limit'), c.req.query('offset'));
  const status = c.req.query('status');
  const zipCode = c.req.query('zip');

  if (status && !isEnumValue(status, DEAL_STATUSES)) {
    return jsonError('status must be one of: new, active, under_contract, won, lost', 400);
  }

  if (zipCode && !isZipCode(zipCode)) {
    return jsonError('zip must be a 5-digit ZIP code', 400);
  }

  const predicates: string[] = [];
  const bindings: unknown[] = [];

  if (status) {
    predicates.push('dp.status = ?');
    bindings.push(status);
  }

  if (zipCode) {
    predicates.push('dp.zip_code = ?');
    bindings.push(zipCode);
  }

  const where = predicates.length > 0 ? `WHERE ${predicates.join(' AND ')}` : '';
  const sql = `
    SELECT
      dp.deal_id,
      dp.zip_code,
      dp.parcel_id,
      dp.facility_id,
      dp.title,
      dp.status,
      dp.stage,
      dp.priority,
      dp.owner,
      dp.target_close_date,
      dp.notes,
      dp.metadata,
      dp.created_at,
      dp.updated_at,
      pr.stage AS latest_stage,
      pr.status AS latest_status,
      pr.score AS latest_score,
      pr.run_id AS latest_run_id
    FROM deal_pipeline dp
    LEFT JOIN pass_results pr ON pr.deal_id = dp.deal_id
    ${where}
    ORDER BY dp.updated_at DESC
    LIMIT ? OFFSET ?
  `;

  const result = await c.env.STORAGE_OPS.prepare(sql)
    .bind(...bindings, limit, offset)
    .all<DealRecord & Record<string, unknown>>();

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

deals.get('/api/deals/:deal_id', async (c) => {
  const { deal_id } = c.req.param();

  const deal = await c.env.STORAGE_OPS.prepare('SELECT * FROM deal_pipeline WHERE deal_id = ?')
    .bind(deal_id)
    .first<Record<string, unknown>>();

  if (!deal) {
    return c.json({ error: 'Deal not found', deal_id }, 404);
  }

  const passResults = await c.env.STORAGE_OPS.prepare(
    `
      SELECT *
      FROM pass_results
      WHERE deal_id = ?
      ORDER BY evaluated_at DESC, stage ASC
    `
  )
    .bind(deal_id)
    .all<Record<string, unknown>>();

  return c.json({
    item: {
      ...deal,
      metadata: parseJsonField(deal.metadata, {}),
      pass_results: passResults.results.map((row) => ({
        ...row,
        metrics: parseJsonField(row.metrics, {}),
      })),
    },
  });
});

deals.post('/api/deals', async (c) => {
  const body = await readJsonObject(c.req.raw);
  if (body instanceof Response) {
    return body;
  }

  const zipCode = typeof body.zip_code === 'string' ? body.zip_code : null;
  const title = typeof body.title === 'string' ? body.title : null;

  if (!zipCode || !title) {
    return jsonError('zip_code and title are required');
  }

  if (!isZipCode(zipCode)) {
    return jsonError('zip_code must be a 5-digit ZIP code', 400);
  }

  if (typeof body.status === 'string' && !isEnumValue(body.status, DEAL_STATUSES)) {
    return jsonError('status must be one of: new, active, under_contract, won, lost', 400);
  }

  if (typeof body.stage === 'string' && !isEnumValue(body.stage, DEAL_STAGES)) {
    return jsonError('stage must be one of: pass0, pass1, pass2, pass3, closed', 400);
  }

  if (typeof body.target_close_date === 'string' && !isDateOnly(body.target_close_date)) {
    return jsonError('target_close_date must use YYYY-MM-DD format', 400);
  }

  if (body.score !== undefined && body.score !== null && !isNonNegativeNumber(body.score)) {
    return jsonError('score must be a non-negative number', 400);
  }

  if (
    typeof body.stage === 'string' &&
    typeof body.status === 'string' &&
    !isEnumValue(body.status, PASS_RESULT_STATUSES)
  ) {
    return jsonError('status must be one of: pending, passed, failed when creating pass_results', 400);
  }

  const dealId = typeof body.deal_id === 'string' ? body.deal_id : uuid();
  const now = isoNow();

  await c.env.STORAGE_OPS.prepare(
    `
      INSERT INTO deal_pipeline (
        deal_id, zip_code, parcel_id, facility_id, title, status, stage, priority,
        owner, target_close_date, notes, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      dealId,
      zipCode,
      typeof body.parcel_id === 'string' ? body.parcel_id : null,
      typeof body.facility_id === 'string' ? body.facility_id : null,
      title,
      typeof body.status === 'string' ? body.status : 'new',
      typeof body.stage === 'string' ? body.stage : 'pass0',
      typeof body.priority === 'string' ? body.priority : null,
      typeof body.owner === 'string' ? body.owner : null,
      typeof body.target_close_date === 'string' ? body.target_close_date : null,
      typeof body.notes === 'string' ? body.notes : null,
      JSON.stringify(body.metadata ?? {}),
      now,
      now
    )
    .run();

  if (typeof body.stage === 'string' && typeof body.status === 'string') {
    const passResultId = uuid();
    await c.env.STORAGE_OPS.prepare(
      `
        INSERT INTO pass_results (
          pass_result_id, deal_id, run_id, zip_code, stage, status, score, metrics, evaluated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
      .bind(
        passResultId,
        dealId,
        typeof body.run_id === 'string' ? body.run_id : null,
        zipCode,
        body.stage,
        body.status,
        typeof body.score === 'number' ? body.score : null,
        JSON.stringify(body.metrics ?? {}),
        now
      )
      .run();
  }

  const item = await c.env.STORAGE_OPS.prepare('SELECT * FROM deal_pipeline WHERE deal_id = ?')
    .bind(dealId)
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
