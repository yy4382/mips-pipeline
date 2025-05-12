import { InstWith5StageCtrl } from "../simulator/basic-pipeline/instruction";
import { Pipeline } from "../simulator/basic-pipeline/pipeline";

export type InstWithStage = {
  inst: InstWith5StageCtrl;
  stage?: "IF" | "ID" | "EX" | "MEM" | "WB";
};

export function parseInstWithStage(pipeline: Pipeline): InstWithStage[] {
  const stageIndices: Record<
    NonNullable<InstWithStage["stage"]>,
    number | undefined
  > = {
    IF: pipeline.iMem.getInstructionAt(pipeline.pc).originalIndex,
    ID: pipeline.pipelineRegs.if2id.inst.originalIndex,
    EX: pipeline.pipelineRegs.id2ex.inst.originalIndex,
    MEM: pipeline.pipelineRegs.ex2mem.inst.originalIndex,
    WB: pipeline.pipelineRegs.mem2wb.inst.originalIndex,
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
