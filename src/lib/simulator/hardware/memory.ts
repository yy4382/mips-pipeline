const MEMORY_SIZE = 32;

export class Memory {
  private memory: number[];

  constructor() {
    this.memory = new Array(MEMORY_SIZE).fill(0);
  }

  getAt(index: number): number {
    if (index < 0 || index >= MEMORY_SIZE) {
      throw new Error(`Memory index out of bounds: ${index}`);
    }
    return this.memory[index];
  }

  setAt(index: number, value: number): void {
    if (index < 0 || index >= MEMORY_SIZE) {
      throw new Error(`Memory index out of bounds: ${index}`);
    }
    // Ensure value is treated as a number, handling potential string input from forms
    const numericValue = Number(value);
    if (isNaN(numericValue)) {
      console.warn(
        `Attempted to set non-numeric value at index ${index}: ${value}`
      );
      // Optionally throw an error or default to 0
      // throw new Error(`Invalid value type for memory at index ${index}: ${value}`);
      if (this.memory[index] !== 0) {
        this.memory[index] = 0; // Defaulting to 0 if input is not a valid number
      }
    } else if (this.memory[index] !== numericValue) {
      this.memory[index] = numericValue;
    }
  }

  reset() {
    this.memory.fill(0);
  }

  getSize(): number {
    return MEMORY_SIZE;
  }

  getMemory(): readonly number[] {
    // Return a read-only copy to prevent direct modification outside setAt
    return [...this.memory];
  }
}
