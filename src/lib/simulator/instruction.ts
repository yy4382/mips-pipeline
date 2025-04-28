export class Instruction {
  /**
   * The raw instruction string.
   */
  public raw: string;
  /**
   * The original index of the instruction in the source code.
   * For NOPs, if it is used to fill the instruction memory or init the pipeline,
   * it will be undefined.
   * If a NOP is converted from a normal instruction to stall, it will be -1.
   */
  public originalIndex: number | undefined;
  constructor(raw: string, originalIndex: number | undefined) {
    this.raw = raw;
    this.originalIndex = originalIndex;
  }

  get readingRegisters(): [number | undefined, number | undefined] {
    throw new Error("readingRegisters unimplemented");
  }

  get writingRegister(): number | undefined {
    throw new Error("writingRegister unimplemented");
  }

  get writingAvailableStage(): "EX" | "MEM" | undefined {
    throw new Error("writingAvailableStage unimplemented");
  }

  static default(): RInstruction {
    return new AddInstruction(0, 0, 0, "add $0, $0, $0 #NOP");
  }

  static parse(raw: string, index?: number): Instruction {
    const rawParts = raw.split("#");
    const parts = rawParts[0].split(" ");
    const instructionType = parts[0];
    const args = parts
      .slice(1)
      .join(" ")
      .split(",")
      .map((arg) => arg.trim());

    const baseInstruction = new Instruction(raw, index);

    switch (instructionType) {
      case "lw":
      case "sw": {
        if (args.length !== 2) {
          throw new Error(
            `Invalid number of arguments for ${instructionType} instruction`
          );
        }
        if (args[0].charAt(0) !== "$") {
          throw new Error(`Invalid register format: ${args[0]}`);
        }
        const registerIndex = parseInt(args[0].substring(1));

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
        const addressRegisterIndex = parseInt(reg.substring(1));
        if (isNaN(addressRegisterIndex)) {
          throw new Error(`Invalid register format: ${reg}`);
        }
        const iInst = IInstruction.fromInstruction(
          baseInstruction,
          addressRegisterIndex,
          registerIndex,
          address
        );
        if (instructionType === "lw") {
          return LwInstruction.fromIInstruction(iInst);
        } else {
          return SwInstruction.fromIInstruction(iInst);
        }
      }
      case "add": {
        if (args.length !== 3) {
          throw new Error(
            `Invalid number of arguments for ${instructionType} instruction`
          );
        }
        args.forEach((arg) => {
          if (arg.charAt(0) !== "$" || isNaN(parseInt(arg.substring(1)))) {
            throw new Error(`Invalid register format: ${arg}`);
          }
        });
        const registerIndex1 = parseInt(args[1].substring(1));
        const registerIndex2 = parseInt(args[2].substring(1));
        const resultRegisterIndex = parseInt(args[0].substring(1));
        return AddInstruction.fromRInstruction(
          RInstruction.fromInstruction(
            baseInstruction,
            registerIndex1,
            registerIndex2,
            resultRegisterIndex
          )
        );
      }
      case "addi": {
        if (args.length !== 3) {
          throw new Error(
            `Invalid number of arguments for ${instructionType} instruction`
          );
        }
        args.forEach((arg) => {
          if (arg.charAt(0) !== "$" || isNaN(parseInt(arg.substring(1)))) {
            throw new Error(`Invalid register format: ${arg}`);
          }
        });
        const registerIndex = parseInt(args[1].substring(1));
        const immediate = parseInt(args[2]);
        const resultRegisterIndex = parseInt(args[0].substring(1));
        return AddiInstruction.fromIInstruction(
          IInstruction.fromInstruction(
            baseInstruction,
            registerIndex,
            resultRegisterIndex,
            immediate
          )
        );
      }
      case "beqz": {
        if (args.length !== 2) {
          throw new Error(
            `Invalid number of arguments for ${instructionType} instruction`
          );
        }
        const registerIndex = parseInt(args[0].substring(1));
        const offset = parseInt(args[1]);
        return BeqInstruction.fromIInstruction(
          IInstruction.fromInstruction(
            baseInstruction,
            registerIndex,
            0,
            offset
          )
        );
      }
      default:
        throw new Error(`Unknown instruction type: ${instructionType}`);
    }
  }
}

class RInstruction extends Instruction {
  public rs1: number;
  public rs2: number;
  public rd: number;

  constructor(
    rs1: number,
    rs2: number,
    rd: number,
    raw: string,
    originalIndex?: number
  ) {
    super(raw, originalIndex);
    this.rs1 = rs1;
    this.rs2 = rs2;
    this.rd = rd;
  }

  static fromInstruction(
    inst: Instruction,
    rs1: number,
    rs2: number,
    rd: number
  ): RInstruction {
    return new RInstruction(rs1, rs2, rd, inst.raw, inst.originalIndex);
  }
}
export class AddInstruction extends RInstruction {
  get readingRegisters(): [number | undefined, number | undefined] {
    return [this.rs1, this.rs2];
  }
  get writingRegister(): number {
    return this.rd;
  }
  get writingAvailableStage(): "EX" | "MEM" | undefined {
    return "EX";
  }
  static fromRInstruction(inst: RInstruction): AddInstruction {
    return new AddInstruction(
      inst.rs1,
      inst.rs2,
      inst.rd,
      inst.raw,
      inst.originalIndex
    );
  }
}

class IInstruction extends Instruction {
  public rs1: number;
  public rd: number;
  public immediate: number;

  constructor(
    rs1: number,
    rd: number,
    immediate: number,
    raw: string,
    originalIndex?: number
  ) {
    super(raw, originalIndex);
    this.rs1 = rs1;
    this.rd = rd;
    this.immediate = immediate;
  }
  static fromInstruction(
    inst: Instruction,
    rs1: number,
    rd: number,
    immediate: number
  ): IInstruction {
    return new IInstruction(rs1, rd, immediate, inst.raw, inst.originalIndex);
  }
}

export class LwInstruction extends IInstruction {
  get readingRegisters(): [number | undefined, number | undefined] {
    return [this.rs1, undefined];
  }
  get writingRegister(): number {
    return this.rd;
  }
  get writingAvailableStage(): "EX" | "MEM" | undefined {
    return "MEM";
  }
  static fromIInstruction(inst: IInstruction): LwInstruction {
    return new LwInstruction(
      inst.rs1,
      inst.rd,
      inst.immediate,
      inst.raw,
      inst.originalIndex
    );
  }
}

export class SwInstruction extends IInstruction {
  get readingRegisters(): [number | undefined, number | undefined] {
    return [this.rs1, this.rd];
  }
  get writingRegister(): number | undefined {
    return undefined;
  }
  get writingAvailableStage(): "EX" | "MEM" | undefined {
    return undefined;
  }
  static fromIInstruction(inst: IInstruction): SwInstruction {
    return new SwInstruction(
      inst.rs1,
      inst.rd,
      inst.immediate,
      inst.raw,
      inst.originalIndex
    );
  }
}

export class BeqInstruction extends IInstruction {
  get readingRegisters(): [number | undefined, number | undefined] {
    return [this.rs1, this.rd];
  }
  get writingRegister(): number | undefined {
    return undefined;
  }
  get writingAvailableStage(): "EX" | "MEM" | undefined {
    return undefined;
  }
  static fromIInstruction(inst: IInstruction): BeqInstruction {
    return new BeqInstruction(
      inst.rs1,
      inst.rd,
      inst.immediate,
      inst.raw,
      inst.originalIndex
    );
  }
}

export class AddiInstruction extends IInstruction {
  get readingRegisters(): [number | undefined, number | undefined] {
    return [this.rs1, undefined];
  }
  get writingRegister(): number {
    return this.rd;
  }
  get writingAvailableStage(): "EX" | "MEM" | undefined {
    return "EX";
  }
  static fromIInstruction(inst: IInstruction): AddiInstruction {
    return new AddiInstruction(
      inst.rs1,
      inst.rd,
      inst.immediate,
      inst.raw,
      inst.originalIndex
    );
  }
}

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

export class InstructionMemory {
  public instructions: Instruction[];

  constructor(instructions: Instruction[]) {
    this.instructions = instructions;
  }
  getInstructionAt(index: number): Instruction {
    if (index < 0 || index >= 1000) {
      throw new Error(`Instruction index out of bounds: ${index}`);
    }
    if (index >= this.instructions.length) {
      return Instruction.default();
    }
    return this.instructions[index];
  }
  getSize(): number {
    return this.instructions.length;
  }

  static parse(raw: string): InstructionMemory {
    const instructions = raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !line.startsWith("#"))
      .map((line, index) => Instruction.parse(line, index));
    return new InstructionMemory(instructions);
  }

  reset() {
    this.instructions = [];
  }
}
