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
  readonly forwarding: boolean;

  constructor(iMem: InstructionMemory, forwading: boolean = false) {
    this.pc = 0;
    this.registerFile = new RegisterFile();
    this.iMem = iMem;
    this.mem = new Memory();
    this.pipelineRegs = getDefaultPipelineRegs();
    this.forwarding = forwading;
  }

  tick(nTimes: number = 1) {
    for (let i = 0; i < nTimes; i++) {
      this._tick();
    }
  }

  _tick() {
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
      // flush the pipeline (making the just-run instructions in IF and ID into NOP)
      newPipelineRegs.id2ex = getDefaultPipelineRegs().id2ex;
      newPipelineRegs.if2id = getDefaultPipelineRegs().if2id;
      this.pc = newPipelineRegs.ex2mem.alu_out;
    } else {
      let hazard;
      if (this.forwarding) {
        hazard = tryForward(newPipelineRegs);
      } else {
        hazard = calculateHazards(newPipelineRegs);
      }
      if (hazard) {
        console.debug(`hazard detected: ${hazard}`);
        // insert a bubble
        newPipelineRegs.id2ex = getDefaultPipelineRegs().id2ex;
        // keeps the IF to ID stage registers and PC unchanged
        newPipelineRegs.if2id = this.pipelineRegs.if2id;
      } else {
        this.pc++;
      }
    }
    this.pipelineRegs = newPipelineRegs;
  }

  reset() {
    this.pc = 0;
    this.registerFile.reset();
    // this.iMem.reset();
    this.mem.reset();
    this.pipelineRegs = getDefaultPipelineRegs();
  }

  resetAll() {
    this.reset();
    this.iMem.reset();
  }

  setIMem(iMem: InstructionMemory) {
    this.reset();
    this.iMem = iMem;
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
): { needsStall: boolean; forwardedValue?: number } {
  // Check EX/MEM stage for collision
  if (regIndexCollision(sourceRegIndex, pipelineRegs.ex2mem.inst.rd)) {
    // Load-use hazard: LW instruction in EX/MEM, data not ready yet.
    if (pipelineRegs.ex2mem.inst instanceof LoadSaveInstruction) {
      return { needsStall: true };
    }
    // Forward ALU result from EX/MEM stage
    return { needsStall: false, forwardedValue: pipelineRegs.ex2mem.alu_out };
  }

  // Check MEM/WB stage for collision
  if (regIndexCollision(sourceRegIndex, pipelineRegs.mem2wb.inst.rd)) {
    // Forward data loaded from memory in MEM/WB stage
    if (pipelineRegs.mem2wb.inst instanceof LoadSaveInstruction) {
      return { needsStall: false, forwardedValue: pipelineRegs.mem2wb.mem };
    }
    // Forward ALU result from MEM/WB stage
    if (pipelineRegs.mem2wb.inst instanceof ArithmeticInstruction) {
      return { needsStall: false, forwardedValue: pipelineRegs.mem2wb.alu };
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
function tryForward(pipelineRegs: PipelineRegs): boolean {
  const resultRs1 = checkForwardingForRegister(
    pipelineRegs.id2ex.inst.rs1,
    pipelineRegs
  );
  const resultRs2 = checkForwardingForRegister(
    pipelineRegs.id2ex.inst.rs2,
    pipelineRegs
  );

  // Apply forwarding if a value was returned
  if (resultRs1.forwardedValue !== undefined) {
    pipelineRegs.id2ex.reg1 = resultRs1.forwardedValue;
    console.debug(
      `Forwarding value ${resultRs1.forwardedValue} to reg1 for ${pipelineRegs.id2ex.inst.raw}`
    );
  }
  if (resultRs2.forwardedValue !== undefined) {
    pipelineRegs.id2ex.reg2 = resultRs2.forwardedValue;
    console.debug(
      `Forwarding value ${resultRs2.forwardedValue} to reg2 for ${pipelineRegs.id2ex.inst.raw}`
    );
  }

  // Stall if either register check indicated a load-use hazard
  return resultRs1.needsStall || resultRs2.needsStall;
}
