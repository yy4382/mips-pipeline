import { ControlSignals } from "./hardware/pipeline-registers";

type InstructionType = {
  originalIndex: number | undefined;
  raw: string;

  readingRegisters: [number | undefined, number | undefined];
  writingRegister: number | undefined;
  immediate: number | undefined;

  controlSignals: ControlSignals;
};

type InstructionTypeFirstPass = Omit<InstructionType, "immediate"> & {
  immediate: number | string | undefined;
};
type InstructionTypeFirstPassWithoutIndex = Omit<
  InstructionTypeFirstPass,
  "originalIndex"
>;

export function parseInsts(raw: string[]): InstructionType[] {
  const { inst: firstPassInst, labels } = raw
    .filter((line) => line.trim())
    .map((line) => parseFirstPass(line))
    .reduce(
      (acc, { inst, foundLabel }) => {
        if (foundLabel) {
          acc.labels.set(foundLabel, acc.curIndex);
        }
        if (inst) {
          acc.inst.push({ ...inst, originalIndex: acc.curIndex });
          acc.curIndex++;
        }
        return acc;
      },
      {
        inst: [] as InstructionTypeFirstPass[],
        labels: new Map() as Map<string, number>,
        curIndex: 0,
      }
    );
  return firstPassInst.map((inst) => {
    if (typeof inst.immediate === "string") {
      const targetIndex = labels.get(inst.immediate);
      if (targetIndex === undefined) {
        throw new Error(
          `Label ${inst.immediate} not found at instruction ${inst.raw}`
        );
      }
      return { ...inst, immediate: targetIndex - inst.originalIndex! };
    } else {
      return { ...inst, immediate: inst.immediate }; // to please the type checker
    }
  });
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
  // "mv",
  // "j",
] as const;
type SupportedInstruction = (typeof _SUPPORTED_INSTRUCTIONS)[number];

function getParsers() {
  const parsers: Map<
    SupportedInstruction,
    (raw: string, remaining: string) => InstructionTypeFirstPassWithoutIndex
  > = new Map();

  function getArithmeticRInst(
    raw: string,
    remaining: string,
    op: ControlSignals["aluOp"]
  ): InstructionTypeFirstPassWithoutIndex {
    const [rs1, rs2, rd] = parseRType(remaining);
    return {
      raw,
      readingRegisters: [rs1, rs2],
      writingRegister: rd,
      immediate: undefined,
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
    op: ControlSignals["aluOp"]
  ): InstructionTypeFirstPassWithoutIndex {
    const [rs1, rd, imm] = parseIType(remaining);
    return {
      raw,
      readingRegisters: [rs1, undefined],
      writingRegister: rd,
      immediate: imm,
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
        return getArithmeticRInst(raw, remaining, aluOp);
      } else {
        return getArithmeticIInst(raw, remaining, aluOp);
      }
    });
  });

  function getBranchInst(
    raw: string,
    parsed: [number, number, string | number],
    bc: (reg1: number, reg2: number) => boolean
  ): InstructionTypeFirstPassWithoutIndex {
    return {
      raw,
      readingRegisters: [parsed[1], parsed[0]], // reversed because most b inst are I type, which has a rs1 behind rd
      writingRegister: undefined,
      immediate: parsed[2],
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
      (reg1, reg2) => reg1 === reg2
    );
  });
  parsers.set("bnez", (raw, remaining) => {
    const parsed = parseBzType(remaining);
    return getBranchInst(
      raw,
      [0, parsed[0], parsed[1]],
      (reg1, reg2) => reg1 !== reg2
    );
  });
  parsers.set("beq", (raw, remaining) => {
    const parsed = parseIType(remaining);
    return getBranchInst(raw, parsed, (reg1, reg2) => reg1 === reg2);
  });
  parsers.set("bne", (raw, remaining) => {
    const parsed = parseIType(remaining);
    return getBranchInst(raw, parsed, (reg1, reg2) => reg1 !== reg2);
  });
  parsers.set("bgt", (raw, remaining) => {
    const parsed = parseIType(remaining);
    return getBranchInst(raw, parsed, (reg1, reg2) => reg1 > reg2);
  });
  parsers.set("bge", (raw, remaining) => {
    const parsed = parseIType(remaining);
    return getBranchInst(raw, parsed, (reg1, reg2) => reg1 >= reg2);
  });
  parsers.set("blt", (raw, remaining) => {
    const parsed = parseIType(remaining);
    return getBranchInst(raw, parsed, (reg1, reg2) => reg1 < reg2);
  });
  parsers.set("ble", (raw, remaining) => {
    const parsed = parseIType(remaining);
    return getBranchInst(raw, parsed, (reg1, reg2) => reg1 <= reg2);
  });

  parsers.set("lw", (raw, remaining) => {
    const [rs1, rd, imm] = parseMemType(remaining);
    return {
      raw,
      readingRegisters: [rs1, undefined],
      writingRegister: rd,
      immediate: imm,
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
      readingRegisters: [rs1, rd],
      writingRegister: undefined,
      immediate: imm,
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
      readingRegisters: [0, undefined],
      writingRegister: r,
      immediate: imm,
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
      readingRegisters: [0, 0],
      writingRegister: 0,
      immediate: undefined,
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

  return parsers;
}

export const parsers = getParsers();

function parseFirstPass(raw: string): {
  inst: InstructionTypeFirstPassWithoutIndex | undefined;
  foundLabel: string | undefined;
} {
  // strip comments
  const rawParts = raw.split("#");

  let rawWithoutComments = rawParts[0].trim();
  if (rawWithoutComments.length === 0) {
    return { inst: undefined, foundLabel: undefined };
  }

  let label = undefined;
  if (rawWithoutComments.includes(":")) {
    const labelParts = rawWithoutComments.split(":");
    label = labelParts[0].trim();
    rawWithoutComments = labelParts[1].trim();
  }
  if (rawWithoutComments.length === 0) {
    return { inst: undefined, foundLabel: label };
  }
  const parts = rawWithoutComments.split(" ");
  const op = parts[0];
  const remaining = parts.slice(1).join(" ");
  const handler = parsers.get(op as SupportedInstruction);
  if (!handler) {
    throw new Error(`Unsupported instruction: ${op}`);
  }
  let parsed;
  try {
    parsed = handler(raw, remaining);
  } catch (e) {
    if (!(e instanceof Error)) {
      throw new Error(
        `Error parsing instruction "${rawWithoutComments}": ${String(e)}`
      );
    }
    throw new Error(
      `Error parsing instruction "${rawWithoutComments}": ${e.message}`
    );
  }
  return { inst: parsed, foundLabel: label };
}

function parseRType(remaining: string): [number, number, number] {
  const args = remaining.split(",").map((arg) => arg.trim());
  if (args.length !== 3) {
    throw new Error(`Invalid number of arguments`);
  }
  args.forEach((arg) => {
    if (arg.charAt(0) !== "$" || isNaN(parseInt(arg.substring(1)))) {
      throw new Error(`Invalid register format: ${arg}`);
    }
  });
  const rs1 = parseInt(args[1].substring(1));
  const rs2 = parseInt(args[2].substring(1));
  const rd = parseInt(args[0].substring(1));
  return [rs1, rs2, rd];
}

function parseIType(remaining: string): [number, number, string | number] {
  const args = remaining.split(",").map((arg) => arg.trim());
  if (args.length !== 3) {
    throw new Error(`Invalid number of arguments`);
  }
  args.forEach((arg, i) => {
    if (i >= 2) return;
    if (arg.charAt(0) !== "$" || isNaN(parseInt(arg.substring(1)))) {
      throw new Error(`Invalid register format: ${arg}`);
    }
  });
  const resultRegisterIndex = parseInt(args[0].substring(1));
  const registerIndex = parseInt(args[1].substring(1));
  let immediate: string | number = parseInt(args[2]);
  if (isNaN(immediate)) {
    immediate = args[2];
  }
  return [registerIndex, resultRegisterIndex, immediate];
}

function parseBzType(remaining: string): [number, string | number] {
  const args = remaining.split(",").map((arg) => arg.trim());
  if (args.length !== 2) {
    throw new Error(`Invalid number of arguments`);
  }
  const registerIndex = parseInt(args[0].substring(1));
  if (args[0].charAt(0) !== "$" || isNaN(parseInt(args[0].substring(1)))) {
    throw new Error(`Invalid register format: ${args[0]}`);
  }
  let immediate: string | number = parseInt(args[1]);
  if (isNaN(immediate)) {
    immediate = args[1];
  }
  return [registerIndex, immediate]; // to align with the I type, the reg2 reader is in front of the reg1 reader
}

function parseMemType(remaining: string): [number, number, number] {
  const args = remaining.split(",").map((arg) => arg.trim());
  if (args.length !== 2) {
    throw new Error(`Invalid number of arguments`);
  }
  if (args[0].charAt(0) !== "$") {
    throw new Error(`Invalid register format: ${args[0]}`);
  }
  const rd = parseInt(args[0].substring(1));

  // args[1] should look like 4($0)
  const addressParts = args[1].split("(");
  if (addressParts.length !== 2) {
    throw new Error(`Invalid address format: ${args[1]}`);
  }
  const address = parseInt(addressParts[0]);
  if (isNaN(address)) {
    throw new Error(`Invalid address format: ${args[1]}`);
  }
  const reg = addressParts[1].substring(0, addressParts[1].length - 1);
  if (reg.charAt(0) !== "$") {
    throw new Error(`Invalid register format: ${addressParts[1]}`);
  }
  const rs1 = parseInt(reg.substring(1));
  if (isNaN(rs1)) {
    throw new Error(`Invalid register format: ${reg}`);
  }

  return [rs1, rd, address];
}

export function getDefaultInst(): InstructionType {
  return {
    raw: "add $0, $0, $0 #NOP",
    originalIndex: undefined,
    readingRegisters: [0, 0],
    writingRegister: 0,
    immediate: undefined,
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

export type { InstructionType as Instruction };
