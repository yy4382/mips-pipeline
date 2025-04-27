import { expect, test } from "vitest";
import { Pipeline } from "./pipline";
import { InstructionMemory } from "./instruction";

test("pipeline - basic", () => {
  const iMem = InstructionMemory.parse(`
    load $1, 0($0)
    load $2, 1($0)
    add $0, $0, $0
    add $0, $0, $0
    add $0, $0, $0
    add $3, $1, $2
    add $0, $0, $0
    add $0, $0, $0
    add $0, $0, $0
    store $3, 2($0)
    `)
  const pipeline = new Pipeline(iMem);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);
  for (let i = 0; i < 15; i++) {
    console.log(`tick ${i}`);
    pipeline._tick();
  }
  expect(pipeline.mem.getAt(2)).toBe(3);
  expect(pipeline.registerFile.getAt(1)).toBe(1);
  expect(pipeline.registerFile.getAt(2)).toBe(2);
})

test("pipeline - basic branch - not branch", () => {
  const iMem = InstructionMemory.parse(`
    load $1, 0($0)
    load $2, 1($0)
    add $0, $0, $0
    add $0, $0, $0
    add $0, $0, $0
    beqz $1, 2
    add $3, $2, $2
    add $0, $0, $0
    add $0, $0, $0
    add $4, $1, $1
    `)
  const pipeline = new Pipeline(iMem);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);
  
  for (let i = 0; i < 15; i++) {
    console.log(`tick ${i}`);
    pipeline._tick();
  }
  expect(pipeline.registerFile.getAt(3)).toBe(4);
  expect(pipeline.registerFile.getAt(4)).toBe(2);
})
test("pipeline - basic branch - should branch", () => {
  const iMem = InstructionMemory.parse(`
    load $1, 0($0)
    load $2, 1($0)
    add $0, $0, $0
    add $0, $0, $0
    add $0, $0, $0
    beqz $0, 2
    add $3, $2, $2
    add $0, $0, $0
    add $0, $0, $0
    add $4, $1, $1
    `)
  const pipeline = new Pipeline(iMem);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);
  
  for (let i = 0; i < 15; i++) {
    console.log(`tick ${i}`);
    pipeline._tick();
  }
  expect(pipeline.registerFile.getAt(3)).toBe(0);
  expect(pipeline.registerFile.getAt(4)).toBe(2);
})

test("pipeline - RAW", () => {
  const iMem = InstructionMemory.parse(`
    load $1, 0($0)
    load $2, 1($0)
    add $3, $1, $2
    store $3, 2($0)
    `)
  const pipeline = new Pipeline(iMem);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);
  for (let i = 0; i < 15; i++) {
    console.log(`tick ${i}`);
    pipeline._tick();
  }
  expect(pipeline.mem.getAt(2)).toBe(3);
  expect(pipeline.registerFile.getAt(1)).toBe(1);
  expect(pipeline.registerFile.getAt(2)).toBe(2);
})

test("pipeline - will branch and branch inst as RAW", () => {
  const iMem = InstructionMemory.parse(`
    load $1, 0($0)
    load $2, 1($0)
    load $3, 2($0)
    beqz $3, 3
    add $4, $1, $2
    add $5, $1, $2
    add $6, $1, $2
    `)
  const pipeline = new Pipeline(iMem);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);
  pipeline.mem.setAt(2, 0);
  for (let i = 0; i < 15; i++) {
    console.log(`tick ${i}`);
    pipeline._tick();
  }
  expect(pipeline.registerFile.getAt(4)).toBe(0);
  expect(pipeline.registerFile.getAt(5)).toBe(0);
  expect(pipeline.registerFile.getAt(6)).toBe(3);
})

test("pipeline - will branch and flushed inst has RAW", () => {
  const iMem = InstructionMemory.parse(`
    load $1, 0($0)
    beqz $0, 3
    load $2, 1($0)
    add $3, $1, $2
    add $4, $1, $2
    `)
  const pipeline = new Pipeline(iMem);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);
  pipeline.mem.setAt(2, 0);
  for (let i = 0; i < 15; i++) {
    console.log(`tick ${i}`);
    pipeline._tick();
  }
  expect(pipeline.registerFile.getAt(3)).toBe(0);
  expect(pipeline.registerFile.getAt(4)).toBe(1);
})

test("pipeline - RAW and not branch", () => {
  const iMem = InstructionMemory.parse(`
    load $1, 0($0)
    load $2, 1($0)
    load $3, 2($0)
    beqz $2, 3
    add $4, $1, $2
    add $5, $1, $2
    add $6, $1, $2
    `)
  const pipeline = new Pipeline(iMem);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);
  pipeline.mem.setAt(2, 0);
  for (let i = 0; i < 15; i++) {
    console.log(`tick ${i}`);
    pipeline._tick();
  }
  expect(pipeline.registerFile.getAt(4)).toBe(3);
  expect(pipeline.registerFile.getAt(5)).toBe(3);
  expect(pipeline.registerFile.getAt(6)).toBe(3);
})

test("pipeline - RAW(forward)", () => {
  const iMem = InstructionMemory.parse(`
    load $1, 0($0)
    load $2, 1($0)
    add $3, $1, $2
    store $3, 2($0)
    `)
  const pipeline = new Pipeline(iMem, true);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);
  for (let i = 0; i < 15; i++) {
    console.log(`tick ${i}`);
    pipeline._tick();
  }
  expect(pipeline.mem.getAt(2)).toBe(3);
  expect(pipeline.registerFile.getAt(1)).toBe(1);
  expect(pipeline.registerFile.getAt(2)).toBe(2);
})
test("pipeline - RAW(forward)2", () => {
  const iMem = InstructionMemory.parse(`
    load $1, 0($0)
    load $2, 1($0)
    add $3, $1, $2
    add $4, $3, $3
    `)
  const pipeline = new Pipeline(iMem, true);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);
  for (let i = 0; i < 15; i++) {
    console.log(`tick ${i}`);
    pipeline._tick();
  }
  expect(pipeline.registerFile.getAt(3)).toBe(3);
  expect(pipeline.registerFile.getAt(4)).toBe(6);
})
test("pipeline - RAW(forward)3", () => {
  const iMem = InstructionMemory.parse(`
    load $1, 0($0)
    load $2, 1($0)
    add $3, $1, $2
    add $4, $1, $3
    add $1, $1, $2
    add $1, $1, $3
    add $1, $1, $4
    `)
  const pipeline = new Pipeline(iMem, true);
  pipeline.mem.setAt(0, 1);
  pipeline.mem.setAt(1, 2);
  for (let i = 0; i < 15; i++) {
    console.log(`tick ${i}`);
    pipeline._tick();
  }
  expect(pipeline.registerFile.getAt(1)).toBe(10);
})