import { useEffect, useState } from 'react';
import { LiveVideoAutoScorer } from '@/components/live-video-auto-scorer';

export default function AutoScorerTestPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const adminUnlocked = sessionStorage.getItem('tkdl_admin_unlocked') === '1';
    setIsAdmin(adminUnlocked);
  }, []);

  if (!isAdmin) {
    window.location.href = '/admin';
    return null;
  }

  const [totalScore, setTotalScore] = useState(0);
  const [darts, setDarts] = useState([]);

  const handleDartsDetected = (detectedDarts) => {
    setDarts(prev => [...prev, ...detectedDarts]);
    const newScore = detectedDarts.reduce((sum, dart) => sum + dart.score, 0);
    setTotalScore(prev => prev + newScore);
  };

  const handleUndo = () => {
    if (darts.length > 0) {
      const lastDart = darts[darts.length - 1];
      setTotalScore(prev => prev - lastDart.score);
      setDarts(prev => prev.slice(0, -1));
    }
  };

  const handleReset = () => {
    setTotalScore(0);
    setDarts([]);
  };

  return (
    <div className="w-full h-screen flex gap-4 p-4 bg-slate-900">
      <div className="flex-1">
        <h1 className="text-white text-2xl mb-4">Auto-Scorer Test</h1>
        <LiveVideoAutoScorer onDartsDetected={handleDartsDetected} enabled={true} />
      </div>
      
      <div className="w-80 bg-slate-800 p-4 rounded-lg text-white">
        <h2 className="text-xl font-bold mb-4">Score Tracker</h2>
        <div className="text-3xl font-bold mb-6">Total: {totalScore}</div>
        
        <div className="mb-6">
          <h3 className="font-bold mb-2">Detected Darts:</h3>
          <div className="space-y-1 text-sm max-h-64 overflow-y-auto">
            {darts.map((dart, idx) => (
              <div key={idx} className="bg-slate-700 p-2 rounded">
                Dart {idx + 1}: {dart.score} pts
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleUndo} className="flex-1 bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded">
            ↶ Undo
          </button>
          <button onClick={handleReset} className="flex-1 bg-red-600 hover:bg-red-700 px-4 py-2 rounded">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}