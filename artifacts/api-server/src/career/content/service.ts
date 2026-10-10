import {sql} from "drizzle-orm";
import {z} from "zod";
import {Router,type Request,type Response,type NextFunction} from "express";
import type {} from "express-session";
import type {} from "pino-http";
import {authedWriteRateLimit} from "../../middleware/writeRateLimit.ts";
import type {CareerDatabase} from "../database.ts";
import {CareerError} from "../service.ts";
import {PRODUCT_ECONOMY} from "./product-economy.ts";
import {careerIdSchema} from "../validation.ts";
import {lockRoot,type CareerActor} from "../world/service.ts";
import {stableUuid} from "../world/random.ts";
import {npcShirt} from "./visual.ts";
import type {RootRow as CalendarRoot} from "../calendar/engine.ts";
import {assessCapability} from "../calendar/formats.ts";
type RootRow=CalendarRoot&{career_name?:string;player_database_version:number};
import type {CareerSportingService} from "../sporting/service.ts";
import {activeContracts} from "../finance/engine.ts";
import {relationship,conflicts,portfolioLimit} from "../finance/portfolio.ts";
import {evaluateRequirement,sponsorCatalogue,type SportingFacts} from "../finance/sponsors.catalogue.ts";
import {catalogueFor} from "../calendar/catalogue.ts";
import {LOCALITIES,localVenue} from "../calendar/geography.ts";
import {identity} from "./events.ts";
import {BRANDS,brandById} from "./brands.ts";
import {parseNpcSponsorSnapshot} from "../sponsorship/npc-foundation.ts";
import {COUNTRY_CONTENT,REGIONS,CITIES,VENUE_CONTENT,VENUE_FAMILIES,TROPHIES,ORGANISATIONS,CIRCUIT_CONTENT,
  SEASON_RHYTHM,PRESTIGE_CLASSES,GUIDE,ALMANAC,PRESENTATION_HOOKS,WORLD_CONTENT_VERSION,venueContent} from "./world.ts";

export const cosmeticSchema=z.object({
  nickname:z.string().trim().max(32).regex(/^[\p{L}\p{N} .'-]*$/u).nullable().optional(),
  shirtTemplate:z.enum(["CLASSIC","CHEVRON","SPLIT"]).optional(),
  kitDesignId:z.string().regex(/^kit-50-(?:0[1-9]|[1-4][0-9]|50)$/).optional(),
  kitTintEnabled:z.boolean().optional(),
  primaryColour:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColour:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColour:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  competitionCategory:z.enum(["OPEN","WOMEN"]).optional(),
}).strict();
export const signatureSchema=z.object({contractId:z.string().uuid(),productType:z.enum(["SIGNATURE_DARTS","SIGNATURE_RANGE"])}).strict();
const equipmentLoadoutSchema=z.object({
  dartWeight:z.number().min(18).max(30),barrel:z.enum(["STRAIGHT","TORPEDO","SCALLOPED","TAPERED"]),
  stem:z.enum(["SHORT","INTERMEDIATE","MEDIUM"]),flight:z.enum(["STANDARD","SLIM","KITE","NO2"]),
  flightPattern:z.enum(["SOLID","CHEVRON","GRID","RINGS"]),flightColour:z.string().regex(/^#[0-9a-fA-F]{6}$/),
  apparelColour:z.string().regex(/^#[0-9a-fA-F]{6}$/),
}).strict();
const productDraftSchema=z.object({
  contractId:z.string().uuid(),productType:z.enum(["SIGNATURE_DARTS","SIGNATURE_RANGE"]),
  name:z.string().trim().min(3).max(80),design:z.object({
    flightPattern:z.enum(["SOLID","CHEVRON","GRID","RINGS"]),
    colours:z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).length(2),
    limitedEdition:z.boolean(),editionSize:z.number().int().min(25).max(500).nullable(),
  }).strict(),
}).strict().superRefine((value,ctx)=>{
  if(value.design.limitedEdition===(value.design.editionSize===null))
    ctx.addIssue({code:"custom",path:["design","editionSize"],message:"Limited editions need a run size; open releases must not have one."});
});
const productPricePence=PRODUCT_ECONOMY.pricePence;
export const PRESENTATION_DEFAULTS={nickname:null,shirtTemplate:"CLASSIC",primaryColour:"#20334A",secondaryColour:"#FFFFFF",accentColour:"#C8A050"};
const placements:Record<string,string>={EQUIPMENT_PARTNER:"UPPER_CHEST",APPAREL_PARTNER:"SHOULDER",PRIMARY_COMMERCIAL:"CENTRAL_CHEST",SECONDARY_COMMERCIAL:"SLEEVE",LOCAL_REGIONAL_PARTNER:"SIDE_PANEL"};
function worldLocalities() {
  return LOCALITIES.map(({key,region,country,city})=>({key,region,country,city,
    venues:(["CLUB","COUNTY"] as const).map(kind=>venueContent(localVenue(key,kind).key))}));
}

/** NPC relationships are transparent content metadata. No contract payments or fabricated history. */
export function npcCommercial(seed:string,id:string,facts:SportingFacts) {
  const candidates=sponsorCatalogue(2).filter(d=>!d.terms.geographicPreference&&evaluateRequirement(d.offerRequirement,facts)===true)
    .sort((a,b)=>Number(relationship(b.terms).slot==="EQUIPMENT_PARTNER")-Number(relationship(a.terms).slot==="EQUIPMENT_PARTNER")||
      stableUuid(seed,1,"npc-brand-content",id,a.key).localeCompare(stableUuid(seed,1,"npc-brand-content",id,b.key)));
  const selected:{id:string;sponsor_key:string;terms:typeof candidates[number]["terms"]}[]=[];
  for(const d of candidates)if(selected.length<portfolioLimit(facts)&&!conflicts(d.terms,selected).length)
    selected.push({id:stableUuid(seed,1,"npc-brand-content",id,d.key),sponsor_key:d.key,terms:d.terms});
  return {source:"FACTUAL_STATURE_CONTENT_ALLOCATION",financialSimulation:false,contractHistoryInvented:false,
    portfolio:selected.map(c=>({id:c.id,brandId:c.sponsor_key,brandName:c.terms.displayName,...relationship(c.terms)})),
    signatureProductPossible: selected.some(c=>relationship(c.terms).slot==="EQUIPMENT_PARTNER")&&(facts.titles>=20||(facts.worldRanking!==null&&facts.worldRanking<=16))};
}
export function createCareerContentService(database:CareerDatabase,sporting:CareerSportingService) {
  async function presentation(actor:CareerActor,saveId:string) {
    return database.transaction(async tx=>{
      const root=await lockRoot(tx,actor,saveId,false) as RootRow;
      const contracts=await activeContracts(tx,saveId);
      const products=(await tx.execute(sql`SELECT p.*,c.status AS contract_status FROM career_signature_products p
        JOIN career_sponsor_contracts c ON c.career_save_id=p.career_save_id AND c.id=p.contract_id
        WHERE p.career_save_id=${saveId} ORDER BY launch_season,id`)).rows;
      return {careerSaveId:saveId,retired:root.status==="RETIRED",season:Number(root.current_season),week:Number(root.current_week),
        identity:{...PRESENTATION_DEFAULTS,...(root.settings_snapshot?.presentationIdentity as object??{}),competitionCategory:root.settings_snapshot?.competitionCategory??"OPEN"},
        canEdit:root.status==="ACTIVE"&&Number(root.current_week)===1,
        editWindow:"Season opening week; no age, scorer, ability, RNG or money changes",
        placements:contracts.map(c=>({contractId:c.id,brandId:c.sponsor_key,brandName:c.terms.displayName,slot:relationship(c.terms).slot,
          position:placements[relationship(c.terms).slot],themeKey:`brand:${c.sponsor_key}`})),
        products:products.map(p=>({id:String(p.id),participant:"HUMAN",manufacturer:String(p.manufacturer),name:String(p.product_name),
          type:String(p.product_type),launchSeason:Number(p.launch_season),contractId:String(p.contract_id),state:p.contract_status==="ACTIVE"&&root.status==="ACTIVE"?"ACTIVE":"LEGACY",
          abilityEffects:false,paymentAuthority:"A4",publicIdentityAuthority:"A7.5"})),
        productCandidates:contracts.filter(c=>relationship(c.terms).slot==="EQUIPMENT_PARTNER").map(c=>({contractId:c.id,manufacturer:c.sponsor_key,
          types:c.terms.contractFoundation?.productRights?.productTypes??[]})).filter(c=>c.types.length>0),
      };
    });
  }
  return {
    localities:worldLocalities,
    presentation,
    async guidance(actor:CareerActor,saveId:string) {
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId,false) as RootRow;
        const saved=root.settings_snapshot?.guidance as {mode?:string;dismissed?:string[]}|undefined;
        return {mode:saved?.mode??"STANDARD",dismissed:saved?.dismissed??[],canEdit:root.status==="ACTIVE"};
      });
    },
    async editGuidance(actor:CareerActor,saveId:string,body:unknown) {
      const input=z.object({mode:z.enum(["FULL","STANDARD","MINIMAL"]).optional(),dismiss:z.string().max(40).regex(/^[a-z-]+$/).optional()}).strict().parse(body);
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId) as RootRow;
        const prior=root.settings_snapshot?.guidance as {mode?:string;dismissed?:string[]}|undefined;
        const guidance={mode:input.mode??prior?.mode??"STANDARD",dismissed:[...new Set([...(prior?.dismissed??[]),...(input.dismiss?[input.dismiss]:[])])].slice(-32)};
        await tx.execute(sql`UPDATE career_saves SET settings_snapshot=${JSON.stringify({...root.settings_snapshot,guidance})}::jsonb WHERE id=${saveId}`);
        return guidance;
      });
    },
    async editPresentation(actor:CareerActor,saveId:string,body:unknown) {
      const input=cosmeticSchema.parse(body);
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId) as RootRow;
        if(Number(root.current_week)!==1)throw new CareerError(409,"Presentation/category edits are available in the season opening week");
        const {competitionCategory,...cosmetics}=input;
        const settings={...root.settings_snapshot,...(competitionCategory?{competitionCategory}:{}),
          presentationIdentity:{...PRESENTATION_DEFAULTS,...(root.settings_snapshot?.presentationIdentity as object??{}),...cosmetics}};
        await tx.execute(sql`UPDATE career_saves SET settings_snapshot=${JSON.stringify(settings)}::jsonb WHERE id=${saveId}`);
        return {updated:true,identity:settings.presentationIdentity,competitionCategory:settings.competitionCategory??"OPEN"};
      });
    },
    async equipmentStudio(actor:CareerActor,saveId:string) {
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId,false) as RootRow;
        const loadout=(await tx.execute(sql`SELECT loadout FROM career_equipment_loadouts WHERE career_save_id=${saveId}`)).rows[0];
        const drafts=(await tx.execute(sql`SELECT d.*,c.status AS contract_status,c.sponsor_key FROM career_signature_product_drafts d
          JOIN career_sponsor_contracts c ON c.career_save_id=d.career_save_id AND c.id=d.contract_id
          WHERE d.career_save_id=${saveId} ORDER BY d.created_at DESC LIMIT 30`)).rows;
        const events=(await tx.execute(sql`SELECT id,draft_id,event_type,season,week,details FROM career_signature_product_events
          WHERE career_save_id=${saveId} ORDER BY created_at DESC LIMIT 100`)).rows;
        const products=(await tx.execute(sql`SELECT p.id,p.product_name,p.product_type,p.manufacturer,p.launch_season,d.status AS product_status,
          holder.id AS rights_contract_id,COALESCE(SUM(s.units),0)::int units,
          COALESCE(SUM(s.gross_pence),0)::bigint gross_pence,COALESCE(SUM(s.royalty_pence),0)::bigint royalty_pence
          FROM career_signature_products p LEFT JOIN career_signature_product_drafts d ON d.career_save_id=p.career_save_id AND d.product_id=p.id
          LEFT JOIN LATERAL (SELECT c.id FROM career_sponsor_contracts c WHERE c.career_save_id=p.career_save_id AND c.sponsor_key=p.manufacturer
            AND c.status='ACTIVE' AND c.terms->'contractFoundation'->'productRights'->'productTypes' ? p.product_type
            ORDER BY c.start_season DESC,c.start_week DESC,c.id LIMIT 1) holder ON true
          LEFT JOIN career_signature_product_sales s ON s.career_save_id=p.career_save_id AND s.product_id=p.id
          WHERE p.career_save_id=${saveId} GROUP BY p.id,d.status,holder.id`)).rows;
        const active=await activeContracts(tx,saveId);
        const contracts=active.filter(c=>relationship(c.terms).slot==="EQUIPMENT_PARTNER");
        const apparelEndorsements=active.filter(c=>relationship(c.terms).slot==="APPAREL_PARTNER").map(c=>({brand:c.terms.displayName}));
        return {season:Number(root.current_season),week:Number(root.current_week),loadout:loadout?.loadout??null,
          contracts:contracts.map(c=>({id:c.id,brand:c.terms.displayName,rights:c.terms.contractFoundation?.productRights?.productTypes??[]})),
          apparelEndorsements,drafts:drafts.map(d=>({id:String(d.id),brand:String(d.sponsor_key),type:String(d.product_type),
            name:String(d.product_name),status:String(d.status),contractActive:d.contract_status==="ACTIVE"})),
          events:events.map(e=>({id:String(e.id),draftId:String(e.draft_id),type:String(e.event_type),details:e.details})),
          products:products.map(p=>({id:String(p.id),name:String(p.product_name),type:String(p.product_type),brand:String(p.manufacturer),
            status:p.product_status??(p.rights_contract_id?"ACTIVE":"LEGACY"),units:Number(p.units),grossPence:Number(p.gross_pence),royaltyPence:Number(p.royalty_pence)})),
          pricingPence:productPricePence,royaltyPercent:8,salesCapPerProductWeek:100,cosmeticOnly:true};
      });
    },
    async saveEquipmentLoadout(actor:CareerActor,saveId:string,body:unknown) {
      const loadout=equipmentLoadoutSchema.parse(body);
      await database.transaction(async tx=>{
        await lockRoot(tx,actor,saveId);
        await tx.execute(sql`INSERT INTO career_equipment_loadouts(career_save_id,loadout,updated_at)
          VALUES(${saveId},${JSON.stringify(loadout)}::jsonb,now()) ON CONFLICT(career_save_id)
          DO UPDATE SET loadout=EXCLUDED.loadout,updated_at=now()`);
      });
      return {saved:true,loadout};
    },
    async createProductDraft(actor:CareerActor,saveId:string,body:unknown) {
      const input=productDraftSchema.parse(body);
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId) as RootRow;
        const contract=(await activeContracts(tx,saveId)).find(c=>c.id===input.contractId);
        if(!contract||relationship(contract.terms).slot!=="EQUIPMENT_PARTNER"||
          !(contract.terms.contractFoundation?.productRights?.productTypes??[]).includes(input.productType))
          throw new CareerError(409,"An active equipment contract with this explicit signed product right is required");
        const id=stableUuid(root.world_seed,5,"spg-product-draft",input.contractId,input.productType,input.name,Number(root.current_season),Number(root.current_week));
        await tx.execute(sql`INSERT INTO career_signature_product_drafts(career_save_id,id,contract_id,product_type,product_name,design,status,season,week)
          VALUES(${saveId},${id},${input.contractId},${input.productType},${input.name},${JSON.stringify(input.design)}::jsonb,'DRAFT',${Number(root.current_season)},${Number(root.current_week)})
          ON CONFLICT(career_save_id,id) DO NOTHING`);
        await tx.execute(sql`INSERT INTO career_signature_product_events(career_save_id,id,draft_id,event_type,season,week,details)
          VALUES(${saveId},${stableUuid(root.world_seed,5,"spg-event",id,"CREATED")},${id},'CREATED',${Number(root.current_season)},${Number(root.current_week)},
            ${JSON.stringify({contractId:input.contractId,productType:input.productType})}::jsonb) ON CONFLICT DO NOTHING`);
        return {id,status:"DRAFT"};
      });
    },
    async approveProduct(actor:CareerActor,saveId:string,draftId:string) {
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId) as RootRow;
        const prior=(await tx.execute(sql`SELECT status FROM career_signature_product_drafts WHERE career_save_id=${saveId} AND id=${draftId} FOR UPDATE`)).rows[0];
        if(prior?.status==="APPROVED")return {id:draftId,status:"APPROVED"};
        const result=await tx.execute(sql`UPDATE career_signature_product_drafts d SET status='APPROVED',updated_at=now()
          WHERE d.career_save_id=${saveId} AND d.id=${draftId} AND d.status='DRAFT'
          AND EXISTS(SELECT 1 FROM career_sponsor_contracts c WHERE c.career_save_id=d.career_save_id AND c.id=d.contract_id
            AND c.status='ACTIVE' AND c.terms->'contractFoundation'->'productRights'->'productTypes' ? d.product_type) RETURNING d.id`);
        if(!result.rows.length)throw new CareerError(409,"Draft is not eligible under an active signed product right");
        await tx.execute(sql`INSERT INTO career_signature_product_events(career_save_id,id,draft_id,event_type,season,week)
          VALUES(${saveId},${stableUuid(root.world_seed,5,"spg-event",draftId,"APPROVED")},${draftId},'APPROVED',${Number(root.current_season)},${Number(root.current_week)}) ON CONFLICT DO NOTHING`);
        return {id:draftId,status:"APPROVED"};
      });
    },
    async launchProduct(actor:CareerActor,saveId:string,draftId:string) {
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId) as RootRow;
        const d=(await tx.execute(sql`SELECT d.*,c.status contract_status,c.sponsor_key,c.terms FROM career_signature_product_drafts d
          JOIN career_sponsor_contracts c ON c.career_save_id=d.career_save_id AND c.id=d.contract_id
          WHERE d.career_save_id=${saveId} AND d.id=${draftId} FOR UPDATE OF d`)).rows[0];
        if(d?.status==="LAUNCHED"&&d.product_id)return {id:String(d.product_id),status:"LAUNCHED"};
        if(!d||d.status!=="APPROVED"||d.contract_status!=="ACTIVE"||!((d.terms as any)?.contractFoundation?.productRights?.productTypes??[]).includes(d.product_type))
          throw new CareerError(409,"Only an approved draft with current signed rights can launch");
        const id=stableUuid(root.world_seed,5,"spg-product",draftId);
        await tx.execute(sql`INSERT INTO career_signature_products(career_save_id,id,participant_key,product_type,manufacturer,product_name,contract_id,launch_season,evidence)
          VALUES(${saveId},${id},'HUMAN',${d.product_type},${d.sponsor_key},${d.product_name},${d.contract_id},${Number(root.current_season)},
            ${JSON.stringify({spgVersion:1,draftId,design:d.design,rightsSnapshot:(d.terms as any).contractFoundation.productRights,royaltyPercent:8})}::jsonb)
          ON CONFLICT(career_save_id,id) DO NOTHING`);
        await tx.execute(sql`UPDATE career_signature_product_drafts SET status='LAUNCHED',product_id=${id},updated_at=now()
          WHERE career_save_id=${saveId} AND id=${draftId} AND status='APPROVED'`);
        await tx.execute(sql`INSERT INTO career_signature_product_events(career_save_id,id,draft_id,event_type,season,week,details)
          VALUES(${saveId},${stableUuid(root.world_seed,5,"spg-event",draftId,"LAUNCHED")},${draftId},'LAUNCHED',${Number(root.current_season)},${Number(root.current_week)},${JSON.stringify({productId:id})}::jsonb) ON CONFLICT DO NOTHING`);
        return {id,status:"LAUNCHED"};
      });
    },
    async retireProduct(actor:CareerActor,saveId:string,draftId:string) {
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId) as RootRow;
        const result=await tx.execute(sql`UPDATE career_signature_product_drafts SET status='RETIRED',updated_at=now()
          WHERE career_save_id=${saveId} AND id=${draftId} AND status='LAUNCHED' RETURNING id`);
        if(!result.rows.length) {
          const prior=(await tx.execute(sql`SELECT status FROM career_signature_product_drafts WHERE career_save_id=${saveId} AND id=${draftId}`)).rows[0];
          if(prior?.status==="RETIRED")return {id:draftId,status:"RETIRED"};
          throw new CareerError(409,"Only a launched product can be retired");
        }
        await tx.execute(sql`INSERT INTO career_signature_product_events(career_save_id,id,draft_id,event_type,season,week)
          VALUES(${saveId},${stableUuid(root.world_seed,5,"spg-event",draftId,"RETIRED")},${draftId},'RETIRED',${Number(root.current_season)},${Number(root.current_week)}) ON CONFLICT DO NOTHING`);
        return {id:draftId,status:"RETIRED"};
      });
    },
    async launchSignature(actor:CareerActor,saveId:string,body:unknown) {
      const input=signatureSchema.parse(body);
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId) as RootRow;
        const contract=(await activeContracts(tx,saveId)).find(c=>c.id===input.contractId);
        if(!contract||relationship(contract.terms).slot!=="EQUIPMENT_PARTNER"||
          !(contract.terms.contractFoundation?.productRights?.productTypes??[]).includes(input.productType))
          throw new CareerError(409,"An active equipment agreement with the explicit signed product right is required");
        const id=stableUuid(root.world_seed,5,"spg-compat-draft",contract.id,input.productType,Number(root.current_season),Number(root.current_week));
        const name=`${String(root.career_name??"Career Player").slice(0,48)} — ${contract.terms.displayName} ${input.productType==="SIGNATURE_DARTS"?"Signature Darts":"Signature Range"}`;
        const design={flightPattern:"SOLID",colours:["#f4c542","#101820"],limitedEdition:false,editionSize:null};
        await tx.execute(sql`INSERT INTO career_signature_product_drafts(career_save_id,id,contract_id,product_type,product_name,design,status,season,week)
          VALUES(${saveId},${id},${contract.id},${input.productType},${name},${JSON.stringify(design)}::jsonb,'DRAFT',
            ${Number(root.current_season)},${Number(root.current_week)}) ON CONFLICT(career_save_id,id) DO NOTHING`);
        await tx.execute(sql`INSERT INTO career_signature_product_events(career_save_id,id,draft_id,event_type,season,week,details)
          VALUES(${saveId},${stableUuid(root.world_seed,5,"spg-event",id,"CREATED")},${id},'CREATED',${Number(root.current_season)},${Number(root.current_week)},
            ${JSON.stringify({productType:input.productType,contractId:contract.id})}::jsonb) ON CONFLICT DO NOTHING`);
        return {id,created:true,status:"DRAFT"};
      });
    },
    async read(actor:CareerActor,saveId:string) {
      const root=await database.transaction(async tx=>await lockRoot(tx,actor,saveId,false) as RootRow);
      return {version:WORLD_CONTENT_VERSION,eventDatabaseVersion:Number(root.event_database_version),playerDatabaseVersion:Number(root.player_database_version),
        organisations:ORGANISATIONS,circuits:CIRCUIT_CONTENT,countries:COUNTRY_CONTENT,regions:REGIONS,cities:CITIES,venues:VENUE_CONTENT,
        venueFamilies:VENUE_FAMILIES,trophies:TROPHIES,brands:BRANDS,seasonRhythm:SEASON_RHYTHM,prestigeClasses:PRESTIGE_CLASSES,
        guide:GUIDE,almanac:ALMANAC,audioHooks:PRESENTATION_HOOKS,audioAssetsGenerated:false,
        eventFamilies:catalogueFor(Number(root.event_database_version)).map(d=>({id:d.key,name:d.name,family:d.family,circuit:d.circuit,
          ...identity(d),...(d.content??{}),titleSponsorId:d.content?.titleSponsorId??null,formatKind:d.format.structure,seedingPolicy:d.seedingPolicy,eligibility:d.eligibility,
          supported:assessCapability(d.format,d.eventDatabaseVersion>=4).executable,longevity:d.content?.longevity??"RECURRING"}))};
    },
    async map(actor:CareerActor,saveId:string,query:unknown={}) {
      const q=z.object({scope:z.enum(["WORLD","REGION","LOCAL"]).default("WORLD"),country:z.string().max(3).optional(),
        region:z.string().max(100).optional(),city:z.string().max(100).optional(),fromWeek:z.coerce.number().int().min(1).max(52).default(1),
        toWeek:z.coerce.number().int().min(1).max(52).default(52)}).strict().refine(v=>v.toWeek>=v.fromWeek).parse(query);
      const calendar=await sporting.calendar.calendar(actor,saveId,{scope:"WORLD",fromWeek:q.fromWeek,toWeek:q.toWeek});
      const qualification=await sporting.qualification(actor,saveId,{fromWeek:q.fromWeek,weeks:q.toWeek-q.fromWeek+1});
      const root=await database.transaction(async tx=>await lockRoot(tx,actor,saveId,false) as RootRow);
      const home=sporting.calendar.providers.sportingStatus.human(root);
      const locality=LOCALITIES.find(l=>l.key===home.locality);
      const events=calendar.events.filter(e=>(!q.country||e.venue.country===q.country)&&(!q.region||e.venue.region===q.region)&&(!q.city||e.venue.city===q.city)&&
        (q.scope!=="REGION"||(e.venue.country===(q.country??home.country)&&e.venue.region===(q.region??locality?.region)))&&
        (q.scope!=="LOCAL"||(e.venue.country===(q.country??home.country)&&e.venue.city===(q.city??locality?.city))));
      return {season:calendar.season,scope:q.scope,home:{country:home.country,region:locality?.region??null,city:locality?.city??null},
        fromWeek:q.fromWeek,toWeek:q.toWeek,total:events.length,
        events:events.map(e=>({id:e.id,name:e.name,definitionId:e.definitionKey,canonicalEventId:e.content?.canonicalEventId??e.definitionKey,
          venue:venueContent(e.venue.key),dates:e.dates,status:e.status,content:e.content??{...identity(catalogueFor(e.eventDatabaseVersion).find(d=>d.key===e.definitionKey)!),titleSponsorId:null},
          opportunity:e.opportunity,financialCommitment:e.finance,qualification:qualification.season===calendar.season?qualification.events.find(x=>x.eventId===e.id)??null:null,
          fieldDescriptor:e.content?.fieldDescription??identity(catalogueFor(e.eventDatabaseVersion).find(d=>d.key===e.definitionKey)!).fieldDescription,
          seeding:e.seedingPolicy,field:e.field,capability:e.capability}))};
    },
    async players(actor:CareerActor,saveId:string,query:unknown={}) {
      const q=z.object({offset:z.coerce.number().int().min(0).default(0),limit:z.coerce.number().int().min(1).max(100).default(50),
        search:z.string().trim().max(80).default(""),status:z.enum(["ALL","ACTIVE","RETIRED"]).default("ALL"),id:z.string().uuid().optional()}).strict().parse(query);
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId,false) as RootRow;
        const filter=sql`p.career_save_id=${saveId} AND (${q.id??null}::uuid IS NULL OR p.id=${q.id??null}::uuid) AND (${q.status}='ALL' OR p.status=${q.status})
          AND (${q.search}='' OR strpos(lower(concat_ws(' ',p.first_name,p.surname,p.nickname,p.nationality)),lower(${q.search}))>0)`;
        const count=Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_world_players p WHERE ${filter}`)).rows[0].n);
        const rows=(await tx.execute(sql`SELECT p.id,p.first_name,p.surname,p.nickname,p.nationality,p.home_region,p.status,p.world_key,
          (SELECT COUNT(*)::int FROM career_event_results r JOIN career_event_instances i ON i.career_save_id=r.career_save_id AND i.id=r.event_id
            WHERE r.career_save_id=p.career_save_id AND r.participant_key=p.id::text AND r.is_champion AND i.classification<>'QUALIFIER') AS titles,
          EXISTS(SELECT 1 FROM career_tour_cards c WHERE c.career_save_id=p.career_save_id AND c.participant_key=p.id::text AND c.status='ACTIVE'
            AND c.start_season<=${Number(root.current_season)} AND c.end_season>=${Number(root.current_season)}) AS tour_card,
          (SELECT current_position FROM career_ranking_participants r WHERE r.career_save_id=p.career_save_id AND r.participant_key=p.id::text AND r.list_key='pro-world') AS position
          FROM career_world_players p WHERE ${filter} ORDER BY p.first_name,p.surname,p.id LIMIT ${q.limit} OFFSET ${q.offset}`)).rows;
        const foundation=(await tx.execute(sql`SELECT content_version,generation_version FROM career_sponsor_world_state WHERE career_save_id=${saveId}`)).rows[0];
        const npcIds=rows.map(p=>String(p.id));
        const sponsorRows=npcIds.length?(await tx.execute(sql`SELECT id,npc_id,sponsor_key,category,representative_id,status,
          start_season,start_week,end_season,end_week,sponsor_snapshot FROM career_npc_sponsor_relationships
          WHERE career_save_id=${saveId} AND npc_id IN (${sql.join(npcIds.map(id=>sql`${id}::uuid`),sql`, `)})
          ORDER BY npc_id,start_season,start_week,id`)).rows:[];
        const sponsorHistory=new Map<string,Record<string,unknown>[]>();
        for(const row of sponsorRows){
          const npcId=String(row.npc_id),snapshot=parseNpcSponsorSnapshot(row.sponsor_snapshot);
          const history=sponsorHistory.get(npcId)??[];
          history.push({id:String(row.id),sponsorKey:String(row.sponsor_key),category:String(row.category),
            representativeId:row.representative_id===null?null:String(row.representative_id),status:String(row.status),
            start:{season:Number(row.start_season),week:Number(row.start_week)},
            end:row.end_season===null?null:{season:Number(row.end_season),week:Number(row.end_week)},sponsor:snapshot});
          sponsorHistory.set(npcId,history);
        }
        return {total:count,nextOffset:q.offset+rows.length<count?q.offset+rows.length:null,players:rows.map(p=>({id:String(p.id),name:`${p.first_name} ${p.surname}`,
          nickname:p.nickname,country:p.nationality,region:p.home_region,status:p.status,ranking:p.position===null?null:Number(p.position),
          shirt:npcShirt(String(p.id)),womenEligible:String(p.world_key).startsWith("women:"),
          historyRoute:`history/npcs/${p.id}`,relationshipsRoute:"relationships",generationalAuthority:"A7.2",
          sponsorshipFoundation:foundation?{source:"PERSISTED_SP_A",contentVersion:Number(foundation.content_version),
            generationVersion:Number(foundation.generation_version),relationships:sponsorHistory.get(String(p.id))??[]}:
            {source:"LEGACY_CONTENT_ONLY",contentVersion:null,generationVersion:null,relationships:[]},
          commercial:npcCommercial(root.world_seed,String(p.id),{careerStarted:true,titles:Number(p.titles),professionalStatus:p.tour_card?"PROFESSIONAL":"AMATEUR",
            tourCard:Boolean(p.tour_card),worldRanking:p.position===null?null:Number(p.position),qualifications:[],bestFinishByCircuit:{}})}))};
      });
    },
    async trophies(actor:CareerActor,saveId:string,query:unknown={}) {
      const q=z.object({offset:z.coerce.number().int().min(0).default(0),limit:z.coerce.number().int().min(1).max(100).default(50)}).strict().parse(query);
      return database.transaction(async tx=>{
        await lockRoot(tx,actor,saveId,false);
        const total=Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_event_results WHERE career_save_id=${saveId}
          AND participant_key='HUMAN' AND is_champion`)).rows[0].n);
        const rows=(await tx.execute(sql`SELECT r.event_id,i.name,i.season,i.definition_key,i.event_database_version,i.classification,i.circuit,i.snapshot,i.venue_key
          FROM career_event_results r JOIN career_event_instances i ON i.career_save_id=r.career_save_id AND i.id=r.event_id
          WHERE r.career_save_id=${saveId} AND r.participant_key='HUMAN' AND r.is_champion ORDER BY i.season DESC,i.end_day DESC,i.id
          LIMIT ${q.limit} OFFSET ${q.offset}`)).rows;
        return {total,nextOffset:q.offset+rows.length<total?q.offset+rows.length:null,authority:"A3 immutable champion results",titles:rows.map(r=>{
          const snapshot=r.snapshot as {content?:ReturnType<typeof identity>};
          const definition=catalogueFor(Number(r.event_database_version)).find(d=>d.key===r.definition_key);
          const meta=snapshot.content??(definition?identity(definition):null),design=TROPHIES.find(t=>t.id===meta?.trophyId);
          return {eventId:String(r.event_id),canonicalEventId:meta?.canonicalEventId??String(r.definition_key),name:String(r.name),
            season:Number(r.season),classification:String(r.classification),circuit:String(r.circuit),trophyIdentityId:meta?.trophyIdentity?.id??`trophy:${r.definition_key}`,
            trophy:design??null,venue:venueContent(String(r.venue_key)),source:"ACTUAL_A3_CHAMPION_RESULT"};
        })};
      });
    },
  };
}
export type CareerContentService=ReturnType<typeof createCareerContentService>;
export type WorldContent=Awaited<ReturnType<CareerContentService["read"]>>;
export type WorldLocalitiesContent=ReturnType<CareerContentService["localities"]>;
export type MapContent=Awaited<ReturnType<CareerContentService["map"]>>;
export type PresentationContent=Awaited<ReturnType<CareerContentService["presentation"]>>;
export type WorldPlayersContent=Awaited<ReturnType<CareerContentService["players"]>>;
export type TrophyContent=Awaited<ReturnType<CareerContentService["trophies"]>>;
export function createCareerContentRouter(service:CareerContentService) {
  const router=Router();
  const auth=(req:Request,res:Response,next:NextFunction)=>{
    res.set("Cache-Control","no-store");const s=req.session as {playerId?:number;isAdmin?:boolean}|undefined;
    if(!Number.isSafeInteger(s?.playerId)||(s?.playerId??0)<=0){res.status(401).json({error:"Authentication required"});return;}
    res.locals.careerActor={playerId:s!.playerId!,isAdmin:s?.isAdmin===true};next();
  };
  const id=(req:Request)=>careerIdSchema.parse(String(req.params.id));
  router.get("/saves/:id/world-content",auth,async(req,res)=>res.json(await service.read(res.locals.careerActor,id(req))));
  router.get("/saves/:id/world-localities",auth,(req,res)=>{id(req);res.json(service.localities());});
  router.get("/saves/:id/guidance",auth,async(req,res)=>res.json(await service.guidance(res.locals.careerActor,id(req))));
  router.put("/saves/:id/guidance",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.editGuidance(res.locals.careerActor,id(req),req.body)));
  router.get("/saves/:id/world-map",auth,async(req,res)=>res.json(await service.map(res.locals.careerActor,id(req),req.query)));
  router.get("/saves/:id/world-players",auth,async(req,res)=>res.json(await service.players(res.locals.careerActor,id(req),req.query)));
  router.get("/saves/:id/trophy-cabinet",auth,async(req,res)=>res.json(await service.trophies(res.locals.careerActor,id(req),req.query)));
  router.get("/saves/:id/presentation",auth,async(req,res)=>res.json(await service.presentation(res.locals.careerActor,id(req))));
  router.post("/saves/:id/presentation",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.editPresentation(res.locals.careerActor,id(req),req.body)));
  router.post("/saves/:id/signature-products",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.launchSignature(res.locals.careerActor,id(req),req.body)));
  router.get("/saves/:id/equipment-studio",auth,async(req,res)=>res.json(await service.equipmentStudio(res.locals.careerActor,id(req))));
  router.put("/saves/:id/equipment-loadout",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.saveEquipmentLoadout(res.locals.careerActor,id(req),req.body)));
  router.post("/saves/:id/signature-product-drafts",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.createProductDraft(res.locals.careerActor,id(req),req.body)));
  router.post("/saves/:id/signature-product-drafts/:draftId/approve",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.approveProduct(res.locals.careerActor,id(req),String(req.params.draftId))));
  router.post("/saves/:id/signature-product-drafts/:draftId/launch",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.launchProduct(res.locals.careerActor,id(req),String(req.params.draftId))));
  router.post("/saves/:id/signature-product-drafts/:draftId/retire",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.retireProduct(res.locals.careerActor,id(req),String(req.params.draftId))));
  router.get("/saves/:id/equipment-studio",auth,async(req,res)=>res.json(await service.equipmentStudio(res.locals.careerActor,id(req))));
  router.put("/saves/:id/equipment-loadout",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.saveEquipmentLoadout(res.locals.careerActor,id(req),req.body)));
  router.post("/saves/:id/signature-product-drafts",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.createProductDraft(res.locals.careerActor,id(req),req.body)));
  router.post("/saves/:id/signature-product-drafts/:draftId/approve",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.approveProduct(res.locals.careerActor,id(req),String(req.params.draftId))));
  router.post("/saves/:id/signature-product-drafts/:draftId/launch",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.launchProduct(res.locals.careerActor,id(req),String(req.params.draftId))));
  router.post("/saves/:id/signature-product-drafts/:draftId/retire",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.retireProduct(res.locals.careerActor,id(req),String(req.params.draftId))));
  router.use((err:unknown,req:Request,res:Response,_next:NextFunction)=>{
    if(err instanceof CareerError)res.status(err.status).json({error:err.message});
    else if(err instanceof z.ZodError)res.status(400).json({error:"Invalid Career content request"});
    else{req.log?.error({err},"Career content request failed");res.status(500).json({error:"Career content request failed"});}
  });return router;
}
