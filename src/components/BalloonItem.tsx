import { motion } from "framer-motion";
import type { Balloon } from "@/lib/api";
import type { GameType } from "@/lib/gameTypes";
import EnvelopeItem from "@/components/game-items/EnvelopeItem";
import HeartItem from "@/components/game-items/HeartItem";
import ChestItem from "@/components/game-items/ChestItem";
import RouletteItem from "@/components/game-items/RouletteItem";

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

interface GameItemProps {
  balloon: Balloon;
  index: number;
  onPop: () => void;
  isPopping: boolean;
  gameType?: GameType;
  totalRemaining?: number;
  totalItems?: number;
  onSpinComplete?: () => void;
}

export default function GameItem({ balloon, index, onPop, isPopping, gameType = "balloon", totalRemaining = 0, totalItems = 0, onSpinComplete }: GameItemProps) {
  switch (gameType) {
    case "envelope":
      return <EnvelopeItem balloon={balloon} index={index} onPop={onPop} isPopping={isPopping} />;
    case "heart":
      return <HeartItem balloon={balloon} index={index} onPop={onPop} isPopping={isPopping} />;
    case "chest":
      return <ChestItem balloon={balloon} index={index} onPop={onPop} isPopping={isPopping} />;
    case "roulette":
      return <RouletteItem balloon={balloon} index={index} onPop={onPop} isPopping={isPopping} totalRemaining={totalRemaining} totalItems={totalItems} onSpinComplete={onSpinComplete} />;
    case "balloon":
    default:
      return <BalloonItemVisual balloon={balloon} index={index} onPop={onPop} isPopping={isPopping} />;
  }
}

// Original balloon visual (extracted from the old BalloonItem)
function BalloonItemVisual({ balloon, index, onPop, isPopping }: Omit<GameItemProps, "gameType">) {
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
