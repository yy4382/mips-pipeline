import React, { useState, useEffect, useCallback } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    [editableMemory, memory]
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
    }
  };

  return (
    <Card className="w-full max-w-120">
      <CardHeader>
        <CardTitle>Memory Contents</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full overflow-y-scroll">
          {" "}
          {/* Adjust height as needed */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Address</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: memory.length }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono">{index}</TableCell>
                  <TableCell>
                    <Input
                      type="text" // Use text to allow intermediate invalid states
                      value={editableMemory[index] ?? ""} // Use local state for input value
                      onChange={(e) => handleInputChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, index)} // Save on Enter, revert on Escape
                      className="font-mono h-8" // Adjust size as needed
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSave(index)}
                      disabled={
                        editableMemory[index] ===
                        (memory.at(index)?.toString() ?? "")
                      } // Disable if unchanged
                    >
                      Save
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
