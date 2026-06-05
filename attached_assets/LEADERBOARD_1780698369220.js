function rebuildLeaderboard(){

  const playersSheet =
    getSheet(SHEETS.PLAYERS);

  const leaderboardSheet =
    getSheet(SHEETS.LEADERBOARD);

  if(
    !playersSheet ||
    !leaderboardSheet
  ){

    Logger.log(
      "Leaderboard sheets missing"
    );

    return;

  }

  const data =
    playersSheet
      .getDataRange()
      .getValues();

  if(data.length <= 1){

    Logger.log(
      "No player data"
    );

    return;

  }

  /* =========================
     GET PLAYERS
  ========================= */

const players =
    data
      .slice(1)
      .filter(row =>
        row[PLAYER.NAME] &&
        String(row[PLAYER.STATUS] || '').toUpperCase() !== 'INACTIVE'
      );

  /* =========================
     SORT
  ========================= */

  players.sort((a,b)=>{

    const pointsDiff =

      Number(b[PLAYER.POINTS]) -
      Number(a[PLAYER.POINTS]);

    if(pointsDiff !== 0)
      return pointsDiff;

    return (

      Number(b[PLAYER.ELO]) -
      Number(a[PLAYER.ELO])

    );

  });

  /* =========================
     ASSIGN RANKS
  ========================= */

  players.forEach((player,index)=>{

    player[PLAYER.PREVIOUS_RANK] =
      player[PLAYER.CURRENT_RANK] || "";

    player[PLAYER.CURRENT_RANK] =
      index + 1;

  });

  /* =========================
     UPDATE PLAYER SHEET
  ========================= */

  for(let i = 0; i < players.length; i++){

    const playerId =
      players[i][PLAYER.PLAYER_ID];

    for(let r = 1; r < data.length; r++){

      if(

        data[r][PLAYER.PLAYER_ID] ===
        playerId

      ){

        playersSheet
          .getRange(
            r + 1,
            PLAYER.CURRENT_RANK + 1
          )
          .setValue(
            players[i][PLAYER.CURRENT_RANK]
          );

        playersSheet
          .getRange(
            r + 1,
            PLAYER.PREVIOUS_RANK + 1
          )
          .setValue(
            players[i][PLAYER.PREVIOUS_RANK]
          );

        break;

      }

    }

  }

  /* =========================
     CLEAR LEADERBOARD
  ========================= */

  leaderboardSheet.clearContents();

  /* =========================
     HEADERS
  ========================= */

  leaderboardSheet.appendRow([

    "Rank",
    "Player",
    "Points",
    "ELO",
    "Tier",
    "Wins",
    "Losses",
    "Games"

  ]);

  /* =========================
     WRITE LEADERBOARD
  ========================= */

  players.forEach(player => {

    leaderboardSheet.appendRow([

      player[PLAYER.CURRENT_RANK],

      player[PLAYER.NAME],

      player[PLAYER.POINTS],

      player[PLAYER.ELO],

      player[PLAYER.TIER],

      player[PLAYER.WINS],

      player[PLAYER.LOSSES],

      player[PLAYER.GAMES]

    ]);

  });

  clearLeagueCache();

  Logger.log(
    "Leaderboard rebuilt"
  );

}

