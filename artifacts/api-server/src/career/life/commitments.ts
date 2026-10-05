import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { post } from "../finance/ledger.ts";

/** Invoked in A3's root-locked transaction after a sporting week has completed.
 * Does not move time, rewrite event dates or touch any sporting authority. */
export async function settleLifeCommitments(tx:CareerExecutor,root:{id:string;world_seed:string},season:number,week:number) {
  const due=(await tx.execute(sql`SELECT * FROM career_life_commitments WHERE career_save_id=${root.id}
    AND status='ACCEPTED' AND (season<${season} OR (season=${season} AND day<=${week*7})) ORDER BY season,day,id`)).rows;
  for(const c of due) {
    if(Number(c.fee_pence)>0)await post(tx,root,{operationKey:`life:appearance:${c.id}`,category:"COMMERCIAL_APPEARANCE",
      amountPence:Number(c.fee_pence),reason:String(c.title),season:Number(c.season),week:Math.ceil(Number(c.day)/7),
      contractId:c.contract_id?String(c.contract_id):null,detail:{commitmentId:c.id,family:c.family,contentVersion:1}});
    await tx.execute(sql`UPDATE career_life_commitments SET status='COMPLETED' WHERE career_save_id=${root.id} AND id=${c.id} AND status='ACCEPTED'`);
  }
  const merch=(await tx.execute(sql`SELECT * FROM career_life_merchandise WHERE career_save_id=${root.id} AND active=true`)).rows[0];
  // One contractual royalty per completed four-week accounting period. No retroactive royalties.
  if(merch&&week%4===0&&((season-Number(merch.signed_season))*52+week-Number(merch.signed_week))>=4)
    await post(tx,root,{operationKey:`life:merchandise:${season}:${week}`,category:"MERCHANDISE_ROYALTY",amountPence:Number(merch.royalty_pence),
      reason:`${String(merch.category).toLowerCase().replaceAll("_"," ")} merchandise agreement royalty`,season,week,
      contractId:merch.contract_id?String(merch.contract_id):null,detail:{category:merch.category,contentVersion:1}});
}
