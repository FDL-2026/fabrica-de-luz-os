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
        <header className="mb-7 flex justify-center sm:mb-8">
          <Image
            src="/brand/H_TAGLINE_SF_ROXO.png"
            alt="Fábrica de Luz"
            width={500}
            height={300}
            priority
            className="h-auto max-h-28 w-full max-w-sm object-contain sm:max-h-32"
          />
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
