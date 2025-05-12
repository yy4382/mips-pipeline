import { getRegisterIndex } from "../hardware/register-file";

export type InstructionType = {
  originalIndex: number | undefined;
  raw: string;

  instType: string;
  rs: [number | undefined, number | undefined];
  rd: number | undefined;
  immediate: number | undefined;
};
export type InstructionTypeFirstPass<T extends InstructionType> = Omit<
  T,
  "immediate"
> & {
  immediate: number | string | undefined;
};

export type InstructionTypeFirstPassWithoutIndex<T extends InstructionType> =
  Omit<InstructionTypeFirstPass<T>, "originalIndex">;

function parseFirstPass<T extends InstructionType>(
  raw: string[],
  parse: (
    instType: T["instType"],
    remaining: string,
    raw: string
  ) => InstructionTypeFirstPassWithoutIndex<T>
): { inst: InstructionTypeFirstPass<T>[]; labels: Map<string, number> } {
  return raw
    .filter((line) => line.trim())
    .map((line) => parseSingleInstFirstPass(line, parse))
    .reduce(
      (acc, { inst, foundLabel }) => {
        if (foundLabel) {
          acc.labels.set(foundLabel, acc.curIndex);
        }
        if (inst) {
          acc.inst.push({
            ...inst,
            originalIndex: acc.curIndex,
          } as InstructionTypeFirstPass<T>);
          acc.curIndex++;
        }
        return acc;
      },
      {
        inst: [] as InstructionTypeFirstPass<T>[],
        labels: new Map() as Map<string, number>,
        curIndex: 0,
      }
    );
}

function parseSecondPass<T extends InstructionType>(
  insts: InstructionTypeFirstPass<T>[],
  labels: Map<string, number>
): T[] {
  return insts.map((inst) => {
    if (typeof inst.immediate === "string") {
      const targetIndex = labels.get(inst.immediate);
      if (targetIndex === undefined) {
        throw new Error(
          `Label ${inst.immediate} not found at instruction ${inst.raw}`
        );
      }
      return { ...inst, immediate: targetIndex - inst.originalIndex! } as T;
    } else {
      return inst as T; // to please the type checker
    }
  });
}

function parseSingleInstFirstPass<T extends InstructionType>(
  raw: string,
  parse: (
    instType: T["instType"],
    remaining: string,
    raw: string
  ) => InstructionTypeFirstPassWithoutIndex<T>
): {
  inst: InstructionTypeFirstPassWithoutIndex<T> | undefined;
  foundLabel: string | undefined;
} {
  // strip comments
  const rawParts = raw.split("#");

  let rawWithoutComments = rawParts[0].trim();
  if (rawWithoutComments.length === 0) {
    return { inst: undefined, foundLabel: undefined };
  }

  let label = undefined;
  if (rawWithoutComments.includes(":")) {
    const labelParts = rawWithoutComments.split(":");
    label = labelParts[0].trim();
    rawWithoutComments = labelParts[1].trim();
  }
  if (rawWithoutComments.length === 0) {
    return { inst: undefined, foundLabel: label };
  }
  const parts = rawWithoutComments.split(" ");
  const op = parts[0];
  const remaining = parts.slice(1).join(" ");

  let parsed;
  try {
    parsed = parse(op, remaining, raw);
  } catch (e) {
    if (!(e instanceof Error)) {
      throw new Error(
        `Error parsing instruction "${rawWithoutComments}": ${String(e)}`
      );
    }
    throw new Error(
      `Error parsing instruction "${rawWithoutComments}": ${e.message}`
    );
  }
  return { inst: parsed, foundLabel: label };
}

function parseRType(remaining: string): [number, number, number] {
  const args = remaining.split(",").map((arg) => arg.trim());
  if (args.length !== 3) {
    throw new Error(`Invalid number of arguments`);
  }
  const rs1 = getRegisterIndex(args[1]);
  const rs2 = getRegisterIndex(args[2]);
  const rd = getRegisterIndex(args[0]);
  return [rs1, rs2, rd];
}

function parseIType(remaining: string): [number, number, string | number] {
  const args = remaining.split(",").map((arg) => arg.trim());
  if (args.length !== 3) {
    throw new Error(`Invalid number of arguments`);
  }
  const resultRegisterIndex = getRegisterIndex(args[0]);
  const registerIndex = getRegisterIndex(args[1]);
  let immediate: string | number = parseInt(args[2]);
  if (isNaN(immediate)) {
    immediate = args[2];
  }
  return [registerIndex, resultRegisterIndex, immediate];
}

function parseBzType(remaining: string): [number, string | number] {
  const args = remaining.split(",").map((arg) => arg.trim());
  if (args.length !== 2) {
    throw new Error(`Invalid number of arguments`);
  }
  const registerIndex = getRegisterIndex(args[0]);
  let immediate: string | number = parseInt(args[1]);
  if (isNaN(immediate)) {
    immediate = args[1];
  }
  return [registerIndex, immediate]; // to align with the I type, the reg2 reader is in front of the reg1 reader
}

function parseMemType(remaining: string): [number, number, number] {
  const args = remaining.split(",").map((arg) => arg.trim());
  if (args.length !== 2) {
    throw new Error(`Invalid number of arguments`);
  }

  const rd = getRegisterIndex(args[0]);

  // args[1] should look like 4($0)
  const addressParts = args[1].split("(");
  if (addressParts.length !== 2) {
    throw new Error(`Invalid address format: ${args[1]}`);
  }
  const imm = parseInt(addressParts[0]);
  if (isNaN(imm)) {
    throw new Error(`Invalid address format: ${args[1]}`);
  }
  const reg = addressParts[1].substring(0, addressParts[1].length - 1);
  const rs1 = getRegisterIndex(reg);

  return [rs1, rd, imm];
}

export {
  parseRType,
  parseIType,
  parseBzType,
  parseMemType,
  parseFirstPass,
  parseSecondPass,
};
