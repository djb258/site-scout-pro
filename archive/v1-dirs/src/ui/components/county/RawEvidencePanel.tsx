import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card";
import { Button } from "@/ui/components/ui/button";
import { Badge } from "@/ui/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";
import { Input } from "@/ui/components/ui/input";
import { Textarea } from "@/ui/components/ui/textarea";
import { Label } from "@/ui/components/ui/label";
import { Plus, FileText, Globe, Phone, Mail, Edit3, Link2, AlertCircle } from "lucide-react";
import { supabase } from "@/data/integrations/supabase/client";
import { toast } from "sonner";

interface RawSource {
  raw_id: string;
  source_type: string;
  source_url: string | null;
  raw_payload: Record<string, unknown>;
  collected_at: string;
  collected_by: string;
  is_linked: boolean;
}

interface RawEvidencePanelProps {
  countyFips: string;
  sources: RawSource[];
  onSourceAdded: () => void;
}

const SOURCE_TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; confidence: number }> = {
  ordinance: { icon: <FileText className="h-4 w-4" />, label: "Ordinance", confidence: 90 },
  website: { icon: <Globe className="h-4 w-4" />, label: "Website", confidence: 80 },
  pdf: { icon: <FileText className="h-4 w-4" />, label: "PDF", confidence: 85 },
  call: { icon: <Phone className="h-4 w-4" />, label: "Phone Call", confidence: 70 },
  email: { icon: <Mail className="h-4 w-4" />, label: "Email", confidence: 70 },
  manual: { icon: <Edit3 className="h-4 w-4" />, label: "Manual", confidence: 40 },
};

export function RawEvidencePanel({ countyFips, sources, onSourceAdded }: RawEvidencePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    source_type: "website",
    source_url: "",
    raw_text: "",
    notes: "",
  });

  const handleSubmit = async () => {
    if (!formData.raw_text.trim()) {
      toast.error("Please enter evidence content");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("county_card_add_raw", {
        body: {
          county_fips: countyFips,
          source_type: formData.source_type,
          source_url: formData.source_url || null,
          raw_payload: {
            raw_text: formData.raw_text,
            notes: formData.notes || null,
          },
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to add source");

      toast.success("Raw evidence added");
      setFormData({ source_type: "website", source_url: "", raw_text: "", notes: "" });
      setIsOpen(false);
      onSourceAdded();
    } catch (err) {
      console.error("Error adding raw evidence:", err);
      toast.error(err instanceof Error ? err.message : "Failed to add evidence");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">Raw Evidence</CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add Source
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Raw Evidence</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Source Type</Label>
                <Select
                  value={formData.source_type}
                  onValueChange={(value) => setFormData((f) => ({ ...f, source_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOURCE_TYPE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          {config.icon}
                          <span>{config.label}</span>
                          <span className="text-xs text-muted-foreground">
                            (confidence: {config.confidence})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Source URL (optional)</Label>
                <Input
                  placeholder="https://example.gov/zoning.pdf"
                  value={formData.source_url}
                  onChange={(e) => setFormData((f) => ({ ...f, source_url: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Evidence Content *</Label>
                <Textarea
                  placeholder="Paste or type the raw evidence text..."
                  rows={6}
                  value={formData.raw_text}
                  onChange={(e) => setFormData((f) => ({ ...f, raw_text: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input
                  placeholder="Additional context about this source"
                  value={formData.notes}
                  onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-muted rounded-md text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Raw evidence is append-only. It cannot be edited after save.</span>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add Evidence"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {sources.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No evidence collected yet. Add sources to build the County Card.
          </div>
        ) : (
          <div className="space-y-3">
            {sources.map((source) => {
              const config = SOURCE_TYPE_CONFIG[source.source_type] || SOURCE_TYPE_CONFIG.manual;
              const payload = source.raw_payload as { raw_text?: string; notes?: string };
              
              return (
                <div
                  key={source.raw_id}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {config.icon}
                      <span className="font-medium">{config.label}</span>
                      {source.is_linked && (
                        <Badge variant="secondary" className="text-xs">
                          <Link2 className="h-3 w-3 mr-1" />
                          Linked
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(source.collected_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {source.source_url && (
                    <a
                      href={source.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline block truncate"
                    >
                      {source.source_url}
                    </a>
                  )}
                  
                  {payload?.raw_text && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {payload.raw_text}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
