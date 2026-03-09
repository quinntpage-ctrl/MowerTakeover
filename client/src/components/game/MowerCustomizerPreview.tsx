import { useEffect, useRef } from "react";
import { CELL_SIZE, type TrailType } from "@shared/game/Constants";

interface MowerCustomizerPreviewProps {
  color: string;
  trailType: TrailType;
  className?: string;
}

interface PreviewPoint {
  x: number;
  y: number;
}

interface PreviewParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  rotation: number;
  vRot: number;
  type?: "star" | "smile" | "money" | "banana";
}

type PreviewDirection = "UP" | "DOWN" | "LEFT" | "RIGHT";

const PREVIEW_WIDTH = 420;
const PREVIEW_HEIGHT = 220;
const TRAIL_HISTORY_LIMIT = 90;
const ROUTE: PreviewPoint[] = [
  { x: 88, y: 86 },
  { x: 320, y: 86 },
  { x: 320, y: 146 },
  { x: 150, y: 146 },
  { x: 150, y: 112 },
  { x: 256, y: 112 },
];

function drawMower(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-14, -12, 28, 24, 4);
  ctx.fill();

  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#444";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-10, 12);
  ctx.lineTo(-10, 20);
  ctx.lineTo(10, 20);
  ctx.lineTo(10, 12);
  ctx.stroke();

  ctx.fillStyle = "#111";
  ctx.fillRect(-16, -10, 4, 8);
  ctx.fillRect(12, -10, 4, 8);
  ctx.fillRect(-16, 2, 4, 8);
  ctx.fillRect(12, 2, 4, 8);

  ctx.restore();
}

function drawTrailLine(ctx: CanvasRenderingContext2D, trail: PreviewPoint[], color: string) {
  if (trail.length < 2) return;

  ctx.save();
  ctx.strokeStyle = `${color}AA`;
  ctx.lineWidth = CELL_SIZE * 0.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(trail[0].x, trail[0].y);
  for (let i = 1; i < trail.length; i++) {
    ctx.lineTo(trail[i].x, trail[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, outerRadius: number, innerRadius: number, fill: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerAngle = (-90 + i * 72) * (Math.PI / 180);
    const innerAngle = (-54 + i * 72) * (Math.PI / 180);
    ctx.lineTo(Math.cos(outerAngle) * outerRadius, Math.sin(outerAngle) * outerRadius);
    ctx.lineTo(Math.cos(innerAngle) * innerRadius, Math.sin(innerAngle) * innerRadius);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBackdrop(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
  gradient.addColorStop(0, "#fef3c7");
  gradient.addColorStop(0.45, "#dcfce7");
  gradient.addColorStop(1, "#bbf7d0");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= PREVIEW_WIDTH; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, PREVIEW_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= PREVIEW_HEIGHT; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(PREVIEW_WIDTH, y);
    ctx.stroke();
  }
}

function sampleRoute(distance: number) {
  let remaining = distance;
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const start = ROUTE[i];
    const end = ROUTE[i + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);

    if (remaining <= length) {
      const progress = length === 0 ? 0 : remaining / length;
      return {
        x: start.x + dx * progress,
        y: start.y + dy * progress,
        angle: Math.atan2(dy, dx),
      };
    }

    remaining -= length;
  }

  const last = ROUTE[ROUTE.length - 1];
  const prev = ROUTE[ROUTE.length - 2];
  return {
    x: last.x,
    y: last.y,
    angle: Math.atan2(last.y - prev.y, last.x - prev.x),
  };
}

function getRouteLength() {
  let total = 0;
  for (let i = 0; i < ROUTE.length - 1; i++) {
    total += Math.hypot(ROUTE[i + 1].x - ROUTE[i].x, ROUTE[i + 1].y - ROUTE[i].y);
  }
  return total;
}

function getPreviewDirection(angle: number): PreviewDirection {
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (normalized >= Math.PI * 0.25 && normalized < Math.PI * 0.75) return "DOWN";
  if (normalized >= Math.PI * 0.75 && normalized < Math.PI * 1.25) return "LEFT";
  if (normalized >= Math.PI * 1.25 && normalized < Math.PI * 1.75) return "UP";
  return "RIGHT";
}

function spawnTrailParticle(
  particles: PreviewParticle[],
  x: number,
  y: number,
  trailType: TrailType,
  direction: PreviewDirection,
) {
  if (Math.random() > 0.4) return;

  let vx = 0;
  let vy = 0;
  let px = x;
  let py = y;

  if (trailType === "flame") {
    if (direction === "UP") { vx = (Math.random() - 0.5) * 20; vy = 40 + Math.random() * 40; py += 10; }
    else if (direction === "DOWN") { vx = (Math.random() - 0.5) * 20; vy = -40 - Math.random() * 40; py -= 10; }
    else if (direction === "LEFT") { vx = 40 + Math.random() * 40; vy = (Math.random() - 0.5) * 20; px += 10; }
    else { vx = -40 - Math.random() * 40; vy = (Math.random() - 0.5) * 20; px -= 10; }
    const colors = ["#f97316", "#ef4444", "#eab308"];
    particles.push({
      x: px + (Math.random() - 0.5) * 15,
      y: py + (Math.random() - 0.5) * 15,
      vx,
      vy,
      life: Math.random() * 0.4 + 0.3,
      maxLife: 0.7,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 6 + 4,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 5,
    });
    return;
  }

  if (trailType === "star") {
    if (direction === "UP") { vx = (Math.random() - 0.5) * 30; vy = 30 + Math.random() * 20; py += 15; }
    else if (direction === "DOWN") { vx = (Math.random() - 0.5) * 30; vy = -30 - Math.random() * 20; py -= 15; }
    else if (direction === "LEFT") { vx = 30 + Math.random() * 20; vy = (Math.random() - 0.5) * 30; px += 15; }
    else { vx = -30 - Math.random() * 20; vy = (Math.random() - 0.5) * 30; px -= 15; }
    particles.push({
      x: px + (Math.random() - 0.5) * 10,
      y: py + (Math.random() - 0.5) * 10,
      vx,
      vy,
      life: Math.random() * 0.5 + 0.5,
      maxLife: 1.0,
      color: "#fef08a",
      size: Math.random() * 4 + 4,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 2,
      type: "star",
    });
    return;
  }

  if (trailType === "smile") {
    if (direction === "UP") { vx = (Math.random() - 0.5) * 10; vy = 10 + Math.random() * 10; py += 15; }
    else if (direction === "DOWN") { vx = (Math.random() - 0.5) * 10; vy = -10 - Math.random() * 10; py -= 15; }
    else if (direction === "LEFT") { vx = 10 + Math.random() * 10; vy = (Math.random() - 0.5) * 10; px += 15; }
    else { vx = -10 - Math.random() * 10; vy = (Math.random() - 0.5) * 10; px -= 15; }
    particles.push({
      x: px + (Math.random() - 0.5) * 5,
      y: py + (Math.random() - 0.5) * 5,
      vx,
      vy,
      life: Math.random() * 0.8 + 0.4,
      maxLife: 1.2,
      color: "#fbbf24",
      size: Math.random() * 6 + 8,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 1,
      type: "smile",
    });
    return;
  }

  if (trailType === "money") {
    if (direction === "UP") { vx = (Math.random() - 0.5) * 24; vy = 18 + Math.random() * 16; py += 12; }
    else if (direction === "DOWN") { vx = (Math.random() - 0.5) * 24; vy = -18 - Math.random() * 16; py -= 12; }
    else if (direction === "LEFT") { vx = 18 + Math.random() * 16; vy = (Math.random() - 0.5) * 24; px += 12; }
    else { vx = -18 - Math.random() * 16; vy = (Math.random() - 0.5) * 24; px -= 12; }
    particles.push({
      x: px + (Math.random() - 0.5) * 10,
      y: py + (Math.random() - 0.5) * 10,
      vx,
      vy,
      life: Math.random() * 0.7 + 0.45,
      maxLife: 1.15,
      color: ["#22c55e", "#4ade80", "#86efac"][Math.floor(Math.random() * 3)],
      size: Math.random() * 4 + 7,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 3,
      type: "money",
    });
    return;
  }

  if (trailType === "banana") {
    if (direction === "UP") { vx = (Math.random() - 0.5) * 18; vy = 14 + Math.random() * 14; py += 12; }
    else if (direction === "DOWN") { vx = (Math.random() - 0.5) * 18; vy = -14 - Math.random() * 14; py -= 12; }
    else if (direction === "LEFT") { vx = 14 + Math.random() * 14; vy = (Math.random() - 0.5) * 18; px += 12; }
    else { vx = -14 - Math.random() * 14; vy = (Math.random() - 0.5) * 18; px -= 12; }
    particles.push({
      x: px + (Math.random() - 0.5) * 8,
      y: py + (Math.random() - 0.5) * 8,
      vx,
      vy,
      life: Math.random() * 0.55 + 0.45,
      maxLife: 1.0,
      color: "#facc15",
      size: Math.random() * 3 + 7,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 2,
      type: "banana",
    });
    return;
  }

  if (direction === "UP") { vx = 80 + Math.random() * 40; vy = (Math.random() - 0.5) * 40; px += 10; }
  else if (direction === "DOWN") { vx = -80 - Math.random() * 40; vy = (Math.random() - 0.5) * 40; px -= 10; }
  else if (direction === "LEFT") { vx = (Math.random() - 0.5) * 40; vy = -80 - Math.random() * 40; py -= 10; }
  else { vx = (Math.random() - 0.5) * 40; vy = 80 + Math.random() * 40; py += 10; }
  particles.push({
    x: px + (Math.random() - 0.5) * 10,
    y: py + (Math.random() - 0.5) * 10,
    vx,
    vy,
    life: Math.random() * 0.3 + 0.2,
    maxLife: 0.5,
    color: "#4ade80",
    size: Math.random() * 3 + 2,
    rotation: Math.random() * Math.PI * 2,
    vRot: (Math.random() - 0.5) * 15,
  });
}

function drawParticle(ctx: CanvasRenderingContext2D, particle: PreviewParticle) {
  ctx.save();
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.rotation);
  ctx.globalAlpha = particle.life / particle.maxLife;

  if (particle.type === "star") {
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * particle.size,
                 -Math.sin((18 + i * 72) * Math.PI / 180) * particle.size);
      ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * (particle.size * 0.5),
                 -Math.sin((54 + i * 72) * Math.PI / 180) * (particle.size * 0.5));
    }
    ctx.closePath();
    ctx.fill();
  } else if (particle.type === "smile") {
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(-particle.size * 0.3, -particle.size * 0.2, particle.size * 0.15, 0, Math.PI * 2);
    ctx.arc(particle.size * 0.3, -particle.size * 0.2, particle.size * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#000";
    ctx.lineWidth = particle.size * 0.1;
    ctx.beginPath();
    ctx.arc(0, particle.size * 0.1, particle.size * 0.5, 0.1, Math.PI - 0.1);
    ctx.stroke();
  } else if (particle.type === "money") {
    ctx.fillStyle = particle.color;
    ctx.strokeStyle = "#166534";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-particle.size * 0.75, -particle.size * 0.45, particle.size * 1.5, particle.size * 0.9, 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#14532d";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size * 0.22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -particle.size * 0.18);
    ctx.lineTo(0, particle.size * 0.18);
    ctx.stroke();
  } else if (particle.type === "banana") {
    ctx.strokeStyle = particle.color;
    ctx.lineWidth = Math.max(2, particle.size * 0.32);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, particle.size * 0.55, 0.3, 2.45);
    ctx.stroke();

    ctx.strokeStyle = "#a16207";
    ctx.lineWidth = Math.max(1, particle.size * 0.1);
    ctx.beginPath();
    ctx.moveTo(-particle.size * 0.45, particle.size * 0.08);
    ctx.lineTo(-particle.size * 0.62, particle.size * 0.18);
    ctx.moveTo(particle.size * 0.35, particle.size * 0.34);
    ctx.lineTo(particle.size * 0.5, particle.size * 0.48);
    ctx.stroke();
  } else {
    ctx.fillStyle = particle.color;
    ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
  }

  ctx.restore();
}

export default function MowerCustomizerPreview({
  color,
  trailType,
  className,
}: MowerCustomizerPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trailHistoryRef = useRef<PreviewPoint[]>([]);
  const particlesRef = useRef<PreviewParticle[]>([]);
  const routeLengthRef = useRef(getRouteLength());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = PREVIEW_WIDTH * dpr;
    canvas.height = PREVIEW_HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let frameId = 0;
    let startTime = performance.now();
    let previousFrameTime = startTime;
    let particleTickAccumulator = 0;

    trailHistoryRef.current = [];
    particlesRef.current = [];

    const drawFrame = (timestamp: number) => {
      const dt = Math.min((timestamp - previousFrameTime) / 1000, 0.1);
      previousFrameTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const speed = 115;
      const distance = (elapsed * speed) % routeLengthRef.current;
      const mower = sampleRoute(distance);
      const direction = getPreviewDirection(mower.angle);

      const trailHistory = trailHistoryRef.current;
      const lastPoint = trailHistory[trailHistory.length - 1];
      if (!lastPoint || Math.hypot(lastPoint.x - mower.x, lastPoint.y - mower.y) > 3) {
        trailHistory.push({ x: mower.x, y: mower.y });
        if (trailHistory.length > TRAIL_HISTORY_LIMIT) {
          trailHistory.shift();
        }
      }

      particleTickAccumulator += dt;
      while (particleTickAccumulator >= 1 / 20) {
        spawnTrailParticle(particlesRef.current, mower.x, mower.y, trailType, direction);
        particleTickAccumulator -= 1 / 20;
      }

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const particle = particlesRef.current[i];
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.rotation += particle.vRot * dt;
        particle.life -= dt;
        if (particle.life <= 0) {
          particlesRef.current.splice(i, 1);
        }
      }

      ctx.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
      drawBackdrop(ctx);

      ctx.save();
      ctx.strokeStyle = "rgba(236, 9, 141, 0.9)";
      ctx.lineWidth = 5;
      ctx.shadowColor = "rgba(236, 9, 141, 0.45)";
      ctx.shadowBlur = 12;
      ctx.strokeRect(10, 10, PREVIEW_WIDTH - 20, PREVIEW_HEIGHT - 20);
      ctx.restore();

      drawTrailLine(ctx, trailHistory, color);
      particlesRef.current.forEach((particle) => drawParticle(ctx, particle));
      drawMower(ctx, color, mower.x, mower.y, mower.angle + Math.PI / 2);

      frameId = requestAnimationFrame(drawFrame);
    };

    frameId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(frameId);
  }, [color, trailType]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="h-auto w-full rounded-[28px] border border-white/70 bg-white/25 shadow-inner"
        style={{ aspectRatio: `${PREVIEW_WIDTH} / ${PREVIEW_HEIGHT}` }}
      />
    </div>
  );
}
