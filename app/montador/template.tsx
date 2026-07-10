import ThemeToggle from "@/components/gestao/theme-toggle";
import OfflineStatus from "@/components/montador/offline-status";

export default function MontadorTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fdl-montador-layout fdl-content">
      <div className="fixed right-2 top-2 z-50 w-[168px] max-w-[52vw]">
        <ThemeToggle />
      </div>
      {children}
      <OfflineStatus />
    </div>
  );
}
