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
    // Ensure value is treated as a number
    const numericValue = Number(value);

    if (isNaN(numericValue)) {
      console.warn(
        `Attempted to set non-numeric value in register ${index}: ${value}`
      );
      // Optionally throw an error or default to 0
      // throw new Error(`Invalid value type for register ${index}: ${value}`);
      if (this.registers[index] !== 0) {
        this.registers[index] = 0; // Defaulting to 0
      }
    } else if (this.registers[index] !== numericValue) {
      this.registers[index] = numericValue;
    }
  }

  reset() {
    this.registers.fill(0);
  }

  getSize(): number {
    return REGISTER_FILE_SIZE;
  }

  getRegisters(): readonly number[] {
    // Return a read-only copy
    return [...this.registers];
  }
}
