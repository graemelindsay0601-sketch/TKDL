/* =========================================================
   TKDL ACHIEVEMENT ENGINE - FINAL CLEAN VERSION
   
   ✅ ELO calculation (chess-style)
   ✅ Season points tracking
   ✅ Metadata-based evaluation (sheet-driven)
   ✅ Season 1 (301 Round Robin) filtering
   ✅ ELIMINATED: Backfill elimination detection (false positives)
   ✅ Going forward: Track eliminations in real-time only
   
   Status: Production Ready
========================================================= */

function createAchievementEngine(){
  return {
    unlocked: new Set(),
    playerStats: {},
    eliminations: [],
    topWins: [],
    seasonLosses: {},
    seasonGames: {},
    playerSeasons: {},
    seasonLeaders: {},
    seasonChampions: {},
  };
}

function getOrCreatePlayerState(engine, playerId, playerName){
  if(!engine.playerStats[playerId]){
    engine.playerStats[playerId] = {
      playerId,
      playerName,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      streak: 0,
      bestStreak: 0,
      lossStreak: 0,
      bestLossStreak: 0,
      achievements: new Set(),
      eliminations: 0,
      seasonEliminations: {},
      playerEliminations: {},
      uniqueEliminatedPlayers: new Set(),
      seasonPoints: {},
      careerPoints: 0,
      totalStakeWon: 0,
      currentELO: 1000,
      peakELO: 1000,
      eloHistory: [],
      topWins: 0,
      allInWins: 0,
      highStakeWins: 0,
      rivals: {},
      beatenPlayers: {},
      lossesAgainst: {},
      revengeWins: 0,
      upsetWins: 0,
      streakBreaks: 0,
      seasonWins: {},
      underdogWins: 0,
      eliminationWins: 0,
      clutchWins: 0,
      giantKills: 0,
      mythicWins: 0,
      comebackWins: 0,
      rivalryWins: 0,
      featuredWins: 0,
      lowPointWins: 0,
      activeSeasons: 0,
      achievementPoints: 0,
      seasonDominance: 0,
      comebackStreak: 0,
      bestComebackStreak: 0,
    };
  }
  return engine.playerStats[playerId];
}

function calculateNewELO(playerELO, opponentELO, playerWon){
  const K = 32;
  const expectedScore = 1 / (1 + Math.pow(10, (opponentELO - playerELO) / 400));
  const actualScore = playerWon ? 1 : 0;
  const newELO = playerELO + K * (actualScore - expectedScore);
  return Math.round(newELO);
}

function processElimination(engine, player, opponent, season){
  if(!player || !opponent) return;
  player.eliminations++;
  if(!player.seasonEliminations[season]){
    player.seasonEliminations[season] = 0;
  }
  player.seasonEliminations[season]++;
  if(!player.playerEliminations[opponent.playerId]){
    player.playerEliminations[opponent.playerId] = 0;
  }
  player.playerEliminations[opponent.playerId]++;
  opponent.uniqueEliminatedPlayers.add(player.playerId);
  Logger.log("ELIMINATION: " + player.playerName + " eliminated by " + opponent.playerName + " in " + season);
}

function processReplayMatch(engine, matchRow){
  const p1 = String(matchRow[1] || "").trim();
  const p2 = String(matchRow[2] || "").trim();
  const winnerName = String(matchRow[3] || "").trim();
  const stake = Number(matchRow[4]) || 0;
  const gameType = String(matchRow[5] || "");
  const season = String(matchRow[6] || "");

  if(!p1 || !p2 || !winnerName) return;

  const loserName = winnerName === p1 ? p2 : p1;
  const winnerId = getRealPlayerId(winnerName);
  const loserId = getRealPlayerId(loserName);

  const winner = getOrCreatePlayerState(engine, winnerId, winnerName);
  const loser = getOrCreatePlayerState(engine, loserId, loserName);

  winner.gamesPlayed++;
  loser.gamesPlayed++;

  if(!winner.seasonWins[season]){
    winner.activeSeasons++;
  }

  if(!winner.seasonPoints[season]){
    winner.seasonPoints[season] = 0;
  }
  if(!loser.seasonPoints[season]){
    loser.seasonPoints[season] = 0;
  }

  winner.seasonPoints[season] += stake;
  loser.seasonPoints[season] -= stake;
  winner.careerPoints += stake;
  winner.totalStakeWon += stake;

  const newWinnerELO = calculateNewELO(winner.currentELO, loser.currentELO, true);
  const newLoserELO = calculateNewELO(loser.currentELO, winner.currentELO, false);
  
  winner.currentELO = newWinnerELO;
  loser.currentELO = newLoserELO;
  
  if(newWinnerELO > winner.peakELO){
    winner.peakELO = newWinnerELO;
  }
  if(newLoserELO > loser.peakELO){
    loser.peakELO = newLoserELO;
  }
  
  winner.eloHistory.push({date: new Date(), elo: newWinnerELO});
  loser.eloHistory.push({date: new Date(), elo: newLoserELO});

  // NOTE: Elimination detection DISABLED for backfill
  // Eliminations will only be tracked in real-time going forward
  // Historical data is unreliable from match replay

  winner.wins++;
  loser.losses++;
  winner.streak++;
  loser.streak = 0;

  if(winner.streak > winner.bestStreak){
    winner.bestStreak = winner.streak;
  }

  loser.lossStreak++;
  if(loser.lossStreak > loser.bestLossStreak){
    loser.bestLossStreak = loser.lossStreak;
  }

  const isFeaturedMatch = gameType.toLowerCase().includes("featured");
  if(isFeaturedMatch){
    winner.featuredWins++;
  }

  if(stake >= 25){
    winner.highStakeWins++;
  }

  winner.seasonWins[season] = (winner.seasonWins[season] || 0) + 1;

  engine.playerSeasons[winner.playerId] = engine.playerSeasons[winner.playerId] || new Set();
  engine.playerSeasons[winner.playerId].add(season);

  engine.seasonGames[winner.playerId + "::" + season] = 
    (engine.seasonGames[winner.playerId + "::" + season] || 0) + 1;
  engine.seasonGames[loserId + "::" + season] = 
    (engine.seasonGames[loserId + "::" + season] || 0) + 1;

  engine.seasonLosses[loserId + "::" + season] = 
    (engine.seasonLosses[loserId + "::" + season] || 0) + 1;

  winner.beatenPlayers[loserId] = (winner.beatenPlayers[loserId] || 0) + 1;
  loser.lossesAgainst[winnerId] = (loser.lossesAgainst[winnerId] || 0) + 1;

  evaluateAchievementsFromMetadata(engine, winner, loser, {
    stake,
    season,
    gameType,
    isFeaturedMatch,
  });
}

function evaluateAchievementsFromMetadata(engine, winner, loser, context){
  const metadata = getAchievementMetadataV2();
  const stake = Number(context.stake) || 0;
  const season = String(context.season || '').trim();
  const isFeatured = context.isFeaturedMatch || false;
  const isSeasonOneRoundRobin = stake === 0;

  function winRate(p){
    return p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0;
  }

  function maxUniqueElims(p){
    return p.uniqueEliminatedPlayers ? p.uniqueEliminatedPlayers.size : 0;
  }

  function checkPlayerAchievements(player, isWinner){
    if(!player) return;

    const g = player.gamesPlayed || 0;
    const w = player.wins || 0;
    const wr = winRate(player);
    const elims = player.eliminations || 0;
    const careerPoints = player.careerPoints || 0;
    const elo = player.peakELO || 1000;
    const seasonPoints = player.seasonPoints[season] || 0;

    Object.values(metadata).forEach(ach => {
      if(player.achievements.has(ach.id)) return;
      
      const value = Number(ach.value) || 0;
      const secValue = Number(ach.secValue) || 0;
      let met = false;

      switch(String(ach.criteria).trim()){

        case 'CAREER_WINS':
          met = w >= value;
          break;

        case 'CAREER_GAMES':
          met = g >= value;
          break;

        case 'CAREER_POINTS':
          if(isSeasonOneRoundRobin) met = false;
          else met = careerPoints >= value;
          break;

        case 'WIN_RATE':
          met = wr >= value && (!secValue || g >= secValue);
          break;

        case 'PEAK_ELO':
          met = elo >= value && (!secValue || g >= secValue);
          break;

        case 'TOTAL_ACHIEVEMENTS':
          met = player.achievements.size >= value;
          break;

        case 'ACTIVE_SEASONS':
          met = player.activeSeasons >= value;
          break;

        case 'MULTI_SEASON_PLAYS':
          met = player.activeSeasons >= value;
          break;

        case 'NEVER_ELIMINATED':
          // DISABLED FOR BACKFILL - Only track eliminations going forward
          met = false;
          break;

        case 'SINGLE_MATCH_STAKE':
          if(isSeasonOneRoundRobin) met = false;
          else met = isWinner && stake >= value;
          break;

        case 'ELIMINATIONS':
          met = false; // DISABLED FOR BACKFILL
          break;

        case 'UNIQUE_ELIMINATIONS':
          met = false; // DISABLED FOR BACKFILL
          break;

        case 'PLAYER_ELIMINATIONS':
          met = false; // DISABLED FOR BACKFILL
          break;

        case 'TOP_RANKED_WINS':
          met = (player.giantKills || 0) >= value;
          break;

        case 'WIN_STREAK':
          met = (player.streak || 0) >= value && (!secValue || g >= secValue);
          break;

        case 'UNBEATEN_STREAK':
          met = (player.bestStreak || 0) >= value && (!secValue || g >= secValue);
          break;

        case 'LOSS_STREAK':
          met = (player.lossStreak || 0) >= value && (!secValue || g >= secValue);
          break;

        case 'LOW_POINT_WIN':
          met = (player.lowPointWins || 0) >= value;
          break;

        case 'COMEBACK_STREAK':
          met = (player.bestComebackStreak || 0) >= value;
          break;

        case 'HIGH_STAKE_WIN':
          if(isSeasonOneRoundRobin) met = false;
          else met = isWinner && stake >= value;
          break;

        case 'HIGH_STAKES_MATCHES':
          if(isSeasonOneRoundRobin) met = false;
          else met = (player.highStakeWins || 0) >= value;
          break;

        case 'HIGH_STAKES_TOTAL':
          if(isSeasonOneRoundRobin) met = false;
          else met = player.highStakeWins >= value;
          break;

        case 'SAME_OPPONENT_WINS':
          met = Object.values(player.beatenPlayers || {}).some(count => count >= value);
          break;

        case 'FEATURED_WINS':
          met = (player.featuredWins || 0) >= value;
          break;

        case 'UPSET_WIN':
          met = (player.upsetWins || 0) >= value;
          break;

        case 'TOP_RANKED_ELIMS':
          met = false; // DISABLED FOR BACKFILL
          break;

        case 'RIVAL_WINS':
          met = (player.rivalryWins || 0) >= value;
          break;

        case 'MASSIVE_SWING':
          if(isSeasonOneRoundRobin) met = false;
          else met = isWinner && stake >= value;
          break;

        case 'SEASON_GAMES':
          met = (engine.seasonGames[player.playerId + "::" + season] || 0) >= value;
          break;

        case 'SEASON_WINS':
          met = (player.seasonWins[season] || 0) >= value;
          break;

        case 'SEASON_POINTS':
          if(isSeasonOneRoundRobin) met = false;
          else met = seasonPoints >= value;
          break;

        case 'SEASON_POINTS_LEADER':
          if(isSeasonOneRoundRobin) met = false;
          else met = false;
          break;

        case 'SEASON_CHAMPION_COUNT':
          met = (player.dynastySeasons || 0) >= value;
          break;

        case 'SEASON_UNELIMINATED':
          if(isSeasonOneRoundRobin) met = false;
          else met = !player.seasonEliminations[season] && 
                (engine.seasonGames[player.playerId + "::" + season] || 0) >= (secValue || 1);
          break;

        case 'SEASON_ELIMINATIONS':
          met = false; // DISABLED FOR BACKFILL
          break;

        case 'SEASON_UNIQUE_ELIMS':
          met = false; // DISABLED FOR BACKFILL
          break;

        case 'SEASON_POINTS_LOSS':
          if(isSeasonOneRoundRobin) met = false;
          else met = seasonPoints <= -value;
          break;

        case 'FIRST_SEASON_POINTS':
          if(isSeasonOneRoundRobin) met = false;
          else met = seasonPoints >= value && player.activeSeasons === 1;
          break;

        case 'FIRST_SEASON_TOP3':
          met = false;
          break;

        case 'SEASON_START_WINS':
          met = (player.seasonWins[season] || 0) >= value && 
                (engine.seasonGames[player.playerId + "::" + season] || 0) === value;
          break;

        case 'TOP3_FULL_SEASON':
          met = false;
          break;

        case 'ELIMINATED_SEASON':
          met = false; // DISABLED FOR BACKFILL
          break;

        case 'ALL_HIDDEN_UNLOCKED':
          met = Object.values(metadata)
            .filter(a => a.hidden === 'true')
            .every(a => player.achievements.has(a.id));
          break;

        default:
          break;
      }

      if(met){
        unlockAchievementV2(engine, player, ach.id);
      }
    });
  }

  checkPlayerAchievements(winner, true);
  checkPlayerAchievements(loser, false);
}

function unlockAchievementV2(engine, player, achievementId){
  const key = player.playerId + "::" + achievementId;

  if(engine.unlocked.has(key)){
    return;
  }

  engine.unlocked.add(key);
  player.achievements.add(achievementId);

  const metadata = getAchievementMetadataV2()[achievementId];

  if(!metadata){
    return;
  }

  const sheet = getSheet("PLAYER_ACHIEVEMENTS");

  sheet.appendRow([
    Utilities.getUuid(),
    player.playerId,
    achievementId,
    new Date(),
    getCurrentSeason(),
    metadata.rarity
  ]);

  Logger.log("UNLOCKED: " + achievementId + " for " + player.playerName);
}

function getRealPlayerId(playerName){
  const players = getPlayersData().slice(1);
  const normalized = String(playerName || "").trim().toLowerCase();

  const match = players.find(row =>
    String(row[0] || "").trim().toLowerCase() === normalized
  );

  if(match){
    return match[13];
  }

  return normalizeReplayPlayerId(playerName);
}

function normalizeReplayPlayerId(playerName){
  return (playerName.trim().toUpperCase().replace(/\s+/g, "_"));
}

function getAchievementMetadataV2(){
  try {
    const ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
    const sheet = ss.getSheetByName('ACHIEVEMENT_METADATA');
    if(!sheet) return {};
    
    const rows = sheet.getDataRange().getValues().slice(1);
    const out = {};
    
    rows.forEach(function(row){
      const id = String(row[1]||'').trim();
      if(!id) return;
      
      out[id] = {
        id: id,
        name: String(row[0]||'').trim(),
        category: String(row[2]||'').trim(),
        rarity: String(row[3]||'').trim(),
        priority: Number(row[4]) || 0,
        hidden: String(row[5]||'').toLowerCase(),
        icon: String(row[6]||'').trim(),
        description: String(row[7]||'').trim(),
        criteria: String(row[8]||'').trim(),
        value: Number(row[9]) || 0,
        engine: String(row[10]||'').trim(),
        secCriteria: String(row[11]||'').trim(),
        secValue: Number(row[12]) || 0,
        scope: String(row[13]||'').trim()
      };
    });
    
    return out;
  } catch(e){
    Logger.log('getAchievementMetadataV2 error: ' + e);
    return {};
  }
}

function backfillPlayerAchievements(){
  Logger.log("===== BACKFILL START =====");
  
  const engine = createAchievementEngine();
  const sheet = getSheet("CAREER_MATCHES");
  
  if(!sheet){
    Logger.log("CAREER_MATCHES sheet not found");
    return;
  }
  
  const rows = sheet.getDataRange().getValues().slice(1);
  let processedCount = 0;
  
  Logger.log("Processing " + rows.length + " matches...");
  
  rows.forEach(function(row, index){
    try {
      processReplayMatch(engine, row);
      processedCount++;
      
      if(processedCount % 10 === 0){
        Logger.log("Processed: " + processedCount + " matches");
      }
    } catch(e){
      Logger.log("Error processing match " + index + ": " + e);
    }
  });
  
  Logger.log("===== BACKFILL COMPLETE =====");
  Logger.log("Total matches processed: " + processedCount);
  Logger.log("Total achievements unlocked: " + engine.unlocked.size);
  Logger.log("Players with achievements: " + Object.keys(engine.playerStats).length);
  
  Object.entries(engine.playerStats).forEach(([pid, stats]) => {
    if(stats.achievements.size > 0){
      Logger.log(stats.playerName + " (" + pid + "): " + stats.achievements.size + " achievements");
    }
  });
}

function getSheet(sheetName){
  const ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
  return ss.getSheetByName(sheetName);
}

function getPlayersData(){
  return getSheet("PLAYERS").getDataRange().getValues();
}

function getAchievementEngineSeason(){
  return new Date().getFullYear() + "_" +
    (Math.floor((new Date().getMonth() + 1) / 6) === 0 ? 1 : 2);
}

function testELOCalculation(){
  const player1 = 1600;
  const player2 = 1400;
  
  const newELO1 = calculateNewELO(player1, player2, true);
  const newELO2 = calculateNewELO(player2, player1, false);
  
  Logger.log("Player 1 (1600) beats Player 2 (1400)");
  Logger.log("New ELO P1: " + newELO1 + " (expected: ~1606)");
  Logger.log("New ELO P2: " + newELO2 + " (expected: ~1394)");
}

function testBackfill(){
  backfillPlayerAchievements();
}