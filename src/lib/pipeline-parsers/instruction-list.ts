import { Instruction } from "../simulator/instruction";
import { Pipeline } from "../simulator/pipline";

export type InstWithStage = {
  inst: Instruction;
  stage?: "if" | "id" | "ex" | "mem" | "wb";
};

export function parseInstWithStage(pipeline: Pipeline): InstWithStage[] {
  const ifIndex = pipeline.iMem.getInstructionAt(pipeline.pc).originalIndex;
  const idIndex = pipeline.pipelineRegs.if2id.inst.originalIndex;
  const exIndex = pipeline.pipelineRegs.id2ex.inst.originalIndex;
  const memIndex = pipeline.pipelineRegs.ex2mem.inst.originalIndex;
  const wbIndex = pipeline.pipelineRegs.mem2wb.inst.originalIndex;
  console.log(ifIndex, idIndex, exIndex, memIndex, wbIndex);

  const results = pipeline.iMem.instructions.map(
    (inst) =>
      ({
        inst,
        stage: undefined,
      } as InstWithStage)
  );
  if (ifIndex !== undefined) {
    results[ifIndex].stage = "if";
  }
  if (idIndex !== undefined) {
    results[idIndex].stage = "id";
  }
  if (exIndex !== undefined) {
    results[exIndex].stage = "ex";
  }
  if (memIndex !== undefined) {
    results[memIndex].stage = "mem";
  }
  if (wbIndex !== undefined) {
    results[wbIndex].stage = "wb";
  }
  return results;
}
