import { Link } from "react-router-dom";
import { Badge } from "@/ui/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/components/ui/table";
import { MapPin, ChevronRight, Warehouse } from "lucide-react";
import { type ZipDataState, getStateBadgeProps } from "@/app/utils_legacy/zipStateClassifier";

export interface SvaZip {
  id: string;
  zip: string;
  distance_miles: number;
  population: number | null;
  demand_sqft: number | null;
}

export interface SvaZipWithState extends SvaZip {
  facility_count: number;
  oldest_seen_at: string | null;
  state: ZipDataState;
}

interface ZipSelectorProps {
  zips: SvaZipWithState[];
  isLoading?: boolean;
}

export function ZipSelector({ zips, isLoading }: ZipSelectorProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (zips.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No ZIPs found for this SVA. Create a Sovereign ID first to define your market scope.
      </div>
    );
  }

  // Sort by distance
  const sortedZips = [...zips].sort((a, b) => a.distance_miles - b.distance_miles);

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>ZIP Code</TableHead>
            <TableHead className="text-right">Distance</TableHead>
            <TableHead className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Warehouse className="w-3.5 h-3.5" />
                Facilities
              </div>
            </TableHead>
            <TableHead className="text-center">State</TableHead>
            <TableHead className="text-right">Population</TableHead>
            <TableHead className="text-right">Demand</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedZips.map((zip) => {
            const badgeProps = getStateBadgeProps(zip.state);
            return (
              <TableRow key={zip.id} className="hover:bg-muted/30">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="font-mono font-medium">{zip.zip}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline">
                    {zip.distance_miles.toFixed(1)} mi
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-mono font-semibold">
                    {zip.facility_count}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge 
                    variant={badgeProps.variant}
                    className={badgeProps.className}
                  >
                    {badgeProps.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {zip.population?.toLocaleString() || "—"}
                </TableCell>
                <TableCell className="text-right">
                  {zip.demand_sqft ? `${zip.demand_sqft.toLocaleString()} sqft` : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    to={`/supply/zip/${zip.zip}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                  >
                    View
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
