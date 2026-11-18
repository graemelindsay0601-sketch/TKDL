/**
 * Card Clash is benched (2026-11-18, at Graeme's request): it is hidden everywhere and the app makes no Card Clash calls.
 * Coins (wallet, cosmetics, daily login, daily/weekly challenges) are TKDL's general currency and keep working.
 * To bring Card Clash back, set this to false and CARD_CLASH_BENCHED=0 on the server (api-server/src/lib/card-clash-bench.ts).
 */
export const CARD_CLASH_BENCHED = true;
