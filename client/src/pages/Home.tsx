import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GameCanvas from "@/components/game/GameCanvas";
import { Joystick, Flame, Scissors, Star, Smile, Crown } from "lucide-react";
import { PLAYER_COLORS } from "@/lib/game/Constants";

export default function Home() {
  const [gameState, setGameState] = useState<"menu" | "playing" | "gameover">("menu");
  const [playerName, setPlayerName] = useState("");
  const [score, setScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{name: string, score: number, color: string}[]>([]);
  const [selectedColor, setSelectedColor] = useState(PLAYER_COLORS[0]);
  const [trailType, setTrailType] = useState<"grass" | "flame" | "star" | "smile">("grass");

  // Simple state management for the mockup
  const startGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    setGameState("playing");
    setScore(0);
  };

  const handleGameOver = (finalScore: number, reason?: string) => {
    console.log("Game Over triggered. Reason:", reason);
    setScore(finalScore);
    setGameState("gameover");
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-grass-pattern relative flex items-center justify-center font-sans">
      
      {/* GAME CANVAS */}
      {gameState === "playing" && (
        <GameCanvas 
          playerName={playerName} 
          playerColor={selectedColor}
          trailType={trailType}
          onGameOver={handleGameOver}
          onScoreUpdate={setScore}
          onLeaderboardUpdate={setLeaderboard}
        />
      )}

      {/* UI OVERLAY - LEADERBOARD */}
      {gameState === "playing" && (
        <div 
          className="absolute top-20 md:top-4 right-4 glass-panel rounded-xl p-4 w-40 md:w-48 shadow-lg z-10 max-h-[25vh] md:max-h-[60vh] flex flex-col pointer-events-auto"
          style={{ touchAction: 'pan-y' }}
          onPointerDown={(e) => e.stopPropagation()} // Stop game canvas from stealing touch events
        >
          <h3 className="font-display text-base md:text-lg text-primary-foreground bg-primary -mt-4 -mx-4 mb-3 p-2 rounded-t-xl text-center shadow-sm shrink-0">
            Top Mowers
          </h3>
          <div 
            className="overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar touch-pan-y h-full" 
            style={{ overscrollBehavior: 'contain' }}
          >
            <ul className="space-y-2 pb-2">
              {leaderboard.map((player, idx) => (
                <li key={idx} className="flex justify-between items-center text-sm font-bold relative">
                  <span className="flex items-center gap-2 truncate">
                    <span className="w-4 h-4 rounded-full border-2 border-white/50 shadow-sm shrink-0" style={{ backgroundColor: player.color }}></span>
                    <span className="truncate max-w-[80px]">{player.name}</span>
                    {idx === 0 && <Crown className="w-4 h-4 ml-1 text-[#EC098D] fill-[#EC098D] drop-shadow-sm" />}
                    {idx === 1 && <Crown className="w-4 h-4 ml-1 text-[#C0C0C0] fill-[#C0C0C0] drop-shadow-sm" />}
                    {idx === 2 && <Crown className="w-4 h-4 ml-1 text-[#CD7F32] fill-[#CD7F32] drop-shadow-sm" />}
                  </span>
                  <span className="text-foreground/80 shrink-0">{player.score.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* UI OVERLAY - SCORE */}
      {gameState === "playing" && (
        <div className="absolute top-4 left-4 glass-panel rounded-full px-6 py-2 shadow-lg pointer-events-none flex items-center gap-4">
          <img src="/logo.svg" alt="Logo" className="h-6 opacity-80" />
          <div className="h-4 w-px bg-primary/20"></div>
          <div className="text-2xl font-display text-primary flex items-center gap-2">
            <span>{score.toFixed(1)}%</span>
            <span className="text-sm font-sans text-muted-foreground uppercase tracking-widest">Captured</span>
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
          <div className="text-center mb-8 animate-float flex flex-col items-center">
            <img src="/logo.svg" alt="Mower Logo" className="h-20 mb-4 drop-shadow-lg" />
            <p className="text-muted-foreground font-bold italic">Capture the landscape. Claim your territory.</p>
          </div>

          <form onSubmit={startGame} className="space-y-6">
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
            
            <div className="space-y-3">
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider block text-left">Choose Color</label>
              <div className="flex flex-wrap gap-3 justify-center">
                {PLAYER_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-10 h-10 rounded-full transition-transform ${selectedColor === color ? 'scale-125 ring-4 ring-white shadow-lg' : 'hover:scale-110 shadow-md'}`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider block text-left">Trail Effect</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTrailType("grass")}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${trailType === 'grass' ? 'border-primary bg-primary/10' : 'border-border/50 bg-white/50 hover:bg-white/80'}`}
                >
                  <Scissors className={`w-6 h-6 ${trailType === 'grass' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-bold text-xs">Clippings</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTrailType("flame")}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${trailType === 'flame' ? 'border-orange-500 bg-orange-500/10' : 'border-border/50 bg-white/50 hover:bg-white/80'}`}
                >
                  <Flame className={`w-6 h-6 ${trailType === 'flame' ? 'text-orange-500' : 'text-muted-foreground'}`} />
                  <span className="font-bold text-xs">Flame</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTrailType("star")}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${trailType === 'star' ? 'border-yellow-400 bg-yellow-400/10' : 'border-border/50 bg-white/50 hover:bg-white/80'}`}
                >
                  <Star className={`w-6 h-6 ${trailType === 'star' ? 'text-yellow-400' : 'text-muted-foreground'}`} />
                  <span className="font-bold text-xs">Stars</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTrailType("smile")}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${trailType === 'smile' ? 'border-blue-500 bg-blue-500/10' : 'border-border/50 bg-white/50 hover:bg-white/80'}`}
                >
                  <Smile className={`w-6 h-6 ${trailType === 'smile' ? 'text-blue-500' : 'text-muted-foreground'}`} />
                  <span className="font-bold text-xs">Smiles</span>
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 text-xl font-display rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-primary hover:bg-primary/90 mt-4"
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
