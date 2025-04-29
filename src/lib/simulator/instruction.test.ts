import * as Is from "./instruction";

import { describe, expect, test } from "vitest";

describe("parseInstruction", () => {
  test("should impl parse for all supported instructions", () => {
    const parserKeys = Array.from(Is.parsers.keys());
    Is._SUPPORTED_INSTRUCTIONS.forEach((inst) => {
      expect(parserKeys).toContain(inst);
    });
  });

  test("parseInstruction - load instruction", () => {
    const inst = Is.parseInsts(["lw $1, 4($0)"])[0];
    expect(inst.raw).toBe("lw $1, 4($0)");

    expect(inst.immediate).toBe(4);
    expect(inst.readingRegisters).toEqual([0, undefined]);
    expect(inst.writingRegister).toBe(1);
  });
  test("parseInstruction - store instruction", () => {
    const inst = Is.parseInsts(["sw $1, -2($3)"])[0];
    expect(inst.raw).toBe("sw $1, -2($3)");

    expect(inst.immediate).toBe(-2);
    expect(inst.writingRegister).toBe(undefined);
    expect(inst.readingRegisters).toEqual([3, 1]);
  });
  test("parseInstruction - add instruction", () => {
    const inst = Is.parseInsts(["add $1, $2, $3"])[0];
    expect(inst.raw).toBe("add $1, $2, $3");

    expect(inst.readingRegisters).toEqual([2, 3]);
    expect(inst.writingRegister).toBe(1);
  });
  test("parseInstruction - addi instruction", () => {
    const inst = Is.parseInsts(["addi $1, $2, 3"])[0];
    expect(inst.raw).toBe("addi $1, $2, 3");

    expect(inst.readingRegisters).toEqual([2, undefined]);
    expect(inst.immediate).toBe(3);
    expect(inst.writingRegister).toBe(1);
  });
  test("parseInstruction - beqz instruction", () => {
    const inst = Is.parseInsts(["beqz $1, 4"])[0];
    expect(inst.raw).toBe("beqz $1, 4");

    expect(inst.readingRegisters).toEqual([1, 0]);
    expect(inst.immediate).toBe(4);
    expect(inst.writingRegister).toBe(undefined);
  });
  test("parseInstruction - blt instruction", () => {
    const inst = Is.parseInsts(["blt $1, $2, 4"])[0];
    expect(inst.raw).toBe("blt $1, $2, 4");

    expect(inst.readingRegisters).toEqual([1, 2]);
    expect(inst.immediate).toBe(4);
    expect(inst.writingRegister).toBe(undefined);
  })
  test("parseInstruction: label", () => {
    const insts = Is.parseInsts(
      `
      main:
      lw $1, 4($0)
      second: lw $2, 4($0)
      beqz $1, main
      add $1, $2, $3
      beq $1, $2, third
      bne $1, $2, second
      third: addi $1, $2, 3
      `.split("\n")
    );
    expect(insts.length).toBe(7);
    expect(insts[2].immediate).toBe(-2);
    expect(insts[4].immediate).toBe(2);
    expect(insts[5].immediate).toBe(-4);
  });
});
