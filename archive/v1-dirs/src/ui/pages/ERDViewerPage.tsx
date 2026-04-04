import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/components/ui/tabs";
import { ScrollArea } from "@/ui/components/ui/scroll-area";
import { Badge } from "@/ui/components/ui/badge";
import { ERD_REGISTRY, ERDEntry } from "@/sys/config/erd-registry";
import { ERDDiagramCard } from "@/ui/components/erd/ERDDiagramCard";
import { ERDDashboard, ERDSubHubSummary } from "@/ui/components/erd/ERDDashboard";
import { Database, LayoutDashboard } from "lucide-react";

export default function ERDViewerPage() {
  const [selectedHub, setSelectedHub] = useState<ERDEntry>(ERD_REGISTRY[0]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-8 w-8" />
            ERD Viewer
          </h1>
          <p className="text-muted-foreground mt-1">
            Read-only Entity Relationship Diagram documentation viewer
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          CC-03 Artifacts
        </Badge>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboard" className="flex items-center gap-1">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="diagrams" className="flex items-center gap-1">
            <Database className="h-4 w-4" />
            Diagrams
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6 mt-6">
          <ERDDashboard />
          <ERDSubHubSummary />
        </TabsContent>

        {/* Diagrams Tab */}
        <TabsContent value="diagrams" className="mt-6">
          <div className="grid grid-cols-12 gap-6">
            {/* Sub-Hub Selector */}
            <div className="col-span-12 md:col-span-3">
              <div className="sticky top-6">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  Select Sub-Hub
                </p>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2 pr-4">
                    {ERD_REGISTRY.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => setSelectedHub(entry)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedHub.id === entry.id
                            ? "bg-primary/10 border-primary"
                            : "bg-muted/30 border-transparent hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="font-medium text-sm">{entry.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {entry.anchor}
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Diagram Display */}
            <div className="col-span-12 md:col-span-9">
              <ERDDiagramCard entry={selectedHub} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
