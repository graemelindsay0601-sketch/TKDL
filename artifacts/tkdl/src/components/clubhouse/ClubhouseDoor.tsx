import { Link } from "wouter";
import { DoorOpen, ChevronRight } from "lucide-react";
import { useFeature } from "@/lib/useFeature";

/** Profile entry to a player's Clubhouse (only while the feature is on for this session). */
export function ClubhouseDoor({ playerId }: { playerId: number }) {
  const on = useFeature("clubhouse");
  if (!on) return null;
  return (
    <Link href={`/clubhouse/${playerId}`} className="ch-door">
      <span className="ch-door-ic"><DoorOpen className="w-5 h-5" /></span>
      <span className="ch-door-txt"><small>The Clubhouse</small><b>Step into the room</b></span>
      <ChevronRight className="w-5 h-5" style={{ color: "#ffd24a" }} />
    </Link>
  );
}
