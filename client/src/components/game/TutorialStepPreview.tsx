import { useEffect, useRef } from "react";

type TutorialVariant = "leave-base" | "draw-loop" | "capture-loop" | "pickups";

interface TutorialStepPreviewProps {
  variant: TutorialVariant;
  className?: string;
}

interface Point {
  x: number;
  y: number;
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

function drawMower(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color = "#ec4899") {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.fillStyle = color;
  drawRoundedRect(ctx, -11, -9, 22, 18, 4);
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-7, 9);
  ctx.lineTo(-7, 15);
  ctx.lineTo(7, 15);
  ctx.lineTo(7, 9);
  ctx.stroke();

  ctx.fillStyle = "#111827";
  ctx.fillRect(-13, -7, 3, 6);
  ctx.fillRect(10, -7, 3, 6);
  ctx.fillRect(-13, 1, 3, 6);
  ctx.fillRect(10, 1, 3, 6);

  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, points: Point[], color: string) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = `${color}bb`;
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
  ctx.beginPath();
  ctx.moveTo(-8, -5);
  ctx.lineTo(4, -5);
  ctx.lineTo(4, -10);
  ctx.lineTo(14, 0);
  ctx.lineTo(4, 10);
  ctx.lineTo(4, 5);
  ctx.lineTo(-8, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPickup(ctx: CanvasRenderingContext2D, x: number, y: number, type: "fireball" | "shield" | "speed") {
  ctx.save();
  ctx.translate(x, y);

  if (type === "fireball") {
    ctx.shadowColor = "#f97316";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "shield") {
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 14;
    ctx.strokeStyle = "#e0f2fe";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.shadowColor = "#84cc16";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#65a30d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#bef264";
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#14532d";
    ctx.beginPath();
    ctx.moveTo(-2, -7);
    ctx.lineTo(4, -7);
    ctx.lineTo(1, -1);
    ctx.lineTo(5, -1);
    ctx.lineTo(-2, 8);
    ctx.lineTo(0, 2);
    ctx.lineTo(-5, 2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function samplePath(route: Point[], progress: number) {
  const clamped = Math.max(0, Math.min(1, progress));
  let total = 0;
  const lengths: number[] = [];
  for (let i = 0; i < route.length - 1; i++) {
    const length = Math.hypot(route[i + 1].x - route[i].x, route[i + 1].y - route[i].y);
    lengths.push(length);
    total += length;
  }

  let remaining = total * clamped;
  for (let i = 0; i < route.length - 1; i++) {
    const start = route[i];
    const end = route[i + 1];
    const length = lengths[i];
    if (remaining <= length) {
      const t = length === 0 ? 0 : remaining / length;
      return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        angle: Math.atan2(end.y - start.y, end.x - start.x),
      };
    }
    remaining -= length;
  }

  const last = route[route.length - 1];
  const prev = route[route.length - 2];
  return {
    x: last.x,
    y: last.y,
    angle: Math.atan2(last.y - prev.y, last.x - prev.x),
  };
}

function drawBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#fef9c3");
  gradient.addColorStop(0.45, "#dcfce7");
  gradient.addColorStop(1, "#bfdbfe");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawBase(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color = "#ec4899") {
  ctx.save();
  ctx.fillStyle = `${color}55`;
  drawRoundedRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.fillStyle = `${color}2a`;
  drawRoundedRect(ctx, x + 8, y + 8, w - 16, h - 16, 10);
  ctx.fill();
  ctx.restore();
}

function drawCaptureFill(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ec4899";
  drawRoundedRect(ctx, 88, 36, 72, 52, 14);
  ctx.fill();
  ctx.restore();
}

export default function TutorialStepPreview({ variant, className }: TutorialStepPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 220;
    const height = 122;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let frameId = 0;
    const startedAt = performance.now();

    const leaveBaseRoute: Point[] = [
      { x: 76, y: 61 },
      { x: 112, y: 61 },
      { x: 152, y: 61 },
    ];
    const loopRoute: Point[] = [
      { x: 76, y: 61 },
      { x: 122, y: 61 },
      { x: 122, y: 27 },
      { x: 168, y: 27 },
      { x: 168, y: 86 },
    ];
    const captureRoute: Point[] = [
      { x: 168, y: 86 },
      { x: 168, y: 97 },
      { x: 76, y: 97 },
      { x: 76, y: 61 },
    ];
    const pickupRoute: Point[] = [
      { x: 34, y: 86 },
      { x: 72, y: 86 },
      { x: 112, y: 86 },
      { x: 154, y: 86 },
      { x: 190, y: 86 },
    ];

    const render = (timestamp: number) => {
      const loopProgress = ((timestamp - startedAt) / 2600) % 1;
      ctx.clearRect(0, 0, width, height);
      drawBackdrop(ctx, width, height);
      drawBase(ctx, 28, 42, 48, 38);

      ctx.strokeStyle = "rgba(236, 9, 141, 0.75)";
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, width - 16, height - 16);

      if (variant === "leave-base") {
        const sample = samplePath(leaveBaseRoute, loopProgress);
        drawArrow(ctx, 122, 28, 0);
        drawArrow(ctx, 154, 28, 0);
        drawMower(ctx, sample.x, sample.y, sample.angle + Math.PI / 2);
      } else if (variant === "draw-loop") {
        const sample = samplePath(loopRoute, loopProgress);
        const trailUntil = Math.max(2, Math.floor(loopProgress * loopRoute.length * 6));
        const trailPoints = [
          loopRoute[0],
          { x: sample.x, y: sample.y },
        ];
        drawTrail(ctx, trailPoints, "#ec4899");
        ctx.save();
        ctx.fillStyle = "rgba(239,68,68,0.9)";
        ctx.beginPath();
        ctx.arc(178, 49, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        drawMower(ctx, sample.x, sample.y, sample.angle + Math.PI / 2);
        void trailUntil;
      } else if (variant === "capture-loop") {
        const sample = samplePath(captureRoute, loopProgress);
        const flash = loopProgress > 0.72 ? (loopProgress - 0.72) / 0.28 : 0;
        drawTrail(ctx, [{ x: 168, y: 86 }, { x: 168, y: 97 }, { x: 76, y: 97 }, { x: sample.x, y: sample.y }], "#ec4899");
        drawCaptureFill(ctx, flash * 0.4);
        drawMower(ctx, sample.x, sample.y, sample.angle + Math.PI / 2);
      } else {
        const sample = samplePath(pickupRoute, loopProgress);
        drawPickup(ctx, 72, 44, "fireball");
        drawPickup(ctx, 114, 44, "shield");
        drawPickup(ctx, 156, 44, "speed");
        drawTrail(ctx, [{ x: 34, y: 86 }, { x: sample.x, y: sample.y }], "#ec4899");
        drawMower(ctx, sample.x, sample.y, sample.angle + Math.PI / 2);
      }

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [variant]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="h-auto w-full rounded-2xl border border-white/70 bg-white/25 shadow-inner"
        style={{ aspectRatio: "220 / 122" }}
      />
    </div>
  );
}
