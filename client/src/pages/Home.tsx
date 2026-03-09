import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GameCanvas from "@/components/game/GameCanvas";
import { Joystick, Flame, Star, Smile, Crown, Info, ArrowLeft, Crosshair, Skull, Shield } from "lucide-react";
import { PLAYER_COLORS } from "@shared/game/Constants";
import type { LeaderboardEntry } from "@shared/game/Protocol";

function GrassIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3.5 20.5h17" />
      <path d="M6 20.5c0-3.8.9-6.9 2.7-9.4" />
      <path d="M9.2 20.5c-.1-5 .6-9 2.1-12.5" />
      <path d="M12 20.5V4.5" />
      <path d="M14.8 20.5c.1-4.3 1.1-7.8 2.9-10.8" />
      <path d="M18 20.5c0-2.8.8-5 2.5-6.8" />
      <path d="M8.4 12.2 6.9 10.8" />
      <path d="M15.7 10.8 17.4 9.3" />
    </svg>
  );
}

const HOME_UPDATES = [
  {
    date: "Mar 9, 2026",
    title: "Invincibility Drops",
    description: "Rare shield pickups now grant 8 seconds of invincibility and turn your trail into a rainbow road.",
  },
  {
    date: "Mar 9, 2026",
    title: "Takeover Counter",
    description: "Eliminations now count as takeovers and show up both in your HUD and on the live scoreboard.",
  },
  {
    date: "Mar 9, 2026",
    title: "Mobile HUD Pass",
    description: "Phone UI now has a clearer fireball prompt and a tighter top-corner HUD layout during matches.",
  },
];

export default function Home() {
  const [gameState, setGameState] = useState<"menu" | "playing" | "gameover" | "tutorial" | "updates">("menu");
  const [playerName, setPlayerName] = useState("");
  const [score, setScore] = useState(0);
  const [takeovers, setTakeovers] = useState(0);
  const [invincibleTimeLeft, setInvincibleTimeLeft] = useState(0);
  const [fireballs, setFireballs] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedColor, setSelectedColor] = useState(PLAYER_COLORS[0]);
  const [trailType, setTrailType] = useState<"grass" | "flame" | "star" | "smile">("grass");
  const shootRef = useRef<(() => void) | null>(null);

  const startGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    setGameState("playing");
    setScore(0);
    setTakeovers(0);
    setInvincibleTimeLeft(0);
  };

  const handleGameOver = (finalScore: number, reason?: string) => {
    console.log("Game Over triggered. Reason:", reason);
    setScore(finalScore);
    setGameState("gameover");
  };

  return (
    <div className="w-full h-full overflow-hidden bg-grass-pattern relative flex items-center justify-center font-sans" style={{ height: '100dvh' }}>
      
      {gameState === "playing" && (
        <GameCanvas 
          playerName={playerName} 
          playerColor={selectedColor}
          trailType={trailType}
          onGameOver={handleGameOver}
          onScoreUpdate={setScore}
          onTakeoversUpdate={setTakeovers}
          onInvincibilityUpdate={setInvincibleTimeLeft}
          onLeaderboardUpdate={setLeaderboard}
          onFireballsUpdate={setFireballs}
          shootRef={shootRef}
        />
      )}

      {gameState === "playing" && (
        <div 
          className="absolute top-2 md:top-4 right-2 md:right-4 glass-panel rounded-xl p-2 md:p-4 w-40 md:w-56 shadow-lg z-10 max-h-[20vh] md:max-h-[60vh] flex flex-col pointer-events-auto"
          style={{ touchAction: 'pan-y' }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <h3 className="font-display text-sm md:text-lg text-primary-foreground bg-primary -mt-2 md:-mt-4 -mx-2 md:-mx-4 mb-2 md:mb-3 p-1.5 md:p-2 rounded-t-xl text-center shadow-sm shrink-0">
            Top Mowers
          </h3>
          <div 
            className="overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar touch-pan-y h-full" 
            style={{ overscrollBehavior: 'contain' }}
          >
            <ul className="space-y-1 md:space-y-2 pb-1">
              {leaderboard.map((player, idx) => (
                <li key={player.id} className="flex justify-between items-center gap-2 text-xs md:text-sm font-bold relative">
                  <span className="flex items-center gap-1.5 truncate min-w-0">
                    <span className="w-3 h-3 md:w-4 md:h-4 rounded-full border-2 border-white/50 shadow-sm shrink-0" style={{ backgroundColor: player.color }}></span>
                    <span className="truncate max-w-[68px] md:max-w-[96px]">{player.name}</span>
                    {idx === 0 && <Crown className="w-3 h-3 md:w-4 md:h-4 ml-0.5 text-[#EC098D] fill-[#EC098D] drop-shadow-sm" />}
                    {idx === 1 && <Crown className="w-3 h-3 md:w-4 md:h-4 ml-0.5 text-[#C0C0C0] fill-[#C0C0C0] drop-shadow-sm" />}
                    {idx === 2 && <Crown className="w-3 h-3 md:w-4 md:h-4 ml-0.5 text-[#CD7F32] fill-[#CD7F32] drop-shadow-sm" />}
                  </span>
                  <span className="flex flex-col items-end shrink-0 leading-none">
                    <span className="text-foreground/80 text-xs">{player.score.toFixed(1)}%</span>
                    <span className="flex items-center gap-1 text-[10px] md:text-[11px] text-destructive">
                      <Skull className="w-2.5 h-2.5 md:w-3 md:h-3" />
                      <span>{player.takeovers}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {gameState === "playing" && (
        <div className="absolute top-2 md:top-4 left-2 md:left-4 flex flex-col gap-1.5 md:gap-2 pointer-events-none">
            <div className="glass-panel rounded-full px-3 md:px-6 py-1.5 md:py-2 shadow-lg flex items-center gap-2 md:gap-4">
              <img src="/logo.svg" alt="Logo" className="h-4 md:h-6 opacity-80" />
              <div className="h-3 md:h-4 w-px bg-primary/20"></div>
              <div className="text-lg md:text-2xl font-display text-primary flex items-center gap-1 md:gap-2">
                <span>{score.toFixed(1)}%</span>
                <span className="text-xs md:text-sm font-sans text-muted-foreground uppercase tracking-widest hidden md:inline">Captured</span>
              </div>
            </div>

            <div className="glass-panel rounded-full px-3 md:px-5 py-1.5 md:py-2 shadow-lg flex items-center gap-2 md:gap-3">
              <div className="flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full bg-red-100 shadow-inner">
                <Skull className="w-3.5 h-3.5 md:w-4.5 md:h-4.5 text-red-500" />
              </div>
              <div className="flex items-baseline gap-1.5 md:gap-2">
                <span className="text-lg md:text-2xl font-display text-red-500">{takeovers}</span>
                <span className="text-xs md:text-sm font-sans text-muted-foreground uppercase tracking-widest">Takeovers</span>
              </div>
            </div>

            {invincibleTimeLeft > 0 && (
                <div className="glass-panel rounded-full px-3 md:px-5 py-1.5 md:py-2 shadow-lg flex items-center gap-2 md:gap-3 animate-in slide-in-from-left-4 fade-in">
                    <div className="flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full bg-sky-100 shadow-inner">
                        <Shield className="w-3.5 h-3.5 md:w-4.5 md:h-4.5 text-sky-500" />
                    </div>
                    <div className="flex items-baseline gap-1.5 md:gap-2">
                        <span className="text-lg md:text-2xl font-display text-sky-500">{invincibleTimeLeft.toFixed(1)}s</span>
                        <span className="text-xs md:text-sm font-sans text-muted-foreground uppercase tracking-widest">Invincible</span>
                    </div>
                </div>
            )}
            
            {fireballs > 0 && (
                <div className="glass-panel rounded-full px-3 md:px-6 py-1.5 md:py-2 shadow-lg flex items-center gap-2 md:gap-3 animate-in slide-in-from-left-4 fade-in">
                    <div className="relative flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full bg-orange-100 shadow-inner">
                        <Flame className="w-4 h-4 md:w-5 md:h-5 text-orange-500 animate-pulse" />
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] md:text-[10px] font-bold w-3.5 h-3.5 md:w-4 md:h-4 rounded-full flex items-center justify-center border border-white">
                            {fireballs}
                        </span>
                    </div>
                    <span className="max-w-[110px] text-[10px] font-bold leading-tight text-foreground/80 md:hidden">
                        Tap the orange shoot button to fire
                    </span>
                    <span className="text-xs md:text-sm font-bold text-foreground hidden md:inline">
                        Press <kbd className="bg-white/50 px-1.5 py-0.5 rounded border border-border/50 mx-1 shadow-sm text-xs font-mono">SPACE</kbd> to shoot!
                    </span>
                </div>
            )}
        </div>
      )}

      {gameState === "playing" && fireballs > 0 && (
        <button
          className="absolute bottom-6 right-6 z-20 w-16 h-16 rounded-full bg-orange-500 shadow-lg active:scale-90 transition-transform flex items-center justify-center border-4 border-orange-300 md:hidden pointer-events-auto"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            shootRef.current?.();
          }}
          data-testid="button-shoot-mobile"
        >
          <Flame className="w-8 h-8 text-white" />
        </button>
      )}

      {gameState === "menu" && (
        <div className="z-10 glass-panel p-3 md:p-8 rounded-2xl md:rounded-3xl shadow-2xl max-w-xs md:max-w-md w-full mx-3 border-2 border-white/50 animate-in fade-in zoom-in duration-500 max-h-[92vh] overflow-y-auto custom-scrollbar">
          <div className="text-center mb-2 md:mb-6 animate-float flex flex-col items-center">
            <img src="/logo.svg" alt="Mower Logo" className="h-8 md:h-16 mb-1 md:mb-3 drop-shadow-lg" />
            <p className="text-muted-foreground font-bold italic text-xs md:text-base">Capture the landscape. Claim your territory.</p>
          </div>

          <form onSubmit={startGame} className="space-y-2 md:space-y-4">
            <Input 
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your nickname..."
              className="h-9 md:h-12 text-center text-sm md:text-lg font-bold rounded-lg md:rounded-xl border-2 border-primary/20 focus-visible:ring-primary focus-visible:border-primary shadow-inner bg-white/80"
              maxLength={12}
              autoFocus
              data-testid="input-player-name"
            />
            
            <div className="space-y-1 md:space-y-2">
              <label className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-wider block text-left">Color</label>
              <div className="flex flex-wrap gap-1.5 md:gap-2 justify-center">
                {PLAYER_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-6 h-6 md:w-8 md:h-8 rounded-full transition-transform ${selectedColor === color ? 'scale-125 ring-3 ring-white shadow-lg' : 'hover:scale-110 shadow-sm'}`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1 md:space-y-2">
              <label className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-wider block text-left">Trail</label>
              <div className="grid grid-cols-4 gap-1.5 md:gap-2">
                <button
                  type="button"
                  onClick={() => setTrailType("grass")}
                  className={`flex flex-col items-center gap-0.5 p-1.5 md:p-2 rounded-lg border-2 transition-all ${trailType === 'grass' ? 'border-primary bg-primary/10' : 'border-border/50 bg-white/50 hover:bg-white/80'}`}
                >
                  <GrassIcon className={`w-4 h-4 md:w-5 md:h-5 ${trailType === 'grass' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-bold text-[8px] md:text-[10px]">Clips</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTrailType("flame")}
                  className={`flex flex-col items-center gap-0.5 p-1.5 md:p-2 rounded-lg border-2 transition-all ${trailType === 'flame' ? 'border-orange-500 bg-orange-500/10' : 'border-border/50 bg-white/50 hover:bg-white/80'}`}
                >
                  <Flame className={`w-4 h-4 md:w-5 md:h-5 ${trailType === 'flame' ? 'text-orange-500' : 'text-muted-foreground'}`} />
                  <span className="font-bold text-[8px] md:text-[10px]">Flame</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTrailType("star")}
                  className={`flex flex-col items-center gap-0.5 p-1.5 md:p-2 rounded-lg border-2 transition-all ${trailType === 'star' ? 'border-yellow-400 bg-yellow-400/10' : 'border-border/50 bg-white/50 hover:bg-white/80'}`}
                >
                  <Star className={`w-4 h-4 md:w-5 md:h-5 ${trailType === 'star' ? 'text-yellow-400' : 'text-muted-foreground'}`} />
                  <span className="font-bold text-[8px] md:text-[10px]">Stars</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTrailType("smile")}
                  className={`flex flex-col items-center gap-0.5 p-1.5 md:p-2 rounded-lg border-2 transition-all ${trailType === 'smile' ? 'border-blue-500 bg-blue-500/10' : 'border-border/50 bg-white/50 hover:bg-white/80'}`}
                >
                  <Smile className={`w-4 h-4 md:w-5 md:h-5 ${trailType === 'smile' ? 'text-blue-500' : 'text-muted-foreground'}`} />
                  <span className="font-bold text-[8px] md:text-[10px]">Smiles</span>
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-9 md:h-12 text-base md:text-lg font-display rounded-lg md:rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-primary hover:bg-primary/90"
              disabled={!playerName.trim()}
              data-testid="button-play"
            >
              Start Mowing
            </Button>

            <Button 
              type="button" 
              variant="outline"
              onClick={() => setGameState("tutorial")}
              className="w-full h-7 md:h-10 text-sm md:text-base font-bold rounded-lg md:rounded-xl shadow-sm border-2 border-primary/20 hover:border-primary/50 text-foreground/80 hover:text-foreground flex items-center justify-center gap-1.5 bg-white/50"
              data-testid="button-tutorial"
            >
              <Info className="w-3.5 h-3.5 md:w-4 md:h-4" />
              How to Play
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setGameState("updates")}
              className="w-full h-7 md:h-10 text-sm md:text-base font-bold rounded-lg md:rounded-xl shadow-sm border-2 border-primary/20 hover:border-primary/50 text-foreground/80 hover:text-foreground flex items-center justify-center gap-1.5 bg-white/50"
              data-testid="button-updates"
            >
              <Star className="w-3.5 h-3.5 md:w-4 md:h-4 text-yellow-500" />
              Latest Updates
            </Button>
          </form>

          <div className="mt-2 md:mt-5 flex justify-center gap-3 text-[10px] md:text-xs text-muted-foreground/80 font-bold">
            <div className="flex items-center gap-1">
              <kbd className="bg-white/50 px-1 py-0.5 rounded shadow-sm border border-white text-[10px]">WASD</kbd>
              <span>Desktop</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="bg-white/50 px-1 py-0.5 rounded shadow-sm border border-white text-[10px]">Swipe</kbd>
              <span>Mobile</span>
            </div>
          </div>
        </div>
      )}

      {gameState === "tutorial" && (
        <div className="z-10 glass-panel p-4 md:p-10 rounded-2xl md:rounded-3xl shadow-2xl max-w-sm md:max-w-lg w-full mx-3 md:mx-4 border-2 border-white/50 animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center mb-4 md:mb-6 relative">
            <button 
              onClick={() => setGameState("menu")}
              className="absolute left-0 p-1.5 md:p-2 rounded-full hover:bg-black/5 transition-colors"
              aria-label="Back to menu"
            >
              <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-foreground/70" />
            </button>
            <h2 className="text-2xl md:text-3xl font-display text-primary w-full text-center">How to Play</h2>
          </div>

          <div className="space-y-3 md:space-y-6 text-left">
            <div className="flex gap-3 md:gap-4 items-start bg-white/40 p-3 md:p-4 rounded-xl md:rounded-2xl border border-white">
              <div className="bg-green-100 p-2 md:p-3 rounded-lg md:rounded-xl shrink-0">
                <Joystick className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-base md:text-lg mb-0.5 md:mb-1">Steer Your Mower</h3>
                <p className="text-muted-foreground text-xs md:text-sm">Use <kbd className="bg-white/80 px-1 py-0.5 rounded shadow-sm text-xs mx-0.5">WASD</kbd> or <kbd className="bg-white/80 px-1 py-0.5 rounded shadow-sm text-xs mx-0.5">Arrows</kbd> on desktop. On mobile, just <strong>swipe</strong>.</p>
              </div>
            </div>

            <div className="flex gap-3 md:gap-4 items-start bg-white/40 p-3 md:p-4 rounded-xl md:rounded-2xl border border-white">
              <div className="bg-primary/10 p-2 md:p-3 rounded-lg md:rounded-xl shrink-0">
                <Crosshair className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-base md:text-lg mb-0.5 md:mb-1">Capture Territory</h3>
                <p className="text-muted-foreground text-xs md:text-sm">Leave your base to draw a trail. Connect back to your territory to capture the enclosed area.</p>
              </div>
            </div>

            <div className="flex gap-3 md:gap-4 items-start bg-white/40 p-3 md:p-4 rounded-xl md:rounded-2xl border border-white">
              <div className="bg-orange-100 p-2 md:p-3 rounded-lg md:rounded-xl shrink-0">
                <Flame className="w-5 h-5 md:w-6 md:h-6 text-orange-500" />
              </div>
              <div>
                <h3 className="font-bold text-base md:text-lg mb-0.5 md:mb-1">Shoot Fireballs</h3>
                <p className="text-muted-foreground text-xs md:text-sm">Collect fireballs and press <kbd className="bg-white/80 px-1 py-0.5 rounded shadow-sm text-xs mx-0.5">SPACE</kbd> to shoot! Burns enemy territory or eliminates players.</p>
              </div>
            </div>

            <div className="flex gap-3 md:gap-4 items-start bg-white/40 p-3 md:p-4 rounded-xl md:rounded-2xl border border-white">
              <div className="bg-red-100 p-2 md:p-3 rounded-lg md:rounded-xl shrink-0">
                <Skull className="w-5 h-5 md:w-6 md:h-6 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-base md:text-lg mb-0.5 md:mb-1">Don't Get Wasted</h3>
                <p className="text-muted-foreground text-xs md:text-sm">You die if someone crosses your trail, you hit your own trail, or you get hit by a fireball.</p>
              </div>
            </div>

            <div className="flex gap-3 md:gap-4 items-start bg-white/40 p-3 md:p-4 rounded-xl md:rounded-2xl border border-white">
              <div className="bg-sky-100 p-2 md:p-3 rounded-lg md:rounded-xl shrink-0">
                <Shield className="w-5 h-5 md:w-6 md:h-6 text-sky-500" />
              </div>
              <div>
                <h3 className="font-bold text-base md:text-lg mb-0.5 md:mb-1">Invincibility Drops</h3>
                <p className="text-muted-foreground text-xs md:text-sm">Rare blue shield drops make your mower invincible for <strong>8 seconds</strong>. Watch the countdown in the top-left HUD.</p>
              </div>
            </div>
          </div>

          <Button 
            onClick={() => setGameState("menu")}
            className="w-full h-11 md:h-14 text-lg md:text-xl font-display rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-primary hover:bg-primary/90 mt-4 md:mt-8"
          >
            Got it!
          </Button>
        </div>
      )}

      {gameState === "updates" && (
        <div className="z-10 glass-panel p-4 md:p-10 rounded-2xl md:rounded-3xl shadow-2xl max-w-sm md:max-w-lg w-full mx-3 md:mx-4 border-2 border-white/50 animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center mb-4 md:mb-6 relative">
            <button 
              onClick={() => setGameState("menu")}
              className="absolute left-0 p-1.5 md:p-2 rounded-full hover:bg-black/5 transition-colors"
              aria-label="Back to menu"
            >
              <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-foreground/70" />
            </button>
            <h2 className="text-2xl md:text-3xl font-display text-primary w-full text-center">Latest Updates</h2>
          </div>

          <div className="space-y-3 md:space-y-4 text-left">
            {HOME_UPDATES.map((update) => (
              <div key={update.title} className="rounded-xl md:rounded-2xl border border-white bg-white/45 p-3 md:p-4">
                <div className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-primary/70">
                  {update.date}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Star className="w-4 h-4 md:w-5 md:h-5 text-yellow-500 shrink-0" />
                  <h3 className="font-bold text-base md:text-lg">{update.title}</h3>
                </div>
                <p className="mt-1.5 text-xs md:text-sm text-muted-foreground font-semibold">
                  {update.description}
                </p>
              </div>
            ))}
          </div>

          <Button 
            onClick={() => setGameState("menu")}
            className="w-full h-11 md:h-14 text-lg md:text-xl font-display rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-primary hover:bg-primary/90 mt-4 md:mt-8"
          >
            Back to Menu
          </Button>
        </div>
      )}

      {gameState === "gameover" && (
        <div className="z-10 glass-panel p-5 md:p-12 rounded-2xl md:rounded-3xl shadow-2xl max-w-sm md:max-w-md w-full mx-3 md:mx-4 border-2 border-white/50 animate-in slide-in-from-bottom-8 duration-500 text-center">
          <h2 className="text-3xl md:text-5xl font-display text-destructive mb-1 md:mb-2">Wasted!</h2>
          <p className="text-lg md:text-xl text-foreground font-bold mb-4 md:mb-6">You captured <span className="text-primary text-2xl md:text-3xl font-display ml-1">{score.toFixed(1)}%</span></p>
          <p className="text-sm md:text-lg text-foreground font-bold mb-4 md:mb-6 flex items-center justify-center gap-2">
            <Skull className="w-4 h-4 md:w-5 md:h-5 text-destructive" />
            <span>{takeovers} takeovers</span>
          </p>
          
          <div className="bg-white/50 rounded-xl md:rounded-2xl p-3 md:p-4 mb-4 md:mb-8">
            <h4 className="font-bold text-muted-foreground mb-1 md:mb-2 uppercase text-[10px] md:text-xs tracking-wider">Instructions</h4>
            <p className="text-xs md:text-sm font-semibold text-foreground/80">
              Return to your base to capture enclosed territory. 
              If another player hits your trail before you return, you die!
            </p>
          </div>

          <Button 
            onClick={() => setGameState("menu")}
            className="w-full h-11 md:h-14 text-lg md:text-xl font-display rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-primary hover:bg-primary/90"
            data-testid="button-play-again"
          >
            Play Again
          </Button>
        </div>
      )}
    </div>
  );
}
