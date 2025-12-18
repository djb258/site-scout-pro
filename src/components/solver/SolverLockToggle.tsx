import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Lock, Unlock } from "lucide-react";

interface SolverLockToggleProps {
  isLocked: boolean;
  onLockChange: (locked: boolean) => void;
  disabled?: boolean;
}

export const SolverLockToggle = ({ isLocked, onLockChange, disabled }: SolverLockToggleProps) => {
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="lock-config"
        checked={isLocked}
        onCheckedChange={onLockChange}
        disabled={disabled}
      />
      <Label htmlFor="lock-config" className="flex items-center gap-1.5 cursor-pointer">
        {isLocked ? (
          <>
            <Lock className="h-4 w-4 text-primary" />
            <span className="text-sm">Locked for Audit</span>
          </>
        ) : (
          <>
            <Unlock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Draft Mode</span>
          </>
        )}
      </Label>
    </div>
  );
};
