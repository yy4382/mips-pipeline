const MEMORY_SIZE = 32;

// Define the type for the listener callback
type MemoryChangeListener = (memory: readonly number[]) => void;

export class Memory {
  private memory: number[];
  private listeners: Set<MemoryChangeListener>; // Use a Set to avoid duplicate listeners

  constructor() {
    this.memory = new Array(MEMORY_SIZE).fill(0);
    this.listeners = new Set();
  }

  // Method to notify all listeners
  private notifyListeners(): void {
    const readOnlyMemory = this.getMemory(); // Get the current state
    this.listeners.forEach(listener => listener(readOnlyMemory));
  }

  // Method for components to subscribe to changes
  subscribe(listener: MemoryChangeListener): () => void {
    this.listeners.add(listener);
    // Return an unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Optional: Explicit unsubscribe method if needed elsewhere
  unsubscribe(listener: MemoryChangeListener): void {
    this.listeners.delete(listener);
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
    let changed = false;
    if (isNaN(numericValue)) {
        console.warn(`Attempted to set non-numeric value at index ${index}: ${value}`);
        // Optionally throw an error or default to 0
        // throw new Error(`Invalid value type for memory at index ${index}: ${value}`);
        if (this.memory[index] !== 0) {
            this.memory[index] = 0; // Defaulting to 0 if input is not a valid number
            changed = true;
        }
    } else if (this.memory[index] !== numericValue) {
        this.memory[index] = numericValue;
        changed = true;
    }

    // Notify listeners only if the value actually changed
    if (changed) {
        this.notifyListeners();
    }
  }

  reset() {
    const hadNonZero = this.memory.some(val => val !== 0);
    this.memory.fill(0);
    // Notify listeners only if the memory actually changed
    if (hadNonZero) {
        this.notifyListeners();
    }
  }

  getSize(): number {
    return MEMORY_SIZE;
  }

  getMemory(): readonly number[] {
    // Return a read-only copy to prevent direct modification outside setAt
    return [...this.memory];
  }
}