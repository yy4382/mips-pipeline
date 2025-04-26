import {
  ArithmeticInstruction,
  BranchInstruction,
  Instruction,
  InstructionMemory,
  LoadSaveInstruction,
} from "./instruction";
import { Memory } from "./memory";
import { RegisterFile } from "./register-file";

type PipelineRegs = {
  wb: {
    inst: Instruction;
    mem: number;
    alu: number;
  };
  mem: {
    inst: Instruction;
    alu_out: number;
    write_data: number;
  };
  alu: {
    inst: Instruction;
    reg1: number;
    reg2: number;
    pc: number;
    immediate: number;
  };
  instDecode: {
    inst: Instruction;
    pc: number;
  };
};

export class Pipeline {
  /**
   * pc is similar to PC in CPU, but it steps 1 by 1, instead of 4 by 4.
   * it represents the next instruction's address (index in the instruction array)
   */
  private pc: number;
  public registerFile: RegisterFile;
  private iMem: InstructionMemory;
  public mem: Memory;
  private pipelineRegs: PipelineRegs;

  constructor(iMem: InstructionMemory) {
    this.pc = 0;
    this.registerFile = new RegisterFile();
    this.iMem = iMem;
    this.mem = new Memory();
    this.pipelineRegs = {
      wb: { inst: Instruction.default(), mem: 0, alu: 0 },
      mem: { inst: Instruction.default(), alu_out: 0, write_data: 0 },
      alu: {
        inst: Instruction.default(),
        reg1: 0,
        reg2: 0,
        pc: 0,
        immediate: 0,
      },
      instDecode: { inst: Instruction.default(), pc: 0 },
    };
  }

  tick() {
    this.writeBackStage(this.pipelineRegs.wb);
    this.pipelineRegs.wb = this.memStage(this.pipelineRegs.mem);
    this.pipelineRegs.mem = this.aluStage(this.pipelineRegs.alu);
    this.pipelineRegs.alu = this.instDecodeStage(this.pipelineRegs.instDecode);
    this.pipelineRegs.instDecode = this.instFetchStage(this.pc);
    this.pc++;
  }

  writeBackStage({ inst, mem: mem_input, alu: alu_input }: PipelineRegs["wb"]) {
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
  }: PipelineRegs["mem"]): PipelineRegs["wb"] {
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
  aluStage({
    inst,
    reg1,
    reg2,
    pc,
    immediate,
  }: PipelineRegs["alu"]): PipelineRegs["mem"] {
    console.debug(
      `aluStage: ${inst.raw} reg1: ${reg1} reg2: ${reg2} pc: ${pc} immediate: ${immediate}`
    );
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
  instDecodeStage({
    inst,
    pc,
  }: PipelineRegs["instDecode"]): PipelineRegs["alu"] {
    console.debug(`instDecodeStage: ${inst.raw} pc: ${pc}`);
    if (inst instanceof ArithmeticInstruction) {
      return {
        pc,
        reg1: this.registerFile.getAt(inst.registerIndex1),
        reg2: this.registerFile.getAt(inst.registerIndex2),
        immediate: 0,
        inst,
      };
    }
    if (inst instanceof LoadSaveInstruction) {
      return {
        inst,
        pc,
        reg1: this.registerFile.getAt(inst.startingRegisterIndex),
        reg2: this.registerFile.getAt(inst.registerIndex),
        immediate: inst.addressOffset,
      };
    }
    if (inst instanceof BranchInstruction) {
      return {
        pc,
        inst,
        reg1: this.registerFile.getAt(inst.registerIndex),
        reg2: 0,
        immediate: inst.offset,
      };
    }
    throw new Error("Unknown instruction type");
  }
  instFetchStage(instIndex: number): PipelineRegs["instDecode"] {
    console.debug(`instFetchStage: ${instIndex}, inst: ${this.iMem.getInstructionAt(instIndex).raw}`);
    return { inst: this.iMem.getInstructionAt(instIndex), pc: instIndex };
  }
}

// function calculateHazards(pipelineRegs: PipelineRegs): number {
//   if (pipelineRegs.instDecode.inst instanceof BranchInstruction) {
//     return 2;
//   }
  
// }