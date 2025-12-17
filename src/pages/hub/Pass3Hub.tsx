import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Ruler } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Pass3Hub = () => {
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
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Ruler className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-foreground">Pass 3 — Design Hub</h1>
                <Badge variant="secondary">Future</Badge>
              </div>
              <p className="text-muted-foreground">Site design and pro forma modeling</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Planned for Future Release</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The Pass 3 Design Hub will handle site design optimization, unit mix planning, 
              build cost calculation, and IRR projection for approved opportunities.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Pass3Hub;
