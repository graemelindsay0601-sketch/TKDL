import { useEffect, useState, useCallback } from "react";
import { Coins, Check, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useCosmeticsCatalog, nameStyleCSS, nameStyleClassName, bannerCSS, frameStyle, glowRowStyle, resultThemeColor, bubbleColorStyle, RARITY_COLORS, PROFILE_ICON_MAP,
  type CosmeticDefinition,
} from "@/lib/cosmetics";

type CosmeticCategory = "NAME_STYLE" | "PROFILE_ICON" | "BANNER" | "FRAME" | "GLOW" | "RESULT_THEME" | "BUBBLE_COLOR";

interface CosmeticsShopProps {
  playerId: number;
  playerName: string;
}

interface OwnedState {
  ownedIds: string[];
  equippedNameStyleId: string | null;
  equippedProfileIconId: string | null;
  equippedBannerId: string | null;
  equippedFrameId: string | null;
  equippedGlowId: string | null;
  equippedResultThemeId: string | null;
  equippedBubbleColorId: string | null;
}

export function CosmeticsShop({ playerId, playerName }: CosmeticsShopProps) {
  const { toast } = useToast();
  const catalog = useCosmeticsCatalog();
  const [owned, setOwned] = useState<OwnedState | null>(null);
  const [coins, setCoins] = useState<number>(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch(`/api/players/${playerId}/cosmetics`)
      .then(r => (r.ok ? r.json() : null))
      .then(setOwned)
      .catch(() => {});
    // Reuses the same balance endpoint CoinBalance.tsx already reads —
    // one shared coin balance, this is just a second place to spend it.
    fetch(`/api/card-clash/shop/currency/${playerId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => setCoins(data?.cardPoints ?? 0))
      .catch(() => {});
  }, [playerId]);

  useEffect(() => { refresh(); }, [refresh]);

  const nameStyles   = catalog.filter(c => c.category === "NAME_STYLE");
  const profileIcons = catalog.filter(c => c.category === "PROFILE_ICON");
  const banners      = catalog.filter(c => c.category === "BANNER");
  const frames       = catalog.filter(c => c.category === "FRAME");
  const glows        = catalog.filter(c => c.category === "GLOW");
  const resultThemes = catalog.filter(c => c.category === "RESULT_THEME");
  const bubbleColors = catalog.filter(c => c.category === "BUBBLE_COLOR");

  const purchase = async (cosmetic: CosmeticDefinition) => {
    setBusyId(cosmetic.id);
    try {
      const res = await fetch(`/api/players/${playerId}/cosmetics/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cosmeticId: cosmetic.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Couldn't buy that", description: data.error ?? "Please try again.", variant: "destructive" });
        return;
      }
      toast({ title: `${cosmetic.name} unlocked ✓`, description: "Equip it below whenever you like." });
      refresh();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const equip = async (category: CosmeticCategory, cosmeticId: string | null) => {
    setBusyId(cosmeticId ?? `unequip-${category}`);
    try {
      const res = await fetch(`/api/players/${playerId}/cosmetics/equip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ category, cosmeticId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Couldn't equip that", description: data.error ?? "Please try again.", variant: "destructive" });
        return;
      }
      toast({ title: cosmeticId ? "Equipped ✓" : "Cleared" });
      refresh();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "0.5rem",
        background: "rgba(255,212,74,0.1)", border: "1px solid rgba(255,212,74,0.3)",
        borderRadius: "0.5rem", padding: "0.75rem 1rem",
      }}>
        <Coins size={20} style={{ color: "#ffd24a" }} />
        <div>
          <div style={{ fontSize: "0.8rem", color: "rgba(255,212,74,0.7)" }}>Your Coins</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#ffd24a" }}>{coins}</div>
        </div>
      </div>

      <CosmeticSection
        title="Name Styles"
        subtitle="Recolour your name wherever it's shown — your account page and your profile, as others see it. The gold &amp; red League Champion style isn't for sale — it's awarded to whoever wins the Singles season."
        items={nameStyles}
        owned={owned}
        coins={coins}
        busyId={busyId}
        category="NAME_STYLE"
        onPurchase={purchase}
        onEquip={equip}
        renderPreview={c => (
          <div className={nameStyleClassName(c)} style={{
            fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", fontWeight: 900,
            letterSpacing: "0.02em", ...nameStyleCSS(c),
          }}>
            {playerName || "Your Name"}
          </div>
        )}
      />

      <CosmeticSection
        title="Profile Icons"
        subtitle="Swap the icon shown on your account page."
        items={profileIcons}
        owned={owned}
        coins={coins}
        busyId={busyId}
        category="PROFILE_ICON"
        onPurchase={purchase}
        onEquip={equip}
        renderPreview={c => {
          const Icon = (c.iconKey && PROFILE_ICON_MAP[c.iconKey]) || null;
          return Icon ? <Icon className="w-6 h-6" style={{ color: RARITY_COLORS[c.rarity] }} /> : null;
        }}
      />

      <CosmeticSection
        title="Profile Banners"
        subtitle="Background behind your name &amp; stats at the top of your account page."
        items={banners}
        owned={owned}
        coins={coins}
        busyId={busyId}
        category="BANNER"
        onPurchase={purchase}
        onEquip={equip}
        renderPreview={c => (
          <div style={{ width: "100%", height: "32px", borderRadius: "6px", ...bannerCSS(c) }} />
        )}
      />

      <CosmeticSection
        title="Avatar Frames"
        subtitle="Border &amp; glow around your avatar square."
        items={frames}
        owned={owned}
        coins={coins}
        busyId={busyId}
        category="FRAME"
        onPurchase={purchase}
        onEquip={equip}
        renderPreview={c => (
          <div style={{
            width: "32px", height: "32px", borderRadius: "8px",
            background: "#15151f", ...frameStyle(c),
          }} />
        )}
      />

      <CosmeticSection
        title="Leaderboard Row Glow"
        subtitle="Highlight colour on your own row on the leaderboard."
        items={glows}
        owned={owned}
        coins={coins}
        busyId={busyId}
        category="GLOW"
        onPurchase={purchase}
        onEquip={equip}
        renderPreview={c => (
          <div style={{
            width: "100%", height: "24px", borderRadius: "6px",
            background: "#15151f", ...glowRowStyle(c),
          }} />
        )}
      />

      <CosmeticSection
        title="Result Screen Themes"
        subtitle="Accent colour on your own practice, Master 501 &amp; Tour result screens."
        items={resultThemes}
        owned={owned}
        coins={coins}
        busyId={busyId}
        category="RESULT_THEME"
        onPurchase={purchase}
        onEquip={equip}
        renderPreview={c => (
          <div style={{
            width: "24px", height: "24px", borderRadius: "50%",
            background: resultThemeColor(c, "#a78bfa"),
            boxShadow: `0 0 10px ${resultThemeColor(c, "#a78bfa")}88`,
          }} />
        )}
      />

      <CosmeticSection
        title="Message Bubble Colour"
        subtitle="Tint on your own sent messages in your account-page DMs."
        items={bubbleColors}
        owned={owned}
        coins={coins}
        busyId={busyId}
        category="BUBBLE_COLOR"
        onPurchase={purchase}
        onEquip={equip}
        renderPreview={c => (
          <div style={{
            padding: "4px 10px", borderRadius: "10px", fontSize: "0.6rem",
            fontFamily: "Oswald, sans-serif", color: "#fff",
            background: "rgba(255,0,92,0.2)", border: "1px solid rgba(255,0,92,0.35)",
            ...bubbleColorStyle(c),
          }}>
            Hey!
          </div>
        )}
      />
    </div>
  );
}

const EQUIPPED_ID_KEY: Record<CosmeticCategory, keyof OwnedState> = {
  NAME_STYLE: "equippedNameStyleId",
  PROFILE_ICON: "equippedProfileIconId",
  BANNER: "equippedBannerId",
  FRAME: "equippedFrameId",
  GLOW: "equippedGlowId",
  RESULT_THEME: "equippedResultThemeId",
  BUBBLE_COLOR: "equippedBubbleColorId",
};

function CosmeticSection({
  title, subtitle, items, owned, coins, busyId, category, onPurchase, onEquip, renderPreview,
}: {
  title: string; subtitle: string; items: CosmeticDefinition[]; owned: OwnedState | null;
  coins: number; busyId: string | null; category: CosmeticCategory;
  onPurchase: (c: CosmeticDefinition) => void;
  onEquip: (category: CosmeticCategory, id: string | null) => void;
  renderPreview: (c: CosmeticDefinition) => React.ReactNode;
}) {
  const equippedId = owned ? (owned[EQUIPPED_ID_KEY[category]] as string | null) : null;

  return (
    <div>
      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", fontWeight: 800,
        letterSpacing: "0.06em", color: "rgba(255,255,255,0.85)", textTransform: "uppercase" }}>
        {title}
      </div>
      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", marginTop: "2px", marginBottom: "10px" }}>
        {subtitle}
      </div>

      {equippedId && (
        <button
          onClick={() => onEquip(category, null)}
          disabled={busyId !== null}
          style={{
            fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "3px 8px",
            marginBottom: "10px", cursor: "pointer", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em",
          }}
        >
          Clear equipped
        </button>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px" }}>
        {items.map(c => {
          const isOwned    = owned?.ownedIds.includes(c.id) ?? false;
          const isEquipped = equippedId === c.id;
          const canAfford  = coins >= c.price;
          const isBusy     = busyId === c.id;
          const rColor     = RARITY_COLORS[c.rarity] ?? "#9ca3af";

          return (
            <div key={c.id} style={{
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${isEquipped ? rColor : "rgba(255,255,255,0.08)"}`,
              borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "32px" }}>
                {renderPreview(c)}
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
                  {c.name}
                </div>
                <div style={{ fontSize: "0.58rem", color: rColor, fontWeight: 700, letterSpacing: "0.08em", marginTop: "1px" }}>
                  {c.rarity}
                </div>
              </div>

              {isEquipped ? (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                  fontSize: "0.65rem", color: rColor, fontWeight: 700, fontFamily: "Oswald, sans-serif", padding: "4px 0",
                }}>
                  <Check className="w-3 h-3" /> Equipped
                </div>
              ) : isOwned ? (
                <button
                  onClick={() => onEquip(category, c.id)}
                  disabled={isBusy}
                  style={{
                    fontSize: "0.65rem", fontWeight: 700, fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em",
                    color: "#fff", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "6px", padding: "5px 0", cursor: isBusy ? "default" : "pointer", opacity: isBusy ? 0.6 : 1,
                  }}
                >
                  Equip
                </button>
              ) : !c.purchasable ? (
                <div
                  title="Awarded automatically — not for sale"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                    fontSize: "0.6rem", fontWeight: 700, fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em",
                    color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.02)",
                    border: "1px dashed rgba(255,255,255,0.12)", borderRadius: "6px", padding: "5px 0",
                  }}
                >
                  <Lock className="w-3 h-3" /> Exclusive
                </div>
              ) : (
                <button
                  onClick={() => canAfford && onPurchase(c)}
                  disabled={isBusy || !canAfford}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                    fontSize: "0.65rem", fontWeight: 700, fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em",
                    color: canAfford ? "#ffd24a" : "rgba(255,255,255,0.3)",
                    background: canAfford ? "rgba(255,212,74,0.1)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${canAfford ? "rgba(255,212,74,0.3)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: "6px", padding: "5px 0",
                    cursor: isBusy || !canAfford ? "default" : "pointer", opacity: isBusy ? 0.6 : 1,
                  }}
                >
                  {canAfford ? <Coins className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {c.price}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
