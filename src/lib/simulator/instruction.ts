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
  "sub",
  "lw",
  "sw",
  "beqz",
  "bnez",
  "beq",
  "bne",
  "bgt",
  "bge",
  "blt",
  "ble",
  "addi",
] as const;
type SupportedInstruction = (typeof _SUPPORTED_INSTRUCTIONS)[number];

function getParsers() {
  const parsers: Map<
    SupportedInstruction,
    (raw: string, remaining: string) => InstructionTypeFirstPassWithoutIndex
  > = new Map();
  parsers.set("add", (raw, remaining) => {
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
        aluOp: "add",
        memWriteEnable: false,
        wbSel: "alu",
        regWriteEnable: true,
      },
    };
  });

  parsers.set("sub", (raw, remaining) => {
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
        aluOp: "sub",
        memWriteEnable: false,
        wbSel: "alu",
        regWriteEnable: true,
      } satisfies ControlSignals as ControlSignals,
    };
  });

  parsers.set("addi", (raw, remaining) => {
    const [rs, rd, immediate] = parseIType(remaining);
    return {
      raw,
      readingRegisters: [rs, undefined],
      writingRegister: rd,
      immediate,
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

  function getBranchInst(
    raw: string,
    parsed: [number, number, string | number],
    bc: (reg1: number, reg2: number) => boolean
  ): InstructionTypeFirstPassWithoutIndex {
    return {
      raw,
      readingRegisters: [parsed[0], parsed[1]],
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
    return getBranchInst(raw, parsed, (reg1, reg2) => reg1 === reg2);
  });
  parsers.set("bnez", (raw, remaining) => {
    const parsed = parseBzType(remaining);
    return getBranchInst(raw, parsed, (reg1, reg2) => reg1 !== reg2);
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

function parseBzType(remaining: string): [number, number, string | number] {
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
  return [registerIndex, 0, immediate];
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

// class Instruction {
//   /**
//    * The raw instruction string.
//    */
//   public raw: string;
//   /**
//    * The original index of the instruction in the source code.
//    * For NOPs, if it is used to fill the instruction memory or init the pipeline,
//    * it will be undefined.
//    * If a NOP is converted from a normal instruction to stall, it will be -1.
//    */
//   public originalIndex: number | undefined;
//   constructor(raw: string, originalIndex: number | undefined) {
//     this.raw = raw;
//     this.originalIndex = originalIndex;
//   }

//   get readingRegisters(): [number | undefined, number | undefined] {
//     throw new Error("readingRegisters unimplemented");
//   }

//   get writingRegister(): number | undefined {
//     throw new Error("writingRegister unimplemented");
//   }

//   get controlSignals(): ControlSignals {
//     throw new Error("controlSignals unimplemented");
//   }

//   static default(): AddInstruction {
//     return new AddInstruction(0, 0, 0, "add $0, $0, $0 #NOP");
//   }

//   static parse(raw: string, index?: number): Instruction {
//     const rawParts = raw.split("#");
//     const parts = rawParts[0].split(" ");
//     const instructionType = parts[0];
//     const args = parts
//       .slice(1)
//       .join(" ")
//       .split(",")
//       .map((arg) => arg.trim());

//     const baseInstruction = new Instruction(raw, index);

//     switch (instructionType) {
//       case "lw":
//       case "sw": {
//         if (args.length !== 2) {
//           throw new Error(
//             `Invalid number of arguments for ${instructionType} instruction`
//           );
//         }
//         if (args[0].charAt(0) !== "$") {
//           throw new Error(`Invalid register format: ${args[0]}`);
//         }
//         const registerIndex = parseInt(args[0].substring(1));

//         // args[1] should look like 4($0)
//         const addressParts = args[1].split("(");
//         if (addressParts.length !== 2) {
//           throw new Error(`Invalid address format: ${args[1]}`);
//         }
//         const address = parseInt(addressParts[0]);
//         if (isNaN(address)) {
//           throw new Error(`Invalid address format: ${args[1]}`);
//         }
//         const reg = addressParts[1].substring(0, addressParts[1].length - 1);
//         if (reg.charAt(0) !== "$") {
//           throw new Error(`Invalid register format: ${addressParts[1]}`);
//         }
//         const addressRegisterIndex = parseInt(reg.substring(1));
//         if (isNaN(addressRegisterIndex)) {
//           throw new Error(`Invalid register format: ${reg}`);
//         }
//         const iInst = IInstruction.fromInstruction(
//           baseInstruction,
//           addressRegisterIndex,
//           registerIndex,
//           address
//         );
//         if (instructionType === "lw") {
//           return LwInstruction.fromIInstruction(iInst);
//         } else {
//           return SwInstruction.fromIInstruction(iInst);
//         }
//       }
//       case "add": {
//         if (args.length !== 3) {
//           throw new Error(
//             `Invalid number of arguments for ${instructionType} instruction`
//           );
//         }
//         args.forEach((arg) => {
//           if (arg.charAt(0) !== "$" || isNaN(parseInt(arg.substring(1)))) {
//             throw new Error(`Invalid register format: ${arg}`);
//           }
//         });
//         const registerIndex1 = parseInt(args[1].substring(1));
//         const registerIndex2 = parseInt(args[2].substring(1));
//         const resultRegisterIndex = parseInt(args[0].substring(1));
//         return AddInstruction.fromRInstruction(
//           RInstruction.fromInstruction(
//             baseInstruction,
//             registerIndex1,
//             registerIndex2,
//             resultRegisterIndex
//           )
//         );
//       }
//       case "addi": {
//         if (args.length !== 3) {
//           throw new Error(
//             `Invalid number of arguments for ${instructionType} instruction`
//           );
//         }
//         args.forEach((arg, i) => {
//           if (i >= 2) return;
//           if (arg.charAt(0) !== "$" || isNaN(parseInt(arg.substring(1)))) {
//             throw new Error(`Invalid register format: ${arg}`);
//           }
//         });
//         const resultRegisterIndex = parseInt(args[0].substring(1));
//         const registerIndex = parseInt(args[1].substring(1));
//         const immediate = parseInt(args[2]);
//         return AddiInstruction.fromIInstruction(
//           IInstruction.fromInstruction(
//             baseInstruction,
//             registerIndex,
//             resultRegisterIndex,
//             immediate
//           )
//         );
//       }
//       case "beqz":
//       case "bnez": {
//         if (args.length !== 2) {
//           throw new Error(
//             `Invalid number of arguments for ${instructionType} instruction`
//           );
//         }
//         const registerIndex = parseInt(args[0].substring(1));
//         const offset = parseInt(args[1]);
//         if (instructionType === "beqz") {
//           return BeqInstruction.fromIInstruction(
//             IInstruction.fromInstruction(
//               baseInstruction,
//               registerIndex,
//               0,
//               offset
//             )
//           );
//         } else {
//           return BneInstruction.fromIInstruction(
//             IInstruction.fromInstruction(
//               baseInstruction,
//               registerIndex,
//               0,
//               offset
//             )
//           );
//         }
//       }
//       case "beq":
//       case "bne": {
//         if (args.length !== 3) {
//           throw new Error(
//             `Invalid number of arguments for ${instructionType} instruction`
//           );
//         }
//         if (
//           args[0].charAt(0) !== "$" ||
//           isNaN(parseInt(args[0].substring(1)))
//         ) {
//           throw new Error(`Invalid register format: ${args[0]}`);
//         }
//         const registerIndex1 = parseInt(args[0].substring(1));
//         if (
//           args[1].charAt(0) !== "$" ||
//           isNaN(parseInt(args[1].substring(1)))
//         ) {
//           throw new Error(`Invalid register format: ${args[1]}`);
//         }
//         const registerIndex2 = parseInt(args[1].substring(1));
//         if (isNaN(parseInt(args[2]))) {
//           throw new Error(`Invalid offset format: ${args[2]}`);
//         }
//         const offset = parseInt(args[2]);
//         if (instructionType === "beq") {
//           return BeqInstruction.fromIInstruction(
//             IInstruction.fromInstruction(
//               baseInstruction,
//               registerIndex1,
//               registerIndex2,
//               offset
//             )
//           );
//         } else {
//           return BneInstruction.fromIInstruction(
//             IInstruction.fromInstruction(
//               baseInstruction,
//               registerIndex1,
//               registerIndex2,
//               offset
//             )
//           );
//         }
//       }
//       case "nop": {
//         return Instruction.default();
//       }

//       default:
//         throw new Error(`Unknown instruction type: ${instructionType}`);
//     }
//   }
// }

// class RInstruction extends Instruction {
//   public rs1: number;
//   public rs2: number;
//   public rd: number;

//   constructor(
//     rs1: number,
//     rs2: number,
//     rd: number,
//     raw: string,
//     originalIndex?: number
//   ) {
//     super(raw, originalIndex);
//     this.rs1 = rs1;
//     this.rs2 = rs2;
//     this.rd = rd;
//   }

//   static fromInstruction(
//     inst: Instruction,
//     rs1: number,
//     rs2: number,
//     rd: number
//   ): RInstruction {
//     return new RInstruction(rs1, rs2, rd, inst.raw, inst.originalIndex);
//   }
// }
// export class AddInstruction extends RInstruction {
//   get readingRegisters(): [number | undefined, number | undefined] {
//     return [this.rs1, this.rs2];
//   }
//   get writingRegister(): number {
//     return this.rd;
//   }
//   static fromRInstruction(inst: RInstruction): AddInstruction {
//     return new AddInstruction(
//       inst.rs1,
//       inst.rs2,
//       inst.rd,
//       inst.raw,
//       inst.originalIndex
//     );
//   }
//   get controlSignals(): ControlSignals {
//     return {
//       branchController: () => false,
//       aSel: "reg1",
//       bSel: "reg2",
//       aluOp: "add",
//       memWriteEnable: false,
//       wbSel: "alu",
//       regWriteEnable: true,
//     };
//   }
// }

// export class IInstruction extends Instruction {
//   public rs1: number;
//   public rd: number;
//   public immediate: number;

//   constructor(
//     rs1: number,
//     rd: number,
//     immediate: number,
//     raw: string,
//     originalIndex?: number
//   ) {
//     super(raw, originalIndex);
//     this.rs1 = rs1;
//     this.rd = rd;
//     this.immediate = immediate;
//   }
//   static fromInstruction(
//     inst: Instruction,
//     rs1: number,
//     rd: number,
//     immediate: number
//   ): IInstruction {
//     return new IInstruction(rs1, rd, immediate, inst.raw, inst.originalIndex);
//   }
// }

// export class LwInstruction extends IInstruction {
//   get readingRegisters(): [number | undefined, number | undefined] {
//     return [this.rs1, undefined];
//   }
//   get writingRegister(): number {
//     return this.rd;
//   }
//   static fromIInstruction(inst: IInstruction): LwInstruction {
//     return new LwInstruction(
//       inst.rs1,
//       inst.rd,
//       inst.immediate,
//       inst.raw,
//       inst.originalIndex
//     );
//   }
//   get controlSignals(): ControlSignals {
//     return {
//       branchController: () => false,
//       aSel: "reg1",
//       bSel: "immediate",
//       aluOp: "add",
//       memWriteEnable: false,
//       wbSel: "mem",
//       regWriteEnable: true,
//     };
//   }
// }

// export class SwInstruction extends IInstruction {
//   get readingRegisters(): [number | undefined, number | undefined] {
//     return [this.rs1, this.rd];
//   }
//   get writingRegister(): number | undefined {
//     return undefined;
//   }
//   static fromIInstruction(inst: IInstruction): SwInstruction {
//     return new SwInstruction(
//       inst.rs1,
//       inst.rd,
//       inst.immediate,
//       inst.raw,
//       inst.originalIndex
//     );
//   }
//   get controlSignals(): ControlSignals {
//     return {
//       branchController: () => false,
//       aSel: "reg1",
//       bSel: "immediate",
//       aluOp: "add",
//       memWriteEnable: true,
//       wbSel: "alu", // doesn't matter
//       regWriteEnable: false,
//     };
//   }
// }

// class BranchInstruction extends IInstruction {
//   branchController(_reg1: number, _reg2: number): boolean {
//     throw new Error("branchController unimplemented");
//   }

//   get readingRegisters(): [number | undefined, number | undefined] {
//     return [this.rs1, this.rd];
//   }
//   get writingRegister(): number | undefined {
//     return undefined;
//   }
//   get controlSignals(): ControlSignals {
//     return {
//       branchController: this.branchController,
//       aSel: "pc",
//       bSel: "immediate",
//       aluOp: "add",
//       memWriteEnable: false,
//       wbSel: "alu", // doesn't matter
//       regWriteEnable: false,
//     };
//   }
// }

// export class BeqInstruction extends BranchInstruction {
//   branchController(_reg1: number, _reg2: number): boolean {
//     return _reg1 === _reg2;
//   }
//   static fromIInstruction(inst: IInstruction): BeqInstruction {
//     return new BeqInstruction(
//       inst.rs1,
//       inst.rd,
//       inst.immediate,
//       inst.raw,
//       inst.originalIndex
//     );
//   }
// }

// export class BneInstruction extends BranchInstruction {
//   branchController(_reg1: number, _reg2: number): boolean {
//     return _reg1 !== _reg2;
//   }
//   static fromIInstruction(inst: IInstruction): BneInstruction {
//     return new BneInstruction(
//       inst.rs1,
//       inst.rd,
//       inst.immediate,
//       inst.raw,
//       inst.originalIndex
//     );
//   }
// }

// export class AddiInstruction extends IInstruction {
//   get readingRegisters(): [number | undefined, number | undefined] {
//     return [this.rs1, undefined];
//   }
//   get writingRegister(): number {
//     return this.rd;
//   }
//   static fromIInstruction(inst: IInstruction): AddiInstruction {
//     return new AddiInstruction(
//       inst.rs1,
//       inst.rd,
//       inst.immediate,
//       inst.raw,
//       inst.originalIndex
//     );
//   }
//   get controlSignals(): ControlSignals {
//     return {
//       branchController: () => false,
//       aSel: "reg1",
//       bSel: "immediate",
//       aluOp: "add",
//       memWriteEnable: false,
//       wbSel: "alu",
//       regWriteEnable: true,
//     };
//   }
// }

// class LoadSaveInstruction extends Instruction {
//   public addressOffset: number;
//   public registerIndex: number;
//   public startingRegisterIndex: number;
//   public type: "load" | "store";

//   constructor(
//     addressOffset: number,
//     registerIndex: number,
//     startingRegisterIndex: number,
//     type: "load" | "store",
//     raw: string,
//     originalIndex?: number
//   ) {
//     super(raw, originalIndex);
//     this.addressOffset = addressOffset;
//     this.registerIndex = registerIndex;
//     this.startingRegisterIndex = startingRegisterIndex;
//     this.type = type;
//   }

//   get rs1(): number {
//     return this.startingRegisterIndex;
//   }
//   get rs2(): number | undefined {
//     if (this.type === "store") {
//       return this.registerIndex;
//     }
//     return undefined;
//   }
//   get rd(): number | undefined {
//     if (this.type === "load") {
//       return this.registerIndex;
//     }
//     return undefined;
//   }
//   get immediate(): number {
//     return this.addressOffset;
//   }
// }

// class ArithmeticInstruction extends Instruction {
//   public registerIndex1: number;
//   public registerIndex2: number;
//   public resultRegisterIndex: number;
//   public operation: "add";

//   constructor(
//     registerIndex1: number,
//     registerIndex2: number,
//     resultRegisterIndex: number,
//     operation: "add",
//     raw: string,
//     originalIndex?: number
//   ) {
//     super(raw, originalIndex);
//     this.registerIndex1 = registerIndex1;
//     this.registerIndex2 = registerIndex2;
//     this.resultRegisterIndex = resultRegisterIndex;
//     this.operation = operation;
//   }
//   get rs1(): number {
//     return this.registerIndex1;
//   }
//   get rs2(): number {
//     return this.registerIndex2;
//   }
//   get rd(): number {
//     return this.resultRegisterIndex;
//   }
//   get immediate(): number | undefined {
//     return undefined;
//   }
// }

// class BranchInstruction extends Instruction {
//   public type: "beqz";
//   public registerIndex: number;
//   public offset: number;
//   constructor(
//     type: "beqz",
//     registerIndex: number,
//     offset: number,
//     raw: string,
//     originalIndex?: number
//   ) {
//     super(raw, originalIndex);
//     this.type = type;
//     this.registerIndex = registerIndex;
//     this.offset = offset;
//   }
//   get rs1(): number {
//     return this.registerIndex;
//   }
//   get rs2(): number | undefined {
//     return undefined;
//   }
//   get rd(): number | undefined {
//     return undefined;
//   }
//   get immediate(): number {
//     return this.offset;
//   }
// }

export type { InstructionType as Instruction };
