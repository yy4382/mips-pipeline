import { type Statics } from "@/lib/simulator/pipeline";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
export function Statics({
  statics,
  forwardStatus,
}: {
  statics: Statics;
  forwardStatus: boolean;
}) {
  return (
    <Card className="w-full max-w-150">
      <CardHeader>
        <CardTitle>Statics</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <p>
          <span className="font-medium">Forwarding:</span>{" "}
          {forwardStatus ? "Enabled" : "Disabled"}
        </p>
        <p>
          <span className="font-medium">Clock Cycles:</span>{" "}
          {statics.clockCycles}
        </p>
        <p>
          <span className="font-medium">Finished Instructions:</span>{" "}
          {statics.finishedInsts}
        </p>
        <p>
          <span className="font-medium">Data Hazard Stalls:</span>{" "}
          {statics.dataHazardStalls}
        </p>
        <p>
          <span className="font-medium">Branch Prediction Fails:</span>{" "}
          {statics.predictFails}
        </p>
        <p>
          <span className="font-medium">Forward Count:</span>{" "}
          {statics.forwardCount}
        </p>
      </CardContent>
    </Card>
  );
}
