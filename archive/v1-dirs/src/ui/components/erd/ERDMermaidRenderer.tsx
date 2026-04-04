import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

interface ERDMermaidRendererProps {
  chart: string;
  className?: string;
}

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    primaryColor: "#3b82f6",
    primaryTextColor: "#f8fafc",
    primaryBorderColor: "#475569",
    lineColor: "#94a3b8",
    secondaryColor: "#1e293b",
    tertiaryColor: "#0f172a",
    background: "#020817",
    mainBkg: "#1e293b",
    nodeBorder: "#475569",
    clusterBkg: "#1e293b",
    titleColor: "#f8fafc",
    edgeLabelBackground: "#1e293b",
  },
  er: {
    useMaxWidth: true,
    layoutDirection: "TB",
  },
});

export function ERDMermaidRenderer({ chart, className = "" }: ERDMermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string>("");

  useEffect(() => {
    const renderChart = async () => {
      if (!chart || !containerRef.current) return;

      try {
        setError(null);
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, chart);
        setSvgContent(svg);
      } catch (err) {
        console.error("Mermaid render error:", err);
        setError(err instanceof Error ? err.message : "Failed to render diagram");
      }
    };

    renderChart();
  }, [chart]);

  if (error) {
    return (
      <div className={`p-4 bg-destructive/10 border border-destructive rounded-lg ${className}`}>
        <p className="text-destructive text-sm font-mono">Diagram render error: {error}</p>
        <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-32">{chart}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto bg-background/50 rounded-lg p-4 ${className}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
