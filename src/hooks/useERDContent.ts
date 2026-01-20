import { useState, useEffect } from "react";
import { ERDEntry } from "@/config/erd-registry";

interface ERDContent {
  markdown: string | null;
  mermaid: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch ERD markdown and mermaid content
 * Uses static imports since files are in the repo
 */
export function useERDContent(entry: ERDEntry | undefined): ERDContent {
  const [content, setContent] = useState<ERDContent>({
    markdown: null,
    mermaid: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!entry) {
      setContent({ markdown: null, mermaid: null, loading: false, error: "No ERD entry provided" });
      return;
    }

    const fetchContent = async () => {
      setContent((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Fetch both files in parallel
        const [mdResponse, mermaidResponse] = await Promise.all([
          fetch(`/${entry.mdPath}`),
          fetch(`/${entry.mermaidPath}`),
        ]);

        const markdown = mdResponse.ok ? await mdResponse.text() : null;
        const mermaid = mermaidResponse.ok ? await mermaidResponse.text() : null;

        setContent({
          markdown,
          mermaid,
          loading: false,
          error: null,
        });
      } catch (err) {
        setContent({
          markdown: null,
          mermaid: null,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to fetch ERD content",
        });
      }
    };

    fetchContent();
  }, [entry?.id]);

  return content;
}

/**
 * Parse ownership tables from markdown content
 */
export interface TableEntry {
  table: string;
  name?: string;
  primary_key?: string;
  description?: string;
  owner?: string;
  purpose?: string;
}

export interface OwnershipTable {
  type: "write" | "read";
  tables: TableEntry[];
}

export function parseOwnershipTables(markdown: string): OwnershipTable[] {
  const results: OwnershipTable[] = [];

  // Find "Tables Owned (WRITE)" section
  const writeMatch = markdown.match(/## Tables Owned \(WRITE\)([\s\S]*?)(?=\n---|\n## |$)/);
  if (writeMatch) {
    const tables = parseMarkdownTable(writeMatch[1]);
    if (tables.length > 0) {
      results.push({ type: "write", tables });
    }
  }

  // Find "Tables Referenced (READ-ONLY)" section
  const readMatch = markdown.match(/## Tables Referenced \(READ-ONLY\)([\s\S]*?)(?=\n---|\n## |$)/);
  if (readMatch) {
    const tables = parseMarkdownTable(readMatch[1]);
    if (tables.length > 0) {
      results.push({ type: "read", tables });
    }
  }

  return results;
}

function parseMarkdownTable(section: string): TableEntry[] {
  const lines = section.trim().split("\n").filter((l) => l.startsWith("|"));
  if (lines.length < 3) return []; // Need header, separator, and at least one row

  const headers = lines[0]
    .split("|")
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(Boolean);

  const rows: TableEntry[] = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i].split("|").map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (cells[idx]) row[h] = cells[idx];
    });
    if (Object.keys(row).length > 0) {
      rows.push({
        table: row.table || row.name || "",
        name: row.name,
        primary_key: row.primary_key,
        description: row.description,
        owner: row.owner,
        purpose: row.purpose,
      });
    }
  }

  return rows;
}
