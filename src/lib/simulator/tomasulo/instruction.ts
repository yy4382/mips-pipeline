import { InstructionMemory } from "../hardware/instruction-memory";
import {
  InstructionType,
  InstructionTypeFirstPassWithoutIndex,
  parseFirstPass,
  parseMemType,
  parseRType,
  parseSecondPass,
} from "../instruction-parse/parse-inst";
import z from "zod";

const SUPPORTED_INSTRUCTIONS = [
  "L.D",
  "S.D",
  "ADD.D",
  "SUB.D",
  "MUL.D",
  "DIV.D",
] as const;
const supportedInstructionSchema = z.enum(SUPPORTED_INSTRUCTIONS);
type SupportedInstruction = z.infer<typeof supportedInstructionSchema>;

export type InstToma = InstructionType & {
  instType: SupportedInstruction;
};

export function parseInstsToma(raw: string[]): InstToma[] {
  const { inst, labels } = parseFirstPass(raw, parse);
  return parseSecondPass(inst, labels);
}

function parse(
  instTypeIn: string,
  remaining: string,
  raw: string
): InstructionTypeFirstPassWithoutIndex<InstToma> {
  const instType = supportedInstructionSchema.parse(instTypeIn);
  if (instType === "L.D") {
    const [rs1, rd, imm] = parseMemType(remaining);
    // rs1 is the offset, rd is the destination register
    return {
      instType,
      rs: [rs1, undefined],
      rd,
      immediate: imm,
      raw,
    };
  } else if (instType === "S.D") {
    const [rs1, rs2, imm] = parseMemType(remaining);
    // rs1 is the offset, rs2 is the data to be stored
    return {
      instType,
      rs: [rs1, rs2],
      rd: undefined,
      immediate: imm,
      raw,
    };
  } else {
    const [rs1, rs2, rd] = parseRType(remaining);
    return {
      instType,
      rs: [rs1, rs2],
      rd,
      immediate: undefined,
      raw,
    };
  }
}

export function getIMemToma(raw: string): InstructionMemory<InstToma> {
  const insts = parseInstsToma(raw.split("\n"));
  return new InstructionMemory(insts, () => {
    throw new Error(
      "Should not be called, tomasulo does not need to insert default instructions"
    );
  });
}
