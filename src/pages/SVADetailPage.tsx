import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, AlertTriangle, Plus } from "lucide-react";
import { SVASummaryCard, SovereignIdData, SubHubStatus } from "@/components/sva/SVASummaryCard";
import { supabase } from "@/integrations/supabase/client";

export default function SVADetailPage() {
  const { svaId } = useParams<{ svaId: string }>();
  const [sva, setSva] = useState<SovereignIdData | null>(null);
  const [subHubStatus, setSubHubStatus] = useState<SubHubStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSva() {
      if (!svaId) {
        setError("No Sovereign ID provided");
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fnError } = await supabase.functions.invoke("sva_get", {
          body: { sva_id: svaId },
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
            <Button variant="outline" size="sm" asChild>
              <Link to="/sva/create">
                <Plus className="h-4 w-4 mr-2" />
                New SVA
              </Link>
            </Button>
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
          <SVASummaryCard sva={sva} subHubStatus={subHubStatus} />
        )}
      </div>
    </div>
  );
}
