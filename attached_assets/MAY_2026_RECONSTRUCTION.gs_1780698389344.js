function reconstructMay2026Season() {

  const ss = SpreadsheetApp.openById(
    '1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc'
  );

  const matchSheet =
    ss.getSheetByName('CAREER_MATCHES');

  if (!matchSheet) {
    throw new Error(
      'CAREER_MATCHES sheet not found'
    );
  }

  const SHEET_NAME =
    'MAY_2026_RECONSTRUCTION_DO_NOT_USE';

  let outputSheet =
    ss.getSheetByName(SHEET_NAME);

  if (!outputSheet) {
    outputSheet =
      ss.insertSheet(SHEET_NAME);
  }

  outputSheet.clear();

  const rows =
    matchSheet
      .getDataRange()
      .getValues()
      .slice(1)
      .filter(row =>
        String(row[6]).trim() === 'MAY_2026'
      );

  const players = {};

  rows.forEach(row => {

    const p1 =
      String(row[1]).trim();

    const p2 =
      String(row[2]).trim();

    const winner =
      String(row[3]).trim();

    const stake =
      Number(row[4]) || 0;

    if (!p1 || !p2 || !winner)
      return;

    if (!players[p1]) {

      players[p1] = {
        player: p1,
        startPoints: 25,
        points: 25,
        wins: 0,
        losses: 0,
        games: 0,
        pointsWon: 0,
        pointsLost: 0
      };

    }

    if (!players[p2]) {

      players[p2] = {
        player: p2,
        startPoints: 25,
        points: 25,
        wins: 0,
        losses: 0,
        games: 0,
        pointsWon: 0,
        pointsLost: 0
      };

    }

    const loser =
      winner === p1
        ? p2
        : p1;

    players[winner].wins++;
    players[winner].games++;
    players[winner].points += stake;
    players[winner].pointsWon += stake;

    players[loser].losses++;
    players[loser].games++;
    players[loser].points -= stake;
    players[loser].pointsLost += stake;

  });

  const leaderboard =
    Object.values(players)
      .sort((a, b) => {

        if (b.points !== a.points)
          return b.points - a.points;

        if (b.wins !== a.wins)
          return b.wins - a.wins;

        return a.losses - b.losses;

      });

  const output = [[
    'Rank',
    'Player',
    'Final Points',
    'Wins',
    'Losses',
    'Games',
    'Points Won',
    'Points Lost',
    'Net Gain'
  ]];

  leaderboard.forEach((p, index) => {

    output.push([

      index + 1,
      p.player,
      p.points,
      p.wins,
      p.losses,
      p.games,
      p.pointsWon,
      p.pointsLost,
      p.points - p.startPoints

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
    'Reconstructed ' +
    leaderboard.length +
    ' players from ' +
    rows.length +
    ' MAY_2026 matches'
  );

}