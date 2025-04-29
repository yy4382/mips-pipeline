import { getDefaultInst, Instruction, parseInsts } from "../instruction";

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
      return getDefaultInst();
    }
    return this.instructions[index];
  }
  getSize(): number {
    return this.instructions.length;
  }

  static parse(raw: string): InstructionMemory {
    const instructions = parseInsts(raw.split("\n"));
    return new InstructionMemory(instructions);
  }

  reset() {
    this.instructions = [];
  }
}
