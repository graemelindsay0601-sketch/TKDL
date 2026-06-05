/* =========================================================
   TKDL MATCH ENGINE V2
   POINTS ONLY
========================================================= */

function processMatchV2(
  player1,
  player2,
  winner,
  stake
){

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const sheet =
    ss.getSheetByName(
      "PLAYERS"
    );

  const data =
    sheet
      .getDataRange()
      .getValues();

  let winnerRow = -1;
  let loserRow  = -1;

  const loser =

    winner === player1
      ? player2
      : player1;

  for(let i = 1; i < data.length; i++){

    const name =
      String(data[i][0] || "")
        .trim();

    if(name === winner)
      winnerRow = i + 1;

    if(name === loser)
      loserRow = i + 1;

  }

  if(
    winnerRow === -1 ||
    loserRow === -1
  ){

    throw new Error(
      "Player not found."
    );

  }

  const winnerPoints =
    Number(
      sheet
        .getRange(winnerRow,4)
        .getValue()
    ) || 0;

  const loserPoints =
    Number(
      sheet
        .getRange(loserRow,4)
        .getValue()
    ) || 0;

  const winnerGames =
    Number(
      sheet
        .getRange(winnerRow,5)
        .getValue()
    ) || 0;

  const loserGames =
    Number(
      sheet
        .getRange(loserRow,5)
        .getValue()
    ) || 0;

  const winnerWins =
    Number(
      sheet
        .getRange(winnerRow,6)
        .getValue()
    ) || 0;

  const loserLosses =
    Number(
      sheet
        .getRange(loserRow,7)
        .getValue()
    ) || 0;

  /* =========================
     SEASON STATS
  ========================= */

  sheet.getRange(
    winnerRow,
    4
  ).setValue(
    winnerPoints + stake
  );

  sheet.getRange(
    loserRow,
    4
  ).setValue(
    Math.max(
      0,
      loserPoints - stake
    )
  );

  sheet.getRange(
    winnerRow,
    5
  ).setValue(
    winnerGames + 1
  );

  sheet.getRange(
    loserRow,
    5
  ).setValue(
    loserGames + 1
  );

  sheet.getRange(
    winnerRow,
    6
  ).setValue(
    winnerWins + 1
  );

  sheet.getRange(
    loserRow,
    7
  ).setValue(
    loserLosses + 1
  );

  /* =========================
     CAREER STATS
  ========================= */

  sheet.getRange(
    winnerRow,
    15
  ).setValue(
    Number(
      sheet.getRange(
        winnerRow,
        15
      ).getValue()
    ) + 1
  );

  sheet.getRange(
    loserRow,
    16
  ).setValue(
    Number(
      sheet.getRange(
        loserRow,
        16
      ).getValue()
    ) + 1
  );

  sheet.getRange(
    winnerRow,
    17
  ).setValue(
    Number(
      sheet.getRange(
        winnerRow,
        17
      ).getValue()
    ) + 1
  );

  sheet.getRange(
    loserRow,
    17
  ).setValue(
    Number(
      sheet.getRange(
        loserRow,
        17
      ).getValue()
    ) + 1
  );

  /* =========================
     HIGHEST BALANCE
  ========================= */

  const newWinnerPoints =
    winnerPoints + stake;

  const highestBalance =
    Number(
      sheet
        .getRange(
          winnerRow,
          8
        )
        .getValue()
    ) || 0;

  if(
    newWinnerPoints >
    highestBalance
  ){

    sheet
      .getRange(
        winnerRow,
        8
      )
      .setValue(
        newWinnerPoints
      );

  }

  Logger.log(
    "MATCH V2 COMPLETE"
  );

}
function testMatchV2(){

  processMatchV2(
    "Sean",
    "Richard",
    "Sean",
    1
  );

}

/* =========================================================
   TKDL LEADERBOARD V2
   POINTS ONLY
========================================================= */

function rebuildLeaderboardV2(){

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const playersSheet =
    ss.getSheetByName(
      "PLAYERS"
    );

  const leaderboardSheet =
    ss.getSheetByName(
      "LEADERBOARD"
    );

  if(
    !playersSheet ||
    !leaderboardSheet
  ){

    throw new Error(
      "Missing PLAYERS or LEADERBOARD sheet"
    );

  }

  const data =
    playersSheet
      .getDataRange()
      .getValues();

  const players =
    data
      .slice(1)
      .filter(row =>

        String(row[1] || '')
          .toUpperCase() === 'ACTIVE'

      );

  /* =========================
     SORT BY POINTS
  ========================= */

  players.sort((a,b)=>{

    return (

      Number(b[3] || 0) -
      Number(a[3] || 0)

    );

  });

  /* =========================
     UPDATE RANKS
  ========================= */

  players.forEach((player,index)=>{

    const playerId =
      player[13];

    const newRank =
      index + 1;

    for(
      let r = 1;
      r < data.length;
      r++
    ){

      if(
        data[r][13] === playerId
      ){

        playersSheet
          .getRange(
            r + 1,
            19
          )
          .setValue(
            data[r][17] || ''
          );

        playersSheet
          .getRange(
            r + 1,
            18
          )
          .setValue(
            newRank
          );

        break;

      }

    }

  });

  /* =========================
     REBUILD LEADERBOARD
  ========================= */

  leaderboardSheet.clearContents();

  leaderboardSheet.appendRow([

    'Rank',
    'Player',
    'Points',
    'Wins',
    'Losses',
    'Games'

  ]);

  players.forEach((player,index)=>{

    leaderboardSheet.appendRow([

      index + 1,
      player[0],
      player[3],
      player[5],
      player[6],
      player[4]

    ]);

  });

  Logger.log(
    'LEADERBOARD V2 COMPLETE'
  );

}

function testLeaderboardV2(){

  rebuildLeaderboardV2();

}

function submitMatchV2(
  player1,
  player2,
  winner,
  stake,
  gameType
){

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

ss
  .getSheetByName("FORM_SUBMISSIONS")
  .appendRow([

    new Date(),
    `${player1} vs ${player2}`,
    stake,
    winner,
    gameType,
    getCurrentSeason()

  ]);

  ss
    .getSheetByName("CAREER_MATCHES")
ss
  .getSheetByName("CAREER_MATCHES")
  .appendRow([

    new Date(),
    player1,
    player2,
    winner,
    stake,
    gameType,
    getCurrentSeason()

  ]);

  processMatchV2(
    player1,
    player2,
    winner,
    Number(stake)
  );

  rebuildLeaderboardV2();

  return {
    success:true
  };

}