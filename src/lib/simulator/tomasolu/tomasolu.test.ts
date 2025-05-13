import { expect, test } from "vitest";
import { TomasoluProcessor } from "./tomasolu";
import { getIMemToma } from "./instruction";

test("tomasolu add only 1", () => {
  const processor = new TomasoluProcessor(getIMemToma("ADD.D $f0, $f2, $f4"));
  processor.registerFile.setAt("$f2", 1);
  processor.registerFile.setAt("$f4", 2);

  processor.step();
  processor.step();
  processor.step();
  processor.step();
  processor.step();
  processor.step();
  processor.step();
  expect(processor.registerFile.getAt("$f0")).toBe(3);
});

test("tomasolu load and store", () => {
  const inst = `
  L.D $f0, 0($0)
  L.D $f2, 1($0)
  ADD.D $f4, $f0, $f2
  S.D $f4, 0($0)
  `;
  const processor = new TomasoluProcessor(getIMemToma(inst));
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

test("tomasolu WAR", () => {
  const inst = `
  ADD.D $f0, $f2, $f4
  ADD.D $f2, $f4, $f6
  `;
  const processor = new TomasoluProcessor(getIMemToma(inst));
  processor.registerFile.setAt("$f2", 1);
  processor.registerFile.setAt("$f4", 2);
  processor.registerFile.setAt("$f6", 3);

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
  expect(step).toBe(5);

  expect(processor.registerFile.getAt("$f0")).toBe(3);
});

test("tomasolu example in slide", () => {
  const inst = `
  L.D $f6, 0($2) 
  L.D $f2, 0($3) 
  MUL.D $f0, $f2, $f4 
  SUB.D $f8, $f6, $f2
  DIV.D $f10, $f0, $f6
  ADD.D $f6, $f8, $f2
  `;
  const processor = new TomasoluProcessor(getIMemToma(inst), {
    add: 3,
    mul: 2,
    mem: 3,
  });
  processor.registerFile.setAt("$2", 2);
  processor.registerFile.setAt("$3", 3);
  processor.dMem.setAt(2, 1);
  processor.dMem.setAt(3, 2);

  let step = 0;
  while (step < 100) {
    step++;
    console.log(`step ${step}`);
    const isFinished = processor.step({ debug: true });
    if (isFinished) {
      break;
    }
  }
  expect(step).not.toBe(100);
  expect(step).toBe(57);
});
