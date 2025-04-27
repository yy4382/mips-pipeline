const MEMORY_SIZE = 1024;
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
    this.memory[index] = value;
  }
  reset() {
    this.memory.fill(0);
  }
}