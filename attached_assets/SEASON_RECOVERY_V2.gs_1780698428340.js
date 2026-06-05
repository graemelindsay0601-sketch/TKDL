function rebuildCurrentSeasonV2(
  seasonId = "JUNE_2026"
){

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const playersSheet =
    ss.getSheetByName("PLAYERS");

  const matchesSheet =
    ss.getSheetByName("CAREER_MATCHES");

  const players =
    playersSheet
      .getDataRange()
      .getValues();

  const matches =
    matchesSheet
      .getDataRange()
      .getValues()
      .slice(1);

  const lookup = {};

  /* RESET ACTIVE PLAYERS */

  for(let i = 1; i < players.length; i++){

    if(
      String(players[i][1] || "")
        .toUpperCase() !== "ACTIVE"
    ){
      continue;
    }

    players[i][3] = 25; // Current Points
    players[i][4] = 0;  // Games
    players[i][5] = 0;  // Wins
    players[i][6] = 0;  // Losses
    players[i][7] = 25; // Highest Balance

    lookup[
      String(players[i][0]).trim()
    ] = i;

  }

  /* REPLAY MATCHES */

  matches.forEach(row => {

    const season =
      String(row[6] || "")
        .trim();

    if(season !== seasonId)
      return;

    const p1 =
      String(row[1] || "").trim();

    const p2 =
      String(row[2] || "").trim();

    const winner =
      String(row[3] || "").trim();

    const stake =
      Number(row[4]) || 0;

    const loser =
      winner === p1
        ? p2
        : p1;

    const w =
      lookup[winner];

    const l =
      lookup[loser];

    if(
      w == null ||
      l == null
    ){
      return;
    }

    players[w][3] += stake;
    players[l][3] =
      Math.max(
        0,
        players[l][3] - stake
      );

    players[w][4]++;
    players[l][4]++;

    players[w][5]++;
    players[l][6]++;

    players[w][7] =
      Math.max(
        players[w][7],
        players[w][3]
      );

  });

  /* WRITE BACK */

  playersSheet
    .getRange(
      1,
      1,
      players.length,
      players[0].length
    )
    .setValues(players);

  rebuildLeaderboardV2();

  Logger.log(
    "SEASON REBUILD COMPLETE: " +
    seasonId
  );

}

function debugPlayersPoints(){

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const data =
    ss.getSheetByName("PLAYERS")
      .getDataRange()
      .getValues();

  data.slice(1).forEach(row => {

    Logger.log(
      row[0] +
      " = " +
      row[3]
    );

  });

}
function testSeanPoints(){

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const row =
    ss.getSheetByName("PLAYERS")
      .getDataRange()
      .getValues()
      .find(r => r[0] === "Sean");

  Logger.log(
    "Sean Points = " + row[3]
  );

}

function inspectCareerMatchRow(){

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const row =
    ss.getSheetByName("CAREER_MATCHES")
      .getDataRange()
      .getValues()[1];

  Logger.log(
    JSON.stringify(row)
  );

}

function forceSeanTest(){

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const sheet =
    ss.getSheetByName("PLAYERS");

  const data =
    sheet.getDataRange().getValues();

  for(let i=1;i<data.length;i++){

    if(data[i][0] === "Sean"){

      sheet
        .getRange(i+1,4)
        .setValue(999);

      Logger.log("SET SEAN TO 999");

      break;

    }

  }

}
function proveWriteWorks(){

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const sheet =
    ss.getSheetByName("PLAYERS");

  const data =
    sheet.getDataRange().getValues();

  for(let i=1;i<data.length;i++){

    if(
      String(data[i][0]).trim() ===
      "Sean"
    ){

      data[i][3] = 1234;

      break;

    }

  }

  sheet
    .getRange(
      1,
      1,
      data.length,
      data[0].length
    )
    .setValues(data);

}