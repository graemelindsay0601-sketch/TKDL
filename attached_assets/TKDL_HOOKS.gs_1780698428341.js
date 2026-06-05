/* =========================================================
   TKDL SAFE HOOK SYSTEM
========================================================= */

/* =========================================================
   MATCH COMPLETED
========================================================= */

function onMatchProcessed(
  matchContext
){

  runMatchExtensions(
    matchContext
  );

}

/* =========================================================
   FULL REBUILD COMPLETED
========================================================= */

function onFullRebuildComplete(){

  Logger.log(
    "Full rebuild completed."
  );

}

/* =========================================================
   ACHIEVEMENT UNLOCKED
========================================================= */

function onAchievementUnlocked({

  playerId,
  achievementId

}){

  Logger.log(

    "Achievement unlocked: " +

    achievementId +

    " | " +

    playerId

  );

}