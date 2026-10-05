import {test} from "node:test";
import assert from "node:assert/strict";
import {MAP_VIEWS,projectCoordinate,clusterLocations,filterMap,mapState,eventIdentity,planningCosts} from "../../features/career/presentation.ts";
import {npcShirt} from "../../../../api-server/src/career/content/visual.ts";
import {CAREER_NAV,activeNavKey,navLayerOf} from "../../features/career/model.ts";
test("A8.3 five destinations own all current and preserved deep routes",()=>{
  assert.deepEqual(CAREER_NAV.map(s=>s.label),["Home","Map","Calendar","Darts World","My Career"]);
  for(const [route,layer] of [["/events/e","CALENDAR"],["/tournaments/e","CALENDAR"],["/matches/m/play","CALENDAR"],["/world/players/p","DARTS_WORLD"],["/world/events/world-darts-championship","DARTS_WORLD"],["/map","MAP"],["/my-career/achievements","MY_CAREER"],["/finances","MY_CAREER"],["/history/npcs/p","DARTS_WORLD"],["/history","MY_CAREER"]])assert.equal(navLayerOf(activeNavKey(`/career/save${route}`)).layer,layer);
});
test("A8.3 coordinates are geographic, deterministic and region views include home anchors",()=>{
  assert.deepEqual(projectCoordinate(0,0),{x:360,y:180});
  const events=[{id:"a",venue:{mapAnchor:{latitude:55.46,longitude:-4.63}}},{id:"b",venue:{mapAnchor:{latitude:55.46,longitude:-4.63}}},{id:"tokyo",venue:{mapAnchor:{latitude:35.68,longitude:139.69}}}];
  assert.equal(clusterLocations(events,MAP_VIEWS.SCOTLAND)[0].events.length,2);
  assert.equal(clusterLocations(events,MAP_VIEWS.WORLD).flatMap(g=>g.events).length,3);
  assert.deepEqual(clusterLocations(events,MAP_VIEWS.WORLD),clusterLocations(events,MAP_VIEWS.WORLD));
});
test("A8.3 map filters retain inaccessible world events only when requested",()=>{
  const item=(id:string,status:string,state:string,canEnter=false)=>({id,status,content:{circuitId:"majors"},opportunity:{state,canEnter}});
  const events=[item("open","REGISTRATION_OPEN","AVAILABLE",true),item("mine","DRAWN","ENTERED"),item("qualified","SCHEDULED","QUALIFIED"),item("palace","SCHEDULED","NOT_QUALIFIED"),item("old","COMPLETED","COMPLETED")];
  assert.deepEqual(filterMap(events,"OPPORTUNITIES").map(e=>e.id),["open","mine","qualified"]);
  assert.deepEqual(filterMap(events,"ALL").map(e=>e.id),["open","mine","qualified","palace"]);
  assert.equal(filterMap(events,"ALL",true).length,5);
  assert.equal(mapState(item("x","IN_PROGRESS","ENTERED")),"In Progress");
});
test("A8.3 seven canonical identities survive sponsor/edition changes",()=>{
  const keys=["long-format-matchplay","double-crown","open-championship","grand-slam-of-champions","european-championship","pro-circuit-finals","world-darts-championship"];
  assert.equal(new Set(keys.map(k=>eventIdentity(k).className)).size,7);
  assert.equal(eventIdentity("world-darts-championship").className,"palace");
  assert.equal(eventIdentity("vault-nights","VAULT").className,"vault");
});
test("A8.3 NPC cosmetics are stable and contain no sporting effects",()=>{
  assert.deepEqual(npcShirt("player-123"),npcShirt("player-123"));
  assert.equal(new Set(Array.from({length:100},(_,i)=>JSON.stringify(npcShirt(`p-${i}`)))).size>3,true);
  assert.deepEqual(Object.keys(npcShirt("p")).sort(),["accentColour","primaryColour","secondaryColour","shirtTemplate"]);
});
test("A8.3 displayed financial costs require finite authoritative fields",()=>{
  assert.equal(planningCosts(null),null);assert.equal(planningCosts({entryFeePence:"100"}),null);
  assert.deepEqual(planningCosts({entryFeePence:100,estimatedTravelPence:200,estimatedAccommodationPence:300,estimatedPlayerCostPence:450,sponsorCoverage:{entryFeePence:50,travelPence:100,accommodationPence:0}}),{commitment:600,coverage:150,playerCost:450});
});
