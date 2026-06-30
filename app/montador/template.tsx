export default function MontadorTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="fdl-montador-layout">{children}</div>;
}
