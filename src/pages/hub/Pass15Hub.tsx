import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ClipboardCheck } from "lucide-react";

const Pass15Hub = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Overview
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-purple-500 flex items-center justify-center">
              <ClipboardCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Pass 1.5 — Cleanup Hub</h1>
              <p className="text-muted-foreground">Rate verification and evidence cleanup</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The Pass 1.5 Cleanup Hub will verify published rates, normalize evidence, 
              and calculate coverage confidence scores before underwriting.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Pass15Hub;
