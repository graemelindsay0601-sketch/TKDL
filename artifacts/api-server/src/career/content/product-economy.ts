export const PRODUCT_ECONOMY=Object.freeze({
  demandVersion:2,
  royaltyPercent:8,
  weeklyUnitCap:100,
  pricePence:Object.freeze({SIGNATURE_DARTS:6999,SIGNATURE_RANGE:2499}),
  baselineDemandMin:8,
  baselineDemandMax:34,
});

export function calculateProductWeek(productId:string,productType:"SIGNATURE_DARTS"|"SIGNATURE_RANGE",
  season:number,week:number,editionRemaining:number|null=null,
  evidence:{seasonTitles?:number;worldRank?:number|null;productLaunchPromotions?:number}={}) {
  let hash=2166136261;
  for(const char of `${productId}:${season}:${week}`)hash=Math.imul(hash^char.charCodeAt(0),16777619);
  const baseline=PRODUCT_ECONOMY.baselineDemandMin+(hash>>>0)%(PRODUCT_ECONOMY.baselineDemandMax-PRODUCT_ECONOMY.baselineDemandMin+1);
  const titles=Math.max(0,Math.trunc(evidence.seasonTitles??0)),rank=evidence.worldRank;
  const titleDemand=Math.min(12,titles*3),rankDemand=rank!==null&&rank!==undefined&&rank<=16?5:
    rank!==null&&rank!==undefined&&rank<=32?3:0,promotionDemand=(evidence.productLaunchPromotions??0)>0?6:0;
  const demand=baseline+titleDemand+rankDemand+promotionDemand;
  const units=Math.max(0,Math.min(PRODUCT_ECONOMY.weeklyUnitCap,demand,editionRemaining??PRODUCT_ECONOMY.weeklyUnitCap));
  const grossPence=units*PRODUCT_ECONOMY.pricePence[productType];
  return {units,grossPence,royaltyPence:Math.floor(grossPence*PRODUCT_ECONOMY.royaltyPercent/100),
    demandVersion:PRODUCT_ECONOMY.demandVersion,demandEvidence:{baselineUnits:baseline,seasonTitles:titles,worldRank:rank??null,
      completedProductLaunchPromotions:Math.min(1,evidence.productLaunchPromotions??0),titleDemandUnits:titleDemand,
      rankDemandUnits:rankDemand,promotionDemandUnits:promotionDemand,weeklyCap:PRODUCT_ECONOMY.weeklyUnitCap}};
}
