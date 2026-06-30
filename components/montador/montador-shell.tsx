import Image from "next/image";
import type { ReactNode } from "react";

type MontadorShellProps = {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
  center?: boolean;
  showFooter?: boolean;
};

const widths = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
};

export default function MontadorShell({
  children,
  maxWidth = "md",
  center = false,
  showFooter = true,
}: MontadorShellProps) {
  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div
        className={`mx-auto flex min-h-screen w-full flex-col px-5 py-6 sm:px-6 sm:py-8 ${
          widths[maxWidth]
        } ${center ? "justify-center" : ""}`}
      >
        <header className="mb-6 flex justify-center sm:mb-8">
          <div className="rounded-3xl bg-white px-5 py-4 shadow-xl shadow-black/15">
            <Image
              src="/brand/H_TAGLINE_CF_ROXO.png"
              alt="Fábrica de Luz"
              width={500}
              height={300}
              priority
              className="h-auto max-h-20 w-full max-w-xs object-contain sm:max-h-24 sm:max-w-sm"
            />
          </div>
        </header>

        <div className="w-full">{children}</div>

        {showFooter ? (
          <footer className="mt-6 text-center text-xs text-white/38">
            Fábrica de Luz · Sistema OS
          </footer>
        ) : null}
      </div>
    </main>
  );
}
