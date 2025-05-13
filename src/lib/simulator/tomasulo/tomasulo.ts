import { InstStatus } from "@/components/tomasulo/tomasulo";
import {
  InstructionMemory,
  NoMoreInstruction,
} from "../hardware/instruction-memory";
import { Memory } from "../hardware/memory";
import { RegisterFile } from "../hardware/register-file";
import { InstToma } from "./instruction";

type RegIndex = number;

export type ReservationStation = {
  busy: boolean;
  op: InstToma["instType"];
  vj: number;
  vk: number;
  qj: RSIndex | null;
  qk: RSIndex | null;
  dest?: RegIndex;
  address: number;

  // Only used for visualization
  _inst: InstToma | null;
};

export type RSIndex = {
  type: "ADD" | "MUL" | "MEM";
  index: number;
};

export function printRSIndex(rsIndex: RSIndex | null): string {
  if (!rsIndex) {
    return "null";
  }
  return `${rsIndex.type}${rsIndex.index}`;
}

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

export type ReservationStationWithState = ReservationStation & {
  remainingTime: number | null;
};

function getOpExecuteTime(op: InstToma["instType"]): number {
  if (op === "ADD.D" || op === "SUB.D") {
    return 2;
  } else if (op === "MUL.D") {
    return 10;
  } else if (op === "DIV.D") {
    return 40;
  } else if (op === "L.D" || op === "S.D") {
    return 2;
  } else {
    throw new Error("Invalid operation");
  }
}

function reservationTickArithmetic(
  rs: ReservationStationWithState,
  option: {
    rsIndex: RSIndex;
    cbdAvailable: boolean;
    instStatusChangeCb?: InstStatusChangeCb;
  }
): ActionUpdateRS | ActionCommitChange | undefined {
  if (!rs.busy) {
    return;
  }
  const { rsIndex, cbdAvailable } = option;
  const executeTime = getOpExecuteTime(rs.op);

  // if not started and ready to start, set remaining time to executeTime.
  if (rs.remainingTime === null) {
    if (rs.qj === null && rs.qk === null) {
      // start execution
      if (option.instStatusChangeCb) {
        option.instStatusChangeCb(rs._inst!, "executeStart");
      }
      return {
        rsIndex,
        remainingTime: executeTime - 1,
      };
    } else {
      return;
    }
  }

  // if started and remaining time is 0, commit the result
  if (rs.remainingTime <= 0) {
    if (cbdAvailable) {
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
      if (option.instStatusChangeCb) {
        option.instStatusChangeCb(rs._inst!, "writeBack");
      }
      return {
        rsIndex,
        data,
      };
    } else {
      return;
    }
  }

  // if started and remaining time is not 0, just decrement remaining time
  return {
    rsIndex,
    remainingTime: rs.remainingTime - 1,
  };
}

function reservationTickLoad(
  rs: ReservationStationWithState,
  option: {
    isBufferFirst: boolean;
    cbdAvailable: boolean;
    rsIndex: RSIndex;
    getMem: (addr: number) => number;
    instStatusChangeCb?: InstStatusChangeCb;
  }
): {
  update?: ActionUpdateRS;
  commit?: ActionCommitChange;
  haveRead?: boolean;
} {
  if (!rs.busy) {
    return { update: undefined, commit: undefined };
  }

  const { isBufferFirst, cbdAvailable, rsIndex, getMem } = option;
  const executeTime = getOpExecuteTime(rs.op);

  if (rs.remainingTime === null) {
    // Instruction has not started execution yet
    if (isBufferFirst && rs.qj === null) {
      // Ready to start execution this tick
      if (option.instStatusChangeCb) {
        option.instStatusChangeCb(rs._inst!, "executeStart");
      }
      return {
        update: {
          rsIndex,
          remainingTime: executeTime - 1,
          address: rs.vj + rs.address,
        },
        commit: undefined,
        haveRead: true,
      };
    } else {
      return {};
    }
  }

  if (rs.remainingTime <= 0) {
    if (cbdAvailable) {
      if (option.instStatusChangeCb) {
        option.instStatusChangeCb(rs._inst!, "writeBack");
      }
      return {
        update: undefined,
        commit: {
          rsIndex,
          data: getMem(rs.address),
        },
      };
    } else {
      return { update: undefined, commit: undefined };
    }
  }

  // if started and remaining time is not 0, just decrement remaining time
  return {
    update: {
      rsIndex,
      remainingTime: rs.remainingTime - 1,
    },
    commit: undefined,
  };
}

function reservationTickStore(
  rs: ReservationStationWithState,
  option: {
    isBufferFirst: boolean;
    rsIndex: RSIndex;
    instStatusChangeCb?: InstStatusChangeCb;
  }
): ActionUpdateRS | ActionStore | undefined {
  if (!rs.busy) {
    return;
  }
  const { isBufferFirst, rsIndex } = option;

  const executeTime = getOpExecuteTime(rs.op);

  if (rs.remainingTime === null) {
    if (isBufferFirst && rs.qj === null) {
      if (option.instStatusChangeCb) {
        option.instStatusChangeCb(rs._inst!, "executeStart");
      }
      return {
        rsIndex,
        remainingTime: executeTime - 1,
        address: rs.vj + rs.address,
      };
    } else {
      return;
    }
  }
  // enter write back stage
  else if (rs.remainingTime <= 0 && rs.qk === null) {
    if (option.instStatusChangeCb) {
      option.instStatusChangeCb(rs._inst!, "writeBack");
    }
    return {
      address: rs.address,
      data: rs.vk,
      rsIndex,
    };
  }
  // just decrement remaining time
  else {
    return {
      rsIndex,
      remainingTime: rs.remainingTime - 1,
    };
  }
}

type TomasuloCoreHardware = {
  reservationStations: Record<
    "ADD" | "MUL" | "MEM",
    ReservationStationWithState[]
  >;
  qi: (RSIndex | null)[];
};

export type InstStatusChangeCb = (
  inst: InstToma,
  newStatus: InstStatus
) => void;
export class TomasuloProcessor {
  iMem: InstructionMemory<InstToma>;
  dMem: Memory;

  pc: number = 0;

  registerFile: RegisterFile;

  core: TomasuloCoreHardware;
  memQueue: number[] = [];

  constructor(
    iMem: InstructionMemory<InstToma>,
    componentCount: { add: number; mul: number; mem: number } = {
      add: 3,
      mem: 3,
      mul: 2,
    }
  ) {
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
        ADD: generateRs(componentCount.add),
        MUL: generateRs(componentCount.mul),
        MEM: generateRs(componentCount.mem),
      },
      qi: Array.from({ length: this.registerFile.getSize() }, () => null),
    };
  }

  step(opt?: { debug?: boolean; instStatusChangeCb?: InstStatusChangeCb }) {
    const issueResult = this.issue();
    const { store, update, commit, popMemQueue } = this.tick(
      opt?.instStatusChangeCb
    );

    // call issue for the instruction that is issued this tick
    if (issueResult?.rsData._inst && opt?.instStatusChangeCb) {
      opt.instStatusChangeCb(issueResult.rsData._inst, "issued");
    }
    // call executeEnd for all instructions that have finished execution
    if (opt?.instStatusChangeCb) {
      for (const updateAct of update) {
        if (updateAct.remainingTime === 0) {
          const inst =
            this.core.reservationStations[updateAct.rsIndex.type][
              updateAct.rsIndex.index
            ]._inst;
          if (inst) {
            opt.instStatusChangeCb(inst, "executeEnd");
          }
        }
      }
    }

    this.updateState(issueResult, commit, update, store, popMemQueue);

    if (opt?.debug) {
      this.printState();
    }

    return this.isFinished();
  }

  private printState() {
    Object.values(this.core.reservationStations)
      .flat()
      .forEach((rs) => {
        if (!rs.busy) {
          return;
        }
        console.log(
          `op:${rs.op}, vj:${rs.vj}, vk:${rs.vk}, qj:${
            rs.qj ? printRSIndex(rs.qj) : "null"
          }, qk:${rs.qk ? printRSIndex(rs.qk) : "null"}, remainingTime:${
            rs.remainingTime
          }`
        );
      });
    if (this.core.qi.some((q) => q !== null)) {
      console.log(
        this.core.qi
          .slice(32)
          .map((q, i) => (q ? `${i}: ${q.type}${q.index}` : `${i}: ''`))
          .join(", ")
      );
    }
  }

  private updateState(
    issueResult: ActionLoadRS | undefined,
    commit: ActionCommitChange | undefined,
    update: ActionUpdateRS[],
    store: ActionStore | undefined,
    popMemQueue: boolean
  ) {
    if (issueResult) {
      this.pc++;
      const { type, index } = issueResult.rsIndex;
      this.core.reservationStations[type][index] = {
        ...issueResult.rsData,
        remainingTime: null,
      };
      if (issueResult.rsData.dest) {
        this.core.qi[issueResult.rsData.dest] = issueResult.rsIndex;
      }
      if (type === "MEM") {
        this.memQueue.push(issueResult.rsIndex.index);
      }
    }

    if (commit) {
      const { type, index } = commit.rsIndex;
      this.core.reservationStations[type][index].busy = false;
      this.commitChange(commit);
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
    }
    if (popMemQueue) {
      if (this.memQueue.length <= 0) {
        throw new Error("Mem queue is empty, which should not happen");
      }
      this.memQueue.shift();
    }
  }

  private issue(): ActionLoadRS | undefined {
    const inst = this.getNextInst();
    if (!inst) {
      return;
    }

    const rs: ReservationStation = {
      busy: true,
      op: inst.instType,
      vj: 0,
      vk: 0,
      qj: null,
      qk: null,
      dest: undefined,
      address: 0,
      _inst: inst,
    };
    if (this.isArithmeticInst(inst)) {
      rs.dest = inst.rd;

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
      rs.dest = inst.rd;
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

  private tick(instStatusChangeCb?: InstStatusChangeCb) {
    const updateAction: ActionUpdateRS[] = [];
    let commitAction: ActionCommitChange | undefined = undefined;
    let storeAction: ActionStore | undefined;
    let popMemQueue = false;

    this.core.reservationStations.ADD.forEach((rs, i) => {
      const result = reservationTickArithmetic(rs, {
        rsIndex: { type: "ADD", index: i },
        cbdAvailable: commitAction === undefined,
        instStatusChangeCb,
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
        rsIndex: { type: "MUL", index: i },
        cbdAvailable: commitAction === undefined,
        instStatusChangeCb,
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
          cbdAvailable: commitAction === undefined,
          getMem: (addr) => this.dMem.getAt(addr),
          isBufferFirst: this.memQueue.at(0) === i,
          rsIndex: { type: "MEM", index: i },
          instStatusChangeCb,
        });
        const { update, commit, haveRead } = result;
        if (haveRead) {
          popMemQueue = true;
        }
        if (update) {
          updateAction.push(update);
        }
        if (commit) {
          commitAction = commit;
        }
      } else {
        const result = reservationTickStore(rs, {
          isBufferFirst: this.memQueue.at(0) === i,
          rsIndex: { type: "MEM", index: i },
          instStatusChangeCb,
        });
        if (result) {
          if ("remainingTime" in result) {
            updateAction.push(result);
          } else {
            storeAction = result;
            popMemQueue = true;
          }
        }
      }
    });

    return {
      update: updateAction,
      commit: commitAction as ActionCommitChange | undefined,
      store: storeAction,
      popMemQueue,
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

  private isFinished(): boolean {
    return (
      this.core.reservationStations.ADD.every((rs) => !rs.busy) &&
      this.core.reservationStations.MUL.every((rs) => !rs.busy) &&
      this.core.reservationStations.MEM.every((rs) => !rs.busy) &&
      this.core.qi.every((q) => q === null)
    );
  }

  getNextInst(): InstToma | undefined {
    let inst: InstToma;
    try {
      inst = this.iMem.getInstructionAt(this.pc, false);
    } catch (e) {
      if (e instanceof NoMoreInstruction) {
        return;
      }
      throw e;
    }
    return inst;
  }
}
