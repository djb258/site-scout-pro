import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEdgeRelay } from "@/hooks/useEdgeRelay";
import { toast } from "sonner";
import { Upload, Link2, FileJson, Database } from "lucide-react";

export default function DataIngestion() {
  const { send, isLoading } = useEdgeRelay();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [apiHeaders, setApiHeaders] = useState("");
  const [apiMethod, setApiMethod] = useState("GET");

  const [uploadProgress, setUploadProgress] = useState<string>("");

  async function handleCsvUpload() {
    if (!csvFile) {
      toast.error("Please select a CSV file");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const firstLine = text.split("\n")[0]?.toLowerCase() || "";
      
      try {
        // Check if this is ZIP code data by looking at headers
        const isZipCodeData = firstLine.includes('"zip"') && firstLine.includes('"lat"') && firstLine.includes('"lng"');

        if (isZipCodeData) {
          setUploadProgress("Processing ZIP codes... This may take a minute.");
          toast.info("Starting bulk ZIP code upload...");
          
          // Use bulk loader for ZIP codes - sends raw CSV content
          const { data, error } = await supabase.functions.invoke('bulkLoadZips', {
            body: { csvContent: text }
          });
          
          if (error) throw error;
          
          setUploadProgress("");
          toast.success(`Successfully uploaded ${data.inserted} ZIP codes to database`);
        } else {
          // Use generic ingestion for other CSV types
          const rows = text.split("\n").map(row => row.split(","));
          await send({
            type: "csv_ingestion",
            filename: csvFile.name,
            rows: rows,
            timestamp: new Date().toISOString()
          });
          toast.success("CSV data sent to database");
        }
        
        setCsvFile(null);
      } catch (error) {
        console.error("CSV upload error:", error);
        setUploadProgress("");
        toast.error("Failed to ingest CSV: " + (error instanceof Error ? error.message : "Unknown error"));
      }
    };
    reader.readAsText(csvFile);
  }

  async function handleApiIngestion() {
    if (!apiUrl) {
      toast.error("Please enter an API URL");
      return;
    }

    try {
      const headers = apiHeaders ? JSON.parse(apiHeaders) : {};
      const apiResponse = await fetch(apiUrl, {
        method: apiMethod,
        headers: headers
      });
      const apiData = await apiResponse.json();

      await send({
        type: "api_ingestion",
        url: apiUrl,
        method: apiMethod,
        response: apiData,
        timestamp: new Date().toISOString()
      });
      toast.success("API data sent to database");
      setApiUrl("");
      setApiHeaders("");
    } catch (error) {
      toast.error("Failed to ingest API data");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Data Ingestion</h1>
          <p className="text-muted-foreground">Upload CSV files or connect to external APIs</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CSV Upload Section */}
          <Card className="border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                <CardTitle>CSV Upload</CardTitle>
              </div>
              <CardDescription>Upload and process CSV files</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="csv-file">Select CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="mt-2"
                />
              </div>
              {csvFile && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                  <FileJson className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{csvFile.name}</span>
                </div>
              )}
              {uploadProgress && (
                <div className="p-3 bg-primary/10 rounded-md border border-primary/20">
                  <span className="text-sm text-primary">{uploadProgress}</span>
                </div>
              )}
              <Button 
                onClick={handleCsvUpload} 
                disabled={!csvFile || isLoading || !!uploadProgress}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploadProgress ? "Processing..." : isLoading ? "Uploading..." : "Upload CSV"}
              </Button>
            </CardContent>
          </Card>

          {/* API Ingestion Section */}
          <Card className="border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-primary" />
                <CardTitle>API Ingestion</CardTitle>
              </div>
              <CardDescription>Connect to external APIs and fetch data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="api-url">API URL</Label>
                <Input
                  id="api-url"
                  type="url"
                  placeholder="https://api.example.com/data"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="api-method">Method</Label>
                <select
                  id="api-method"
                  value={apiMethod}
                  onChange={(e) => setApiMethod(e.target.value)}
                  className="mt-2 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
              <div>
                <Label htmlFor="api-headers">Headers (JSON)</Label>
                <Textarea
                  id="api-headers"
                  placeholder='{"Authorization": "Bearer token"}'
                  value={apiHeaders}
                  onChange={(e) => setApiHeaders(e.target.value)}
                  className="mt-2 font-mono text-xs"
                  rows={3}
                />
              </div>
              <Button 
                onClick={handleApiIngestion} 
                disabled={!apiUrl || isLoading}
                className="w-full"
              >
                <Database className="w-4 h-4 mr-2" />
                {isLoading ? "Ingesting..." : "Fetch & Ingest"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 border-border bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Data uploaded via CSV or fetched from APIs is sent through the generic edge relay 
              to Neon database. All ingestion activity is logged in the <code className="px-1 py-0.5 bg-background rounded text-xs">generic_ingest_log</code> table.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
