import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/ui/table";
import { Badge } from "@/ui/components/ui/badge";
import { OwnershipTable } from "@/ui/hooks/useERDContent";

interface ERDOwnershipTableProps {
  ownership: OwnershipTable;
}

export function ERDOwnershipTable({ ownership }: ERDOwnershipTableProps) {
  const isWrite = ownership.type === "write";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant={isWrite ? "default" : "secondary"}>
          {isWrite ? "WRITE" : "READ-ONLY"}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {isWrite ? "Tables Owned" : "Tables Referenced"}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Table</TableHead>
            {isWrite && <TableHead>Primary Key</TableHead>}
            {isWrite && <TableHead>Description</TableHead>}
            {!isWrite && <TableHead>Owner</TableHead>}
            {!isWrite && <TableHead>Purpose</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ownership.tables.map((table, idx) => (
            <TableRow key={idx}>
              <TableCell className="font-mono text-sm">
                {table.table}
              </TableCell>
              {isWrite && (
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {table.primary_key || "-"}
                </TableCell>
              )}
              {isWrite && (
                <TableCell className="text-sm">
                  {table.description || "-"}
                </TableCell>
              )}
              {!isWrite && (
                <TableCell className="text-sm">
                  {table.owner || "-"}
                </TableCell>
              )}
              {!isWrite && (
                <TableCell className="text-sm">
                  {table.purpose || "-"}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
