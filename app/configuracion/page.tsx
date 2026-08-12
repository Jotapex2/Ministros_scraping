import { AuthGate } from "@/components/auth-gate";
import { ConfigurationClient } from "@/components/configuration-client";
export default function ConfigurationPage() {
  return (
    <AuthGate>
      <ConfigurationClient />
    </AuthGate>
  );
}
