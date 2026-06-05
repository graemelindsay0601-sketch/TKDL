function reconstructFebruary2026Season() {

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const sourceSheet =
    ss.getSheetByName(
      "Season 1 February stats"
    );

  if (!sourceSheet) {
    throw new Error(
      "Season 1 February stats sheet not found"
    );
  }

  const OUTPUT_SHEET =
    "FEB_2026_RECONSTRUCTION_DO_NOT_USE";

  let outputSheet =
    ss.getSheetByName(
      OUTPUT_SHEET
    );

  if (!outputSheet) {
    outputSheet =
      ss.insertSheet(
        OUTPUT_SHEET
      );
  }

  outputSheet.clearContents();

  const rows =
    sourceSheet
      .getDataRange()
      .getValues()
      .slice(1)
      .filter(function(row) {

        return (
          String(row[0] || "").trim() ===
          "FEB_2026"
        );

      });

  const players = {};

  rows.forEach(function(row) {

let playerA =
  String(row[1] || "").trim();

let playerB =
  String(row[2] || "").trim();

if(playerA === "Roddy"){
  playerA = "Roddie";
}

if(playerB === "Roddy"){
  playerB = "Roddie";
}

    const aLegs =
      Number(row[3]) || 0;

    const bLegs =
      Number(row[4]) || 0;

    const winner =
      String(row[5] || "").trim();

    if (!playerA || !playerB) {
      return;
    }

    [playerA, playerB].forEach(function(name) {

      if (!players[name]) {

        players[name] = {

          player: name,
          wins: 0,
          losses: 0,
          games: 0,
          legsWon: 0,
          legsLost: 0

        };

      }

    });

    players[playerA].games++;
    players[playerB].games++;

    players[playerA].legsWon += aLegs;
    players[playerA].legsLost += bLegs;

    players[playerB].legsWon += bLegs;
    players[playerB].legsLost += aLegs;

    if (winner === playerA) {

      players[playerA].wins++;
      players[playerB].losses++;

    } else if (winner === playerB) {

      players[playerB].wins++;
      players[playerA].losses++;

    }

  });

  const standings =
    Object.values(players);

  standings.forEach(function(player) {

    player.legDifference =
      player.legsWon -
      player.legsLost;

    player.status = "";

  });

  standings.sort(function(a, b) {

    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }

    return (
      b.legDifference -
      a.legDifference
    );

  });

  const playoffPlayers = [
    "Graeme",
    "Sean",
    "Robert"
  ];

  standings.forEach(function(player) {

    if (
      playoffPlayers.includes(
        player.player
      )
    ) {

      player.status =
        "PLAYOFF_REQUIRED";

    }

  });

  const output = [[

    "Rank",
    "Player",
    "Wins",
    "Losses",
    "Games",
    "Legs Won",
    "Legs Lost",
    "Leg Difference",
    "Status"

  ]];

  standings.forEach(function(player, index) {

    output.push([

      index + 1,
      player.player,
      player.wins,
      player.losses,
      player.games,
      player.legsWon,
      player.legsLost,
      player.legDifference,
      player.status

    ]);

  });

  outputSheet
    .getRange(
      1,
      1,
      output.length,
      output[0].length
    )
    .setValues(output);

  outputSheet.autoResizeColumns(
    1,
    output[0].length
  );

  Logger.log(
    "FEB_2026 reconstruction complete"
  );

}