/* =========================================================
   TKDL PLAYER IDENTITY ENGINE
========================================================= */

function buildPlayerIdentity(
  player
){

  const identity = {

    title:
      getPlayerTitle(player),

    aura:
      getPlayerAura(player),

    rival:
      getSignatureRival(player),

    archetype:
      getPlayerArchetype(player)

  };

  return identity;

}

/* =========================================================
   TITLE
========================================================= */

function getPlayerTitle(
  player
){

  if(player.rank === 1)
    return "The King";

  if(player.winRate >= 80)
    return "The Sniper";

  if(player.streak >= 5)
    return "The Inferno";

  if(player.points >= 100)
    return "The Titan";

  if(player.losses <= 2)
    return "The Untouched";

  return "Competitor";

}

/* =========================================================
   AURA
========================================================= */


/* =========================================================
   ARCHETYPE
========================================================= */



/* =========================================================
   SIGNATURE RIVAL
========================================================= */

// getSignatureRival removed — canonical version is in RIVALRY_ENGINE.gs