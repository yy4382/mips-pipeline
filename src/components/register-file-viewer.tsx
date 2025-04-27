import React, { useState, useEffect } from "react";
import { RegisterFile } from "@/lib/simulator/hardware/register-file";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RegisterFileViewerProps {
  registerFile: RegisterFile;
}

export const RegisterFileViewer: React.FC<RegisterFileViewerProps> = ({
  registerFile,
}) => {
  const [registers, setRegisters] = useState<readonly number[]>(() =>
    registerFile.getRegisters()
  );

  useEffect(() => {
    const handleRegisterChange = (newRegisters: readonly number[]) => {
      console.debug("Register file changed:", newRegisters);
      // Create a shallow copy using slice() to ensure a new array reference
      setRegisters(newRegisters.slice());
    };

    const unsubscribe = registerFile.subscribe(handleRegisterChange);
    // Update state immediately in case registers changed before effect ran
    handleRegisterChange(registerFile.getRegisters());

    return () => {
      unsubscribe();
    };
  }, [registerFile]);

  return (
    <Card className="w-100">
      <CardHeader>
        <CardTitle>Register File</CardTitle>
      </CardHeader>
      <CardContent>
        {" "}
        {/* Adjust height as needed */}
        <div className="grid grid-cols-4 gap-x-4 gap-y-2 text-sm">
          {" "}
          {/* 4 columns grid */}
          {registers.map((value, index) => (
            <div
              key={index}
              className="flex justify-between font-mono border-b pb-1"
            >
              <span className="text-muted-foreground">${index}:</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
