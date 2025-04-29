import { getDefaultInst, Instruction } from "../instruction";

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

export type ControlSignals = {
  // EX Control
  branchController: (reg1: number, reg2: number) => boolean;
  aSel: "reg1" | "pc";
  bSel: "reg2" | "immediate";
  aluOp: "add" | "sub" | "sll" | "srl" | "sra" | "and" | "or" | "xor";

  // MEM Control
  memWriteEnable: boolean;

  // WB Control
  wbSel: "alu" | "mem";
  regWriteEnable: boolean;
};

function getAluHandler(): Map<
  ControlSignals["aluOp"],
  (a: number, b: number) => number
> {
  const map = new Map<
    ControlSignals["aluOp"],
    (a: number, b: number) => number
  >();
  map.set("add", (a, b) => a + b);
  map.set("sub", (a, b) => a - b);
  map.set("sll", (a, b) => a << b);
  map.set("srl", (a, b) => a >>> b);
  map.set("sra", (a, b) => a >> b);
  map.set("and", (a, b) => a & b);
  map.set("or", (a, b) => a | b);
  map.set("xor", (a, b) => a ^ b);
  return map;
}

export const aluHandler = getAluHandler();

export function getDefaultPipelineRegs(): PipelineRegs {
  return {
    mem2wb: { inst: getDefaultInst(), mem: 0, alu: 0 },
    ex2mem: { inst: getDefaultInst(), alu_out: 0, write_data: 0 },
    id2ex: {
      inst: getDefaultInst(),
      reg1: 0,
      reg2: 0,
      pc: 0,
      immediate: 0,
    },
    if2id: { inst: getDefaultInst(), pc: 0 },
  };
}
