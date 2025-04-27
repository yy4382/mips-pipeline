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
import { toast } from "sonner";
import { MemoryViewer } from "./memory-viewer";
import { RegisterFileViewer } from "./register-file-viewer";
import { Statics } from "./statics";
import { PipelineControls } from "./pipeline-controls";
import { InstructionCycleGraph } from "./instruction-cycle-graph"; // Import the new component

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

  const [instCycleGraph, setInstCycleGraph] = useState<InstCycleGraphData>([
    { cycle: 0, instructions: parseInstWithStage(pipelineRef.current) },
  ]);
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

  const tickCallback = useCallback(
    (pipeline: Pipeline) => {
      setPipelineRegs(pipeline.pipelineRegs);
      setStatics({ ...pipeline.statics });

      const newInstWithStage = parseInstWithStage(pipeline);
      const currentCycle = pipeline.statics.clockCycles;

      setInstCycleGraph((prev) => {
        return [
          ...prev,
          {
            cycle: currentCycle,
            instructions: newInstWithStage,
          },
        ];
      });
    },
    [setInstCycleGraph, setPipelineRegs, setStatics]
  );

  const handleTick = (stopAt: number | undefined) => {
    pipelineRef.current.tick(
      stopAt,
      hazardCallback,
      forwardCallback,
      tickCallback
    );
  };

  const resetCallback = useCallback(
    (pipeline: Pipeline) => {
      console.debug("Pipeline reset callback called");
      setPipelineRegs(pipeline.pipelineRegs);
      setStatics({ ...pipeline.statics });
      setInstCycleGraph([
        {
          cycle: 0,
          instructions: parseInstWithStage(pipeline),
        },
      ]);
    },
    [setInstCycleGraph, setPipelineRegs, setStatics]
  );

  const handleReset = () => {
    pipelineRef.current.reset(resetCallback);
  };

  const handleSetIMem = (s: string) => {
    pipelineRef.current.setIMem(InstructionMemory.parse(s), resetCallback);
  };

  const handleForwardingChange = (checked: boolean) => {
    setUseForwarding(checked);
    pipelineRef.current.setForwarding(checked, resetCallback);
  };

  return (
    <div className="container mx-auto p-4">
      {/* Top section: Controls */}
      <div className="mb-6">
        <PipelineControls
          useForwarding={useForwarding}
          onForwardingChange={handleForwardingChange}
          onTick={handleTick}
          onReset={handleReset}
        />
      </div>

      <div className="mb-6">
        <InstructionCycleGraph data={instCycleGraph} />
      </div>

      {/* Main content: 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column (2/5 width) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <PipelineView pipelineRegs={pipelineRegs} />
          <Statics statics={statics} forwardStatus={useForwarding} />
        </div>

        {/* Right column (3/5 width) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <InstructionList instructions={instCycleGraph.at(-1)!.instructions} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MemoryViewer memory={pipelineRef.current.mem} />
            <RegisterFileViewer
              registerFile={pipelineRef.current.registerFile}
            />
          </div>
        </div>
      </div>

      {/* Bottom section: Instruction input */}
      <div className="mt-6">
        <InstructionInput onChange={handleSetIMem} />
      </div>
    </div>
  );
}

export type InstCycleGraphData = {
  cycle: number;
  instructions: InstWithStage[];
}[];
