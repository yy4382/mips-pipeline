const REGISTER_FILE_SIZE = 32;

// Define the type for the listener callback
type RegisterChangeListener = (registers: readonly number[]) => void;

export class RegisterFile {
  private registers: number[];
  private listeners: Set<RegisterChangeListener>; // Use a Set to avoid duplicate listeners

  constructor() {
    this.registers = new Array(REGISTER_FILE_SIZE).fill(0);
    this.listeners = new Set();
  }

  // Method to notify all listeners
  private notifyListeners(): void {
    const readOnlyRegisters = this.getRegisters(); // Get the current state
    console.debug("listener length:", this.listeners.size);
    this.listeners.forEach(listener => listener(readOnlyRegisters));
  }

  // Method for components to subscribe to changes
  subscribe(listener: RegisterChangeListener): () => void {
    this.listeners.add(listener);
    // Return an unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Optional: Explicit unsubscribe method if needed elsewhere
  unsubscribe(listener: RegisterChangeListener): void {
    this.listeners.delete(listener);
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
    let changed = false;

    if (isNaN(numericValue)) {
        console.warn(`Attempted to set non-numeric value in register ${index}: ${value}`);
        // Optionally throw an error or default to 0
        // throw new Error(`Invalid value type for register ${index}: ${value}`);
        if (this.registers[index] !== 0) {
            this.registers[index] = 0; // Defaulting to 0
            changed = true;
        }
    } else if (this.registers[index] !== numericValue) {
        this.registers[index] = numericValue;
        changed = true;
    }

    // Notify listeners only if the value actually changed
    if (changed) {
        console.debug(`Register ${index} changed to ${this.registers[index]}`);
        this.notifyListeners();
    }
  }

  reset() {
    const hadNonZero = this.registers.some((val, index) => index !== 0 && val !== 0);
    this.registers.fill(0);
    // Notify listeners only if the registers actually changed (ignoring $0)
    if (hadNonZero) {
        this.notifyListeners();
    }
  }

  getSize(): number {
    return REGISTER_FILE_SIZE;
  }

  getRegisters(): readonly number[] {
    // Return a read-only copy
    return [...this.registers];
  }
}