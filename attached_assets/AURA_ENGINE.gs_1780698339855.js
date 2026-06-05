/* =========================================================
   TKDL AURA ENGINE
========================================================= */

function getPlayerAura(
  player
){

  /* =========================
     DOMINANCE
  ========================= */

  if(
    player.rank === 1
    &&
    player.winRate >= 75
  ){
    return "Dominant";
  }

  /* =========================
     UNTOUCHABLE
  ========================= */

  if(
    player.streak >= 5
  ){
    return "Untouchable";
  }

  /* =========================
     LETHAL
  ========================= */

  if(
    player.winRate >= 80
  ){
    return "Lethal";
  }

  /* =========================
     DANGEROUS
  ========================= */

  if(
    player.points <= 5
    &&
    player.winRate >= 50
  ){
    return "Dangerous";
  }

  /* =========================
     HUNTED
  ========================= */

  if(
    player.rank <= 3
  ){
    return "Hunted";
  }

  /* =========================
     RISING
  ========================= */

  if(
    player.streak >= 3
  ){
    return "Rising";
  }

  /* =========================
     UNSTABLE
  ========================= */

  if(
    player.losses >=
    player.wins
  ){
    return "Unstable";
  }

  /* =========================
     FALLEN
  ========================= */

  if(
    player.rank >= 8
    &&
    player.games >= 10
  ){
    return "Fallen";
  }

  return "Balanced";

}