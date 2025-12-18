import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface SolverModeToggleProps {
  mode: 'FORWARD' | 'REVERSE';
  onModeChange: (mode: 'FORWARD' | 'REVERSE') => void;
  disabled?: boolean;
}

export const SolverModeToggle = ({ mode, onModeChange, disabled }: SolverModeToggleProps) => {
  return (
    <div className="flex items-center gap-6">
      <RadioGroup
        value={mode}
        onValueChange={(value) => onModeChange(value as 'FORWARD' | 'REVERSE')}
        className="flex gap-6"
        disabled={disabled}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="FORWARD" id="forward" />
          <Label htmlFor="forward" className="cursor-pointer">
            <span className="font-medium">Forward</span>
            <span className="text-muted-foreground text-sm ml-1">(Market → Capacity)</span>
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="REVERSE" id="reverse" />
          <Label htmlFor="reverse" className="cursor-pointer">
            <span className="font-medium">Reverse</span>
            <span className="text-muted-foreground text-sm ml-1">(Parcel → Capacity)</span>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
};
