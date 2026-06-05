/* =========================================================
   TKDL CANONICAL ACHIEVEMENT HELPERS
   Centralized Achievement Logic
========================================================= */

/* =========================================================
   NORMALIZE ACHIEVEMENTS
========================================================= */

function getPlayerAchievementIds(player){

  if(!player){
    return [];
  }

  if(
    !Array.isArray(
      player.achievements
    )
  ){
    return [];
  }

  return player.achievements
    .map(a => String(a).trim())
    .filter(Boolean);

}

/* =========================================================
   HAS ACHIEVEMENT
========================================================= */

function hasAchievement(
  player,
  achievementId
){

  const achievements =
    getPlayerAchievementIds(player);

  return achievements.includes(
    achievementId
  );

}

/* =========================================================
   HAS ANY ACHIEVEMENT
========================================================= */

function hasAnyAchievement(
  player,
  achievementIds = []
){

  const achievements =
    getPlayerAchievementIds(player);

  return achievementIds.some(id =>

    achievements.includes(id)

  );

}

/* =========================================================
   ACHIEVEMENT COUNT
========================================================= */

function getAchievementCount(player){

  return getPlayerAchievementIds(
    player
  ).length;

}

/* =========================================================
   ELITE ACHIEVEMENTS
========================================================= */

function hasEliteAchievements(player){

  return hasAnyAchievement(
    player,
    [

      "UNTOUCHABLE",
      "DYNASTY",
      "IMMORTAL",
      "REAPER",
      "LEGEND"

    ]
  );

}

/* =========================================================
   EXECUTIONER STATUS
========================================================= */

function isExecutioner(player){

  return (

    hasAchievement(
      player,
      "REAPER"
    )

    ||

    (player.eliminations || 0) >= 3

  );

}

/* =========================================================
   GIANT KILLER STATUS
========================================================= */

function isGiantKiller(player){

  return hasAnyAchievement(
    player,
    [

      "GIANT_KILLER",
      "UPSET_MACHINE",
      "KING_SLAYER"

    ]
  );

}

/* =========================================================
   CHAOS STATUS
========================================================= */

function isChaosPlayer(player){

  return hasAnyAchievement(
    player,
    [

      "CHAOS_AGENT",
      "WILDCARD",
      "DESTROYER"

    ]
  );

}

/* =========================================================
   ICE VEINS STATUS
========================================================= */

function hasIceVeins(player){

  return hasAnyAchievement(
    player,
    [

      "ICE_COLD",
      "CLUTCH_MASTER",
      "PRESSURE_PROOF"

    ]
  );

}