import { useState } from "react";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";

// Define example instructions based on test cases
const exampleInstructions = [
  {
    name: "RAW",
    insts: `# This is a test case for RAW
lw $1, 0($0)
lw $2, 1($0)
add $3, $1, $2
sw $3, 2($0)`,
  },
  {
    name: "Branch With RAW",
    insts: `# This is a test case for branch with RAW
# the tricky part is that the register used in branch instruction itself has a RAW dependency 
# (which is not a corner case that need to handle specifically if RAW and branching are implemented correctly)
addi $1, $0, 1
addi $2, $0, 2
addi $3, $0, 0
beqz $3, target
add $4, $1, $2
target:
add $5, $1, $2
sw $4, 0($0)
sw $5, 1($0)
`,
  },
  {
    name: "Fibonacci",
    insts: `# get the i-th fibonacci number
# i is stored in the first memory location (need to modify it)
# the result will be stored in the second memory location
# if i is less than 0, return -1

lw $1, 0($0)
ble $1, $0, invalid_input
addi $2, $0, 0
addi $3, $0, 1
beq $1, $3, return_0 # if $1 == 1, return_0
addi $4, $0, 2
beq $1, $4, return_1 # if $1 == 2, return_1
addi $1, $1, -2 # because the first two fibonacci numbers are 0 and 1
loop:
  beqz $1, end
  addi $1, $1, -1
  add $4, $2, $3
  addi $2, $3, 0
  addi $3, $4, 0
  beqz $0, loop
invalid_input:
  addi $3, $0, -1
  beqz $0, end
return_0:
  addi $3, $0, 0
  beqz $0, end
return_1:
  addi $3, $0, 1
  beqz $0, end
end:
  sw $3, 1($0)
`,
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
    onChange(instructions);
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
