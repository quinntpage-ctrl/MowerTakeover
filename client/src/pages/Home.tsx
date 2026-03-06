import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GameCanvas from "@/components/game/GameCanvas";
import { Joystick } from "lucide-react";

export default function Home() {
  const [gameState, setGameState] = useState<"menu" | "playing" | "gameover">("menu");
  const [playerName, setPlayerName] = useState("");
  const [score, setScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{name: string, score: number, color: string}[]>([]);

  // Simple state management for the mockup
  const startGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    setGameState("playing");
    setScore(0);
  };

  const handleGameOver = (finalScore: number) => {
    setScore(finalScore);
    setGameState("gameover");
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-grass-pattern relative flex items-center justify-center font-sans">
      
      {/* GAME CANVAS */}
      {gameState === "playing" && (
        <GameCanvas 
          playerName={playerName} 
          onGameOver={handleGameOver}
          onScoreUpdate={setScore}
          onLeaderboardUpdate={setLeaderboard}
        />
      )}

      {/* UI OVERLAY - LEADERBOARD */}
      {gameState === "playing" && (
        <div className="absolute top-4 right-4 glass-panel rounded-xl p-4 w-48 shadow-lg pointer-events-none transition-all">
          <h3 className="font-display text-lg text-primary-foreground bg-primary -mt-4 -mx-4 mb-3 p-2 rounded-t-xl text-center shadow-sm">
            Top Mowers
          </h3>
          <ul className="space-y-2">
            {leaderboard.map((player, idx) => (
              <li key={idx} className="flex justify-between items-center text-sm font-bold">
                <span className="flex items-center gap-2 truncate">
                  <span className="w-4 h-4 rounded-full border-2 border-white/50 shadow-sm" style={{ backgroundColor: player.color }}></span>
                  <span className="truncate max-w-[80px]">{player.name}</span>
                </span>
                <span className="text-foreground/80">{player.score}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* UI OVERLAY - SCORE / MINIMAP */}
      {gameState === "playing" && (
        <div className="absolute top-4 left-4 glass-panel rounded-full px-6 py-2 shadow-lg pointer-events-none">
          <div className="text-2xl font-display text-primary flex items-center gap-2">
            <span>{score.toFixed(1)}%</span>
            <span className="text-sm font-sans text-muted-foreground uppercase tracking-widest">Owned</span>
          </div>
        </div>
      )}

      {/* MOBILE CONTROLS HINT */}
      {gameState === "playing" && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none md:hidden opacity-50">
          <div className="glass-panel rounded-full px-6 py-3 flex items-center gap-3">
            <Joystick className="w-6 h-6" />
            <span className="font-bold">Swipe to steer</span>
          </div>
        </div>
      )}

      {/* MAIN MENU */}
      {gameState === "menu" && (
        <div className="z-10 glass-panel p-8 md:p-12 rounded-3xl shadow-2xl max-w-md w-full mx-4 border-2 border-white/50 animate-in fade-in zoom-in duration-500">
          <div className="text-center mb-8 animate-float">
            <h1 className="text-6xl md:text-7xl font-display text-primary drop-shadow-md tracking-tight mb-2">Mower.io</h1>
            <p className="text-muted-foreground font-bold">Capture the yard. Don't cross your own trail!</p>
          </div>

          <form onSubmit={startGame} className="space-y-4">
            <div>
              <Input 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your nickname..."
                className="h-14 text-center text-xl font-bold rounded-2xl border-2 border-primary/20 focus-visible:ring-primary focus-visible:border-primary shadow-inner bg-white/80"
                maxLength={12}
                autoFocus
                data-testid="input-player-name"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-14 text-xl font-display rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-primary hover:bg-primary/90"
              disabled={!playerName.trim()}
              data-testid="button-play"
            >
              Start Mowing
            </Button>
          </form>

          <div className="mt-8 flex justify-center gap-4 text-sm text-muted-foreground/80 font-bold">
            <div className="flex flex-col items-center">
              <kbd className="bg-white/50 px-2 py-1 rounded shadow-sm border border-white mb-1">WASD / Arrows</kbd>
              <span>Desktop</span>
            </div>
            <div className="flex flex-col items-center">
              <kbd className="bg-white/50 px-2 py-1 rounded shadow-sm border border-white mb-1">Swipe</kbd>
              <span>Mobile</span>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER SCREEN */}
      {gameState === "gameover" && (
        <div className="z-10 glass-panel p-8 md:p-12 rounded-3xl shadow-2xl max-w-md w-full mx-4 border-2 border-white/50 animate-in slide-in-from-bottom-8 duration-500 text-center">
          <h2 className="text-5xl font-display text-destructive mb-2">Wasted!</h2>
          <p className="text-xl text-foreground font-bold mb-6">You captured <span className="text-primary text-3xl font-display ml-1">{score.toFixed(1)}%</span></p>
          
          <div className="bg-white/50 rounded-2xl p-4 mb-8">
            <h4 className="font-bold text-muted-foreground mb-2 uppercase text-xs tracking-wider">Instructions</h4>
            <p className="text-sm font-semibold text-foreground/80">
              Return to your base to capture enclosed territory. 
              If another player hits your trail before you return, you die!
            </p>
          </div>

          <Button 
            onClick={() => setGameState("menu")}
            className="w-full h-14 text-xl font-display rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-primary hover:bg-primary/90"
            data-testid="button-play-again"
          >
            Play Again
          </Button>
        </div>
      )}
    </div>
  );
}
