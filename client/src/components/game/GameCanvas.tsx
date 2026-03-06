import { useEffect, useRef } from 'react';
import { GameEngine } from '@/lib/game/Engine';
import type { ServerMessage, ClientMessage } from '@shared/game/Protocol';
import type { Direction } from '@shared/game/Constants';

interface GameCanvasProps {
  playerName: string;
  playerColor?: string;
  trailType?: "grass" | "flame" | "star" | "smile";
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  onLeaderboardUpdate: (leaderboard: {id: string, name: string, score: number, color: string}[]) => void;
  onFireballsUpdate?: (count: number) => void;
  shootRef?: React.MutableRefObject<(() => void) | null>;
}

export default function GameCanvas({
  playerName,
  playerColor,
  trailType,
  onGameOver,
  onScoreUpdate,
  onLeaderboardUpdate,
  onFireballsUpdate,
  shootRef
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const callbacksRef = useRef({ onGameOver, onScoreUpdate, onLeaderboardUpdate, onFireballsUpdate });

  useEffect(() => {
    callbacksRef.current = { onGameOver, onScoreUpdate, onLeaderboardUpdate, onFireballsUpdate };
  }, [onGameOver, onScoreUpdate, onLeaderboardUpdate, onFireballsUpdate]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(
      canvasRef.current,
      {
        onGameOver: (score) => callbacksRef.current.onGameOver(score),
        onScoreUpdate: (score) => callbacksRef.current.onScoreUpdate(score),
        onLeaderboardUpdate: (board) => callbacksRef.current.onLeaderboardUpdate(board),
        onFireballsUpdate: (count) => callbacksRef.current.onFireballsUpdate?.(count)
      }
    );

    engineRef.current = engine;
    engine.start();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      const joinMsg: ClientMessage = {
        type: 'join',
        name: playerName,
        color: playerColor || '#EC098D',
        trailType: trailType || 'grass'
      };
      ws.send(JSON.stringify(joinMsg));
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);

        switch (msg.type) {
          case 'welcome':
            engine.setLocalPlayerId(msg.playerId);
            engine.applyState(msg.state.players, msg.state.fireballs, msg.state.collectibles);
            engine.applyLeaderboard(msg.state.leaderboard);
            break;

          case 'state':
            engine.applyState(msg.players, msg.fireballs, msg.collectibles);
            break;

          case 'leaderboard':
            engine.applyLeaderboard(msg.board);
            break;

          case 'gameOver':
            callbacksRef.current.onGameOver(msg.score);
            break;

          case 'kill':
            break;
        }
      } catch (e) {
        console.error('Failed to parse server message:', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    const sendDirection = (dir: Direction) => {
      if (ws.readyState === WebSocket.OPEN) {
        const msg: ClientMessage = { type: 'direction', direction: dir };
        ws.send(JSON.stringify(msg));
      }
    };

    const sendShoot = () => {
      if (ws.readyState === WebSocket.OPEN) {
        const msg: ClientMessage = { type: 'shoot' };
        ws.send(JSON.stringify(msg));
      }
    };

    if (shootRef) {
      shootRef.current = sendShoot;
    }

    const handleKey = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'arrowup': case 'w': sendDirection('UP'); break;
        case 'arrowdown': case 's': sendDirection('DOWN'); break;
        case 'arrowleft': case 'a': sendDirection('LEFT'); break;
        case 'arrowright': case 'd': sendDirection('RIGHT'); break;
        case ' ':
        case 'enter':
          sendShoot();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);

    const handleResize = () => {
      if (canvasRef.current) {
        const dpr = window.devicePixelRatio || 1;
        const vv = window.visualViewport;
        const w = vv ? vv.width : window.innerWidth;
        const h = vv ? vv.height : window.innerHeight;

        canvasRef.current.width = w * dpr;
        canvasRef.current.height = h * dpr;

        canvasRef.current.style.width = `${w}px`;
        canvasRef.current.style.height = `${h}px`;

        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        }

        engine.resize(w, h);
      }
    };

    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    handleResize();

    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!touchStartX || !touchStartY) return;

      const touchEndX = e.touches[0].clientX;
      const touchEndY = e.touches[0].clientY;

      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;

      if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) sendDirection('RIGHT');
          else sendDirection('LEFT');
        } else {
          if (dy > 0) sendDirection('DOWN');
          else sendDirection('UP');
        }

        touchStartX = touchEndX;
        touchStartY = touchEndY;
      }
    };

    const canvas = canvasRef.current;
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      engine.stop();
      ws.close();
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, [playerName]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full block cursor-crosshair"
      style={{ touchAction: 'none' }}
      data-testid="game-canvas"
    />
  );
}
