import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRegisterName } from "@/lib/simulator/hardware/register-file";

interface RegisterFileViewerProps {
  registerFile: readonly number[];
  slice?: Parameters<typeof Array.prototype.slice>;
}

export const RegisterFileViewer: React.FC<RegisterFileViewerProps> = ({
  registerFile,
  slice: sliceProp,
}) => {
  const slice = sliceProp ?? [0, 32];
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Register File</CardTitle>
      </CardHeader>
      <CardContent>
        {" "}
        {/* Adjust height as needed */}
        <div className="grid grid-cols-4 gap-x-4 gap-y-2 text-sm">
          {" "}
          {/* 4 columns grid */}
          {registerFile
            .map((value, index) => ({ name: getRegisterName(index), value }))
            .slice(...slice)
            .map(({ name, value }) => (
              <div
                key={name}
                className="flex justify-between font-mono border-b pb-1"
              >
                <span className="text-muted-foreground">{name}:</span>
                <span>{value}</span>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
};
