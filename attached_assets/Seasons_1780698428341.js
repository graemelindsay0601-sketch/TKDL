

function onJoinLeagueSubmit(e){

  Logger.log("JOIN TRIGGER FIRED");

  try{

    if(!e || !e.values)
      return;

    const sheetName =
      e.range.getSheet().getName();

    if(sheetName !== "JOIN_FORM_SUBMISSIONS")
      return;

    const playerName =
      e.values[1];

    if(!playerName)
      return;

    const existing =
      findPlayerByName(playerName);

    if(existing !== -1){

      Logger.log("PLAYER EXISTS");
      return;

    }

    createPlayer(playerName);

    rebuildLeaderboard();

    clearLeagueCache();

    Logger.log("PLAYER CREATED");

  }catch(err){

    Logger.log(err);

  }

}

/*
============================================================
LEGACY FUNCTION

Used only for the MAY_2026 -> JUNE_2026 transition.

DO NOT RUN.
DO NOT MODIFY.
Retained for historical reference only.

Superseded by performSeasonRollover().
============================================================
*/
function startJune2026Season() {
  const ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
  
  // 1. Archive current season snapshot
  const playersSheet = ss.getSheetByName('PLAYERS');
  const settingsSheet = ss.getSheetByName('SETTINGS');
  let archiveSheet = ss.getSheetByName('SEASON_ARCHIVE');
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet('SEASON_ARCHIVE');
    archiveSheet.appendRow(['Season','Player','Points','ELO','Wins','Losses','Rank','ArchivedAt']);
  }
  
  const players = playersSheet.getDataRange().getValues().slice(1);
  const now = new Date().toISOString();
  players.forEach((row, i) => {
    if (!row[0]) return;
    archiveSheet.appendRow([
      'MAY_2026', row[1], row[3], row[4], row[5], row[6], i+1, now
    ]);
  });
  Logger.log('Archived ' + players.length + ' players for MAY_2026');
  
  // 2. Reset season stats to 0 for all players (Points, Games, Wins, Losses)
  const numRows = players.length;
  if (numRows > 0) {
    // Columns 4-7 = Points, Games, Wins, Losses (indices 3-6)
    const statsRange = playersSheet.getRange(2, 4, numRows, 4);
    const zeros = Array(numRows).fill([0, 0, 0, 0]);
    statsRange.setValues(zeros);
    Logger.log('Reset points, games, wins, losses for ' + numRows + ' players');
  }
  
  // 3. Update current season in SETTINGS
  const settingsData = settingsSheet.getDataRange().getValues();
  for (let i = 0; i < settingsData.length; i++) {
    if (String(settingsData[i][0]).toUpperCase() === 'CURRENT_SEASON') {
      settingsSheet.getRange(i+1, 2).setValue('JUNE_2026');
      Logger.log('Updated CURRENT_SEASON to JUNE_2026');
      break;
    }
  }
  
  // 4. Rebuild cache
  rebuildLeagueDataCache();
  Logger.log('Season rollover complete. Welcome to JUNE_2026!');
}

// Run this immediately to fix Wins, Losses, Games that weren't reset during the MAY->JUNE rollover
function resetCurrentSeasonStats() {
  const ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
  const playersSheet = ss.getSheetByName('PLAYERS');
  const players = playersSheet.getDataRange().getValues().slice(1);
  const numRows = players.length;
  if (numRows > 0) {
    // Only reset Games(col5), Wins(col6), Losses(col7) -- keeping current Points
    const gamesRange = playersSheet.getRange(2, 5, numRows, 3);
    const zeros = Array(numRows).fill([0, 0, 0]);
    gamesRange.setValues(zeros);
    Logger.log('Fixed: Reset Games, Wins, Losses for ' + numRows + ' players');
  }
  rebuildLeagueDataCache();
  Logger.log('Cache rebuilt. JUNE_2026 stats are now clean.');
}

// ============================================================
//  AUTOMATIC MONTHLY SEASON ROLLOVER SYSTEM
//  Added: automatically rolls season when calendar month changes.
//  Safe: reads current season from SETTINGS, never hardcoded.
//  Trigger: install once with createMonthlyRolloverTrigger().
// ============================================================

// Month number -> name map used for season labels
const MONTH_NAMES = [
  'JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
  'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'
];

/**
 * Returns the season label for a given Date, e.g. "JUNE_2026".
 */
function getSeasonLabel(date) {
  return MONTH_NAMES[date.getMonth()] + '_' + date.getFullYear();
}

/**
 * Returns the season label for the NEXT calendar month after a given Date.
 */
function getNextSeasonLabel(date) {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return getSeasonLabel(next);
}

/**
 * Reads CURRENT_SEASON from the SETTINGS sheet.
 * Returns the value string (e.g. "JUNE_2026") or null if not found.
 */
function getCurrentSeasonFromSettings() {
  const ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
  const settingsSheet = ss.getSheetByName('SETTINGS');
  if (!settingsSheet) return null;
  const data = settingsSheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).toUpperCase() === 'CURRENT_SEASON') {
      return String(data[i][1]).trim().toUpperCase();
    }
  }
  return null;
}

/**
 * Core rollover: archives current season snapshot, resets player stats,
 * updates CURRENT_SEASON in SETTINGS, rebuilds cache + leaderboard.
 * Fully dynamic — no hardcoded month names.
 */




function performSeasonRollover() {
  const ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
  const playersSheet    = ss.getSheetByName('PLAYERS');
  const settingsSheet   = ss.getSheetByName('SETTINGS');

  // Work out old and new season labels
  const oldSeason = getCurrentSeasonFromSettings();
  if (!oldSeason) {
    Logger.log('performSeasonRollover: could not read CURRENT_SEASON from SETTINGS. Aborting.');
    return;
  }
  const now       = new Date();
  const newSeason = getSeasonLabel(now); // current calendar month

  Logger.log('Rolling over from ' + oldSeason + ' -> ' + newSeason);

  // 1. Archive current season snapshot
  let archiveSheet = ss.getSheetByName('SEASON_ARCHIVE');
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet('SEASON_ARCHIVE');
    archiveSheet.appendRow(['Season','Player','Points','ELO','Wins','Losses','Rank','ArchivedAt']);
  }

  const players = playersSheet.getDataRange().getValues().slice(1);
  const nowISO  = now.toISOString();
  players.forEach((row, i) => {
    if (!row[0]) return; // skip blank rows
    archiveSheet.appendRow([
      oldSeason, row[0], row[3], row[4], row[5], row[6], i + 1, nowISO
    ]);
  });
  Logger.log('Archived ' + players.length + ' players for ' + oldSeason);

  // 2. Reset season stats (Points col4, Games col5, Wins col6, Losses col7)
  const numRows = players.length;
  if (numRows > 0) {
    const statsRange = playersSheet.getRange(2, 4, numRows, 4);
    const zeros      = Array(numRows).fill([0, 0, 0, 0]);
    statsRange.setValues(zeros);
    Logger.log('Reset points, games, wins, losses for ' + numRows + ' players');
  }

  // 3. Update CURRENT_SEASON in SETTINGS
  const settingsData = settingsSheet.getDataRange().getValues();
  for (let i = 0; i < settingsData.length; i++) {
    if (String(settingsData[i][0]).toUpperCase() === 'CURRENT_SEASON') {
      settingsSheet.getRange(i + 1, 2).setValue(newSeason);
      Logger.log('Updated CURRENT_SEASON to ' + newSeason);
      break;
    }
  }

  // 4. Rebuild cache and leaderboard
  // Save standings archive before reset
  try {
    var archSh = ss.getSheetByName('SEASON_STANDINGS_ARCHIVE') || ss.insertSheet('SEASON_STANDINGS_ARCHIVE');
    if(archSh.getLastRow()===0) archSh.appendRow(['Season','Rank','Player','Wins','Losses','Points','ELO','Games']);
    var pRows = ss.getSheetByName('PLAYERS').getDataRange().getValues().slice(1);
    var rank=0;
    pRows.filter(function(r){return r[0]&&String(r[12]).toUpperCase()!=='INACTIVE';})
.sort(function(a,b){

  const pointsDiff =
    (Number(b[3]) || 0) -
    (Number(a[3]) || 0);

  if(pointsDiff !== 0){
    return pointsDiff;
  }

  return (
    (Number(b[8]) || 0) -
    (Number(a[8]) || 0)
  );

})
      .forEach(function(r){
        rank++;
        archSh.appendRow([oldSeason,rank,String(r[0]),Number(r[5])||0,Number(r[6])||0,Number(r[3])||0,Number(r[8])||0,Number(r[4])||0]);
      });
  } catch(eA){Logger.log('Archive err:'+eA);}
  // Reset player stats and clear submissions
  try {
    var plSh=ss.getSheetByName('PLAYERS');var plD=plSh.getDataRange().getValues();
    for(var pi=1;pi<plD.length;pi++){if(!plD[pi][0])continue;plSh.getRange(pi+1,4).setValue(TKDL.STARTING_POINTS||25);plSh.getRange(pi+1,5).setValue(0);plSh.getRange(pi+1,6).setValue(0);plSh.getRange(pi+1,7).setValue(0);}
    var fsSh=ss.getSheetByName('FORM_SUBMISSIONS');var fsLast=fsSh.getLastRow();if(fsLast>1)fsSh.deleteRows(2,fsLast-1);
    var sysSh=ss.getSheetByName('SYSTEM_STATE');if(sysSh)sysSh.getRange(1,2).setValue(newSeason);
  } catch(eR){Logger.log('Reset err:'+eR);}
  try{rebuildLeaderboard();}catch(eL){Logger.log('LB err:'+eL);}
  rebuildLeagueDataCache();
  rebuildLeaderboard();
  Logger.log('Season rollover complete. Welcome to ' + newSeason + '!');
}

/**
 * Called daily by a time trigger.
 * Checks whether the stored season matches the current calendar month.
 * If not, performs the rollover automatically.
 * Safe to run multiple times — only acts once per month.
 */
function checkAndRolloverSeason() {

  Logger.log(
    "ROLLOVER DISABLED FOR TESTING"
  );

  return;

}
/**
 * Run ONCE manually to install the daily time trigger.
 * After running, check Edit > Triggers to confirm it appears.
 * Do NOT run more than once (it would create duplicate triggers).
 */
function createMonthlyRolloverTrigger() {
  // Remove any existing trigger with the same handler to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'checkAndRolloverSeason') {
      ScriptApp.deleteTrigger(t);
      Logger.log('Removed old checkAndRolloverSeason trigger.');
    }
  });

  // Install a new daily trigger, runs between midnight and 1 AM
  ScriptApp.newTrigger('checkAndRolloverSeason')
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .create();

  Logger.log('Daily rollover trigger installed. Runs at midnight each day.');
}

/**
 * Run to see currently installed triggers (diagnostic helper).
 */
function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    Logger.log('Trigger: ' + t.getHandlerFunction() + ' | type: ' + t.getEventType());
  });
  Logger.log('Total triggers: ' + triggers.length);
}


function buildMatchContext(winnerPlayer, loserPlayer, stake, winnerPrePoints, loserPrePoints) {
  // Builds context object for achievement engine evaluation
  try {
    var ss = SpreadsheetApp.openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc');
    var currentSeason = getCurrentSeason ? getCurrentSeason() : '';
    
    // Build player objects with all needed properties
    var winner = {
      name: String(winnerPlayer.name || winnerPlayer[0] || ''),
      playerId: String(winnerPlayer.playerId || winnerPlayer[PLAYER.PLAYER_ID] || ''),
      rank: Number(winnerPlayer.rank || winnerPlayer[PLAYER.CURRENT_RANK] || 0),
      elo: Number(winnerPlayer.elo || winnerPlayer[PLAYER.ELO] || 1000),
      wins: Number(winnerPlayer.wins || winnerPlayer[PLAYER.WINS] || 0),
      losses: Number(winnerPlayer.losses || winnerPlayer[PLAYER.LOSSES] || 0),
      games: Number(winnerPlayer.games || winnerPlayer[PLAYER.GAMES] || 0),
      points: Number(winnerPlayer.points || winnerPlayer[PLAYER.POINTS] || 25),
      season: currentSeason
    };
    var loser = {
      name: String(loserPlayer.name || loserPlayer[0] || ''),
      playerId: String(loserPlayer.playerId || loserPlayer[PLAYER.PLAYER_ID] || ''),
      rank: Number(loserPlayer.rank || loserPlayer[PLAYER.CURRENT_RANK] || 0),
      elo: Number(loserPlayer.elo || loserPlayer[PLAYER.ELO] || 1000),
      wins: Number(loserPlayer.wins || loserPlayer[PLAYER.WINS] || 0),
      losses: Number(loserPlayer.losses || loserPlayer[PLAYER.LOSSES] || 0),
      games: Number(loserPlayer.games || loserPlayer[PLAYER.GAMES] || 0),
      points: Number(loserPlayer.points || loserPlayer[PLAYER.POINTS] || 25),
      season: currentSeason
    };
    return {
      winner: winner,
      loser: loser,
      stake: Number(stake) || 0,
      season: currentSeason,
      gameType: 'Standard',
      winnerPrePoints: Number(winnerPrePoints) || winner.points,
      loserPrePoints: Number(loserPrePoints) || loser.points,
      timestamp: new Date()
    };
  } catch(e) {
    Logger.log('buildMatchContext error: ' + e);
    return {winner: winnerPlayer, loser: loserPlayer, stake: stake||0, season: '', gameType: 'Standard'};
  }
}