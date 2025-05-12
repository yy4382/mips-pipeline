import { describe, expect, test } from "vitest";
import { Pipeline } from "./pipeline";
import { InstructionMemory } from "../hardware/instruction-memory";

test("pipeline - basic", () => {
  const iMem = InstructionMemory.parse(`
    lw $1, 0($0)
    lw $2, 1($0)
    nop
    nop
    add $3, $1, $2
    nop
    nop
    sw $3, 2($0)
    `);
  const pipeline = new Pipeline(iMem);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);
  pipeline.tick(-1);
  expect(pipeline.mem.getAt(2)).toBe(3);
  expect(pipeline.registerFile.getAt(1)).toBe(1);
  expect(pipeline.registerFile.getAt(2)).toBe(2);
});

test("pipeline - basic branch - not branch", () => {
  const iMem = InstructionMemory.parse(`
    lw $1, 0($0)
    lw $2, 1($0)
    nop # avoid RAW
    nop # avoid RAW
    beqz $1, target
    add $3, $2, $2
    target:
    nop
    nop
    add $4, $1, $1
    `);
  const pipeline = new Pipeline(iMem);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);

  pipeline.tick(-1);

  expect(pipeline.registerFile.getAt(3)).toBe(4);
  expect(pipeline.registerFile.getAt(4)).toBe(2);
});
test("pipeline - basic branch - should branch", () => {
  const iMem = InstructionMemory.parse(`
    lw $1, 0($0)
    lw $2, 1($0)
    nop
    nop
    nop
    beqz $0, target
    add $3, $2, $2
    target:
    nop
    nop
    add $4, $1, $1
    `);
  const pipeline = new Pipeline(iMem);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);

  pipeline.tick(-1);

  expect(pipeline.registerFile.getAt(3)).toBe(0);
  expect(pipeline.registerFile.getAt(4)).toBe(2);
});

test("pipeline - RAW", () => {
  const iMem = InstructionMemory.parse(`
    lw $1, 0($0)
    lw $2, 1($0)
    add $3, $1, $2
    sw $3, 2($0)
    `);
  const pipeline = new Pipeline(iMem);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);
  pipeline.tick(-1);
  expect(pipeline.mem.getAt(2)).toBe(3);
  expect(pipeline.registerFile.getAt(1)).toBe(1);
  expect(pipeline.registerFile.getAt(2)).toBe(2);
  expect(pipeline.statistics.dataHazardStalls).toBe(4);
});

test("pipeline - will branch and branch inst as RAW", () => {
  const iMem = InstructionMemory.parse(`
    lw $1, 0($0)
    lw $2, 1($0)
    lw $3, 2($0)
    beqz $3, target
    add $4, $1, $2
    add $5, $1, $2
    target:
    add $6, $1, $2
    `);
  const pipeline = new Pipeline(iMem);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);
  pipeline.mem.setAt(2, 0);
  pipeline.tick(-1);
  expect(pipeline.registerFile.getAt(4)).toBe(0);
  expect(pipeline.registerFile.getAt(5)).toBe(0);
  expect(pipeline.registerFile.getAt(6)).toBe(3);
  expect(pipeline.statistics.dataHazardStalls).toBe(2);
  expect(pipeline.statistics.predictFails).toBe(1);
});

test("pipeline - will branch and flushed inst has RAW", () => {
  const iMem = InstructionMemory.parse(`
    lw $1, 0($0)
    beqz $0, 3
    lw $2, 1($0)
    add $3, $1, $2
    add $4, $1, $2
    `);
  const pipeline = new Pipeline(iMem);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);
  pipeline.mem.setAt(2, 0);
  pipeline.tick(-1);
  expect(pipeline.registerFile.getAt(3)).toBe(0);
  expect(pipeline.registerFile.getAt(4)).toBe(1);
  expect(pipeline.statistics.dataHazardStalls).toBe(0);
});

test("pipeline - RAW and not branch", () => {
  const iMem = InstructionMemory.parse(`
    lw $1, 0($0)
    lw $2, 1($0)
    lw $3, 2($0)
    beqz $2, 3
    add $4, $1, $3
    add $5, $1, $2
    add $6, $1, $2
    `);
  const pipeline = new Pipeline(iMem);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);
  pipeline.mem.setAt(2, 3);
  pipeline.tick(-1);
  expect(pipeline.registerFile.getAt(4)).toBe(4);
  expect(pipeline.registerFile.getAt(5)).toBe(3);
  expect(pipeline.registerFile.getAt(6)).toBe(3);
  expect(pipeline.statistics.dataHazardStalls).toBe(1);
});

test("pipeline - RAW(forward)", () => {
  const iMem = InstructionMemory.parse(`
    lw $1, 0($0)
    lw $2, 1($0)
    add $3, $1, $2
    sw $3, 2($0)
    `);
  const pipeline = new Pipeline(iMem, true);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);
  pipeline.tick(-1);
  expect(pipeline.mem.getAt(2)).toBe(3);
  expect(pipeline.registerFile.getAt(1)).toBe(1);
  expect(pipeline.registerFile.getAt(2)).toBe(2);
  expect(pipeline.statistics.dataHazardStalls).toBe(1);
  expect(pipeline.statistics.forwardCount).toBe(2);
});
test("pipeline - RAW(forward)2", () => {
  const iMem = InstructionMemory.parse(`
    lw $1, 0($0)
    lw $2, 1($0)
    add $3, $1, $2
    add $4, $3, $3
    `);
  const pipeline = new Pipeline(iMem, true);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);
  pipeline.tick(-1);
  expect(pipeline.registerFile.getAt(3)).toBe(3);
  expect(pipeline.registerFile.getAt(4)).toBe(6);
});
test("pipeline - RAW(forward) data both available in EX/MEM and MEM/WB", () => {
  const iMem = InstructionMemory.parse(`
    li $1, 1
    li $2, 2
    li $3, 3
    li $4, 4
    add $1, $1, $2
    add $1, $1, $3
    add $1, $1, $4
    `);
  const pipeline = new Pipeline(iMem, true);
  pipeline.tick(-1);
  expect(pipeline.registerFile.getAt(1)).toBe(10);
});

test("pipeline - branch jump back", () => {
  const iMem = InstructionMemory.parse(`
li $3, 3
target: addi $1, $1, 1
bne $1, $3, target
sw $1, 0($0)
    `);
  const pipeline = new Pipeline(iMem, true);
  pipeline.tick(-1);
  expect(pipeline.registerFile.getAt(1)).toBe(3);
});

describe("pipeline - fibonacci", () => {
  const fibonacci = `
lw $1, 0($0)
ble $1, $0, invalid_input
li $2, 0
li $3, 1
beq $1, $3, return_0 # if $1 == 1, return_0
li $4, 2
beq $1, $4, return_1 # if $1 == 2, return_1
addi $1, $1, -2 # because the first two fibonacci numbers are 0 and 1
loop:
  beqz $1, end
  addi $1, $1, -1
  add $4, $2, $3
  addi $2, $3, 0
  addi $3, $4, 0
  beqz $0, loop
invalid_input:
  li $3, -1
  beqz $0, end
return_0:
  li $3, 0
  beqz $0, end
return_1:
  li $3, 1
  beqz $0, end
end:
  sw $3, 1($0)
`;
  test("pipeline - calculate fibonacci 10th", () => {
    const iMem = InstructionMemory.parse(fibonacci);

    const pipeline = new Pipeline(iMem, true);
    pipeline.mem.setAt(0, 10); // calculate the 10th fibonacci number
    pipeline.tick(-1);
    expect(pipeline.mem.getAt(1)).toBe(34);
  });
  test("pipeline - calculate fibonacci 1th", () => {
    const iMem = InstructionMemory.parse(fibonacci);
    const pipeline = new Pipeline(iMem, true);
    pipeline.mem.setAt(0, 1); // calculate the 1th fibonacci number
    pipeline.tick(-1);
    expect(pipeline.mem.getAt(1)).toBe(0);
  });
  test("pipeline - calculate fibonacci 2th", () => {
    const iMem = InstructionMemory.parse(fibonacci);
    const pipeline = new Pipeline(iMem, true);
    pipeline.mem.setAt(0, 2); // calculate the 2th fibonacci number
    pipeline.tick(-1);
    expect(pipeline.mem.getAt(1)).toBe(1);
  });
  test("pipeline - calculate fibonacci 0th (return -1)", () => {
    const iMem = InstructionMemory.parse(fibonacci);
    const pipeline = new Pipeline(iMem, true);
    pipeline.mem.setAt(0, 0); // calculate the 0th fibonacci number (should return -1)
    pipeline.tick(-1);
    expect(pipeline.mem.getAt(1)).toBe(-1);
  });
});
