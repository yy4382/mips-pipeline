import {
  ArithmeticInstruction,
  BranchInstruction,
  Instruction,
  InstructionMemory,
  LoadSaveInstruction,
} from "./instruction";
import { Memory } from "./hardware/memory";
import { RegisterFile } from "./hardware/register-file";
import {
  getDefaultPipelineRegs,
  PipelineRegs,
} from "./hardware/pipeline-registers";

export type HazardCallback = (
  type: "branch" | "data",
  cause: { inst: Instruction; desc: string }
) => void;

export type ForwardDetail = {
  target: { inst: Instruction; regIndex: number };
  source: { inst: Instruction; regIndex: number };
  data: number;
};

export type Statics = {
  clockCycles: number;
  finishedInsts: number;
  dataHazardStalls: number;
  predictFails: number;
  forwardCount: number;
};

export class Pipeline {
  /**
   * pc is similar to PC in CPU, but it steps 1 by 1, instead of 4 by 4.
   * it represents the next instruction's address (index in the instruction array)
   */
  pc: number;
  registerFile: RegisterFile;
  iMem: InstructionMemory;
  mem: Memory;
  pipelineRegs: PipelineRegs;
  forwarding: boolean;
  statics: Statics;

  constructor(iMem: InstructionMemory, forwarding: boolean = false) {
    this.pc = 0;
    this.registerFile = new RegisterFile();
    this.iMem = iMem;
    this.mem = new Memory();
    this.pipelineRegs = getDefaultPipelineRegs();
    this.forwarding = forwarding;
    this.statics = {
      clockCycles: 0,
      finishedInsts: 0,
      dataHazardStalls: 0,
      predictFails: 0,
      forwardCount: 0,
    };
  }

  /**
   *
   * @param stopAt undefined means run 1 tick, -1 means runs to end, other means runs to IF of that inst
   * @param hazardCallback
   * @param forwardCb
   */
  tick(
    stopAt: number | undefined = undefined,
    hazardCallback: HazardCallback = () => {},
    forwardCb: (arg: ForwardDetail) => void = () => {}
  ) {
    if (stopAt === undefined) {
      this._tick(hazardCallback, forwardCb);
      return;
    }
    if (stopAt === -1) {
      while (!this.isFinished()) {
        this._tick(hazardCallback, forwardCb);
      }
      return;
    }
    while (
      this.iMem.getInstructionAt(this.pc).originalIndex !== stopAt &&
      !this.isFinished()
    ) {
      this._tick(hazardCallback, forwardCb);
    }
  }

  isFinished(): boolean {
    return (
      this.pipelineRegs.if2id.inst.originalIndex === undefined &&
      this.pipelineRegs.id2ex.inst.originalIndex === undefined &&
      this.pipelineRegs.ex2mem.inst.originalIndex === undefined &&
      this.pipelineRegs.mem2wb.inst.originalIndex === undefined &&
      this.iMem.getInstructionAt(this.pc).originalIndex === undefined
    );
  }

  _tick(
    hazardCallback: HazardCallback = () => {},
    forwardCb: (arg: ForwardDetail) => void = () => {}
  ) {
    const newPipelineRegs = getDefaultPipelineRegs();

    this.writeBackStage(this.pipelineRegs.mem2wb);
    newPipelineRegs.mem2wb = this.memStage(this.pipelineRegs.ex2mem);
    const { out, shouldBranch } = this.aluStage(this.pipelineRegs.id2ex);
    newPipelineRegs.ex2mem = out;
    newPipelineRegs.id2ex = this.instDecodeStage(this.pipelineRegs.if2id);
    newPipelineRegs.if2id = this.instFetchStage(this.pc);

    if (shouldBranch) {
      console.debug(
        `branch taken: ${newPipelineRegs.ex2mem.inst.raw} pc: ${this.pipelineRegs.id2ex.pc}(now at ${this.pc}) -> ${newPipelineRegs.ex2mem.alu_out}`
      );
      hazardCallback("branch", {
        inst: newPipelineRegs.ex2mem.inst,
        desc: "branch prediction failed, flushed the first two stages`",
      });
      this.statics.predictFails += 1;

      // flush the pipeline (making the just-run instructions in IF and ID into NOP)
      newPipelineRegs.id2ex = getDefaultPipelineRegs().id2ex;
      newPipelineRegs.if2id = getDefaultPipelineRegs().if2id;
      this.pc = newPipelineRegs.ex2mem.alu_out;
    } else {
      let hazard;
      if (this.forwarding) {
        const addForwardCount = () => {
          this.statics.forwardCount += 1;
        };
        hazard = tryForward(newPipelineRegs, forwardCb, addForwardCount);
      } else {
        hazard = calculateHazards(newPipelineRegs);
      }
      if (hazard) {
        console.debug(`hazard detected: ${hazard}`);
        hazardCallback("data", {
          inst: newPipelineRegs.id2ex.inst,
          desc: "data hazard detected, inserted a bubble to ID/EX registers and prevented first two stages to move on",
        });
        this.statics.dataHazardStalls += 1;

        // insert a bubble
        newPipelineRegs.id2ex = getDefaultPipelineRegs().id2ex;
        // keeps the IF to ID stage registers and PC unchanged
        newPipelineRegs.if2id = this.pipelineRegs.if2id;
      } else {
        this.pc++;
      }
    }

    // update statics
    this.statics.clockCycles += 1;
    if (this.pipelineRegs.mem2wb.inst.originalIndex !== undefined) {
      this.statics.finishedInsts += 1;
    }

    this.pipelineRegs = newPipelineRegs;
  }

  reset() {
    this.pc = 0;
    this.registerFile.reset();
    // this.iMem.reset();
    this.mem.reset();
    this.pipelineRegs = getDefaultPipelineRegs();
    this.statics = {
      clockCycles: 0,
      finishedInsts: 0,
      dataHazardStalls: 0,
      predictFails: 0,
      forwardCount: 0,
    };
  }

  resetAll() {
    this.reset();
    this.iMem.reset();
  }

  setIMem(iMem: InstructionMemory) {
    this.reset();
    this.iMem = iMem;
  }

  setForwarding(forwarding: boolean) {
    this.forwarding = forwarding;
    this.reset();
  }

  writeBackStage({
    inst,
    mem: mem_input,
    alu: alu_input,
  }: PipelineRegs["mem2wb"]) {
    console.debug(
      `writeBackStage: ${inst.raw} mem_input: ${mem_input} alu_input: ${alu_input}`
    );
    if (inst instanceof LoadSaveInstruction) {
      if (inst.type === "load") {
        this.registerFile.setAt(inst.registerIndex, mem_input);
      }
    } else if (inst instanceof ArithmeticInstruction) {
      this.registerFile.setAt(inst.resultRegisterIndex, alu_input);
    }
  }

  memStage({
    inst,
    alu_out: mem_addr,
    write_data,
  }: PipelineRegs["ex2mem"]): PipelineRegs["mem2wb"] {
    console.debug(
      `memStage: ${inst.raw} mem_addr: ${mem_addr} write_data: ${write_data}`
    );
    if (inst instanceof LoadSaveInstruction) {
      if (inst.type === "load") {
        return { inst, mem: this.mem.getAt(mem_addr), alu: mem_addr };
      } else if (inst.type === "store") {
        this.mem.setAt(mem_addr, write_data);
      }
    }
    return { inst, mem: NaN, alu: mem_addr };
  }
  aluStage({ inst, reg1, reg2, pc, immediate }: PipelineRegs["id2ex"]): {
    out: PipelineRegs["ex2mem"];
    shouldBranch: boolean;
  } {
    console.debug(
      `aluStage: ${inst.raw} reg1: ${reg1} reg2: ${reg2} pc: ${pc} immediate: ${immediate}`
    );
    function calcuateOut() {
      if (inst instanceof ArithmeticInstruction) {
        return { inst, alu_out: reg1 + reg2, write_data: reg2 };
      }
      if (inst instanceof LoadSaveInstruction) {
        return { inst, alu_out: reg1 + immediate, write_data: reg2 };
      }
      if (inst instanceof BranchInstruction) {
        return { inst, write_data: reg2, alu_out: pc + immediate };
      }
      throw new Error("Unknown instruction type");
    }
    function calculateShouldBranch(): boolean {
      if (inst instanceof BranchInstruction) {
        if (inst.type === "beqz") {
          return reg1 === 0;
        }
        throw new Error("Unknown branch type");
      }
      return false;
    }
    return { out: calcuateOut(), shouldBranch: calculateShouldBranch() };
  }
  instDecodeStage({ inst, pc }: PipelineRegs["if2id"]): PipelineRegs["id2ex"] {
    console.debug(`instDecodeStage: ${inst.raw} pc: ${pc}`);
    return {
      inst,
      pc,
      reg1: this.registerFile.getAt(inst.rs1 ?? 0),
      reg2: this.registerFile.getAt(inst.rs2 ?? 0),
      immediate: inst.immediate ?? 0,
    };
  }
  instFetchStage(instIndex: number): PipelineRegs["if2id"] {
    console.debug(
      `instFetchStage: ${instIndex}, inst: ${
        this.iMem.getInstructionAt(instIndex).raw
      }`
    );
    return { inst: this.iMem.getInstructionAt(instIndex), pc: instIndex };
  }
}

function regIndexCollision(
  r1: number | undefined,
  r2: number | undefined
): boolean {
  if (r1 === undefined || r2 === undefined) {
    return false;
  }
  if (r1 !== r2) {
    return false;
  }
  if (r1 === 0 && r2 === 0) {
    return false;
  }
  return true;
}

function calculateHazards(pipelineRegs: PipelineRegs): boolean {
  const rs1 = pipelineRegs.id2ex.inst.rs1;
  const rs2 = pipelineRegs.id2ex.inst.rs2;
  const memWriteReg = pipelineRegs.ex2mem.inst.rd;
  const wbWriteReg = pipelineRegs.mem2wb.inst.rd;

  if (
    regIndexCollision(rs1, wbWriteReg) ||
    regIndexCollision(rs2, wbWriteReg) ||
    regIndexCollision(rs1, memWriteReg) ||
    regIndexCollision(rs2, memWriteReg)
  ) {
    return true;
  } else {
    return false;
  }
}

/**
 * Checks for data hazards for a specific source register and determines
 * if forwarding is possible or if a stall is needed.
 * @param sourceRegIndex The index of the source register (rs1 or rs2) in the ID stage.
 * @param pipelineRegs The current pipeline registers.
 * @returns An object indicating if a stall is needed and the value to forward, if any.
 */
function checkForwardingForRegister(
  sourceRegIndex: number | undefined,
  pipelineRegs: PipelineRegs
): { needsStall: boolean; forwardDetail?: Omit<ForwardDetail, "target"> } {
  // Check EX/MEM stage for collision
  if (regIndexCollision(sourceRegIndex, pipelineRegs.ex2mem.inst.rd)) {
    // Load-use hazard: LW instruction in EX/MEM, data not ready yet.
    if (pipelineRegs.ex2mem.inst instanceof LoadSaveInstruction) {
      return { needsStall: true };
    }
    // Forward ALU result from EX/MEM stage
    return {
      needsStall: false,
      forwardDetail: {
        source: {
          inst: pipelineRegs.ex2mem.inst,
          regIndex: pipelineRegs.ex2mem.inst.rd!,
        },
        data: pipelineRegs.ex2mem.alu_out,
      },
    };
  }

  // Check MEM/WB stage for collision
  if (regIndexCollision(sourceRegIndex, pipelineRegs.mem2wb.inst.rd)) {
    // Forward data loaded from memory in MEM/WB stage
    if (pipelineRegs.mem2wb.inst instanceof LoadSaveInstruction) {
      return {
        needsStall: false,
        forwardDetail: {
          source: {
            inst: pipelineRegs.mem2wb.inst,
            regIndex: pipelineRegs.mem2wb.inst.rd!,
          },
          data: pipelineRegs.mem2wb.mem,
        },
      };
    }
    // Forward ALU result from MEM/WB stage
    if (pipelineRegs.mem2wb.inst instanceof ArithmeticInstruction) {
      return {
        needsStall: false,
        forwardDetail: {
          source: {
            inst: pipelineRegs.mem2wb.inst,
            regIndex: pipelineRegs.mem2wb.inst.rd!,
          },
          data: pipelineRegs.mem2wb.alu,
        },
      };
    }
    // Should ideally not happen with supported instruction types writing to rd
    console.warn(
      "Unhandled instruction type in MEM/WB for forwarding:",
      pipelineRegs.mem2wb.inst.raw
    );
  }

  // No hazard detected for this register
  return { needsStall: false };
}

/**
 * Attempts to forward data from later pipeline stages (EX/MEM, MEM/WB)
 * to the ID/EX stage to resolve data hazards.
 * Modifies pipelineRegs.id2ex.reg1 and pipelineRegs.id2ex.reg2 if forwarding occurs.
 * @param pipelineRegs The pipeline registers (will be modified).
 * @returns True if a stall is required (due to a load-use hazard), false otherwise.
 */
function tryForward(
  pipelineRegs: PipelineRegs,
  forwardCb: (arg: ForwardDetail) => void,
  addForwardCount: () => void
): boolean {
  const resultRs1 = checkForwardingForRegister(
    pipelineRegs.id2ex.inst.rs1,
    pipelineRegs
  );
  const resultRs2 = checkForwardingForRegister(
    pipelineRegs.id2ex.inst.rs2,
    pipelineRegs
  );

  if (resultRs1.needsStall || resultRs2.needsStall) {
    return true; // Stall needed
  }

  // Apply forwarding if a value was returned
  if (resultRs1.forwardDetail !== undefined) {
    pipelineRegs.id2ex.reg1 = resultRs1.forwardDetail.data;
    const detail: ForwardDetail = {
      ...resultRs1.forwardDetail,
      target: {
        inst: pipelineRegs.id2ex.inst,
        regIndex: pipelineRegs.id2ex.inst.rs1!,
      },
    };
    forwardCb(detail);
    addForwardCount();
    console.debug(detail);
  }
  if (resultRs2.forwardDetail !== undefined) {
    pipelineRegs.id2ex.reg2 = resultRs2.forwardDetail.data;
    const detail: ForwardDetail = {
      ...resultRs2.forwardDetail,
      target: {
        inst: pipelineRegs.id2ex.inst,
        regIndex: pipelineRegs.id2ex.inst.rs2!,
      },
    };
    forwardCb(detail);
    addForwardCount();
    console.debug(detail);
  }
  return false; // No stall needed
}
