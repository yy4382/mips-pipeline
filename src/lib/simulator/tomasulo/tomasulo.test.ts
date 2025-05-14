import { expect, test } from "vitest";
import { TomasuloProcessor } from "./tomasulo";
import { getIMemToma } from "./instruction";
import { describe } from "node:test";

function runToEnd(
  processor: TomasuloProcessor,
  opt?: { debug?: boolean; maxStep?: number }
) {
  let step = 0;
  while (step < (opt?.maxStep ?? 100)) {
    step++;
    if (opt?.debug) {
      console.log(`step ${step}`);
    }
    const isFinished = processor.step({ debug: opt?.debug });
    if (isFinished) {
      break;
    }
  }
  return step;
}

test("tomasulo add only 1", () => {
  const processor = new TomasuloProcessor(getIMemToma("ADD.D $f0, $f2, $f4"));
  processor.registerFile.setAt("$f2", 1);
  processor.registerFile.setAt("$f4", 2);

  runToEnd(processor);
  expect(processor.registerFile.getAt("$f0")).toBe(3);
});

test("tomasulo load and store", () => {
  const inst = `
  L.D $f0, 0($0)
  L.D $f2, 1($0)
  ADD.D $f4, $f0, $f2
  S.D $f4, 0($0)
  `;
  const processor = new TomasuloProcessor(getIMemToma(inst));
  processor.dMem.setAt(0, 1);
  processor.dMem.setAt(1, 2);

  let step = 0;
  while (step < 20) {
    step++;
    console.log(`step ${step}`);
    const isFinished = processor.step({ debug: true });
    if (isFinished) {
      break;
    }
  }
  expect(step).not.toBe(20);
  expect(processor.dMem.getAt(0)).toBe(3);
});

test("tomasulo WAR", () => {
  const inst = `
  ADD.D $f0, $f2, $f4
  ADD.D $f2, $f4, $f6
  `;
  const processor = new TomasuloProcessor(getIMemToma(inst));
  processor.registerFile.setAt("$f2", 1);
  processor.registerFile.setAt("$f4", 2);
  processor.registerFile.setAt("$f6", 3);

  const step = runToEnd(processor);
  expect(step).not.toBe(20);
  expect(step).toBe(5);

  expect(processor.registerFile.getAt("$f0")).toBe(3);
});

test("tomasulo example in slide", () => {
  const inst = `
  L.D $f6, 0($2) 
  L.D $f2, 0($3) 
  MUL.D $f0, $f2, $f4 
  SUB.D $f8, $f6, $f2
  DIV.D $f10, $f0, $f6
  ADD.D $f6, $f8, $f2
  `;
  const processor = new TomasuloProcessor(getIMemToma(inst), {
    add: 3,
    mul: 2,
    mem: 3,
  });
  processor.registerFile.setAt("$2", 2);
  processor.registerFile.setAt("$3", 3);
  processor.dMem.setAt(2, 1);
  processor.dMem.setAt(3, 2);

  const step = runToEnd(processor);
  expect(step).not.toBe(100);
  expect(step).toBe(57);
});

describe("tomasulo cbd available tests", () => {
  test("arithmetic", () => {
    const inst = `
MUL.D $f1, $f2, $f3
ADD.D $f4, $f1, $f5
SUB.D $f6, $f1, $f7
`;
    const processor = new TomasuloProcessor(getIMemToma(inst));
    processor.registerFile.setAt("$f2", 1);
    processor.registerFile.setAt("$f3", 2);
    processor.registerFile.setAt("$f5", 3);
    processor.registerFile.setAt("$f7", 4);

    const step = runToEnd(processor);
    expect(step).toBe(16);

    expect(processor.registerFile.getAt("$f1")).toBe(2);
    expect(processor.registerFile.getAt("$f4")).toBe(5);
    expect(processor.registerFile.getAt("$f6")).toBe(-2);
  });

  test("arithmetic and load", () => {
    const inst = `
ADD.D $f1, $f1, $f2
ADD.D $f0, $f1, $f2
ADD.D $f3, $f3, $f3
L.D $f0, 0($0)
`;
    const processor = new TomasuloProcessor(getIMemToma(inst));

    const step = runToEnd(processor);
    expect(step).toBe(8);
  });
});

describe("tomasulo load/store buffer", () => {
  test("load & load", () => {
    // as the current implementation, load & load will always be async to each other
    // because their execution start can not be delayed
    const inst = `
L.D $f0, 0($0)
L.D $f2, 0($1)
    `;
    const processor = new TomasuloProcessor(getIMemToma(inst));
    const step = runToEnd(processor);
    expect(step).toBe(10);
  });
  test("store and then load", () => {
    const inst = `
S.D $f0, 0($0)
L.D $f2, 0($1)
    `;
    const processor = new TomasuloProcessor(getIMemToma(inst));
    processor.dMem.setAt(0, 1);

    const step = runToEnd(processor);
    expect(step).toBe(7);
  });
});
