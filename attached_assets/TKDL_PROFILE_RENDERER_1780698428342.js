/* =========================================================
   TKDL PROFILE RENDERER ENGINE
   Presentation Layer Only
   Read-Only / Non-Canonical
========================================================= */
function buildPlayerProfile(playerId, leagueData) {

  try {

    const player =
      leagueData.players[playerId];

    if (!player) {
      return null;
    }

    const aura =
      buildAuraProfile(player);

    const archetype =
      buildArchetypeProfile(player);

    const prestige =
      buildPrestigeProfile(player);

    const rivalries =
      buildRivalryProfile(
        playerId,
        leagueData
      );

          const rivalrySpotlight =
      buildPlayerRivalrySpotlight(
        playerId,
        leagueData
      );

    const legacy =
      buildLegacyProfile(player);

    const visuals =
      buildVisualProfile({
        player,
        aura,
        archetype,
        prestige,
        rivalries,
        legacy
      });

          const visualIdentity =
      buildProfileVisualIdentity(
        player
      );

          const title =
      buildProfileTitle(player);

    const subtitle =
      buildProfileSubtitle(player);

    const threatLevel =
      buildThreatLevel(player);

    const signatureTrait =
      buildSignatureTrait(player);

    return {

      playerId,

      identity: {
        name:
          player.name || "Unknown",

        nickname:
          player.nickname || "",

        rank:
          player.rank || null
      },

      stats: {

        wins:
          player.wins || 0,

        losses:
          player.losses || 0,

        elo:
          player.elo || 1000,

        streak:
          player.winStreak || 0,

        titles:
          player.titles || 0
      },

      aura,
      archetype,
      prestige,
      rivalries,
      rivalrySpotlight,
legacy,
visuals,
visualIdentity,

title,
subtitle,
      threatLevel,
      signatureTrait
    };

  }
  catch(err){

    return {

      error:true,

      message:
        String(err)

    };

  }

}
function buildAuraProfile(player) {

  const auraScore =
    player.auraScore || 0;

  let tier = "NONE";

  if (auraScore >= 90) {
    tier = "MYTHIC";
  }
  else if (auraScore >= 75) {
    tier = "LEGENDARY";
  }
  else if (auraScore >= 60) {
    tier = "ELITE";
  }
  else if (auraScore >= 40) {
    tier = "RISING";
  }

  return {
    score: auraScore,
    tier
  };
}
function buildArchetypeProfile(player) {

  return {
    primary:
      player.archetype || "UNDEFINED"
  };
}
function buildPrestigeProfile(player) {

  const titles =
    player.titles || 0;

  let tier = "BRONZE";

  if (titles >= 10) {
    tier = "DIAMOND";
  }
  else if (titles >= 5) {
    tier = "PLATINUM";
  }
  else if (titles >= 3) {
    tier = "GOLD";
  }
  else if (titles >= 1) {
    tier = "SILVER";
  }

  return {
    titles,
    tier
  };
}
function buildRivalryProfile(
  playerId,
  leagueData
) {

  return {
    activeRivalries: [],
    rivalryCount: 0,
    hottestRivalry: null
  };
}
function buildLegacyProfile(player) {

  return {

    milestoneCount:
      player.milestones?.length || 0,

    longestWinStreak:
      player.longestWinStreak || 0,

    legacyScore:
      player.legacyScore || 0
  };
}
function buildVisualProfile(context) {

  const {
    aura,
    prestige,
    archetype
  } = context;

  let cardTheme = "default";

  if (prestige.tier === "DIAMOND") {
    cardTheme = "diamond";
  }
  else if (aura.tier === "MYTHIC") {
    cardTheme = "mythic";
  }
  else if (prestige.tier === "PLATINUM") {
    cardTheme = "platinum";
  }

  return {

    cardTheme,

    auraGlow:
      aura.tier.toLowerCase(),

    prestigeBorder:
      prestige.tier.toLowerCase(),

    archetypeLabel:
      archetype.primary
  };
}
function buildAllPlayerProfiles(leagueData) {

  const profiles = {};

  const players =
    leagueData.players || {};

  Object.keys(players).forEach(playerId => {

    profiles[playerId] =
      buildPlayerProfile(
        playerId,
        leagueData
      );

  });

  return profiles;
}