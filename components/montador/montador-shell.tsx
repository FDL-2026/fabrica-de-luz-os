import type { ReactNode } from "react";
import BrandLogo from "@/components/brand-logo";

type MontadorShellProps = {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
  center?: boolean;
  showFooter?: boolean;
};

const widths = {
  sm: "max-w-[620px]",
  md: "max-w-[760px]",
  lg: "max-w-[980px]",
  xl: "max-w-[1040px]",
};

export default function MontadorShell({
  children,
  maxWidth = "md",
  center = false,
  showFooter = true,
}: MontadorShellProps) {
  return (
    <main className="fdl-montador-main min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div
        className={`fdl-montador-container mx-auto flex min-h-screen w-full flex-col px-5 py-8 sm:px-6 sm:py-10 ${
          widths[maxWidth]
        } ${center ? "justify-center" : ""}`}
      >
        <header className="mb-8 flex justify-center">
          <BrandLogo className="h-auto max-h-28 w-full max-w-sm object-contain" />
        </header>

        <div className="w-full">{children}</div>

        {showFooter ? (
          <footer className="mt-6 text-center text-xs text-white/40">
            Fábrica de Luz · Sistema OS
          </footer>
        ) : null}
      </div>
    </main>
  );
}