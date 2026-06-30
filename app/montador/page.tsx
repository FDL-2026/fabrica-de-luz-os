import MontadorShell from "@/components/montador/montador-shell";
import MontadorLoginClient from "./montador-login-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MontadorLoginPage() {
  return (
    <MontadorShell maxWidth="sm" center>
      <MontadorLoginClient />
    </MontadorShell>
  );
}
