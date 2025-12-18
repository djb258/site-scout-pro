import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SolverShell } from "@/components/solver/SolverShell";
import { ArrowLeft } from "lucide-react";

const Solver = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <div className="border-b border-border px-4 py-2">
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </Button>
        </Link>
      </div>

      {/* Solver Shell */}
      <div className="flex-1 overflow-hidden">
        <SolverShell />
      </div>
    </div>
  );
};

export default Solver;
