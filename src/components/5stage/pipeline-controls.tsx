import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface PipelineControlsProps {
  useForwarding: boolean;
  onForwardingChange: (checked: boolean) => void;
  onTick: (stopAt: number | undefined) => void;
  onReset: () => void;
}

export function PipelineControls({
  useForwarding,
  onForwardingChange,
  onTick,
  onReset,
}: PipelineControlsProps) {
  const [breakpoint, setBreakpoint] = useState<number>(0);

  return (
    <div className="flex flex-wrap gap-4 items-center justify-center p-2 border rounded-lg bg-slate-50 dark:bg-slate-900 w-fit mx-auto">
      <div className="flex gap-2">
        <Button
          onClick={() => {
            onTick(undefined);
          }}
        >
          Step
        </Button>
        <Button
          onClick={() => {
            onTick(-1);
          }}
        >
          Run to End
        </Button>
      </div>

      <div className="flex items-center gap-2 border-l pl-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="breakpoint-input" className="whitespace-nowrap">
            Breakpoint:
          </Label>
          <Input
            id="breakpoint-input"
            type="number"
            className="w-16 h-9"
            value={breakpoint}
            onChange={(e) => {
              setBreakpoint(parseInt(e.target.value) || 0);
            }}
          />
        </div>
        <Button
          onClick={() => {
            onTick(breakpoint);
          }}
          variant="outline"
          disabled={breakpoint === 0}
          className="whitespace-nowrap"
        >
          Run to BP
        </Button>
      </div>

      <div className="flex items-center gap-2 border-l pl-4">
        <Button onClick={onReset} variant="destructive" size="sm">
          Reset
        </Button>
      </div>

      <div className="flex items-center gap-2 border-l pl-4">
        <Switch
          id="forward-mode"
          checked={useForwarding}
          onCheckedChange={onForwardingChange}
        />
        <Label htmlFor="forward-mode" className="cursor-pointer">
          Forward Mode
        </Label>
      </div>
    </div>
  );
}
