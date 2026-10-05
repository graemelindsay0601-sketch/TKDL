/** Public read model: deliberately excludes all hidden A2 sporting attributes. */
export type WorldIdentity = {
  id: string; name: string; nationality: string; homeRegion: string;
  age: number; startingAge: number; createdSeason: number; retiredSeason: number | null;
  status: "ACTIVE" | "RETIRED"; worldRanking: number | null;
};
export type Meeting = {
  id: string; opponentId: string; eventId: string; name: string; season: number; day: number;
  date: string | null; round: number; stage: string; won: boolean;
  final: boolean; major: boolean; qualification: boolean;
  legsHuman: number | null; legsNpc: number | null; setsHuman: number | null; setsNpc: number | null;
  humanAge: number | null;
};
export type RelationshipLabel = "Familiar Opponent" | "Career Rival" | "Nemesis" | "Favourite Opponent" | "Generation Rival" | "Q-School Class" | "Junior Contemporary";
export type Cohort = { opponentId: string; kind: "Q-School Class" | "Junior Contemporary"; season: number; session: string; name: string };
export type OpponentRelationship = {
  player: WorldIdentity; labels: RelationshipLabel[]; evidence: string[];
  meetings: number; humanWins: number; npcWins: number; winPercentage: number | null;
  eventCount: number; seasonCount: number; finals: number; majorMeetings: number; qualificationMeetings: number;
  firstMeeting: Meeting | null; latestMeeting: Meeting | null; history: Meeting[]; cohorts: Cohort[];
};
export type CareerRelationships = {
  careerSaveId: string; opponents: OpponentRelationship[];
  world: { players: WorldIdentity[]; active: number; retired: number; newEntrants: number; youngPlayers: number; youngAgeMaximum: number };
};
