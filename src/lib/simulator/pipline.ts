import {
  ArithmeticInstruction,
  BranchInstruction,
  Instruction,
  InstructionMemory,
  LoadSaveInstruction,
} from "./instruction";
import { Memory } from "./memory";
import { RegisterFile } from "./register-file";

export type PipelineRegs = {
  mem2wb: {
    inst: Instruction;
    mem: number;
    alu: number;
  };
  ex2mem: {
    inst: Instruction;
    alu_out: number;
    write_data: number;
  };
  id2ex: {
    inst: Instruction;
    reg1: number;
    reg2: number;
    pc: number;
    immediate: number;
  };
  if2id: {
    inst: Instruction;
    pc: number;
  };
};

function getDefaultPipelineRegs(): PipelineRegs {
  return {
    mem2wb: { inst: Instruction.default(), mem: 0, alu: 0 },
    ex2mem: { inst: Instruction.default(), alu_out: 0, write_data: 0 },
    id2ex: {
      inst: Instruction.default(),
      reg1: 0,
      reg2: 0,
      pc: 0,
      immediate: 0,
    },
    if2id: { inst: Instruction.default(), pc: 0 },
  };
}

export class Pipeline {
  /**
   * pc is similar to PC in CPU, but it steps 1 by 1, instead of 4 by 4.
   * it represents the next instruction's address (index in the instruction array)
   */
  public pc: number;
  public registerFile: RegisterFile;
  public iMem: InstructionMemory;
  public mem: Memory;
  public pipelineRegs: PipelineRegs;
  public readonly forwarding: boolean;

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

function tryForward(pipelineRegs: PipelineRegs): boolean {
  function forRs1() {
    if (
      regIndexCollision(
        pipelineRegs.id2ex.inst.rs1,
        pipelineRegs.ex2mem.inst.rd
      )
    ) {
      if (pipelineRegs.ex2mem.inst instanceof LoadSaveInstruction) {
        return true;
      }
      pipelineRegs.id2ex.reg1 = pipelineRegs.ex2mem.alu_out;
      return false;
    }
    if (
      regIndexCollision(
        pipelineRegs.id2ex.inst.rs1,
        pipelineRegs.mem2wb.inst.rd
      )
    ) {
      if (pipelineRegs.mem2wb.inst instanceof LoadSaveInstruction) {
        pipelineRegs.id2ex.reg1 = pipelineRegs.mem2wb.mem;
        return false;
      }
      if (pipelineRegs.mem2wb.inst instanceof ArithmeticInstruction) {
        pipelineRegs.id2ex.reg1 = pipelineRegs.mem2wb.alu;
        return false;
      }
      throw new Error("Unknown instruction type");
    }
    return false;
  }
  function forRs2(): boolean {
    if (
      regIndexCollision(
        pipelineRegs.id2ex.inst.rs2,
        pipelineRegs.ex2mem.inst.rd
      )
    ) {
      if (pipelineRegs.ex2mem.inst instanceof LoadSaveInstruction) {
        return true;
      }
      pipelineRegs.id2ex.reg2 = pipelineRegs.ex2mem.alu_out;
      return false;
    }
    if (
      regIndexCollision(
        pipelineRegs.id2ex.inst.rs2,
        pipelineRegs.mem2wb.inst.rd
      )
    ) {
      if (pipelineRegs.mem2wb.inst instanceof LoadSaveInstruction) {
        pipelineRegs.id2ex.reg2 = pipelineRegs.mem2wb.mem;
        return false;
      }
      if (pipelineRegs.mem2wb.inst instanceof ArithmeticInstruction) {
        pipelineRegs.id2ex.reg2 = pipelineRegs.mem2wb.alu;
        return false;
      }
      throw new Error("Unknown instruction type");
    }
    return false;
  }
  return forRs1() || forRs2();
}
