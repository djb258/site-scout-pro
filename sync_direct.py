#!/usr/bin/env python3
"""Direct file sync to Obsidian vault"""

import os
import shutil
from pathlib import Path

VAULT_PATH = Path(r"C:\Users\CUSTOM PC\Documents\Obsidian Vault\Git Hub Repos\storage containers")
SOURCE_PATH = Path.cwd()

EXCLUDE_PATTERNS = {
    'node_modules', '.git', '__pycache__', '.pytest_cache', 'venv', 'env',
    '.venv', 'dist', 'build', '.next', '.cache', 'coverage',
    'bun.lockb', 'package-lock.json', '.DS_Store', 'obsidian-cli.exe'
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
    print(f"Source: {SOURCE_PATH}")
    print(f"Vault: {VAULT_PATH}\n")

    # Clear existing vault folder
    if VAULT_PATH.exists():
        print("Clearing existing folder...")
        shutil.rmtree(VAULT_PATH)

    VAULT_PATH.mkdir(parents=True, exist_ok=True)

    # Create index
    index_path = VAULT_PATH / "INDEX.md"
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(f"""# Storage Containers

## Repository Sync

Location: `{SOURCE_PATH}`
GitHub: https://github.com/djb258/site-scout-pro.git

## Files

This project has been synced to Obsidian for easy searching.

---
""")
    print(f"[OK] {index_path}")

    # Collect and copy files
    synced = 0
    for root, dirs, filenames in os.walk(SOURCE_PATH):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_PATTERNS]

        for filename in filenames:
            filepath = Path(root) / filename
            if should_include(filepath):
                rel_path = filepath.relative_to(SOURCE_PATH)
                dest_path = VAULT_PATH / rel_path

                # Create destination directory
                dest_path.parent.mkdir(parents=True, exist_ok=True)

                try:
                    # Read source file
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()

                    # Write as markdown note with code block
                    ext = filepath.suffix.lstrip('.')
                    with open(dest_path.with_suffix('.md'), 'w', encoding='utf-8') as f:
                        f.write(f"""# {filepath.name}

**File:** `{rel_path}`
**Project:** [[INDEX|Storage Containers]]

```{ext}
{content}
```

---
*Synced from repository*
""")
                    synced += 1
                    print(f"[OK] {rel_path}")

                except Exception as e:
                    print(f"[ERROR] {rel_path}: {str(e)[:50]}")

    print(f"\nDone! {synced} files synced to Obsidian")
    print(f"Location: {VAULT_PATH}")

if __name__ == "__main__":
    main()
