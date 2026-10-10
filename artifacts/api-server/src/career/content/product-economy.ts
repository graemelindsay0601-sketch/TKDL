export const PRODUCT_ECONOMY=Object.freeze({
  royaltyPercent:8,
  weeklyUnitCap:100,
  pricePence:Object.freeze({SIGNATURE_DARTS:6999,SIGNATURE_RANGE:2499}),
  baselineDemandMin:8,
  baselineDemandMax:34,
});

export function calculateProductWeek(productId:string,productType:"SIGNATURE_DARTS"|"SIGNATURE_RANGE",
  season:number,week:number,editionRemaining:number|null=null) {
  let hash=2166136261;
  for(const char of `${productId}:${season}:${week}`)hash=Math.imul(hash^char.charCodeAt(0),16777619);
  const demand=PRODUCT_ECONOMY.baselineDemandMin+(hash>>>0)%(PRODUCT_ECONOMY.baselineDemandMax-PRODUCT_ECONOMY.baselineDemandMin+1);
  const units=Math.max(0,Math.min(PRODUCT_ECONOMY.weeklyUnitCap,demand,editionRemaining??PRODUCT_ECONOMY.weeklyUnitCap));
  const grossPence=units*PRODUCT_ECONOMY.pricePence[productType];
  return {units,grossPence,royaltyPence:Math.floor(grossPence*PRODUCT_ECONOMY.royaltyPercent/100)};
}
