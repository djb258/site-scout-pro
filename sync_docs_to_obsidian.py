#!/usr/bin/env python3
"""Sync documentation markdown files to Obsidian vault"""

import shutil
from pathlib import Path

# Obsidian vault path (from sync_direct.py)
VAULT_PATH = Path(r"C:\Users\CUSTOM PC\Documents\Obsidian Vault\Git Hub Repos\storage containers")
SOURCE_PATH = Path.cwd()

# Documentation directories to sync
DOC_DIRS = [
    Path("."),  # Root directory
    Path("docs"),
    Path("backend"),
    Path("imo_creator"),
    Path("ctb"),
]

# Documentation files to sync (root level)
DOC_FILES = [
    "UI_UPDATE_PROMPT_LEASE_UP.md",
    "EMPTY_TABLES_REPORT.md",
    "PA_JURISDICTION_DATA_IMPORT.md",
    "STATE_JURISDICTION_DATA_SOURCES.md",
    "JURISDICTION_IMPORT_SUMMARY.md",
    "QUICK_START_PA_IMPORT.md",
    "DOPPLER_SETUP.md",
    "CURSOR_GLOBAL_AGENTS_SETUP.md",
    "QUICK_START_AGENTS.md",
    "CURSOR_BACKEND_ONLY_PROMPT.md",
    "NEON_QUICK_START.md",
    "NEON_SCHEMA_SUMMARY.md",
    "SCHEMA_DATA_DICTIONARY.md",
    "SITE_SELECTION_CRITERIA.md",
    "README.md",
]

def main():
    print("=" * 80)
    print("Syncing Documentation to Obsidian")
    print("=" * 80)
    print(f"Source: {SOURCE_PATH}")
    print(f"Vault: {VAULT_PATH}\n")

    # Ensure vault directory exists
    VAULT_PATH.mkdir(parents=True, exist_ok=True)
    
    # Create documentation subdirectory
    DOCS_VAULT_PATH = VAULT_PATH / "Documentation"
    DOCS_VAULT_PATH.mkdir(parents=True, exist_ok=True)

    synced_count = 0
    skipped_count = 0

    # Sync root-level documentation files
    print("\n[SYNC] Syncing root-level documentation files...")
    for doc_file in DOC_FILES:
        source_file = SOURCE_PATH / doc_file
        if source_file.exists():
            dest_file = DOCS_VAULT_PATH / doc_file
            try:
                shutil.copy2(source_file, dest_file)
                synced_count += 1
                print(f"  [OK] {doc_file}")
            except Exception as e:
                print(f"  [ERROR] {doc_file}: {str(e)[:50]}")
        else:
            skipped_count += 1
            print(f"  [SKIP] {doc_file} (not found)")

    # Sync markdown files from documentation directories
    print("\n[SYNC] Syncing markdown files from documentation directories...")
    for doc_dir in DOC_DIRS:
        source_dir = SOURCE_PATH / doc_dir
        if not source_dir.exists():
            continue

        # Find all .md files in this directory
        for md_file in source_dir.rglob("*.md"):
            # Skip if in excluded directories
            if any(part in md_file.parts for part in ['node_modules', '.git', '__pycache__', '.pytest_cache', 'venv', 'env', '.venv']):
                continue

            # Calculate relative path
            try:
                rel_path = md_file.relative_to(SOURCE_PATH)
            except ValueError:
                continue

            # Create destination path preserving directory structure
            dest_file = DOCS_VAULT_PATH / rel_path
            dest_file.parent.mkdir(parents=True, exist_ok=True)

            try:
                shutil.copy2(md_file, dest_file)
                synced_count += 1
                print(f"  [OK] {rel_path}")
            except Exception as e:
                print(f"  [ERROR] {rel_path}: {str(e)[:50]}")

    # Create index file
    index_path = DOCS_VAULT_PATH / "INDEX.md"
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(f"""# Documentation Index

## Storage Containers Go/No-Go - Documentation

This directory contains all documentation for the Storage Containers project.

**Repository:** `{SOURCE_PATH}`

## Documentation Files

### Recent Documentation
- [[UI_UPDATE_PROMPT_LEASE_UP]] - UI update prompt for lease-up logic
- [[EMPTY_TABLES_REPORT]] - Report on empty database tables
- [[PA_JURISDICTION_DATA_IMPORT]] - Pennsylvania jurisdiction data import guide
- [[STATE_JURISDICTION_DATA_SOURCES]] - State jurisdiction data sources catalog
- [[JURISDICTION_IMPORT_SUMMARY]] - Jurisdiction import summary
- [[QUICK_START_PA_IMPORT]] - Quick start guide for PA import

### Setup & Configuration
- [[DOPPLER_SETUP]] - Doppler CLI setup guide
- [[CURSOR_GLOBAL_AGENTS_SETUP]] - Cursor global agents setup
- [[QUICK_START_AGENTS]] - Quick start for agents
- [[CURSOR_BACKEND_ONLY_PROMPT]] - Backend-only mode documentation

### Database & Schema
- [[NEON_QUICK_START]] - Neon database quick start
- [[NEON_SCHEMA_SUMMARY]] - Neon schema summary
- [[SCHEMA_DATA_DICTIONARY]] - Schema data dictionary

### Project Documentation
- [[SITE_SELECTION_CRITERIA]] - Site selection criteria
- [[README]] - Project README

## Directory Structure

All documentation files are organized in subdirectories matching the repository structure.

---
*Last synced: {Path(__file__).stat().st_mtime}*
""")

    print(f"\n[OK] Index created: {index_path}")

    print("\n" + "=" * 80)
    print(f"[SUCCESS] Sync Complete!")
    print(f"   Synced: {synced_count} files")
    print(f"   Skipped: {skipped_count} files")
    print(f"   Location: {DOCS_VAULT_PATH}")
    print("=" * 80)

if __name__ == "__main__":
    main()

