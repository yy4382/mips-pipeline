import {
  InstructionMemory,
  NoMoreInstruction,
} from "../hardware/instruction-memory";
import { Memory } from "../hardware/memory";
import { RegisterFile } from "../hardware/register-file";
import { InstToma } from "./instruction";

type RegIndex = number;

type ReservationStation = {
  busy: boolean;
  op: InstToma["instType"];
  vj: number;
  vk: number;
  qj: RSIndex | null;
  qk: RSIndex | null;
  dest: RegIndex;
  address: number;

  // Only used for visualization
  _inst: InstToma | null;
};

type RSIndex = {
  type: "ADD" | "MUL" | "MEM";
  index: number;
};

type ActionLoadRS = {
  rsIndex: RSIndex;
  rsData: ReservationStation;
};
type ActionUpdateRS = {
  rsIndex: RSIndex;
  remainingTime: number;
  address?: number;
};
// also set busy to false if received this
type ActionCommitChange = {
  rsIndex: RSIndex;
  data: number;
};

type ActionStore = {
  address: number;
  data: number;
  rsIndex: RSIndex;
};

type ReservationStationWithState = ReservationStation & {
  remainingTime: number | null;
};

function reservationTickArithmetic(
  rs: ReservationStationWithState,
  option: {
    executeTime: number;
    rsIndex: RSIndex;
    cbdAvailable: boolean;
  }
): ActionUpdateRS | ActionCommitChange | undefined {
  if (!rs.busy) {
    return;
  }
  const { executeTime, rsIndex, cbdAvailable } = option;
  if (rs.remainingTime === null) {
    if (rs.qj === null && rs.qk === null) {
      // start execution
      return {
        rsIndex,
        remainingTime: executeTime - 1,
      };
    } else {
      return;
    }
  }
  const nextRemainingTime = rs.remainingTime - 1;
  if (cbdAvailable && nextRemainingTime <= 0) {
    let data;
    if (rs.op === "ADD.D") {
      data = rs.vj + rs.vk;
    } else if (rs.op === "SUB.D") {
      data = rs.vj - rs.vk;
    } else if (rs.op === "MUL.D") {
      data = rs.vj * rs.vk;
    } else if (rs.op === "DIV.D") {
      data = rs.vj / rs.vk;
    } else {
      throw new Error("Invalid operation");
    }

    return {
      rsIndex,
      data,
    };
  } else {
    return {
      rsIndex,
      remainingTime: nextRemainingTime,
    };
  }
}

// SHOULD NOT modify rs, in any way
function reservationTickLoad(
  rs: ReservationStationWithState,
  option: {
    executeTime: number;
    isBufferFirst: boolean;
    cbdAvailable: boolean;
    rsIndex: RSIndex;
    getMem: (addr: number) => number;
  }
): {
  update: ActionUpdateRS | undefined;
  commit: ActionCommitChange | undefined;
} {
  if (!rs.busy) {
    return { update: undefined, commit: undefined };
  }

  const { executeTime, isBufferFirst, cbdAvailable, rsIndex, getMem } = option;

  let isFirstTickExecution = false;
  let potentialEffectiveAddr: number | undefined = undefined;
  let nextRemainingTime: number;

  if (rs.remainingTime === null) {
    // Instruction has not started execution yet
    if (isBufferFirst && rs.qj === null) {
      // Ready to start execution this tick
      isFirstTickExecution = true;
      potentialEffectiveAddr = rs.vj + rs.address; // Calculate potential effective address
      nextRemainingTime = executeTime - 1;
    } else {
      // Not ready to start (e.g., not first in buffer, or waiting for Vj)
      return { update: undefined, commit: undefined };
    }
  } else {
    // Instruction is already executing
    nextRemainingTime = rs.remainingTime - 1;
  }

  // Check if the instruction can commit this tick
  if (cbdAvailable && nextRemainingTime <= 0) {
    const commitAction: ActionCommitChange = {
      rsIndex,
      data: getMem(potentialEffectiveAddr ?? rs.address),
    };

    return { update: undefined, commit: commitAction };
  } else {
    // Instruction does not commit this tick, just update remaining time
    let updateActionContinuing: ActionUpdateRS;
    if (isFirstTickExecution) {
      // If it's the first tick but not committing,
      updateActionContinuing = {
        rsIndex,
        remainingTime: nextRemainingTime,
        address: potentialEffectiveAddr ?? rs.address,
      };
    } else {
      // Already running and continuing execution
      updateActionContinuing = {
        rsIndex,
        remainingTime: nextRemainingTime,
      };
    }
    return { update: updateActionContinuing, commit: undefined };
  }
}

function reservationTickStore(
  rs: ReservationStationWithState,
  option: {
    executeTime: number;
    isBufferFirst: boolean;
    rsIndex: RSIndex;
  }
): ActionUpdateRS | ActionStore | undefined {
  if (!rs.busy) {
    return;
  }
  const { executeTime, isBufferFirst, rsIndex } = option;
  if (rs.remainingTime === null) {
    if (isBufferFirst && rs.qj === null) {
      return {
        rsIndex,
        remainingTime: executeTime - 1,
        address: rs.vj + rs.address,
      };
    } else {
      return;
    }
  }
  if (rs.remainingTime <= 0 && rs.qk === null) {
    return {
      address: rs.address,
      data: rs.vk,
      rsIndex,
    };
  } else {
    return {
      rsIndex,
      remainingTime: rs.remainingTime - 1,
    };
  }
}

type TomasoluCoreHardware = {
  reservationStations: Record<
    "ADD" | "MUL" | "MEM",
    ReservationStationWithState[]
  >;
  qi: (RSIndex | null)[];
};

export class TomasoluProcessor {
  iMem: InstructionMemory<InstToma>;
  dMem: Memory;

  pc: number = 0;

  registerFile: RegisterFile;

  core: TomasoluCoreHardware;
  memQueue: number[] = [];

  constructor(iMem: InstructionMemory<InstToma>) {
    this.iMem = iMem;
    this.dMem = new Memory();
    this.registerFile = new RegisterFile();

    const generateRs = (count: number) => {
      return Array.from(
        { length: count },
        () =>
          ({
            busy: false,
            op: "ADD.D",
            vj: 0,
            vk: 0,
            qj: null,
            qk: null,
            dest: 0,
            address: 0,
            _inst: null,
            remainingTime: null,
          } as ReservationStationWithState)
      );
    };

    this.core = {
      reservationStations: {
        ADD: generateRs(2),
        MUL: generateRs(2),
        MEM: generateRs(2),
      },
      qi: Array.from({ length: this.registerFile.getSize() }, () => null),
    };
  }

  step() {
    const issueResult = this.issue();
    const { store, update, commit } = this.tick();

    if (issueResult) {
      this.pc++;
      const { type, index } = issueResult.rsIndex;
      this.core.reservationStations[type][index] = {
        ...issueResult.rsData,
        remainingTime: null,
      };
      this.core.qi[issueResult.rsData.dest] = issueResult.rsIndex;
      if (type === "MEM") {
        this.memQueue.push(issueResult.rsIndex.index);
      }
    }

    if (commit) {
      const { type, index } = commit.rsIndex;
      this.core.reservationStations[type][index].busy = false;
      this.commitChange(commit);
      if (type === "MEM") {
        this.memQueue.shift();
      }
    }

    update.forEach((action) => {
      const { rsIndex, remainingTime, address } = action;
      const { type, index } = rsIndex;
      this.core.reservationStations[type][index] = {
        ...this.core.reservationStations[type][index],
        remainingTime,
        address: address ?? this.core.reservationStations[type][index].address,
      };
    });

    if (store) {
      this.dMem.setAt(store.address, store.data);
      this.core.reservationStations.MEM[store.rsIndex.index].busy = false;
      if (this.memQueue.length <= 0) {
        throw new Error(
          "Mem queue is empty when storing, which should not happen"
        );
      }
      this.memQueue.shift();
    }
  }

  private issue(): ActionLoadRS | undefined {
    let inst: InstToma;
    try {
      inst = this.iMem.getInstructionAt(this.pc, false);
    } catch (e) {
      if (e instanceof NoMoreInstruction) {
        return;
      }
      throw e;
    }

    const rs: ReservationStation = {
      busy: true,
      op: inst.instType,
      vj: 0,
      vk: 0,
      qj: null,
      qk: null,
      dest: 0,
      address: 0,
      _inst: inst,
    };
    if (this.isArithmeticInst(inst)) {
      rs.dest = inst.rd!;

      const { q: qj, v: vj } = this.checkRegReady(inst.rs[0]!);
      rs.qj = qj;
      rs.vj = vj;

      const { q: qk, v: vk } = this.checkRegReady(inst.rs[1]!);
      rs.qk = qk;
      rs.vk = vk;

      if (inst.instType === "ADD.D" || inst.instType === "SUB.D") {
        const nonBusyIndex = this.core.reservationStations.ADD.findIndex(
          (rs) => !rs.busy
        );
        if (nonBusyIndex !== -1) {
          return {
            rsIndex: { type: "ADD", index: nonBusyIndex },
            rsData: rs,
          };
        }
      } else if (inst.instType === "MUL.D" || inst.instType === "DIV.D") {
        const nonBusyIndex = this.core.reservationStations.MUL.findIndex(
          (rs) => !rs.busy
        );
        if (nonBusyIndex !== -1) {
          return {
            rsIndex: { type: "MUL", index: nonBusyIndex },
            rsData: rs,
          };
        }
      }
      return;
    } else if (inst.instType === "L.D") {
      rs.dest = inst.rd!;
      rs.address = inst.immediate!;

      const { q: qj, v: vj } = this.checkRegReady(inst.rs[0]!);
      rs.qj = qj;
      rs.vj = vj;

      // const issueResult = this.loadStorer.tryIssue(rs);
      // if (issueResult) {
      //   this.qi[inst.rd!] = issueResult;
      //   this.pc++;
      // }
      const nonBusyIndex = this.core.reservationStations.MEM.findIndex(
        (rs) => !rs.busy
      );
      if (nonBusyIndex !== -1) {
        return {
          rsIndex: { type: "MEM", index: nonBusyIndex },
          rsData: rs,
        };
      }
    } else if (inst.instType === "S.D") {
      rs.address = inst.immediate!;

      const { q: qj, v: vj } = this.checkRegReady(inst.rs[0]!);
      rs.qj = qj;
      rs.vj = vj;

      const { q: qk, v: vk } = this.checkRegReady(inst.rs[1]!);
      rs.qk = qk;
      rs.vk = vk;

      // const issueResult = this.loadStorer.tryIssue(rs);
      // if (issueResult) {
      //   this.pc++;
      // }
      const nonBusyIndex = this.core.reservationStations.MEM.findIndex(
        (rs) => !rs.busy
      );
      if (nonBusyIndex !== -1) {
        return {
          rsIndex: { type: "MEM", index: nonBusyIndex },
          rsData: rs,
        };
      }
    }
    return;
  }

  private tick() {
    const updateAction: ActionUpdateRS[] = [];
    let commitAction: ActionCommitChange | undefined = undefined;
    let storeAction: ActionStore | undefined;
    this.core.reservationStations.ADD.forEach((rs, i) => {
      const result = reservationTickArithmetic(rs, {
        executeTime: 2,
        rsIndex: { type: "ADD", index: i },
        cbdAvailable: commitAction === undefined,
      });
      if (result) {
        if ("remainingTime" in result) {
          updateAction.push(result);
        } else {
          commitAction = result;
        }
      }
    });
    this.core.reservationStations.MUL.forEach((rs, i) => {
      const result = reservationTickArithmetic(rs, {
        executeTime: 10,
        rsIndex: { type: "MUL", index: i },
        cbdAvailable: commitAction === undefined,
      });
      if (result) {
        if ("remainingTime" in result) {
          updateAction.push(result);
        } else {
          commitAction = result;
        }
      }
    });
    this.core.reservationStations.MEM.forEach((rs, i) => {
      if (rs.op === "L.D") {
        const result = reservationTickLoad(rs, {
          executeTime: 1,
          cbdAvailable: commitAction === undefined,
          getMem: (addr) => this.dMem.getAt(addr),
          isBufferFirst: this.memQueue.at(0) === i,
          rsIndex: { type: "MEM", index: i },
        });
        const { update, commit } = result;
        if (update) {
          updateAction.push(update);
        }
        if (commit) {
          commitAction = commit;
        }
      } else {
        const result = reservationTickStore(rs, {
          executeTime: 2,
          isBufferFirst: this.memQueue.at(0) === i,
          rsIndex: { type: "MEM", index: i },
        });
        if (result) {
          if ("remainingTime" in result) {
            updateAction.push(result);
          } else {
            storeAction = result;
          }
        }
      }
    });

    return {
      update: updateAction,
      commit: commitAction as ActionCommitChange | undefined,
      store: storeAction,
    };
  }

  private commitChange(result: { rsIndex: RSIndex; data: number }) {
    const { rsIndex, data } = result;
    const { type, index } = rsIndex;
    const qiIndex = this.core.qi.findIndex(
      (q) => q?.type === type && q?.index === index
    );
    if (qiIndex !== -1) {
      this.core.qi[qiIndex] = null;
      this.registerFile.setAt(qiIndex, data);
    }

    Object.values(this.core.reservationStations)
      .flat()
      .forEach((rs) => {
        if (rs.qj?.index === index && rs.qj?.type === type) {
          rs.vj = data;
          rs.qj = null;
        }
        if (rs.qk?.index === index && rs.qk?.type === type) {
          rs.vk = data;
          rs.qk = null;
        }
      });
  }

  private checkRegReady(reg: RegIndex): { q: RSIndex | null; v: number } {
    const stat = this.core.qi[reg];
    if (stat) {
      return { q: stat, v: 0 };
    } else {
      const v = this.registerFile.getAt(reg);
      return { q: null, v };
    }
  }
  private isArithmeticInst(inst: InstToma): boolean {
    return (
      inst.instType === "ADD.D" ||
      inst.instType === "SUB.D" ||
      inst.instType === "MUL.D" ||
      inst.instType === "DIV.D"
    );
  }
}
