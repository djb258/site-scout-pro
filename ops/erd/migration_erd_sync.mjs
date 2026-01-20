import fs from "node:fs";
import { execSync } from "node:child_process";

const ERD_DIR = "docs/erd";
const MIGRATION_DIR = "supabase/migrations";

// Get changed files in this PR/commit
function getChangedFiles() {
  try {
    // Try PR diff first (GitHub Actions)
    const diff = execSync("git diff --name-only origin/main...HEAD", { encoding: "utf8" });
    return diff.trim().split("\n").filter(Boolean);
  } catch {
    try {
      // Fallback to last commit
      const diff = execSync("git diff --name-only HEAD~1", { encoding: "utf8" });
      return diff.trim().split("\n").filter(Boolean);
    } catch {
      console.log("Migration-ERD Sync: Could not determine changed files, skipping check");
      process.exit(0);
    }
  }
}

// Extract table names from SQL migration content
function extractTableNames(sql) {
  const tables = new Set();
  
  // CREATE TABLE patterns
  const createMatches = sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi);
  for (const m of createMatches) tables.add(m[1].toLowerCase());
  
  // ALTER TABLE patterns
  const alterMatches = sql.matchAll(/ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi);
  for (const m of alterMatches) tables.add(m[1].toLowerCase());
  
  // DROP TABLE patterns
  const dropMatches = sql.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi);
  for (const m of dropMatches) tables.add(m[1].toLowerCase());
  
  return [...tables];
}

// Main check
const changedFiles = getChangedFiles();

// Find new/modified migrations
const migrationFiles = changedFiles.filter(f => 
  f.startsWith(MIGRATION_DIR) && f.endsWith(".sql")
);

if (migrationFiles.length === 0) {
  console.log("Migration-ERD Sync PASS: No migrations in this change");
  process.exit(0);
}

// Find changed ERD files
const erdFiles = changedFiles.filter(f => 
  f.startsWith(ERD_DIR) && (f.endsWith(".md") || f.endsWith(".mermaid"))
);

// Extract all tables being modified
const tablesModified = new Set();
for (const mig of migrationFiles) {
  if (!fs.existsSync(mig)) continue; // File might be deleted
  const sql = fs.readFileSync(mig, "utf8");
  const tables = extractTableNames(sql);
  for (const t of tables) tablesModified.add(t);
}

// Ignore system tables that don't need ERD entries
const systemTables = new Set([
  "schema_migrations", "supabase_migrations", "_prisma_migrations"
]);
const userTables = [...tablesModified].filter(t => !systemTables.has(t));

if (userTables.length === 0) {
  console.log("Migration-ERD Sync PASS: No user tables modified");
  process.exit(0);
}

// Require ERD update if tables are modified
if (erdFiles.length === 0) {
  console.error("MIGRATION-ERD SYNC VIOLATION:");
  console.error(`  Migrations modify tables: ${userTables.join(", ")}`);
  console.error(`  But no ERD files (${ERD_DIR}/*.md or *.mermaid) were updated`);
  console.error("");
  console.error("Per ERD_DISCIPLINE.md Rule 1:");
  console.error("  'No table creation or migration may occur without a corresponding ERD entry.'");
  console.error("");
  console.error("Fix: Update the appropriate ERD_SubHubX.md and ERD_SubHubX.mermaid files");
  process.exit(1);
}

console.log(`Migration-ERD Sync PASS: ${migrationFiles.length} migrations, ${erdFiles.length} ERD updates, tables: ${userTables.join(", ")}`);
