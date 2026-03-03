import { motion } from "framer-motion";
import type { Balloon } from "@/lib/api";

const BALLOON_COLORS = [
  "bg-balloon-red",
  "bg-balloon-blue",
  "bg-balloon-green",
  "bg-balloon-yellow",
  "bg-balloon-purple",
  "bg-balloon-pink",
  "bg-balloon-orange",
  "bg-balloon-teal",
];

interface BalloonItemProps {
  balloon: Balloon;
  index: number;
  onPop: () => void;
  isPopping: boolean;
}

export default function BalloonItem({ balloon, index, onPop, isPopping }: BalloonItemProps) {
  // Use a simple hash of the UUID to pick a consistent pseudo-random color
  const hash = balloon.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const color = BALLOON_COLORS[hash % BALLOON_COLORS.length];

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
      className={`relative aspect-square w-20 sm:w-24 shrink-0 rounded-full ${color} cursor-pointer shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center group disabled:opacity-60`}
      whileHover={{ scale: 1.1, y: -4 }}
      whileTap={{ scale: 0.9 }}
      animate={{ y: [0, -6, 0] }}
      transition={{
        y: { duration: 2 + (index % 3) * 0.5, repeat: Infinity, ease: "easeInOut" },
      }}
    >
      {/* Balloon shine */}
      <div className="absolute top-2 left-3 w-3 h-4 rounded-full bg-primary-foreground/30 rotate-[-20deg]" />

      {/* Balloon string */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-[2px] h-4 bg-foreground/20" />

      {/* Number */}
      <span className="font-display font-bold text-primary-foreground text-sm group-hover:scale-110 transition-transform">
        {balloon.numero}
      </span>
    </motion.button>
  );
}
