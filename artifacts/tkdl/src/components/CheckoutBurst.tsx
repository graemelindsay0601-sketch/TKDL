// A CHECKOUT_EFFECT cosmetic's particle burst — a coloured flash plus a dozen
// copies of the cosmetic's emoji thrown outward at even angles, using the
// .checkout-burst-* keyframes in index.css (each particle reads its own
// angle back out of the --angle custom property it's given here). Purely
// decorative/absolute — safe to drop into any `position: relative` parent.
// Shared between practice.tsx (Practice result screen) and play.tsx (real
// match result screen) so both "you won" moments get the same treatment.
const CHECKOUT_BURST_PARTICLES = 12;

export function CheckoutBurst({ emoji, color }: { emoji: string; color: string }) {
  return (
    <div className="absolute inset-0 overflow-visible" aria-hidden="true">
      <div className="checkout-burst-flash" style={{ background: color }} />
      {Array.from({ length: CHECKOUT_BURST_PARTICLES }, (_, i) => (
        <span key={i} className="checkout-burst-particle text-lg"
          style={{ "--angle": `${(360 / CHECKOUT_BURST_PARTICLES) * i}deg` } as React.CSSProperties}>
          {emoji}
        </span>
      ))}
    </div>
  );
}
