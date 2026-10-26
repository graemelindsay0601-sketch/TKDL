import {test} from "node:test";
import assert from "node:assert/strict";
import {generateSeason,calendarHashOf} from "../../career/calendar/generation.ts";
import {catalogueFor} from "../../career/calendar/catalogue.ts";
import {R,evaluateRule,type ParticipantFacts} from "../../career/calendar/eligibility.ts";
import {generateInitialWorld,generateWomenCohort} from "../../career/world/generation.ts";
import {geographicalIdentities,geographicalIdentitiesV3} from "../../career/world/geographical-identities.ts";
import {NAME_BANKS_V3,DARTS_NAME_BLOCKLIST} from "../../career/world/name-banks.ts";
import {stableUuid} from "../../career/world/random.ts";
import {VENUE_CONTENT,VENUE_FAMILIES,TROPHIES,GUIDE,ORGANISATIONS,CIRCUIT_CONTENT,CITIES,venueContent} from "../../career/content/world.ts";
import {CORE_BRANDS,LOCAL_SPONSORS} from "../../career/content/brands.ts";
import {npcCommercial,cosmeticSchema} from "../../career/content/service.ts";
import {opportunity} from "../../career/content/opportunities.ts";
import {portfolioLimit,conflicts,relationship} from "../../career/finance/portfolio.ts";
import {SPONSOR_CATALOGUE_V1,SPONSOR_CATALOGUE_V6,sponsorCatalogue,type SportingFacts} from "../../career/finance/sponsors.catalogue.ts";
import {portfolioCoverage,type ContractRow} from "../../career/finance/engine.ts";
import {rankingListsFor} from "../../career/sporting/config.ts";
import {VENUES} from "../../career/calendar/geography.ts";
import {V32_WDF_RANKED_EVENT_KEYS} from "../../career/content/season-v32.ts";
import {WDF_CAREER_GRADE_KEYS,WDF_EVENT_GRADES,WDF_OFFICIAL_GRADE_KEYS} from "../../career/sporting/wdf-ranking.ts";
const seed="a".repeat(64),season=generateSeason(seed,3,1);
const facts:SportingFacts={careerStarted:true,titles:20,tourCard:true,professionalStatus:"PROFESSIONAL",worldRanking:8,bestFinishByCircuit:{},qualifications:[]};
const terms=(key:string)=>sponsorCatalogue(2).find(s=>s.key===key)!.terms;
const contract=(key:string):ContractRow=>({id:key,offer_id:key,sponsor_key:key,tier:terms(key).tier,terms:terms(key),start_season:1,start_week:1,end_season:2,end_week:52,status:"ACTIVE"});
test("SP-F1 same-tier sponsor offers have distinct commercial terms",()=>{
  const local=SPONSOR_CATALOGUE_V6.filter(definition=>definition.terms.tier==="LOCAL");
  const signatures=new Set(local.map(({terms})=>JSON.stringify({
    category:terms.category,
    guarantee:terms.contractFoundation?.guaranteedPayments[0]?.amountPence,
    signing:terms.signingBonusPence,
    event:terms.eventPayment?.amountPence,
    coverage:terms.coverage.map(rule=>[rule.costTypes,rule.percent]),
  })));
  assert.ok(signatures.size>1,"local brands must not be name-only copies of one offer template");
});
test("v1/v2 immutable authored seasons are checkpoint-identical; only future execution capability may change",()=>{
  // Derived independently from the approved 75c679a detached worktree, NOT this implementation.
  // The old full hashes included mutable execution support and therefore cannot
  // certify an adapter correction. Keep every other byte, including resolved
  // definition hashes, format, eligibility, finances, identity and dates.
  const hashes=["038dc639096e6d66e40e0fc7fbc4b486212903959e6befaae2223810a3e48387","d2add3a327c7f2ebd017b1f0e0ae3d89ba935ca7317a78d58e2c75a82a1521bd",
    "be7d9583bc1aeeabfeeda0f642ee067dc8b0a99bf9c961797a5b5dedcf56c556","cb0276ab5459ff10260b11a5e61ba248e498ce2c376ddd724c0de65acb266d6f"];
  assert.deepEqual([1,2].flatMap(v=>[1,2].map(s=>calendarHashOf(generateSeason(seed,v,s).map(d=>{
    const {executable:_execution,...draft}=d;const {capability:_capability,...snapshot}=draft.snapshot;
    return {...draft,snapshot};
  })))),hashes);
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
test("player database v3: realistic country names, surnames spread, no real darts players, ids/abilities untouched",()=>{
  for(const s of ["a","b","c"].map(c=>c.repeat(64))){
    const original=generateInitialWorld(s,1),women=generateWomenCohort(s,1,1,80,original);
    const men=geographicalIdentitiesV3(s,original),people=[...men,...geographicalIdentitiesV3(s,women,men)];
    assert.deepEqual(men,geographicalIdentitiesV3(s,original));
    for(let i=0;i<men.length;i++){assert.equal(men[i].id,original[i].id);assert.deepEqual(men[i].ability,original[i].ability);}
    const names=people.map(p=>`${p.firstName} ${p.surname}`);
    assert.equal(new Set(names).size,names.length);
    assert.ok(names.every(n=>!DARTS_NAME_BLOCKLIST.has(n)&&!/\d|-/.test(n)));
    // Each generated person's name and region come from a bank for their own country.
    for(const p of people.filter(p=>!p.templateKey)){
      const banks=NAME_BANKS_V3.filter(b=>b.country===p.nationality&&b.regions.includes(p.homeRegion!));
      assert.ok(banks.some(b=>b.last.includes(p.surname)&&(p.worldKey.startsWith("women:")?b.women:b.first).includes(p.firstName)),`${p.firstName} ${p.surname} (${p.nationality})`);
    }
    // Spread: no surname is carried by more than three people of one country.
    const counts=new Map<string,number>();
    for(const p of people)counts.set(`${p.nationality}|${p.surname}`,(counts.get(`${p.nationality}|${p.surname}`)??0)+1);
    assert.ok(Math.max(...counts.values())<=3,`max surname repeat ${Math.max(...counts.values())}`);
  }
});
test("player database v3 extends deterministically when crowded",()=>{
  const example=generateInitialWorld(seed,1).find(p=>!p.templateKey)!;
  const input=Array.from({length:4000},(_,i)=>({...example,id:stableUuid(seed,1,"name-bank-fixture",i),worldKey:`crowded:${i}`}));
  const names=geographicalIdentitiesV3(seed,input).map(p=>`${p.firstName} ${p.surname}`);
  assert.equal(new Set(names).size,names.length);
  assert.deepEqual(names,geographicalIdentitiesV3(seed,input).map(p=>`${p.firstName} ${p.surname}`));
});
test("authored counts, hierarchy and complete map anchors",()=>{
  assert.equal(ORGANISATIONS.length,4);assert.equal(CIRCUIT_CONTENT.length,29);
  assert.equal(VENUE_CONTENT.length,77);assert.equal(VENUE_FAMILIES.length,15);assert.equal(TROPHIES.length,18);
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
  assert.equal(rankingListsFor(1).length,6);assert.equal(rankingListsFor(2).length,9);assert.equal(rankingListsFor(3).length,10);
  assert.ok(rankingListsFor(2).find(l=>l.key==="women")!.categories.includes("WOMENS"));
});
test("event database v33 corrects WDF major and regional host venues without rewriting v32",()=>{
  const v32=new Map(catalogueFor(32).map(d=>[d.key,d]));
  const v33=new Map(catalogueFor(33).map(d=>[d.key,d]));
  assert.deepEqual([...v33.keys()].sort(),[...v32.keys()].sort());
  const corrections:Record<string,string>={
    "wdf-world-championship":"lakeside-country-club","wdf-world-masters":"desert-pavilion-las-vegas",
    "women-world-championship":"lakeside-country-club","women-masters":"desert-pavilion-las-vegas",
    "wdf-manx-open":"isle-of-man-oche","wdf-ulster-open":"lagan-exchange","wdf-baltic-open":"baltic-exchange",
    "wdf-danube-masters":"danube-halle-vienna","wdf-bohemian-open":"vltava-arena-prague",
    "wdf-mediterranean-masters":"ramblas-arena-barcelona",
  };
  for(const [key,venueKey] of Object.entries(corrections)){
    const definition=v33.get(key)!;
    assert.equal(definition.eventDatabaseVersion,33);
    assert.equal(definition.schedule.kind,"FIXED");
    if(definition.schedule.kind==="FIXED") assert.ok(definition.schedule.slots.every(slot=>slot.venue===venueKey),key);
    assert.ok(VENUES.some(venue=>venue.key===venueKey),venueKey);
  }
  const countries:Record<string,string>={
    "lakeside-country-club":"GBR","desert-pavilion-las-vegas":"USA","isle-of-man-oche":"GBR",
    "lagan-exchange":"GBR","baltic-exchange":"EST","danube-halle-vienna":"AUT",
    "vltava-arena-prague":"CZE","ramblas-arena-barcelona":"ESP",
  };
  for(const [venueKey,country] of Object.entries(countries)) assert.equal(VENUES.find(v=>v.key===venueKey)!.country,country);
  assert.notDeepEqual(v32.get("wdf-world-championship")!.schedule,v33.get("wdf-world-championship")!.schedule);
});
test("every senior singles WDF-inspired event has an explicit official or Career-authored grade",()=>{
  const current=new Map(catalogueFor(33).map(d=>[d.key,d]));
  const seniorKeys=V32_WDF_RANKED_EVENT_KEYS.filter(key=>!key.includes("girls")&&!key.includes("youth"));
  for(const key of seniorKeys){
    const event=current.get(key);
    assert.ok(event,`missing WDF event ${key}`);
    assert.ok(event!.rankingCategory==="WOMENS"||event!.rankingCategory==="AMATEUR_NATIONAL"||event!.rankingCategory==="AMATEUR_REGIONAL",
      `${key} is not a singles ranking event`);
    assert.ok(WDF_EVENT_GRADES[key],`${key} has no explicit grade`);
  }
  const seniorKeySet=new Set<string>(seniorKeys);
  for(const key of [...WDF_OFFICIAL_GRADE_KEYS,...WDF_CAREER_GRADE_KEYS]) assert.ok(seniorKeySet.has(key),`orphaned grade ${key}`);
  assert.equal(WDF_OFFICIAL_GRADE_KEYS.size,7);
  assert.equal(WDF_CAREER_GRADE_KEYS.size,15);
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
  assert.equal(GUIDE.length,21);
  assert.ok(catalogueFor(3).filter(d=>d.classification==="SPECIAL").every(d=>["OCCASIONAL","RETIRABLE_MINOR"].includes(d.content!.longevity)));
  assert.equal(catalogueFor(3).find(d=>d.key==="sudden-death-night")!.content!.longevity,"RETIRABLE_MINOR");
});
