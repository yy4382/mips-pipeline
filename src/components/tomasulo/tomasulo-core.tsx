import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InstToma } from "@/lib/simulator/tomasulo/instruction";
import { printRSIndex, RSIndex } from "@/lib/simulator/tomasulo/tomasulo";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  InstructionStatus,
  RSForDisplay,
  TomasuloCoreStatus,
} from "./tomasulo";

export function TomasuloCoreDisplay({
  coreStatus,
  insts,
}: {
  coreStatus: TomasuloCoreStatus[];
  insts: InstToma[];
}) {
  const [showingClockCycle, setShowingClockCycle] = useState(0);
  const instStatusDisplay = useMemo(() => {
    return instructionStatusTransform(
      coreStatus.map((c) => c.instStatus),
      insts
    );
  }, [coreStatus, insts]);
  useEffect(() => {
    setShowingClockCycle(coreStatus.length > 0 ? coreStatus.length - 1 : 0);
  }, [coreStatus]);
  if (!coreStatus[showingClockCycle]) {
    return null;
  }
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Instruction Status</CardTitle>
        </CardHeader>
        <CardContent>
          <InstStatusComp instStatusDisplay={instStatusDisplay} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simulator State</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (showingClockCycle > 0) {
                  setShowingClockCycle(showingClockCycle - 1);
                }
              }}
              disabled={showingClockCycle <= 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            Clock Cycle: {showingClockCycle}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (showingClockCycle < coreStatus.length - 1) {
                  setShowingClockCycle(showingClockCycle + 1);
                }
              }}
              disabled={showingClockCycle >= coreStatus.length - 1}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-base font-medium mb-3">
                Reservation Stations
              </h3>
              <ReservationStationComp rs={coreStatus[showingClockCycle].rs} />
            </div>

            <div>
              <h3 className="text-base font-medium mb-3">
                Register Status (Qi)
              </h3>
              <QiComp qi={coreStatus[showingClockCycle].qi} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReservationStationComp({ rs }: { rs: RSForDisplay[] }) {
  if (rs.length === 0) {
    return (
      <div className="flex justify-center p-8 text-muted-foreground">
        No reservation stations
      </div>
    );
  }
  const tableHeader = ["Name", "Busy", "Op", "Vj", "Vk", "Qj", "Qk", "Time"];
  const tableBody = rs.map((rs) => {
    if (rs.busy) {
      return [
        rs.rsName,
        rs.busy.toString(),
        rs.op,
        rs.vj,
        rs.vk,
        printRSIndex(rs.qj),
        printRSIndex(rs.qk),
        rs.remainingTime === null
          ? ""
          : rs.remainingTime < 0
          ? 0
          : rs.remainingTime,
      ];
    }
    return [
      rs.rsName,
      rs.busy.toString(),
      ...Array.from({ length: tableHeader.length - 2 }, () => ""),
    ];
  });
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {tableHeader.map((header) => {
              return <TableHead key={header}>{header}</TableHead>;
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tableBody.map((row, index) => {
            return (
              <TableRow key={index}>
                {row.map((cell, index) => {
                  return (
                    <TableCell key={index}>
                      {index === 1 ? (
                        <Badge
                          variant={cell === "true" ? "default" : "outline"}
                          className={cell === "true" ? "bg-green-500" : ""}
                        >
                          {cell === "true" ? "Yes" : "No"}
                        </Badge>
                      ) : (
                        cell
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function QiComp({ qi }: { qi: (RSIndex | null)[] }) {
  return (
    <div className="p-4 rounded-md border bg-card">
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
        {qi.slice(32).map((q, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center p-2 bg-muted/30 rounded-md border"
          >
            <span className="text-sm font-medium text-muted-foreground">
              Qi[{i}]
            </span>
            <span
              className={`mt-1 font-mono ${
                q === null
                  ? "text-muted-foreground"
                  : "text-foreground font-medium"
              }`}
            >
              {q === null ? "—" : printRSIndex(q)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
type InstStatusDisplay = {
  inst: InstToma;
  issue?: number;
  executeStart?: number;
  executeEnd?: number;
  writeBack?: number;
};

function instructionStatusTransform(
  status: InstructionStatus[][],
  insts: InstToma[]
) {
  const instStatusDisplay: InstStatusDisplay[] = Array.from(
    { length: insts.length },
    (_, i) => ({
      inst: insts[i],
      issue: undefined,
      executeStart: undefined,
      executeEnd: undefined,
      writeBack: undefined,
    })
  );

  for (const [clockCycleIndex, instStatus] of status.entries()) {
    for (const [instIndex, statusValue] of instStatus.entries()) {
      if (statusValue.issued) {
        instStatusDisplay[instIndex].issue = clockCycleIndex;
      }
      if (statusValue.executeStart) {
        instStatusDisplay[instIndex].executeStart = clockCycleIndex;
      }
      if (statusValue.executeEnd) {
        instStatusDisplay[instIndex].executeEnd = clockCycleIndex;
      }
      if (statusValue.writeBack) {
        instStatusDisplay[instIndex].writeBack = clockCycleIndex;
      }
    }
  }
  return instStatusDisplay;
}

function InstStatusComp({
  instStatusDisplay,
}: {
  instStatusDisplay: InstStatusDisplay[];
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Instruction</TableHead>
            <TableHead className="font-semibold">Issue</TableHead>
            <TableHead className="font-semibold">Execute Start</TableHead>
            <TableHead className="font-semibold">Execute End</TableHead>
            <TableHead className="font-semibold">Write Back</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {instStatusDisplay.map((instStatus, index) => (
            <TableRow key={index}>
              <TableCell className="font-mono">
                {instStatus.inst.raw.trim()}
              </TableCell>
              <TableCell>
                {instStatus.issue !== undefined ? instStatus.issue : "—"}
              </TableCell>
              <TableCell>
                {instStatus.executeStart !== undefined
                  ? instStatus.executeStart
                  : "—"}
              </TableCell>
              <TableCell>
                {instStatus.executeEnd !== undefined
                  ? instStatus.executeEnd
                  : "—"}
              </TableCell>
              <TableCell>
                {instStatus.writeBack !== undefined
                  ? instStatus.writeBack
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
