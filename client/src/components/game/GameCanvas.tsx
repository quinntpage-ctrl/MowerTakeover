import { useEffect, useRef } from 'react';
import { GameEngine } from '@/lib/game/Engine';

interface GameCanvasProps {
  playerName: string;
  playerColor?: string;
  trailType?: "grass" | "flame" | "star" | "smile";
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  onLeaderboardUpdate: (leaderboard: {id: string, name: string, score: number, color: string}[]) => void;
  onFireballsUpdate?: (count: number) => void;
}

export default function GameCanvas({ 
  playerName, 
  playerColor,
  trailType,
  onGameOver, 
  onScoreUpdate, 
  onLeaderboardUpdate,
  onFireballsUpdate
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const callbacksRef = useRef({ onGameOver, onScoreUpdate, onLeaderboardUpdate, onFireballsUpdate });

  // Keep callbacks up to date without triggering engine recreation
  useEffect(() => {
    callbacksRef.current = { onGameOver, onScoreUpdate, onLeaderboardUpdate, onFireballsUpdate };
  }, [onGameOver, onScoreUpdate, onLeaderboardUpdate, onFireballsUpdate]);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize the game engine
    const engine = new GameEngine(
      canvasRef.current, 
      playerName,
      playerColor,
      trailType,
      {
        onGameOver: (score) => callbacksRef.current.onGameOver(score),
        onScoreUpdate: (score) => callbacksRef.current.onScoreUpdate(score),
        onLeaderboardUpdate: (board) => callbacksRef.current.onLeaderboardUpdate(board),
        onFireballsUpdate: (count) => callbacksRef.current.onFireballsUpdate?.(count)
      }
    );
    
    engineRef.current = engine;
    engine.start();

    // Handle resize
    const handleResize = () => {
      if (canvasRef.current) {
        // Handle high DPI displays
        const dpr = window.devicePixelRatio || 1;
        const rect = canvasRef.current.parentElement?.getBoundingClientRect() || { width: window.innerWidth, height: window.innerHeight };
        
        canvasRef.current.width = rect.width * dpr;
        canvasRef.current.height = rect.height * dpr;
        
        // CSS display size
        canvasRef.current.style.width = `${rect.width}px`;
        canvasRef.current.style.height = `${rect.height}px`;
        
        // Normalize coordinate system to use css pixels
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        }
        
        engine.resize(rect.width, rect.height);
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