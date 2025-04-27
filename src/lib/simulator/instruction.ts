class Instruction {
  public raw: string;
  public originalIndex: number | undefined;
  constructor(raw: string, originalIndex?: number) {
    this.raw = raw;
    this.originalIndex = originalIndex;
  }

  get rs1(): number | undefined {
    throw new Error("rs1 unimplemented");
  }
  get rs2(): number | undefined {
    throw new Error("rs2 unimplemented");
  }
  get rd(): number | undefined {
    throw new Error("rd unimplemented");
  }
  get immediate(): number | undefined {
    throw new Error("immediate unimplemented");
  }

  static default(): ArithmeticInstruction {
    return new ArithmeticInstruction(0, 0, 0, "add", "add $0, $0, $0 #NOP");
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

    switch (instructionType) {
      case "load":
      case "store": {
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

        return new LoadSaveInstruction(
          address,
          registerIndex,
          addressRegisterIndex,
          instructionType as "load" | "store",
          raw,
          index
        );
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
        return new ArithmeticInstruction(
          registerIndex1,
          registerIndex2,
          resultRegisterIndex,
          "add",
          raw,
          index
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
        return new BranchInstruction("beqz", registerIndex, offset, raw, index);
      }
      default:
        throw new Error(`Unknown instruction type: ${instructionType}`);
    }
  }
}

class LoadSaveInstruction extends Instruction {
  public addressOffset: number;
  public registerIndex: number;
  public startingRegisterIndex: number;
  public type: "load" | "store";

  constructor(
    addressOffset: number,
    registerIndex: number,
    startingRegisterIndex: number,
    type: "load" | "store",
    raw: string,
    originalIndex?: number
  ) {
    super(raw, originalIndex);
    this.addressOffset = addressOffset;
    this.registerIndex = registerIndex;
    this.startingRegisterIndex = startingRegisterIndex;
    this.type = type;
  }

  get rs1(): number {
    return this.startingRegisterIndex;
  }
  get rs2(): number | undefined {
    if (this.type === "store") {
      return this.registerIndex;
    }
    return undefined;
  }
  get rd(): number | undefined {
    if (this.type === "load") {
      return this.registerIndex;
    }
    return undefined;
  }
  get immediate(): number {
    return this.addressOffset;
  }
}

class ArithmeticInstruction extends Instruction {
  public registerIndex1: number;
  public registerIndex2: number;
  public resultRegisterIndex: number;
  public operation: "add";

  constructor(
    registerIndex1: number,
    registerIndex2: number,
    resultRegisterIndex: number,
    operation: "add",
    raw: string,
    originalIndex?: number
  ) {
    super(raw, originalIndex);
    this.registerIndex1 = registerIndex1;
    this.registerIndex2 = registerIndex2;
    this.resultRegisterIndex = resultRegisterIndex;
    this.operation = operation;
  }
  get rs1(): number {
    return this.registerIndex1;
  }
  get rs2(): number {
    return this.registerIndex2;
  }
  get rd(): number {
    return this.resultRegisterIndex;
  }
  get immediate(): number | undefined {
    return undefined;
  }
}

class BranchInstruction extends Instruction {
  public type: "beqz";
  public registerIndex: number;
  public offset: number;
  constructor(
    type: "beqz",
    registerIndex: number,
    offset: number,
    raw: string,
    originalIndex?: number
  ) {
    super(raw, originalIndex);
    this.type = type;
    this.registerIndex = registerIndex;
    this.offset = offset;
  }
  get rs1(): number {
    return this.registerIndex;
  }
  get rs2(): number | undefined {
    return undefined;
  }
  get rd(): number | undefined {
    return undefined;
  }
  get immediate(): number {
    return this.offset;
  }
}

class InstructionMemory {
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

export {
  Instruction,
  LoadSaveInstruction,
  ArithmeticInstruction,
  BranchInstruction,
  InstructionMemory,
};
