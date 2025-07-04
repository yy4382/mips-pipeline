import { InstWithStage } from "@/lib/pipeline-parsers/instruction-list";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function InstructionList({
  instructions,
}: {
  instructions: InstWithStage[];
}) {
  return (
    <Card className="w-full">
      <CardHeader>
        <h2 className="text-lg font-semibold">Instruction List</h2>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-82">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Index</TableHead>
                <TableHead>Instruction</TableHead>
                <TableHead className="w-16">Stage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instructions.map((inst, index) => (
                <TableRow key={index}>
                  <TableCell>{inst.inst.originalIndex}</TableCell>
                  <TableCell>
                    <span title={inst.inst.raw}>{inst.inst.raw}</span>
                  </TableCell>
                  <TableCell>{inst.stage ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
