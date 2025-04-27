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
import { MemoryViewer } from "./memory-viewer";
import { RegisterFileViewer } from "./register-file-viewer";
import { Statics } from "./statics";
import { Input } from "./ui/input";

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

  const [breakpoint, setBreakpoint] = useState<number>(0);

  const [instWithStage, setInstWithStage] = useState<InstWithStage[]>(
    parseInstWithStage(pipelineRef.current)
  );
  const [pipelineRegs, setPipelineRegs] = useState(
    pipelineRef.current.pipelineRegs
  );
  const [statics, setStatics] = useState(pipelineRef.current.statics);

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
    setStatics({ ...pipelineRef.current.statics });
  };

  const handleTick = (stopAt: number | undefined) => {
    pipelineRef.current.tick(stopAt, hazardCallback, forwardCallback);
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
    <div className="flex flex-col gap-4 items-center">
      <div className="flex flex-wrap gap-4 items-center justify-center p-2 border rounded-lg bg-slate-50 dark:bg-slate-900 w-fit mx-auto">
        <div className="flex gap-2">
          <Button onClick={() => handleTick(undefined)}>Step</Button>
          <Button onClick={() => handleTick(-1)}>Run to End</Button>
        </div>
        
        <div className="flex items-center gap-2 border-l pl-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="breakpoint-input" className="whitespace-nowrap">Breakpoint:</Label>
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
            onClick={() => handleTick(breakpoint)} 
            variant="outline"
            disabled={breakpoint === 0}
            className="whitespace-nowrap"
          >
            Run to BP
          </Button>
        </div>
        
        <div className="flex items-center gap-2 border-l pl-4">
          <Button onClick={handleReset} variant="destructive" size="sm">
            Reset
          </Button>
        </div>
        
        <div className="flex items-center gap-2 border-l pl-4">
          <Switch
            id="forward-mode"
            checked={useForwarding}
            onCheckedChange={handleForwardingChange}
          />
          <Label htmlFor="forward-mode" className="cursor-pointer">Forward Mode</Label>
        </div>
      </div>
      <div className="flex gap-2">
        <InstructionList instructions={instWithStage} />
        <PipelineView pipelineRegs={pipelineRegs} />
      </div>
      <div className="flex gap-2">
        <MemoryViewer memory={pipelineRef.current.mem} />
        <RegisterFileViewer registerFile={pipelineRef.current.registerFile} />
      </div>
      <Statics statics={statics} forwardStatus={useForwarding} />

      <InstructionInput onChange={handleSetIMem} />
    </div>
  );
}
