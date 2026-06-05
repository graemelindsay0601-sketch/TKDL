/* =========================================================
   TKDL CANONICAL PLAYER STATE
   Single Source Of Truth
   Read-Only Interpretation Layer
========================================================= */

/* =========================================================
   GET CANONICAL PLAYER STATE
========================================================= */

function getCanonicalPlayerState(player){

  if(!player){

    return {

      exists:false

    };

  }

  const wins =
    player.wins || 0;

  const losses =
    player.losses || 0;

  const streak =
    player.winStreak || 0;

  const elo =
    player.elo || 1000;

  const titles =
    player.titles || 0;

  const eliminations =
    player.eliminations || 0;

  const matches =
    wins + losses;

  const winRate =

    matches > 0

      ? Math.round(
          (wins / matches) * 100
        )

      : 0;

  /* =====================================================
     ELIMINATION STATE
  ===================================================== */

  const isEliminated =

    player.status === "ELIMINATED"

    ||

    player.eliminated === true;

  /* =====================================================
     HOT STATE
  ===================================================== */

  const isHot =
    streak >= 3;

  const isOnFire =
    streak >= 5;

  const isUntouchable =
    streak >= 8;

  /* =====================================================
     THREAT STATE
  ===================================================== */

  const isDangerous =
    elo >= 1150;

  const isElite =
    elo >= 1250;

  const isLegendary =
    elo >= 1350
    ||
    titles >= 10;

  /* =====================================================
     PRESSURE STATE
  ===================================================== */

  const isUnderPressure =

    losses >= wins

    &&

    matches >= 5;

  /* =====================================================
     CAREER TIERS
  ===================================================== */

  let careerTier = "ROOKIE";

  if(matches >= 100){

    careerTier = "VETERAN";

  }

  if(matches >= 250){

    careerTier = "ELITE";

  }

  if(matches >= 500){

    careerTier = "LEGEND";

  }

  /* =====================================================
     PRESTIGE TIER
  ===================================================== */

  let prestigeTier = "BRONZE";

  if(titles >= 1){

    prestigeTier = "SILVER";

  }

  if(titles >= 3){

    prestigeTier = "GOLD";

  }

  if(titles >= 5){

    prestigeTier = "PLATINUM";

  }

  if(titles >= 10){

    prestigeTier = "DIAMOND";

  }

  /* =====================================================
     RETURN CANONICAL STATE
  ===================================================== */

  return {

    exists:true,

    matches,
    wins,
    losses,
    winRate,

    elo,
    streak,
    titles,
    eliminations,

    isEliminated,

    isHot,
    isOnFire,
    isUntouchable,

    isDangerous,
    isElite,
    isLegendary,

    isUnderPressure,

    careerTier,
    prestigeTier

  };

}