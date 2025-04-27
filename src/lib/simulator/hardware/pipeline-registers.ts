import { Instruction } from "../instruction";

export type PipelineRegs = {
  mem2wb: {
    inst: Instruction;
    mem: number;
    alu: number;
  };
  ex2mem: {
    inst: Instruction;
    alu_out: number;
    write_data: number;
  };
  id2ex: {
    inst: Instruction;
    reg1: number;
    reg2: number;
    pc: number;
    immediate: number;
  };
  if2id: {
    inst: Instruction;
    pc: number;
  };
};

export function getDefaultPipelineRegs(): PipelineRegs {
  return {
    mem2wb: { inst: Instruction.default(), mem: 0, alu: 0 },
    ex2mem: { inst: Instruction.default(), alu_out: 0, write_data: 0 },
    id2ex: {
      inst: Instruction.default(),
      reg1: 0,
      reg2: 0,
      pc: 0,
      immediate: 0,
    },
    if2id: { inst: Instruction.default(), pc: 0 },
  };
}