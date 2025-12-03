import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Radar,
  Map,
  Building2,
  Factory,
  TrendingUp,
  Calculator,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  Target,
  Layers,
  FileText,
  Shield,
  Zap,
} from "lucide-react";
import { WithId } from "@/components/hive/WithId";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function Cockpit() {
  const [stats, setStats] = useState<{
    jurisdictions: number;
    states: number;
    facilities: number;
    pipeline: number;
  } | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/hive/stats`)
      .then((res) => res.json())
      .then(setStats)
      .catch(() => {
        setStats({ jurisdictions: 74, states: 4, facilities: 2351, pipeline: 6698 });
      });
  }, []);

  const steps = [
    {
      id: 1,
      componentId: "COCK-STEP-001",
      title: "Wide-Area Scan",
      subtitle: "Pass 1 Start",
      icon: Radar,
      color: "amber",
      status: "ready",
      link: "/screener",
      linkText: "Launch Screener",
      description: "Cast a 120-mile net and grab every cheap signal we can get.",
      features: [
        { icon: Map, text: "120-mile radius ZIP + county map" },
        { icon: Building2, text: "All facilities, housing, universities, anchors" },
        { icon: Layers, text: "Recreation scan (lakes, RV, marinas)" },
        { icon: Factory, text: "Industrial footprint (factories, megasites, logistics)" },
        { icon: FileText, text: "County shell cards for every county in radius" },
      ],
      purpose: "Filter 200+ counties down to the top ~5.",
    },
    {
      id: 2,
      componentId: "COCK-STEP-002",
      title: "County Intelligence",
      subtitle: "Cards",
      icon: Shield,
      color: "blue",
      status: "ready",
      link: "/jurisdictions",
      linkText: "View Jurisdictions",
      description: "Deep-dive intel on the counties that passed the first filter.",
      features: [
        { icon: Building2, text: "Zoning authority + links" },
        { icon: Map, text: "GIS portals + layers" },
        { icon: FileText, text: "Permit systems + TPA intel" },
        { icon: Shield, text: "Contacts, fee schedules, restrictions" },
      ],
      purpose: "Identify counties where you can actually build.",
    },
    {
      id: 3,
      componentId: "COCK-STEP-003",
      title: "Economic Engines",
      subtitle: "Fusion Model",
      icon: TrendingUp,
      color: "green",
      status: "ready",
      link: "/map",
      linkText: "Open Map",
      description: "Predict where money is going — not where it was.",
      features: [
        { icon: Factory, text: "Industrial Momentum Score" },
        { icon: Building2, text: "Housing Pipeline Score (MF/TH/Condo only)" },
        { icon: Zap, text: "Fusion Score (0–100): Jobs → Units → Absorption → Storage demand" },
        { icon: Target, text: "Forward-looking demand heatmap" },
      ],
      purpose: "Fuse economic signals into actionable demand intelligence.",
    },
    {
      id: 4,
      componentId: "COCK-STEP-004",
      title: "Feasibility & Go/No-Go",
      subtitle: "Final Verdict",
      icon: Calculator,
      color: "purple",
      status: "ready",
      link: "/calculator",
      linkText: "Open Calculator",
      description: "One button outcome — Build, Buy, or Walk.",
      features: [
        { icon: Calculator, text: "Build-vs-Buy calculator" },
        { icon: TrendingUp, text: "Land price max cap" },
        { icon: FileText, text: "Rent gap analysis" },
        { icon: Target, text: "Competitor rate checks" },
        { icon: Zap, text: "Saturation + ROI curves" },
      ],
      purpose: "Clear directive: BUILD, BUY, or WALK.",
    },
  ];

  const colorClasses: Record<string, Record<string, string>> = {
    amber: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      borderActive: "border-amber-500",
      text: "text-amber-500",
      icon: "text-amber-400",
      button: "bg-amber-500 hover:bg-amber-600 text-gray-900",
    },
    blue: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      borderActive: "border-blue-500",
      text: "text-blue-500",
      icon: "text-blue-400",
      button: "bg-blue-500 hover:bg-blue-600 text-white",
    },
    green: {
      bg: "bg-green-500/10",
      border: "border-green-500/30",
      borderActive: "border-green-500",
      text: "text-green-500",
      icon: "text-green-400",
      button: "bg-green-500 hover:bg-green-600 text-white",
    },
    purple: {
      bg: "bg-purple-500/10",
      border: "border-purple-500/30",
      borderActive: "border-purple-500",
      text: "text-purple-500",
      icon: "text-purple-400",
      button: "bg-purple-500 hover:bg-purple-600 text-white",
    },
  };

  return (
    <WithId id="COCK-001" name="Scouting Cockpit" className="flex-1 bg-background text-foreground min-h-screen">
      <section className="relative py-12 px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-background"></div>
        <div className="relative max-w-6xl mx-auto">
          <WithId id="COCK-HEAD-001" name="Cockpit Header" className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Target className="w-10 h-10 text-primary" />
              <h1 className="text-4xl font-bold tracking-tight">Scouting Cockpit</h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Two-pass recon mission: Pass 1 casts a 120-mile net; Pass 2 drills down on
              counties that deserve real attention. Everything here is designed for one thing —{" "}
              <span className="text-primary font-semibold">go / no-go clarity</span>.
            </p>
          </WithId>

          {stats && (
            <WithId id="COCK-STAT-001" name="Stats Summary" className="bg-card/50 rounded-xl border border-border p-4 mb-12">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">{stats.jurisdictions}</div>
                  <div className="text-muted-foreground text-xs">Counties Indexed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">{stats.states}</div>
                  <div className="text-muted-foreground text-xs">States</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {stats.facilities?.toLocaleString()}
                  </div>
                  <div className="text-muted-foreground text-xs">Facilities Tracked</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {stats.pipeline?.toLocaleString()}
                  </div>
                  <div className="text-muted-foreground text-xs">Pipeline Records</div>
                </div>
              </div>
            </WithId>
          )}

          <div className="space-y-6">
            {steps.map((step, idx) => {
              const colors = colorClasses[step.color];
              const Icon = step.icon;
              const isExpanded = activeStep === step.id;

              return (
                <WithId key={step.id} id={step.componentId} name={`Step ${step.id}: ${step.title}`} className="relative">
                  {idx < steps.length - 1 && (
                    <div className="absolute left-8 top-20 w-0.5 h-8 bg-border hidden md:block"></div>
                  )}

                  <div
                    className={`rounded-xl border transition-all cursor-pointer ${
                      isExpanded
                        ? `${colors.bg} ${colors.borderActive}`
                        : `bg-card/50 ${colors.border} hover:${colors.bg}`
                    }`}
                    onClick={() => setActiveStep(isExpanded ? null : step.id)}
                  >
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl ${colors.bg} ${colors.icon}`}>
                          <Icon className="w-8 h-8" />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                              STEP {step.id}
                            </span>
                            <span className="text-muted-foreground text-sm">{step.subtitle}</span>
                          </div>
                          <h3 className="text-xl font-bold text-foreground mb-2">{step.title}</h3>
                          <p className="text-muted-foreground">{step.description}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <ChevronRight
                            className={`w-5 h-5 text-muted-foreground transition-transform ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-6 pt-6 border-t border-border/50">
                          <div className="grid md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                                YOU GET:
                              </h4>
                              <ul className="space-y-2">
                                {step.features.map((feature, fidx) => {
                                  const FeatureIcon = feature.icon;
                                  return (
                                    <li key={fidx} className="flex items-center gap-2 text-foreground/80">
                                      <FeatureIcon className={`w-4 h-4 ${colors.icon}`} />
                                      <span className="text-sm">{feature.text}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                            <div className="flex flex-col justify-between">
                              <div>
                                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                                  PURPOSE:
                                </h4>
                                <p className={`${colors.text} font-medium`}>{step.purpose}</p>
                              </div>
                              <Link
                                to={step.link}
                                className={`inline-flex items-center justify-center gap-2 ${colors.button} font-semibold px-6 py-3 rounded-lg transition mt-4`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {step.linkText}
                                <ArrowRight className="w-4 h-4" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </WithId>
              );
            })}
          </div>

          <WithId id="COCK-CTA-001" name="Begin Scan CTA" className="mt-12 text-center">
            <p className="text-muted-foreground text-sm mb-4">Ready to start your recon mission?</p>
            <Link
              to="/screener"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-4 rounded-xl transition shadow-lg shadow-primary/20"
            >
              <Radar className="w-5 h-5" />
              Begin Wide-Area Scan
              <ArrowRight className="w-5 h-5" />
            </Link>
          </WithId>
        </div>
      </section>
    </WithId>
  );
}
