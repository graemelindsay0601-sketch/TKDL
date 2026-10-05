import {test} from "node:test";
import assert from "node:assert/strict";
import {generateSeason} from "../../career/calendar/generation.ts";
import {calendarHash} from "../../career/calendar/engine.ts";
import {catalogueFor} from "../../career/calendar/catalogue.ts";
import {VENUES,LOCALITIES,localVenue} from "../../career/calendar/geography.ts";
import {travelBand,groupTrips,tripCost,NEARBY_VENUES_V2} from "../../career/finance/travel.ts";
import {sponsorCatalogue} from "../../career/finance/sponsors.catalogue.ts";
import {applyCoverage,portfolioCoverage,type ContractRow} from "../../career/finance/engine.ts";
import {conflicts} from "../../career/finance/portfolio.ts";
import {CAREER_DEFAULTS,CAREER_VERSIONS} from "../../career/config.ts";
const seed="a12e".repeat(16);
const home={locality:"ayrshire",country:"GBR",zone:"UK_IRELAND",travelVersion:2};
const event=(key:string,day=50)=>{const v=VENUES.find(v=>v.key===key)!;assert.ok(v,key);return {
  id:key+day,venue_key:key,country:v.country,zone:v.country==="GBR"||v.country==="IRL"?"UK_IRELAND":v.country==="AUS"?"OCEANIA":"EUROPE",
  city:v.city,series_key:null,locality_key:null,start_day:day,end_day:day,circuit:"PRO_CIRCUIT"};};
const contract=(key:string,version=3):ContractRow=>({id:key,offer_id:key,sponsor_key:key,
  tier:sponsorCatalogue(version).find(d=>d.key===key)!.terms.tier,terms:structuredClone(sponsorCatalogue(version).find(d=>d.key===key)!.terms),
  start_season:1,start_week:1,end_season:3,end_week:52,status:"ACTIVE"});
test("A9 new-save v5 establishment season; annual A3 Q-School resumes without moving the clock",()=>{
  assert.equal(CAREER_VERSIONS.eventDatabaseVersion,5);assert.equal(CAREER_DEFAULTS.currentWeek,1);
  assert.equal(CAREER_DEFAULTS.balancePence,25000);
  const old=generateSeason(seed,4,1),fresh=generateSeason(seed,5,1);
  assert.ok(old.some(e=>e.circuit==="Q_SCHOOL"));assert.ok(!fresh.some(e=>e.circuit==="Q_SCHOOL"));
  const signature=(xs:typeof old)=>xs.filter(e=>e.circuit!=="Q_SCHOOL").map(e=>[e.instanceKey,e.venueKey,e.startDay,e.endDay,e.registrationOpensWeek,e.registrationClosesWeek]);
  assert.deepEqual(signature(fresh),signature(old));assert.equal(catalogueFor(5).length,catalogueFor(4).length);
  for(const season of [2,3]){const qs=generateSeason(seed,5,season).filter(e=>e.circuit==="Q_SCHOOL");
    assert.equal(qs.length,old.filter(e=>e.circuit==="Q_SCHOOL").length);assert.equal(Math.min(...qs.map(e=>e.registrationOpensWeek)),1);}
  assert.equal(calendarHash(fresh),calendarHash(generateSeason(seed,5,1)));
});
test("A9 audits every canonical and generated venue; explicit nearby keys exist",()=>{
  for(const keys of Object.values(NEARBY_VENUES_V2))for(const key of keys)assert.ok(VENUES.some(v=>v.key===key),key);
  for(const locality of LOCALITIES){
    const h={locality:locality.key,country:locality.country,zone:"EUROPE",travelVersion:2};
    for(const kind of ["CLUB","COUNTY"] as const){const v=localVenue(locality.key,kind);
      assert.equal(travelBand(h,{...event("burns-hall"),venue_key:v.key,country:v.country,locality_key:locality.key}),"LOCAL");}
    for(const v of VENUES)assert.ok(["LOCAL","DOMESTIC","UK_IRELAND","EUROPE","LONG_HAUL"].includes(travelBand(h,{...event(v.key),country:v.country})));
  }
});
test("A9 local Scotland is not country-wide; UK/Ireland, Europe and long haul retained",()=>{
  for(const key of ["burns-hall","ayr-pavilion","foundry-glasgow","clyde-arena","kelvin-assembly"])assert.equal(travelBand(home,event(key)),"LOCAL",key);
  for(const key of ["granite-centre","highland-events","tay-assembly","midlands-oche","riverside-hall-cardiff"])assert.equal(travelBand(home,event(key)),"DOMESTIC",key);
  assert.equal(travelBand(home,event("harbour-rooms-dublin")),"UK_IRELAND");
  assert.equal(travelBand(home,event("spree-halle-berlin")),"EUROPE");
  assert.equal(travelBand(home,event("southern-cross-hall")),"LONG_HAUL");
  assert.equal(travelBand({...home,travelVersion:1},{...event("highland-events"),locality_key:"highlands"}),"LOCAL","legacy snapshot behaviour preserved");
});
test("A9 paired/series trip grouping and price/night assumptions unchanged",()=>{
  const pair=[event("midlands-oche",50),event("midlands-oche",51)];
  const trips=groupTrips(home,pair);assert.equal(trips.length,1);assert.equal(trips[0].events.length,2);
  assert.equal(trips[0].travelPence,6000);assert.equal(trips[0].nights,2);assert.equal(trips[0].accommodationPence,14000);
  assert.deepEqual(tripCost("EUROPE",2),{band:"EUROPE",travelPence:18000,nights:3,accommodationPence:27000});
});
test("A9 new Ironflight removes guaranteed paired attendance profit; old contracts retain terms",()=>{
  const operating=(version:number)=>{const c=contract("ironflight",version),u=new Map<number,number>();
    const entry=2*applyCoverage(c,u,"ENTRY_FEE","PRO_CIRCUIT",10000).covered;
    const travel=applyCoverage(c,u,"TRAVEL","PRO_CIRCUIT",6000).covered;
    const stay=applyCoverage(c,u,"ACCOMMODATION","PRO_CIRCUIT",14000).covered;
    return 40000-entry-travel-stay-2*(c.terms.eventPayment?.amountPence??0);};
  assert.equal(operating(2),-22000);assert.equal(operating(3),17000);
  assert.equal(contract("ironflight",3).terms.performanceBonuses.find(b=>b.key==="competitive-appearance")!.amountPence,7500);
  assert.equal(contract("ironflight",3).terms.eventPayment,null);
  for(const d of sponsorCatalogue(3).filter(d=>d.terms.tier==="PROFESSIONAL"&&d.key!=="northline-darts")){
    assert.equal(d.terms.eventPayment,null,`${d.key}: no guaranteed attendance stipend`);
    const b=d.terms.performanceBonuses.find(b=>b.key==="competitive-appearance")!;
    assert.equal(b.maxPosition,32);assert.deepEqual(b.circuits,["PRO_CIRCUIT","EUROPEAN_SERIES"]);
    assert.ok(!b.classifications.includes("QUALIFIER"));
  }
  assert.equal(contract("ironflight",2).terms.signingBonusPence,300000);
  assert.equal(contract("ironflight",3).terms.signingBonusPence,200000);
  for(const old of sponsorCatalogue(2).filter(d=>["LOCAL","ELITE"].includes(d.terms.tier)||d.key==="northline-darts")){
    const expected=structuredClone(old.terms);expected.sponsorDatabaseVersion=3;
    assert.deepEqual(contract(old.key,3).terms,expected,`${old.key}: retain unevidenced local/established/elite values`);
  }
});
test("A9 compatible coverage is best-applicable, never additive; independent caps and conflicts",()=>{
  const equipment=contract("ironflight"),logistics=sponsorCatalogue(3).find(d=>d.terms.relationshipSlot==="SECONDARY_COMMERCIAL"&&d.terms.coverage.some(r=>r.costTypes.includes("TRAVEL")))!;
  assert.ok(logistics);const c2=contract(logistics.key),usage=new Map([[equipment.id,new Map<number,number>()],[c2.id,new Map<number,number>()]]);
  const p={contracts:[equipment,c2],usage};
  const best=portfolioCoverage(p,new Map(),"TRAVEL","PRO_CIRCUIT",10000);
  assert.ok(best.covered<=10000);assert.equal(best.covered,Math.max(...p.contracts.map(c=>applyCoverage(c,new Map(),"TRAVEL","PRO_CIRCUIT",10000).covered)));
  assert.equal([...usage.get(equipment.id)!.values()].reduce((a,b)=>a+b,0),0,"non-winning contract not consumed");
  assert.equal(conflicts(c2.terms,[equipment]).length,0);
  assert.deepEqual(conflicts(contract("northline-darts").terms,[equipment]),["ironflight"]);
  c2.terms.coverage[0].seasonCapPence=100;
  const capped={contracts:[c2],usage:new Map([[c2.id,new Map<number,number>()]])};
  assert.equal(portfolioCoverage(capped,new Map(),"TRAVEL","PRO_CIRCUIT",10000).covered,100);
  assert.equal(portfolioCoverage(capped,new Map(),"TRAVEL","PRO_CIRCUIT",10000).covered,0);
  assert.equal(portfolioCoverage({contracts:[equipment],usage:new Map([[equipment.id,new Map<number,number>()]])},new Map(),"TRAVEL","PRO_CIRCUIT",10000).covered,4000);
});
