import { type JSX, useCallback, useRef, useState } from "react";
import {
  ForwardDetail,
  HazardCallback,
  Pipeline,
} from "@/lib/simulator/basic-pipeline/pipeline";
import {
  InstWithStage,
  parseInstWithStage,
} from "@/lib/pipeline-parsers/instruction-list";
import { InstructionList } from "./instruction-list";
import { PipelineView } from "./pipeline-view";
import { InstructionInput } from "./instruction-input";
import { toast } from "sonner";
import { MemoryViewer } from "./memory-viewer";
import { RegisterFileViewer } from "./register-file-viewer";
import { Statistics } from "./statistics";
import { PipelineControls } from "./pipeline-controls";
import { InstructionCycleGraph } from "./instruction-cycle-graph"; // Import the new component
import { HazardForwardViewer } from "./hazard-forward-viewer";
import { getIMem5Stage } from "@/lib/simulator/basic-pipeline/instruction";

const DEFAULT_INSTRUCTION = `
lw $t1, 0($0)
lw $t2, 1($0)
nop
nop
add $t3, $t1, $t2
nop
nop
sw $t3, 2($0)
`;

export function PipelineComp() {
  const [useForwarding, setUseForwarding] = useState(false);

  const pipelineRef = useRef<Pipeline>(
    new Pipeline(getIMem5Stage(DEFAULT_INSTRUCTION), useForwarding)
  );

  const [instCycleGraph, setInstCycleGraph] = useState<InstCycleGraphData>([
    { cycle: 0, instructions: parseInstWithStage(pipelineRef.current) },
  ]);
  const [pipelineRegs, setPipelineRegs] = useState(
    pipelineRef.current.pipelineRegs
  );
  const [statistics, setStatistics] = useState(pipelineRef.current.statistics);
  const [memory, setMemory] = useState(pipelineRef.current.mem.getMemory());
  const [registerFile, setRegisterFile] = useState(
    pipelineRef.current.registerFile.getRegisters()
  );
  const [hazards, setHazards] = useState<JSX.Element[]>([]);

  const hazardCallback = useCallback<
    (runningMode: "step" | "run") => HazardCallback
  >(
    (runningMode) => (type, cause) => {
      const ele = (
        <div>
          <p className="text-lg">
            {type === "branch" ? "Control" : "Data"} Hazard happens at clock
            cycle {cause.clockCycle}
          </p>
          <p className="text-sm">
            "{cause.inst.raw}" at index {cause.inst.originalIndex}
          </p>
          <p className="text-sm text-neutral-500">{cause.desc}</p>
        </div>
      );
      if (runningMode === "step") toast(ele);
      setHazards((prev) => [...prev, ele]);
    },
    []
  );
  const forwardCallback = useCallback(
    (runningMode: "step" | "run") => (detail: ForwardDetail) => {
      const ele = (
        <div>
          <p className="text-lg">
            Forwarding happens at clock cycle {detail.clockCycle}
          </p>
          <p className="text-sm">
            Forwarding "{detail.data}" from "{detail.source.inst.raw}" to "
            {detail.target.inst.raw}" in register {detail.target.regIndex}
          </p>
        </div>
      );
      if (runningMode === "step") toast(ele);
      setHazards((prev) => [...prev, ele]);
    },
    []
  );

  const tickCallback = useCallback((pipeline: Pipeline) => {
    setPipelineRegs(pipeline.pipelineRegs);
    setStatistics({ ...pipeline.statistics });

    const newInstWithStage = parseInstWithStage(pipeline);
    const currentCycle = pipeline.statistics.clockCycles;

    setInstCycleGraph((prev) => {
      return [
        ...prev,
        {
          cycle: currentCycle,
          instructions: newInstWithStage,
        },
      ];
    });
    setMemory(pipelineRef.current.mem.getMemory());
    setRegisterFile(pipelineRef.current.registerFile.getRegisters());
  }, []);

  const handleTick = (stopAt: number | undefined) => {
    const mode = stopAt === undefined ? "step" : "run";
    pipelineRef.current.tick(
      stopAt,
      hazardCallback(mode),
      forwardCallback(mode),
      tickCallback
    );
  };
  const handleSetMem = (i: number, value: number) => {
    pipelineRef.current.mem.setAt(i, value);
    setMemory(pipelineRef.current.mem.getMemory());
  };

  const resetCallback = useCallback((pipeline: Pipeline) => {
    console.debug("Pipeline reset callback called");
    setPipelineRegs(pipeline.pipelineRegs);
    setStatistics({ ...pipeline.statistics });
    setInstCycleGraph([
      {
        cycle: 0,
        instructions: parseInstWithStage(pipeline),
      },
    ]);
    setMemory(pipelineRef.current.mem.getMemory());
    setRegisterFile(pipelineRef.current.registerFile.getRegisters());
    setHazards([]);
  }, []);

  const handleReset = () => {
    pipelineRef.current.reset(resetCallback);
  };

  const handleSetIMem = useCallback(
    (s: string) => {
      let mem;
      try {
        mem = getIMem5Stage(s);
      } catch (e) {
        toast.error("Invalid instructions" + e);
        return;
      }
      pipelineRef.current.setIMem(mem, resetCallback);
    },
    [resetCallback]
  );

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
          <Statistics statistics={statistics} forwardStatus={useForwarding} />
          <HazardForwardViewer hazards={hazards} />
        </div>

        {/* Right column (3/5 width) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <InstructionList instructions={instCycleGraph.at(-1)!.instructions} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MemoryViewer memory={memory} setMemory={handleSetMem} />
            <RegisterFileViewer registerFile={registerFile} />
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
