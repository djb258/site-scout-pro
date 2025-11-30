#!/usr/bin/env python3
"""
Sync current repository to Obsidian vault
This script copies relevant project files to your Obsidian vault for easy searching and reference.
"""

import os
import subprocess
import sys
from pathlib import Path
import shutil

# Directories and files to exclude
EXCLUDE_PATTERNS = {
    'node_modules', '.git', '__pycache__', '.pytest_cache', 'venv', 'env',
    '.venv', 'dist', 'build', '.next', '.cache', 'coverage',
    'bun.lockb', 'package-lock.json', '.DS_Store', 'obsidian-cli.exe'
}

# File extensions to include (code, docs, config)
INCLUDE_EXTENSIONS = {
    '.py', '.js', '.jsx', '.ts', '.tsx', '.md', '.json', '.yaml', '.yml',
    '.toml', '.txt', '.env.example', '.sh', '.bash', '.sql', '.prisma',
    '.html', '.css', '.scss', '.vue', '.go', '.rs'
}

def should_include_file(file_path: Path) -> bool:
    """Determine if a file should be included in the sync."""
    # Check if any excluded pattern is in the path
    for part in file_path.parts:
        if part in EXCLUDE_PATTERNS:
            return False

    # Check file extension or specific filenames
    if file_path.suffix in INCLUDE_EXTENSIONS:
        return True

    # Include specific important files
    important_files = {
        'README', 'LICENSE', 'Dockerfile', 'Makefile', '.gitignore',
        '.cursorrules', 'requirements.txt', 'package.json', 'tsconfig.json'
    }

    if file_path.stem in important_files or file_path.name in important_files:
        return True

    return False

def get_project_name() -> str:
    """Get the current project/repo name."""
    return Path.cwd().name

def create_obsidian_note(note_path: str, content: str, vault_name: str = None):
    """Create a note in Obsidian using obsidian-cli."""
    cmd = ['obsidian-cli', 'create', note_path]
    if vault_name:
        cmd.extend(['--vault', vault_name])

    try:
        # Write content to file first, then create note
        result = subprocess.run(
            cmd,
            input=content,
            text=True,
            capture_output=True,
            check=True
        )
        print(f"[OK] Created: {note_path}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[FAIL] Failed to create {note_path}: {e.stderr}")
        return False

def create_project_index(project_name: str, file_tree: str) -> str:
    """Create an index note for the project."""
    return f"""# {project_name}

## Project Overview

This is an automatically generated index of the **{project_name}** repository.

**Generated:** {subprocess.check_output(['date'], text=True).strip()}
**Location:** `{Path.cwd()}`

## File Structure

```
{file_tree}
```

## Quick Links

- [[{project_name}/README|README]]
- [[{project_name}/backend/|Backend Code]]
- [[{project_name}/src/|Frontend Source]]

## Search This Project

Use Obsidian's search or `obsidian-cli search-content` to find specific code or documentation within this project.

---

*Synced from repository using sync_to_obsidian.py*
"""

def get_file_tree(root_dir: Path, prefix: str = "", max_depth: int = 3, current_depth: int = 0) -> str:
    """Generate a text-based file tree."""
    if current_depth >= max_depth:
        return ""

    tree = ""
    try:
        items = sorted(root_dir.iterdir(), key=lambda x: (not x.is_dir(), x.name))
        for i, item in enumerate(items):
            # Skip excluded items
            if item.name in EXCLUDE_PATTERNS:
                continue

            is_last = i == len(items) - 1
            connector = "└── " if is_last else "├── "

            tree += f"{prefix}{connector}{item.name}\n"

            if item.is_dir():
                extension = "    " if is_last else "│   "
                tree += get_file_tree(item, prefix + extension, max_depth, current_depth + 1)
    except PermissionError:
        pass

    return tree

def sync_repository():
    """Main function to sync repository to Obsidian."""
    project_name = get_project_name()
    project_root = Path.cwd()

    print(f"\n📚 Syncing '{project_name}' to Obsidian...")
    print(f"📁 Repository: {project_root}\n")

    # Check if obsidian-cli is available
    try:
        subprocess.run(['obsidian-cli', '--version'], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("[ERROR] Error: obsidian-cli not found. Please install it first.")
        sys.exit(1)

    # Check if default vault is set
    result = subprocess.run(['obsidian-cli', 'print-default'], capture_output=True, text=True)
    if result.returncode != 0:
        print("[ERROR] Error: No default vault set. Run 'obsidian-cli set-default' first.")
        sys.exit(1)

    vault_info = result.stdout.strip()
    print(f"🗂️  Target vault: {vault_info}\n")

    # Generate file tree
    file_tree = get_file_tree(project_root)

    # Create project index
    index_content = create_project_index(project_name, file_tree)
    index_path = f"Projects/{project_name}/INDEX"

    print("Creating project index...")
    create_obsidian_note(index_path, index_content)

    # Collect all files to sync
    files_to_sync = []
    for root, dirs, files in os.walk(project_root):
        # Remove excluded directories
        dirs[:] = [d for d in dirs if d not in EXCLUDE_PATTERNS]

        root_path = Path(root)
        for file in files:
            file_path = root_path / file
            if should_include_file(file_path):
                files_to_sync.append(file_path)

    print(f"\n📋 Found {len(files_to_sync)} files to sync...\n")

    # Sync each file
    synced_count = 0
    for file_path in files_to_sync:
        # Calculate relative path
        rel_path = file_path.relative_to(project_root)

        # Create Obsidian note path
        note_path = f"Projects/{project_name}/{rel_path}"

        # Read file content
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            # Create note with code block if it's a code file
            if file_path.suffix in INCLUDE_EXTENSIONS:
                ext = file_path.suffix.lstrip('.')
                note_content = f"""# {file_path.name}

**File:** `{rel_path}`
**Project:** [[Projects/{project_name}/INDEX|{project_name}]]

```{ext}
{content}
```

---
*Synced from: `{file_path}`*
"""
            else:
                note_content = content

            # Create the note
            if create_obsidian_note(note_path, note_content):
                synced_count += 1

        except Exception as e:
            print(f"[FAIL] Error reading {file_path}: {e}")

    print(f"\n[DONE] Sync complete! {synced_count}/{len(files_to_sync)} files synced to Obsidian.")
    print(f"\n📖 View your project: obsidian-cli open 'Projects/{project_name}/INDEX'")
    print(f"🔍 Search content: obsidian-cli search-content 'your search term'\n")

if __name__ == "__main__":
    try:
        sync_repository()
    except KeyboardInterrupt:
        print("\n\n[WARN]  Sync cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Error: {e}")
        sys.exit(1)
