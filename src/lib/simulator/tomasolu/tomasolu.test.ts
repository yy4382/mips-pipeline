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

  processor.step();
  processor.step();
  processor.step();
  processor.step();
  processor.step();
  processor.step();
  processor.step();
  processor.step();
  processor.step();
  processor.step();
  processor.step();
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

  processor.step();
  processor.step();
  processor.step();
  processor.step();
  processor.step();
  processor.step();
  processor.step();

  expect(processor.registerFile.getAt("$f0")).toBe(3);
});
