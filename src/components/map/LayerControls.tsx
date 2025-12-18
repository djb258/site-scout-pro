import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, Layers, TrendingUp } from "lucide-react";
import { useState } from "react";

export interface LayerState {
  radius: boolean;
  countyLines: boolean;
  countyLabels: boolean;
  zipPoints: boolean;
  zipLabels: boolean;
  demandHeatmap: boolean;
}

interface LayerControlsProps {
  centerZip: string;
  onCenterChange: (zip: string) => void;
  layers: LayerState;
  onLayerToggle: (layer: keyof LayerState) => void;
  stats: {
    countiesInRadius: number;
    zipsInRadius: number;
  };
  isLoading?: boolean;
}

const LayerControls = ({
  centerZip,
  onCenterChange,
  layers,
  onLayerToggle,
  stats,
  isLoading = false,
}: LayerControlsProps) => {
  const [zipInput, setZipInput] = useState(centerZip);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (zipInput.match(/^\d{5}$/)) {
      onCenterChange(zipInput);
    }
  };

  return (
    <div className="w-72 bg-card border-r border-border p-4 flex flex-col gap-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Layer Controls</h2>
      </div>

      {/* ZIP Search */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">Center on ZIP</Label>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value)}
            placeholder="Enter ZIP"
            maxLength={5}
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={isLoading}>
            <Search className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">Current: {centerZip}</p>
      </div>

      {/* Layer Toggles */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-muted-foreground">Visible Layers</Label>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="radius"
              checked={layers.radius}
              onCheckedChange={() => onLayerToggle("radius")}
            />
            <Label htmlFor="radius" className="text-sm cursor-pointer">
              120-Mile Radius
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="countyLines"
              checked={layers.countyLines}
              onCheckedChange={() => onLayerToggle("countyLines")}
            />
            <Label htmlFor="countyLines" className="text-sm cursor-pointer">
              County Boundaries
            </Label>
          </div>

          <div className="flex items-center gap-2 pl-6">
            <Checkbox
              id="countyLabels"
              checked={layers.countyLabels}
              onCheckedChange={() => onLayerToggle("countyLabels")}
              disabled={!layers.countyLines}
            />
            <Label 
              htmlFor="countyLabels" 
              className={`text-sm cursor-pointer ${!layers.countyLines ? 'text-muted-foreground/50' : ''}`}
            >
              County Labels
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="zipPoints"
              checked={layers.zipPoints}
              onCheckedChange={() => onLayerToggle("zipPoints")}
            />
            <Label htmlFor="zipPoints" className="text-sm cursor-pointer">
              ZIP Points
            </Label>
          </div>

          <div className="flex items-center gap-2 pl-6">
            <Checkbox
              id="zipLabels"
              checked={layers.zipLabels}
              onCheckedChange={() => onLayerToggle("zipLabels")}
              disabled={!layers.zipPoints}
            />
            <Label 
              htmlFor="zipLabels" 
              className={`text-sm cursor-pointer ${!layers.zipPoints ? 'text-muted-foreground/50' : ''}`}
            >
              ZIP Labels
            </Label>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Checkbox
              id="demandHeatmap"
              checked={layers.demandHeatmap}
              onCheckedChange={() => onLayerToggle("demandHeatmap")}
            />
            <Label htmlFor="demandHeatmap" className="text-sm cursor-pointer flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-amber-500" />
              Demand Heatmap
            </Label>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2 pt-4 border-t border-border">
        <Label className="text-sm font-medium text-muted-foreground">In Radius</Label>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-muted/50 p-2 rounded">
            <div className="text-2xl font-bold text-foreground">{stats.countiesInRadius}</div>
            <div className="text-xs text-muted-foreground">Counties</div>
          </div>
          <div className="bg-muted/50 p-2 rounded">
            <div className="text-2xl font-bold text-foreground">{stats.zipsInRadius}</div>
            <div className="text-xs text-muted-foreground">ZIP Codes</div>
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          Loading data...
        </div>
      )}
    </div>
  );
};

export default LayerControls;
