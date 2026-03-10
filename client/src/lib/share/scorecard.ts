import type { TrailType } from "@shared/game/Constants";

export interface ScorecardPayload {
  playerName: string;
  score: number;
  survivedLabel: string;
  takeovers: number;
  deathReason: string;
  color: string;
  trailType: TrailType;
  trailLabel: string;
}

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

function getTrailPalette(trailType: TrailType) {
  switch (trailType) {
    case "grass":
      return { primary: "#2f855a", secondary: "#68d391", accent: "#1f5f3f" };
    case "star":
      return { primary: "#facc15", secondary: "#fde68a", accent: "#ca8a04" };
    case "smile":
      return { primary: "#38bdf8", secondary: "#7dd3fc", accent: "#0ea5e9" };
    case "money":
      return { primary: "#10b981", secondary: "#6ee7b7", accent: "#047857" };
    case "bubble":
      return { primary: "#38bdf8", secondary: "#bae6fd", accent: "#0ea5e9" };
    case "confetti":
      return { primary: "#d946ef", secondary: "#f0abfc", accent: "#a21caf" };
    case "heart":
      return { primary: "#f43f5e", secondary: "#fda4af", accent: "#be123c" };
    case "bolt":
      return { primary: "#facc15", secondary: "#fde68a", accent: "#ca8a04" };
    case "leaf":
      return { primary: "#22c55e", secondary: "#86efac", accent: "#15803d" };
    case "gem":
      return { primary: "#06b6d4", secondary: "#67e8f9", accent: "#0e7490" };
    case "music":
      return { primary: "#8b5cf6", secondary: "#c4b5fd", accent: "#6d28d9" };
    case "snow":
      return { primary: "#e2e8f0", secondary: "#ffffff", accent: "#94a3b8" };
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawMower(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  trailPalette: ReturnType<typeof getTrailPalette>,
) {
  ctx.save();
  ctx.translate(x, y);

  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.strokeStyle = trailPalette.secondary;
  ctx.beginPath();
  ctx.moveTo(-250, 38);
  ctx.bezierCurveTo(-165, 8, -110, 70, -35, 24);
  ctx.bezierCurveTo(10, -5, 55, 48, 120, 10);
  ctx.bezierCurveTo(165, -12, 210, 30, 255, 6);
  ctx.stroke();

  ctx.strokeStyle = `${trailPalette.primary}66`;
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.moveTo(-250, 38);
  ctx.bezierCurveTo(-165, 8, -110, 70, -35, 24);
  ctx.bezierCurveTo(10, -5, 55, 48, 120, 10);
  ctx.bezierCurveTo(165, -12, 210, 30, 255, 6);
  ctx.stroke();

  ctx.fillStyle = "#1f2937";
  ctx.fillRect(-12, -76, 24, 152);

  ctx.fillStyle = color;
  drawRoundedRect(ctx, -72, -44, 144, 88, 28);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.28;
  drawRoundedRect(ctx, -46, -24, 64, 24, 12);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(-62, -52, 22, 0, Math.PI * 2);
  ctx.arc(62, -52, 22, 0, Math.PI * 2);
  ctx.arc(-62, 52, 22, 0, Math.PI * 2);
  ctx.arc(62, 52, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6b7280";
  ctx.beginPath();
  ctx.arc(-62, -52, 10, 0, Math.PI * 2);
  ctx.arc(62, -52, 10, 0, Math.PI * 2);
  ctx.arc(-62, 52, 10, 0, Math.PI * 2);
  ctx.arc(62, 52, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = trailPalette.accent;
  drawRoundedRect(ctx, -48, -18, 96, 36, 18);
  ctx.fill();

  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth) {
      current = trial;
      continue;
    }

    if (current) {
      lines.push(current);
    }
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function getCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create scorecard canvas context");
  }
  return { canvas, ctx };
}

export async function createScorecardAsset(payload: ScorecardPayload) {
  const { canvas, ctx } = getCanvas();
  const background = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  background.addColorStop(0, "#0f2e1f");
  background.addColorStop(1, "#08150f");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= CARD_WIDTH; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CARD_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= CARD_HEIGHT; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_WIDTH, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.94)";
  drawRoundedRect(ctx, 80, 64, 1040, 502, 36);
  ctx.fill();

  ctx.fillStyle = "rgba(15,23,42,0.04)";
  drawRoundedRect(ctx, 104, 88, 992, 454, 28);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.font = "700 28px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("MOWER TAKEOVER SCORECARD", CARD_WIDTH / 2, 144);

  const stats = [
    { label: "Captured", value: `${payload.score.toFixed(1)}%`, color: "#ec4899" },
    { label: "Takeovers", value: `${payload.takeovers}`, color: "#ef4444" },
    { label: "Survived", value: payload.survivedLabel, color: "#16a34a" },
  ] as const;

  const cardWidth = 280;
  const cardHeight = 230;
  const gap = 36;
  const totalWidth = cardWidth * stats.length + gap * (stats.length - 1);
  const startX = (CARD_WIDTH - totalWidth) / 2;
  const topY = 220;

  stats.forEach((stat, index) => {
    const x = startX + index * (cardWidth + gap);
    drawRoundedRect(ctx, x, topY, cardWidth, cardHeight, 26);
    ctx.fillStyle = "rgba(15,23,42,0.06)";
    ctx.fill();

    ctx.fillStyle = stat.color;
    drawRoundedRect(ctx, x + 22, topY + 22, cardWidth - 44, 10, 5);
    ctx.fill();

    ctx.fillStyle = "#64748b";
    ctx.font = "700 22px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(stat.label, x + cardWidth / 2, topY + 80);

    ctx.fillStyle = "#0f172a";
    ctx.font = "700 62px 'Trebuchet MS', sans-serif";
    ctx.fillText(stat.value, x + cardWidth / 2, topY + 156);
  });

  ctx.fillStyle = "#64748b";
  ctx.font = "600 20px 'Trebuchet MS', sans-serif";
  ctx.fillText("Share your result and challenge the next mower.", CARD_WIDTH / 2, 516);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (nextBlob) {
        resolve(nextBlob);
        return;
      }
      reject(new Error("Failed to generate scorecard image"));
    }, "image/png");
  });

  return {
    blob,
    url: URL.createObjectURL(blob),
  };
}

export function createShareText(payload: ScorecardPayload) {
  return `${payload.playerName || "Anonymous"} captured ${payload.score.toFixed(1)}% in Mower Takeover, survived ${payload.survivedLabel}, and racked up ${payload.takeovers} takeovers.`;
}
