const REGISTER_FILE_SIZE = 32;
export class RegisterFile {
  private registers: number[];
  constructor() {
    this.registers = new Array(REGISTER_FILE_SIZE).fill(0);
  }

  getAt(index: number): number {
    if (index < 0 || index >= REGISTER_FILE_SIZE) {
      throw new Error(`Register index out of bounds: ${index}`);
    }
    if (index === 0) {
      return 0; // Register $0 is always 0
    }
    return this.registers[index];
  }
  setAt(index: number, value: number): void {
    if (index < 0 || index >= REGISTER_FILE_SIZE) {
      throw new Error(`Register index out of bounds: ${index}`);
    }
    if (index === 0) {
      return; // Register $0 is always 0, ignore writes to it
    }
    this.registers[index] = value;
  }
}