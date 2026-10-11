# Career NPC wardrobe integration contract

This E1 apparel module is ready for the Career shell integration owner. It does
not change the shared NPC profile, rankings, tournament or world screens.

## Consumer contract

- Resolve the saved NPC shirt first with `stableNpcWardrobeKitDesignId(npcId, { tier, activeMakerBrandIds, savedKitDesignId })`.
- Persist the returned `kitDesignId` with the NPC identity snapshot so rerenders and season loads do not reshuffle its look.
- Pass only currently active sponsor placements to `PremiumCareerShirt`; do not infer sponsors from player status, NPC stature or catalogue defaults.
- `activeMakerBrandIds` must come from that NPC's active contract snapshot. An equipment agreement only unlocks its own maker collection; it does not imply apparel exclusivity for another brand.
- A saved design remains renderable after rights expire, but it must not be offered as a new selection. Never replace it automatically.
- Keep the legacy `stableNpcKitDesignId(npcId, savedKitDesignId)` call valid until the shell migration is reviewed.

## Visual component

Use `PremiumCareerShirt` for the garment and vector sponsor marks. The older
`CareerShirt` helper remains a compatibility renderer; do not use its text
fallback as the final branded apparel presentation.
