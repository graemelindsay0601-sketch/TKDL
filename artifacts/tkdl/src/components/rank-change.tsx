import { ArrowUp, ArrowDown, Minus } from "lucide-react";

export function RankChange({ change }: { change?: number }) {
  if (!change || change === 0) {
    return <span className="inline-flex items-center text-white/20 text-xs"><Minus className="w-3 h-3" /></span>;
  }
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-bold" style={{ color: "#22c55e" }}>
        <ArrowUp className="w-3 h-3" />{change}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold" style={{ color: "#ff005c" }}>
      <ArrowDown className="w-3 h-3" />{Math.abs(change)}
    </span>
  );
}
