/* =========================================================
   TKDL EXTENSIONS LAYER
=========================================================

SAFE EXTENSION ARCHITECTURE

Core engine produces canonical state.
Extensions consume canonical state.

DO NOT:
- mutate leaderboard state
- mutate balances directly
- mutate rankings directly

Extensions should ONLY:
- react
- enrich
- decorate
- record secondary systems

========================================================= */

/* =========================================================
   MAIN EXTENSION WRAPPER
========================================================= */

function runMatchExtensions(
  matchContext
){

  try{

    runAchievementExtensions(
      matchContext
    );

  }catch(err){

    Logger.log(
      "Achievement extension failure"
    );

    Logger.log(err);

  }

  try{

    runRivalryExtensions(
      matchContext
    );

  }catch(err){

    Logger.log(
      "Rivalry extension failure"
    );

    Logger.log(err);

  }

  try{

    runLegacyExtensions(
      matchContext
    );

  }catch(err){

    Logger.log(
      "Legacy extension failure"
    );

    Logger.log(err);

  }

}

/* =========================================================
   ACHIEVEMENTS
========================================================= */

function runAchievementExtensions(
  matchContext
){

  processAchievementsFromContext(
    matchContext
  );

}

/* =========================================================
   RIVALRIES
========================================================= */

function runRivalryExtensions(
  matchContext
){

  // future rivalry systems

}

/* =========================================================
   LEGACY SYSTEMS
========================================================= */

function runLegacyExtensions(
  matchContext
){

  // future profile identity
  // future aura systems
  // future narratives

}