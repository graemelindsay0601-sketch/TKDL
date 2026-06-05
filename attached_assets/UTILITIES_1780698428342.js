function getSheet(name) {
  return SpreadsheetApp
    .openById('1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc')
    .getSheetByName(name);
}

function getSetting(key) {
  const sheet = getSheet('SETTINGS');
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === String(key).trim().toLowerCase())
      return data[i][1];
  }
  return null;
}

function normalizePlayerName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getArchivedMatches() {
  const sheet = getSheet('CAREER_MATCHES');
  if (!sheet || sheet.getLastRow() <= 1) return [];
  return sheet.getDataRange().getValues().slice(1)
    .filter(r => r[1] && r[2] && r[3])
    .map(r => ({
      date:     r[0],
      player1:  String(r[1]).trim(),
      player2:  String(r[2]).trim(),
      winner:   String(r[3]).trim(),
      stake:    Number(r[4]) || 0,
      gameType: String(r[5] || 'League'),
      season:   String(r[6] || '')
    }));
}

function getPlayerWinStreak(playerName) {
  const matches = getArchivedMatches();
  const name = String(playerName || '').trim().toLowerCase();
  let streak = 0;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const involved = m.player1.toLowerCase() === name || m.player2.toLowerCase() === name;
    if (!involved) continue;
    if (m.winner.toLowerCase() === name) { streak++; }
    else { break; }
  }
  return streak;
}

function getPlayerLossStreak(playerName) {
  const matches = getArchivedMatches();
  const name = String(playerName || '').trim().toLowerCase();
  let streak = 0;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const involved = m.player1.toLowerCase() === name || m.player2.toLowerCase() === name;
    if (!involved) continue;
    if (m.winner.toLowerCase() !== name) { streak++; }
    else { break; }
  }
  return streak;
}