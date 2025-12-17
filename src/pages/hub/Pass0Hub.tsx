import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Radio } from "lucide-react";

const Pass0Hub = () => {
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
            <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center">
              <Radio className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Pass 0 — Radar Hub</h1>
              <p className="text-muted-foreground">Market radar signals and trend detection</p>
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
              The Pass 0 Radar Hub will aggregate momentum signals including housing permits, 
              industrial logistics data, and news events to detect early market opportunities.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Pass0Hub;
