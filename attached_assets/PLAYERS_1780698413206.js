function findPlayerByName(name){

  if(!name)
    return -1;

  const data =
    getPlayersData();

  for(let i = 1; i < data.length; i++){

    const playerName =

      (data[i][PLAYER.NAME] || "")
        .toString()
        .trim()
        .toLowerCase();

    if(

      playerName ===
      name.trim().toLowerCase()

    ){

      return i;

    }

  }

  return -1;

}

function generatePlayerId(){

  const data =
    getPlayersData();

  let highest = 0;

  for(let i = 1; i < data.length; i++){

    const id =
      data[i][PLAYER.PLAYER_ID];

    if(!id)
      continue;

    const num =

      Number(
        id
          .toString()
          .replace("P","")
      );

    if(num > highest){

      highest = num;

    }

  }

  return (

    "P" +

    String(highest + 1)
      .padStart(3,"0")

  );

}

function createPlayer(name){

  const sheet =
    getSheet(SHEETS.PLAYERS);

  const startPoints =

    Number(
      getSetting(
        "Starting Points"
      )
    )

    ||

    TKDL.STARTING_POINTS;

  const playerId =
    generatePlayerId();

  sheet.appendRow([

    normalizePlayerName(name),

    "ACTIVE",

    startPoints,

    startPoints,

    0,

    0,

    0,

    startPoints,

    TKDL.STARTING_ELO,

    "🥇 Gold",

    new Date(),

    getCurrentSeason(),

    true,

    playerId,

    0,

    0,

    0,

    "",

    "",

    TKDL.STARTING_ELO

  ]);

  clearLeagueCache();

  Logger.log(
    "PLAYER CREATED: " + name
  );

}

/* =========================
   PLAYER STATS ENGINE
========================= */

function getPlayerStatsData(){

  return getSheet(
    "PLAYER_STATS"
  ).getDataRange().getValues();

}

function findPlayerStatsRow(playerId){

  const data =
    getPlayerStatsData();

  for(let i = 1; i < data.length; i++){

    if(data[i][0] === playerId){

      return i + 1;

    }

  }

  return -1;

}

function createPlayerStats(playerId){

  const sheet =
    getSheet("PLAYER_STATS");

  sheet.appendRow([

    playerId,

    0, // BestStreak
    0, // CurrentWinStreak
    0, // CurrentLossStreak

    0, // TopPlayerWins
    0, // TopPlayerElims

    0, // Eliminations

    0, // HighStakeMatches
    0, // HighestStakeWin

    0, // AllInWagers

    0, // SamePlayerWinStreak

    0, // FeaturedMatchWins

    0, // ActiveWeeks

    0, // BiggestRankClimb
    0, // BiggestRankDrop

    0, // SeasonsWon

    0, // MvpAwards

    0, // LowPointWins

    0 // HiddenAchievementsUnlocked

  ]);

}

function ensurePlayerStatsExist(){

  const players =
    getPlayersData();

  for(let i = 1; i < players.length; i++){

    const playerId =
      players[i][PLAYER.PLAYER_ID];

    if(!playerId)
      continue;

    const existing =
      findPlayerStatsRow(playerId);

    if(existing === -1){

      createPlayerStats(playerId);

      Logger.log(
        "CREATED PLAYER_STATS: " +
        playerId
      );

    }

  }

}