#!/usr/bin/env python3
"""Build obsidian folder with all markdown files"""

import os
import shutil
from pathlib import Path

OBSIDIAN_DIR = Path("obsidian")
SOURCE_PATH = Path.cwd()

EXCLUDE_PATTERNS = {
    'node_modules', '.git', '__pycache__', '.pytest_cache', 'venv', 'env',
    '.venv', 'dist', 'build', '.next', '.cache', 'coverage',
    'bun.lockb', 'package-lock.json', '.DS_Store', 'obsidian-cli.exe',
    'obsidian'  # Don't include the obsidian folder itself
}

INCLUDE_EXTENSIONS = {
    '.py', '.js', '.jsx', '.ts', '.tsx', '.md', '.json', '.yaml', '.yml',
    '.toml', '.txt', '.sh', '.bash', '.sql', '.html', '.css'
}

def should_include(file_path):
    for part in file_path.parts:
        if part in EXCLUDE_PATTERNS:
            return False
    if file_path.suffix in INCLUDE_EXTENSIONS:
        return True
    if file_path.stem in {'README', 'LICENSE', 'Dockerfile', '.gitignore', '.cursorrules', 'requirements'}:
        return True
    return False

def main():
    print(f"Building obsidian folder...\n")

    # Clear existing obsidian folder
    if OBSIDIAN_DIR.exists():
        print("Clearing existing obsidian folder...")
        shutil.rmtree(OBSIDIAN_DIR)

    OBSIDIAN_DIR.mkdir(exist_ok=True)

    # Create index
    index_path = OBSIDIAN_DIR / "INDEX.md"
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(f"""# Storage Containers Project

## Overview

Site selection and analysis tool for storage container facilities.

**Repository:** https://github.com/djb258/site-scout-pro.git

## Project Structure

### Backend (`backend/`)
- **API Endpoints** - FastAPI routes for parcels, scoring, screening
- **Core Logic** - Parcel screening, saturation analysis, financial calculations
- **Database** - PostgreSQL schema, migrations, models
- **Services** - Census, DOT, U-Haul, rent data integrations
- **Schemas** - Pydantic models for validation

### Frontend (`src/`)
- **Pages** - Storage wizard, data ingestion, ZIP code maps
- **Components** - UI components, wizard steps
- **Services** - Edge relay, scoring service

### Key Documentation
- [[README]] - Main project documentation
- [[SITE_SELECTION_CRITERIA]] - Site selection methodology
- [[backend/BACKEND_ONLY_MODE]] - Backend-only development guide
- [[imo_creator/README]] - IMO creator documentation

## Search

Use Obsidian's search (Ctrl+Shift+F) to find code and documentation across the entire project.

---
*Auto-generated project index*
""")
    print(f"[OK] {index_path}")

    # Collect and process files
    synced = 0
    for root, dirs, filenames in os.walk(SOURCE_PATH):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_PATTERNS]

        for filename in filenames:
            filepath = Path(root) / filename
            if should_include(filepath):
                rel_path = filepath.relative_to(SOURCE_PATH)
                dest_path = OBSIDIAN_DIR / rel_path

                # Create destination directory
                dest_path.parent.mkdir(parents=True, exist_ok=True)

                try:
                    # Read source file
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()

                    # If already markdown, copy as-is, otherwise wrap in code block
                    if filepath.suffix == '.md':
                        with open(dest_path, 'w', encoding='utf-8') as f:
                            f.write(content)
                    else:
                        # Write as markdown note with code block
                        ext = filepath.suffix.lstrip('.') if filepath.suffix else 'txt'
                        with open(dest_path.with_suffix('.md'), 'w', encoding='utf-8') as f:
                            f.write(f"""# {filepath.name}

**Path:** `{rel_path}`

```{ext}
{content}
```

---
""")
                    synced += 1
                    print(f"[OK] {rel_path}")

                except Exception as e:
                    print(f"[ERROR] {rel_path}: {str(e)[:50]}")

    print(f"\nDone! {synced} files in obsidian folder")
    print(f"\nYou can now open this folder in Obsidian:")
    print(f"  {OBSIDIAN_DIR.absolute()}")

if __name__ == "__main__":
    main()
