import * as Is from "./instruction";

import { describe, expect, test } from "vitest";
describe("parseInstruction", () => {
  test("parseInstruction - load instruction", () => {
    const inst = Is.Instruction.parse("load $1, 4($0)");
    expect(inst.raw).toBe("load $1, 4($0)");

    expect(inst).toBeInstanceOf(Is.LoadSaveInstruction);
    const checkedInst = inst as Is.LoadSaveInstruction;

    expect(checkedInst.addressOffset).toBe(4);
    expect(checkedInst.startingRegisterIndex).toBe(0);
    expect(checkedInst.registerIndex).toBe(1);
    expect(checkedInst.type).toBe("load");
  });
  test("parseInstruction - store instruction", () => {
    const inst = Is.Instruction.parse("store $1, -2($3)");
    expect(inst.raw).toBe("store $1, -2($3)");

    expect(inst).toBeInstanceOf(Is.LoadSaveInstruction);
    const checkedInst = inst as Is.LoadSaveInstruction;

    expect(checkedInst.addressOffset).toBe(-2);
    expect(checkedInst.startingRegisterIndex).toBe(3);
    expect(checkedInst.registerIndex).toBe(1);
    expect(checkedInst.type).toBe("store");
  });
  test("parseInstruction - add instruction", () => {
    const inst = Is.Instruction.parse("add $1, $2, $3");
    expect(inst.raw).toBe("add $1, $2, $3");

    expect(inst).toBeInstanceOf(Is.ArithmeticInstruction);
    const checkedInst = inst as Is.ArithmeticInstruction;

    expect(checkedInst.registerIndex1).toBe(2);
    expect(checkedInst.registerIndex2).toBe(3);
    expect(checkedInst.resultRegisterIndex).toBe(1);
    expect(checkedInst.operation).toBe("add");
  });
  test("parseInstruction - beqz instruction", () => {
    const inst = Is.Instruction.parse("beqz $1, 2");
    expect(inst.raw).toBe("beqz $1, 2");

    expect(inst).toBeInstanceOf(Is.BranchInstruction);

    const checkedInst = inst as Is.BranchInstruction;
    expect(checkedInst.type).toBe("beqz");
    expect(checkedInst.registerIndex).toBe(1);
    expect(checkedInst.offset).toBe(2);
  });
});
