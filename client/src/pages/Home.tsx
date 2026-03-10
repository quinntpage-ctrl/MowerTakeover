import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GameCanvas from "@/components/game/GameCanvas";
import MowerCustomizerPreview from "@/components/game/MowerCustomizerPreview";
import { Joystick, Flame, Star, Smile, Crown, Info, ArrowLeft, Skull, Shield, Volume2, VolumeX, Share2, Copy, Download, Zap, Shuffle, Sparkles, Heart, Leaf, Gem, Music2, Snowflake } from "lucide-react";
import { PLAYER_COLORS, TRAIL_TYPES, type TrailType } from "@shared/game/Constants";
import type { LeaderboardEntry } from "@shared/game/Protocol";
import { soundEffects } from "@/lib/audio/sound";
import { createScorecardAsset, createShareText } from "@/lib/share/scorecard";

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

function MoneyIcon({ className }: { className?: string }) {
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
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.7" />
      <path d="M7 9h0.01" />
      <path d="M17 15h0.01" />
      <path d="M11.2 10.6c.2-.4.6-.6 1.1-.6.7 0 1.2.3 1.2.9 0 .5-.3.7-1.1.9-.8.2-1.4.5-1.4 1.2 0 .7.6 1.2 1.5 1.2.6 0 1-.2 1.3-.6" />
    </svg>
  );
}

function BananaIcon({ className }: { className?: string }) {
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
      <path d="M7.8 5.3c.2 2.4 1 4.7 2.4 6.8 1.8 2.7 4.4 4.9 7.3 6.2 1.8.8 3.3 1 4.7.5" />
      <path d="M6.4 7.4c-.6 1.6-.6 3.3 0 4.8.7 1.7 2 3.2 3.9 4.2 2.3 1.4 5 1.8 7.3 1.1 1.5-.4 2.8-1.2 4-2.4" />
      <path d="M7.2 5.1c.8-.3 1.7-.2 2.4.3" />
      <path d="M21 15.1c.2.7.2 1.5-.2 2.1" />
    </svg>
  );
}

function BubbleIcon({ className }: { className?: string }) {
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
      <circle cx="9" cy="13" r="5.5" />
      <circle cx="16.5" cy="8.5" r="2.5" />
      <path d="M7.2 11.3h.01" />
      <path d="M15.7 7.2h.01" />
    </svg>
  );
}

const TRAIL_OPTIONS = [
  { value: "grass", accent: "border-primary bg-primary/10 text-primary" },
  { value: "star", accent: "border-yellow-400 bg-yellow-400/10 text-yellow-500" },
  { value: "smile", accent: "border-blue-500 bg-blue-500/10 text-blue-500" },
  { value: "money", accent: "border-emerald-500 bg-emerald-500/10 text-emerald-600" },
  { value: "bubble", accent: "border-cyan-400 bg-cyan-400/10 text-cyan-500" },
  { value: "confetti", accent: "border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-500" },
  { value: "heart", accent: "border-rose-400 bg-rose-400/10 text-rose-500" },
  { value: "bolt", accent: "border-yellow-300 bg-yellow-300/10 text-yellow-500" },
  { value: "leaf", accent: "border-green-500 bg-green-500/10 text-green-600" },
  { value: "gem", accent: "border-cyan-500 bg-cyan-500/10 text-cyan-600" },
  { value: "music", accent: "border-violet-500 bg-violet-500/10 text-violet-500" },
  { value: "snow", accent: "border-slate-300 bg-slate-200/20 text-slate-500" },
] as const satisfies ReadonlyArray<{ value: TrailType; accent: string }>;

function pickRandomItem<T>(items: readonly T[], exclude?: T) {
  if (items.length === 0) {
    throw new Error("Cannot pick a random item from an empty list");
  }
  if (items.length === 1 || exclude === undefined) {
    return items[Math.floor(Math.random() * items.length)]!;
  }

  const filtered = items.filter((item) => item !== exclude);
  const pool = filtered.length > 0 ? filtered : items;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function TrailChoiceIcon({
  trailType,
  className,
}: {
  trailType: TrailType;
  className?: string;
}) {
  if (trailType === "grass") return <GrassIcon className={className} />;
  if (trailType === "star") return <Star className={className} />;
  if (trailType === "smile") return <Smile className={className} />;
  if (trailType === "money") return <MoneyIcon className={className} />;
  if (trailType === "bubble") return <BubbleIcon className={className} />;
  if (trailType === "confetti") return <Sparkles className={className} />;
  if (trailType === "heart") return <Heart className={className} />;
  if (trailType === "bolt") return <Zap className={className} />;
  if (trailType === "leaf") return <Leaf className={className} />;
  if (trailType === "gem") return <Gem className={className} />;
  if (trailType === "music") return <Music2 className={className} />;
  return <Snowflake className={className} />;
}

function getTrailLabel(trailType: TrailType) {
  switch (trailType) {
    case "grass":
      return "Clips";
    case "star":
      return "Stars";
    case "smile":
      return "Smiles";
    case "money":
      return "Money";
    case "bubble":
      return "Bubbles";
    case "confetti":
      return "Confetti";
    case "heart":
      return "Hearts";
    case "bolt":
      return "Bolts";
    case "leaf":
      return "Leaves";
    case "gem":
      return "Gems";
    case "music":
      return "Music";
    case "snow":
      return "Snow";
  }
}

const HOME_UPDATES = [
  {
    date: "Mar 10, 2026",
    title: "Trail Pack Refresh",
    description: "Flames and bananas are out. Six new trails are in: hearts, bolts, leaves, gems, music notes, and snowflakes.",
  },
  {
    date: "Mar 10, 2026",
    title: "Tutorial Refresh",
    description: "The tutorial now spells out the rules, controls, pickups, and win condition in a clearer step-by-step format.",
  },
  {
    date: "Mar 10, 2026",
    title: "Dynamic Bots",
    description: "Bot count now scales with real players: 3 bots for 1 player, 2 for 2 players, 1 for 3 players, and no bots once 4 real players are in.",
  },
  {
    date: "Mar 10, 2026",
    title: "Randomized Looks",
    description: "Players now start with randomized mower colors and trails by default, and the customizer has a one-tap reroll button with more colors and trail styles.",
  },
  {
    date: "Mar 10, 2026",
    title: "Speed Boost Drops",
    description: "Rare green speed pickups now give your mower a short 4-second burst, with a pickup sound and live countdown in the HUD.",
  },
  {
    date: "Mar 10, 2026",
    title: "Kill + Death Audio",
    description: "You now get a confirmation sound when you eliminate someone and a separate wipeout sound when your mower dies.",
  },
  {
    date: "Mar 10, 2026",
    title: "Scorecard Sharing",
    description: "Match results now have a share button with a downloadable scorecard, native share support, and one-tap links for major social platforms.",
  },
  {
    date: "Mar 9, 2026",
    title: "Head-On Collisions",
    description: "If two mowers smash into each other head-on, they now both get taken out instead of one slipping through.",
  },
  {
    date: "Mar 9, 2026",
    title: "Guided Tutorial",
    description: "The start screen now has a clearer tutorial button and a step-by-step walkthrough for new players.",
  },
  {
    date: "Mar 9, 2026",
    title: "First Place Highlight",
    description: "The current leader now gets a big golden highlight around their mower so first place is obvious in the arena.",
  },
  {
    date: "Mar 9, 2026",
    title: "Mower Customizer",
    description: "Color and trail selection now live in a dedicated customization window with an animated in-game mower and trail preview.",
  },
  {
    date: "Mar 9, 2026",
    title: "Post-Match Recap",
    description: "The game-over screen now preserves your captured percent, shows what took you out, and reports how long you survived.",
  },
  {
    date: "Mar 9, 2026",
    title: "Sound Effects",
    description: "Buttons click, pickups have sounds, fireballs now have shoot and impact audio, and there is a mute toggle with no background music.",
  },
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

function formatDeathReason(reason?: string) {
  switch (reason) {
    case "hit by a fireball!":
      return "a fireball";
    case "head-on-collision":
      return "a head-on collision";
    case "wall-collision":
      return "the wall";
    case "killed-by-other":
      return "another mower crossing your trail";
    case "all-territory-lost":
      return "losing all your land";
    case "self-collision":
      return "your own trail";
    default:
      return "a wipeout";
  }
}

function formatSurvivalTime(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
}

export default function Home() {
  const [gameState, setGameState] = useState<"menu" | "playing" | "gameover" | "tutorial" | "updates" | "customize">("menu");
  const [playerName, setPlayerName] = useState("");
  const [score, setScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [deathReason, setDeathReason] = useState("");
  const [survivedSeconds, setSurvivedSeconds] = useState(0);
  const [takeovers, setTakeovers] = useState(0);
  const [invincibleTimeLeft, setInvincibleTimeLeft] = useState(0);
  const [speedBoostTimeLeft, setSpeedBoostTimeLeft] = useState(0);
  const [fireballs, setFireballs] = useState(0);
  const [soundsMuted, setSoundsMuted] = useState(() => soundEffects.isMuted());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedColor, setSelectedColor] = useState(() => pickRandomItem(PLAYER_COLORS));
  const [trailType, setTrailType] = useState<TrailType>(() => pickRandomItem(TRAIL_TYPES));
  const [lookMode, setLookMode] = useState<"random" | "custom">("random");
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareCardUrl, setShareCardUrl] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [isPreparingShare, setIsPreparingShare] = useState(false);
  const shootRef = useRef<(() => void) | null>(null);
  const previousFireballsRef = useRef(0);
  const previousInvincibleRef = useRef(0);
  const previousSpeedBoostRef = useRef(0);
  const shareCardBlobRef = useRef<Blob | null>(null);

  const randomizeLook = () => {
    const nextColor = pickRandomItem(PLAYER_COLORS, selectedColor);
    const nextTrail = pickRandomItem(TRAIL_TYPES, trailType);
    setSelectedColor(nextColor);
    setTrailType(nextTrail);
    setLookMode("random");
    return { nextColor, nextTrail };
  };

  const startGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    soundEffects.playClick();
    setGameState("playing");
    setScore(0);
    setFinalScore(0);
    setDeathReason("");
    setSurvivedSeconds(0);
    setTakeovers(0);
    setInvincibleTimeLeft(0);
    setSpeedBoostTimeLeft(0);
    setFireballs(0);
  };

  const handleGameOver = (nextFinalScore: number, reason?: string, nextSurvivedSeconds?: number) => {
    console.log("Game Over triggered. Reason:", reason);
    setFinalScore(nextFinalScore);
    setDeathReason(formatDeathReason(reason));
    setSurvivedSeconds(nextSurvivedSeconds ?? 0);
    setGameState("gameover");
  };

  const handleToggleSounds = () => {
    const nextMuted = !soundsMuted;
    soundEffects.setMuted(nextMuted);
    setSoundsMuted(nextMuted);
    if (!nextMuted) {
      soundEffects.playClick();
    }
  };

  const sharePayload = {
    playerName: playerName.trim() || "Anonymous",
    score: finalScore,
    survivedLabel: formatSurvivalTime(survivedSeconds),
    takeovers,
    deathReason: deathReason || "a wipeout",
    color: selectedColor,
    trailType,
    trailLabel: getTrailLabel(trailType),
  } as const;

  const shareUrl = typeof window !== "undefined" ? window.location.origin : "";
  const shareText = createShareText(sharePayload);
  const shareTargets = [
    { label: "X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}` },
    { label: "Reddit", href: `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}` },
  ];

  const prepareShareCard = async () => {
    if (shareCardBlobRef.current && shareCardUrl) {
      return { blob: shareCardBlobRef.current, url: shareCardUrl };
    }

    setIsPreparingShare(true);
    try {
      const nextAsset = await createScorecardAsset(sharePayload);
      if (shareCardUrl) {
        URL.revokeObjectURL(shareCardUrl);
      }
      shareCardBlobRef.current = nextAsset.blob;
      setShareCardUrl(nextAsset.url);
      return nextAsset;
    } finally {
      setIsPreparingShare(false);
    }
  };

  const handleOpenShareSheet = async () => {
    soundEffects.playClick();
    setShareStatus("");
    setShareSheetOpen(true);
    try {
      await prepareShareCard();
    } catch {
      setShareStatus("Could not generate the scorecard image.");
    }
  };

  const handleNativeShare = async () => {
    soundEffects.playClick();
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      setShareStatus("Native share is not available here. Use one of the share buttons below.");
      return;
    }

    try {
      const asset = await prepareShareCard();
      const file = new File([asset.blob], "mower-takeover-scorecard.png", { type: "image/png" });
      const shareData = {
        title: "Mower Takeover Scorecard",
        text: shareText,
        url: shareUrl,
      };

      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ ...shareData, files: [file] });
      } else {
        await navigator.share(shareData);
      }
      setShareStatus("Scorecard shared.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setShareStatus("Share did not go through. Use copy, download, or a social button instead.");
    }
  };

  const handleCopyShareText = async () => {
    soundEffects.playClick();
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setShareStatus("Copy is not available on this device.");
      return;
    }

    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`.trim());
      setShareStatus("Result copied to your clipboard.");
    } catch {
      setShareStatus("Copy failed. Try the download button instead.");
    }
  };

  const handleDownloadScorecard = async () => {
    soundEffects.playClick();
    try {
      const asset = await prepareShareCard();
      const link = document.createElement("a");
      link.href = asset.url;
      link.download = "mower-takeover-scorecard.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setShareStatus("Scorecard downloaded.");
    } catch {
      setShareStatus("Download failed. Try again.");
    }
  };

  useEffect(() => {
    if (gameState !== "playing") {
      previousFireballsRef.current = fireballs;
      return;
    }

    if (fireballs > previousFireballsRef.current) {
      soundEffects.playFireballPickup();
    }
    previousFireballsRef.current = fireballs;
  }, [fireballs, gameState]);

  useEffect(() => {
    if (gameState !== "playing") {
      soundEffects.syncInvincibilityTime(0);
      previousInvincibleRef.current = invincibleTimeLeft;
      return;
    }

    if (invincibleTimeLeft > previousInvincibleRef.current + 1) {
      soundEffects.playInvincibilityPickup();
    }
    soundEffects.syncInvincibilityTime(invincibleTimeLeft);
    previousInvincibleRef.current = invincibleTimeLeft;
  }, [invincibleTimeLeft, gameState]);

  useEffect(() => {
    if (gameState !== "playing") {
      previousSpeedBoostRef.current = speedBoostTimeLeft;
      return;
    }

    if (speedBoostTimeLeft > previousSpeedBoostRef.current + 0.5) {
      soundEffects.playSpeedBoostPickup();
    }
    previousSpeedBoostRef.current = speedBoostTimeLeft;
  }, [speedBoostTimeLeft, gameState]);

  useEffect(() => {
    if (gameState === "gameover") {
      return;
    }

    setShareSheetOpen(false);
    setShareStatus("");
    shareCardBlobRef.current = null;
    if (shareCardUrl) {
      URL.revokeObjectURL(shareCardUrl);
      setShareCardUrl("");
    }
  }, [gameState, shareCardUrl]);

  useEffect(() => {
    return () => {
      if (shareCardUrl) {
        URL.revokeObjectURL(shareCardUrl);
      }
    };
  }, [shareCardUrl]);

  return (
    <div className="w-full h-full overflow-hidden bg-grass-pattern relative flex items-stretch justify-stretch md:items-center md:justify-center font-sans" style={{ height: '100dvh' }}>
      <button
        type="button"
        onClick={handleToggleSounds}
        className="absolute bottom-4 left-4 md:bottom-6 md:left-6 z-30 glass-panel rounded-full p-3 shadow-lg pointer-events-auto transition-transform active:scale-95"
        aria-label={soundsMuted ? "Unmute sounds" : "Mute sounds"}
        data-testid="button-toggle-sound"
      >
        {soundsMuted ? <VolumeX className="w-5 h-5 text-foreground" /> : <Volume2 className="w-5 h-5 text-foreground" />}
      </button>

      {gameState === "playing" && (
        <GameCanvas 
          playerName={playerName} 
          playerColor={selectedColor}
          trailType={trailType}
          fireballCount={fireballs}
          onGameOver={handleGameOver}
          onScoreUpdate={setScore}
          onTakeoversUpdate={setTakeovers}
          onInvincibilityUpdate={setInvincibleTimeLeft}
          onSpeedBoostUpdate={setSpeedBoostTimeLeft}
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

            {speedBoostTimeLeft > 0 && (
                <div className="glass-panel rounded-full px-3 md:px-5 py-1.5 md:py-2 shadow-lg flex items-center gap-2 md:gap-3 animate-in slide-in-from-left-4 fade-in">
                    <div className="flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full bg-lime-100 shadow-inner">
                        <Zap className="w-3.5 h-3.5 md:w-4.5 md:h-4.5 text-lime-600" />
                    </div>
                    <div className="flex items-baseline gap-1.5 md:gap-2">
                        <span className="text-lg md:text-2xl font-display text-lime-600">{speedBoostTimeLeft.toFixed(1)}s</span>
                        <span className="text-xs md:text-sm font-sans text-muted-foreground uppercase tracking-widest">Boost</span>
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
        <div className="z-10 glass-panel w-full h-full overflow-y-auto custom-scrollbar p-3 rounded-none border-0 shadow-none animate-in fade-in zoom-in duration-500 flex flex-col md:p-8 md:rounded-3xl md:shadow-2xl md:max-w-md md:w-full md:h-auto md:mx-3 md:border-2 md:border-white/50 md:max-h-[92vh] md:block">
          <div className="w-full max-w-xs md:max-w-none mx-auto my-auto">
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

            <Button 
              type="submit" 
              className="w-full h-9 md:h-12 text-base md:text-lg font-display rounded-lg md:rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-primary hover:bg-primary/90"
              disabled={!playerName.trim()}
              data-testid="button-play"
            >
              Start Mowing
            </Button>

            <button
              type="button"
              onClick={() => {
                soundEffects.playClick();
                setGameState("customize");
              }}
              className="w-full rounded-xl border-2 border-primary/20 bg-white/60 px-3 py-3 shadow-sm transition-all hover:border-primary/45 hover:bg-white/80"
              data-testid="button-customize"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-left">
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Customize Mower</div>
                  <div className="mt-0.5 text-sm font-bold text-foreground">
                    {lookMode === "random" ? "Randomized by default" : "Preview your selected mower"}
                  </div>
                </div>
                <div className="w-28 md:w-32 overflow-hidden rounded-xl border border-white/70 bg-white/35 shadow-inner shrink-0">
                  <MowerCustomizerPreview color={selectedColor} trailType={trailType} variant="button" />
                </div>
              </div>
            </button>

            <Button 
              type="button" 
              variant="outline"
              onClick={() => {
                soundEffects.playClick();
                setGameState("tutorial");
              }}
              className="w-full h-7 md:h-10 text-sm md:text-base font-bold rounded-lg md:rounded-xl shadow-sm border-2 border-primary/20 hover:border-primary/50 text-foreground/80 hover:text-foreground flex items-center justify-center gap-1.5 bg-white/50"
              data-testid="button-tutorial"
            >
              <Info className="w-3.5 h-3.5 md:w-4 md:h-4" />
              Tutorial
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                soundEffects.playClick();
                setGameState("updates");
              }}
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
        </div>
      )}

      {gameState === "tutorial" && (
        <div className="z-10 glass-panel w-full h-full overflow-y-auto custom-scrollbar p-4 rounded-none border-0 shadow-none animate-in fade-in zoom-in duration-300 md:p-10 md:rounded-3xl md:shadow-2xl md:max-w-lg md:w-full md:h-auto md:mx-4 md:border-2 md:border-white/50 md:max-h-[90vh]">
          <div className="flex items-center mb-4 md:mb-6 relative">
            <button 
              onClick={() => {
                soundEffects.playClick();
                setGameState("menu");
              }}
              className="absolute left-0 p-1.5 md:p-2 rounded-full hover:bg-black/5 transition-colors"
              aria-label="Back to menu"
            >
              <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-foreground/70" />
            </button>
            <h2 className="text-2xl md:text-3xl font-display text-primary w-full text-center">Tutorial</h2>
          </div>

          <div className="space-y-3 md:space-y-5 text-left">
            <div className="rounded-2xl border border-white bg-white/50 p-4 md:p-5">
              <div className="text-[10px] md:text-xs font-bold uppercase tracking-[0.24em] text-primary/70">Quick Goal</div>
              <h3 className="mt-2 text-lg md:text-2xl font-display text-foreground">Make loops. Claim land. Stay alive longer than everyone else.</h3>
              <p className="mt-2 text-xs md:text-sm font-semibold text-muted-foreground">
                The whole game is about leaving your safe grass, drawing a line, and reconnecting it before another mower cuts you off.
              </p>
            </div>

            <div className="rounded-2xl border border-white bg-white/45 p-4 md:p-5">
              <div className="text-[10px] md:text-xs font-bold uppercase tracking-[0.24em] text-primary/70 mb-3">Step By Step</div>
              <div className="space-y-3 md:space-y-4">
                <div className="flex gap-3 items-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-display text-green-700">1</div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm md:text-base">Start inside your own safe territory</h4>
                    <p className="text-xs md:text-sm text-muted-foreground">Use <kbd className="bg-white/80 px-1 py-0.5 rounded shadow-sm text-xs mx-0.5">WASD</kbd> or <kbd className="bg-white/80 px-1 py-0.5 rounded shadow-sm text-xs mx-0.5">Arrows</kbd> on desktop. On mobile, <strong>swipe</strong> to change direction. You are safest while driving inside your own land.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-display text-primary">2</div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm md:text-base">Leave your land to start a vulnerable trail</h4>
                    <p className="text-xs md:text-sm text-muted-foreground">The moment you drive outside your own territory, the line behind your mower becomes exposed. If another mower hits that trail before you reconnect, you die immediately.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-display text-emerald-700">3</div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm md:text-base">Reconnect that trail to capture everything inside the loop</h4>
                    <p className="text-xs md:text-sm text-muted-foreground">Once your trail touches your own territory again, the enclosed area becomes yours. Small loops are safer. Large loops score more, but they give enemies more time to punish you.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-display text-amber-700">4</div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm md:text-base">Use pickups at the right time</h4>
                    <p className="text-xs md:text-sm text-muted-foreground">Fireballs damage enemy land and can kill mowers. Blue shields give you <strong>8 seconds</strong> of invincibility. Yellow lightning bolts give you a short speed burst so you can finish a loop or chase a trail cut.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex gap-3 items-start bg-white/40 p-3 md:p-4 rounded-xl md:rounded-2xl border border-white">
                <div className="bg-red-100 p-2 md:p-3 rounded-lg md:rounded-xl shrink-0">
                  <Skull className="w-5 h-5 md:w-6 md:h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-base md:text-lg mb-0.5 md:mb-1">How You Die</h3>
                  <p className="text-muted-foreground text-xs md:text-sm">You die if an enemy hits your exposed trail, you hit your own exposed trail, you slam into the wall, a fireball takes you out, or you lose a head-on collision outside your protection.</p>
                </div>
              </div>

              <div className="flex gap-3 md:gap-4 items-start bg-white/40 p-3 md:p-4 rounded-xl md:rounded-2xl border border-white">
                <div className="bg-orange-100 p-2 md:p-3 rounded-lg md:rounded-xl shrink-0">
                  <Flame className="w-5 h-5 md:w-6 md:h-6 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-bold text-base md:text-lg mb-0.5 md:mb-1">How You Fight Back</h3>
                  <p className="text-muted-foreground text-xs md:text-sm">Cut enemy trails, force risky turns, and collect fireballs. Shoot with <kbd className="bg-white/80 px-1 py-0.5 rounded shadow-sm text-xs mx-0.5">SPACE</kbd> on desktop or tap the orange button on mobile.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white bg-white/50 p-4 md:p-5">
              <div className="text-[10px] md:text-xs font-bold uppercase tracking-[0.24em] text-primary/70 mb-2">Winning Condition</div>
              <p className="text-xs md:text-sm font-semibold text-muted-foreground mb-4">
                First place is the mower with the most captured land. The scoreboard in the top-right shows who is leading at all times.
              </p>
              <div className="text-[10px] md:text-xs font-bold uppercase tracking-[0.24em] text-primary/70 mb-2">Winning Tip</div>
              <p className="text-xs md:text-sm font-semibold text-muted-foreground">
                Early game: make quick small captures. Mid game: look for exposed enemy trails. Late game: defend your edges and only go wide when you have invincibility or a fireball advantage.
              </p>
            </div>
          </div>

          <Button 
            onClick={() => {
              soundEffects.playClick();
              setGameState("menu");
            }}
            className="w-full h-11 md:h-14 text-lg md:text-xl font-display rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-primary hover:bg-primary/90 mt-4 md:mt-8"
          >
            Got it!
          </Button>
        </div>
      )}

      {gameState === "customize" && (
        <div className="z-10 glass-panel w-full h-full overflow-y-auto custom-scrollbar p-4 rounded-none border-0 shadow-none animate-in fade-in zoom-in duration-300 md:p-10 md:rounded-3xl md:shadow-2xl md:max-w-lg md:w-full md:h-auto md:mx-4 md:border-2 md:border-white/50 md:max-h-[90vh]">
          <div className="flex items-center mb-4 md:mb-6 relative">
            <button
              onClick={() => {
                soundEffects.playClick();
                setGameState("menu");
              }}
              className="absolute left-0 p-1.5 md:p-2 rounded-full hover:bg-black/5 transition-colors"
              aria-label="Back to menu"
            >
              <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-foreground/70" />
            </button>
            <h2 className="text-2xl md:text-3xl font-display text-primary w-full text-center">Customize Mower</h2>
          </div>

          <div className="space-y-4 md:space-y-6">
            <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/25 p-2 shadow-inner">
              <MowerCustomizerPreview color={selectedColor} trailType={trailType} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/55 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-foreground/70">
              <span>Live Preview</span>
              <span className="text-primary">{getTrailLabel(trailType)}</span>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                soundEffects.playClick();
                randomizeLook();
              }}
              className="w-full h-11 rounded-xl border-2 border-primary/20 bg-white/60 font-bold"
            >
              <Shuffle className="mr-2 h-4 w-4" />
              Randomize Look
            </Button>

            <div className="rounded-2xl border border-white bg-white/45 p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-primary/70">Color</div>
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playClick();
                    setSelectedColor(pickRandomItem(PLAYER_COLORS, selectedColor));
                    setLookMode("custom");
                  }}
                  className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-primary/80"
                >
                  Randomize Color
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 md:gap-3 justify-center">
                {PLAYER_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      soundEffects.playClick();
                      setSelectedColor(color);
                      setLookMode("custom");
                    }}
                    className={`h-10 w-10 md:h-12 md:w-12 rounded-full border-4 border-white shadow-lg transition-transform ${selectedColor === color ? "scale-110 ring-4 ring-primary/25" : "hover:scale-105"}`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white bg-white/45 p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-primary/70">Trail</div>
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playClick();
                    setTrailType(pickRandomItem(TRAIL_TYPES, trailType));
                    setLookMode("custom");
                  }}
                  className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-primary/80"
                >
                  Randomize Trail
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
                {TRAIL_OPTIONS.map((option) => {
                  const active = trailType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        soundEffects.playClick();
                        setTrailType(option.value);
                        setLookMode("custom");
                      }}
                      className={`rounded-xl border-2 px-3 py-3 text-center transition-all ${active ? option.accent : "border-border/50 bg-white/60 text-muted-foreground hover:bg-white/85"}`}
                    >
                      <div className="flex justify-center">
                        <TrailChoiceIcon trailType={option.value} className="h-5 w-5 md:h-6 md:w-6" />
                      </div>
                      <div className="mt-2 text-xs md:text-sm font-bold">{getTrailLabel(option.value)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <Button
            onClick={() => {
              soundEffects.playClick();
              setGameState("menu");
            }}
            className="w-full h-11 md:h-14 text-lg md:text-xl font-display rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-primary hover:bg-primary/90 mt-4 md:mt-8"
          >
            Save Look
          </Button>
        </div>
      )}

      {gameState === "updates" && (
        <div className="z-10 glass-panel w-full h-full overflow-y-auto custom-scrollbar p-4 rounded-none border-0 shadow-none animate-in fade-in zoom-in duration-300 md:p-10 md:rounded-3xl md:shadow-2xl md:max-w-lg md:w-full md:h-auto md:mx-4 md:border-2 md:border-white/50 md:max-h-[90vh]">
          <div className="flex items-center mb-4 md:mb-6 relative">
            <button 
              onClick={() => {
                soundEffects.playClick();
                setGameState("menu");
              }}
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
            onClick={() => {
              soundEffects.playClick();
              setGameState("menu");
            }}
            className="w-full h-11 md:h-14 text-lg md:text-xl font-display rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-primary hover:bg-primary/90 mt-4 md:mt-8"
          >
            Back to Menu
          </Button>
        </div>
      )}

      {gameState === "gameover" && (
        <div className="z-10 glass-panel w-full h-full overflow-y-auto p-5 rounded-none border-0 shadow-none animate-in slide-in-from-bottom-8 duration-500 text-center md:p-12 md:rounded-3xl md:shadow-2xl md:max-w-md md:w-full md:h-auto md:mx-4 md:border-2 md:border-white/50">
          <h2 className="text-3xl md:text-5xl font-display text-destructive mb-1 md:mb-2">Wasted!</h2>
          <p className="text-lg md:text-xl text-foreground font-bold mb-2">You captured <span className="text-primary text-2xl md:text-3xl font-display ml-1">{finalScore.toFixed(1)}%</span></p>
          <p className="text-sm md:text-lg text-foreground font-bold mb-1 md:mb-2">You survived <span className="text-primary font-display ml-1">{formatSurvivalTime(survivedSeconds)}</span></p>
          <p className="text-xs md:text-sm uppercase tracking-[0.2em] text-muted-foreground mb-4 md:mb-6">Killed by {deathReason}</p>
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
            type="button"
            variant="outline"
            onClick={handleOpenShareSheet}
            className="w-full h-11 md:h-14 text-base md:text-lg font-display rounded-xl md:rounded-2xl shadow-sm border-2 border-primary/20 hover:border-primary/50 text-foreground bg-white/60 mb-3"
            data-testid="button-share-scorecard"
          >
            <Share2 className="mr-2 h-4 w-4 md:h-5 md:w-5" />
            Share Scorecard
          </Button>

          <Button 
            onClick={() => {
              soundEffects.playClick();
              setGameState("menu");
            }}
            className="w-full h-11 md:h-14 text-lg md:text-xl font-display rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-primary hover:bg-primary/90"
            data-testid="button-play-again"
          >
            Play Again
          </Button>
        </div>
      )}

      {gameState === "gameover" && shareSheetOpen && (
        <div className="absolute inset-0 z-20 bg-black/25 p-4 backdrop-blur-sm flex items-center justify-center">
          <div className="glass-panel w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl border-2 border-white/50 p-5 md:p-8 shadow-2xl">
            <div className="flex items-center mb-5 relative">
              <button
                type="button"
                onClick={() => {
                  soundEffects.playClick();
                  setShareSheetOpen(false);
                  setShareStatus("");
                }}
                className="absolute left-0 p-2 rounded-full hover:bg-black/5 transition-colors"
                aria-label="Close share sheet"
              >
                <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-foreground/70" />
              </button>
              <h2 className="text-2xl md:text-3xl font-display text-primary w-full text-center">Share Scorecard</h2>
            </div>

            <div className="rounded-2xl border border-white bg-white/45 p-3 md:p-4">
              {shareCardUrl ? (
                <img
                  src={shareCardUrl}
                  alt="Scorecard preview"
                  className="w-full rounded-xl border border-white/70 shadow-lg"
                />
              ) : (
                <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-white/70 bg-white/35 text-sm font-semibold text-muted-foreground">
                  {isPreparingShare ? "Building scorecard..." : "Scorecard preview unavailable"}
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                onClick={handleNativeShare}
                className="h-11 rounded-xl bg-primary font-display hover:bg-primary/90"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share Everywhere
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadScorecard}
                className="h-11 rounded-xl border-2 border-primary/20 bg-white/60"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Card
              </Button>
            </div>

            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyShareText}
                className="w-full h-11 rounded-xl border-2 border-primary/20 bg-white/60"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Result Text
              </Button>
            </div>

            <div className="mt-5 rounded-2xl border border-white bg-white/45 p-4">
              <div className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-primary/70">
                Post It
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                {shareTargets.map((target) => (
                  <a
                    key={target.label}
                    href={target.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border-2 border-primary/20 bg-white/60 px-3 py-3 text-center text-sm font-bold text-foreground transition-all hover:border-primary/45 hover:bg-white/85"
                    onClick={() => {
                      soundEffects.playClick();
                    }}
                  >
                    {target.label}
                  </a>
                ))}
              </div>
              <p className="mt-3 text-xs font-semibold text-muted-foreground">
                Native share can send the actual scorecard image on supported phones. Social buttons use your live game link, and you can attach the downloaded card anywhere else.
              </p>
            </div>

            {shareStatus && (
              <p className="mt-4 text-sm font-semibold text-center text-foreground/75">{shareStatus}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
