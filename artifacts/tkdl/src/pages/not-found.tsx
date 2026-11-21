import { Link } from "wouter";
import { Home } from "lucide-react";
import { PageHero } from "@/components/premium/Premium";

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-1 py-6 space-y-4">
      <PageHero
        kicker={<>Off the board · 404</>}
        title="Missed the board"
        sub="That page doesn't exist, or it has moved. Head back to the hub and go again."
        accent="#ff005c"
        accent2="#ffd24a"
      />
      <div className="flex justify-center">
        <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold uppercase tracking-widest text-sm"
          style={{ background: "linear-gradient(180deg,#ffe58a,#e0a800)", color: "#1a1200", border: "1px solid #ffd24a", boxShadow: "0 6px 18px rgba(224,168,0,.28)", fontFamily: "Oswald, sans-serif" }}>
          <Home className="w-4 h-4" /> Back to the hub
        </Link>
      </div>
    </div>
  );
}
