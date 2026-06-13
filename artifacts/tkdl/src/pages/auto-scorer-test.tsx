import { useEffect, useState } from 'react';
import { LiveVideoAutoScorer } from '@/components/live-video-auto-scorer';

export default function AutoScorerTestPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const adminUnlocked = sessionStorage.getItem('tkdl_admin_unlocked') === '1';
    setIsAdmin(adminUnlocked);
  }, []);

  if (!isAdmin) {
    return null;
  }

  const [totalScore, setTotalScore] = useState(0);

  return (
    <div className="p-4">
      <h1>Auto-Scorer Test</h1>
      <LiveVideoAutoScorer enabled={true} />
      <p>Total Score: {totalScore}</p>
    </div>
  );
}
