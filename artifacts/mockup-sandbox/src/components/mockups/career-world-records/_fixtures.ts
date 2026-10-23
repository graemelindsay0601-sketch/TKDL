export type RecordSource = "LIVE" | "QUICK_SIM" | "SIMULATED";

export type RecordEntry = {
  key: "nine-darter" | "match-average" | "tv-average" | "match-180s" | "checkout";
  participantKey: string;
  matchId: string;
  eventId: string;
  value: number;
  season: number;
  day: number;
  source: RecordSource;
  name: string;
  eventName: string;
  you: boolean;
};

export type WorldRecordsView = {
  records: {
    key: RecordEntry["key"];
    label: string;
    unit: string;
    entries: RecordEntry[];
  }[];
  nineDartersSince: "START" | "BOOK_ADDED";
};

export const recordsView: WorldRecordsView = {
  records: [
    {
      key: "nine-darter",
      label: "Nine-dart finishes",
      unit: "legs",
      entries: [
        { key: "nine-darter", participantKey: "HUMAN", matchId: "match-441", eventId: "event-world", value: 1, season: 2026, day: 89, source: "LIVE", name: "Alex Finch", eventName: "World Championship", you: true },
        { key: "nine-darter", participantKey: "player-14", matchId: "match-408", eventId: "event-grand-prix", value: 1, season: 2026, day: 54, source: "SIMULATED", name: "Rory Vale", eventName: "Darts Grand Prix", you: false },
      ],
    },
    {
      key: "match-average",
      label: "Highest match average",
      unit: "average",
      entries: [
        { key: "match-average", participantKey: "HUMAN", matchId: "match-441", eventId: "event-world", value: 109.24, season: 2026, day: 89, source: "LIVE", name: "Alex Finch", eventName: "World Championship", you: true },
        { key: "match-average", participantKey: "player-14", matchId: "match-408", eventId: "event-grand-prix", value: 108.67, season: 2026, day: 54, source: "SIMULATED", name: "Rory Vale", eventName: "Darts Grand Prix", you: false },
        { key: "match-average", participantKey: "player-22", matchId: "match-377", eventId: "event-masters", value: 105.82, season: 2026, day: 31, source: "QUICK_SIM", name: "Ellis Ward", eventName: "World Masters", you: false },
      ],
    },
    {
      key: "tv-average",
      label: "Highest televised average",
      unit: "average",
      entries: [
        { key: "tv-average", participantKey: "HUMAN", matchId: "match-441", eventId: "event-world", value: 109.24, season: 2026, day: 89, source: "LIVE", name: "Alex Finch", eventName: "World Championship", you: true },
        { key: "tv-average", participantKey: "player-22", matchId: "match-377", eventId: "event-masters", value: 105.82, season: 2026, day: 31, source: "QUICK_SIM", name: "Ellis Ward", eventName: "World Masters", you: false },
      ],
    },
    {
      key: "match-180s",
      label: "Most 180s in a match",
      unit: "180s",
      entries: [
        { key: "match-180s", participantKey: "player-14", matchId: "match-408", eventId: "event-grand-prix", value: 25, season: 2026, day: 54, source: "SIMULATED", name: "Rory Vale", eventName: "Darts Grand Prix", you: false },
        { key: "match-180s", participantKey: "HUMAN", matchId: "match-441", eventId: "event-world", value: 21, season: 2026, day: 89, source: "LIVE", name: "Alex Finch", eventName: "World Championship", you: true },
        { key: "match-180s", participantKey: "player-22", matchId: "match-377", eventId: "event-masters", value: 19, season: 2026, day: 31, source: "QUICK_SIM", name: "Ellis Ward", eventName: "World Masters", you: false },
      ],
    },
    {
      key: "checkout",
      label: "Highest checkout",
      unit: "checkout",
      entries: [
        { key: "checkout", participantKey: "player-22", matchId: "match-377", eventId: "event-masters", value: 170, season: 2026, day: 31, source: "QUICK_SIM", name: "Ellis Ward", eventName: "World Masters", you: false },
        { key: "checkout", participantKey: "HUMAN", matchId: "match-441", eventId: "event-world", value: 167, season: 2026, day: 89, source: "LIVE", name: "Alex Finch", eventName: "World Championship", you: true },
        { key: "checkout", participantKey: "player-14", matchId: "match-408", eventId: "event-grand-prix", value: 161, season: 2026, day: 54, source: "SIMULATED", name: "Rory Vale", eventName: "Darts Grand Prix", you: false },
      ],
    },
  ],
  nineDartersSince: "BOOK_ADDED",
};
