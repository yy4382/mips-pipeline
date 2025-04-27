import { PipelineRegs } from "../lib/simulator/hardware/pipeline-registers";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function PipelineView({ pipelineRegs }: { pipelineRegs: PipelineRegs }) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Pipeline Registers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 font-mono text-sm">
          <div>
            <p className="font-bold">IF/ID Register</p>
            <p>Instruction: {pipelineRegs.if2id.inst.raw}</p>
            <p>PC: {pipelineRegs.if2id.pc}</p>
          </div>
          <div>
            <p className="font-bold">ID/EX Register</p>
            <p>Instruction: {pipelineRegs.id2ex.inst.raw}</p>
            <p>Reg1: {pipelineRegs.id2ex.reg1}</p>
            <p>Reg2: {pipelineRegs.id2ex.reg2}</p>
            <p>PC: {pipelineRegs.id2ex.pc}</p>
            <p>Immediate: {pipelineRegs.id2ex.immediate}</p>
          </div>
          <div>
            <p className="font-bold">EX/MEM Register</p>
            <p>Instruction: {pipelineRegs.ex2mem.inst.raw}</p>
            <p>ALU Output: {pipelineRegs.ex2mem.alu_out}</p>
            <p>Write Data: {pipelineRegs.ex2mem.write_data}</p>
          </div>
          <div>
            <p className="font-bold">MEM/WB Register</p>
            <p>Instruction: {pipelineRegs.mem2wb.inst.raw}</p>
            <p>Memory Data: {pipelineRegs.mem2wb.mem}</p>
            <p>ALU Result: {pipelineRegs.mem2wb.alu}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
