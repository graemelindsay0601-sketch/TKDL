import { useState, useRef, useEffect } from 'react';

export default function AutoScorerTestPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [detectedDarts, setDetectedDarts] = useState<any[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const adminUnlocked = sessionStorage.getItem('tkdl_admin_unlocked') === '1';
    if (!adminUnlocked) {
      setError('Admin access required');
    }
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsStreaming(true);
        };
      }
    } catch (err) {
      setError('Camera access denied');
    }
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setLoading(true);
    try {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);

      const imageData = canvasRef.current.toDataURL('image/jpeg');
      
      const response = await fetch('https://tkdl-dart-detection.onrender.com/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      });

      if (response.ok) {
        const result = await response.json();
        setDetectedDarts(result.darts || []);
        const score = result.darts?.reduce((sum: number, d: any) => sum + (d.score || 0), 0) || 0;
        setTotalScore(score);
      } else {
        setError('Detection service error');
      }
    } catch (err) {
      setError('Failed to analyze frame');
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(t => t.stop());
      setIsStreaming(false);
    }
  };

  if (error && error.includes('Admin')) {
    return null;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Auto-Scorer Test</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <video
          ref={videoRef}
          className="w-full rounded"
          style={{ display: isStreaming ? 'block' : 'none' }}
        />
        {!isStreaming && (
          <div className="bg-gray-700 h-96 flex items-center justify-center rounded text-gray-400">
            Camera not started
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="flex gap-4 mb-6">
        {!isStreaming ? (
          <button
            onClick={startCamera}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-semibold"
          >
            Start Camera
          </button>
        ) : (
          <>
            <button
              onClick={captureAndAnalyze}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-semibold disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Capture & Analyze'}
            </button>
            <button
              onClick={stopCamera}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded font-semibold"
            >
              Stop Camera
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-bold mb-2">Total Score</h2>
          <p className="text-4xl font-bold text-blue-600">{totalScore}</p>
        </div>

        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-bold mb-2">Detected Darts</h2>
          <p className="text-2xl font-bold text-green-600">{detectedDarts.length}</p>
        </div>
      </div>

      {detectedDarts.length > 0 && (
        <div className="mt-6 bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-bold mb-4">Dart Details</h2>
          <div className="space-y-2">
            {detectedDarts.map((dart, i) => (
              <div key={i} className="bg-white p-3 rounded border border-gray-300">
                <div className="flex justify-between">
                  <span className="font-semibold">Dart {i + 1}</span>
                  <span className="text-blue-600 font-bold">{dart.score} pts</span>
                </div>
                <div className="text-sm text-gray-600">
                  Position: ({dart.x || 0}, {dart.y || 0})
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}