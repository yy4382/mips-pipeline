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
    pipeline.tick();
  }
  expect(pipeline.mem.getAt(2)).toBe(3);
  expect(pipeline.registerFile.getAt(1)).toBe(1);
  expect(pipeline.registerFile.getAt(2)).toBe(2);
})