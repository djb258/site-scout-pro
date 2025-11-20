import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Target, TrendingUp, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <Building2 className="h-20 w-20 text-primary" />
          </div>
          <h1 className="text-5xl font-bold mb-4 text-foreground">
            Storage Site Go/No-Go Engine
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Professional site evaluation system for self-storage development opportunities
          </p>
          <Link to="/wizard">
            <Button size="lg" className="text-lg px-8 py-6">
              Start New Evaluation
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <Target className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Multi-Factor Analysis</CardTitle>
              <CardDescription>
                Comprehensive evaluation across location, demand, and financial metrics
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Data-Driven Decisions</CardTitle>
              <CardDescription>
                Leverage market data, competition analysis, and rent band verification
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CheckCircle2 className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Clear Recommendations</CardTitle>
              <CardDescription>
                Receive Go/No-Go/Maybe decisions with detailed scoring breakdowns
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card className="bg-secondary/50">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-2 font-bold">
                  1
                </div>
                <h3 className="font-semibold mb-1">Location Basics</h3>
                <p className="text-sm text-muted-foreground">Enter site details and parcel info</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-2 font-bold">
                  2
                </div>
                <h3 className="font-semibold mb-1">Demand Indicators</h3>
                <p className="text-sm text-muted-foreground">Assess market demand metrics</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-2 font-bold">
                  3
                </div>
                <h3 className="font-semibold mb-1">Rent Bands</h3>
                <p className="text-sm text-muted-foreground">Verify local rent pricing</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-2 font-bold">
                  4
                </div>
                <h3 className="font-semibold mb-1">Review</h3>
                <p className="text-sm text-muted-foreground">Confirm all collected data</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-2 font-bold">
                  5
                </div>
                <h3 className="font-semibold mb-1">Results</h3>
                <p className="text-sm text-muted-foreground">Get your Go/No-Go decision</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
