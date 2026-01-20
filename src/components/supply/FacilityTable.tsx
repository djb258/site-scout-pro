import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Phone, Globe, CheckCircle, XCircle } from "lucide-react";

export interface Facility {
  facility_id: string;
  facility_name: string | null;
  address: string;
  phone: string | null;
  website_url: string | null;
  status: string;
  first_seen_at: string;
}

interface FacilityTableProps {
  facilities: Facility[];
  isLoading?: boolean;
}

export function FacilityTable({ facilities, isLoading }: FacilityTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (facilities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No facilities discovered for this ZIP yet.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Facility Name</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">First Seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {facilities.map((facility) => (
            <TableRow key={facility.facility_id}>
              <TableCell className="font-medium">
                {facility.facility_name || "Unnamed Facility"}
                <div className="text-xs text-muted-foreground font-mono">
                  {facility.facility_id}
                </div>
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {facility.address}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {facility.phone && (
                    <a 
                      href={`tel:${facility.phone}`}
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      <span className="text-xs">{facility.phone}</span>
                    </a>
                  )}
                  {facility.website_url && (
                    <a 
                      href={facility.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      <Globe className="w-4 h-4" />
                    </a>
                  )}
                  {!facility.phone && !facility.website_url && (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {facility.status === "active" ? (
                  <Badge variant="default">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <XCircle className="w-3 h-3 mr-1" />
                    Inactive
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {new Date(facility.first_seen_at).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
