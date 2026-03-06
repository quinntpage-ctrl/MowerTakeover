import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GameCanvas from "@/components/game/GameCanvas";
import { Joystick, Flame, Scissors, Star, Smile, Crown, Info, ArrowLeft, Crosshair, Skull } from "lucide-react";
import { PLAYER_COLORS } from "@shared/game/Constants";

export default function Home() {
  const [gameState, setGameState] = useState<"menu" | "playing" | "gameover" | "tutorial">("menu");
  const [playerName, setPlayerName] = useState("");
  const [score, setScore] = useState(0);
  const [fireballs, setFireballs] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{id: string, name: string, score: number, color: string}[]>([]);
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
          onFireballsUpdate={setFireballs}
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

      {/* UI OVERLAY - SCORE AND FIREBALLS */}
      {gameState === "playing" && (
        <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
            <div className="glass-panel rounded-full px-6 py-2 shadow-lg flex items-center gap-4">
              <img src="/logo.svg" alt="Logo" className="h-6 opacity-80" />
              <div className="h-4 w-px bg-primary/20"></div>
              <div className="text-2xl font-display text-primary flex items-center gap-2">
                <span>{score.toFixed(1)}%</span>
                <span className="text-sm font-sans text-muted-foreground uppercase tracking-widest hidden md:inline">Captured</span>
              </div>
            </div>
            
            {fireballs > 0 && (
                <div className="glass-panel rounded-full px-6 py-2 shadow-lg flex items-center gap-3 animate-in slide-in-from-left-4 fade-in">
                    <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 shadow-inner">
                        <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                            {fireballs}
                        </span>
                    </div>
                    <span className="text-sm font-bold text-foreground">
                        Press <kbd className="bg-white/50 px-1.5 py-0.5 rounded border border-border/50 mx-1 shadow-sm text-xs font-mono">SPACE</kbd> to shoot!
                    </span>
                </div>
            )}
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
            
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setGameState("tutorial")}
              className="w-full h-12 text-lg font-bold rounded-2xl shadow-sm hover:shadow-md transition-all border-2 border-primary/20 hover:border-primary/50 text-foreground/80 hover:text-foreground mt-2 flex items-center justify-center gap-2 bg-white/50"
              data-testid="button-tutorial"
            >
              <Info className="w-5 h-5" />
              How to Play
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

      {/* TUTORIAL SCREEN */}
      {gameState === "tutorial" && (
        <div className="z-10 glass-panel p-6 md:p-10 rounded-3xl shadow-2xl max-w-lg w-full mx-4 border-2 border-white/50 animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center mb-6 relative">
            <button 
              onClick={() => setGameState("menu")}
              className="absolute left-0 p-2 rounded-full hover:bg-black/5 transition-colors"
              aria-label="Back to menu"
            >
              <ArrowLeft className="w-6 h-6 text-foreground/70" />
            </button>
            <h2 className="text-3xl font-display text-primary w-full text-center">How to Play</h2>
          </div>

          <div className="space-y-6 text-left">
            <div className="flex gap-4 items-start bg-white/40 p-4 rounded-2xl border border-white">
              <div className="bg-green-100 p-3 rounded-xl shrink-0">
                <Joystick className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Steer Your Mower</h3>
                <p className="text-muted-foreground text-sm">Use <kbd className="bg-white/80 px-1.5 py-0.5 rounded shadow-sm text-xs mx-1">WASD</kbd> or <kbd className="bg-white/80 px-1.5 py-0.5 rounded shadow-sm text-xs mx-1">Arrows</kbd> on desktop. On mobile, just <strong>swipe</strong> in the direction you want to go.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start bg-white/40 p-4 rounded-2xl border border-white">
              <div className="bg-primary/10 p-3 rounded-xl shrink-0">
                <Crosshair className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Capture Territory</h3>
                <p className="text-muted-foreground text-sm">Leave your base to draw a trail. Connect your trail back to your own territory to capture the enclosed area. The more you capture, the higher your score!</p>
              </div>
            </div>

            <div className="flex gap-4 items-start bg-white/40 p-4 rounded-2xl border border-white">
              <div className="bg-orange-100 p-3 rounded-xl shrink-0">
                <Flame className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Shoot Fireballs</h3>
                <p className="text-muted-foreground text-sm">Drive over fireballs to collect them. Press <kbd className="bg-white/80 px-1.5 py-0.5 rounded shadow-sm text-xs mx-1">SPACE</kbd> to shoot! Hits will burn away 5x5 chunks of enemy territory or eliminate players.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start bg-white/40 p-4 rounded-2xl border border-white">
              <div className="bg-red-100 p-3 rounded-xl shrink-0">
                <Skull className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Don't Get Wasted</h3>
                <p className="text-muted-foreground text-sm">You die if another player drives into your trail before you return to base, if you hit your own trail, or if you get hit directly by a fireball.</p>
              </div>
            </div>
          </div>

          <Button 
            onClick={() => setGameState("menu")}
            className="w-full h-14 text-xl font-display rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-primary hover:bg-primary/90 mt-8"
          >
            Got it!
          </Button>
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
