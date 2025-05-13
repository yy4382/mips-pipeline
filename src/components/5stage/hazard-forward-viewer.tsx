import { JSX } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HazardForwardViewer({ hazards }: { hazards: JSX.Element[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hazards & Forwards</CardTitle>
      </CardHeader>
      <CardContent className="max-h-96 overflow-y-scroll">
        <div className="flex flex-col gap-3">
          {hazards.length === 0 && (
            <div className="text-muted-foreground">No hazards detected</div>
          )}
          {hazards.map((hazards) => hazards)}
        </div>
      </CardContent>
    </Card>
  );
}
