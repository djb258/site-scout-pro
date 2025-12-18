import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  MapPin, 
  Phone, 
  DollarSign,
  Square,
  Calculator,
  Ruler
} from "lucide-react";

// Individual unit size with price
export interface UnitSize {
  dimensions: string;      // e.g., "10x10", "10x20", "5x10"
  width: number;           // in feet
  depth: number;           // in feet
  sqft: number;            // width * depth
  price: number;           // monthly rate
  price_per_sqft: number;  // price / sqft
}

// Data structure for competitor information we want to collect
export interface CompetitorData {
  id: string;                     // Unique identifier (UUID)
  name: string;
  address: string;
  zip: string;
  lat: number | null;             // Latitude for map
  lng: number | null;             // Longitude for map
  phone: string | null;
  url: string | null;             // Competitor website URL
  units: UnitSize[];              // All unit sizes with prices
  total_sqft: number | null;      // Total facility square footage (if available)
  distance_miles?: number;
  source?: string;                // Where we got the data (e.g., "perplexity", "manual")
  fetched_at?: string;            // ISO timestamp when data was collected
}

// Helper to parse dimensions string like "10x10" into width/depth
export function parseDimensions(dimensions: string): { width: number; depth: number } | null {
  const match = dimensions.toLowerCase().match(/(\d+)\s*[x×]\s*(\d+)/);
  if (!match) return null;
  return { width: parseInt(match[1]), depth: parseInt(match[2]) };
}

// Helper to create a UnitSize from dimensions and price
export function createUnitSize(dimensions: string, price: number): UnitSize | null {
  const parsed = parseDimensions(dimensions);
  if (!parsed) return null;
  
  const sqft = parsed.width * parsed.depth;
  return {
    dimensions: `${parsed.width}x${parsed.depth}`,
    width: parsed.width,
    depth: parsed.depth,
    sqft,
    price,
    price_per_sqft: price / sqft
  };
}

// Calculated metrics derived from the collected data
export interface CompetitorMetrics {
  avg_price_per_sqft: number | null;
  min_price_per_sqft: number | null;
  max_price_per_sqft: number | null;
  unit_count: number;
}

// Helper to calculate metrics from units
export function calculateCompetitorMetrics(data: CompetitorData): CompetitorMetrics {
  if (data.units.length === 0) {
    return {
      avg_price_per_sqft: null,
      min_price_per_sqft: null,
      max_price_per_sqft: null,
      unit_count: 0
    };
  }

  const prices = data.units.map(u => u.price_per_sqft);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  
  return {
    avg_price_per_sqft: avg,
    min_price_per_sqft: Math.min(...prices),
    max_price_per_sqft: Math.max(...prices),
    unit_count: data.units.length
  };
}

interface CompetitorCardProps {
  competitor: CompetitorData;
  index?: number;
}

export function CompetitorCard({ competitor, index }: CompetitorCardProps) {
  const metrics = calculateCompetitorMetrics(competitor);
  
  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return `$${value.toFixed(2)}`;
  };

  const formatNumber = (value: number | null) => {
    if (value === null) return "—";
    return value.toLocaleString();
  };

  return (
    <Card className="border-border bg-card/50 hover:bg-card/80 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">
              {competitor.name}
            </CardTitle>
          </div>
          {index !== undefined && (
            <Badge variant="outline" className="text-xs">
              #{index + 1}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Location Info */}
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-foreground">{competitor.address}</p>
              <p className="text-muted-foreground">ZIP: {competitor.zip}</p>
            </div>
          </div>
          
          {competitor.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">{competitor.phone}</span>
            </div>
          )}
          
          {competitor.distance_miles !== undefined && (
            <Badge variant="secondary" className="text-xs">
              {competitor.distance_miles.toFixed(1)} mi away
            </Badge>
          )}
        </div>

        <Separator />

        {/* Unit Sizes Table */}
        {competitor.units.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Ruler className="h-3 w-3" />
              Unit Sizes ({competitor.units.length})
            </p>
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Size</th>
                    <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Sqft</th>
                    <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Price</th>
                    <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">$/Sqft</th>
                  </tr>
                </thead>
                <tbody>
                  {competitor.units.map((unit, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1.5 text-foreground">{unit.dimensions}</td>
                      <td className="px-2 py-1.5 text-right text-foreground">{unit.sqft}</td>
                      <td className="px-2 py-1.5 text-right text-foreground">${unit.price}</td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground">${unit.price_per_sqft.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No unit pricing available</p>
        )}

        <Separator />

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          {/* Avg Price/Sqft */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calculator className="h-3 w-3" />
              Avg $/Sqft
            </p>
            <p className="text-sm font-medium text-foreground">
              {formatCurrency(metrics.avg_price_per_sqft)}
            </p>
          </div>

          {/* Price Range */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Range
            </p>
            <p className="text-sm font-medium text-foreground">
              {metrics.min_price_per_sqft && metrics.max_price_per_sqft 
                ? `$${metrics.min_price_per_sqft.toFixed(2)} - $${metrics.max_price_per_sqft.toFixed(2)}`
                : "—"}
            </p>
          </div>
          
          {/* Total Sqft */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Square className="h-3 w-3" />
              Total Sqft
            </p>
            <p className="text-sm font-medium text-foreground">
              {formatNumber(competitor.total_sqft)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Summary card showing aggregated competitor data
interface CompetitorSummaryProps {
  competitors: CompetitorData[];
}

export function CompetitorSummary({ competitors }: CompetitorSummaryProps) {
  const allUnits = competitors.flatMap(c => c.units);
  const allMetrics = competitors.map(calculateCompetitorMetrics);
  
  // Calculate market averages
  const validAvgPrices = allMetrics.filter(m => m.avg_price_per_sqft !== null).map(m => m.avg_price_per_sqft!);
  const validTotalSqft = competitors.filter(c => c.total_sqft !== null).map(c => c.total_sqft!);

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const sum = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) : null;

  const marketAvgPerSqft = avg(validAvgPrices);
  const totalMarketSqft = sum(validTotalSqft);
  const totalUnitTypes = allUnits.length;
  
  // Find most common unit sizes
  const sizeCounts = allUnits.reduce((acc, unit) => {
    acc[unit.dimensions] = (acc[unit.dimensions] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topSizes = Object.entries(sizeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([size]) => size);

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return `$${value.toFixed(2)}`;
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Market Summary ({competitors.length} facilities)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Avg $/Sqft</p>
            <p className="text-lg font-semibold">{formatCurrency(marketAvgPerSqft)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Market Sqft</p>
            <p className="text-lg font-semibold">
              {totalMarketSqft ? totalMarketSqft.toLocaleString() : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Unit Types Found</p>
            <p className="text-lg font-semibold">{totalUnitTypes}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Common Sizes</p>
            <p className="text-sm font-medium">
              {topSizes.length > 0 ? topSizes.join(", ") : "—"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
