import {sql} from "drizzle-orm";
import {z} from "zod";
import {Router,type Request,type Response,type NextFunction} from "express";
import type {} from "express-session";
import type {} from "pino-http";
import {authedWriteRateLimit} from "../../middleware/writeRateLimit.ts";
import type {CareerDatabase} from "../database.ts";
import {CareerError} from "../service.ts";
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
import {LOCALITIES} from "../calendar/geography.ts";
import {identity} from "./events.ts";
import {BRANDS,brandById} from "./brands.ts";
import {COUNTRY_CONTENT,REGIONS,CITIES,VENUE_CONTENT,VENUE_FAMILIES,TROPHIES,ORGANISATIONS,CIRCUIT_CONTENT,
  SEASON_RHYTHM,PRESTIGE_CLASSES,GUIDE,ALMANAC,PRESENTATION_HOOKS,WORLD_CONTENT_VERSION,venueContent} from "./world.ts";

export const cosmeticSchema=z.object({
  nickname:z.string().trim().max(32).regex(/^[\p{L}\p{N} .'-]*$/u).nullable().optional(),
  shirtTemplate:z.enum(["CLASSIC","CHEVRON","SPLIT"]).optional(),
  primaryColour:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColour:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColour:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  competitionCategory:z.enum(["OPEN","WOMEN"]).optional(),
}).strict();
export const signatureSchema=z.object({contractId:z.string().uuid(),productType:z.enum(["SIGNATURE_DARTS","SIGNATURE_RANGE"])}).strict();
export const PRESENTATION_DEFAULTS={nickname:null,shirtTemplate:"CLASSIC",primaryColour:"#20334A",secondaryColour:"#FFFFFF",accentColour:"#C8A050"};
const placements:Record<string,string>={EQUIPMENT_PARTNER:"UPPER_CHEST",APPAREL_PARTNER:"SHOULDER",PRIMARY_COMMERCIAL:"CENTRAL_CHEST",SECONDARY_COMMERCIAL:"SLEEVE",LOCAL_REGIONAL_PARTNER:"SIDE_PANEL"};

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
      const merch=(await tx.execute(sql`SELECT category,active FROM career_life_merchandise WHERE career_save_id=${saveId}`)).rows[0];
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
          types:brandById(c.sponsor_key)?.signatureProductSupport??[],hasCommercialAgreement:merch?.active===true})),
      };
    });
  }
  return {
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
    async launchSignature(actor:CareerActor,saveId:string,body:unknown) {
      const input=signatureSchema.parse(body);
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId) as RootRow;
        const contract=(await activeContracts(tx,saveId)).find(c=>c.id===input.contractId);
        if(!contract||relationship(contract.terms).slot!=="EQUIPMENT_PARTNER"||
          !brandById(contract.sponsor_key)?.signatureProductSupport.includes(input.productType))throw new CareerError(409,"A compatible active equipment contract is required");
        const existing=(await tx.execute(sql`SELECT id FROM career_signature_products WHERE career_save_id=${saveId}
          AND contract_id=${input.contractId} AND product_type=${input.productType}`)).rows[0];
        if(existing)return {id:String(existing.id),created:false};
        const merch=(await tx.execute(sql`SELECT category,active FROM career_life_merchandise WHERE career_save_id=${saveId}`)).rows[0];
        const facts=await sporting.factsProvider.facts(tx,root);
        const commercialIncome=Number((await tx.execute(sql`SELECT COALESCE(SUM(amount_pence),0)::bigint AS n FROM career_finance_entries
          WHERE career_save_id=${saveId} AND category IN ('MERCHANDISE_ROYALTY','COMMERCIAL_APPEARANCE')`)).rows[0].n);
        const sportingDemand=facts.titles>=10||(facts.worldRanking!==null&&facts.worldRanking<=16);
        const rangeDemand=(facts.titles>=20||(facts.worldRanking!==null&&facts.worldRanking<=16))&&commercialIncome>=100000;
        if(!merch?.active||!sportingDemand||(input.productType==="SIGNATURE_RANGE"&&!rangeDemand))
          throw new CareerError(409,"Signature products require established sporting achievement and an active A7.5 merchandise agreement; a range also needs £1,000 recorded A4 commercial income");
        const id=stableUuid(root.world_seed,1,"signature-product",contract.id,input.productType);
        const name=`${String(root.career_name??"Career Player").slice(0,80)} — ${contract.terms.displayName} ${input.productType==="SIGNATURE_DARTS"?"Signature Darts":"Signature Range"}`;
        await tx.execute(sql`INSERT INTO career_signature_products (career_save_id,id,participant_key,product_type,manufacturer,product_name,contract_id,launch_season,evidence)
          VALUES (${saveId},${id},'HUMAN',${input.productType},${contract.sponsor_key},${name},${contract.id},${Number(root.current_season)},
          ${JSON.stringify({facts,merchandiseCategory:merch.category,commercialIncomePence:commercialIncome,contentVersion:WORLD_CONTENT_VERSION})}::jsonb)`);
        return {id,created:true};
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
        return {total:count,nextOffset:q.offset+rows.length<count?q.offset+rows.length:null,players:rows.map(p=>({id:String(p.id),name:`${p.first_name} ${p.surname}`,
          nickname:p.nickname,country:p.nationality,region:p.home_region,status:p.status,ranking:p.position===null?null:Number(p.position),
          shirt:npcShirt(String(p.id)),womenEligible:String(p.world_key).startsWith("women:"),
          historyRoute:`history/npcs/${p.id}`,relationshipsRoute:"relationships",generationalAuthority:"A7.2",
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
  router.get("/saves/:id/guidance",auth,async(req,res)=>res.json(await service.guidance(res.locals.careerActor,id(req))));
  router.put("/saves/:id/guidance",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.editGuidance(res.locals.careerActor,id(req),req.body)));
  router.get("/saves/:id/world-map",auth,async(req,res)=>res.json(await service.map(res.locals.careerActor,id(req),req.query)));
  router.get("/saves/:id/world-players",auth,async(req,res)=>res.json(await service.players(res.locals.careerActor,id(req),req.query)));
  router.get("/saves/:id/trophy-cabinet",auth,async(req,res)=>res.json(await service.trophies(res.locals.careerActor,id(req),req.query)));
  router.get("/saves/:id/presentation",auth,async(req,res)=>res.json(await service.presentation(res.locals.careerActor,id(req))));
  router.post("/saves/:id/presentation",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.editPresentation(res.locals.careerActor,id(req),req.body)));
  router.post("/saves/:id/signature-products",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.launchSignature(res.locals.careerActor,id(req),req.body)));
  router.use((err:unknown,req:Request,res:Response,_next:NextFunction)=>{
    if(err instanceof CareerError)res.status(err.status).json({error:err.message});
    else if(err instanceof z.ZodError)res.status(400).json({error:"Invalid Career content request"});
    else{req.log?.error({err},"Career content request failed");res.status(500).json({error:"Career content request failed"});}
  });return router;
}
