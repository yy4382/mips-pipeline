import { getIMemToma } from "@/lib/simulator/tomasulo/instruction";
import {
  InstStatusChangeCb,
  ReservationStationWithState,
  RSIndex,
  TomasuloProcessor,
  TomasuloStatistics,
} from "@/lib/simulator/tomasulo/tomasulo";
import { useCallback, useEffect, useRef, useState } from "react";
import { TomaControls } from "./tomasulo-control";
import { TomasuloCoreDisplay } from "./tomasulo-core";
import { RegisterFileViewer } from "../5stage/register-file-viewer";
import { MemoryViewer } from "../5stage/memory-viewer";
import { InstructionInput } from "../5stage/instruction-input";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export type InstructionStatus = {
  issued: boolean;
  executeStart: boolean;
  executeEnd: boolean;
  writeBack: boolean;
};

export type InstStatus = keyof InstructionStatus;

export type TomasuloCoreStatus = {
  instStatus: InstructionStatus[];
  rs: RSForDisplay[];
  qi: (RSIndex | null)[];
};

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type RSForDisplay = Prettify<
  Omit<ReservationStationWithState, "_inst"> & {
    rsName: string;
  }
>;

const DEFAULT_INST = `L.D $f0, 0($0)
L.D $f2, 1($0)
ADD.D $f4, $f0, $f2
S.D $f4, 0($0)`;

export function TomasuloComp() {
  const tomaProcessorRef = useRef<TomasuloProcessor>(null);
  const [coreStatus, setCoreStatus] = useState<TomasuloCoreStatus[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [instructions, setInstructions] = useState(DEFAULT_INST);
  const [statistics, setStatistics] = useState<TomasuloStatistics>({
    clockCycleCount: 0,
    finishedInstCount: 0,
  });

  const setIMem = useCallback((s: string) => {
    let iMem;
    try {
      iMem = getIMemToma(s);
    } catch (e) {
      toast.error("Invalid instructions" + e);
      return;
    }
    tomaProcessorRef.current = new TomasuloProcessor(iMem);
    setInstructions(s);
    setCoreStatus([
      { ...parseCoreStatus(tomaProcessorRef.current), instStatus: [] },
    ]);
    setRegisterFile(
      tomaProcessorRef.current?.registerFile.getRegisters() ?? []
    );
    setMemory(tomaProcessorRef.current?.dMem.getMemory() ?? []);
    setIsFinished(false);
    setStatistics({
      clockCycleCount: 0,
      finishedInstCount: 0,
    });
  }, []);

  const step = useCallback<() => boolean>(() => {
    if (!tomaProcessorRef.current) {
      return true;
    }
    const instStatusChanges: {
      instIndex: number;
      status: Parameters<InstStatusChangeCb>[1];
    }[] = [];
    const cb: InstStatusChangeCb = (inst, status) => {
      instStatusChanges.push({ instIndex: inst.originalIndex!, status });
    };
    const finished = tomaProcessorRef.current?.step({ instStatusChangeCb: cb });
    setIsFinished(finished);
    const coreStatus = parseCoreStatus(tomaProcessorRef.current);
    const instStatus: InstructionStatus[] = Array.from(
      { length: tomaProcessorRef.current.iMem.getSize() },
      () => {
        return {
          issued: false,
          executeStart: false,
          executeEnd: false,
          writeBack: false,
        };
      }
    );
    for (const change of instStatusChanges) {
      instStatus[change.instIndex][change.status] = true;
    }
    setCoreStatus((prev) => [
      ...prev,
      {
        ...coreStatus,
        instStatus,
      },
    ]);
    setRegisterFile(
      tomaProcessorRef.current?.registerFile.getRegisters() ?? []
    );
    setMemory(tomaProcessorRef.current?.dMem.getMemory() ?? []);
    setStatistics({
      clockCycleCount:
        tomaProcessorRef.current?.statistics.clockCycleCount ?? 0,
      finishedInstCount:
        tomaProcessorRef.current?.statistics.finishedInstCount ?? 0,
    });
    return finished;
  }, []);

  const run = useCallback(
    (stopAt: number | undefined) => {
      if (!tomaProcessorRef.current) {
        return;
      }
      if (stopAt === undefined) {
        step();
      } else if (stopAt === -1) {
        let maxClockCycle = 100;
        while (!step() && maxClockCycle > 0) {
          maxClockCycle--;
        }
      } else {
        let maxClockCycle = 100;
        while (
          tomaProcessorRef.current.getNextInst()?.originalIndex !==
            stopAt - 1 &&
          !step() &&
          maxClockCycle > 0
        ) {
          maxClockCycle--;
        }
      }
    },
    [step]
  );

  const [registerFile, setRegisterFile] = useState(
    tomaProcessorRef.current?.registerFile.getRegisters() ?? []
  );
  const [memory, setMemory] = useState(
    tomaProcessorRef.current?.dMem.getMemory() ?? []
  );
  const handleSetMem = (i: number, value: number) => {
    tomaProcessorRef.current?.dMem.setAt(i, value);
    setMemory(tomaProcessorRef.current?.dMem.getMemory() ?? []);
  };

  useEffect(() => {
    if (tomaProcessorRef.current) {
      return;
    }
    setIMem(instructions);
  }, [setIMem, instructions]);

  return (
    <div>
      <div>
        <TomaControls
          isFinished={isFinished}
          onReset={() => {
            setIMem(instructions);
          }}
          onRun={run}
        />
      </div>
      <div className="mt-6">
        <TomasuloCoreDisplay
          coreStatus={coreStatus}
          insts={tomaProcessorRef.current?.iMem.instructions ?? []}
        />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
          <MemoryViewer memory={memory} setMemory={handleSetMem} />
          <RegisterFileViewer registerFile={registerFile} slice={[32]} />
        </div>
        <div className="mt-6">
          <StatisticsViewer statistics={statistics} />
        </div>
        <div className="mt-6">
          <InstructionInput
            onChange={setIMem}
            exampleInstructions={exampleInstructions}
          />
        </div>
      </div>
    </div>
  );
}

function parseCoreStatus(
  processor: TomasuloProcessor
): Omit<TomasuloCoreStatus, "instStatus"> {
  const rs = Object.entries(processor.core.reservationStations)
    .map(([type, rses]) => {
      return rses.map((rs, index) => {
        return {
          ...structuredClone(rs),
          rsName: `${type}${index}`,
        };
      });
    })
    .flat();
  const qi = structuredClone(processor.core.qi);

  return {
    rs: rs,
    qi,
  };
}

const exampleInstructions = [
  {
    name: "Simple",
    insts: `L.D $f0, 0($0)
ADD.D $f1, $f2, $f2
S.D $f3, 0($1)`,
  },
  {
    name: "RAW",
    insts: DEFAULT_INST,
  },
  {
    name: "WAR",
    insts: `MUL.D $f4, $f1, $f1
ADD.D $f0, $f2, $f4
ADD.D $f2, $f3, $f6`,
  },
  {
    name: "PPT",
    insts: `L.D $f6, 0($2) 
L.D $f2, 1($3) 
MUL.D $f0, $f2, $f4 
SUB.D $f8, $f6, $f2
DIV.D $f10, $f0, $f6
ADD.D $f6, $f8, $f2`,
  },
];

function StatisticsViewer({ statistics }: { statistics: TomasuloStatistics }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Clock Cycle Count: {statistics.clockCycleCount}</p>
        <p>Finished Inst Count: {statistics.finishedInstCount}</p>
      </CardContent>
    </Card>
  );
}
