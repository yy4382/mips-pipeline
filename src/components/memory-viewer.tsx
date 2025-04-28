import React, { useState, useEffect, useCallback } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface MemoryViewerProps {
  memory: readonly number[];
  setMemory: (i: number, value: number) => void;
}

export const MemoryViewer: React.FC<MemoryViewerProps> = ({
  memory,
  setMemory,
}) => {
  // Initialize local state directly from the memory instance
  const [editableMemory, setEditableMemory] = useState<string[]>(() =>
    memory.slice().map(String)
  );

  // Effect to subscribe to memory changes on mount and unsubscribe on unmount
  useEffect(() => {
    // Define the listener callback
    setEditableMemory(memory.slice().map(String));
  }, [memory]);

  const handleInputChange = useCallback((index: number, value: string) => {
    setEditableMemory((prev) => {
      const newState = [...prev];
      newState[index] = value; // Store as string temporarily
      return newState;
    });
  }, []);

  const handleSave = useCallback(
    (index: number) => {
      const valueStr = editableMemory[index];
      const valueNum = parseInt(valueStr, 10); // Or parseFloat if needed

      // Get the current value *before* attempting to set, for comparison/revert
      const currentValueInMemory = memory.at(index);

      if (!isNaN(valueNum)) {
        try {
          // This will trigger the notification if the value actually changes
          setMemory(index, valueNum);
          // No need to manually setEditableMemory here, the subscription handles it
          console.log(
            `Attempted to save value ${valueNum} at address ${index}`
          );
        } catch (error) {
          console.error(`Error saving memory at index ${index}:`, error);
          // Revert local state if save fails in the Memory class (e.g., bounds error)
          // Note: The subscription might have already updated if setAt partially succeeded before error
          setEditableMemory((prev) => {
            const newState = [...prev];
            newState[index] = currentValueInMemory?.toString() ?? ""; // Revert to original value
            return newState;
          });
        }
      } else {
        console.warn(
          `Invalid input at index ${index}: ${valueStr}. Not saving.`
        );
        // Revert local state if input is invalid before calling setAt
        setEditableMemory((prev) => {
          const newState = [...prev];
          newState[index] = currentValueInMemory?.toString() ?? ""; // Revert to original value
          return newState;
        });
      }
    },
    [editableMemory, memory, setMemory]
  ); // Keep editableMemory dependency for reading the input value

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (event.key === "Enter") {
      handleSave(index);
      // Optionally move focus to the next input or perform other actions
    } else if (event.key === "Escape") {
      // Revert changes on Escape by reading directly from memory
      setEditableMemory((prev) => {
        const newState = [...prev];
        newState[index] = memory.at(index)?.toString() ?? "";
        return newState;
      });
      // Optionally blur the input to signify cancellation
      (event.target as HTMLInputElement).blur();
    }
  };

  return (
    <Card className="w-full max-w-120">
      <CardHeader>
        <CardTitle>Memory Contents</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Grid container with fixed header */}
        <div className="h-[300px] w-full overflow-y-scroll border rounded-md">
          {/* Grid Header */}
          <div className="sticky top-0 grid grid-cols-[100px_1fr_80px] gap-x-4 bg-muted z-20 px-4 py-2 border-b font-medium">
            <div className="w-[100px]">Address</div>
            <div>Value</div>
            <div className="w-[80px]">Actions</div>
          </div>
          {/* Grid Body */}
          <div className="grid grid-cols-[100px_1fr_80px] gap-x-4 items-center">
            {Array.from({ length: memory.length }).map((_, index) => (
              <React.Fragment key={index}>
                {/* Address Cell */}
                <div className="font-mono px-4 py-1 text-sm">{index}</div>
                {/* Value Cell */}
                <div className="px-4 py-1">
                  <Input
                    type="text" // Use text to allow intermediate invalid states
                    value={editableMemory[index] ?? ""} // Use local state for input value
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, index)} // Save on Enter, revert on Escape
                    onBlur={() => handleSave(index)} // Optionally save on blur if value is valid
                    className="font-mono h-8 text-sm" // Adjust size as needed
                  />
                </div>
                {/* Actions Cell */}
                <div className="px-4 py-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSave(index)}
                    disabled={
                      editableMemory[index] ===
                        (memory.at(index)?.toString() ?? "") ||
                      isNaN(parseInt(editableMemory[index], 10)) // Also disable if current input is not a valid number
                    } // Disable if unchanged or invalid
                    className="h-8 text-xs"
                  >
                    Save
                  </Button>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
