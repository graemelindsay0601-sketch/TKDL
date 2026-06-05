export function TierBadge({ tier }: { tier: string }) {
  const getTierColor = (t: string) => {
    switch (t.toLowerCase()) {
      case 'bronze': return 'bg-orange-900/40 text-orange-500 border-orange-900';
      case 'silver': return 'bg-slate-500/20 text-slate-300 border-slate-600';
      case 'gold': return 'bg-amber-500/20 text-amber-400 border-amber-600';
      case 'platinum': return 'bg-cyan-500/20 text-cyan-400 border-cyan-600';
      case 'diamond': return 'bg-purple-500/20 text-purple-400 border-purple-600';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border uppercase tracking-wider font-mono ${getTierColor(tier)}`}>
      {tier}
    </span>
  );
}
