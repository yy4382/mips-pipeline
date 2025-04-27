import { Instruction } from "../simulator/instruction";
import { Pipeline } from "../simulator/pipline";

export type InstWithStage = {
  inst: Instruction;
  stage?: "if" | "id" | "ex" | "mem" | "wb";
};

export function parseInstWithStage(pipeline: Pipeline): InstWithStage[] {
  const stageIndices: Record<
    NonNullable<InstWithStage["stage"]>,
    number | undefined
  > = {
    if: pipeline.iMem.getInstructionAt(pipeline.pc).originalIndex,
    id: pipeline.pipelineRegs.if2id.inst.originalIndex,
    ex: pipeline.pipelineRegs.id2ex.inst.originalIndex,
    mem: pipeline.pipelineRegs.ex2mem.inst.originalIndex,
    wb: pipeline.pipelineRegs.mem2wb.inst.originalIndex,
  };

  const results = pipeline.iMem.instructions.map(
    (inst) =>
      ({
        inst,
        stage: undefined,
      } as InstWithStage)
  );

  for (const [stage, index] of Object.entries(stageIndices)) {
    if (index !== undefined && index >= 0 && index < results.length) {
      results[index].stage = stage as NonNullable<InstWithStage["stage"]>;
    }
  }

  return results;
}
