import { useCallback, useRef, useState } from "react";
import {
  ForwardDetail,
  HazardCallback,
  Pipeline,
} from "../lib/simulator/pipeline";
import { InstructionMemory } from "../lib/simulator/instruction";
import {
  InstWithStage,
  parseInstWithStage,
} from "../lib/pipeline-parsers/instruction-list";
import { InstructionList } from "./instruction-list";
import { PipelineView } from "./pipeline-view";
import { InstructionInput } from "./instruction-input";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const DEFAULT_INSTRUCTION = `
load $1, 0($0)
load $2, 1($0)
add $0, $0, $0
add $0, $0, $0
add $0, $0, $0
add $3, $1, $2
add $0, $0, $0
add $0, $0, $0
add $0, $0, $0
store $3, 2($0)
`;

export function PipelineComp() {
  const [useForwarding, setUseForwarding] = useState(false);

  const pipelineRef = useRef<Pipeline>(
    new Pipeline(InstructionMemory.parse(DEFAULT_INSTRUCTION), useForwarding)
  );

  const [instWithStage, setInstWithStage] = useState<InstWithStage[]>(
    parseInstWithStage(pipelineRef.current)
  );
  const [pipelineRegs, setPipelineRegs] = useState(
    pipelineRef.current.pipelineRegs
  );
  const hazardCallback = useCallback<HazardCallback>((type, cause) => {
    toast(
      <div>
        <p className="text-lg">
          {String(type).charAt(0).toUpperCase() + String(type).slice(1)} Hazard
          happens
        </p>
        <p className="text-sm">
          "{cause.inst.raw}" at index {cause.inst.originalIndex}
        </p>
        <p className="text-sm text-neutral-500">{cause.desc}</p>
      </div>
    );
  }, []);
  const forwardCallback = useCallback((detail: ForwardDetail) => {
    toast(
      <div>
        <p className="text-lg">Forwarding happens</p>
        <p className="text-sm">
          Forwarding "{detail.data}" from "{detail.source.inst.raw}" to "
          {detail.target.inst.raw}" in register {detail.target.regIndex}
        </p>
      </div>
    );
  }, []);

  const handlePipelineChange = () => {
    setInstWithStage(parseInstWithStage(pipelineRef.current));
    setPipelineRegs(pipelineRef.current.pipelineRegs);
  };

  const handleTick = () => {
    pipelineRef.current.tick(1, hazardCallback, forwardCallback);
    handlePipelineChange();
  };

  const handleReset = () => {
    pipelineRef.current.reset();
    handlePipelineChange();
  };
  const handleSetIMem = (s: string) => {
    pipelineRef.current.setIMem(InstructionMemory.parse(s));
    handlePipelineChange();
  };

  const handleForwardingChange = (checked: boolean) => {
    setUseForwarding(checked);
    pipelineRef.current.setForwarding(checked);
    handlePipelineChange();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button onClick={handleTick}>Tick</Button>
        <Button onClick={handleReset} variant="destructive">
          Reset
        </Button>
        <div className="flex items-center space-x-2">
          <Switch
            id="forward-mode"
            checked={useForwarding}
            onCheckedChange={handleForwardingChange}
          />
          <Label htmlFor="forward-mode">Forward Mode</Label>
        </div>
      </div>

      <InstructionList instructions={instWithStage} />
      <PipelineView pipelineRegs={pipelineRegs} />
      <InstructionInput onChange={handleSetIMem} />
    </div>
  );
}
