function getRecentMatches(){

  const sheet =
    getSheet(
      SHEETS.FORM_SUBMISSIONS
    );

  if(!sheet)
    return [];

  const data =
    sheet
      .getDataRange()
      .getValues();

  if(data.length <= 1)
    return [];

  return data
    .slice(1)
    .reverse()
    .slice(0, 100)
    .map(row => ({

      timestamp:
        row[0],

      match:
        row[1],

      stake:
        row[2],

      winner:
        row[3],

      gameType:
        row[4]

    }));

}

function getCurrentSeason() {
  try {
    const ss    = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
    const sheet = ss.getSheetByName('SYSTEM_STATE');
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]).toUpperCase() === 'CURRENT_SEASON' && data[i][1])
          return String(data[i][1]).trim();
      }
    }
  } catch(e) {
    Logger.log('getCurrentSeason fallback: ' + e);
  }
  const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
                  'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  const now = new Date();
  return months[now.getMonth()] + '_' + now.getFullYear();
}

function getLeagueDataCore(){

  const playersData =
    getPlayersData();

  const careerStats =
    calculateCareerStats();
    const rivalryStats =
  calculateRivalries();

return playersData
    .slice(1)
    .filter(row =>
      row[0] &&
      String(row[1] || '').toUpperCase() !== 'INACTIVE'
    )

.map(row => ({

  name:
    row[0],

  status:
    row[1],

  points:
    Number(row[3]) || 0,

  games:
    Number(row[4]) || 0,

  wins:
    Number(row[5]) || 0,

  losses:
    Number(row[6]) || 0,

  winRate:

    row[4]

      ?

      Math.round(
        (
          (Number(row[5]) || 0)
          /
          (Number(row[4]) || 1)
        ) * 100
      )

      : 0,

  playerId:
    row[13] || "",

  elo:
    Number(row[8]) || 1000,

  rank:
    Number(row[17]) || 999,

 

careerStats: (function(){
  var cw=Number(row[14])||0, cl=Number(row[15])||0, cg=Number(row[16])||0;
  if(cg>0) return {totalWins:cw,totalLosses:cl,totalMatches:cg,totalPoints:0,highestElo:Number(row[8])||1000,winRate:Math.round((cw/cg)*100)};
  var live=careerStats[String(row[0]||'').trim().toLowerCase()];
  return live||{totalWins:0,totalLosses:0,totalMatches:0,totalPoints:0,highestElo:1000,winRate:0};
})(),

rivalries:

  rivalryStats[row[0]]

  ||

  {},

season: {

  wins:
    Number(row[5]) || 0,

  losses:
    Number(row[6]) || 0,

  games:
    Number(row[4]) || 0,

  winRate:

    row[4]

      ?

      Math.round(

        (
          (Number(row[5]) || 0)
          /
          (Number(row[4]) || 1)

        ) * 100

      )

      : 0

  }

}));

}



function getLeagueData(){
  const ss =
  SpreadsheetApp.openById(
    "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
  );






  const playersData =
    getPlayersData();


const liveCareerStats =
  calculateCareerStats();

  const rivalryStats =
  calculateRivalries();

const achievementMetadata =
  Object.entries(
    getAchievementMetadataV2()
  ).map(([id,a]) => ({

    id,
    ...a

  }));

const playerAchievements =
  getPlayerAchievements();

const players =
  playersData
    .slice(1)
    .filter(row =>

      row[0] &&

      String(row[1] || "")
        .toUpperCase() !== "INACTIVE"

    )
.map(row => ({

  

  name:
    row[0],

  status:
    row[1],

  points:
    Number(row[3]) || 0,

  games:
    Number(row[4]) || 0,

  wins:
    Number(row[5]) || 0,

  losses:
    Number(row[6]) || 0,

  winRate:

    row[4]

      ?

      Math.round(
        (
          (Number(row[5]) || 0)
          /
          (Number(row[4]) || 1)
        ) * 100
      )

      : 0,

  elo:
    Number(row[8]) || 1000,

  tier:
    row[9] || "🥇 Gold",

  rank:
    Number(row[17]) || 0,

  previousRank:
    Number(row[18]) || 0,

    rankChange:

  (Number(row[18]) || 0)

  -

  (Number(row[17]) || 0),

  playerId:
  row[13] || "", 


careerStats: (function(){
  var cw = Number(row[14])||0, cl = Number(row[15])||0, cg = Number(row[16])||0;
  // If sheet has stored values use them; otherwise fall back to live calc
  if(cg > 0) {
    return { totalWins:cw, totalLosses:cl, totalMatches:cg, totalPoints:0,
             highestElo:Number(row[8])||1000,
             winRate: Math.round((cw/cg)*100) };
  }
  var live = liveCareerStats[String(row[0]||'').trim().toLowerCase()];
  return live || { totalWins:0,totalLosses:0,totalMatches:0,totalPoints:0,highestElo:1000,winRate:0 };
})(),

rivalries:

  rivalryStats[row[0]]

  ||

  {},

season: {

  wins:
    Number(row[5]) || 0,

  losses:
    Number(row[6]) || 0,

  games:
    Number(row[4]) || 0,

  winRate:

    row[4]

      ?

      Math.round(

        (
          (Number(row[5]) || 0)
          /
          (Number(row[4]) || 1)

        ) * 100

      )

      : 0

}



  ,

achievements: []

}));

  players.sort(
    (a,b) => b.points - a.points
  );

players.forEach(player => {

  const unlocked =
    playerAchievements.filter(function(a) {
      var pid = String(player.playerId||'').toLowerCase();
      var apid = String(a.playerId||'').toLowerCase();
      var pname = String(player.name||'').toLowerCase();
      if(pid && apid && pid===apid) return true;
      return apid===pname;
    });

  player.achievements =
    unlocked.map(unlock => {

      return achievementMetadata.find(meta =>

        meta.id === unlock.achievementId

      );

    }).filter(Boolean);

});

const playerProfiles = {};

players.forEach(player => {

  try {

    playerProfiles[player.playerId] =

      buildPlayerProfile(
        player.playerId,
        {
          players:
            Object.fromEntries(

              players.map(p => [

                p.playerId,

                p

              ])

            )
        }
      );

  }
  catch(err){

    console.log(
      "PROFILE BUILD ERROR",
      err
    );

  }

});

return {

  season:
    getCurrentSeason(),

  seasonDisplayName:
    getCurrentSeason()
      .replace('JUNE_2026', 'Season 3 — June 2026')
      .replace('MAY_2026', 'Season 2 — May 2026')
      .replace('FEB_2026', 'Season 1 — February 2026'),

  generatedAt:
    new Date().toISOString(),

  seasonDisplayName:
    getCurrentSeason()
      .replace('JUNE_2026', 'Season 3 — June 2026')
      .replace('MAY_2026', 'Season 2 — May 2026')
      .replace('FEB_2026', 'Season 1 — February 2026'),

  generatedAt:
    new Date().toISOString(),

  stats: {

      totalPlayers:
        players.length,

totalMatches:

  Math.floor(

    players.reduce(

      (sum,p) =>

        sum + p.games,

      0

    ) / 2

  ),
      averageElo:

        Math.round(

          players.reduce(

            (sum,p) =>

              sum + p.elo,

            0

          )

          /

          Math.max(players.length,1)

        )

    },

    leaderboard:
      players,

    players:
      players,

    featuredPlayers:
      players.slice(0,3),

      playerProfiles:
  buildAllPlayerProfiles({
    players:
      Object.fromEntries(
        players.map(player => [
          player.playerId,
          player
        ])
      )
  }),

  leagueNarratives:
  buildLeagueNarratives({
    players,
    matches:
      getArchivedMatches()
  }),



    recentMatches:
  getRecentMatches(),

achievements: [],

allAchievements:

  Object.entries(
    getAchievementMetadataV2()
  ).map(([id,a]) => ({

    id,
    ...a

  })),

rivalries: [],

spotlights: {},

playerAchievements:
  playerAchievements,

seasonArchives:
  getSeasonArchives(),

archivedMatches:
  getArchivedMatches(),

careerLeaderboard:
  getCareerLeaderboard(),

achievementMetadata:
  Object.entries(
    getAchievementMetadataV2()
  ).map(([id,a]) => ({ id, ...a }))

  };
  Logger.log(
  JSON.stringify(
    players.map(p => ({
      name: p.name,
      careerStats: p.careerStats
    })),
    null,
    2
  )
);

}




function calculateCareerStats(){

  const sheet =
    getSheet("CAREER_MATCHES");

  if(!sheet)
    return {};

  const data =
    sheet
      .getDataRange()
      .getValues();

  if(data.length <= 1)
    return {};

  const stats = {};

  data
    .slice(1)
    .forEach(row => {

      const p1 =
        String(row[1] || "").trim().toLowerCase();

      const p2 =
        String(row[2] || "").trim().toLowerCase();

      const winner =
        String(row[3] || "").trim().toLowerCase();

      const stake =
        Number(row[4]) || 0;

      if(!p1 || !p2 || !winner){
        return;
      }

      [p1,p2].forEach(name => {

        if(!stats[name]){

          stats[name] = {

            totalWins:0,
            totalLosses:0,
            totalMatches:0,
            totalPoints:0,
            highestElo:1000,
            winRate:0

          };

        }

        stats[name].totalMatches++;

      });

      stats[winner].totalWins++;
      stats[winner].totalPoints += stake;

      const loser =

        winner === p1
          ? p2
          : p1;

      if(!stats[loser]){

        stats[loser] = {

          totalWins:0,
          totalLosses:0,
          totalMatches:0,
          totalPoints:0,
          highestElo:1000,
          winRate:0

        };

      }

      stats[loser].totalLosses++;
      stats[loser].totalPoints -= stake;

    });

  Object.keys(stats)
    .forEach(name => {

      const s =
        stats[name];

      s.winRate =

        s.totalMatches

          ?

          Math.round(
            (s.totalWins / s.totalMatches) * 100
          )

          : 0;

    });

  return stats;

}
function rebuildCareerStatsFromMatches(){

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const matchesSheet =
    ss.getSheetByName(
      "CAREER_MATCHES"
    );

  const statsSheet =
    ss.getSheetByName(
      "CAREER_STATS"
    );

  const playersSheet =
    ss.getSheetByName(
      "PLAYERS"
    );

  if(
    !matchesSheet ||
    !statsSheet ||
    !playersSheet
  ){
    throw new Error(
      "Missing required sheets"
    );
  }

  const matchData =
    matchesSheet
      .getDataRange()
      .getValues()
      .slice(1);

  const playersData =
    playersSheet
      .getDataRange()
      .getValues()
      .slice(1);

  const stats = {};

  matchData.forEach(row => {

    const p1 =
      String(row[1] || "").trim();

    const p2 =
      String(row[2] || "").trim();

    const winner =
      String(row[3] || "").trim();

    const stake =
      Number(row[4]) || 0;

    if(!p1 || !p2 || !winner){
      return;
    }

    [p1,p2].forEach(name => {

      if(!stats[name]){

        stats[name] = {

          wins:0,
          losses:0,
          games:0,
          points:0

        };

      }

      stats[name].games++;

    });

    stats[winner].wins++;
    stats[winner].points += stake;

    const loser =

      winner === p1
        ? p2
        : p1;

    stats[loser].losses++;
    stats[loser].points -= stake;

  });

  statsSheet.clearContents();

  statsSheet.appendRow([

    "playerId",
    "playerName",
    "careerWins",
    "careerLosses",
    "careerGames",
    "highestElo",
    "careerPoints"

  ]);

  playersData.forEach(row => {

    const playerName =
      String(row[0] || "").trim();

    const playerId =
      String(row[13] || "").trim();

    const elo =
      Number(row[19] || 1000);

    const career =
      stats[playerName] || {};

    statsSheet.appendRow([

      playerId,

      playerName,

      Number(career.wins || 0),

      Number(career.losses || 0),

      Number(career.games || 0),

      elo,

      Number(career.points || 0)

    ]);

  });

  Logger.log(
    "CAREER_STATS rebuilt successfully"
  );

}
function calculateRivalries(){

  const sheet =
    getSheet("CAREER_MATCHES");

  if(!sheet)
    return {};

  const data =
    sheet
      .getDataRange()
      .getValues();

  if(data.length <= 1)
    return {};

  const rivalries = {};

  data
    .slice(1)
    .forEach(row => {

      const p1 =
        String(row[1] || "").trim();

      const p2 =
        String(row[2] || "").trim();

      const winner =
        String(row[3] || "").trim();

      if(!p1 || !p2)
        return;

      [p1,p2].forEach(player => {

        if(!rivalries[player]){

          rivalries[player] = {};

        }

      });

      if(!rivalries[p1][p2]){

        rivalries[p1][p2] = {

          wins:0,
          losses:0,
          meetings:0

        };

      }

      if(!rivalries[p2][p1]){

        rivalries[p2][p1] = {

          wins:0,
          losses:0,
          meetings:0

        };

      }

      rivalries[p1][p2].meetings++;
      rivalries[p2][p1].meetings++;

      if(winner === p1){

        rivalries[p1][p2].wins++;
        rivalries[p2][p1].losses++;

      }else{

        rivalries[p2][p1].wins++;
        rivalries[p1][p2].losses++;

      }

    });

  return rivalries;

}


function getPlayerCareerMatches(playerName){

  const sheet =
    getSheet("CAREER_MATCHES");

  if(!sheet)
    return [];

  const data =
    sheet
      .getDataRange()
      .getValues();

  if(data.length <= 1)
    return [];

  return data
    .slice(1)
    .filter(row => {

      const p1 =
        String(row[1] || "")
          .trim();

      const p2 =
        String(row[2] || "")
          .trim();

      return (

        p1 === playerName ||

        p2 === playerName

      );

    });

}










function getAchievementMetadata(){

  const sheet =
    getSheet(
      "ACHIEVEMENT_METADATA"
    );

  if(!sheet)
    return [];

  const data =
    sheet
      .getDataRange()
      .getValues();

  return data
    .slice(1)
    .map(row => ({

      name:
        row[0],

      id:
        row[1],

      category:
        row[2],

      rarity:
        row[3],

      reelPriority:
        row[4],

      hidden:
        row[5],

      icon:
        row[6],

description:
  row[7],

criteriaType:
  row[8] || "",

criteriaValue:
  row[9] || "",

engineType:
  row[10] || "",

secondaryCriteriaType:
  row[11] || "",

secondaryCriteriaValue:
  row[12] || "",

trackingScope:
  row[13] || "CAREER"
    }));

}


function getPlayerAchievements(){
  try {
    const ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
    const sheet = ss.getSheetByName('PLAYER_ACHIEVEMENTS');
    
    if(!sheet){
      Logger.log('PLAYER_ACHIEVEMENTS sheet not found');
      return [];
    }
    
    const rows = sheet.getDataRange().getValues();
    
    // Skip header, map to objects
    return rows.slice(1).map(row => {
      return {
        uuid: row[0],              // Column A
        playerId: row[1],          // Column B
        achievementId: row[2],     // Column C
        unlockDate: row[3],        // Column D
        season: row[4],            // Column E
        rarity: row[5]             // Column F
      };
    }).filter(r => r.achievementId); // Only include rows with achievementId
    
  } catch(e){
    Logger.log('getPlayerAchievements error: ' + e);
    return [];
  }
}

function doGet(e){

  const fn =
    e?.parameter?.function || "";

  const playerId =
    e?.parameter?.playerId || "";

  /* =========================
     WEBSITE LOAD
  ========================= */

  if(fn === ""){

    return HtmlService
      .createTemplateFromFile("index")
      .evaluate()
      .setTitle("TKDL")
      .setXFrameOptionsMode(
        HtmlService.XFrameOptionsMode.ALLOWALL
      );

  }




  /* =========================
     API ROUTES
  ========================= */

  if(fn === "getLeagueData"){

    return ContentService
      .createTextOutput(
        JSON.stringify(
          getLeagueData()
        )
      )
      .setMimeType(
        ContentService.MimeType.JSON
      );

  }

  if(fn === "getLeagueDataCached"){

  return ContentService
    .createTextOutput(
      JSON.stringify(
        getLeagueDataCached()
      )
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );

}

  if(fn === "getDashboardData"){

    return getDashboardData();

  }

  if(fn === "getSeasonsIndex"){

    return getSeasonsIndex();

  }

  if (fn === 'getSeasonStandingsData') {
    const season = e?.parameter?.season || '';
    return ContentService
      .createTextOutput(JSON.stringify({ standings: getSeasonStandings(season) }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  
    if(fn === "getPlayerAchievements"){
        const playerId = e?.parameter?.playerId || "";
            const achievements = getPlayerAchievementsAPI(playerId);
                return ContentService.createTextOutput(JSON.stringify({playerId: playerId, achievements: achievements, count: achievements.length, success: true})).setMimeType(ContentService.MimeType.JSON);
                  }

  if(fn === "getPlayerProfile"){

    return ContentService
      .createTextOutput(
        JSON.stringify(
          getPlayerProfile(playerId)
        )
      )
      .setMimeType(
        ContentService.MimeType.JSON
      );

  }

  return ContentService
    .createTextOutput(
      JSON.stringify({
        error:"Invalid function",
        received: fn
      })
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );

}


/* =========================
   POST API
========================= */

function doPost(e){

  try{

    const fn =
      e?.parameter?.function || "";

const data =
  e.parameter || {};

if(fn === "submitMatch"){

  return ContentService
    .createTextOutput(
      JSON.stringify(
        submitMatchV2(
          data.player1,
          data.player2,
          data.winner,
          data.stake,
          data.gameType
        )
      )
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );

}

    if (fn === 'joinLeague') {
      return ContentService
        .createTextOutput(JSON.stringify(joinLeague(data)))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(
        JSON.stringify({
          success:false,
          error:"Invalid POST function"
        })
      )
      .setMimeType(
        ContentService.MimeType.JSON
      );

  }catch(err){

    return ContentService
      .createTextOutput(
        JSON.stringify({
          success:false,
          error:String(err)
        })
      )
      .setMimeType(
        ContentService.MimeType.JSON
      );

  }

}

function getSeasonArchives(){

  const sheet =
    getSheet("SEASON_ARCHIVES");

  if(!sheet)
    return [];

  const data =
    sheet
      .getDataRange()
      .getValues();

  if(data.length <= 1)
    return [];

  return data
    .slice(1)
    .map(row => ({

      season:
        row[0] || "",

      champion:
        row[1] || "",

      matches:
        Number(row[2]) || 0,

      highestElo:
        Number(row[3]) || 0,

      players:
        Number(row[4]) || 0,

      notes:
        row[5] || ""

    }));

}


/* =========================
   SUBMIT MATCH
========================= */






function checkSeasonRollover(){

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const stateSheet =
    ss.getSheetByName(
      "SYSTEM_STATE"
    );

  if(!stateSheet){
    return;
  }

  const data =
    stateSheet
      .getDataRange()
      .getValues();

  const state = {};

  data
    .slice(1)
    .forEach(row => {

      state[row[0]] = row[1];

    });

  const liveSeason =
    getCurrentSeason();

  const storedSeason =
    state.CURRENT_SEASON;

  /* =========================
     NO CHANGE
  ========================= */

  if(
    liveSeason === storedSeason
  ){

    stateSheet
      .getRange("B3")
      .setValue(
        new Date()
      );

return {

  rollover:false,
  season:liveSeason

};

  }

  /* =========================
     SEASON CHANGED
  ========================= */

  return {

    rollover:true,

    oldSeason:
      storedSeason,

    newSeason:
      liveSeason

  };

}
  function generateSeasonAwards(){

const players =
  getPlayersData()
    .slice(1)
    .filter(row => row[0]);

const careerStats =
  calculateCareerStats();

const matches =
  getRecentMatches();

  if(!players.length){
    return null;
  }

  const champion =
    [...players]
      .sort((a,b)=>
        b.points - a.points
      )[0];

const mvp =
  [...players]
    .sort((a,b)=>
      (
        ((b.season?.wins || 0) * 2)
        + b.elo
      )
      -
      (
        ((a.season?.wins || 0) * 2)
        + a.elo
      )
    )[0];

  const highestElo =
    [...players]
      .sort((a,b)=>
        b.elo - a.elo
      )[0];

  const eliminationKing =
    [...players]
      .sort((a,b)=>
        (b.eliminations || 0)
        -
        (a.eliminations || 0)
      )[0];

const mostActive =
  [...players]
    .sort((a,b)=>

      (Number(b[4]) || 0)

      -

      (Number(a[4]) || 0)

    )[0];

  return {

season:
  getCurrentSeason(),

    champion:
      champion?.name || "-",

    mvp:
      mvp?.name || "-",

    highestElo:
      highestElo?.elo || 0,

    highestEloPlayer:
      highestElo?.name || "-",

mostWins:
  Number(champion?.[5]) || 0,

eliminationKing:
  eliminationKing?.name || "-",

    eliminations:
      eliminationKing?.eliminations || 0,

    mostActive:
      mostActive?.name || "-",

    totalMatches:
      matches.length || 0,

    timestamp:
      new Date()

  };

}
function archiveSeason(){

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const archiveSheet =
    ss.getSheetByName(
      "SEASON_ARCHIVES"
    );

  const playersSheet =
    ss.getSheetByName(
      "PLAYERS"
    );

  const matchesSheet =
    ss.getSheetByName(
      "FORM_SUBMISSIONS"
    );

  if(
    !archiveSheet ||
    !playersSheet ||
    !matchesSheet
  ){
    return;
  }

  const playersData =
    playersSheet
      .getDataRange()
      .getValues();

  const matchData =
    matchesSheet
      .getDataRange()
      .getValues();

  const archiveData =
  archiveSheet
    .getDataRange()
    .getValues();

const alreadyArchived =

  archiveData
    .slice(1)
    .some(row =>

      String(row[0]) ===
      getCurrentSeason()

    );

if(alreadyArchived){

  Logger.log(
    "Season already archived."
  );

  return;

}    

  const players =

    playersData
      .slice(1)
      .filter(row => row[0]);

  if(players.length === 0){
    return;
  }



  /* =========================
     CHAMPION
  ========================= */

  const champion =

    players
      .sort(
        (a,b) =>

          Number(b[3]) -
          Number(a[3])

      )[0];

  /* =========================
     HIGHEST ELO
  ========================= */

  let highestElo = 0;

  players.forEach(row => {

    const elo =
      Number(row[8]) || 0;

    if(elo > highestElo){

      highestElo = elo;

    }

  });

  /* =========================
     MATCH COUNT
  ========================= */

  const matchCount =

    Math.max(
      matchData.length - 1,
      0
    );

  /* =========================
     SAVE ARCHIVE
  ========================= */

  archiveSheet.appendRow([

    getCurrentSeason(),

    champion[0],

    matchCount,

    highestElo,

    players.length,

    ""

  ]);

}

function runSeasonRollover() {
  const rolloverCheck = checkSeasonRollover();
  if (!rolloverCheck.rollover) {
    Logger.log('No rollover required.');
    return;
  }
  try {
    const awards      = generateSeasonAwards();
    const awardsSheet = SpreadsheetApp
      .openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc')
      .getSheetByName('SEASON_AWARDS');
    if (awardsSheet && awards) {
      awardsSheet.appendRow([
        awards.season, awards.champion, awards.mvp,
        awards.highestEloPlayer + ' (' + awards.highestElo + ')',
        awards.mostWins, awards.eliminationKing + ' (' + awards.eliminations + ')',
        awards.mostActive, awards.totalMatches, '', awards.timestamp
      ]);
    }
  } catch(e) { Logger.log('Awards failed: ' + e); }
  try { awardSeasonalAchievements(); } catch(e) { Logger.log('Seasonal achievements: ' + e); }
  startNewSeason(rolloverCheck.newSeason);
  Logger.log('Season rollover complete: ' + rolloverCheck.newSeason);
}


function awardSeasonalAchievements(){

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const playersSheet =
    ss.getSheetByName(
      "PLAYERS"
    );

  const unlockSheet =
    ss.getSheetByName(
      "PLAYER_ACHIEVEMENTS"
    );

  if(
    !playersSheet ||
    !unlockSheet
  ){
    return;
  }

  const players =

    playersSheet
      .getDataRange()
      .getValues()
      .slice(1)
      .filter(row => row[0]);

  if(players.length === 0){
    return;
  }

  /* =========================
     SORTINGS
  ========================= */

  const byPoints =
    [...players]
      .sort(
        (a,b) =>

          Number(b[3]) -
          Number(a[3])

      );

  const byGames =
    [...players]
      .sort(
        (a,b) =>

          Number(b[4]) -
          Number(a[4])

      );

  const byWins =
    [...players]
      .sort(
        (a,b) =>

          Number(b[5]) -
          Number(a[5])

      );

  const byRankClimb =
    [...players]
      .sort(
        (a,b) =>

          (
            Number(b[18]) -
            Number(b[17])
          )

          -

          (
            Number(a[18]) -
            Number(a[17])
          )

      );

  const byRankDrop =
    [...players]
      .sort(
        (a,b) =>

          (
            Number(a[17]) -
            Number(a[18])
          )

          -

          (
            Number(b[17]) -
            Number(b[18])
          )

      );

  /* =========================
     WINNERS
  ========================= */

  const awards = [

    {

      playerId:
        byPoints[0][13],

      achievementId:
        "MVP"

    },

    {

      playerId:
        byGames[0][13],

      achievementId:
        "MOST_ACTIVE"

    },

    {

      playerId:
        byWins[0][13],

      achievementId:
        "REAPER_SEASONAL"

    },

    {

      playerId:
        byRankClimb[0][13],

      achievementId:
        "RISING_STAR"

    },

    {

      playerId:
        byRankDrop[0][13],

      achievementId:
        "COLLAPSING"

    }

  ];

  /* =========================
     INSERT AWARDS
  ========================= */

  awards.forEach(award => {

    const existingAwards =
  getPlayerAchievements();

const alreadyAwarded =

  existingAwards.some(a =>

    a.playerId ===
    award.playerId

    &&

    a.achievementId ===
    award.achievementId

    &&

    a.season ===
    getCurrentSeason()

  );

if(alreadyAwarded){
  return;
}

    if(
      !award.playerId
    ){
      return;
    }

    unlockSheet.appendRow([

      Utilities.getUuid(),

      award.playerId,

      award.achievementId,

      new Date(),

      getCurrentSeason(),

      "Seasonal"

    ]);

  });

}



function backfillCareerMatches(){

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const formSheet =
    ss.getSheetByName(
      "FORM_SUBMISSIONS"
    );

  const careerSheet =
    ss.getSheetByName(
      "CAREER_MATCHES"
    );

  if(
    !formSheet ||
    !careerSheet
  ){
    return;
  }

  const formData =
    formSheet
      .getDataRange()
      .getValues();

  const careerData =
    careerSheet
      .getDataRange()
      .getValues();

  const existingKeys =
    new Set();

  /* =========================
     LOAD EXISTING MATCH KEYS
  ========================= */

  careerData
    .slice(1)
    .forEach(row => {

      const key = [

        row[0],

        row[1],

        row[2],

        row[3],

        row[4]

      ].join("|");

      existingKeys.add(key);

    });

  /* =========================
     BACKFILL FROM FORMS
  ========================= */

  formData
    .slice(1)
    .forEach(row => {

      try {

        const match =
          String(row[1] || "");

        const winner =
          String(row[3] || "")
            .trim();

        const stake =
          Number(row[2]) || 0;

        const gameType =
          String(row[4] || "")
            .trim();

        const cleanedMatch =

          match
            .replace(/\s+vs\s+/i," vs ")
            .trim();

        const parts =
          cleanedMatch.split(" vs ");

        if(parts.length !== 2){
          return;
        }

        const p1 =
          parts[0].trim();

        const p2 =
          parts[1].trim();

        const key = [

          row[0],

          p1,

          p2,

          winner,

          stake

        ].join("|");

        if(existingKeys.has(key)){

  Logger.log(
    "Duplicate skipped: " +
    key
  );

  return;
}

        careerSheet.appendRow([

          row[0],

          p1,

          p2,

          winner,

          stake,

          gameType,

          row[5] || ""

        ]);

        existingKeys.add(key);

      } catch(error){

        Logger.log(
          "Backfill row failed: " +
          error
        );

      }

    });

  Logger.log(
    "Career match backfill complete."
  );

}
function rebuildCareerStatsSheet(){

  const careerSheet =
    getSheet("CAREER_STATS");

  const playersSheet =
    getSheet("PLAYERS");

  const playersData =
    playersSheet
      .getDataRange()
      .getValues();

  const careerStats =
    calculateCareerStats();

  careerSheet.clearContents();

  careerSheet.appendRow([

    "playerId",
    "playerName",
    "careerWins",
    "careerLosses",
    "careerGames",
    "highestElo",
    "careerPoints",
    "bestWinStreak",
    "championships",
    "podiums",
    "rivalWins",
    "eliminations",
    "seasonsPlayed"

  ]);

  playersData
    .slice(1)
    .forEach(row => {

      const playerName =
        String(row[0] || "").trim();

      const playerId =
        String(row[13] || "").trim();

      const career =
        careerStats[playerName] || {};

      careerSheet.appendRow([

        playerId,

        playerName,

        Number(
          career.totalWins || 0
        ),

        Number(
          career.totalLosses || 0
        ),

        Number(
          career.totalMatches || 0
        ),

        Number(
          row[19] || 1000
        ),

        Number(
          career.totalPoints || 0
        ),

        Number(
          getPlayerWinStreak(playerName) || 0
        ),

        0,
        0,
        0,
        0,
        1

      ]);

    });

}

function restorePlayerIdsFromAccounts(){

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const playersSheet =
    ss.getSheetByName(
      "PLAYERS"
    );

  const accountsSheet =
    ss.getSheetByName(
      "ACCOUNTS"
    );

  if(
    !playersSheet ||
    !accountsSheet
  ){

    throw new Error(
      "Missing PLAYERS or ACCOUNTS sheet"
    );

  }

  const playerData =
    playersSheet
      .getDataRange()
      .getValues();

  const accountData =
    accountsSheet
      .getDataRange()
      .getValues();

  const accountLookup = {};

  accountData
    .slice(1)
    .forEach(row => {

const username =
  String(row[1] || "").trim();

const linkedId =
  String(row[3] || "").trim();

      if(
        linkedId &&
        username
      ){

        accountLookup[
          username.toLowerCase()
        ] = linkedId;

      }

    });

  playerData
    .slice(1)
    .forEach((row,index) => {

      const playerName =
        String(row[0] || "")
          .trim();

      const existingId =
        String(row[13] || "")
          .trim();

      if(existingId){
        return;
      }

      const restoredId =

        accountLookup[
          playerName.toLowerCase()
        ];

      if(restoredId){

        playersSheet
          .getRange(
            index + 2,
            14
          )
          .setValue(
            restoredId
          );

        Logger.log(
          `${playerName} -> ${restoredId}`
        );

      }

    });

}


function inspectCareerMatches(){

  const sheet =
    getSheet("CAREER_MATCHES");

  const data =
    sheet
      .getDataRange()
      .getValues();

  Logger.log(
    JSON.stringify(
      data.slice(0,10),
      null,
      2
    )
  );

}

function rebuildLeagueDataCache() {
  const fresh = getLeagueData();
  const json  = JSON.stringify(fresh);
  Logger.log('Cache size: ' + json.length + ' bytes');

  try {
    CacheService.getScriptCache().put('TKDL_LEAGUE_DATA', json, 21600);
    Logger.log('CacheService written OK');
  } catch(e) {
    Logger.log('CacheService failed: ' + e);
  }

  try {
    PropertiesService.getScriptProperties().setProperty('TKDL_LEAGUE_DATA', json);
  } catch(e) {
    Logger.log('PropertiesService too large — CacheService only');
  }

  Logger.log('League cache rebuilt. ' + json.length + ' bytes.');
}

function getLeagueDataCached() {
  let cached = CacheService.getScriptCache().get('TKDL_LEAGUE_DATA');
  if (!cached) {
    cached = PropertiesService.getScriptProperties().getProperty('TKDL_LEAGUE_DATA');
  }
  if (cached) {
    Logger.log('Serving cache.');
    return JSON.parse(cached);
  }
  Logger.log('No cache found. Building.');
  
  rebuildLeagueDataCache();
  const rebuilt = CacheService.getScriptCache().get('TKDL_LEAGUE_DATA')
    || PropertiesService.getScriptProperties().getProperty('TKDL_LEAGUE_DATA');
  return JSON.parse(rebuilt);
}
/* =========================================================
   DEDUPLICATE PLAYER ACHIEVEMENTS
      Run once to clean duplicate rows from PLAYER_ACHIEVEMENTS.
         Keeps only the FIRST unlock of each playerId+achievementId combo.
         ========================================================= */

         function deduplicateAchievements(){

           const ss =
               SpreadsheetApp.openById(
                     "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
                         );

                           const sheet =
                               ss.getSheetByName("PLAYER_ACHIEVEMENTS");

                                 if(!sheet){
                                     Logger.log("PLAYER_ACHIEVEMENTS not found");
                                         return;
                                           }

                                             const data =
                                                 sheet.getDataRange().getValues();

                                                   if(data.length <= 1){
                                                       Logger.log("No data to deduplicate");
                                                           return;
                                                             }

                                                               const headers = data[0];
                                                                 const rows    = data.slice(1);

                                                                   const seen    = new Set();
                                                                     const keep    = [];
                                                                       let   removed = 0;

                                                                         rows.forEach(row => {

                                                                             const playerId     = String(row[1] || "").trim();
                                                                                 const achievementId = String(row[2] || "").trim();

                                                                                     if(!playerId || !achievementId){
                                                                                           return; // skip blank rows
                                                                                               }

                                                                                                   const key = playerId + "|" + achievementId;

                                                                                                       if(seen.has(key)){
                                                                                                             removed++;
                                                                                                                   return;
                                                                                                                       }

                                                                                                                           seen.add(key);
                                                                                                                               keep.push(row);

                                                                                                                                 });

                                                                                                                                   /* Rewrite the sheet */
                                                                                                                                     sheet.clearContents();
                                                                                                                                       sheet.appendRow(headers);

                                                                                                                                         if(keep.length > 0){
                                                                                                                                             sheet
                                                                                                                                                   .getRange(2, 1, keep.length, headers.length)
                                                                                                                                                         .setValues(keep);
                                                                                                                                                           }

                                                                                                                                                             Logger.log(
                                                                                                                                                                 "Deduplication complete. Kept: " + keep.length +
                                                                                                                                                                     " | Removed: " + removed
                                                                                                                                                                       );

                                                                                                                                                                       }

 function rebuildAllCareerStats() {
  const ss           = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
  const matchesSheet = ss.getSheetByName('CAREER_MATCHES');
  const playersSheet = ss.getSheetByName('PLAYERS');
  if (!matchesSheet || !playersSheet) { Logger.log('Missing sheets'); return; }
  const stats = {}; const streaks = {};
  matchesSheet.getDataRange().getValues().slice(1).forEach(row => {
    const p1 = String(row[1] || '').trim().toLowerCase();
    const p2 = String(row[2] || '').trim().toLowerCase();
    const winner = String(row[3] || '').trim().toLowerCase();
    if (!p1 || !p2 || !winner) return;
    const loser = winner === p1 ? p2 : p1;
    [p1, p2].forEach(n => {
      if (!stats[n]) stats[n] = { totalWins:0, totalLosses:0, totalMatches:0 };
      if (!streaks[n]) streaks[n] = { current:0, best:0 };
      stats[n].totalMatches++;
    });
    stats[winner].totalWins++;
    streaks[winner].current++;
    if (streaks[winner].current > streaks[winner].best) streaks[winner].best = streaks[winner].current;
    stats[loser].totalLosses++;
    streaks[loser].current = 0;
  });
  const playersData = playersSheet.getDataRange().getValues();
  let updated = 0;
  for (let i = 1; i < playersData.length; i++) {
    const name = String(playersData[i][0] || '').trim().toLowerCase();
    const career = stats[name];
    if (!name || !career) continue;
    playersSheet.getRange(i + 1, 15).setValue(career.totalWins);
    playersSheet.getRange(i + 1, 16).setValue(career.totalLosses);
    playersSheet.getRange(i + 1, 17).setValue(career.totalMatches);
    updated++;
  }
  Logger.log('Updated career stats for ' + updated + ' players');
  rebuildLeagueDataCache();
  Logger.log('Career stats rebuilt.');
}

function rebuildCareerLeaderboard() {
  const ss           = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
  const matchesSheet = ss.getSheetByName('CAREER_MATCHES');
  const playersSheet = ss.getSheetByName('PLAYERS');
  if (!matchesSheet || !playersSheet) return;
  const stats = {}; const streaks = {};
  matchesSheet.getDataRange().getValues().slice(1).forEach(row => {
    const p1 = String(row[1] || '').trim().toLowerCase();
    const p2 = String(row[2] || '').trim().toLowerCase();
    const winner = String(row[3] || '').trim().toLowerCase();
    const season = String(row[6] || '').trim();
    if (!p1 || !p2 || !winner) return;
    const loser = winner === p1 ? p2 : p1;
    [p1, p2].forEach(n => {
      if (!stats[n]) stats[n] = { wins:0, losses:0, games:0, seasons: new Set() };
      if (!streaks[n]) streaks[n] = { current:0, best:0 };
      stats[n].games++;
      if (season) stats[n].seasons.add(season);
    });
    stats[winner].wins++;
    streaks[winner].current++;
    if (streaks[winner].current > streaks[winner].best) streaks[winner].best = streaks[winner].current;
    stats[loser].losses++;
    streaks[loser].current = 0;
  });
  const playerMeta = {};
  playersSheet.getDataRange().getValues().slice(1).forEach(row => {
    const name = String(row[0] || '').trim().toLowerCase();
    if (!name) return;
    playerMeta[name] = {
      displayName: String(row[0] || '').trim(),
      playerId:    String(row[13] || '').trim(),
      elo:         Number(row[8])  || 1000,
      status:      String(row[1]  || 'ACTIVE').trim()
    };
  });
  const allNames = new Set([...Object.keys(stats), ...Object.keys(playerMeta)]);
  const rows = [];
  allNames.forEach(name => {
    const s = stats[name]      || { wins:0, losses:0, games:0, seasons: new Set() };
    const m = playerMeta[name] || { displayName: name, playerId:'', elo:1000, status:'ACTIVE' };
    const str = streaks[name]  || { best:0 };
    rows.push({
      displayName: m.displayName || name,
      playerId: m.playerId, wins: s.wins, losses: s.losses, games: s.games,
      winRate: s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0,
      elo: m.elo, bestStreak: str.best, seasons: s.seasons.size, status: m.status
    });
  });
  rows.sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : b.elo - a.elo);
  let clSheet = ss.getSheetByName('CAREER_LEADERBOARD');
  if (!clSheet) clSheet = ss.insertSheet('CAREER_LEADERBOARD');
  clSheet.clearContents();
  clSheet.appendRow(['Rank','Player','PlayerId','CareerWins','CareerLosses',
                     'CareerGames','WinRate','ELO','BestStreak','Seasons','Status','LastUpdated']);
  const now = new Date();
  rows.forEach((r, i) => {
    clSheet.appendRow([i+1, r.displayName, r.playerId, r.wins, r.losses,
                       r.games, r.winRate, r.elo, r.bestStreak, r.seasons, r.status, now]);
  });
  Logger.log('Career leaderboard rebuilt: ' + rows.length + ' players');
}

function getCareerLeaderboard() {
  const sheet = getSheet('CAREER_LEADERBOARD');
  if (!sheet || sheet.getLastRow() <= 1) return [];
  return sheet.getDataRange().getValues().slice(1)
    .filter(r => r[0] && r[1])
    .map(r => ({
      rank: Number(r[0]) || 0, name: String(r[1]) || '',
      playerId: String(r[2]) || '', careerWins: Number(r[3]) || 0,
      careerLosses: Number(r[4]) || 0, careerGames: Number(r[5]) || 0,
      winRate: Number(r[6]) || 0, elo: Number(r[7]) || 1000,
      bestStreak: Number(r[8]) || 0, seasons: Number(r[9]) || 0,
      status: String(r[10]) || 'ACTIVE'
    }));
}

function normalisePlayerStatuses() {
  const ss    = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
  const sheet = ss.getSheetByName('PLAYERS');
  const data  = sheet.getDataRange().getValues();
  let fixed   = 0;
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const current = String(data[i][1] || '').trim();
    const upper   = current.toUpperCase();
    let   correct = current;
    if (upper === 'TRUE'  || upper === 'ACTIVE')   correct = 'ACTIVE';
    if (upper === 'FALSE' || upper === 'INACTIVE')  correct = 'INACTIVE';
    if (correct !== current) {
      sheet.getRange(i + 1, 2).setValue(correct);
      fixed++;
    }
  }
  Logger.log('Status normalisation complete. Fixed: ' + fixed);
  rebuildLeagueDataCache();
}                                                                                                                                                                      

// ============================================================
//  ADD MISSING SEASON 1 PLAYERS
//  Run once to backfill Aiden/Brodie/Joanna/Roddie/Scott
// ============================================================
function addMissingCareerPlayers() {
  const ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
  const sheet = ss.getSheetByName('PLAYERS');
  if (!sheet) { Logger.log('PLAYERS sheet not found'); return; }

  const data = sheet.getDataRange().getValues();
  const existing = new Set(data.slice(1).map(r => String(r[0]||'').trim().toLowerCase()));

  // Season 1 (FEB_2026) players missing from current roster
  // Cols: Player|Status|StartPts|CurPts|Games|Wins|Losses|HighBal|ELO|TIER|JOIN_DATE|SEASON|LEAGUE_ACTIVE|PLAYER_ID|CW|CL|CG|RANK|PREV_RANK|PEAK_ELO
  const missing = [
    ['Aiden',  'INACTIVE', 0, 0, 0, 0, 0, 0, 1000, 'BRONZE', 'FEB_2026', 'FEB_2026', false, 'aiden',  0, 0, 0, 0, 0, 1000],
    ['Brodie', 'INACTIVE', 0, 0, 0, 0, 0, 0, 1000, 'BRONZE', 'FEB_2026', 'FEB_2026', false, 'brodie', 0, 0, 0, 0, 0, 1000],
    ['Joanna', 'INACTIVE', 0, 0, 0, 0, 0, 0, 1000, 'BRONZE', 'FEB_2026', 'FEB_2026', false, 'joanna', 0, 0, 0, 0, 0, 1000],
    ['Roddie', 'INACTIVE', 0, 0, 0, 0, 0, 0, 1000, 'BRONZE', 'FEB_2026', 'FEB_2026', false, 'roddie', 0, 0, 0, 0, 0, 1000],
    ['Scott',  'INACTIVE', 0, 0, 0, 0, 0, 0, 1000, 'BRONZE', 'FEB_2026', 'FEB_2026', false, 'scott',  0, 0, 0, 0, 0, 1000],
  ];

  let added = 0;
  missing.forEach(row => {
    if (!existing.has(row[0].toLowerCase())) {
      sheet.appendRow(row);
      added++;
      Logger.log('Added: ' + row[0]);
    }
  });

  // Fix "ryan" lowercase typo in CAREER_MATCHES
  const cmSheet = ss.getSheetByName('CAREER_MATCHES');
  if (cmSheet) {
    const cmData = cmSheet.getDataRange().getValues();
    let fixed = 0;
    for (let i = 1; i < cmData.length; i++) {
      let changed = false;
      [1, 2, 3].forEach(col => {
        if (cmData[i][col] === 'ryan') {
          cmSheet.getRange(i + 1, col + 1).setValue('Ryan');
          fixed++;
          changed = true;
        }
      });
    }
    Logger.log('Fixed ' + fixed + ' lowercase ryan entries in CAREER_MATCHES');
  }

  Logger.log('Done. Added ' + added + ' players.');
  return { added, message: 'Run rebuildAllCareerStats() next to recalculate.' };
}

function diagCareerStats() {
  const stats = calculateCareerStats();
  const keys = Object.keys(stats);
  Logger.log('Total players in stats: ' + keys.length);
  Logger.log('Keys: ' + keys.join(', '));
  keys.slice(0,5).forEach(k => {
    const s = stats[k];
    Logger.log(k + ': wins=' + s.totalWins + ' losses=' + s.totalLosses + ' matches=' + s.totalMatches);
  });
  // Also check PLAYERS sheet first player name
  const sheet = getSheet('PLAYERS');
  const data = sheet.getDataRange().getValues();
  Logger.log('PLAYERS first 3 names: ' + data.slice(1,4).map(r=>r[0]).join(', '));
  // Check lookup
  const firstPlayer = String(data[1][0]||'').trim().toLowerCase();
  Logger.log('Lookup "' + firstPlayer + '": wins=' + (stats[firstPlayer] ? stats[firstPlayer].totalWins : 'NOT FOUND'));
}

function diagPlayersStatus() {
  const data = getSheet('PLAYERS').getDataRange().getValues();
  data.slice(1).forEach(r => {
    Logger.log('Name=' + r[0] + ' Status=' + r[1] + ' CW=' + r[14] + ' CL=' + r[15] + ' CG=' + r[16]);
  });
}
// ============================================================
//  SYNC FORM_SUBMISSIONS → CAREER_MATCHES
//  Run when CAREER_MATCHES is missing entries
// ============================================================
function syncFormSubmissionsToCareerMatches() {
  const ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
  const fsSheet = ss.getSheetByName('FORM_SUBMISSIONS');
  const cmSheet = ss.getSheetByName('CAREER_MATCHES');
  if (!fsSheet || !cmSheet) { Logger.log('Missing sheets'); return; }

  const currentSeason = getCurrentSeason() || 'MAY_2026';

  // Build dedup set from CAREER_MATCHES using content signature (not timestamp)
  const cmData = cmSheet.getDataRange().getValues();
  const cmSigs = new Set();
  cmData.slice(1).forEach(function(row) {
    if (String(row[6]||'') === 'FEB_2026') return; // skip archived season
    var sig = [row[1],row[2],row[3]].map(function(x){return String(x||'').trim().toLowerCase();}).join('|');
    if (sig !== '||') cmSigs.add(sig);
  });
  Logger.log('Existing MAY sigs in CAREER_MATCHES: ' + cmSigs.size);

  // Parse FORM_SUBMISSIONS and add missing entries
  const fsData = fsSheet.getDataRange().getValues();
  var added = 0;
  fsData.slice(1).forEach(function(row) {
    var ts       = row[0];
    var raw      = String(row[1] || '').trim();
    var stake    = Number(row[2]) || 0;
    var winner   = String(row[3] || '').trim();
    var gameType = String(row[4] || '').trim();
    var season   = String(row[5] || '').trim() || currentSeason;

    if (!raw || !winner) return;

    // Parse "P1 vs P2"
    var parts = raw.split(/ vs.? /i);
    if (parts.length !== 2) return;
    var p1 = parts[0].trim();
    var p2 = parts[1].trim();
    if (!p1 || !p2) return;

    var sig = [p1,p2,winner].map(function(x){return x.toLowerCase();}).join('|');
    if (cmSigs.has(sig)) return;

    cmSheet.appendRow([ts, p1, p2, winner, stake, gameType, season]);
    cmSigs.add(sig);
    added++;
    Logger.log('Added: ' + p1 + ' vs ' + p2 + ' winner=' + winner);
  });

  // Fix null season values in CAREER_MATCHES
  var cmData2 = cmSheet.getDataRange().getValues();
  var fixed = 0;
  for (var i = 1; i < cmData2.length; i++) {
    if (!String(cmData2[i][6] || '').trim()) {
      cmSheet.getRange(i + 1, 7).setValue(currentSeason);
      fixed++;
    }
  }

  Logger.log('Sync complete. Added ' + added + ' entries, fixed ' + fixed + ' season values.');
  return {added: added, fixed: fixed};
}

// ============================================================
//  REBUILD CAREER_MATCHES SEASON 2 FROM FORM_SUBMISSIONS
//  Wipes all non-FEB_2026 entries and replaces with FS data
// ============================================================
function rebuildCareerMatchesFromForms() {
  const ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
  const fsSheet = ss.getSheetByName('FORM_SUBMISSIONS');
  const cmSheet = ss.getSheetByName('CAREER_MATCHES');
  if (!fsSheet || !cmSheet) { Logger.log('Missing sheets'); return; }

  const currentSeason = getCurrentSeason() || 'MAY_2026';

  // Step 1: Keep only FEB_2026 rows in CAREER_MATCHES
  const cmData = cmSheet.getDataRange().getValues();
  const headers = cmData[0];
  const keepRows = cmData.filter(function(row, i) {
    if (i === 0) return true; // always keep header
    return String(row[6] || '').trim() === 'FEB_2026';
  });
  Logger.log('Keeping ' + (keepRows.length - 1) + ' FEB_2026 rows');

  // Clear and rewrite
  cmSheet.clearContents();
  cmSheet.getRange(1, 1, keepRows.length, headers.length).setValues(keepRows);

  // Step 2: Add ALL FORM_SUBMISSIONS as current season
  const fsData = fsSheet.getDataRange().getValues();
  var added = 0;
  fsData.slice(1).forEach(function(row) {
    var ts       = row[0];
    var raw      = String(row[1] || '').trim();
    var stake    = Number(row[2]) || 0;
    var winner   = String(row[3] || '').trim();
    var gameType = String(row[4] || '').trim();
    var season   = String(row[5] || '').trim() || currentSeason;

    if (!raw || !winner) return;

    // Parse "P1 vs P2"
    var parts = raw.split(/ vs.? /i);
    if (parts.length !== 2) return;
    var p1 = parts[0].trim();
    var p2 = parts[1].trim();
    if (!p1 || !p2) return;

    cmSheet.appendRow([ts, p1, p2, winner, stake, gameType, season]);
    added++;
  });

  Logger.log('Added ' + added + ' FORM_SUBMISSIONS entries as ' + currentSeason);
  Logger.log('CAREER_MATCHES total: ' + (keepRows.length - 1 + added) + ' rows');
  // Auto-rebuild stats after CM refresh
  rebuildAllCareerStats();
  rebuildCareerLeaderboard();
  return { kept: keepRows.length - 1, added: added };
}

// ============================================================
//  GET SEASON STANDINGS
//  Called by doGet ?function=getSeasonStandingsData&season=X
// ============================================================
function getSeasonStandings(seasonName) {
  const ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
  const cmSheet = ss.getSheetByName('CAREER_MATCHES');
  const plSheet = ss.getSheetByName('PLAYERS');
if (seasonName.indexOf('Season 1') !== -1) {

  const febSheet =
    ss.getSheetByName(
      'FEB_2026_FINAL_STANDINGS'
    );

  if (!febSheet) {
    return [];
  }

  const rows =
    febSheet
      .getDataRange()
      .getValues()
      .slice(1);

  return rows.map(function(row) {

    return {

      rank: row[0],
      name: row[1],
      wins: row[2],
      losses: row[3],
      matches: row[4],
      points: row[7],
      elo: row[8] || ''

    };

  });

}


if (seasonName.indexOf('Season 2') !== -1) {

  const maySheet =
    ss.getSheetByName(
      'MAY_2026_FINAL_ARCHIVE'
    );

  if (!maySheet) {
    return [];
  }

  const rows =
    maySheet
      .getDataRange()
      .getValues()
      .slice(1);

  return rows.map(function(row) {

    return {

      rank: row[0],
      name: row[1],
      points: row[2],
      wins: row[3],
      losses: row[4],
      matches: row[5],
      elo: ''

    };

  });

}


if (!cmSheet) return [];
  if (!cmSheet) return [];

  // Map friendly season names → internal codes
const seasonMap = {
  'Season 1': 'FEB_2026',
  'FEB_2026': 'FEB_2026',
  'February 2026': 'FEB_2026',

  'Season 2': 'MAY_2026',
  'MAY_2026': 'MAY_2026',
  'MAY-2026_2026': 'MAY_2026'
};
  // Find the CAREER_MATCHES season code
  let seasonCode = null;
  for (var key in seasonMap) {
    if (seasonName.indexOf(key) !== -1 || key.indexOf(seasonName) !== -1) {
      seasonCode = seasonMap[key];
      break;
    }
  }
  // Default: try direct match
  if (!seasonCode) seasonCode = seasonName;

  Logger.log('getSeasonStandings: seasonName=' + seasonName + ' code=' + seasonCode);

  // Calculate standings from CAREER_MATCHES for this season
  const matches = cmSheet.getDataRange().getValues().slice(1)
    .filter(function(row) { return String(row[6]||'').trim() === seasonCode; });

  if (matches.length === 0) return [];

  // Build stats
  var stats = {};
  matches.forEach(function(row) {
    var p1 = String(row[1]||'').trim();
    var p2 = String(row[2]||'').trim();
    var winner = String(row[3]||'').trim();
    var stake  = Number(row[4]) || 0;
    if (!p1 || !p2) return;

[p1, p2].forEach(function(p) {
  if (!stats[p]) stats[p] = {
    wins:0,
    losses:0,
    points:25,
    elo:1000
  };
});

    if (winner === p1) {
      stats[p1].wins++;
      stats[p1].points += stake;
      stats[p2].losses++;
      stats[p2].points -= stake;
    } else if (winner === p2) {
      stats[p2].wins++;
      stats[p2].points += stake;
      stats[p1].losses++;
      stats[p1].points -= stake;
    }
  });

  // Get ELO from PLAYERS sheet if available
  if (plSheet) {
    var plData = plSheet.getDataRange().getValues();
    plData.slice(1).forEach(function(row) {
      var name = String(row[0]||'').trim();
      if (stats[name]) stats[name].elo = Number(row[8]) || 1000;
    });
  }

  // Build sorted standings by wins desc then losses asc
  var standings = Object.entries(stats)
    .map(function(entry) {
      var name = entry[0], s = entry[1];
      return { name: name, wins: s.wins, losses: s.losses,
               points: s.points, elo: s.elo,
               matches: s.wins + s.losses };
    })
    .sort(function(a,b) {

  if (seasonCode === 'FEB_2026') {

    return (
      b.wins - a.wins ||
      a.losses - b.losses
    );

  }

  return (
    b.points - a.points ||
    b.elo - a.elo
  );

});

  standings.forEach(function(p, i) { p.rank = i + 1; });
  Logger.log('Returning ' + standings.length + ' standings for ' + seasonCode);
  return standings;
}


/* =========================
   CRITICAL MISSING FUNCTIONS
   Add these to LEAGUEAPI.gs to fix crashes
========================= */

function getPlayerWinStreak(playerName) {
  const sheet = getSheet("CAREER_MATCHES");
  if (!sheet) return 0;
  
  const data = sheet.getDataRange().getValues().slice(1);
  if (data.length === 0) return 0;
  
  let streak = 0;
  
  // Iterate from most recent (end) backwards
  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    const p1 = String(row[1] || "").trim();
    const p2 = String(row[2] || "").trim();
    const winner = String(row[3] || "").trim();
    
    // Skip if player not in this match
    if (p1.toLowerCase() !== playerName.toLowerCase() && 
        p2.toLowerCase() !== playerName.toLowerCase()) {
      continue;
    }
    
    // Increment streak if player won, otherwise break
    if (winner.toLowerCase() === playerName.toLowerCase()) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

function getPlayerLossStreak(playerName) {
  const sheet = getSheet("CAREER_MATCHES");
  if (!sheet) return 0;
  
  const data = sheet.getDataRange().getValues().slice(1);
  if (data.length === 0) return 0;
  
  let streak = 0;
  
  // Iterate from most recent (end) backwards
  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    const p1 = String(row[1] || "").trim();
    const p2 = String(row[2] || "").trim();
    const winner = String(row[3] || "").trim();
    
    // Skip if player not in this match
    if (p1.toLowerCase() !== playerName.toLowerCase() && 
        p2.toLowerCase() !== playerName.toLowerCase()) {
      continue;
    }
    
    // Increment streak if player lost, otherwise break
    if (winner.toLowerCase() !== playerName.toLowerCase()) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

/* =========================
   PLAYER PROFILE BUILDERS
========================= */

function buildPlayerProfile(playerId, context) {
  const players = context.players || {};
  const player = Object.values(players).find(p => p.playerId === playerId);
  
  if (!player) {
    return {
      playerId: playerId,
      name: 'Unknown',
      visuals: { cardTheme: 'default', auraGlow: 'standard', prestigeBorder: 'default' },
      visualIdentity: { theme: 'default', glow: 'standard', border: 'default' },
      title: 'Competitor',
      subtitle: 'Active Competitor',
      threatLevel: 'medium',
      signatureTrait: 'Balanced',
      aura: { tier: 'STANDARD' },
      prestige: { level: 'ROOKIE' },
      rivalrySpotlight: { hasRivalry: false, spotlight: {} }
    };
  }
  
  // Determine threat level based on ELO
  let threatLevel = 'low';
  if (player.elo >= 1100) threatLevel = 'high';
  else if (player.elo >= 1000) threatLevel = 'medium';
  
  // Determine aura glow based on ELO tier
  let auraGlow = 'bronze';
  if (player.elo >= 1100) auraGlow = 'gold';
  else if (player.elo >= 1000) auraGlow = 'silver';
  
  return {
    playerId: playerId,
    name: player.name,
    visuals: {
      cardTheme: 'default',
      auraGlow: auraGlow,
      prestigeBorder: 'default',
      archetypeLabel: 'Competitor'
    },
    visualIdentity: {
      theme: 'default',
      glow: 'standard',
      border: 'default'
    },
    title: 'Competitor',
    subtitle: 'Active Competitor',
    threatLevel: threatLevel,
    signatureTrait: 'Balanced Competitor',
    aura: { tier: 'STANDARD' },
    prestige: { level: 'ROOKIE' },
    rivalrySpotlight: { hasRivalry: false, spotlight: {} }
  };
}

function buildAllPlayerProfiles(context) {
  const players = context.players || {};
  const profiles = {};
  
  try {
    Object.values(players).forEach(player => {
      if (player.playerId) {
        profiles[player.playerId] = buildPlayerProfile(player.playerId, context);
      }
    });
  } catch(err) {
    Logger.log('buildAllPlayerProfiles error: ' + err);
  }
  
  return profiles;
}

function buildLeagueNarratives(context) {
  // Generates narrative context for league state
  // Currently returns empty - can be expanded with story generation
  try {
    const players = context.players || [];
    const matches = context.matches || [];
    
    return {
      topStories: [],
      emergingRivals: [],
      upsets: [],
      streaks: []
    };
  } catch(err) {
    Logger.log('buildLeagueNarratives error: ' + err);
    return {};
  }
}

function getArchivedMatches() {
  // Returns historical matches from previous seasons
  const sheet = getSheet("CAREER_MATCHES");
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return [];
  
  return data
    .slice(1)
    .filter(row => {
      const season = String(row[6] || "").trim();
      // Archive matches from past seasons (FEB, any completed season)
      return season === "FEB_2026" || (season && season !== "JUNE_2026");
    })
    .map(row => ({
      timestamp: row[0],
      player1: String(row[1] || "").trim(),
      player2: String(row[2] || "").trim(),
      winner: String(row[3] || "").trim(),
      stake: Number(row[4]) || 0,
      gameType: String(row[5] || "").trim(),
      season: String(row[6] || "").trim()
    }));
}

function getAchievementMetadataV2() {
  // Returns achievement metadata as object keyed by achievement ID
  const sheet = getSheet("ACHIEVEMENT_METADATA");
  if (!sheet) return {};
  
  const data = sheet.getDataRange().getValues();
  const metadata = {};
  
  data.slice(1).forEach(row => {
    if (row[1]) { // ID column exists
      const id = String(row[1]).trim();
      metadata[id] = {
        id: id,
        name: String(row[0] || "").trim(),
        category: String(row[2] || "").trim(),
        rarity: String(row[3] || "Common").trim(),
        reelPriority: Number(row[4]) || 0,
        hidden: String(row[5] || "FALSE").trim().toUpperCase() === "TRUE",
        icon: String(row[6] || "🏆").trim(),
        description: String(row[7] || "").trim(),
        criteriaType: String(row[8] || "").trim(),
        criteriaValue: String(row[9] || "").trim(),
        engineType: String(row[10] || "").trim(),
        secondaryCriteriaType: String(row[11] || "").trim(),
        secondaryCriteriaValue: String(row[12] || "").trim(),
        trackingScope: String(row[13] || "CAREER").trim()
      };
    }
  });
  
  return metadata;
}

function getPlayersData() {
  // Returns all player data from PLAYERS sheet
  const sheet = getSheet("PLAYERS");
  if (!sheet) return [];
  return sheet.getDataRange().getValues();
}

function getSheet(name) {
  // Helper to get sheet by name from main spreadsheet
  try {
    const ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
    const sheet = ss.getSheetByName(name);
    return sheet || null;
  } catch(e) {
    Logger.log('getSheet error for "' + name + '": ' + e);
    return null;
  }
}


/* =========================
   FIX CAREER_MATCHES SEASONS CORRECTLY
   Differentiates between FEB_2026, MAY_2026, and JUNE_2026 based on:
   1. Season 1 (FEB_2026): Dummy/historical matches (stake=0, all on 5/25)
   2. Season 2 (MAY_2026): Actual games played 5/13-5/31
   3. Season 3 (JUNE_2026): Current season (no games yet)
========================= */

function fixCareerMatchesSeasonsProperly() {
  const ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
  const sheet = ss.getSheetByName('CAREER_MATCHES');
  const data = sheet.getDataRange().getValues();
  
  let fixed = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    if (!row[0]) break; // end of data
    
    const timestamp = String(row[0] || "");
    const stake = Number(row[4]) || 0;
    const currentSeason = String(row[6] || "").trim();
    
    let correctSeason = "";
    
    // Season 1 (FEB_2026): Historical/dummy data
    // Characteristics: stake=0, all timestamped 5/25 (backfilled), from old data
    if (stake === 0 && timestamp.includes("5/25")) {
      correctSeason = "FEB_2026";
    }
    // Season 2 (MAY_2026): Actual games played in May
    // Characteristics: stake > 0, dated 5/13 through 5/31
    else if (stake > 0 && timestamp.includes("5/")) {
      correctSeason = "MAY_2026";
    }
    // Season 3 (JUNE_2026): Current season
    // Characteristics: any games from June onwards (currently none)
    else if (timestamp.includes("6/")) {
      correctSeason = "JUNE_2026";
    }
    
    // Update if wrong or missing
    if (correctSeason && currentSeason !== correctSeason) {
      sheet.getRange(i + 1, 7).setValue(correctSeason);
      fixed++;
      Logger.log(
        `Row ${i+1}: "${currentSeason}" → "${correctSeason}" | ` +
        `Stake=${stake} Date=${timestamp}`
      );
    }
  }
  
  Logger.log(`Season correction complete: ${fixed} rows updated`);
  return { fixed: fixed };
}

/* =========================
   FIX SPECIFIC PLAYER NAME ISSUES
========================= */

function fixPlayerNameCaseSensitivity() {
  const ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
  const sheet = ss.getSheetByName('CAREER_MATCHES');
  const data = sheet.getDataRange().getValues();
  
  // Build canonical names from PLAYERS sheet
  const playersSheet = ss.getSheetByName('PLAYERS');
  const playersData = playersSheet.getDataRange().getValues();
  const canonicalNames = {};
  
  playersData.slice(1).forEach(row => {
    if (row[0]) {
      canonicalNames[String(row[0]).toLowerCase()] = String(row[0]);
    }
  });
  
  let fixed = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) break;
    
    // Check columns 1, 2, 3 (Player1, Player2, Winner)
    [1, 2, 3].forEach(col => {
      const rawName = String(row[col] || "").trim();
      if (rawName) {
        const canonical = canonicalNames[rawName.toLowerCase()];
        if (canonical && canonical !== rawName) {
          sheet.getRange(i + 1, col + 1).setValue(canonical);
          fixed++;
          Logger.log(`Row ${i+1} Col ${col+1}: "${rawName}" → "${canonical}"`);
        }
      }
    });
  }
  
  Logger.log(`Case sensitivity fix complete: ${fixed} names corrected`);
  return { fixed: fixed };
}

/* =========================
   FIX SPECIFIC PROBLEM ROWS
   Row 54: "ryan" should be "Ryan"
   Row 70: "v" should be "MAY_2026"
========================= */

function fixSpecificProblematicRows() {
  const ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
  const sheet = ss.getSheetByName('CAREER_MATCHES');
  
  // Row 54, Column 3 (Player2): "ryan" → "Ryan"
  sheet.getRange(54, 3).setValue("Ryan");
  Logger.log('Row 54, Col 3: Fixed "ryan" → "Ryan"');
  
  // Row 70, Column 7 (Season): "v" → "MAY_2026"
  sheet.getRange(70, 7).setValue("MAY_2026");
  Logger.log('Row 70, Col 7: Fixed "v" → "MAY_2026"');
  
  return { fixed: 2 };
}

/* =========================
   MASTER FIX FUNCTION - RUN THIS ONE
   Executes all fixes in correct order
========================= */

function fixAllCareerMatchIssues() {
  Logger.log('=== Starting CAREER_MATCHES fixes ===');
  
  try {
    const result1 = fixPlayerNameCaseSensitivity();
    Logger.log('✓ Player names fixed: ' + result1.fixed);
  } catch(e) {
    Logger.log('✗ Player name fix failed: ' + e);
  }
  
  try {
    const result2 = fixSpecificProblematicRows();
    Logger.log('✓ Problematic rows fixed: ' + result2.fixed);
  } catch(e) {
    Logger.log('✗ Problematic rows fix failed: ' + e);
  }
  
  try {
    const result3 = fixCareerMatchesSeasonsProperly();
    Logger.log('✓ Seasons corrected: ' + result3.fixed);
  } catch(e) {
    Logger.log('✗ Season fix failed: ' + e);
  }
  
  Logger.log('=== All fixes complete ===');
  Logger.log('Now run: rebuildAllCareerStats(); rebuildLeagueDataCache();');
}

/* =========================
   REBUILD AND CACHE
========================= */

function rebuildEverythingAfterFixes() {
  Logger.log('=== Rebuilding all data ===');
  
  try {
    rebuildAllCareerStats();
    Logger.log('✓ Career stats rebuilt');
  } catch(e) {
    Logger.log('✗ Career stats rebuild failed: ' + e);
  }
  
  try {
    rebuildCareerLeaderboard();
    Logger.log('✓ Career leaderboard rebuilt');
  } catch(e) {
    Logger.log('✗ Career leaderboard rebuild failed: ' + e);
  }
  
  try {
    rebuildLeagueDataCache();
    Logger.log('✓ League cache rebuilt');
  } catch(e) {
    Logger.log('✗ League cache rebuild failed: ' + e);
  }
  
  Logger.log('=== Rebuild complete ===');
}


// ===== SEASON NORMALIZATION =====
function normalizeSeasonCode(s) {
  var MONTHS = {jan:'JAN',feb:'FEB',mar:'MAR',apr:'APR',may:'MAY',jun:'JUN',jul:'JUL',aug:'AUG',sep:'SEP',oct:'OCT',nov:'NOV',dec:'DEC',june:'JUN',july:'JUL',march:'MAR',april:'APR',august:'AUG',january:'JAN',february:'FEB',september:'SEP',october:'OCT',november:'NOV',december:'DEC'};
  var upper = String(s).toUpperCase();
  var yearMatch = upper.match(/(20\d\d)/);
  var year = yearMatch ? yearMatch[1] : '';
  for (var key in MONTHS) {
    if (upper.indexOf(key.toUpperCase()) !== -1) return MONTHS[key] + '_' + year;
  }
  return upper.replace(/[^A-Z0-9]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
}

// ===== ENSURE ALL PLAYER IDs =====
function ensureAllPlayerIds() {
  // Uses same P001 format as generatePlayerId in PLAYERS.gs
  var ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
  var sheet = ss.getSheetByName('PLAYERS');
  var data = sheet.getDataRange().getValues();
  
  // Find highest existing P-number
  var maxNum = 0;
  data.slice(1).forEach(function(row) {
    var pid = String(row[13] || '');
    if (/^P\d+$/.test(pid)) {
      var n = parseInt(pid.substring(1), 10);
      if (n > maxNum) maxNum = n;
    }
  });
  
  var updated = 0;
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    var existing = String(row[13] || '').trim();
    if (!existing || existing === '') {
      maxNum++;
      var newId = 'P' + String(maxNum).padStart(3, '0');
      sheet.getRange(i + 1, 14).setValue(newId);
      updated++;
      Logger.log('Assigned ' + newId + ' to ' + row[0]);
    }
  }
  Logger.log('Player IDs assigned: ' + updated + '. Highest ID: P' + String(maxNum).padStart(3,'0'));
  return {ok: true, updated: updated, highestId: 'P' + String(maxNum).padStart(3,'0')};
}
// ===== BACKFILL SEASON STANDINGS =====
function backfillSeasonStandings() {
  var MONTH_CODES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  function seasonFromTs(d) {
    try { var dt = d instanceof Date ? d : new Date(d); if(isNaN(dt.getTime())) return null; return MONTH_CODES[dt.getMonth()] + '_' + dt.getFullYear(); } catch(e) { return null; }
  }
  var ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
  var fsSheet = ss.getSheetByName('FORM_SUBMISSIONS');
  var plSheet = ss.getSheetByName('PLAYERS');
  var plData = plSheet.getDataRange().getValues().slice(1);
  var playerElo = {};
  plData.forEach(function(r) { if(r[0]) playerElo[String(r[0]).trim().toLowerCase()] = Number(r[8])||1000; });
  var rows = fsSheet.getDataRange().getValues().slice(1);
  var seasonData = {};
  rows.forEach(function(row) {
    var ts = row[0]; var season = seasonFromTs(ts); if(!season) return;
    var p1 = String(row[1]).trim(); var p2 = String(row[2]).trim(); var winner = String(row[3]).trim();
    if(!p1 || !p2 || p1==='vs' || p2==='vs') return;
    if(!seasonData[season]) seasonData[season] = {};
    if(!seasonData[season][p1]) seasonData[season][p1] = {wins:0,losses:0,games:0};
    if(!seasonData[season][p2]) seasonData[season][p2] = {wins:0,losses:0,games:0};
    seasonData[season][p1].games++; seasonData[season][p2].games++;
    var wn = winner.toLowerCase();
    if(p1.toLowerCase()===wn){seasonData[season][p1].wins++;seasonData[season][p2].losses++;}
    else if(p2.toLowerCase()===wn){seasonData[season][p2].wins++;seasonData[season][p1].losses++;}
  });
  var archSheet = ss.getSheetByName('SEASON_STANDINGS_ARCHIVE') || ss.insertSheet('SEASON_STANDINGS_ARCHIVE');
  if(archSheet.getLastRow()===0) archSheet.appendRow(['Season','Rank','Player','Wins','Losses','Points','ELO','Games']);
  var existing = {};
  archSheet.getDataRange().getValues().forEach(function(r){if(r[0])existing[String(r[0])]=true;});
  Object.keys(seasonData).sort().forEach(function(season){
    if(existing[season]) return;
    var players = seasonData[season];
    Object.keys(players).sort(function(a,b){return players[b].wins-players[a].wins||(playerElo[b.toLowerCase()]||1000)-(playerElo[a.toLowerCase()]||1000);})
      .forEach(function(n,i){
        var s=players[n]; var elo=playerElo[n.toLowerCase()]||1000;
        archSheet.appendRow([season,i+1,n,s.wins,s.losses,25+(s.wins*3)-s.losses,elo,s.games]);
      });
  });
  rebuildCareerMatchesFromForms();
  rebuildCareerLeaderboard();
  Logger.log('Backfill done: ' + Object.keys(seasonData).join(', '));
  return {ok:true, seasons:Object.keys(seasonData)};
}