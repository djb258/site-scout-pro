import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  Loader2,
  ArrowLeft,
  Search,
  Building2,
  TreePine,
  Factory,
  Settings,
} from "lucide-react";
import { WithId } from "@/components/hive/WithId";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  status: "pending" | "loading" | "complete" | "warning" | "failed";
  value: string | null;
}

const initialChecklist: ChecklistItem[] = [
  { id: "geo_boundary", category: "GEOGRAPHY", label: "ZIP boundary loaded", status: "pending", value: null },
  { id: "geo_county", category: "GEOGRAPHY", label: "County identified", status: "pending", value: null },
  { id: "geo_coords", category: "GEOGRAPHY", label: "Coordinates", status: "pending", value: null },
  { id: "demo_pop", category: "DEMOGRAPHICS", label: "Population", status: "pending", value: null },
  { id: "demo_density", category: "DEMOGRAPHICS", label: "Density", status: "pending", value: null },
  { id: "demo_hhi", category: "DEMOGRAPHICS", label: "Median HHI", status: "pending", value: null },
  { id: "supply_facilities", category: "SUPPLY", label: "Storage facilities", status: "pending", value: null },
  { id: "supply_details", category: "SUPPLY", label: "Facility details", status: "pending", value: null },
  { id: "demand_housing", category: "DEMAND", label: "Housing communities", status: "pending", value: null },
  { id: "demand_pipeline", category: "DEMAND", label: "Pipeline projects", status: "pending", value: null },
  { id: "anchor_hospitals", category: "ANCHORS", label: "Hospitals & Employers", status: "pending", value: null },
  { id: "anchor_universities", category: "ANCHORS", label: "Universities", status: "pending", value: null },
  { id: "anchor_campgrounds", category: "ANCHORS", label: "RV Parks/Campgrounds", status: "pending", value: null },
  { id: "market_counties", category: "MARKET", label: "Top counties", status: "pending", value: null },
];

export default function Screener() {
  const navigate = useNavigate();
  const [state, setState] = useState<"input" | "loading" | "complete">("input");
  const [zipCode, setZipCode] = useState("");
  const [zipError, setZipError] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialChecklist);
  const abortRef = useRef(false);

  const [urbanExclude, setUrbanExclude] = useState(false);
  const [multifamilyPriority, setMultifamilyPriority] = useState(false);
  const [recreationLoad, setRecreationLoad] = useState(false);
  const [industrialMomentum, setIndustrialMomentum] = useState(false);
  const [analysisMode, setAnalysisMode] = useState("compare");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedZip = localStorage.getItem("hive_current_zip");
    if (savedZip) setZipCode(savedZip);
  }, []);

  useEffect(() => {
    if (state === "input" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state]);

  const completedCount = checklist.filter((item) => item.status === "complete").length;
  const totalCount = checklist.length;
  const progressPercent = (completedCount / totalCount) * 100;

  const validateZip = (zip: string) => /^\d{5}$/.test(zip);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateZip(zipCode)) {
      setZipError("Please enter a valid 5-digit ZIP code");
      return;
    }
    setZipError("");
    setState("loading");
    abortRef.current = false;
    localStorage.setItem("hive_current_zip", zipCode);
    simulateDataFetch();
  };

  const updateChecklistItem = (itemId: string, status: ChecklistItem["status"], value: string | null = null) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, status, value } : item))
    );
  };

  const simulateDataFetch = async () => {
    // Simulate loading each checklist item
    for (const item of initialChecklist) {
      if (abortRef.current) return;
      updateChecklistItem(item.id, "loading");
      await new Promise((r) => setTimeout(r, 150 + Math.random() * 200));
      updateChecklistItem(item.id, "complete", "loaded");
    }
    
    if (!abortRef.current) {
      setState("complete");
      setTimeout(() => navigate(`/map?zip=${zipCode}`), 500);
    }
  };

  const handleCancel = () => {
    abortRef.current = true;
    setState("input");
    setChecklist(initialChecklist);
  };

  const handleNewSearch = () => {
    setState("input");
    setZipCode("");
    setChecklist(initialChecklist);
  };

  const getStatusIcon = (status: ChecklistItem["status"]) => {
    switch (status) {
      case "complete": return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "loading": return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      case "warning": return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case "failed": return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const groupedChecklist = checklist.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <WithId id="SCRN-001" name="Screener Page" className="flex-1 bg-background text-foreground min-h-screen">
      <div className="w-full px-12 py-10">
        <div className="flex justify-between items-center mb-10">
          {state === "input" && (
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition text-lg">
              <ArrowLeft className="w-5 h-5" />
              Back
            </Link>
          )}
          {state === "loading" && (
            <button onClick={handleCancel} className="flex items-center gap-2 text-red-400 hover:text-red-300 transition text-lg">
              <XCircle className="w-5 h-5" />
              Cancel
            </button>
          )}
          {state === "complete" && (
            <button onClick={handleNewSearch} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition text-lg">
              <ArrowLeft className="w-5 h-5" />
              New Search
            </button>
          )}
          <div></div>
        </div>

        {state === "input" && (
          <div className="py-6">
            <div className="text-center mb-16">
              <h2 className="text-5xl font-bold mb-4">Analyze a Location</h2>
              <p className="text-muted-foreground text-xl">Enter a ZIP code and configure analysis options</p>
            </div>

            <form onSubmit={handleSubmit} className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <WithId id="SCRN-ZIP-001" name="ZIP Input" className="bg-card rounded-2xl p-10 border border-border">
                  <label htmlFor="zipCode" className="block text-lg font-medium text-muted-foreground mb-4">
                    ZIP Code
                  </label>
                  <div className="relative mb-8">
                    <input
                      ref={inputRef}
                      type="text"
                      id="zipCode"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                      placeholder="e.g., 15522"
                      maxLength={5}
                      autoFocus
                      className="w-full bg-secondary border border-border rounded-xl px-6 py-5 text-2xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
                    />
                    <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-7 h-7 text-muted-foreground" />
                  </div>

                  <div className="border-t border-border pt-8">
                    <h3 className="text-lg font-semibold text-muted-foreground tracking-wider mb-6">ANALYSIS MODE</h3>
                    <div className="grid grid-cols-1 gap-4">
                      {[
                        { value: "build", label: "Build New", desc: "Analyze sites for new construction" },
                        { value: "buy", label: "Acquire Existing", desc: "Find acquisition opportunities" },
                        { value: "compare", label: "Compare Both", desc: "Full market analysis" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setAnalysisMode(option.value)}
                          className={`py-5 px-6 rounded-xl text-left transition ${
                            analysisMode === option.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-foreground hover:bg-secondary/80"
                          }`}
                        >
                          <div className="font-semibold text-lg">{option.label}</div>
                          <div className={`text-sm mt-1 ${analysisMode === option.value ? "opacity-80" : "text-muted-foreground"}`}>
                            {option.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </WithId>

                <WithId id="SCRN-OPT-001" name="Analysis Options" className="bg-card rounded-2xl p-10 border border-border">
                  <div className="flex items-center gap-3 mb-8">
                    <Settings className="w-6 h-6 text-primary" />
                    <h3 className="text-lg font-semibold text-muted-foreground tracking-wider">ANALYSIS OPTIONS</h3>
                  </div>

                  <div className="space-y-6">
                    <Toggle enabled={urbanExclude} onChange={setUrbanExclude} label="Exclude urban areas from analysis" icon={Building2} />
                    <Toggle enabled={multifamilyPriority} onChange={setMultifamilyPriority} label="Prioritize multifamily housing demand" icon={Building2} />
                    <Toggle enabled={recreationLoad} onChange={setRecreationLoad} label="Include recreational demand (lakes, RV parks)" icon={TreePine} />
                    <Toggle enabled={industrialMomentum} onChange={setIndustrialMomentum} label="Include industrial growth (factories, logistics)" icon={Factory} />
                  </div>

                  <div className="mt-10 pt-8 border-t border-border">
                    {zipError && <p className="text-red-400 text-base mb-6">{zipError}</p>}

                    <button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-5 rounded-xl transition flex items-center justify-center gap-3 text-xl"
                    >
                      <Search className="w-6 h-6" />
                      Analyze Location
                    </button>

                    <p className="text-muted-foreground text-base mt-6 text-center">
                      Try: 15522 (Bedford, PA) or 25401 (Martinsburg, WV)
                    </p>
                  </div>
                </WithId>
              </div>
            </form>
          </div>
        )}

        {(state === "loading" || state === "complete") && (
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold">Analyzing ZIP: {zipCode}</h2>
            </div>

            <div className="bg-card rounded-2xl p-8 border border-border">
              <div className="mb-6">
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-center text-muted-foreground mt-2">
                  {completedCount} of {totalCount} complete
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {Object.entries(groupedChecklist).map(([category, items]) => (
                  <div key={category}>
                    <h4 className="text-xs font-bold text-muted-foreground tracking-wider mb-3">{category}</h4>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3">
                          {getStatusIcon(item.status)}
                          <span className={item.status === "complete" ? "text-foreground" : "text-muted-foreground"}>
                            {item.label}
                          </span>
                          {item.value && <span className="text-muted-foreground text-sm ml-auto">{item.value}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {state === "complete" && (
                <div className="mt-8 p-6 bg-green-500/20 border border-green-500/30 rounded-xl text-center">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-green-400 font-semibold">Analysis Complete! Redirecting to map...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </WithId>
  );
}

interface ToggleProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function Toggle({ enabled, onChange, label, icon: Icon }: ToggleProps) {
  return (
    <label className="flex items-center justify-between cursor-pointer group py-2 px-3 rounded-lg hover:bg-secondary/50 transition">
      <div className="flex items-center gap-4">
        <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition" />
        <span className="text-foreground/80 group-hover:text-foreground transition text-base">{label}</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ml-4 ${
          enabled ? "bg-primary" : "bg-secondary"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}
