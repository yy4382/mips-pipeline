import { InstWithStage } from "../lib/pipeline-parsers/instruction-list";

export function InstructionList({
  instructions,
}: {
  instructions: InstWithStage[];
}) {
  return (
    <div className="flex flex-col gap-2 w-96">
      {instructions.map((inst, index) => (
        <div
          key={index}
          className={`flex items-center justify-between gap-2 p-2 rounded-md border ${
            inst.stage ? "bg-blue-100 border-blue-300" : "bg-white border-gray-200"
          }`}
        >
          <span className="font-mono">{inst.inst.raw}</span>
          {inst.stage && (
            <span className="text-xs font-semibold uppercase px-2 py-1 bg-blue-500 text-white rounded-full">
              {inst.stage}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
