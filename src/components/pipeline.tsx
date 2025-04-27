import { useRef, useState } from "react";
import { Pipeline } from "../lib/simulator/pipline";
import { InstructionMemory } from "../lib/simulator/instruction";
import {
  InstWithStage,
  parseInstWithStage,
} from "../lib/pipeline-parsers/instruction-list";
import { InstructionList } from "./instruction-list";
import { PipelineView } from "./pipeline-view";
import { InstructionInput } from "./instruction-input";
import { Button } from "./ui/button";

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
  const pipelineRef = useRef<Pipeline>(
    new Pipeline(InstructionMemory.parse(DEFAULT_INSTRUCTION))
  );

  const [instWithStage, setInstWithStage] = useState<InstWithStage[]>(
    parseInstWithStage(pipelineRef.current)
  );
  const [pipelineRegs, setPipelineRegs] = useState(
    pipelineRef.current.pipelineRegs
  );

  const handlePipelineChange = () => {
    setInstWithStage(parseInstWithStage(pipelineRef.current));
    setPipelineRegs(pipelineRef.current.pipelineRegs);
  };

  const handleTick = () => {
    pipelineRef.current.tick();
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button onClick={handleTick}>Tick</Button>
        <Button onClick={handleReset} variant="destructive">
          Reset
        </Button>
      </div>

      <InstructionList instructions={instWithStage} />
      <PipelineView pipelineRegs={pipelineRegs} />
      <InstructionInput onChange={handleSetIMem} />
    </div>
  );
}
