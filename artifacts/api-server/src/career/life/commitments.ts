import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { post } from "../finance/ledger.ts";
import { calculateProductWeek } from "../content/product-economy.ts";
import { fansForEffects } from "../fans/service.ts";

/** Invoked in A3's root-locked transaction after a sporting week has completed.
 * Does not move time, rewrite event dates or touch any sporting authority. */
export async function settleLifeCommitments(tx:CareerExecutor,root:{id:string;world_seed:string},season:number,week:number) {
  const due=(await tx.execute(sql`SELECT * FROM career_life_commitments WHERE career_save_id=${root.id}
    AND status='ACCEPTED' AND (season<${season} OR (season=${season} AND day<=${week*7})) ORDER BY season,day,id`)).rows;
  for(const c of due) {
    if(String(c.family)==="DARTCAST") {
      await tx.execute(sql`DELETE FROM career_life_commitments WHERE career_save_id=${root.id} AND id=${c.id} AND status='ACCEPTED'`);
      continue;
    }
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

  const products=(await tx.execute(sql`SELECT p.id,p.product_name,p.product_type,p.manufacturer,p.launch_season,d.design,c.id AS rights_contract_id,
      COALESCE((SELECT MIN(pe.week) FROM career_signature_product_events pe
        WHERE pe.career_save_id=p.career_save_id AND pe.draft_id=d.id AND pe.event_type='LAUNCHED'),1)::int launch_week
    FROM career_signature_products p
    JOIN career_signature_product_drafts d ON d.career_save_id=p.career_save_id AND d.product_id=p.id
    JOIN LATERAL (SELECT c.id FROM career_sponsor_contracts c WHERE c.career_save_id=p.career_save_id
      AND c.sponsor_key=p.manufacturer AND c.status='ACTIVE'
      AND c.terms->'contractFoundation'->'productRights'->'productTypes' ? p.product_type
      ORDER BY c.start_season DESC,c.start_week DESC,c.id LIMIT 1) c ON true
    WHERE p.career_save_id=${root.id} AND d.status='LAUNCHED' ORDER BY p.id`)).rows;
  const achievement=(await tx.execute(sql`SELECT COUNT(*) FILTER(WHERE r.is_champion AND i.classification<>'QUALIFIER')::int titles
    FROM career_event_results r JOIN career_event_instances i
      ON i.career_save_id=r.career_save_id AND i.id=r.event_id
    WHERE r.career_save_id=${root.id} AND r.participant_key='HUMAN' AND i.status='COMPLETED'
      AND i.season=${season} AND i.end_day<=${week*7}`)).rows[0];
  const ranking=(await tx.execute(sql`SELECT rr.position FROM career_ranking_snapshots rs
    JOIN career_ranking_snapshot_rows rr ON rr.career_save_id=rs.career_save_id AND rr.snapshot_id=rs.id
    WHERE rs.career_save_id=${root.id} AND rs.list_key='pro-world' AND rs.season=${season}
      AND rs.week<=${week} AND rr.participant_key='HUMAN'
    ORDER BY rs.week DESC,rs.id DESC LIMIT 1`)).rows[0];
  const fans=products.length?await fansForEffects(tx,root.id):null;
  for(const product of products) {
    const design=product.design as {limitedEdition?:boolean;editionSize?:number|null};
    const inventory=design?.limitedEdition&&Number.isInteger(design.editionSize)?Number(design.editionSize):null;
    const sold=inventory===null?0:Number((await tx.execute(sql`SELECT COALESCE(SUM(units),0)::int AS n FROM career_signature_product_sales
      WHERE career_save_id=${root.id} AND product_id=${product.id}`)).rows[0].n);
    if(inventory!==null&&sold>=inventory)continue;
    const promotion=Number((await tx.execute(sql`SELECT COUNT(*)::int n FROM career_sponsor_opportunities
      WHERE career_save_id=${root.id} AND sponsor_key=${String(product.manufacturer)} AND season=${season}
        AND opportunity_type='PRODUCT_LAUNCH' AND status='COMPLETED' AND scheduled_week<=${week}
        AND (season>${Number(product.launch_season)} OR
          (season=${Number(product.launch_season)} AND scheduled_week>=${Number(product.launch_week)}))`)).rows[0]?.n??0);
    const sale=calculateProductWeek(String(product.id),String(product.product_type) as "SIGNATURE_DARTS"|"SIGNATURE_RANGE",season,week,
      inventory===null?null:inventory-sold,{seasonTitles:Number(achievement?.titles??0),worldRank:ranking?Number(ranking.position):null,productLaunchPromotions:promotion,fans});
    const {units,grossPence,royaltyPence}=sale;
    if(units===0||royaltyPence===0)continue;
    const operationKey=`spg:sales:${product.id}:${season}:${week}`;
    const saved=await tx.execute(sql`INSERT INTO career_signature_product_sales(career_save_id,product_id,season,week,units,gross_pence,royalty_pence,operation_key,demand_version,demand_evidence)
      VALUES(${root.id},${product.id},${season},${week},${units},${grossPence},${royaltyPence},${operationKey},${sale.demandVersion},${JSON.stringify(sale.demandEvidence)}::jsonb)
      ON CONFLICT(career_save_id,product_id,season,week) DO NOTHING RETURNING product_id`);
    if(saved.rows.length)await post(tx,root,{operationKey,category:"MERCHANDISE_ROYALTY",amountPence:royaltyPence,
      reason:`${String(product.product_name)} signature-product royalties (${units} units sold)`,season,week,
      contractId:String(product.rights_contract_id),detail:{productId:String(product.id),units,grossPence,royaltyBasisPoints:800,
        demandVersion:sale.demandVersion,demandEvidence:sale.demandEvidence}});
  }
}
