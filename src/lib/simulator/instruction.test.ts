import * as Is from "./instruction";

import { describe, expect, test } from "vitest";
describe("parseInstruction", () => {
  test("parseInstruction - load instruction", () => {
    const inst = Is.Instruction.parse("lw $1, 4($0)");
    expect(inst.raw).toBe("lw $1, 4($0)");

    expect(inst).toBeInstanceOf(Is.LwInstruction);
    const checkedInst = inst as Is.LwInstruction;

    expect(checkedInst.immediate).toBe(4);
    expect(checkedInst.rs1).toBe(0);
    expect(checkedInst.rd).toBe(1);
  });
  test("parseInstruction - store instruction", () => {
    const inst = Is.Instruction.parse("sw $1, -2($3)");
    expect(inst.raw).toBe("sw $1, -2($3)");

    expect(inst).toBeInstanceOf(Is.SwInstruction);
    const checkedInst = inst as Is.SwInstruction;

    expect(checkedInst.immediate).toBe(-2);
    expect(checkedInst.rs1).toBe(3);
    expect(checkedInst.rd).toBe(1);
  });
  test("parseInstruction - add instruction", () => {
    const inst = Is.Instruction.parse("add $1, $2, $3");
    expect(inst.raw).toBe("add $1, $2, $3");

    expect(inst).toBeInstanceOf(Is.AddInstruction);
    const checkedInst = inst as Is.AddInstruction;

    expect(checkedInst.rs1).toBe(2);
    expect(checkedInst.rs2).toBe(3);
    expect(checkedInst.rd).toBe(1);
  });
  test("parseInstruction - beqz instruction", () => {
    const inst = Is.Instruction.parse("beqz $1, 2");
    expect(inst.raw).toBe("beqz $1, 2");

    expect(inst).toBeInstanceOf(Is.BeqInstruction);

    const checkedInst = inst as Is.BeqInstruction;
    expect(checkedInst.rs1).toBe(1);
    expect(checkedInst.rd).toBe(0);
    expect(checkedInst.immediate).toBe(2);
  });
});
