import fs from "node:fs";
import path from "node:path";

const ERD_DIR = "docs/erd";

const mdFiles = fs.readdirSync(ERD_DIR).filter(f => f.endsWith(".md"));
const mermaidFiles = fs.readdirSync(ERD_DIR).filter(f => f.endsWith(".mermaid"));

function read(p) {
  return fs.readFileSync(p, "utf8");
}

// 1) Collect WRITE ownership declarations from MD (simple, explicit tag)
const writeOwners = new Map(); // table -> erd file
const deprecated = new Set();

for (const f of mdFiles) {
  const txt = read(path.join(ERD_DIR, f));
  
  // Expect tables in markdown rows like: | `table_name` | ... |
  const tableMatches = [...txt.matchAll(/\|\s*`([^`]+)`\s*\|/g)].map(m => m[1]);
  
  // Expect WRITE section header "## Tables Owned (WRITE)"
  const parts = txt.split("## Tables Owned (WRITE)");
  if (parts.length < 2) continue;
  
  const writeSection = parts[1].split("## Tables Referenced")[0] ?? parts[1];
  
  for (const t of tableMatches) {
    if (writeSection.includes("`" + t + "`")) {
      if (writeOwners.has(t)) {
        console.error(`ERD VIOLATION: table ${t} has multiple WRITE owners: ${writeOwners.get(t)} and ${f}`);
        process.exit(1);
      }
      writeOwners.set(t, f);
    }
  }
  
  // Deprecation tags
  for (const m of txt.matchAll(/`([^`]+)`\s+.*DEPRECATED/gi)) {
    deprecated.add(m[1]);
  }
}

// 2) Enforce deprecated tables are not written in code (super blunt grep)
const codeRoots = ["src", "supabase/functions"];
const denyWrite = [...deprecated];

const codeBlob = codeRoots
  .filter(d => fs.existsSync(d))
  .flatMap(d => {
    const stack = [d];
    const files = [];
    while (stack.length) {
      const cur = stack.pop();
      for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
        const p = path.join(cur, ent.name);
        if (ent.isDirectory()) stack.push(p);
        else if (/\.(ts|tsx|js|sql)$/.test(ent.name)) files.push(p);
      }
    }
    return files;
  });

for (const t of denyWrite) {
  const patterns = [
    `.from("${t}")`,
    `.from('${t}')`,
    `INSERT INTO ${t}`,
    `UPDATE ${t}`,
    `DELETE FROM ${t}`
  ];
  for (const file of codeBlob) {
    const txt = read(file);
    if (patterns.some(p => txt.includes(p))) {
      console.error(`ERD VIOLATION: deprecated table "${t}" referenced in ${file}`);
      process.exit(1);
    }
  }
}

console.log(`ERD Guard PASS: WRITE owners=${writeOwners.size}, deprecated=${deprecated.size}, mermaid_files=${mermaidFiles.length}`);
