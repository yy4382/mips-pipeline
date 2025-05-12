import { ControlSignals } from "./pipeline-registers";
import { getRegisterIndex } from "../hardware/register-file";
import {
  parseRType,
  parseIType,
  parseBzType,
  parseMemType,
  parseFirstPass,
  parseSecondPass,
  InstructionTypeFirstPassWithoutIndex,
  InstructionType,
} from "../instruction-parse/parse-inst";
import { InstructionMemory } from "../hardware/instruction-memory";

type InstWith5StageCtrl = InstructionType & {
  controlSignals: ControlSignals;
};

export function parseInsts5Stage(raw: string[]): InstWith5StageCtrl[] {
  const { inst: firstPassInst, labels } = parseFirstPass<InstWith5StageCtrl>(
    raw,
    (instType, remaining, raw) => {
      const handler = parsers.get(instType as SupportedInstruction);
      if (!handler) {
        throw new Error(`Unsupported instruction: ${instType}`);
      }
      return handler(raw, remaining);
    }
  );

  return parseSecondPass(firstPassInst, labels);
}

export const _SUPPORTED_INSTRUCTIONS = [
  "add",
  "addi",
  "sub",
  "and",
  "andi",
  "or",
  "ori",
  "xor",
  "xori",
  "sll",
  "slli",
  "srl",
  "srli",
  "sra",
  "srai",

  "lw",
  "sw",

  "beq",
  "bne",
  "bgt",
  "bge",
  "blt",
  "ble",

  "beqz",
  "bnez",
  "li",
  "nop",
  "mv",
  "j",
] as const;
type SupportedInstruction = (typeof _SUPPORTED_INSTRUCTIONS)[number];

function getParsers() {
  const parsers: Map<
    SupportedInstruction,
    (
      raw: string,
      remaining: string
    ) => InstructionTypeFirstPassWithoutIndex<InstWith5StageCtrl>
  > = new Map();

  function getArithmeticRInst(
    raw: string,
    remaining: string,
    op: ControlSignals["aluOp"],
    instType: SupportedInstruction
  ): InstructionTypeFirstPassWithoutIndex<InstWith5StageCtrl> {
    const [rs1, rs2, rd] = parseRType(remaining);
    return {
      raw,
      rs: [rs1, rs2],
      rd,
      immediate: undefined,
      instType,
      controlSignals: {
        branchController: () => false,
        aSel: "reg1",
        bSel: "reg2",
        aluOp: op,
        memWriteEnable: false,
        wbSel: "alu",
        regWriteEnable: true,
      },
    };
  }

  function getArithmeticIInst(
    raw: string,
    remaining: string,
    op: ControlSignals["aluOp"],
    instType: SupportedInstruction
  ): InstructionTypeFirstPassWithoutIndex<InstWith5StageCtrl> {
    const [rs1, rd, imm] = parseIType(remaining);
    return {
      raw,
      rs: [rs1, undefined],
      rd,
      immediate: imm,
      instType,
      controlSignals: {
        branchController: () => false,
        aSel: "reg1",
        bSel: "immediate",
        aluOp: op,
        memWriteEnable: false,
        wbSel: "alu",
        regWriteEnable: true,
      },
    };
  }

  const arithmeticInstructions: {
    name: SupportedInstruction;
    type: "R" | "I";
    aluOp: ControlSignals["aluOp"];
  }[] = [
    { name: "add", type: "R", aluOp: "add" },
    { name: "sub", type: "R", aluOp: "sub" },
    { name: "addi", type: "I", aluOp: "add" },
    { name: "and", type: "R", aluOp: "and" },
    { name: "andi", type: "I", aluOp: "and" },
    { name: "or", type: "R", aluOp: "or" },
    { name: "ori", type: "I", aluOp: "or" },
    { name: "xor", type: "R", aluOp: "xor" },
    { name: "xori", type: "I", aluOp: "xor" },
    { name: "sll", type: "R", aluOp: "sll" },
    { name: "slli", type: "I", aluOp: "sll" },
    { name: "srl", type: "R", aluOp: "srl" },
    { name: "srli", type: "I", aluOp: "srl" },
    { name: "sra", type: "R", aluOp: "sra" },
    { name: "srai", type: "I", aluOp: "sra" },
  ];

  arithmeticInstructions.forEach(({ name, type, aluOp }) => {
    parsers.set(name, (raw, remaining) => {
      if (type === "R") {
        return getArithmeticRInst(raw, remaining, aluOp, name);
      } else {
        return getArithmeticIInst(raw, remaining, aluOp, name);
      }
    });
  });

  function getBranchInst(
    raw: string,
    parsed: [number, number, string | number],
    bc: (reg1: number, reg2: number) => boolean,
    instType: SupportedInstruction
  ): InstructionTypeFirstPassWithoutIndex<InstWith5StageCtrl> {
    return {
      raw,
      rs: [parsed[1], parsed[0]], // reversed because most b inst are I type, which has a rs1 behind rd
      rd: undefined,
      immediate: parsed[2],
      instType,
      controlSignals: {
        branchController: bc,
        aSel: "pc",
        bSel: "immediate",
        aluOp: "add",
        memWriteEnable: false,
        wbSel: "alu",
        regWriteEnable: false,
      },
    };
  }

  parsers.set("beqz", (raw, remaining) => {
    const parsed = parseBzType(remaining);
    return getBranchInst(
      raw,
      [0, parsed[0], parsed[1]],
      (reg1, reg2) => reg1 === reg2,
      "beqz"
    );
  });
  parsers.set("bnez", (raw, remaining) => {
    const parsed = parseBzType(remaining);
    return getBranchInst(
      raw,
      [0, parsed[0], parsed[1]],
      (reg1, reg2) => reg1 !== reg2,
      "bnez"
    );
  });
  parsers.set("beq", (raw, remaining) => {
    const parsed = parseIType(remaining);
    return getBranchInst(raw, parsed, (reg1, reg2) => reg1 === reg2, "beq");
  });
  parsers.set("bne", (raw, remaining) => {
    const parsed = parseIType(remaining);
    return getBranchInst(raw, parsed, (reg1, reg2) => reg1 !== reg2, "bne");
  });
  parsers.set("bgt", (raw, remaining) => {
    const parsed = parseIType(remaining);
    return getBranchInst(raw, parsed, (reg1, reg2) => reg1 > reg2, "bgt");
  });
  parsers.set("bge", (raw, remaining) => {
    const parsed = parseIType(remaining);
    return getBranchInst(raw, parsed, (reg1, reg2) => reg1 >= reg2, "bge");
  });
  parsers.set("blt", (raw, remaining) => {
    const parsed = parseIType(remaining);
    return getBranchInst(raw, parsed, (reg1, reg2) => reg1 < reg2, "blt");
  });
  parsers.set("ble", (raw, remaining) => {
    const parsed = parseIType(remaining);
    return getBranchInst(raw, parsed, (reg1, reg2) => reg1 <= reg2, "ble");
  });

  parsers.set("lw", (raw, remaining) => {
    const [rs1, rd, imm] = parseMemType(remaining);
    return {
      raw,
      rs: [rs1, undefined],
      rd: rd,
      immediate: imm,
      instType: "lw",
      controlSignals: {
        branchController: () => false,
        aSel: "reg1",
        bSel: "immediate",
        aluOp: "add",
        memWriteEnable: false,
        wbSel: "mem",
        regWriteEnable: true,
      },
    };
  });
  parsers.set("sw", (raw, remaining) => {
    const [rs1, rd, imm] = parseMemType(remaining);
    return {
      raw,
      rs: [rs1, rd],
      rd: undefined,
      immediate: imm,
      instType: "sw",
      controlSignals: {
        branchController: () => false,
        aSel: "reg1",
        bSel: "immediate",
        aluOp: "add",
        memWriteEnable: true,
        wbSel: "alu",
        regWriteEnable: false,
      },
    };
  });

  parsers.set("li", (raw, remaining) => {
    // pseudo inst for addi
    const [r, imm] = parseBzType(remaining);
    return {
      raw,
      rs: [0, undefined],
      rd: r,
      immediate: imm,
      instType: "addi",
      controlSignals: {
        branchController: () => false,
        aSel: "reg1",
        bSel: "immediate",
        aluOp: "add",
        memWriteEnable: false,
        wbSel: "alu",
        regWriteEnable: true,
      },
    };
  });

  parsers.set("nop", (raw) => {
    return {
      raw,
      rs: [0, 0],
      rd: 0,
      immediate: undefined,
      instType: "add",
      controlSignals: {
        branchController: () => false,
        aSel: "reg1",
        bSel: "reg2",
        aluOp: "add",
        memWriteEnable: false,
        wbSel: "alu",
        regWriteEnable: false,
      },
    };
  });

  parsers.set("mv", (raw, remaining) => {
    const args = remaining.split(",").map((arg) => arg.trim());
    if (args.length !== 2) {
      throw new Error(`Invalid number of arguments`);
    }
    const rs1 = getRegisterIndex(args[1]);
    const rd = getRegisterIndex(args[0]);
    return getArithmeticIInst(raw, `$${rd}, $${rs1}, 0`, "add", "addi");
  });
  parsers.set("j", (raw, remaining) => {
    const args = remaining.split(",").map((arg) => arg.trim());
    if (args.length !== 1) {
      throw new Error(`Invalid number of arguments`);
    }
    let immediate: string | number = parseInt(args[0]);
    if (isNaN(immediate)) {
      immediate = args[0];
    }
    return {
      raw,
      rs: [0, 0],
      rd: undefined,
      immediate,
      instType: "beq",
      controlSignals: {
        branchController: () => true,
        aSel: "pc",
        bSel: "immediate",
        aluOp: "add",
        memWriteEnable: false,
        wbSel: "alu",
        regWriteEnable: false,
      },
    };
  });

  return parsers;
}

export const parsers = getParsers();

export function getDefaultInst(): InstWith5StageCtrl {
  return {
    raw: "add $0, $0, $0 #NOP",
    originalIndex: undefined,
    rs: [0, 0],
    rd: 0,
    immediate: undefined,
    instType: "add",
    controlSignals: {
      branchController: () => false,
      aSel: "reg1",
      bSel: "reg2",
      aluOp: "add",
      memWriteEnable: false,
      wbSel: "alu",
      regWriteEnable: false,
    },
  };
}

export function getIMem5Stage(
  raw: string
): InstructionMemory<InstWith5StageCtrl> {
  const instructions = parseInsts5Stage(raw.split("\n"));
  return new InstructionMemory(instructions, getDefaultInst);
}

export type { InstWith5StageCtrl as InstWith5StageCtrl };
