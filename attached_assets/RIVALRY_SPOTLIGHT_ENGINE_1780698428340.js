/* =========================================================
   TKDL RIVALRY SPOTLIGHT ENGINE
   Read-Only Narrative Layer
========================================================= */

/* =========================================================
   BUILD PLAYER RIVALRY PROFILE
========================================================= */

function buildPlayerRivalrySpotlight(
  playerId,
  leagueData
) {

  const matches =
    leagueData.matches || [];

  const rivalryMap = {};

  matches.forEach(match => {

    const p1 =
      match.player1;

    const p2 =
      match.player2;

    if (
      p1 !== playerId &&
      p2 !== playerId
    ){
      return;
    }

    const opponent =
      p1 === playerId
        ? p2
        : p1;

    if (!rivalryMap[opponent]) {

      rivalryMap[opponent] = {

        matches:0,
        wins:0,
        losses:0

      };

    }

    rivalryMap[opponent].matches++;

    const won =

      (match.player1 === playerId &&
       match.winner === match.player1)

      ||

      (match.player2 === playerId &&
       match.winner === match.player2);

    if (won) {
      rivalryMap[opponent].wins++;
    }
    else{
      rivalryMap[opponent].losses++;
    }

  });

  const rivalries =
    Object.entries(rivalryMap)
      .map(([opponent,data]) => {

        const intensity =

          data.matches * 10 +

          Math.abs(
            data.wins -
            data.losses
          ) * 5;

        return {

          opponent,
          ...data,
          intensity

        };

      })

      .sort(
        (a,b) =>
          b.intensity -
          a.intensity
      );

  const top =
    rivalries[0];

  if (!top) {

    return {

      hasRivalry:false,
      spotlight:null

    };

  }

  return {

    hasRivalry:true,

    spotlight:{

      opponent:
        top.opponent,

      matches:
        top.matches,

      record:
        `${top.wins}-${top.losses}`,

      intensity:
        top.intensity,

      label:
        buildRivalryLabel(top)

    }

  };

}

/* =========================================================
   RIVALRY LABELS
========================================================= */

function buildRivalryLabel(rivalry){

  const {
    matches,
    wins,
    losses
  } = rivalry;

  if (
    matches >= 10 &&
    Math.abs(wins-losses) <= 2
  ){
    return "Historic Rivalry";
  }

  if (wins >= losses + 5){
    return "Dominating Rivalry";
  }

  if (losses >= wins + 5){
    return "Redemption Needed";
  }

  if (matches >= 5){
    return "Heated Matchup";
  }

  return "Emerging Rivalry";

}