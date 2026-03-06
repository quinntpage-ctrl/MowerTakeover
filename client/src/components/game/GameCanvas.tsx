import { useEffect, useRef } from 'react';
import { GameEngine } from '@/lib/game/Engine';

interface GameCanvasProps {
  playerName: string;
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  onLeaderboardUpdate: (leaderboard: {name: string, score: number, color: string}[]) => void;
}

export default function GameCanvas({ 
  playerName, 
  onGameOver, 
  onScoreUpdate, 
  onLeaderboardUpdate 
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const callbacksRef = useRef({ onGameOver, onScoreUpdate, onLeaderboardUpdate });

  // Keep callbacks up to date without triggering engine recreation
  useEffect(() => {
    callbacksRef.current = { onGameOver, onScoreUpdate, onLeaderboardUpdate };
  }, [onGameOver, onScoreUpdate, onLeaderboardUpdate]);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize the game engine
    const engine = new GameEngine(
      canvasRef.current, 
      playerName,
      {
        onGameOver: (score) => callbacksRef.current.onGameOver(score),
        onScoreUpdate: (score) => callbacksRef.current.onScoreUpdate(score),
        onLeaderboardUpdate: (board) => callbacksRef.current.onLeaderboardUpdate(board)
      }
    );
    
    engineRef.current = engine;
    engine.start();

    // Handle resize
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        engine.resize(window.innerWidth, window.innerHeight);
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial size set

    // Touch controls setup
    let touchStartX = 0;
    let touchStartY = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // Prevent scrolling
      if (!touchStartX || !touchStartY) return;
      
      const touchEndX = e.touches[0].clientX;
      const touchEndY = e.touches[0].clientY;
      
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;
      
      // Minimum swipe distance
      if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal swipe
          if (dx > 0) engine.setPlayerDirection('RIGHT');
          else engine.setPlayerDirection('LEFT');
        } else {
          // Vertical swipe
          if (dy > 0) engine.setPlayerDirection('DOWN');
          else engine.setPlayerDirection('UP');
        }
        
        // Reset to prevent continuous triggering
        touchStartX = touchEndX;
        touchStartY = touchEndY;
      }
    };

    const canvas = canvasRef.current;
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      engine.stop();
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, [playerName]); // Only recreate engine if playerName changes

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full block cursor-crosshair"
      style={{ touchAction: 'none' }}
      data-testid="game-canvas"
    />
  );
}