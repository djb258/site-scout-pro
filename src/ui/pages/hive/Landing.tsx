import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Database,
  Building2,
  Map,
  FileText,
  Shield,
  ArrowRight,
  MapPin,
  Layers,
  Target,
} from "lucide-react";
import { WithId } from "@/components/hive/WithId";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function Landing() {
  const [stats, setStats] = useState({
    jurisdictions: 74,
    states: 4,
    facilities: 2351,
    pipeline: 6698,
  });

  useEffect(() => {
    fetch(`${API_BASE}/api/hive/stats`)
      .then((res) => res.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const dataSources = [
    {
      icon: Building2,
      title: "Housing Pipeline",
      source: "County permit portals (Tyler-EnerGov, MGO Connect, OneStop)",
      update: "Weekly incremental + monthly full",
      coverage: "Multi-family, townhome, apartment permits",
      signal: "RED = vertical construction (imminent demand)",
      color: "text-red-500",
    },
    {
      icon: Map,
      title: "Existing Facilities",
      source: "Google Places API, manual verification",
      update: "Monthly refresh",
      coverage: "Location, estimated SF, review sentiment",
      signal: "Competitor density and quality assessment",
      color: "text-blue-500",
    },
    {
      icon: FileText,
      title: "Regulatory Intelligence",
      source: "Multi-LLM research (6 models per jurisdiction)",
      update: "Quarterly review",
      coverage: "Zoning codes, permit systems, TPA contacts",
      signal: "By-right zones, conditional use requirements",
      color: "text-purple-500",
    },
    {
      icon: Shield,
      title: "Risk Layers",
      source: "FEMA, County GIS portals",
      update: "Annual refresh",
      coverage: "Flood zones, wetlands, environmental",
      signal: "Parcel-level risk assessment",
      color: "text-orange-500",
    },
  ];

  const counties: Record<string, string[]> = {
    PA: ["Bedford", "Blair", "Cambria"],
    WV: ["Morgan", "Jefferson", "Berkeley"],
    MD: ["Allegany"],
    VA: ["Frederick"],
  };

  return (
    <WithId id="LAND-001" name="Landing Page" className="flex-1 bg-background text-foreground">
      <WithId id="LAND-HERO-001" name="Hero Section" className="relative py-20 px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-background"></div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Database className="w-14 h-14 text-primary" />
            <h1 className="text-6xl font-bold tracking-tight">HIVE</h1>
          </div>
          <p className="text-2xl text-muted-foreground mb-2">
            Secondary Market Intelligence
          </p>
          <p className="text-xl text-muted-foreground mb-6">
            Self-Storage Site Selection System
          </p>
          <p className="text-lg text-primary italic mb-12">
            "Find tomorrow's storage demand today"
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link
              to="/cockpit"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-4 rounded-lg transition shadow-lg shadow-primary/20"
            >
              <Target className="w-5 h-5" />
              Scouting Cockpit
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/screener"
              className="inline-flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold px-8 py-4 rounded-lg transition"
            >
              Quick Screener
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/map"
              className="inline-flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold px-8 py-4 rounded-lg transition"
            >
              <MapPin className="w-5 h-5" />
              View Map
            </Link>
          </div>
        </div>
      </WithId>

      <WithId id="LAND-STAT-001" name="Stats Bar" className="bg-card py-8 border-y border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center px-6">
          <div>
            <div className="text-4xl font-bold text-primary">{stats.jurisdictions}</div>
            <div className="text-muted-foreground text-sm mt-1">Counties Researched</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-primary">{stats.states}</div>
            <div className="text-muted-foreground text-sm mt-1">States Covered</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-primary">{stats.facilities.toLocaleString()}</div>
            <div className="text-muted-foreground text-sm mt-1">Storage Facilities</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-primary">{stats.pipeline.toLocaleString()}</div>
            <div className="text-muted-foreground text-sm mt-1">Pipeline Records</div>
          </div>
        </div>
      </WithId>

      <WithId id="LAND-DATA-001" name="Data Sources Grid" className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Data Sources & Methodology</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Our thesis: Townhome and apartment residents have significantly higher storage
            needs than single-family homeowners. Track housing pipeline permits to identify
            imminent demand before competitors.
          </p>
          <div className="grid gap-6">
            {dataSources.map((source, idx) => (
              <DataSourceCard key={idx} {...source} />
            ))}
          </div>
        </div>
      </WithId>

      <WithId id="LAND-COV-001" name="Coverage Area" className="py-16 px-6 bg-card/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2 flex items-center justify-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            Coverage Area
          </h2>
          <p className="text-muted-foreground text-center mb-8">
            120-mile radius from Bedford, PA
          </p>

          <div className="bg-secondary/30 rounded-xl border border-border p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {Object.entries(counties).map(([state, list]) => (
                <div key={state}>
                  <div className="text-lg font-bold text-primary mb-2">{state}</div>
                  <div className="text-muted-foreground text-sm space-y-1">
                    {list.map((county) => (
                      <div key={county}>{county}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-semibold transition"
            >
              View Market Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </WithId>

      <WithId id="LAND-FOOT-001" name="Footer" className="py-8 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-muted-foreground text-sm">
            Data Sources: Census Bureau • FEMA • USGS • Google Places • County Records
          </p>
        </div>
      </WithId>
    </WithId>
  );
}

interface DataSourceCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  source: string;
  update: string;
  coverage: string;
  signal: string;
  color: string;
}

function DataSourceCard({
  icon: Icon,
  title,
  source,
  update,
  coverage,
  signal,
  color,
}: DataSourceCardProps) {
  return (
    <div className="bg-card rounded-xl p-6 border border-border hover:border-border/80 transition">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg bg-secondary ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold mb-3 text-foreground">{title}</h3>
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Source:</span>
              <span className="text-foreground/80 ml-2">{source}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Update:</span>
              <span className="text-foreground/80 ml-2">{update}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Coverage:</span>
              <span className="text-foreground/80 ml-2">{coverage}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Signal:</span>
              <span className="text-foreground/80 ml-2">{signal}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
