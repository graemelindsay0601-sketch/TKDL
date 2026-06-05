import { ArrowUp, ArrowDown, Minus } from "lucide-react";

export function RankChange({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="inline-flex items-center text-emerald-500 font-mono text-xs">
        <ArrowUp className="w-3 h-3 mr-0.5" />
        {change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center text-destructive font-mono text-xs">
        <ArrowDown className="w-3 h-3 mr-0.5" />
        {Math.abs(change)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-muted-foreground font-mono text-xs">
      <Minus className="w-3 h-3" />
    </span>
  );
}
