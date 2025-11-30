# Neon PostgreSQL - Quick Start Guide

## Connection Information

**Connection String:**
```
postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Database**: neondb
**Region**: us-east-2 (AWS)
**SSL**: Required

## Schema Status

**All objects created successfully:**
- 7 tables (runs, zip_results, stage_log, zoning_cache, api_cache, pricing_data, traffic_data)
- 14 performance indexes
- 4 views (v_tier1, v_tier2, v_kill_summary, v_run_progress)
- 7 functions (start_run, complete_run, kill_zip, update_zip_metrics, log_stage, assign_tiers, update_updated_at)
- 2 triggers (auto-update timestamps)

## Files Created

### 1. create_neon_schema.py
Complete schema creation script. Creates all tables, indexes, views, functions, and triggers.

**Usage:**
```bash
python create_neon_schema.py
```

### 2. verify_neon_schema.py
Schema verification script. Validates all database objects and structure.

**Usage:**
```bash
python verify_neon_schema.py
```

### 3. neon_db_utils.py
Python utility library with helper functions for common database operations.

**Usage as library:**
```python
from neon_db_utils import NeonDB

# Use as context manager
with NeonDB() as db:
    # Start a new run
    run_id = db.start_run(['TX', 'FL'], {'min_pop': 50000}, 'john.doe')

    # Update ZIP metrics
    db.update_zip_metrics(run_id, '75001', 1, {'population': 65000})

    # Kill a ZIP
    db.kill_zip(run_id, '75002', 2, 'population', 'Too small', 50000, 45000)

    # Log stage completion
    db.log_stage(run_id, 1, 1500, 1200)

    # Assign tiers
    db.assign_tiers(run_id, 20, 30)

    # Complete the run
    db.complete_run(run_id)

    # Get results
    tier1 = db.get_tier1_zips(run_id)
    kill_summary = db.get_kill_summary(run_id)
```

**Usage as CLI:**
```bash
# List all runs
python neon_db_utils.py list_runs

# List running runs
python neon_db_utils.py list_runs running

# Get run details
python neon_db_utils.py get_run <run_id>

# Get run progress
python neon_db_utils.py get_progress <run_id>

# Get Tier 1 ZIPs
python neon_db_utils.py get_tier1 <run_id>

# Get Tier 2 ZIPs
python neon_db_utils.py get_tier2 <run_id>

# Get kill summary
python neon_db_utils.py get_kill_summary <run_id>

# Get stage logs
python neon_db_utils.py get_stage_logs <run_id>
```

## Common Operations

### Start a Screening Run

**SQL:**
```sql
SELECT start_run(
    ARRAY['TX', 'FL']::VARCHAR[],
    '{"min_population": 50000}'::JSONB,
    'john.doe'
);
```

**Python:**
```python
with NeonDB() as db:
    run_id = db.start_run(['TX', 'FL'], {'min_population': 50000}, 'john.doe')
    print(f"Started run: {run_id}")
```

### Update ZIP Metrics

**SQL:**
```sql
SELECT update_zip_metrics(
    '<run_id>'::UUID,
    '75001',
    1,
    '{"population": 65000, "median_income": 75000}'::JSONB
);
```

**Python:**
```python
with NeonDB() as db:
    db.update_zip_metrics(run_id, '75001', 1, {
        'population': 65000,
        'median_income': 75000
    })
```

### Kill a ZIP Code

**SQL:**
```sql
SELECT kill_zip(
    '<run_id>'::UUID,
    '75001',
    2,
    'population',
    'Population below minimum threshold',
    50000,
    45000
);
```

**Python:**
```python
with NeonDB() as db:
    db.kill_zip(
        run_id, '75001', 2, 'population',
        'Population below minimum threshold',
        50000, 45000
    )
```

### Log Stage Completion

**SQL:**
```sql
SELECT log_stage(
    '<run_id>'::UUID,
    1,
    1500,  -- ZIPs input
    1200   -- ZIPs output
);
```

**Python:**
```python
with NeonDB() as db:
    db.log_stage(run_id, 1, 1500, 1200)
```

### Assign Final Tiers

**SQL:**
```sql
SELECT assign_tiers(
    '<run_id>'::UUID,
    20,  -- Tier 1 count
    30   -- Tier 2 count
);
```

**Python:**
```python
with NeonDB() as db:
    db.assign_tiers(run_id, 20, 30)
```

### Complete a Run

**SQL:**
```sql
SELECT complete_run('<run_id>'::UUID);
```

**Python:**
```python
with NeonDB() as db:
    db.complete_run(run_id)
```

## Querying Results

### Get Tier 1 Results

**SQL:**
```sql
SELECT * FROM v_tier1
WHERE run_id = '<run_id>'::UUID
ORDER BY rank;
```

**Python:**
```python
with NeonDB() as db:
    tier1 = db.get_tier1_zips(run_id)
    for result in tier1:
        print(f"{result['rank']}. {result['zip']} - Score: {result['final_score']}")
```

### Get Kill Summary

**SQL:**
```sql
SELECT * FROM v_kill_summary
WHERE run_id = '<run_id>'::UUID;
```

**Python:**
```python
with NeonDB() as db:
    summary = db.get_kill_summary(run_id)
    for item in summary:
        print(f"Stage {item['kill_stage']}/{item['kill_step']}: {item['kill_count']} killed")
```

### Get Run Progress

**SQL:**
```sql
SELECT * FROM v_run_progress
WHERE run_id = '<run_id>'::UUID;
```

**Python:**
```python
with NeonDB() as db:
    progress = db.get_run_progress(run_id)
    print(f"Status: {progress[0]['status']}")
    print(f"Stage: {progress[0]['current_stage']}")
    print(f"Surviving: {progress[0]['surviving_zips']}/{progress[0]['total_zips']}")
```

### Get Stage Logs

**SQL:**
```sql
SELECT * FROM stage_log
WHERE run_id = '<run_id>'::UUID
ORDER BY stage;
```

**Python:**
```python
with NeonDB() as db:
    logs = db.get_stage_logs(run_id)
    for log in logs:
        print(f"Stage {log['stage']}: {log['zips_input']} -> {log['zips_output']} ({log['zips_killed']} killed)")
```

## Important Notes

### 1. Missing zips_master Table
The `start_run()` function requires a `zips_master` table with columns:
- `zip` VARCHAR(5)
- `state` VARCHAR(2)

This table must be created and populated before running the screener.

### 2. JSONB Fields
All JSONB fields automatically merge new data with existing data:
```python
# First update
db.update_zip_metrics(run_id, '75001', 1, {'population': 65000})

# Second update - merges with previous
db.update_zip_metrics(run_id, '75001', 2, {'income': 75000})

# Result: {'population': 65000, 'income': 75000}
```

### 3. Timestamp Fields
- `created_at`: Set automatically on INSERT
- `updated_at`: Updated automatically via trigger on UPDATE
- All timestamps are UTC

### 4. Transaction Safety
- All operations use AUTOCOMMIT mode
- Foreign keys enforce referential integrity
- Unique constraint on (run_id, zip) in zip_results

## Workflow Example

Complete workflow for a screening run:

```python
from neon_db_utils import NeonDB

with NeonDB() as db:
    # 1. Start the run
    run_id = db.start_run(['TX', 'FL'], {
        'min_population': 50000,
        'max_competition': 5
    }, 'john.doe')

    print(f"Started run: {run_id}")

    # 2. Get all ZIPs to process
    zips = db.get_surviving_zips(run_id)

    # 3. Stage 1: Population check
    stage1_input = len(zips)
    for zip_data in zips:
        # Fetch population data
        population = get_population(zip_data['zip'])  # Your function

        # Update metrics
        db.update_zip_metrics(run_id, zip_data['zip'], 1, {
            'population': population
        })

        # Check threshold
        if population < 50000:
            db.kill_zip(run_id, zip_data['zip'], 1, 'population',
                       'Below minimum', 50000, population)

    # Log stage 1
    surviving = db.get_surviving_zips(run_id)
    db.log_stage(run_id, 1, stage1_input, len(surviving))

    # 4. Stage 2: Competition check
    stage2_input = len(surviving)
    for zip_data in surviving:
        # Fetch competition data
        competitors = count_competitors(zip_data['zip'])  # Your function

        # Update metrics
        db.update_zip_metrics(run_id, zip_data['zip'], 2, {
            'competitors': competitors
        })

        # Check threshold
        if competitors > 5:
            db.kill_zip(run_id, zip_data['zip'], 2, 'competition',
                       'Too many competitors', 5, competitors)

    # Log stage 2
    surviving = db.get_surviving_zips(run_id)
    db.log_stage(run_id, 2, stage2_input, len(surviving))

    # 5. Calculate final scores
    for zip_data in surviving:
        result = db.get_zip_result(run_id, zip_data['zip'])
        metrics = result['metrics']

        # Calculate score
        score = calculate_score(metrics)  # Your function

        # Update with score
        db.update_zip_metrics(run_id, zip_data['zip'], 99, {
            'final_score': score
        })

    # 6. Assign tiers
    db.assign_tiers(run_id, 20, 30)

    # 7. Complete run
    db.complete_run(run_id)

    # 8. Get results
    tier1 = db.get_tier1_zips(run_id)
    tier2 = db.get_tier2_zips(run_id)
    kill_summary = db.get_kill_summary(run_id)

    print(f"\nResults:")
    print(f"Tier 1: {len(tier1)} ZIPs")
    print(f"Tier 2: {len(tier2)} ZIPs")
    print(f"\nKill Summary:")
    for item in kill_summary:
        print(f"  Stage {item['kill_stage']}/{item['kill_step']}: {item['kill_count']} killed")
```

## Troubleshooting

### Connection Issues
```python
# Test connection
import psycopg2
conn = psycopg2.connect("postgresql://...")
print("Connected successfully!")
conn.close()
```

### Verify Schema
```bash
python verify_neon_schema.py
```

### Check Run Status
```python
with NeonDB() as db:
    progress = db.get_run_progress(run_id)
    print(progress)
```

### View Error Messages
```sql
SELECT run_id, error_message, status
FROM runs
WHERE error_message IS NOT NULL;
```

## Next Steps

1. Create/import the `zips_master` table
2. Integrate with your ZIP screening logic
3. Add custom metrics calculation
4. Set up automated reporting
5. Configure backup/monitoring

## Support Files

All database utilities are in:
```
C:\Users\CUSTOM PC\Desktop\Cursor Builds\storage container go-nogo\
├── create_neon_schema.py       # Schema creation
├── verify_neon_schema.py       # Schema verification
├── neon_db_utils.py            # Python utilities
├── NEON_SCHEMA_SUMMARY.md      # Detailed documentation
└── NEON_QUICK_START.md         # This file
```
