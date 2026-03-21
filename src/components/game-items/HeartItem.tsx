import { motion } from "framer-motion";
import type { Balloon } from "@/lib/api";

const HEART_COLORS = [
  { fill: "hsl(0, 80%, 55%)", className: "text-heart-red" },
  { fill: "hsl(340, 75%, 60%)", className: "text-heart-pink" },
  { fill: "hsl(290, 60%, 55%)", className: "text-heart-purple" },
  { fill: "hsl(350, 80%, 62%)", className: "text-heart-rose" },
  { fill: "hsl(310, 70%, 55%)", className: "text-heart-fuchsia" },
  { fill: "hsl(15, 80%, 60%)", className: "text-heart-coral" },
];

interface HeartItemProps {
  balloon: Balloon;
  index: number;
  onPop: () => void;
  isPopping: boolean;
}

export default function HeartItem({ balloon, index, onPop, isPopping }: HeartItemProps) {
  const hash = balloon.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorSet = HEART_COLORS[hash % HEART_COLORS.length];

  if (balloon.estourado) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center aspect-square w-20 sm:w-24 shrink-0 rounded-2xl bg-muted/50 border border-border p-2"
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
      >
        <span className="text-xs text-muted-foreground font-medium">#{balloon.numero}</span>
        {balloon.premiado ? (
          <span className="text-sm font-display font-bold text-primary mt-1">
            R$ {Number(balloon.valor).toFixed(0)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground mt-1">—</span>
        )}
      </motion.div>
    );
  }

  return (
    <motion.button
      onClick={onPop}
      disabled={isPopping}
      className="relative w-20 sm:w-24 shrink-0 cursor-pointer group disabled:opacity-60 flex items-center justify-center"
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.88 }}
      animate={{ scale: [1, 1.06, 1] }}
      transition={{
        scale: { duration: 1.2 + (index % 3) * 0.3, repeat: Infinity, ease: "easeInOut" },
      }}
    >
      {/* Heart SVG */}
      <svg
        viewBox="0 0 100 100"
        className="w-16 h-16 sm:w-20 sm:h-20 drop-shadow-lg group-hover:drop-shadow-xl transition-all"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M50 88 C25 65, 0 50, 0 30 C0 13, 13 0, 28 0 C38 0, 46 5, 50 14 C54 5, 62 0, 72 0 C87 0, 100 13, 100 30 C100 50, 75 65, 50 88Z"
          fill={colorSet.fill}
        />
        {/* Shine highlight */}
        <ellipse cx="30" cy="25" rx="10" ry="13" fill="rgba(255,255,255,0.25)" transform="rotate(-20 30 25)" />
      </svg>

      {/* Number overlaid */}
      <span className="absolute font-display font-bold text-white text-sm group-hover:scale-110 transition-transform z-10 drop-shadow-md mt-1">
        {balloon.numero}
      </span>
    </motion.button>
  );
}
