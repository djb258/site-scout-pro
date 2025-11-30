# Neon PostgreSQL Schema - ZIP Code Screener System

## Connection Details
- **Database**: Neon PostgreSQL
- **Endpoint**: `ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech`
- **Database Name**: `neondb`
- **Region**: us-east-2 (AWS)
- **Connection String**: Available in environment variables

## Schema Creation Status

### Tables Created: 7

1. **runs** - Stores screening run metadata
   - Primary key: `run_id` (UUID)
   - Tracks: target states, configuration, status, progress, completion
   - Fields: run_id, created_at, created_by, target_states, config, status, current_stage, total_zips, surviving_zips, completed_at, error_message

2. **zip_results** - Individual ZIP code results for each run
   - Primary key: `id` (SERIAL)
   - Foreign key: `run_id` -> `runs.run_id`
   - Unique constraint: (run_id, zip)
   - Fields: id, run_id, zip, stage_reached, killed, kill_stage, kill_step, kill_reason, kill_threshold, kill_value, metrics, scores, final_score, tier, rank, created_at, updated_at

3. **stage_log** - Logging for each stage execution
   - Primary key: `id` (SERIAL)
   - Foreign key: `run_id` -> `runs.run_id`
   - Fields: id, run_id, stage, started_at, completed_at, zips_input, zips_output, zips_killed, status, error_message

4. **zoning_cache** - Cached zoning research data by county
   - Primary key: `county_fips` (VARCHAR(5))
   - Fields: county_fips, state, county_name, storage_allowed, moratorium, conditional_notes, source_url, notes, researched_by, researched_at, created_at, updated_at

5. **api_cache** - Generic API response caching
   - Primary key: `cache_key` (VARCHAR(255))
   - Fields: cache_key, endpoint, request_params, response, fetched_at, expires_at

6. **pricing_data** - Storage facility pricing research
   - Primary key: `id` (SERIAL)
   - Fields: id, zip, facility_name, facility_address, unit_size, monthly_rent, source, researched_by, researched_at, created_at

7. **traffic_data** - Traffic count and accessibility research
   - Primary key: `id` (SERIAL)
   - Fields: id, zip, road_name, aadt, aadt_year, visibility_ok, turn_count, source, notes, researched_by, researched_at, created_at

### Indexes Created: 14

**Performance Indexes:**
- `idx_runs_status` - On runs(status)
- `idx_runs_created` - On runs(created_at DESC)
- `idx_zip_results_run` - On zip_results(run_id)
- `idx_zip_results_zip` - On zip_results(zip)
- `idx_zip_results_run_tier` - On zip_results(run_id, tier) WHERE tier IS NOT NULL
- `idx_zip_results_run_killed` - On zip_results(run_id, killed)
- `idx_zip_results_run_stage` - On zip_results(run_id, stage_reached)
- `idx_stage_log_run` - On stage_log(run_id)
- `idx_zoning_state` - On zoning_cache(state)
- `idx_zoning_allowed` - On zoning_cache(storage_allowed)
- `idx_api_cache_endpoint` - On api_cache(endpoint)
- `idx_api_cache_expires` - On api_cache(expires_at)
- `idx_pricing_zip` - On pricing_data(zip)
- `idx_traffic_zip` - On traffic_data(zip)

### Views Created: 4

1. **v_tier1** - All Tier 1 results across all runs
   - Columns: run_id, zip, final_score, rank, metrics, scores, run_date
   - Ordered by: run_date DESC, rank ASC

2. **v_tier2** - All Tier 2 results across all runs
   - Columns: run_id, zip, final_score, rank, metrics, scores, run_date
   - Ordered by: run_date DESC, rank ASC

3. **v_kill_summary** - Aggregated kill statistics by run/stage/step
   - Columns: run_id, kill_stage, kill_step, kill_count, avg_kill_value
   - Groups by: run_id, kill_stage, kill_step

4. **v_run_progress** - Run progress and statistics dashboard
   - Columns: run_id, target_states, status, current_stage, total_zips, surviving_zips, created_at, completed_at, runtime_minutes, tier1_count, tier2_count
   - Includes: Calculated runtime and tier counts

### Functions Created: 7

1. **update_updated_at()** - Trigger function for automatic timestamp updates
   - Type: Trigger function
   - Returns: TRIGGER
   - Updates: `updated_at` column to NOW()

2. **start_run(p_target_states, p_config, p_created_by)** - Initialize new screening run
   - Parameters:
     - `p_target_states` VARCHAR[] - Array of state codes
     - `p_config` JSONB - Configuration object
     - `p_created_by` VARCHAR (default: 'system') - User identifier
   - Returns: UUID (run_id)
   - Actions:
     - Creates new run record
     - Populates zip_results with all ZIPs from target states
     - Returns run_id for subsequent operations

3. **complete_run(p_run_id)** - Mark run as complete
   - Parameters:
     - `p_run_id` UUID - Run identifier
   - Returns: VOID
   - Actions:
     - Sets status to 'complete'
     - Sets completed_at timestamp
     - Updates surviving_zips count

4. **log_stage(p_run_id, p_stage, p_zips_input, p_zips_output)** - Log stage completion
   - Parameters:
     - `p_run_id` UUID - Run identifier
     - `p_stage` INT - Stage number
     - `p_zips_input` INT - ZIPs entering stage
     - `p_zips_output` INT - ZIPs surviving stage
   - Returns: VOID
   - Actions:
     - Creates stage_log entry
     - Calculates zips_killed
     - Updates current_stage in runs table

5. **kill_zip(p_run_id, p_zip, p_stage, p_step, p_reason, p_threshold, p_value)** - Eliminate a ZIP code
   - Parameters:
     - `p_run_id` UUID - Run identifier
     - `p_zip` VARCHAR(5) - ZIP code
     - `p_stage` INT - Stage number where killed
     - `p_step` VARCHAR(20) - Step identifier
     - `p_reason` TEXT - Reason description
     - `p_threshold` DECIMAL - Threshold value
     - `p_value` DECIMAL - Actual value that triggered kill
   - Returns: VOID
   - Actions:
     - Sets killed = TRUE
     - Records all kill metadata
     - Updates stage_reached

6. **update_zip_metrics(p_run_id, p_zip, p_stage, p_new_metrics)** - Update ZIP metrics
   - Parameters:
     - `p_run_id` UUID - Run identifier
     - `p_zip` VARCHAR(5) - ZIP code
     - `p_stage` INT - Current stage number
     - `p_new_metrics` JSONB - New metrics to merge
   - Returns: VOID
   - Actions:
     - Merges new metrics into existing metrics JSONB
     - Updates stage_reached
     - Only updates non-killed ZIPs

7. **assign_tiers(p_run_id, p_tier1_count, p_tier2_count)** - Assign final tier rankings
   - Parameters:
     - `p_run_id` UUID - Run identifier
     - `p_tier1_count` INT (default: 20) - Number of Tier 1 ZIPs
     - `p_tier2_count` INT (default: 30) - Number of Tier 2 ZIPs
   - Returns: VOID
   - Actions:
     - Clears existing tier/rank assignments
     - Assigns Tier 1 to top N by final_score
     - Assigns Tier 2 to next N by final_score
     - Sets rank within each tier

### Triggers Created: 2

1. **trigger_zip_results_updated**
   - Table: zip_results
   - Event: BEFORE UPDATE
   - Function: update_updated_at()
   - Purpose: Auto-update updated_at timestamp

2. **trigger_zoning_cache_updated**
   - Table: zoning_cache
   - Event: BEFORE UPDATE
   - Function: update_updated_at()
   - Purpose: Auto-update updated_at timestamp

## Database Inventory

### Total Objects
- **Tables**: 8 (including 1 pre-existing: marketing_company_error_log)
- **Views**: 4
- **Functions**: 7
- **Indexes**: 23 (including primary keys and unique constraints)
- **Triggers**: 2
- **Foreign Keys**: 2

## Important Notes

### Missing Table
- **zips_master** table not found - This table is required for the `start_run()` function to work
- The function expects this table with columns: `zip`, `state`
- Must be created or imported before running the screening system

### JSONB Fields
The schema uses JSONB for flexible storage:
- `runs.config` - Stores run configuration parameters
- `zip_results.metrics` - Stores all calculated metrics per ZIP
- `zip_results.scores` - Stores intermediate scoring values
- `api_cache.request_params` - Stores API request parameters
- `api_cache.response` - Stores API response data

### Array Fields
- `runs.target_states` - VARCHAR[] array of state codes (e.g., ['TX', 'FL', 'CA'])

## Usage Examples

### Start a New Run
```sql
SELECT start_run(
    ARRAY['TX', 'FL']::VARCHAR[],
    '{"min_population": 50000, "max_competition": 5}'::JSONB,
    'john.doe'
);
-- Returns: UUID of new run
```

### Update ZIP Metrics During Processing
```sql
SELECT update_zip_metrics(
    '123e4567-e89b-12d3-a456-426614174000'::UUID,
    '75001',
    1,
    '{"population": 65000, "median_income": 75000}'::JSONB
);
```

### Kill a ZIP Code
```sql
SELECT kill_zip(
    '123e4567-e89b-12d3-a456-426614174000'::UUID,
    '75001',
    2,
    'population',
    'Population below minimum',
    50000,
    45000
);
```

### Log Stage Completion
```sql
SELECT log_stage(
    '123e4567-e89b-12d3-a456-426614174000'::UUID,
    1,
    1500,
    1200
);
```

### Assign Final Tiers
```sql
SELECT assign_tiers(
    '123e4567-e89b-12d3-a456-426614174000'::UUID,
    20,  -- Top 20 as Tier 1
    30   -- Next 30 as Tier 2
);
```

### Complete a Run
```sql
SELECT complete_run(
    '123e4567-e89b-12d3-a456-426614174000'::UUID
);
```

### Query Results
```sql
-- Get all Tier 1 results from latest run
SELECT * FROM v_tier1 LIMIT 20;

-- Get kill summary for a specific run
SELECT * FROM v_kill_summary
WHERE run_id = '123e4567-e89b-12d3-a456-426614174000'::UUID;

-- Get run progress
SELECT * FROM v_run_progress
WHERE status = 'running';
```

## Files Created

1. **C:\Users\CUSTOM PC\Desktop\Cursor Builds\storage container go-nogo\create_neon_schema.py**
   - Complete schema creation script
   - Creates all tables, indexes, views, functions, and triggers
   - Includes verification and reporting

2. **C:\Users\CUSTOM PC\Desktop\Cursor Builds\storage container go-nogo\verify_neon_schema.py**
   - Schema verification and validation script
   - Checks all database objects
   - Reports structure and statistics

3. **C:\Users\CUSTOM PC\Desktop\Cursor Builds\storage container go-nogo\NEON_SCHEMA_SUMMARY.md**
   - This documentation file
   - Complete reference for the database schema

## Next Steps

1. **Import zips_master table** - Required for start_run() function
2. **Configure application connection** - Use connection string in your application
3. **Test workflow** - Run a test screening cycle
4. **Set up monitoring** - Monitor view v_run_progress for active runs
5. **Populate cache tables** - Add initial zoning and pricing research data

## Security Notes

- Connection uses SSL (sslmode=require)
- Credentials should be stored in environment variables
- Connection pooling is enabled (pooler endpoint)
- All timestamps in UTC (no timezone)
- Foreign key constraints enforce referential integrity
