import {test} from "node:test";
import assert from "node:assert/strict";
import {generateSeason,calendarHashOf} from "../../career/calendar/generation.ts";
import {catalogueFor} from "../../career/calendar/catalogue.ts";
import {R,evaluateRule,type ParticipantFacts} from "../../career/calendar/eligibility.ts";
import {generateInitialWorld,generateWomenCohort} from "../../career/world/generation.ts";
import {geographicalIdentities} from "../../career/world/geographical-identities.ts";
import {stableUuid} from "../../career/world/random.ts";
import {VENUE_CONTENT,VENUE_FAMILIES,TROPHIES,GUIDE,ORGANISATIONS,CIRCUIT_CONTENT,CITIES,venueContent} from "../../career/content/world.ts";
import {CORE_BRANDS,LOCAL_SPONSORS} from "../../career/content/brands.ts";
import {npcCommercial,cosmeticSchema} from "../../career/content/service.ts";
import {opportunity} from "../../career/content/opportunities.ts";
import {portfolioLimit,conflicts,relationship} from "../../career/finance/portfolio.ts";
import {SPONSOR_CATALOGUE_V1,sponsorCatalogue,type SportingFacts} from "../../career/finance/sponsors.catalogue.ts";
import {portfolioCoverage,type ContractRow} from "../../career/finance/engine.ts";
import {rankingListsFor} from "../../career/sporting/config.ts";
const seed="a".repeat(64),season=generateSeason(seed,3,1);
const facts:SportingFacts={careerStarted:true,titles:20,tourCard:true,professionalStatus:"PROFESSIONAL",worldRanking:8,bestFinishByCircuit:{},qualifications:[]};
const terms=(key:string)=>sponsorCatalogue(2).find(s=>s.key===key)!.terms;
const contract=(key:string):ContractRow=>({id:key,offer_id:key,sponsor_key:key,tier:terms(key).tier,terms:terms(key),start_season:1,start_week:1,end_season:2,end_week:52,status:"ACTIVE"});
test("v1/v2 seasons are byte-identical to mandatory checkpoint, not a regenerated baseline",()=>{
  const hashes=["6bba3b777e1ed7431c89c23154f1a789be8504489579ef1f73699549cacc1484","c4b9f19f7fedaaada82756a5c87fe7154fd192bf78eb7d4688e65bb1064759e2",
    "993a953fc277faa3592b74f8d9805896028b83330972ef0e7be2f0bf4ca78c4e","8d84fafbaca3b872859f2fc5691d0a77a3f9d663a474e86764bcc47866b78f4d"];
  assert.deepEqual([1,2].flatMap(v=>[1,2].map(s=>calendarHashOf(generateSeason(seed,v,s)))),hashes);
});
test("original A2 population remains checkpoint-identical; new names do not touch abilities or IDs",()=>{
  const original=generateInitialWorld(seed,1);
  assert.equal(calendarHashOf(original),"a3f571b8c808090a79c98b3d5aaaf4ab5b386aca87ec8ea15321f083ba57e8cb");
  const people=geographicalIdentities(seed,original);
  assert.deepEqual(people,geographicalIdentities(seed,original));
  for(let i=0;i<people.length;i++){assert.equal(people[i].id,original[i].id);assert.deepEqual(people[i].ability,original[i].ability);assert.deepEqual(people[i].development,original[i].development);}
  assert.equal(new Set(people.map(p=>`${p.firstName} ${p.surname}`)).size,people.length);
  assert.ok(people.some(p=>p.nationality==="JPN"));assert.ok(people.some(p=>p.homeRegion==="Greater Glasgow/Clyde"));
});
test("women's cohort is ordinary A2 population, with country-aware identities and no separate sim",()=>{
  const original=generateInitialWorld(seed,1),women=generateWomenCohort(seed,1,1,80,original);
  assert.equal(women.length,80);assert.ok(women.every(p=>p.worldKey.startsWith("women:")));
  const named=geographicalIdentities(seed,women,original);
  assert.equal(new Set(named.map(p=>p.id)).size,80);
  assert.equal(named[0].id,women[0].id);assert.deepEqual(named[0].ability,women[0].ability);
});
test("crowded country-aware pools extend deterministically without numeric or duplicate names",()=>{
  const example=generateInitialWorld(seed,1).find(p=>!p.templateKey)!;
  const input=Array.from({length:5000},(_,i)=>({...example,id:stableUuid(seed,1,"name-pool-fixture",i),worldKey:`crowded:${i}`}));
  const names=geographicalIdentities(seed,input).map(p=>`${p.firstName} ${p.surname}`);
  assert.equal(new Set(names).size,names.length);assert.ok(names.every(n=>!/\d/.test(n)));
  assert.deepEqual(names,geographicalIdentities(seed,input).map(p=>`${p.firstName} ${p.surname}`));
});
test("authored counts, hierarchy and complete map anchors",()=>{
  assert.equal(ORGANISATIONS.length,4);assert.equal(CIRCUIT_CONTENT.length,22);
  assert.equal(VENUE_CONTENT.length,60);assert.equal(VENUE_FAMILIES.length,15);assert.equal(TROPHIES.length,18);
  assert.equal(CORE_BRANDS.length,36);assert.equal(LOCAL_SPONSORS.length,16);
  assert.ok(CITIES.every(c=>Number.isFinite(c.mapAnchor.latitude)&&Number.isFinite(c.mapAnchor.longitude)));
  for(const e of season)assert.ok(venueContent(e.venueKey).mapAnchor);
});
test("new circuit volume, real date collisions and bounded field sizes",()=>{
  const count=(key:string)=>season.filter(e=>e.definitionKey===key).length;
  assert.equal(count("vault-tour"),14);assert.equal(count("vault-nights"),5);assert.equal(count("vault-championship"),1);
  assert.equal(count("challenger-event"),20);assert.equal(count("pro-circuit-championship"),28);assert.equal(count("european-dart-series"),12);
  assert.equal(count("world-dart-series"),6);assert.equal(count("women-tour"),18);assert.equal(count("development-tour"),12);
  assert.ok(season.some(e=>e.startDay===season.find(x=>x.definitionKey==="women-tour")!.startDay&&e.definitionKey!=="women-tour"));
  assert.ok(season.every(e=>e.startDay>=1&&e.endDay<=364&&e.fieldSize<=128));
});
test("pinnacles, Sovereign, Palace and Double Crown retain distinct identities",()=>{
  const palace=season.find(e=>e.definitionKey==="world-darts-championship")!;
  assert.equal(palace.venueKey,"the-palace-london");assert.equal(palace.snapshot.content!.venue!.displayName,"Alexandra Grand Hall");
  assert.equal(palace.snapshot.content!.trophyId,"sovereign");assert.equal(palace.snapshot.format.scoringUnit,"SETS");
  const crown=season.find(e=>e.definitionKey==="double-crown")!;
  assert.equal(crown.snapshot.format.inRule,"DOUBLE");assert.equal(crown.snapshot.format.outRule,"DOUBLE");
  assert.equal(crown.snapshot.content!.canonicalEventId,"double-crown");
  const next=generateSeason(seed,3,2).find(e=>e.definitionKey==="world-darts-championship")!;
  assert.equal(next.snapshot.content!.canonicalEventId,palace.snapshot.content!.canonicalEventId);
});
test("rotating minor venues preserve canonical identity; published seasons remain deterministic",()=>{
  const old=season.filter(e=>e.definitionKey==="international-open"),next=generateSeason(seed,3,2).filter(e=>e.definitionKey==="international-open");
  assert.notEqual(old[0].venueKey,next[0].venueKey);assert.equal(old[0].snapshot.content!.canonicalEventId,next[0].snapshot.content!.canonicalEventId);
  assert.deepEqual(season,generateSeason(seed,3,1));
});
test("women's eligibility only restricts dedicated women events; open remains open",()=>{
  const p:ParticipantFacts={key:"HUMAN",kind:"HUMAN",country:"GBR",zone:"UK_IRELAND",locality:"ayrshire",professionalStatus:"AMATEUR",tourCard:false,
    rankings:{},entitlementTargets:new Set(),invited:false,results:{SAME:new Map(),PREVIOUS:new Map()},defendingChampion:false,age:20};
  assert.equal(evaluateRule(R.women(),p).eligible,false);assert.equal(evaluateRule(R.women(),{...p,womenEligible:true}).eligible,true);
  assert.equal(evaluateRule(R.open(),{...p,womenEligible:true}).eligible,true);
  assert.equal(evaluateRule(R.age({maxAgeExclusive:23}),{...p,age:23}).eligible,false);
});
test("old ranking catalogue is pinned; new lists reuse existing prize-money model",()=>{
  assert.equal(rankingListsFor(1).length,6);assert.equal(rankingListsFor(2).length,9);
  assert.ok(rankingListsFor(2).find(l=>l.key==="women")!.categories.includes("WOMENS"));
});
test("equipment, apparel and commercial partners coexist; competitors conflict",()=>{
  const eq=contract("ironflight");
  assert.deepEqual(conflicts(terms("redpoint-darts"),[eq]),["ironflight"]);
  assert.deepEqual(conflicts(terms("forge-sport"),[eq]),[]);
  assert.deepEqual(conflicts(terms("meridian-energy"),[eq]),[]);
  assert.equal(relationship(SPONSOR_CATALOGUE_V1.find(d=>d.key==="ironflight")!.terms).slot,"EQUIPMENT_PARTNER");
  assert.equal(portfolioLimit({...facts,tourCard:false,worldRanking:null,titles:0}),2);
});
test("best coverage never stacks and tracks per-contract caps and attribution",()=>{
  const a=contract("ironflight"),b=contract("northway-logistics");
  a.terms=structuredClone(a.terms);b.terms=structuredClone(b.terms);
  a.terms.coverage=[{costTypes:["ENTRY_FEE"],percent:50,perEventCapPence:null,seasonCapPence:100,circuits:null}];
  b.terms.coverage=[{costTypes:["ENTRY_FEE"],percent:75,perEventCapPence:null,seasonCapPence:150,circuits:null}];
  const p={contracts:[a,b],usage:new Map([[a.id,new Map<number,number>()],[b.id,new Map<number,number>()]])};
  assert.deepEqual(portfolioCoverage(p,new Map(),"ENTRY_FEE","GRASSROOTS",200),{covered:150,rule:0,contractId:b.id});
  assert.deepEqual(portfolioCoverage(p,new Map(),"ENTRY_FEE","GRASSROOTS",200),{covered:100,rule:0,contractId:a.id});
  assert.equal(portfolioCoverage(p,new Map(),"ENTRY_FEE","GRASSROOTS",200).covered,0);
});
test("NPC commercial content follows equivalent exclusivity with no accounts/history",()=>{
  const p=npcCommercial(seed,"npc",facts);assert.equal(p.financialSimulation,false);assert.equal(p.contractHistoryInvented,false);
  const slots=p.portfolio.map(x=>x.slot),groups=p.portfolio.flatMap(x=>x.groups);
  assert.equal(new Set(slots).size,slots.length);assert.equal(new Set(groups).size,groups.length);assert.ok(p.portfolio.length<=5);
});
test("opportunities are factual projections; inaccessible pinnacles are not hidden",()=>{
  const h={relationship:"AVAILABLE",eligible:false,canEnter:false,denials:["REQUIRES_RANKING"],eligibilityReasons:["REQUIRES_RANKING"]};
  assert.equal(opportunity({status:"SCHEDULED",classification:"RANKING",human:h}).state,"NOT_QUALIFIED");
  assert.equal(opportunity({status:"COMPLETED",classification:"RANKING",human:h}).state,"COMPLETED");
  assert.equal(opportunity({status:"SCHEDULED",classification:"QUALIFIER",human:{...h,eligible:true,canEnter:true,denials:[],eligibilityReasons:[]}}).state,"QUALIFIER_AVAILABLE");
});
test("presentation schema cannot set abilities, logos, ranks, money or malformed colours",()=>{
  assert.throws(()=>cosmeticSchema.parse({ability:100}));assert.throws(()=>cosmeticSchema.parse({primaryColour:"url(script)"}));
  assert.throws(()=>cosmeticSchema.parse({nickname:"<script>"}));assert.doesNotThrow(()=>cosmeticSchema.parse({nickname:"The Quiet One",primaryColour:"#112233",competitionCategory:"WOMEN"}));
  assert.equal(GUIDE.length,19);
  assert.ok(catalogueFor(3).filter(d=>d.classification==="SPECIAL").every(d=>["OCCASIONAL","RETIRABLE_MINOR"].includes(d.content!.longevity)));
  assert.equal(catalogueFor(3).find(d=>d.key==="sudden-death-night")!.content!.longevity,"RETIRABLE_MINOR");
});
