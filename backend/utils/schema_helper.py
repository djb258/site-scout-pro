"""
Schema Helper - Auto-Documentation for Database Tables and Columns

STANDING ORDER: When creating new tables or columns, use these helper functions
to automatically document them in the data dictionary.

Usage Examples:
---------------

1. Document a new table:
   from backend.utils.schema_helper import document_table

   document_table(
       table_name="new_table",
       display_name="New Table",
       description="Description of what this table stores",
       purpose="Why this table exists",
       layer="Layer X - Category",
       data_source="Where the data comes from"
   )

2. Document a new column:
   from backend.utils.schema_helper import document_column

   document_column(
       table_name="existing_table",
       column_name="new_column",
       display_name="New Column",
       description="What this column stores",
       unit_of_measure="USD",  # Optional
       valid_values="1-100",   # Optional
       business_logic="How this is used"  # Optional
   )

3. Create a documented table (combines CREATE TABLE + documentation):
   from backend.utils.schema_helper import create_documented_table

   create_documented_table(
       table_name="my_table",
       table_info={
           "display_name": "My Table",
           "description": "...",
           "purpose": "...",
           "layer": "...",
           "data_source": "..."
       },
       columns=[
           {
               "name": "id",
               "sql_type": "SERIAL PRIMARY KEY",
               "display_name": "Record ID",
               "description": "Auto-incrementing unique identifier",
               "is_primary_key": True
           },
           {
               "name": "value",
               "sql_type": "DECIMAL(10,2)",
               "display_name": "Value",
               "description": "The numeric value",
               "unit_of_measure": "USD"
           }
       ]
   )
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any, List, Optional
from datetime import datetime

# Connection string - use environment variable or default
CONNECTION_STRING = os.environ.get(
    "NEON_CONNECTION_STRING",
    "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
)

# Table abbreviations for column IDs
TABLE_ABBREVIATIONS = {
    "target_zones": "TZ",
    "zone_zips": "ZZ",
    "layer_1_geography": "L1G",
    "layer_2_demographics": "L2D",
    "layer_3_counties": "L3C",
    "storage_facilities": "SF",
    "housing_communities": "HC",
    "demand_anchors": "DA",
    "county_scoring": "CS",
    "flood_zones": "FZ",
    "api_cache": "AC",
    "zips_master": "ZM",
    "data_dictionary": "DD",
    "table_dictionary": "TD",
}


def get_connection():
    """Get database connection."""
    return psycopg2.connect(CONNECTION_STRING)


def generate_column_id(table_name: str, column_name: str) -> str:
    """Generate a unique column ID in format: TBL_column_name."""
    abbrev = TABLE_ABBREVIATIONS.get(table_name, table_name[:3].upper())
    return f"{abbrev}_{column_name}"


def generate_table_id(table_name: str) -> str:
    """Generate a unique table ID in format: TBL_XX."""
    abbrev = TABLE_ABBREVIATIONS.get(table_name, table_name[:3].upper())
    return f"TBL_{abbrev}"


def register_table_abbreviation(table_name: str, abbreviation: str):
    """Register a new table abbreviation for column ID generation."""
    TABLE_ABBREVIATIONS[table_name] = abbreviation


def document_table(
    table_name: str,
    display_name: str,
    description: str,
    purpose: str,
    layer: str,
    data_source: str,
    refresh_frequency: str = "On demand",
    conn=None
) -> bool:
    """
    Document a table in the table_dictionary.

    Args:
        table_name: Database table name
        display_name: Human-readable name
        description: What the table stores
        purpose: Why the table exists
        layer: Which layer (e.g., "Layer 1 - Geography")
        data_source: Where data comes from
        refresh_frequency: How often data is updated
        conn: Optional existing connection

    Returns:
        True if successful
    """
    should_close = conn is None
    if conn is None:
        conn = get_connection()

    cursor = conn.cursor()
    table_id = generate_table_id(table_name)

    try:
        cursor.execute("""
            INSERT INTO table_dictionary
            (table_id, table_name, display_name, description, purpose, layer, data_source, refresh_frequency)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (table_name) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                description = EXCLUDED.description,
                purpose = EXCLUDED.purpose,
                layer = EXCLUDED.layer,
                data_source = EXCLUDED.data_source,
                refresh_frequency = EXCLUDED.refresh_frequency,
                updated_at = NOW()
        """, (table_id, table_name, display_name, description, purpose, layer, data_source, refresh_frequency))

        # Add PostgreSQL comment
        cursor.execute(f"COMMENT ON TABLE {table_name} IS %s", (description,))

        conn.commit()
        print(f"✓ Documented table: {table_name}")
        return True

    except Exception as e:
        print(f"✗ Error documenting table {table_name}: {e}")
        conn.rollback()
        return False
    finally:
        if should_close:
            conn.close()


def document_column(
    table_name: str,
    column_name: str,
    display_name: str,
    description: str,
    example_value: str = None,
    valid_values: str = None,
    source: str = None,
    business_logic: str = None,
    is_primary_key: bool = False,
    is_foreign_key: bool = False,
    references_table: str = None,
    references_column: str = None,
    format_pattern: str = None,
    unit_of_measure: str = None,
    conn=None
) -> bool:
    """
    Document a column in the data_dictionary.

    Args:
        table_name: Database table name
        column_name: Column name
        display_name: Human-readable name
        description: What the column stores
        example_value: Example data
        valid_values: Allowed values or range
        source: Data source (e.g., "Census ACS B01001")
        business_logic: How this column is used in analysis
        is_primary_key: Is this the PK?
        is_foreign_key: Is this an FK?
        references_table: FK target table
        references_column: FK target column
        format_pattern: Expected format (e.g., "#####" for ZIP)
        unit_of_measure: Unit (e.g., "USD", "miles", "percent")
        conn: Optional existing connection

    Returns:
        True if successful
    """
    should_close = conn is None
    if conn is None:
        conn = get_connection()

    cursor = conn.cursor()
    column_id = generate_column_id(table_name, column_name)

    try:
        # Get data type from database
        cursor.execute("""
            SELECT data_type
            FROM information_schema.columns
            WHERE table_name = %s AND column_name = %s
        """, (table_name, column_name))
        row = cursor.fetchone()
        data_type = row[0] if row else "unknown"

        cursor.execute("""
            INSERT INTO data_dictionary
            (column_id, table_name, column_name, data_type, display_name, description,
             example_value, valid_values, source, business_logic, is_primary_key,
             is_foreign_key, references_table, references_column, format_pattern, unit_of_measure)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (table_name, column_name) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                description = EXCLUDED.description,
                example_value = EXCLUDED.example_value,
                valid_values = EXCLUDED.valid_values,
                source = EXCLUDED.source,
                business_logic = EXCLUDED.business_logic,
                is_primary_key = EXCLUDED.is_primary_key,
                is_foreign_key = EXCLUDED.is_foreign_key,
                references_table = EXCLUDED.references_table,
                references_column = EXCLUDED.references_column,
                format_pattern = EXCLUDED.format_pattern,
                unit_of_measure = EXCLUDED.unit_of_measure,
                updated_at = NOW()
        """, (
            column_id, table_name, column_name, data_type, display_name, description,
            example_value, valid_values, source, business_logic, is_primary_key,
            is_foreign_key, references_table, references_column, format_pattern, unit_of_measure
        ))

        # Add PostgreSQL comment
        try:
            cursor.execute(f"COMMENT ON COLUMN {table_name}.{column_name} IS %s", (description,))
        except:
            pass  # Column might not exist yet

        conn.commit()
        print(f"   ✓ Documented column: {table_name}.{column_name}")
        return True

    except Exception as e:
        print(f"   ✗ Error documenting column {table_name}.{column_name}: {e}")
        conn.rollback()
        return False
    finally:
        if should_close:
            conn.close()


def create_documented_table(
    table_name: str,
    table_info: Dict[str, str],
    columns: List[Dict[str, Any]],
    abbreviation: str = None
) -> bool:
    """
    Create a new table AND document it in one operation.

    Args:
        table_name: Database table name
        table_info: Dictionary with table documentation:
            - display_name: Human-readable name
            - description: What the table stores
            - purpose: Why the table exists
            - layer: Which layer
            - data_source: Where data comes from
            - refresh_frequency: (optional) How often updated
        columns: List of column definitions, each with:
            - name: Column name
            - sql_type: SQL type (e.g., "VARCHAR(100)", "INT", "SERIAL PRIMARY KEY")
            - display_name: Human-readable name
            - description: What the column stores
            - (optional) unit_of_measure, valid_values, business_logic, etc.
        abbreviation: (optional) Table abbreviation for column IDs

    Returns:
        True if successful
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Register abbreviation if provided
    if abbreviation:
        register_table_abbreviation(table_name, abbreviation)

    try:
        # Build CREATE TABLE statement
        column_defs = []
        for col in columns:
            column_defs.append(f"{col['name']} {col['sql_type']}")

        create_sql = f"""
            CREATE TABLE IF NOT EXISTS {table_name} (
                {', '.join(column_defs)}
            )
        """

        print(f"\nCreating table: {table_name}")
        cursor.execute(create_sql)
        conn.commit()
        print(f"✓ Table {table_name} created")

        # Document the table
        document_table(
            table_name=table_name,
            display_name=table_info.get("display_name", table_name),
            description=table_info.get("description", ""),
            purpose=table_info.get("purpose", ""),
            layer=table_info.get("layer", "Custom"),
            data_source=table_info.get("data_source", ""),
            refresh_frequency=table_info.get("refresh_frequency", "On demand"),
            conn=conn
        )

        # Document each column
        for col in columns:
            document_column(
                table_name=table_name,
                column_name=col["name"],
                display_name=col.get("display_name", col["name"]),
                description=col.get("description", ""),
                example_value=col.get("example_value"),
                valid_values=col.get("valid_values"),
                source=col.get("source"),
                business_logic=col.get("business_logic"),
                is_primary_key=col.get("is_primary_key", False),
                is_foreign_key=col.get("is_foreign_key", False),
                references_table=col.get("references_table"),
                references_column=col.get("references_column"),
                format_pattern=col.get("format_pattern"),
                unit_of_measure=col.get("unit_of_measure"),
                conn=conn
            )

        return True

    except Exception as e:
        print(f"✗ Error creating table {table_name}: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def add_documented_column(
    table_name: str,
    column_name: str,
    sql_type: str,
    display_name: str,
    description: str,
    default_value: str = None,
    **kwargs
) -> bool:
    """
    Add a new column to an existing table AND document it.

    Args:
        table_name: Target table
        column_name: New column name
        sql_type: SQL type (e.g., "VARCHAR(100)", "INT")
        display_name: Human-readable name
        description: What the column stores
        default_value: Optional default value
        **kwargs: Additional documentation fields (unit_of_measure, valid_values, etc.)

    Returns:
        True if successful
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Build ALTER TABLE statement
        alter_sql = f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {column_name} {sql_type}"
        if default_value is not None:
            alter_sql += f" DEFAULT {default_value}"

        print(f"\nAdding column: {table_name}.{column_name}")
        cursor.execute(alter_sql)
        conn.commit()
        print(f"✓ Column {column_name} added to {table_name}")

        # Document the column
        document_column(
            table_name=table_name,
            column_name=column_name,
            display_name=display_name,
            description=description,
            conn=conn,
            **kwargs
        )

        return True

    except Exception as e:
        print(f"✗ Error adding column {table_name}.{column_name}: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def get_table_documentation(table_name: str) -> Dict[str, Any]:
    """Get documentation for a table and its columns."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Get table info
        cursor.execute("""
            SELECT * FROM table_dictionary WHERE table_name = %s
        """, (table_name,))
        table_info = cursor.fetchone()

        # Get column info
        cursor.execute("""
            SELECT * FROM data_dictionary WHERE table_name = %s ORDER BY column_name
        """, (table_name,))
        columns = cursor.fetchall()

        return {
            "table": dict(table_info) if table_info else None,
            "columns": [dict(c) for c in columns]
        }

    finally:
        conn.close()


def print_table_documentation(table_name: str):
    """Print formatted documentation for a table."""
    doc = get_table_documentation(table_name)

    if not doc["table"]:
        print(f"No documentation found for table: {table_name}")
        return

    t = doc["table"]
    print("\n" + "=" * 70)
    print(f"TABLE: {t['table_name']}")
    print(f"Display Name: {t['display_name']}")
    print(f"Layer: {t['layer']}")
    print(f"Description: {t['description']}")
    print(f"Purpose: {t['purpose']}")
    print(f"Data Source: {t['data_source']}")
    print("=" * 70)

    print(f"\n{'ID':<20} {'Column':<25} {'Type':<15} {'Description':<30}")
    print(f"{'-'*20} {'-'*25} {'-'*15} {'-'*30}")

    for c in doc["columns"]:
        pk = " [PK]" if c['is_primary_key'] else ""
        fk = " [FK]" if c['is_foreign_key'] else ""
        desc = (c['description'] or '')[:30]
        print(f"{c['column_id']:<20} {c['column_name']:<25} {c['data_type']:<15} {desc}{pk}{fk}")


def export_data_dictionary_json() -> str:
    """Export the entire data dictionary as JSON."""
    import json
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cursor.execute("SELECT * FROM table_dictionary ORDER BY layer, table_name")
        tables = cursor.fetchall()

        cursor.execute("SELECT * FROM data_dictionary ORDER BY table_name, column_name")
        columns = cursor.fetchall()

        result = {
            "generated_at": datetime.now().isoformat(),
            "tables": [dict(t) for t in tables],
            "columns": [dict(c) for c in columns]
        }

        return json.dumps(result, indent=2, default=str)

    finally:
        conn.close()


# Example usage when run directly
if __name__ == "__main__":
    print("Schema Helper - Example Usage")
    print("=" * 50)

    # Example: Document a table
    print("\n1. Documenting a table:")
    print_table_documentation("storage_facilities")

    # Example: Create a documented table (commented out to not actually create)
    print("\n2. Example of create_documented_table():")
    print("""
    create_documented_table(
        table_name="example_metrics",
        table_info={
            "display_name": "Example Metrics",
            "description": "Example metrics for demonstration",
            "purpose": "Show how to use the schema helper",
            "layer": "Custom",
            "data_source": "Manual entry"
        },
        columns=[
            {
                "name": "id",
                "sql_type": "SERIAL PRIMARY KEY",
                "display_name": "Record ID",
                "description": "Auto-incrementing unique identifier",
                "is_primary_key": True
            },
            {
                "name": "metric_value",
                "sql_type": "DECIMAL(10,2)",
                "display_name": "Metric Value",
                "description": "The measured value",
                "unit_of_measure": "USD",
                "valid_values": "0 to 1000000"
            }
        ],
        abbreviation="EM"
    )
    """)
