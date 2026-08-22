import { getSupabaseAuthConfig } from "../../lib/auth-config";
import { AuthGate } from "../auth-gate";

export const dynamic = "force-dynamic";

export default function AccountPage() {
  return <AuthGate config={getSupabaseAuthConfig()} />;
}
