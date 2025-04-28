import { useState } from "react";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";

// Define example instructions based on test cases
const exampleInstructions = [
  {
    name: "Basic Load/Add/Store",
    insts: `lw $1, 0($0)
lw $2, 1($0)
add $3, $1, $2
sw $3, 2($0)`,
  },
  {
    name: "Branch Taken",
    insts: `lw $1, 0($0)
lw $2, 1($0)
beqz $0, 2 # Branch will be taken
add $3, $2, $2 # This should be skipped
add $4, $1, $1 # Execution continues here`,
  },
  {
    name: "Branch + Flushed RAW",
    insts: `lw $1, 0($0)
beqz $0, 3 # Branch taken
lw $2, 1($0) # Flushed
add $3, $1, $2 # Flushed (RAW on $2)
add $4, $1, $1 # Execution continues here`,
  },
];

export function InstructionInput({
  onChange,
}: {
  onChange: (instruction: string) => void;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleButtonClick = () => {
    onChange(inputValue);
  };

  const handleLoadExample = (instructions: string) => {
    setInputValue(instructions);
  };

  return (
    <div className="flex flex-col p-4 min-w-92">
      <label
        htmlFor="instruction-input"
        className="text-sm font-medium text-gray-700 mb-2"
      >
        Instruction (
        <a
          className="underline"
          href="https://github.com/yy4382/mips-pipeline/blob/main/src/lib/simulator/spec.md"
        >
          spec
        </a>
        )
      </label>
      <Textarea
        id="instruction-input"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-none font-mono" // Added font-mono
        placeholder="Enter MIPS instructions (e.g., add $t0, $s1, $s2), one per line." // Updated placeholder
        rows={3} // Increased default rows
      />
      {/* Modified div for buttons: justify-between */}
      <div className="flex justify-between items-center mt-2">
        {/* Container for example buttons */}
        <div className="flex space-x-2">
          {exampleInstructions.map((example) => (
            <Button
              key={example.name}
              variant="outline" // Use outline style for examples
              size="sm" // Make example buttons smaller
              onClick={() => handleLoadExample(example.insts)}
            >
              {example.name}
            </Button>
          ))}
        </div>
        {/* Submit button remains on the right */}
        <Button onClick={handleButtonClick}>Submit</Button>
      </div>
    </div>
  );
}
