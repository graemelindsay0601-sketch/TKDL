from typing import List, Dict, Any, Tuple

class GameScores:
    @staticmethod
    def extract(msg: Dict[str, Any]) -> List[int]:
        raw = msg.get("gameScores")
        if not isinstance(raw, (list, tuple)):
            return []
        try:
            return [int(v) for v in raw]
        except (TypeError, ValueError):
            return []

    @staticmethod
    def player_score(msg: Dict[str, Any], idx: int) -> int:
        scores = GameScores.extract(msg)
        if idx < 0 or idx >= min(len(scores), 6):
            return 0
        return scores[idx]

    @staticmethod
    def all_players(msg: Dict[str, Any]) -> Tuple[int, int, int, int, int, int]:
        scores = GameScores.extract(msg)
        padded = (scores + [0] * 6)[:6]
        return tuple(padded)