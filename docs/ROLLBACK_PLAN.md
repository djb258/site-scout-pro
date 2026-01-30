# Rollback Plan — Barton Storage System

## Conformance

| Field | Value |
|-------|-------|
| **Doctrine Version** | 1.4.0 |
| **CC Layer** | CC-02 |
| **Hub ID** | barton-storage |
| **Last Updated** | 2026-01-30 |

---

## 1. Purpose

This document defines the rollback procedures for the Barton Storage System hub. Rollback is required when:

- A deployment causes system instability
- Critical bugs are discovered in production
- Data integrity issues are detected
- Kill switch is activated

---

## 2. Rollback Triggers

| Trigger | Severity | Authority | Auto/Manual |
|---------|----------|-----------|-------------|
| Error rate > 10% | HIGH | CC-02 | Manual |
| API latency > 5s sustained | MEDIUM | CC-02 | Manual |
| Database connection failures | CRITICAL | CC-01 | Manual |
| Kill switch activated | CRITICAL | CC-01 | Manual |
| Data corruption detected | CRITICAL | CC-01 | Manual |
| Cost exceeds $100/day | HIGH | CC-01 | Manual |

---

## 3. Rollback Procedures

### 3.1 Application Rollback (Backend)

**Scope**: FastAPI backend, pipeline logic, API endpoints

```bash
# Step 1: Identify current deployment
git log --oneline -5

# Step 2: Identify last known good commit
git log --oneline --before="<date>" -5

# Step 3: Create rollback branch
git checkout -b rollback/<timestamp> <good-commit-hash>

# Step 4: Deploy rollback
# (Deployment method depends on hosting platform)

# Step 5: Verify rollback
curl -X GET https://<api-host>/health
```

**Verification Checklist**:
- [ ] Health endpoint returns `{"status": "healthy"}`
- [ ] Database connection pool active
- [ ] No error spikes in logs
- [ ] API latency within acceptable range

---

### 3.2 Database Rollback (Neon PostgreSQL)

**Scope**: Schema changes, data migrations

```sql
-- Step 1: Identify migration to rollback
SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 5;

-- Step 2: Restore from point-in-time (Neon feature)
-- Use Neon Console → Branches → Restore to timestamp

-- Step 3: Verify data integrity
SELECT COUNT(*) FROM sovereign_ids;
SELECT COUNT(*) FROM pass0_signals;
-- (verify counts match expected values)
```

**Neon Branch Restore**:
1. Navigate to Neon Console
2. Select `barton-storage` project
3. Go to Branches → Main
4. Click "Restore" → Select timestamp before incident
5. Confirm restore operation

**Verification Checklist**:
- [ ] Table counts match pre-incident values
- [ ] No orphan records
- [ ] Foreign key constraints valid
- [ ] Indexes intact

---

### 3.3 Configuration Rollback (Doppler)

**Scope**: Environment variables, secrets, API keys

```bash
# Step 1: List config versions
doppler configs logs --project barton-storage --config dev

# Step 2: Rollback to previous version
doppler configs rollback --project barton-storage --config dev --version <version>

# Step 3: Restart application to pick up new config
# (restart method depends on hosting)

# Step 4: Verify config
doppler run -- python -c "import os; print(os.environ.get('NEON_DATABASE_URL', 'NOT SET')[:20])"
```

**Verification Checklist**:
- [ ] All required env vars present
- [ ] Database connection succeeds
- [ ] External API keys valid

---

### 3.4 Frontend Rollback (React/Vite)

**Scope**: UI components, pages, client-side logic

```bash
# Step 1: Identify last good build
git log --oneline src/ui -5

# Step 2: Checkout last good version
git checkout <good-commit-hash> -- src/ui

# Step 3: Rebuild
npm run build

# Step 4: Deploy static assets
# (deployment method depends on hosting)
```

**Verification Checklist**:
- [ ] Build completes without errors
- [ ] No console errors in browser
- [ ] API calls succeed from UI

---

## 4. Rollback Decision Matrix

| Scenario | Rollback Type | Time to Rollback | Approver |
|----------|---------------|------------------|----------|
| API errors spike | Application | < 15 min | CC-02 |
| Database corruption | Database + App | < 30 min | CC-01 |
| Config misconfiguration | Configuration | < 5 min | CC-02 |
| UI broken | Frontend | < 10 min | CC-02 |
| Full system failure | All components | < 1 hour | CC-01 |

---

## 5. Communication Protocol

### During Rollback

1. **Notify stakeholders** via designated channel
2. **Update status page** (if applicable)
3. **Log incident** in master_failure_log table

```sql
INSERT INTO master_failure_log (
    hub_id, error_type, error_message, context_data, created_at
) VALUES (
    'barton-storage',
    'ROLLBACK_INITIATED',
    'Rollback triggered due to <reason>',
    '{"trigger": "<trigger>", "approver": "<approver>", "target_version": "<version>"}',
    NOW()
);
```

### After Rollback

1. **Verify system stability** (15 min observation)
2. **Update incident log** with resolution
3. **Schedule post-mortem** within 48 hours
4. **Create ADR** if rollback reveals architectural issue

---

## 6. Rollback Testing Schedule

| Test Type | Frequency | Last Tested | Next Due |
|-----------|-----------|-------------|----------|
| Application rollback | Quarterly | — | — |
| Database restore | Quarterly | — | — |
| Config rollback | Monthly | — | — |
| Full system rollback | Annually | — | — |

**Testing Procedure**:
1. Create test branch from main
2. Deploy to staging environment
3. Introduce controlled failure
4. Execute rollback procedure
5. Verify recovery
6. Document results

---

## 7. Emergency Contacts

| Role | Contact | Authority |
|------|---------|-----------|
| Sovereign (CC-01) | barton-family-office | Full rollback authority |
| Hub Owner (CC-02) | — | Application/Config rollback |
| DBA | — | Database rollback |

---

## 8. Related Documents

| Document | Purpose |
|----------|---------|
| IMO_CONTROL.json | Kill switch configuration |
| PRD_BARTON_STORAGE_HUB.md | Failure modes (§12) |
| ADR-013-master-failure-log.md | Error logging architecture |

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-01-30 |
| Last Modified | 2026-01-30 |
| Version | 1.0.0 |
| Status | ACTIVE |
| Authority | CC-02 |
