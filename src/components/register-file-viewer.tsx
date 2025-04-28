import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RegisterFileViewerProps {
  registerFile: readonly number[];
}

export const RegisterFileViewer: React.FC<RegisterFileViewerProps> = ({
  registerFile,
}) => {
  return (
    <Card className="w-full max-w-120">
      <CardHeader>
        <CardTitle>Register File</CardTitle>
      </CardHeader>
      <CardContent>
        {" "}
        {/* Adjust height as needed */}
        <div className="grid grid-cols-4 gap-x-4 gap-y-2 text-sm">
          {" "}
          {/* 4 columns grid */}
          {registerFile.map((value, index) => (
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
