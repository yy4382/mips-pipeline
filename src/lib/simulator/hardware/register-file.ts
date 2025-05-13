const REGISTER_FILE_SIZE = 32 + 16;

export class RegisterFile {
  private registers: number[];

  constructor() {
    this.registers = new Array(REGISTER_FILE_SIZE).fill(0);
  }

  getAt(indexOrName: number | string): number {
    const index =
      typeof indexOrName === "number"
        ? indexOrName
        : getRegisterIndex(indexOrName);
    if (index < 0 || index >= REGISTER_FILE_SIZE) {
      throw new Error(`Register index out of bounds: ${index}`);
    }
    if (index === 0) {
      return 0; // Register $0 is always 0
    }
    return this.registers[index];
  }
  setAt(indexOrName: number | string, value: number): void {
    const index =
      typeof indexOrName === "number"
        ? indexOrName
        : getRegisterIndex(indexOrName);
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
      if (isNaN(value)) {
        this.registers[index] = value; // if the value is NaN, use NaN (useful in tomasulo)
      } else {
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

const registerNameMapping: Record<string, number> = {
  $zero: 0,
  $at: 1,
  $v0: 2,
  $v1: 3,
  $a0: 4,
  $a1: 5,
  $a2: 6,
  $a3: 7,
  $t0: 8,
  $t1: 9,
  $t2: 10,
  $t3: 11,
  $t4: 12,
  $t5: 13,
  $t6: 14,
  $t7: 15,
  $s0: 16,
  $s1: 17,
  $s2: 18,
  $s3: 19,
  $s4: 20,
  $s5: 21,
  $s6: 22,
  $s7: 23,
  $t8: 24,
  $t9: 25,
  $k0: 26,
  $k1: 27,
  $gp: 28,
  $sp: 29,
  $fp: 30,
  $ra: 31,

  $f0: 32,
  $f1: 33,
  $f2: 34,
  $f3: 35,
  $f4: 36,
  $f5: 37,
  $f6: 38,
  $f7: 39,
  $f8: 40,
  $f9: 41,
  $f10: 42,
  $f11: 43,
  $f12: 44,
  $f13: 45,
  $f14: 46,
  $f15: 47,
};

export function getRegisterIndex(str: string) {
  const trimmed = str.trim();
  if (trimmed.charAt(0) !== "$" || trimmed.length < 2) {
    throw new Error(`Invalid register name: ${str}`);
  }
  if (trimmed.length === 2) {
    const index = parseInt(trimmed.substring(1), 10);
    if (isNaN(index) || index < 0 || index >= REGISTER_FILE_SIZE) {
      throw new Error(`Invalid register index: ${str}`);
    }
    return index;
  }
  const index = registerNameMapping[trimmed];
  if (index === undefined) {
    throw new Error(`Invalid register name: ${str}`);
  }
  return index;
}

export function getRegisterName(index: number) {
  if (index < 0 || index >= REGISTER_FILE_SIZE) {
    throw new Error(`Invalid register index: ${index}`);
  }
  if (index === 0) {
    return "$0";
  }
  for (const [name, idx] of Object.entries(registerNameMapping)) {
    if (idx === index) {
      return name;
    }
  }
  return `$${index}`; // Fallback to numeric representation
}
