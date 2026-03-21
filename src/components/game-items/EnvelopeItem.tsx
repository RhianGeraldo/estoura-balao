import { motion } from "framer-motion";
import type { Balloon } from "@/lib/api";

const ENVELOPE_COLORS = [
  { body: "hsl(43, 80%, 55%)", flap: "hsl(43, 80%, 45%)", inner: "hsl(43, 80%, 65%)" },
  { body: "hsl(220, 10%, 68%)", flap: "hsl(220, 10%, 55%)", inner: "hsl(220, 10%, 78%)" },
  { body: "hsl(0, 72%, 50%)", flap: "hsl(0, 72%, 40%)", inner: "hsl(0, 72%, 62%)" },
  { body: "hsl(215, 75%, 50%)", flap: "hsl(215, 75%, 40%)", inner: "hsl(215, 75%, 62%)" },
  { body: "hsl(155, 60%, 40%)", flap: "hsl(155, 60%, 30%)", inner: "hsl(155, 60%, 52%)" },
  { body: "hsl(265, 55%, 52%)", flap: "hsl(265, 55%, 42%)", inner: "hsl(265, 55%, 64%)" },
];

interface EnvelopeItemProps {
  balloon: Balloon;
  index: number;
  onPop: () => void;
  isPopping: boolean;
}

export default function EnvelopeItem({ balloon, index, onPop, isPopping }: EnvelopeItemProps) {
  const hash = balloon.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorSet = ENVELOPE_COLORS[hash % ENVELOPE_COLORS.length];

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
      animate={{ y: [0, -4, 0] }}
      transition={{
        y: { duration: 2.5 + (index % 3) * 0.4, repeat: Infinity, ease: "easeInOut" },
      }}
    >
      {/* Envelope SVG */}
      <svg
        viewBox="0 0 120 90"
        className="w-20 h-[60px] sm:w-24 sm:h-[72px] drop-shadow-lg group-hover:drop-shadow-xl transition-all"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Envelope body */}
        <rect x="2" y="10" width="116" height="78" rx="6" fill={colorSet.body} />

        {/* Inner fold lines (V shape at bottom) */}
        <path d="M2 88 L60 50 L118 88" fill={colorSet.inner} />
        <path d="M2 88 L60 50 L118 88" fill="none" stroke={colorSet.flap} strokeWidth="1" opacity="0.3" />

        {/* Top flap (triangle) */}
        <path d="M2 10 L60 52 L118 10 Z" fill={colorSet.flap} />

        {/* Flap edge highlight */}
        <path d="M2 10 L60 52 L118 10" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />

        {/* Shine */}
        <rect x="10" y="14" width="20" height="8" rx="4" fill="rgba(255,255,255,0.2)" transform="rotate(-5 10 14)" />
      </svg>

      {/* Number overlaid */}
      <span className="absolute font-display font-bold text-white text-sm group-hover:scale-110 transition-transform z-10 drop-shadow-md mt-1">
        {balloon.numero}
      </span>
    </motion.button>
  );
}
