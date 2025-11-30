"""
Backend utilities module.

Includes:
- schema_helper: Auto-documentation for database tables and columns

STANDING ORDER: When creating new tables or columns, use the schema_helper
functions to automatically document them in the data dictionary.

Example:
    from backend.utils import create_documented_table, add_documented_column

    # Create a new documented table
    create_documented_table(
        table_name="my_table",
        table_info={...},
        columns=[...]
    )

    # Add a column to existing table
    add_documented_column(
        table_name="existing_table",
        column_name="new_column",
        sql_type="VARCHAR(100)",
        display_name="New Column",
        description="What this column stores"
    )
"""

from backend.utils.schema_helper import (
    document_table,
    document_column,
    create_documented_table,
    add_documented_column,
    get_table_documentation,
    print_table_documentation,
    export_data_dictionary_json,
    register_table_abbreviation,
)

__all__ = [
    "document_table",
    "document_column",
    "create_documented_table",
    "add_documented_column",
    "get_table_documentation",
    "print_table_documentation",
    "export_data_dictionary_json",
    "register_table_abbreviation",
]
