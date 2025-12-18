import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  MapPin, 
  Phone, 
  DollarSign,
  Square,
  Calculator
} from "lucide-react";

// Data structure for competitor information we want to collect
export interface CompetitorData {
  name: string;
  address: string;
  zip: string;
  phone: string | null;
  price_10x10: number | null;      // Monthly rate for 10x10 unit
  price_10x20: number | null;      // Monthly rate for 10x20 unit
  total_sqft: number | null;       // Total facility square footage
  distance_miles?: number;
}

// Calculated fields derived from the collected data
export interface CompetitorCalculated extends CompetitorData {
  price_per_sqft_10x10: number | null;  // price_10x10 / 100
  price_per_sqft_10x20: number | null;  // price_10x20 / 200
  avg_price_per_sqft: number | null;    // Average of both
}

// Helper to calculate price per sqft
export function calculateCompetitorMetrics(data: CompetitorData): CompetitorCalculated {
  const price_per_sqft_10x10 = data.price_10x10 ? data.price_10x10 / 100 : null;
  const price_per_sqft_10x20 = data.price_10x20 ? data.price_10x20 / 200 : null;
  
  let avg_price_per_sqft: number | null = null;
  if (price_per_sqft_10x10 && price_per_sqft_10x20) {
    avg_price_per_sqft = (price_per_sqft_10x10 + price_per_sqft_10x20) / 2;
  } else if (price_per_sqft_10x10) {
    avg_price_per_sqft = price_per_sqft_10x10;
  } else if (price_per_sqft_10x20) {
    avg_price_per_sqft = price_per_sqft_10x20;
  }

  return {
    ...data,
    price_per_sqft_10x10,
    price_per_sqft_10x20,
    avg_price_per_sqft
  };
}

interface CompetitorCardProps {
  competitor: CompetitorData;
  index?: number;
}

export function CompetitorCard({ competitor, index }: CompetitorCardProps) {
  const calculated = calculateCompetitorMetrics(competitor);
  
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

        {/* Pricing Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* 10x10 Pricing */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              10×10 Rate
            </p>
            <p className="text-lg font-semibold text-foreground">
              {formatCurrency(competitor.price_10x10)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(calculated.price_per_sqft_10x10)}/sqft
            </p>
          </div>
          
          {/* 10x20 Pricing */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              10×20 Rate
            </p>
            <p className="text-lg font-semibold text-foreground">
              {formatCurrency(competitor.price_10x20)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(calculated.price_per_sqft_10x20)}/sqft
            </p>
          </div>
        </div>

        <Separator />

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
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
          
          {/* Avg Price/Sqft */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calculator className="h-3 w-3" />
              Avg $/Sqft
            </p>
            <p className="text-sm font-medium text-foreground">
              {formatCurrency(calculated.avg_price_per_sqft)}
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
  const calculated = competitors.map(calculateCompetitorMetrics);
  
  // Calculate averages
  const validPrices10x10 = calculated.filter(c => c.price_10x10 !== null).map(c => c.price_10x10!);
  const validPrices10x20 = calculated.filter(c => c.price_10x20 !== null).map(c => c.price_10x20!);
  const validAvgPerSqft = calculated.filter(c => c.avg_price_per_sqft !== null).map(c => c.avg_price_per_sqft!);
  const validTotalSqft = calculated.filter(c => c.total_sqft !== null).map(c => c.total_sqft!);

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const sum = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) : null;

  const avg10x10 = avg(validPrices10x10);
  const avg10x20 = avg(validPrices10x20);
  const avgPerSqft = avg(validAvgPerSqft);
  const totalMarketSqft = sum(validTotalSqft);

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
            <p className="text-xs text-muted-foreground">Avg 10×10</p>
            <p className="text-lg font-semibold">{formatCurrency(avg10x10)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg 10×20</p>
            <p className="text-lg font-semibold">{formatCurrency(avg10x20)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg $/Sqft</p>
            <p className="text-lg font-semibold">{formatCurrency(avgPerSqft)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Market Sqft</p>
            <p className="text-lg font-semibold">
              {totalMarketSqft ? totalMarketSqft.toLocaleString() : "—"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
