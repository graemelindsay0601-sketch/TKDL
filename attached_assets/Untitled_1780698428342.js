function testAchievements() {
  const data = getPlayerAchievements();

  Logger.log(data.length);

  Logger.log(
    JSON.stringify(
      data.slice(0,10),
      null,
      2
    )
  );
}


function forceAchievementRefresh() {

  rebuildLeagueDataCache();

  Logger.log(
    JSON.stringify(
      getLeagueData().playerAchievements.length
    )
  );

}

function debugAchievementSheetNames() {

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  ss.getSheets().forEach(s => {

    Logger.log(
      "[" + s.getName() + "]"
    );

  });

}

function debugPlayerAchievementsRaw() {

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const sheet =
    ss.getSheetByName("PLAYER_ACHIEVEMENTS");

  const rows =
    sheet.getDataRange().getValues();

  Logger.log("Rows: " + rows.length);

  Logger.log(
    JSON.stringify(
      rows.slice(0,5),
      null,
      2
    )
  );

}

function debugActualAchievementLoader() {

  const data = getPlayerAchievements();

  Logger.log(
    "Count = " + data.length
  );

  if (data.length) {

    Logger.log(
      JSON.stringify(
        data.slice(0,3),
        null,
        2
      )
    );

  }

}
function debugWhichAchievementFunction(){

  Logger.log(
    getPlayerAchievements.toString()
      .substring(0,300)
  );

}

function debugAchievementLoaderSource(){

  Logger.log(
    getPlayerAchievements.toString()
      .substring(0,300)
  );

}

function debugActualAchievementLoader(){

  const data =
    getPlayerAchievements();

  Logger.log(
    "Count = " + data.length
  );

  Logger.log(
    JSON.stringify(
      data.slice(0,3),
      null,
      2
    )
  );

}
function testLeagueAchievementPayload(){

  const data = getLeagueData();

  Logger.log(
    "Player achievements: " +
    (data.playerAchievements || []).length
  );

}

function rebuildAndTest(){

  rebuildLeagueDataCache();

  const data =
    getLeagueDataCached();

  Logger.log(
    "Cached achievements: " +
    (data.playerAchievements || []).length
  );

}

function testAchievementsDirect() {

  const achievements =
    getPlayerAchievements();

  Logger.log(
    "Achievement Count = " +
    achievements.length
  );

  Logger.log(
    JSON.stringify(
      achievements.slice(0,5),
      null,
      2
    )
  );

}

function testLeagueAchievements() {

  const data =
    getLeagueData();

  Logger.log(
    "League Achievement Count = " +
    data.playerAchievements.length
  );

}


function testSeanAchievements(){

  const data = getLeagueData();

  const sean =
    data.players.find(
      p => p.name === "Sean"
    );

  Logger.log(
    "Sean playerId = " +
    sean.playerId
  );

  const unlocks =
    data.playerAchievements.filter(
      a => a.playerId === sean.playerId
    );

  Logger.log(
    "Unlock count = " +
    unlocks.length
  );

  Logger.log(
    JSON.stringify(
      unlocks.slice(0,5)
    )
  );

}

function testSeanInLeagueData(){

  const data = getLeagueData();

  const sean =
    data.players.find(
      p => p.playerId === "P002"
    );

  Logger.log(
    JSON.stringify(
      sean,
      null,
      2
    )
  );

}

function testSeasonOutput() {

  const data =
    getLeagueData();

  Logger.log(
    data.season
  );

  Logger.log(
    data.seasonDisplayName
  );

}
function inspectSystemState() {

  const sheet =
    SpreadsheetApp
      .openById("1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc")
      .getSheetByName("SYSTEM_STATE");

  Logger.log(
    JSON.stringify(
      sheet.getDataRange().getValues(),
      null,
      2
    )
  );

}

function debugCurrentSeasonOnly() {

  Logger.log(
    getCurrentSeason()
  );

}