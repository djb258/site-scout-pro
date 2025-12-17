import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface HubConfig {
  id: string;
  name: string;
  shortName: string;
  route: string;
  status: "active" | "placeholder";
  color: string;
  card: {
    purpose: string;
    inputs: string;
    outputs: string;
    promotionRule: string;
  };
}

const defaultHubs: HubConfig[] = [
  {
    id: "pass0",
    name: "Pass 0 — Radar",
    shortName: "Pass 0",
    route: "/hub/pass0",
    status: "active",
    color: "hsl(210, 100%, 60%)",
    card: {
      purpose: "Market radar signals and trend detection",
      inputs: "Housing permits, industrial logistics, news events",
      outputs: "Momentum signals, trend score",
      promotionRule: "Signal strength > 0.6 → promote to Pass 1",
    },
  },
  {
    id: "pass1",
    name: "Pass 1 — Exploration",
    shortName: "Pass 1",
    route: "/hub/pass1",
    status: "active",
    color: "hsl(45, 100%, 50%)",
    card: {
      purpose: "Initial site exploration and competitor scan",
      inputs: "ZIP code, radius, toggle preferences",
      outputs: "Competitor registry, demand anchors, hotspot score",
      promotionRule: "Hotspot score ≥ 60 → promote to Pass 1.5",
    },
  },
  {
    id: "pass15",
    name: "Pass 1.5 — Cleanup",
    shortName: "Pass 1.5",
    route: "/hub/pass15",
    status: "active",
    color: "hsl(280, 80%, 60%)",
    card: {
      purpose: "Rate verification and evidence cleanup",
      inputs: "Pass 1 results, published rates",
      outputs: "Verified rent bands, confidence score",
      promotionRule: "Coverage confidence ≥ 70% → promote to Pass 2",
    },
  },
  {
    id: "pass2",
    name: "Pass 2 — Underwriting",
    shortName: "Pass 2",
    route: "/hub/pass2",
    status: "active",
    color: "hsl(150, 80%, 45%)",
    card: {
      purpose: "Full underwriting and feasibility analysis",
      inputs: "Verified rates, zoning, civil constraints",
      outputs: "Feasibility model, verdict, fusion demand",
      promotionRule: "Verdict = GO → eligible for Vault save",
    },
  },
  {
    id: "pass3",
    name: "Pass 3 — Design",
    shortName: "Pass 3",
    route: "/hub/pass3",
    status: "placeholder",
    color: "hsl(0, 0%, 50%)",
    card: {
      purpose: "Future: Site design and pro forma modeling",
      inputs: "Pass 2 results, land constraints",
      outputs: "Unit mix, build cost, IRR projection",
      promotionRule: "IRR ≥ target → proceed to LOI",
    },
  },
];

const SystemOverview = () => {
  const [hubs, setHubs] = useState<HubConfig[]>(defaultHubs);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("getSystemConfig");
        if (!error && data?.hubs) {
          setHubs(data.hubs);
        }
      } catch {
        // Use defaults if edge function unavailable
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  // Calculate positions for hub nodes in a circle
  const centerX = 200;
  const centerY = 200;
  const radius = 140;

  const getNodePosition = (index: number, total: number) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-8">
          <h1 className="text-4xl font-bold text-foreground">Storage Viability Engine</h1>
          <p className="mt-2 text-lg text-muted-foreground">System Architecture Overview</p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 space-y-12">
        {/* Hub-and-Spoke Diagram */}
        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-6">Hub Architecture</h2>
          <div className="flex justify-center">
            <svg width="400" height="400" viewBox="0 0 400 400" className="overflow-visible">
              {/* Connection lines */}
              {hubs.map((hub, index) => {
                const pos = getNodePosition(index, hubs.length);
                return (
                  <line
                    key={`line-${hub.id}`}
                    x1={centerX}
                    y1={centerY}
                    x2={pos.x}
                    y2={pos.y}
                    stroke={hub.status === "placeholder" ? "hsl(var(--muted))" : hub.color}
                    strokeWidth="2"
                    strokeDasharray={hub.status === "placeholder" ? "5,5" : "none"}
                    className="transition-all duration-300"
                  />
                );
              })}

              {/* Center node */}
              <Link to="/">
                <g className="cursor-pointer">
                  <circle
                    cx={centerX}
                    cy={centerY}
                    r="50"
                    fill="hsl(var(--primary))"
                    className="transition-all duration-300 hover:opacity-80"
                  />
                  <text
                    x={centerX}
                    y={centerY - 8}
                    textAnchor="middle"
                    fill="hsl(var(--primary-foreground))"
                    fontSize="11"
                    fontWeight="600"
                  >
                    Storage
                  </text>
                  <text
                    x={centerX}
                    y={centerY + 8}
                    textAnchor="middle"
                    fill="hsl(var(--primary-foreground))"
                    fontSize="11"
                    fontWeight="600"
                  >
                    Viability
                  </text>
                  <text
                    x={centerX}
                    y={centerY + 24}
                    textAnchor="middle"
                    fill="hsl(var(--primary-foreground))"
                    fontSize="11"
                    fontWeight="600"
                  >
                    Engine
                  </text>
                </g>
              </Link>

              {/* Hub nodes */}
              {hubs.map((hub, index) => {
                const pos = getNodePosition(index, hubs.length);
                return (
                  <Link key={hub.id} to={hub.route}>
                    <g className="cursor-pointer">
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r="40"
                        fill={hub.status === "placeholder" ? "hsl(var(--muted))" : hub.color}
                        strokeDasharray={hub.status === "placeholder" ? "5,5" : "none"}
                        stroke={hub.status === "placeholder" ? "hsl(var(--muted-foreground))" : "transparent"}
                        strokeWidth="2"
                        className="transition-all duration-300 hover:opacity-80"
                      />
                      <text
                        x={pos.x}
                        y={pos.y - 5}
                        textAnchor="middle"
                        fill={hub.status === "placeholder" ? "hsl(var(--muted-foreground))" : "white"}
                        fontSize="10"
                        fontWeight="600"
                      >
                        {hub.shortName}
                      </text>
                      <text
                        x={pos.x}
                        y={pos.y + 10}
                        textAnchor="middle"
                        fill={hub.status === "placeholder" ? "hsl(var(--muted-foreground))" : "white"}
                        fontSize="9"
                      >
                        {hub.id === "pass0" ? "Radar" : 
                         hub.id === "pass1" ? "Explore" : 
                         hub.id === "pass15" ? "Cleanup" : 
                         hub.id === "pass2" ? "Underwrite" : "Design"}
                      </text>
                    </g>
                  </Link>
                );
              })}
            </svg>
          </div>
        </section>

        {/* Hub Summary Cards */}
        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-6">Hub Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {hubs.map((hub) => (
              <Link key={hub.id} to={hub.route} className="block">
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{hub.shortName}</CardTitle>
                      <Badge
                        variant={hub.status === "active" ? "default" : "secondary"}
                        style={{
                          backgroundColor: hub.status === "active" ? hub.color : undefined,
                          color: hub.status === "active" ? "white" : undefined,
                        }}
                      >
                        {hub.status === "active" ? "Active" : "Future"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {hub.id === "pass0" ? "Radar" : 
                       hub.id === "pass1" ? "Exploration" : 
                       hub.id === "pass15" ? "Cleanup" : 
                       hub.id === "pass2" ? "Underwriting" : "Design"}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">Purpose</p>
                      <p className="text-muted-foreground">{hub.card.purpose}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Inputs</p>
                      <p className="text-muted-foreground">{hub.card.inputs}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Outputs</p>
                      <p className="text-muted-foreground">{hub.card.outputs}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Promotion Rule</p>
                      <p className="text-muted-foreground">{hub.card.promotionRule}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default SystemOverview;
