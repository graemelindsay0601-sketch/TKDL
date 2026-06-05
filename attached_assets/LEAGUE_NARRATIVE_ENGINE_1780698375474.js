/* =========================================================
   TKDL LEAGUE NARRATIVE ENGINE
   Read-Only Narrative Layer
========================================================= */

/* =========================================================
   BUILD LEAGUE NARRATIVES
========================================================= */

function buildLeagueNarratives(leagueData){

  const players =
    leagueData.players || [];

  const matches =
    leagueData.matches || [];

  return {

    hottestPlayer:
      buildHottestPlayerNarrative(players),

    mostDangerous:
      buildDangerPlayerNarrative(players),

    titleRace:
      buildTitleRaceNarrative(players),

    eliminationWatch:
      buildEliminationNarrative(players),

    rivalrySpotlight:
  buildLeagueRivalryNarrative(
    players,
    matches
  ),

    streakWatch:
      buildStreakNarrative(players)

  };

}

/* =========================================================
   HOTTEST PLAYER
========================================================= */

function buildHottestPlayerNarrative(players){

const hottest =
  [...players]
    .sort((a,b) => {

      const stateA =
        getCanonicalPlayerState(a);

      const stateB =
        getCanonicalPlayerState(b);

      return (
        stateB.streak -
        stateA.streak
      );

    })[0];



  if(!hottest){
    return null;
  }

  return {

    player:
      hottest.name,

    streak:
      hottest.winStreak || 0,

    label:

      getCanonicalPlayerState(hottest)
  .isUntouchable

        ? "Untouchable Form"

        : getCanonicalPlayerState(hottest)
  .isOnFire

          ? "Red Hot"

          : "Building Momentum"

  };

}

/* =========================================================
   MOST DANGEROUS PLAYER
========================================================= */

function buildDangerPlayerNarrative(players){

  const dangerous =
    [...players]
      .sort((a,b) =>

        getCanonicalPlayerState(b).elo -

getCanonicalPlayerState(a).elo

      )[0];

  if(!dangerous){
    return null;
  }

  return {

    player:
      dangerous.name,

    elo:
      dangerous.elo,

    label:

      getCanonicalPlayerState(dangerous)
  .isLegendary

        ? "League Nightmare"

        : getCanonicalPlayerState(dangerous)
  .isElite

          ? "Elite Threat"

          : "Dangerous Competitor"

  };

}

/* =========================================================
   TITLE RACE
========================================================= */

function buildTitleRaceNarrative(players){

  if(players.length < 2){
    return null;
  }

  const sorted =
    [...players]
      .sort((a,b) =>
        b.points - a.points
      );

  const leader =
    sorted[0];

  const challenger =
    sorted[1];

  const gap =
    (leader.points || 0) -
    (challenger.points || 0);

  return {

    leader:
      leader.name,

    challenger:
      challenger.name,

    gap,

    label:

      gap <= 2

        ? "Title Race Intensifying"

        : gap <= 5

          ? "Pressure Building"

          : "Leader Pulling Away"

  };

}

/* =========================================================
   ELIMINATION WATCH
========================================================= */

function buildEliminationNarrative(players){

  const vulnerable =
  players
    .filter(player => {

      const state =
        getCanonicalPlayerState(
          player
        );

      return !state.isEliminated;

    })

    .sort((a,b) =>

      (a.points || 0)

      -

      (b.points || 0)

    )[0];

  if(!vulnerable){
    return null;
  }

  return {

    player:
      vulnerable.name,

    points:
      vulnerable.points,

    label:

      vulnerable.points <= 2

        ? "On The Brink"

        : "Under Pressure"

  };

}

/* =========================================================
   LEAGUE RIVALRY
========================================================= */

function buildLeagueRivalryNarrative(
  players,
  matches
){

  const profiles =
    players.map(player => {

      return {
        player,
        rivalry:
          buildPlayerRivalrySpotlight(
            player.playerId,
            {
              players,
              matches:
  matches || []
            }
          )
      };

    });

  const active =
    profiles.filter(
      p => p.rivalry?.hasRivalry
    );

  if(!active.length){
    return null;
  }

  active.sort((a,b) =>

    (b.rivalry.spotlight.intensity || 0)

    -

    (a.rivalry.spotlight.intensity || 0)

  );

  const top =
    active[0];

  return {

    player:
      top.player.name,

    opponent:
      top.rivalry.spotlight.opponent,

    label:
      top.rivalry.spotlight.label

  };

}

/* =========================================================
   STREAK WATCH
========================================================= */

function buildStreakNarrative(players){

  const streaking =
    players.filter(
      p => (p.winStreak || 0) >= 3
    );

  if(!streaking.length){
    return null;
  }

  streaking.sort((a,b) =>

    (b.winStreak || 0)

    -

    (a.winStreak || 0)

  );

  const top =
    streaking[0];

  return {

    player:
      top.name,

    streak:
      top.winStreak,

    label:

      top.winStreak >= 10

        ? "Historic Run"

        : top.winStreak >= 5

          ? "Win Streak Active"

          : "Momentum Building"

  };

}