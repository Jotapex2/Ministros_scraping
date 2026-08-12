import { AuthGate } from "@/components/auth-gate";
import { DataExplorer } from "@/components/data-explorer";

export default function DataPage() {
  return (
    <AuthGate>
      <DataExplorer />
    </AuthGate>
  );
}
