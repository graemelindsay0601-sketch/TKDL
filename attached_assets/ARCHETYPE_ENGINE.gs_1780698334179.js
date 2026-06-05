/* =========================================================
   TKDL ARCHETYPE ENGINE
========================================================= */

function getPlayerArchetype(
  player
){

  /* =========================
     THE EXECUTIONER
  ========================= */

  if(
    player.eliminations >= 5
  ){
    return "Executioner";
  }

  /* =========================
     THE KINGPIN
  ========================= */

  if(
    player.points >= 100
  ){
    return "Kingpin";
  }

  /* =========================
     THE SHARPSHOOTER
  ========================= */

  if(
    player.winRate >= 80
    &&
    player.games >= 10
  ){
    return "Sharpshooter";
  }

  /* =========================
     THE TITAN
  ========================= */

  if(
    player.rank <= 3
    &&
    player.games >= 20
  ){
    return "Titan";
  }

  /* =========================
     THE SURVIVOR
  ========================= */

  if(
    player.points <= 5
    &&
    player.winRate >= 50
  ){
    return "Survivor";
  }

  /* =========================
     THE VETERAN
  ========================= */

  if(
    player.games >= 50
  ){
    return "Veteran";
  }

  /* =========================
     THE CONTENDER
  ========================= */

  if(
    player.winRate >= 60
  ){
    return "Contender";
  }

  /* =========================
     THE CHALLENGER
  ========================= */

  if(
    player.games >= 10
  ){
    return "Challenger";
  }

  return "Competitor";

}