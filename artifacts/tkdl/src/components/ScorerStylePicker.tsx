import "@/lib/modern-x01.css";
import { Keyboard, Columns3, History } from "lucide-react";
import { useScorerStyle, type ScorerStyle } from "@/lib/useScorerStyle";
import { useToast } from "@/hooks/use-toast";

const OPTIONS: { id: ScorerStyle; title: string; desc: string; Icon: typeof Keyboard; tag?: string }[] = [
  { id: "total",   title: "Visit total", desc: "Type the score for all three darts. Fastest for league nights.", Icon: Keyboard, tag: "Recommended" },
  { id: "perdart", title: "Per dart",    desc: "Enter each dart: single, double or treble. Full dart-by-dart stats.", Icon: Columns3 },
  { id: "classic", title: "Classic",     desc: "The original scorer, unchanged.", Icon: History },
];

/** "Your scorer" — picks which X01 scorer layout this player gets. Saved to their account. */
export function ScorerStylePicker() {
  const [style, setStyle] = useScorerStyle();
  const { toast } = useToast();
  const pick = async (id: ScorerStyle) => {
    if (id === style) return;
    const ok = await setStyle(id);
    if (!ok) toast({ title: "Saved on this device only", description: "Couldn't reach the server to save it to your account.", variant: "destructive" });
  };
  return (
    <section className="pm-card ssp" aria-labelledby="ssp-title">
      <div className="ssp-head">
        <h3 id="ssp-title" className="pm-chrome">Your scorer</h3>
        <p>How you enter scores in 501 and other X01 games. You can also switch mid-match from the top of the scorer.</p>
      </div>
      <div className="ssp-list" role="radiogroup" aria-labelledby="ssp-title">
        {OPTIONS.map(o => {
          const on = o.id === style;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={on} className={`ssp-opt${on ? " is-on" : ""}`} onClick={() => void pick(o.id)}>
              <span className="ssp-ico"><o.Icon size={24} /></span>
              <span className="ssp-txt">
                <span className="ssp-name">{o.title}{o.tag && <em>{o.tag}</em>}</span>
                <span className="ssp-desc">{o.desc}</span>
              </span>
              <span className="ssp-radio" aria-hidden="true"><i /></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
