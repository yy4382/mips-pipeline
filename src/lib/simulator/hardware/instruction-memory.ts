import { InstructionType } from "../instruction-parse/parse-inst";

export class InstructionMemory<T extends InstructionType> {
  public instructions: T[];
  public getDefaultInst: () => T;

  constructor(instructions: T[], getDefaultInst: () => T) {
    this.instructions = instructions;
    this.getDefaultInst = getDefaultInst;
  }
  getInstructionAt(index: number): T {
    if (index < 0 || index >= 1000) {
      throw new Error(`Instruction index out of bounds: ${index}`);
    }
    if (index >= this.instructions.length) {
      return this.getDefaultInst();
    }
    return this.instructions[index];
  }
  getSize(): number {
    return this.instructions.length;
  }

  reset() {
    this.instructions = [];
  }
}
