import psycopg2

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(CONNECTION_STRING)
cur = conn.cursor()

# Check if table exists and its columns
cur.execute("""
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'housing_pipeline'
    ORDER BY ordinal_position
""")

print("Existing housing_pipeline columns:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

# Drop and recreate
print("\nDropping and recreating table...")
cur.execute("DROP TABLE IF EXISTS housing_pipeline CASCADE")
conn.commit()

cur.execute("""
    CREATE TABLE housing_pipeline (
        id SERIAL PRIMARY KEY,
        jurisdiction_id VARCHAR(20) NOT NULL,
        permit_number VARCHAR(50) NOT NULL,
        permit_type VARCHAR(100),
        development_name VARCHAR(200),
        property_address TEXT,
        owner_name VARCHAR(200),
        estimated_value NUMERIC(12,2),
        issue_date DATE,
        report_month VARCHAR(20),
        unit_type VARCHAR(50),
        pipeline_status VARCHAR(20) DEFAULT 'GREEN',
        last_inspection_date DATE,
        last_inspection_type VARCHAR(100),
        days_since_activity INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(jurisdiction_id, permit_number)
    )
""")
conn.commit()

cur.execute("CREATE INDEX idx_housing_pipeline_jurisdiction ON housing_pipeline(jurisdiction_id)")
cur.execute("CREATE INDEX idx_housing_pipeline_development ON housing_pipeline(development_name)")
cur.execute("CREATE INDEX idx_housing_pipeline_status ON housing_pipeline(pipeline_status)")
conn.commit()

print("Table recreated successfully!")

cur.close()
conn.close()
