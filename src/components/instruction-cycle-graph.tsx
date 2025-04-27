import { InstCycleGraphData } from "./pipeline";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type Stage = "IF" | "ID" | "EX" | "MEM" | "WB";

interface InstructionCycleGraphProps {
  data: InstCycleGraphData;
}

const stageColors: Record<Stage, string> = {
  IF: "#60a5fa", // blue-400
  ID: "#4ade80", // green-400
  EX: "#facc15", // yellow-400
  MEM: "#f87171", // red-400
  WB: "#c084fc", // purple-400
  // STALL: "#9ca3af", // gray-400
  // DONE: "#f3f4f6", // gray-100 (won't be drawn)
};

const CELL_WIDTH = 40;
const CELL_HEIGHT = 30;
const PADDING = 20;
const INSTRUCTION_LABEL_WIDTH = 150;
const CYCLE_LABEL_HEIGHT = 20;

export function InstructionCycleGraph({ data }: InstructionCycleGraphProps) {
  if (data.length === 0 || data[0].instructions.length === 0) {
    return (
      <div className="text-center p-4 border rounded-lg bg-white shadow">
        No data available
      </div>
    );
  }

  // Get the max cycle and unique instructions
  const maxCycle = data[data.length - 1].cycle;
  const uniqueInstructions = Array.from(
    new Map(
      data.flatMap((d) =>
        d.instructions.map((i) => [i.inst.originalIndex, i.inst])
      )
    ).values()
  ).sort((a, b) => a.originalIndex! - b.originalIndex!);

  const numInstructions = uniqueInstructions.length;
  const numCycles = maxCycle + 1;

  const svgWidth =
    PADDING * 2 + INSTRUCTION_LABEL_WIDTH + numCycles * CELL_WIDTH;
  const svgHeight =
    PADDING * 2 + CYCLE_LABEL_HEIGHT + numInstructions * CELL_HEIGHT;

  // Create a map for quick lookup: cycle -> instructionIndex -> stage
  const cycleInstStageMap = new Map<number, Map<number, Stage>>();
  data.forEach((cycleData) => {
    const instMap = new Map<number, Stage>();
    cycleData.instructions.forEach((inst) => {
      // Only add to map if the stage is defined
      if (inst.stage) {
        instMap.set(inst.inst.originalIndex!, inst.stage);
      }
    });
    cycleInstStageMap.set(cycleData.cycle, instMap);
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Instruction Cycle Graph</CardTitle>
      </CardHeader>
      <CardContent>
        <svg
          width={svgWidth}
          height={svgHeight}
          xmlns="http://www.w3.org/2000/svg"
        >
          <g transform={`translate(${PADDING}, ${PADDING})`}>
            {/* Cycle Labels (X-axis) */}
            {Array.from({ length: numCycles }, (_, i) => (
              <text
                key={`cycle-label-${i}`}
                x={INSTRUCTION_LABEL_WIDTH + i * CELL_WIDTH + CELL_WIDTH / 2}
                y={CYCLE_LABEL_HEIGHT - 5}
                textAnchor="middle"
                fontSize="12"
                fill="#6b7280" // gray-500
              >
                {i}
              </text>
            ))}

            {/* Instruction Labels (Y-axis) */}
            {uniqueInstructions.map((inst, index) => (
              <text
                key={`inst-label-${inst.originalIndex}`}
                x={INSTRUCTION_LABEL_WIDTH - 10}
                y={CYCLE_LABEL_HEIGHT + index * CELL_HEIGHT + CELL_HEIGHT / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="12"
                fontFamily="monospace"
              >
                {/* Truncate long instructions */}
                {inst.raw.length > 20
                  ? inst.raw.substring(0, 18) + "..."
                  : inst.raw}
              </text>
            ))}

            {/* Grid and Stage Rectangles */}
            {uniqueInstructions.map((inst, instIdx) => (
              <g
                key={`row-${inst.originalIndex}`}
                transform={`translate(0, ${
                  CYCLE_LABEL_HEIGHT + instIdx * CELL_HEIGHT
                })`}
              >
                {Array.from({ length: numCycles }, (_, cycle) => {
                  const stage = cycleInstStageMap
                    .get(cycle)
                    ?.get(inst.originalIndex!);
                  const x = INSTRUCTION_LABEL_WIDTH + cycle * CELL_WIDTH;
                  const y = 0;

                  return (
                    <g key={`cell-${inst.originalIndex}-${cycle}`}>
                      {/* Grid Cell Border */}
                      <rect
                        x={x}
                        y={y}
                        width={CELL_WIDTH}
                        height={CELL_HEIGHT}
                        fill="none"
                        stroke="#e5e7eb" // gray-200
                      />
                      {/* Stage Rectangle and Text */}
                      {stage && (
                        <>
                          <rect
                            x={x + 2}
                            y={y + 2}
                            width={CELL_WIDTH - 4}
                            height={CELL_HEIGHT - 4}
                            fill={stageColors[stage]}
                            rx="3" // rounded corners
                          />
                          <text
                            x={x + CELL_WIDTH / 2}
                            y={y + CELL_HEIGHT / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize="10"
                            fontWeight="500"
                            fill="#1f2937" // gray-800
                          >
                            {stage}
                          </text>
                        </>
                      )}
                      {/* {stage === "STALL" && (
                      <text
                        x={x + CELL_WIDTH / 2}
                        y={y + CELL_HEIGHT / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="10"
                        fontWeight="500"
                        fill={stageColors[stage]} // Use stall color for text
                      >
                        Stall
                      </text>
                    )} */}
                    </g>
                  );
                })}
              </g>
            ))}
          </g>
        </svg>
      </CardContent>
    </Card>
  );
}
