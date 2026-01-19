import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { ArrowLeft, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { SVASummaryCard, SovereignIdData, SubHubStatus } from "@/components/sva/SVASummaryCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ZipInScope {
  zip: string;
  distance_miles: number;
}

export interface CountyInScope {
  county_name: string;
  county_fips: string;
  state_id: string;
  min_distance_miles: number;
  zip_count: number;
  total_population: number | null;
}

export default function SVADetailPage() {
  const { svaId } = useParams<{ svaId: string }>();
  const navigate = useNavigate();
  const [sva, setSva] = useState<SovereignIdData | null>(null);
  const [subHubStatus, setSubHubStatus] = useState<SubHubStatus[]>([]);
  const [zipsInScope, setZipsInScope] = useState<ZipInScope[]>([]);
  const [countiesInScope, setCountiesInScope] = useState<CountyInScope[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!svaId) return;
    
    setIsDeleting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("sva_delete", {
        body: { sva_id: svaId },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      toast.success("Sovereign ID deleted successfully");
      navigate("/sva");
    } catch (err) {
      console.error("Error deleting SVA:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    async function fetchSva() {
      if (!svaId) {
        setError("No Sovereign ID provided");
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fnError } = await supabase.functions.invoke("sva_get", {
          body: { sva_id: svaId, include_zips: true, include_counties: true },
        });

        if (fnError) {
          throw new Error(fnError.message || "Failed to fetch Sovereign ID");
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        setSva(data);
        if (data.sub_hub_status) {
          setSubHubStatus(data.sub_hub_status);
        }
        if (data.zips_in_scope) {
          setZipsInScope(data.zips_in_scope);
        }
        if (data.counties_in_scope) {
          setCountiesInScope(data.counties_in_scope);
        }
      } catch (err) {
        console.error("Error fetching SVA:", err);
        setError(err instanceof Error ? err.message : "Failed to load Sovereign ID");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSva();
  }, [svaId]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Sovereign ID Details</h1>
                <p className="text-sm text-muted-foreground font-mono">{svaId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/sva/create">
                  <Plus className="h-4 w-4 mr-2" />
                  New SVA
                </Link>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isDeleting}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Sovereign ID?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete <code className="font-mono text-foreground">{svaId}</code> and all associated ZIPs and counties. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {isLoading && (
          <div className="w-full max-w-2xl mx-auto space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {sva && !isLoading && (
          <SVASummaryCard 
            sva={sva} 
            subHubStatus={subHubStatus} 
            zipsInScope={zipsInScope} 
            countiesInScope={countiesInScope}
          />
        )}
      </div>
    </div>
  );
}
