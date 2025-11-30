#!/usr/bin/env python3
"""Sync repository to Obsidian vault - Simple version"""

import os
import subprocess
import sys
from pathlib import Path
import tempfile

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

def create_note(note_path, content):
    """Create note by writing to temp file"""
    try:
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.md', encoding='utf-8') as f:
            f.write(content)
            temp_path = f.name

        result = subprocess.run(
            ['obsidian-cli', 'create', note_path],
            input=content.encode('utf-8'),
            capture_output=True,
            timeout=10
        )

        os.unlink(temp_path)

        if result.returncode == 0:
            print(f"[OK] {note_path}")
            return True
        else:
            print(f"[SKIP] {note_path}")
            return False
    except Exception as e:
        print(f"[ERROR] {note_path}: {str(e)[:50]}")
        return False

def main():
    project_name = "storage containers"  # Custom name for Obsidian
    project_root = Path.cwd()

    print(f"\nSyncing: {project_name}")
    print(f"Location: {project_root}\n")

    # Create index
    index_content = f"""# {project_name}

## Repository Sync

Location: `{project_root}`

## Files

This project has been synced to Obsidian for easy searching.

Use `obsidian-cli search-content "term"` to search.

"""

    print("Creating index...")
    create_note(f"Git Hub Repos/{project_name}/INDEX", index_content)

    #Collect files
    files = []
    for root, dirs, filenames in os.walk(project_root):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_PATTERNS]
        for filename in filenames:
            filepath = Path(root) / filename
            if should_include(filepath):
                files.append(filepath)

    print(f"\nSyncing {len(files)} files...\n")

    synced = 0
    for filepath in files:
        rel_path = filepath.relative_to(project_root)
        note_path = f"Git Hub Repos/{project_name}/{rel_path}"

        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            ext = filepath.suffix.lstrip('.')
            note_content = f"""# {filepath.name}

File: `{rel_path}`

```{ext}
{content}
```
"""

            if create_note(note_path, note_content):
                synced += 1

        except Exception as e:
            print(f"[ERROR] Reading {filepath}: {str(e)[:50]}")

    print(f"\nDone! {synced}/{len(files)} files synced")
    print(f"\nOpen: obsidian-cli open 'Git Hub Repos/{project_name}/INDEX'")
    print(f"Search: obsidian-cli search-content 'keyword'\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nCancelled.")
        sys.exit(1)
