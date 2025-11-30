#!/usr/bin/env python3
"""Copy only original .md files to MD files folder"""

import os
import shutil
from pathlib import Path

MD_FOLDER = Path("MD files")
SOURCE_PATH = Path.cwd()

EXCLUDE_PATTERNS = {
    'node_modules', '.git', '__pycache__', '.pytest_cache', 'venv', 'env',
    '.venv', 'dist', 'build', '.next', '.cache', 'coverage',
    'obsidian', 'obsidian_flat', 'MD files'
}

def should_include(file_path):
    """Only include original .md files"""
    for part in file_path.parts:
        if part in EXCLUDE_PATTERNS:
            return False
    return file_path.suffix == '.md'

def main():
    print(f"Copying all .md files to 'MD files' folder...\n")

    # Clear existing folder
    if MD_FOLDER.exists():
        print("Clearing existing folder...")
        shutil.rmtree(MD_FOLDER)

    MD_FOLDER.mkdir(exist_ok=True)

    # Collect all .md files
    md_files = []
    for root, dirs, filenames in os.walk(SOURCE_PATH):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_PATTERNS]
        for filename in filenames:
            filepath = Path(root) / filename
            if should_include(filepath):
                md_files.append(filepath)

    print(f"Found {len(md_files)} markdown files\n")

    # Copy each file
    copied = 0
    for filepath in md_files:
        rel_path = filepath.relative_to(SOURCE_PATH)

        # Create a flat filename from the path
        flat_name = str(rel_path).replace('\\', '_').replace('/', '_')
        dest_path = MD_FOLDER / flat_name

        try:
            shutil.copy2(filepath, dest_path)
            copied += 1
            print(f"[OK] {rel_path} -> {flat_name}")
        except Exception as e:
            print(f"[ERROR] {rel_path}: {str(e)[:50]}")

    # Create a simple index
    index_path = MD_FOLDER / "INDEX.md"
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(f"""# Storage Containers - Markdown Files

**Repository:** https://github.com/djb258/site-scout-pro.git
**Total MD Files:** {len(md_files)}

## All Markdown Files

""")
        for filepath in sorted(md_files):
            rel_path = filepath.relative_to(SOURCE_PATH)
            flat_name = str(rel_path).replace('\\', '_').replace('/', '_')
            f.write(f"- {rel_path}\n")

        f.write("\n---\n*All original .md files from the repository*\n")

    print(f"\n[OK] Created INDEX.md")
    print(f"\nDone! {copied} markdown files copied to '{MD_FOLDER}'")

if __name__ == "__main__":
    main()
