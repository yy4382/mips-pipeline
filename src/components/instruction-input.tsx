import { useState } from "react";
import { Textarea } from "./ui/textarea";

export function InstructionInput({
  onChange,
}: {
  onChange: (instruction: string) => void;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleButtonClick = () => {
    onChange(inputValue);
  };

  return (
    <div className="flex flex-col">
      <label
        htmlFor="instruction-input"
        className="text-sm font-medium text-gray-700"
      >
        Instruction
      </label>
      <div className="flex items-end space-x-2">
        <Textarea
          id="instruction-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-grow"
        />
        <button
          onClick={handleButtonClick}
          className="mt-1 px-4 py-2 bg-blue-500 text-white rounded-md shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
