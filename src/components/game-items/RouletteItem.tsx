import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Balloon } from "@/lib/api";

interface RouletteItemProps {
  balloon: Balloon;
  index: number;
  onPop: () => void;
  isPopping: boolean;
  totalRemaining: number;
  totalItems: number;
  onSpinComplete?: () => void;
}

const SPIN_DURATION_MS = 4000;
const FULL_ROUNDS = 8;

function drawWheel(
  canvas: HTMLCanvasElement,
  totalSectors: number,
  winnerSectorIndex: number | null,
  rotationAngle: number,
  revealed: boolean
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(cx, cy) - 8;
  const innerRadius = radius * 0.28;

  ctx.clearRect(0, 0, W, H);

  const sectorAngle = (2 * Math.PI) / totalSectors;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotationAngle);

  for (let i = 0; i < totalSectors; i++) {
    const startAngle = i * sectorAngle - Math.PI / 2;
    const endAngle = startAngle + sectorAngle;
    const isWinner = winnerSectorIndex !== null && i === winnerSectorIndex;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, startAngle, endAngle);
    ctx.closePath();

    if (isWinner && revealed) {
      ctx.fillStyle = "#22c55e";
    } else if (i % 2 === 0) {
      ctx.fillStyle = "#c0392b";
    } else {
      ctx.fillStyle = "#1a1a2e";
    }
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const labelAngle = startAngle + sectorAngle / 2;
    const labelR = radius * 0.68;
    ctx.save();
    ctx.rotate(labelAngle + Math.PI / 2);
    ctx.translate(0, -labelR);
    ctx.rotate(-(labelAngle + Math.PI / 2));
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `bold ${Math.max(9, Math.min(14, Math.floor((radius / totalSectors) * 1.6)))}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (isWinner && revealed) {
      ctx.fillStyle = "#ffffff";
      ctx.fillText("🏆", 0, 0);
    } else {
      ctx.fillText(`${i + 1}`, 0, 0);
    }
    ctx.restore();
  }

  // Inner hub
  ctx.beginPath();
  ctx.arc(0, 0, innerRadius, 0, 2 * Math.PI);
  ctx.fillStyle = "#0f172a";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, innerRadius * 0.55, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();

  ctx.restore();

  // Outer gold ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 6, 0, 2 * Math.PI);
  ctx.strokeStyle = "rgba(255,215,0,0.7)";
  ctx.lineWidth = 5;
  ctx.stroke();

  // Pointer triangle at top
  const pinX = cx;
  const pinY = cy - radius - 2;
  ctx.beginPath();
  ctx.moveTo(pinX, pinY + 18);
  ctx.lineTo(pinX - 10, pinY - 6);
  ctx.lineTo(pinX + 10, pinY - 6);
  ctx.closePath();
  ctx.fillStyle = "#facc15";
  ctx.fill();
  ctx.strokeStyle = "#b45309";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export default function RouletteItem({
  balloon,
  onPop,
  isPopping,
  totalRemaining,
  totalItems,
  onSpinComplete,
}: RouletteItemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const prevBalloonIdRef = useRef(balloon.id);
  // Always keep a fresh reference so the animation closure never gets stale
  const onSpinCompleteRef = useRef(onSpinComplete);
  useEffect(() => { onSpinCompleteRef.current = onSpinComplete; }, [onSpinComplete]);

  const [spinning, setSpinning] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [winnerSectorIndex, setWinnerSectorIndex] = useState<number | null>(null);

  const totalSectors = Math.max(6, Math.min(totalItems, 24));
  const WINNER_SECTOR = totalSectors - 1;

  const getSectorCenterOffset = useCallback(
    (sectorIndex: number) => {
      const sectorAngle = (2 * Math.PI) / totalSectors;
      // We want to return the relative angle from the wheel's 0-index start point
      // to the center of the desired sector.
      return sectorIndex * sectorAngle + sectorAngle / 2;
    },
    [totalSectors]
  );

  // Reset when the balloon prop switches to the next one (after spin complete)
  useEffect(() => {
    if (prevBalloonIdRef.current !== balloon.id) {
      prevBalloonIdRef.current = balloon.id;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setSpinning(false);
      setRevealed(false);
      setWinnerSectorIndex(null);
      setRotationAngle(0);
    }
  }, [balloon.id]);

  // Draw wheel on every state change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawWheel(canvas, totalSectors, winnerSectorIndex, rotationAngle, revealed);
  }, [rotationAngle, totalSectors, winnerSectorIndex, revealed]);

  // Start animation when server confirms the result (estourado becomes true via setQueryData)
  useEffect(() => {
    if (!balloon.estourado || revealed || spinning) return;

    const isWinner = balloon.premiado === true;
    const targetSector = isWinner
      ? WINNER_SECTOR
      : Math.floor(Math.random() * (totalSectors - 1));

    if (isWinner) setWinnerSectorIndex(WINNER_SECTOR);

    const startAngle = rotationAngle;
    const sectorOffset = getSectorCenterOffset(targetSector);
    // targetRotation = start_of_this_round_rotation - how_much_to_offset_to_bring_sector_to_top
    // Pointer is at Top (-PI/2). Wheel starts drawing at -PI/2.
    // So to bring sector with offset 'S' to top, we need to rotate wheel by -S.
    const targetRotation =
        startAngle + (FULL_ROUNDS * 2 * Math.PI) - sectorOffset - (startAngle % (2 * Math.PI));

    setSpinning(true);
    const spinStart = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

    const animate = (now: number) => {
      const elapsed = now - spinStart;
      const t = Math.min(elapsed / SPIN_DURATION_MS, 1);
      const currentAngle = startAngle + (targetRotation - startAngle) * easeOut(t);
      setRotationAngle(currentAngle);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setRotationAngle(targetRotation);
        setSpinning(false);
        setRevealed(true);
        // Use ref so we always call the latest handler (avoids stale closure)
        setTimeout(() => { onSpinCompleteRef.current?.(); }, 600);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balloon.estourado]);

  const canSpin = !spinning && !isPopping && !revealed && !balloon.estourado;

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Stats */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary" />
          <strong className="text-foreground">{totalRemaining}</strong> giros restantes
        </span>
        <span className="text-border">|</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
          {totalItems - totalRemaining} realizados
        </span>
      </div>

      {/* Wheel */}
      <div className="relative flex items-center justify-center">
        <AnimatePresence>
          {spinning && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ boxShadow: "0 0 60px 15px rgba(250, 204, 21, 0.35)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          )}
        </AnimatePresence>

        <canvas
          ref={canvasRef}
          width={360}
          height={360}
          className={`max-w-[min(360px,85vw)] max-h-[min(360px,85vw)] drop-shadow-2xl transition-all duration-700 ${
            (revealed || balloon.estourado) && !spinning ? "grayscale-[0.8] opacity-80 scale-95" : ""
          }`}
          style={{ aspectRatio: "1 / 1" }}
        />

        {/* Center hub icon */}
        <div className="absolute flex flex-col items-center justify-center pointer-events-none select-none">
          {spinning ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
              className="text-3xl"
            >
              🎰
            </motion.div>
          ) : (
            <span className="text-3xl opacity-60">🎰</span>
          )}
        </div>
      </div>

      {/* Button */}
      <motion.button
        onClick={() => { if (canSpin) onPop(); }}
        disabled={!canSpin}
        className={`
          relative overflow-hidden px-10 py-4 rounded-2xl font-display font-bold text-xl
          transition-all duration-200 select-none
          ${canSpin
            ? "bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 text-gray-900 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
          }
        `}
        whileTap={canSpin ? { scale: 0.95 } : {}}
      >
        {spinning ? (
          <span className="flex items-center gap-2">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
            >⚙️</motion.span>
            Girando...
          </span>
        ) : isPopping ? (
          <span className="flex items-center gap-2">⚙️ Sorteando...</span>
        ) : (
          <span className="flex items-center gap-2">🎰 Girar a Roleta</span>
        )}

        {canSpin && (
          <motion.div
            className="absolute inset-0 w-1/3 bg-white/30 skew-x-[-20deg]"
            animate={{ x: ["-100%", "400%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.button>
    </div>
  );
}
