import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, MapPin, Calendar, Tag, Shield, Radio } from "lucide-react";
import { format } from "date-fns";

interface SignalRow {
  signal_id: string;
  zip_code: string;
  signal_type: string;
  source_name: string;
  source_url: string | null;
  raw_excerpt: string | null;
  signal_strength_hint: "low" | "medium" | "high" | null;
  signal_category_version: string;
  observed_at: string;
}

interface SignalDetailDrawerProps {
  signal: SignalRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getStrengthBadge = (strength: string | null) => {
  switch (strength) {
    case "high":
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">High</Badge>;
    case "medium":
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">Medium</Badge>;
    case "low":
      return <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/30">Low</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
};

const getTypeBadge = (type: string) => {
  const typeColors: Record<string, string> = {
    news: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    permit: "bg-purple-500/10 text-purple-600 border-purple-500/30",
    infrastructure: "bg-orange-500/10 text-orange-600 border-orange-500/30",
    growth: "bg-green-500/10 text-green-600 border-green-500/30",
    storage: "bg-pink-500/10 text-pink-600 border-pink-500/30",
  };
  return (
    <Badge className={typeColors[type] || "bg-muted text-muted-foreground"}>
      {type}
    </Badge>
  );
};

export function SignalDetailDrawer({ signal, open, onOpenChange }: SignalDetailDrawerProps) {
  if (!signal) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            <SheetTitle>Signal Detail</SheetTitle>
          </div>
          <SheetDescription className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono">
              {signal.signal_id.slice(0, 8)}
            </Badge>
            <span className="text-xs text-muted-foreground">Read-only</span>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Type & Strength */}
          <div className="flex items-center gap-3">
            {getTypeBadge(signal.signal_type)}
            {getStrengthBadge(signal.signal_strength_hint)}
            <Badge variant="outline" className="text-xs">
              {signal.signal_category_version}
            </Badge>
          </div>

          <Separator />

          {/* ZIP Code */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>ZIP Code</span>
            </div>
            <p className="font-mono font-medium">{signal.zip_code}</p>
          </div>

          {/* Source */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Tag className="h-4 w-4" />
              <span>Source</span>
            </div>
            <p className="font-medium">{signal.source_name}</p>
            {signal.source_url && (
              <a
                href={signal.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                View Source
              </a>
            )}
          </div>

          {/* Excerpt */}
          {signal.raw_excerpt && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Raw Excerpt</span>
              </div>
              <p className="text-sm bg-muted/50 p-3 rounded-md">{signal.raw_excerpt}</p>
            </div>
          )}

          {/* Observed At */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Observed</span>
            </div>
            <p className="text-sm">
              {format(new Date(signal.observed_at), "PPP 'at' p")}
            </p>
          </div>

          <Separator />

          {/* Doctrine Reminder */}
          <div className="bg-muted/30 p-3 rounded-md text-xs text-muted-foreground">
            <p className="font-medium mb-1">Doctrine Reminder</p>
            <p>
              This signal is smoke, not a conclusion. Pass 0 only answers "where should we look
              next"—never "should we build."
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
