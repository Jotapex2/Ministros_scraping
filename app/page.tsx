import { AuthGate } from "@/components/auth-gate";
import { HomeClient } from "@/components/home-client";
export default function Page() {
  return (
    <AuthGate>
      <HomeClient />
    </AuthGate>
  );
}
