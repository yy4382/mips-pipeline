import { InstWithStage } from "@/lib/pipeline-parsers/instruction-list";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "./ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

export function InstructionList({
  instructions,
}: {
  instructions: InstWithStage[];
}) {
  return (
    <Card className="w-96">
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
                  <TableCell>{inst.inst.raw}</TableCell>
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
