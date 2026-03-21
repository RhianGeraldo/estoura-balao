import { motion } from "framer-motion";
import type { Balloon } from "@/lib/api";

const CHEST_COLORS = [
  { wood: "hsl(25, 55%, 35%)", woodDark: "hsl(25, 55%, 25%)", metal: "hsl(43, 85%, 50%)", metalDark: "hsl(43, 75%, 38%)" },
  { wood: "hsl(15, 50%, 32%)", woodDark: "hsl(15, 50%, 22%)", metal: "hsl(43, 85%, 50%)", metalDark: "hsl(43, 75%, 38%)" },
  { wood: "hsl(30, 60%, 38%)", woodDark: "hsl(30, 60%, 26%)", metal: "hsl(28, 60%, 45%)", metalDark: "hsl(28, 50%, 32%)" },
  { wood: "hsl(20, 45%, 30%)", woodDark: "hsl(20, 45%, 20%)", metal: "hsl(43, 90%, 52%)", metalDark: "hsl(43, 80%, 40%)" },
  { wood: "hsl(155, 40%, 28%)", woodDark: "hsl(155, 40%, 18%)", metal: "hsl(43, 85%, 50%)", metalDark: "hsl(43, 75%, 38%)" },
  { wood: "hsl(220, 35%, 32%)", woodDark: "hsl(220, 35%, 22%)", metal: "hsl(43, 85%, 50%)", metalDark: "hsl(43, 75%, 38%)" },
];

interface ChestItemProps {
  balloon: Balloon;
  index: number;
  onPop: () => void;
  isPopping: boolean;
}

export default function ChestItem({ balloon, index, onPop, isPopping }: ChestItemProps) {
  const hash = balloon.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const c = CHEST_COLORS[hash % CHEST_COLORS.length];

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
      whileHover={{ scale: 1.08, y: -3 }}
      whileTap={{ scale: 0.92 }}
      animate={{ y: [0, -3, 0] }}
      transition={{
        y: { duration: 3 + (index % 3) * 0.5, repeat: Infinity, ease: "easeInOut" },
      }}
    >
      {/* Treasure Chest SVG */}
      <svg
        viewBox="0 0 100 90"
        className="w-20 h-[72px] sm:w-24 sm:h-[86px] drop-shadow-lg group-hover:drop-shadow-xl transition-all"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* === LID (arched top) === */}
        <path
          d="M8 42 L8 28 Q8 8, 50 8 Q92 8, 92 28 L92 42 Z"
          fill={c.wood}
        />
        {/* Lid top highlight */}
        <path
          d="M12 28 Q12 12, 50 12 Q88 12, 88 28"
          fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2"
        />
        {/* Lid metal band */}
        <rect x="6" y="36" width="88" height="6" rx="1" fill={c.metal} />
        <rect x="6" y="36" width="88" height="2" rx="1" fill={c.metalDark} opacity="0.3" />

        {/* Lid vertical center band */}
        <path d="M47 8 L47 42 L53 42 L53 8 Q50 6 47 8" fill={c.metal} />
        <path d="M48 10 L48 42" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

        {/* === BODY (bottom box) === */}
        <rect x="6" y="42" width="88" height="40" rx="4" fill={c.woodDark} />
        {/* Body front face */}
        <rect x="8" y="44" width="84" height="36" rx="3" fill={c.wood} />

        {/* Body horizontal metal bands */}
        <rect x="6" y="58" width="88" height="5" rx="1" fill={c.metal} />
        <rect x="6" y="58" width="88" height="1.5" rx="1" fill={c.metalDark} opacity="0.3" />

        {/* Body vertical center band */}
        <rect x="47" y="42" width="6" height="40" fill={c.metal} />
        <line x1="48" y1="44" x2="48" y2="80" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

        {/* === LOCK === */}
        {/* Lock plate */}
        <rect x="43" y="33" width="14" height="16" rx="3" fill={c.metalDark} />
        <rect x="44" y="34" width="12" height="14" rx="2.5" fill={c.metal} />
        {/* Keyhole */}
        <circle cx="50" cy="40" r="2.5" fill={c.woodDark} />
        <rect x="49" y="40" width="2" height="4" rx="0.5" fill={c.woodDark} />

        {/* Lid shine */}
        <ellipse cx="30" cy="22" rx="12" ry="6" fill="rgba(255,255,255,0.1)" transform="rotate(-8 30 22)" />

        {/* Corner rivets */}
        <circle cx="14" cy="48" r="2" fill={c.metalDark} />
        <circle cx="86" cy="48" r="2" fill={c.metalDark} />
        <circle cx="14" cy="76" r="2" fill={c.metalDark} />
        <circle cx="86" cy="76" r="2" fill={c.metalDark} />
      </svg>

      {/* Number overlaid */}
      <span className="absolute font-display font-bold text-white text-sm group-hover:scale-110 transition-transform z-10 drop-shadow-md mt-2">
        {balloon.numero}
      </span>
    </motion.button>
  );
}
