import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlusCircle, Fingerprint, MapPin, Ruler, ChevronRight, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface SovereignId {
  id: string;
  sva_id: string;
  asset_type: string;
  anchor_zip: string;
  anchor_city: string;
  anchor_state: string;
  anchor_county: string;
  radius_miles: number;
  zip_count_in_scope: number;
  status: string;
  created_at: string;
}

const assetTypeLabels: Record<string, string> = {
  "self-storage": "Self-Storage",
  "rv-storage": "RV Storage",
  "boat-storage": "Boat Storage",
  "truck-tractor": "Truck / Tractor",
  "tow-impound": "Tow & Impound",
};

export default function SVAListPage() {
  const [svas, setSvas] = useState<SovereignId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSvas = async () => {
    try {
      const { data, error } = await supabase
        .from("sovereign_ids")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSvas(data || []);
    } catch (err) {
      console.error("Error fetching SVAs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSvas();
  }, []);

  const handleDelete = async (svaId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click navigation
    
    setDeletingId(svaId);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("sva_delete", {
        body: { sva_id: svaId },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      toast.success("Sovereign ID deleted");
      setSvas((prev) => prev.filter((s) => s.sva_id !== svaId));
    } catch (err) {
      console.error("Error deleting SVA:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Fingerprint className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Sovereign IDs</h1>
            <p className="text-sm text-muted-foreground">
              All minted market mandates
            </p>
          </div>
        </div>
        <Button asChild>
          <Link to="/sva/create">
            <PlusCircle className="w-4 h-4 mr-2" />
            Create New
          </Link>
        </Button>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {isLoading ? "Loading..." : `${svas.length} Sovereign ID${svas.length !== 1 ? "s" : ""}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : svas.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <Fingerprint className="w-12 h-12 mx-auto text-muted-foreground/50" />
              <div>
                <p className="text-muted-foreground">No Sovereign IDs created yet</p>
                <p className="text-sm text-muted-foreground/70">
                  Create your first market mandate to get started
                </p>
              </div>
              <Button asChild>
                <Link to="/sva/create">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Create Sovereign ID
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SVA ID</TableHead>
                  <TableHead>Asset Type</TableHead>
                  <TableHead>Anchor Location</TableHead>
                  <TableHead>Radius</TableHead>
                  <TableHead>ZIPs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {svas.map((sva) => (
                  <TableRow
                    key={sva.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => window.location.href = `/sva/${sva.sva_id}`}
                  >
                    <TableCell>
                      <code className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                        {sva.sva_id.substring(0, 16)}...
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {assetTypeLabels[sva.asset_type] || sva.asset_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-mono text-sm">{sva.anchor_zip}</span>
                        <span className="text-muted-foreground text-sm">
                          ({sva.anchor_city}, {sva.anchor_state})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Ruler className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{sva.radius_miles} mi</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {sva.zip_count_in_scope.toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={sva.status === "CREATED" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {sva.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(sva.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              onClick={(e) => e.stopPropagation()}
                              disabled={deletingId === sva.sva_id}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Sovereign ID?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete <code className="font-mono text-foreground">{sva.sva_id}</code> and all associated data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={(e) => handleDelete(sva.sva_id, e)} 
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
