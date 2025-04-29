import { Instruction } from "./instruction";
import { InstructionMemory } from "./hardware/instruction-memory";
import { Memory } from "./hardware/memory";
import { RegisterFile } from "./hardware/register-file";
import {
  getDefaultPipelineRegs,
  PipelineRegs,
} from "./hardware/pipeline-registers";

export type HazardCallback = (
  type: "branch" | "data",
  cause: { inst: Instruction; desc: string; clockCycle: number }
) => void;

export type ForwardDetail = {
  target: { inst: Instruction; regIndex: number };
  source: { inst: Instruction; regIndex: number };
  data: number;
  // note: in my code forwarding is happened when the inst to be forwarded just
  // finished the ID stage and the EX stage haven't started yet (clock cycle haven't
  // changed)
  // But usually we consider the forwarding happens in EX, before getting into the ALU
  // So i will set this to this.statistics.clockCycles + 1
  clockCycle: number;
};

export type Statistics = {
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
  statistics: Statistics;

  constructor(iMem: InstructionMemory, forwarding: boolean = false) {
    this.pc = 0;
    this.registerFile = new RegisterFile();
    this.iMem = iMem;
    this.mem = new Memory();
    this.pipelineRegs = getDefaultPipelineRegs();
    this.forwarding = forwarding;
    this.statistics = {
      clockCycles: 0,
      finishedInsts: 0,
      dataHazardStalls: 0,
      predictFails: 0,
      forwardCount: 0,
    };
  }

  /**
   * Run the pipeline for a given number of cycles. See doc for `stopAt` param  for more detail
   *
   * @param stopAt undefined means run 1 tick, -1 means runs to end, other means runs to IF of that inst
   * @param hazardCallback
   * @param forwardCb
   */
  tick(
    stopAt: number | undefined = undefined,
    hazardCallback: HazardCallback = () => {},
    forwardCb: (arg: ForwardDetail) => void = () => {},
    tickCallback: (arg: Pipeline) => void = () => {}
  ) {
    const MAX_RUN_LOOP = 5000;
    if (stopAt === undefined) {
      this._tick(hazardCallback, forwardCb);
      tickCallback(this);
      return;
    }
    if (stopAt === -1) {
      let loopCount = 0;
      while (!this.isFinished()) {
        loopCount += 1;
        if (loopCount > MAX_RUN_LOOP) {
          throw new Error("Infinite loop when in pipeline run");
        }
        this._tick(hazardCallback, forwardCb);
        tickCallback(this);
      }
      return;
    }
    let loopCount = 0;
    while (
      this.iMem.getInstructionAt(this.pc).originalIndex !== stopAt &&
      !this.isFinished()
    ) {
      loopCount += 1;
      if (loopCount > MAX_RUN_LOOP) {
        throw new Error("Infinite loop when in pipeline run");
      }
      this._tick(hazardCallback, forwardCb);
      tickCallback(this);
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
    let newPc = this.pc + 1;

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
        clockCycle: this.statistics.clockCycles,
      });
      this.statistics.predictFails += 1;

      // flush the pipeline (making the just-run instructions in IF and ID into NOP)
      newPipelineRegs.id2ex = getDefaultPipelineRegs().id2ex;
      newPipelineRegs.if2id = getDefaultPipelineRegs().if2id;
      newPc = newPipelineRegs.ex2mem.alu_out;
    } else {
      let hazard;
      if (this.forwarding) {
        const addForwardCount = () => {
          this.statistics.forwardCount += 1;
        };
        const forwardCbWithoutClockCycle = (
          arg: Omit<ForwardDetail, "clockCycle">
        ) => {
          forwardCb({ ...arg, clockCycle: this.statistics.clockCycles + 1 });
        };
        hazard = tryForward(
          newPipelineRegs,
          forwardCbWithoutClockCycle,
          addForwardCount
        );
      } else {
        hazard = calculateHazards(newPipelineRegs);
      }
      if (hazard) {
        console.debug(`hazard detected: ${hazard}`);
        hazardCallback("data", {
          inst: newPipelineRegs.id2ex.inst,
          desc: "data hazard detected, inserted a bubble to ID/EX registers and prevented first two stages to move on",
          clockCycle: this.statistics.clockCycles,
        });
        this.statistics.dataHazardStalls += 1;

        // insert a bubble
        newPipelineRegs.id2ex = getDefaultPipelineRegs().id2ex;
        // keeps the IF to ID stage registers and PC unchanged
        newPipelineRegs.if2id = this.pipelineRegs.if2id;
        newPc = this.pc;
      }
    }

    // update statistics
    this.statistics.clockCycles += 1;
    if (this.pipelineRegs.mem2wb.inst.originalIndex !== undefined) {
      this.statistics.finishedInsts += 1;
    }

    this.pipelineRegs = newPipelineRegs;
    this.pc = newPc;
  }

  reset(resetCallback: (pipeline: Pipeline) => void) {
    this.pc = 0;
    this.registerFile.reset();
    // this.iMem.reset();
    this.mem.reset();
    this.pipelineRegs = getDefaultPipelineRegs();
    this.statistics = {
      clockCycles: 0,
      finishedInsts: 0,
      dataHazardStalls: 0,
      predictFails: 0,
      forwardCount: 0,
    };
    resetCallback(this);
  }

  setIMem(
    iMem: InstructionMemory,
    resetCallback: (pipeline: Pipeline) => void
  ) {
    this.iMem = iMem;
    this.reset(resetCallback);
  }

  setForwarding(
    forwarding: boolean,
    resetCallback: (pipeline: Pipeline) => void
  ) {
    this.forwarding = forwarding;
    this.reset(resetCallback);
  }

  writeBackStage({
    inst,
    mem: mem_input,
    alu: alu_input,
  }: PipelineRegs["mem2wb"]) {
    console.debug(
      `writeBackStage: ${inst.raw} mem_input: ${mem_input} alu_input: ${alu_input}`
    );
    if (inst.controlSignals.regWriteEnable) {
      if (inst.controlSignals.wbSel === "alu") {
        this.registerFile.setAt(inst.writingRegister!, alu_input);
      } else if (inst.controlSignals.wbSel === "mem") {
        this.registerFile.setAt(inst.writingRegister!, mem_input);
      }
    }
  }

  memStage({
    inst,
    alu_out: alu,
    write_data,
  }: PipelineRegs["ex2mem"]): PipelineRegs["mem2wb"] {
    console.debug(
      `memStage: ${inst.raw} mem_addr: ${alu} write_data: ${write_data}`
    );
    const readMem =
      inst.controlSignals.wbSel === "mem" ? this.mem.getAt(alu) : 0;
    if (inst.controlSignals.memWriteEnable) {
      this.mem.setAt(alu, write_data);
    }
    return { inst, mem: readMem, alu };
  }
  aluStage({ inst, reg1, reg2, pc, immediate }: PipelineRegs["id2ex"]): {
    out: PipelineRegs["ex2mem"];
    shouldBranch: boolean;
  } {
    console.debug(
      `aluStage: ${inst.raw} reg1: ${reg1} reg2: ${reg2} pc: ${pc} immediate: ${immediate}`
    );
    function calculateOut() {
      const getReturn = (alu_out: number) => ({
        inst,
        alu_out,
        write_data: reg2,
      });

      const num1 = inst.controlSignals.aSel === "reg1" ? reg1 : pc;
      const num2 = inst.controlSignals.bSel === "reg2" ? reg2 : immediate;

      let result;

      if (inst.controlSignals.aluOp === "add") {
        result = num1 + num2;
      } else {
        throw new Error("Unknown ALU operation");
      }
      return getReturn(result);
    }

    return {
      out: calculateOut(),
      shouldBranch: inst.controlSignals.branchController(reg1, reg2),
    };
  }
  instDecodeStage({ inst, pc }: PipelineRegs["if2id"]): PipelineRegs["id2ex"] {
    console.debug(`instDecodeStage: ${inst.raw} pc: ${pc}`);
    const getReturn = (reg1: number, reg2: number, immediate: number) => ({
      inst,
      pc,
      reg1,
      reg2,
      immediate,
    });

    const reg1 = this.registerFile.getAt(inst.readingRegisters[0] ?? 0);
    const reg2 = this.registerFile.getAt(inst.readingRegisters[1] ?? 0);
    const immediate = inst.immediate ?? 0;
    return getReturn(reg1, reg2, immediate);
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
  const readingRegs = pipelineRegs.id2ex.inst.readingRegisters;
  const memWriteReg = pipelineRegs.ex2mem.inst.writingRegister;
  const wbWriteReg = pipelineRegs.mem2wb.inst.writingRegister;

  for (const regIndex of readingRegs) {
    if (
      regIndexCollision(regIndex, memWriteReg) ||
      regIndexCollision(regIndex, wbWriteReg)
    ) {
      return true; // Data hazard detected
    }
  }
  return false; // No data hazard detected
}

/**
 * Checks for data hazards for a specific source register and determines
 * if forwarding is possible or if a stall is needed.
 * @param targetRegIndex The index of the source register (rs1 or rs2) in the ID stage.
 * @param pipelineRegs The current pipeline registers.
 * @returns An object indicating if a stall is needed and the value to forward, if any.
 */
function checkForwardingForRegister(
  targetRegIndex: number | undefined,
  pipelineRegs: PipelineRegs
): {
  needsStall: boolean;
  forwardDetail?: Omit<ForwardDetail, "target" | "clockCycle">;
} {
  // Check EX/MEM stage for collision
  if (
    regIndexCollision(targetRegIndex, pipelineRegs.ex2mem.inst.writingRegister)
  ) {
    // Load-use hazard: LW instruction in EX/MEM, data not ready yet.
    if (pipelineRegs.ex2mem.inst.controlSignals.wbSel === "mem") {
      return { needsStall: true };
    }
    // Forward ALU result from EX/MEM stage
    return {
      needsStall: false,
      forwardDetail: {
        source: {
          inst: pipelineRegs.ex2mem.inst,
          regIndex: pipelineRegs.ex2mem.inst.writingRegister!,
        },
        data: pipelineRegs.ex2mem.alu_out,
      },
    };
  }

  // Check MEM/WB stage for collision
  if (
    regIndexCollision(targetRegIndex, pipelineRegs.mem2wb.inst.writingRegister)
  ) {
    // Forward data in MEM/WB stage
    return {
      needsStall: false,
      forwardDetail: {
        source: {
          inst: pipelineRegs.mem2wb.inst,
          regIndex: pipelineRegs.mem2wb.inst.writingRegister!,
        },
        data:
          pipelineRegs.mem2wb.inst.controlSignals.wbSel === "mem"
            ? pipelineRegs.mem2wb.mem
            : pipelineRegs.mem2wb.alu,
      },
    };
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
  forwardCb: (arg: Omit<ForwardDetail, "clockCycle">) => void,
  addForwardCount: () => void
): boolean {
  const results = pipelineRegs.id2ex.inst.readingRegisters.map((regIndex) => {
    return [
      checkForwardingForRegister(regIndex, pipelineRegs),
      regIndex,
    ] as const;
  });

  if (results.some((result) => result[0].needsStall)) {
    return true; // Stall needed
  }

  results.forEach((result, i) => {
    if (result[0].forwardDetail !== undefined && result[1] !== undefined) {
      if (i === 0) {
        pipelineRegs.id2ex.reg1 = result[0].forwardDetail.data;
      } else {
        pipelineRegs.id2ex.reg2 = result[0].forwardDetail.data;
      }
      const detail: Omit<ForwardDetail, "clockCycle"> = {
        ...result[0].forwardDetail,
        target: {
          inst: pipelineRegs.id2ex.inst,
          regIndex: result[1],
        },
      };
      forwardCb(detail);
      addForwardCount();
      console.debug(detail);
    }
  });

  return false; // No stall needed
}
