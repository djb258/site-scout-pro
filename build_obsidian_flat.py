#!/usr/bin/env python3
"""Build flat obsidian folder with all markdown files in one directory"""

import os
import shutil
from pathlib import Path

OBSIDIAN_DIR = Path("obsidian_flat")
SOURCE_PATH = Path.cwd()

EXCLUDE_PATTERNS = {
    'node_modules', '.git', '__pycache__', '.pytest_cache', 'venv', 'env',
    '.venv', 'dist', 'build', '.next', '.cache', 'coverage',
    'bun.lockb', 'package-lock.json', '.DS_Store', 'obsidian-cli.exe',
    'obsidian', 'obsidian_flat'
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

def sanitize_filename(rel_path):
    """Convert path to flat filename: backend/api/parcels.py -> backend_api_parcels.md"""
    return str(rel_path).replace('\\', '_').replace('/', '_').replace('.', '_') + '.md'

def main():
    print(f"Building flat obsidian folder...\n")

    # Clear existing folder
    if OBSIDIAN_DIR.exists():
        print("Clearing existing folder...")
        shutil.rmtree(OBSIDIAN_DIR)

    OBSIDIAN_DIR.mkdir(exist_ok=True)

    # Collect all files first to build TOC
    all_files = []
    for root, dirs, filenames in os.walk(SOURCE_PATH):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_PATTERNS]
        for filename in filenames:
            filepath = Path(root) / filename
            if should_include(filepath):
                rel_path = filepath.relative_to(SOURCE_PATH)
                all_files.append(rel_path)

    # Sort files
    all_files.sort()

    # Create index with TOC
    index_path = OBSIDIAN_DIR / "INDEX.md"
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(f"""# Storage Containers Project

**Repository:** https://github.com/djb258/site-scout-pro.git
**Total Files:** {len(all_files)}

## Table of Contents

### Backend Files
""")
        for rel_path in all_files:
            if str(rel_path).startswith('backend'):
                flat_name = sanitize_filename(rel_path)
                f.write(f"- [[{flat_name.replace('.md', '')}|{rel_path}]]\n")

        f.write("\n### Frontend Files\n")
        for rel_path in all_files:
            if str(rel_path).startswith('src'):
                flat_name = sanitize_filename(rel_path)
                f.write(f"- [[{flat_name.replace('.md', '')}|{rel_path}]]\n")

        f.write("\n### Database & Migrations\n")
        for rel_path in all_files:
            if str(rel_path).startswith('supabase') or 'migration' in str(rel_path).lower():
                flat_name = sanitize_filename(rel_path)
                f.write(f"- [[{flat_name.replace('.md', '')}|{rel_path}]]\n")

        f.write("\n### Documentation\n")
        for rel_path in all_files:
            if rel_path.suffix == '.md' and not any(str(rel_path).startswith(x) for x in ['backend', 'src', 'supabase', 'tests', 'imo_creator']):
                flat_name = sanitize_filename(rel_path)
                f.write(f"- [[{flat_name.replace('.md', '')}|{rel_path}]]\n")

        f.write("\n### Configuration\n")
        for rel_path in all_files:
            if any(x in str(rel_path) for x in ['config', '.json', '.yaml', '.toml']) and not str(rel_path).startswith(('backend', 'src', 'supabase')):
                flat_name = sanitize_filename(rel_path)
                f.write(f"- [[{flat_name.replace('.md', '')}|{rel_path}]]\n")

        f.write("\n### Tests\n")
        for rel_path in all_files:
            if 'test' in str(rel_path).lower():
                flat_name = sanitize_filename(rel_path)
                f.write(f"- [[{flat_name.replace('.md', '')}|{rel_path}]]\n")

        f.write("\n### Other Files\n")
        categorized = set()
        for rel_path in all_files:
            s = str(rel_path)
            if (s.startswith('backend') or s.startswith('src') or s.startswith('supabase') or
                'test' in s.lower() or 'config' in s or rel_path.suffix == '.md'):
                categorized.add(rel_path)

        for rel_path in all_files:
            if rel_path not in categorized:
                flat_name = sanitize_filename(rel_path)
                f.write(f"- [[{flat_name.replace('.md', '')}|{rel_path}]]\n")

        f.write("\n---\n*Auto-generated index with full table of contents*\n")

    print(f"[OK] {index_path}")

    # Process all files
    synced = 0
    for rel_path in all_files:
        filepath = SOURCE_PATH / rel_path
        flat_name = sanitize_filename(rel_path)
        dest_path = OBSIDIAN_DIR / flat_name

        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            # If already markdown, add header and content
            if filepath.suffix == '.md':
                with open(dest_path, 'w', encoding='utf-8') as f:
                    f.write(f"""# {filepath.name}

**Original Path:** `{rel_path}`
**Back to:** [[INDEX]]

---

{content}
""")
            else:
                # Write as markdown note with code block
                ext = filepath.suffix.lstrip('.') if filepath.suffix else 'txt'
                with open(dest_path, 'w', encoding='utf-8') as f:
                    f.write(f"""# {filepath.name}

**Original Path:** `{rel_path}`
**Back to:** [[INDEX]]

```{ext}
{content}
```

---
""")
            synced += 1
            print(f"[OK] {rel_path} -> {flat_name}")

        except Exception as e:
            print(f"[ERROR] {rel_path}: {str(e)[:50]}")

    print(f"\nDone! {synced} files in flat obsidian folder")
    print(f"All files are in: {OBSIDIAN_DIR.absolute()}")

if __name__ == "__main__":
    main()
