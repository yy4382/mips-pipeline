import { type Statistics } from "@/lib/simulator/basic-pipeline/pipeline";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
export function Statistics({
  statistics,
  forwardStatus,
}: {
  statistics: Statistics;
  forwardStatus: boolean;
}) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Statistics</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm">
        <p>
          <span className="font-medium">Forwarding:</span>{" "}
          {forwardStatus ? "Enabled" : "Disabled"}
        </p>
        <p>
          <span className="font-medium">Clock Cycles:</span>{" "}
          {statistics.clockCycles}
        </p>
        <p>
          <span className="font-medium">Finished Instructions:</span>{" "}
          {statistics.finishedInsts}
        </p>
        <p>
          <span className="font-medium">Data Hazard Stalls:</span>{" "}
          {statistics.dataHazardStalls}
        </p>
        <p>
          <span className="font-medium">Branch Prediction Fails:</span>{" "}
          {statistics.predictFails}
        </p>
        <p>
          <span className="font-medium">Forward Count:</span>{" "}
          {statistics.forwardCount}
        </p>
      </CardContent>
    </Card>
  );
}
