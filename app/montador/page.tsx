import Image from "next/image";
import MontadorLoginClient from "./montador-login-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MontadorLoginPage() {
  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
<div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-8">
        <div className="mb-8 flex justify-center">
          <Image
            src="/brand/H_TAGLINE_SF_ROXO.png"
            alt="Fábrica de Luz"
            width={500}
            height={300}
            priority
            className="h-auto max-h-28 w-full max-w-sm object-contain"
          />
        </div>

        <MontadorLoginClient />
      </div>
    </main>
  );
}
