import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/components/ui/card";
import { Badge } from "@/ui/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/components/ui/tabs";
import { Skeleton } from "@/ui/components/ui/skeleton";
import { AlertCircle, Database, FileText, GitBranch } from "lucide-react";
import { ERDEntry } from "@/sys/config/erd-registry";
import { useERDContent, parseOwnershipTables } from "@/ui/hooks/useERDContent";
import { ERDMermaidRenderer } from "./ERDMermaidRenderer";
import { ERDOwnershipTable } from "./ERDOwnershipTable";

interface ERDDiagramCardProps {
  entry: ERDEntry;
}

export function ERDDiagramCard({ entry }: ERDDiagramCardProps) {
  const { markdown, mermaid, loading, error } = useERDContent(entry);
  const ownershipTables = markdown ? parseOwnershipTables(markdown) : [];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Error Loading ERD
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {entry.name}
            </CardTitle>
            <CardDescription className="mt-1">
              <span className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Anchor: <Badge variant="outline">{entry.anchor}</Badge>
              </span>
            </CardDescription>
          </div>
        </div>

        {/* Anchor Invariant */}
        <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
          <p className="text-sm font-medium text-muted-foreground">Anchor Invariant</p>
          <p className="text-sm mt-1">{entry.anchorInvariant}</p>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="diagram" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="diagram" className="flex items-center gap-1">
              <GitBranch className="h-4 w-4" />
              Diagram
            </TabsTrigger>
            <TabsTrigger value="tables" className="flex items-center gap-1">
              <Database className="h-4 w-4" />
              Tables
            </TabsTrigger>
            <TabsTrigger value="raw" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Raw
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diagram" className="mt-4">
            {mermaid ? (
              <ERDMermaidRenderer chart={mermaid} className="min-h-[300px]" />
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No mermaid diagram available
              </div>
            )}
          </TabsContent>

          <TabsContent value="tables" className="mt-4 space-y-6">
            {ownershipTables.length > 0 ? (
              ownershipTables.map((ownership, idx) => (
                <ERDOwnershipTable key={idx} ownership={ownership} />
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No ownership tables found in markdown
              </div>
            )}
          </TabsContent>

          <TabsContent value="raw" className="mt-4">
            <div className="space-y-4">
              {markdown && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Markdown</p>
                  <pre className="text-xs bg-muted/50 p-4 rounded-lg overflow-auto max-h-64 border">
                    {markdown}
                  </pre>
                </div>
              )}
              {mermaid && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Mermaid</p>
                  <pre className="text-xs bg-muted/50 p-4 rounded-lg overflow-auto max-h-64 border font-mono">
                    {mermaid}
                  </pre>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
