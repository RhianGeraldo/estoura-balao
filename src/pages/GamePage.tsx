import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getActiveAction, getBalloons, popBalloon, type Balloon } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, Frown } from "lucide-react";
import BalloonItem from "@/components/BalloonItem";

export default function GamePage() {
  const queryClient = useQueryClient();
  const [poppedResult, setPoppedResult] = useState<{ show: boolean; premiado: boolean; valor: number }>({
    show: false,
    premiado: false,
    valor: 0,
  });

  const { data: actionData, isLoading: actionLoading } = useQuery({
    queryKey: ["active-action-game"],
    queryFn: getActiveAction,
  });

  const actionId = actionData?.action?.id;

  const { data: balloonsData, isLoading: balloonsLoading } = useQuery({
    queryKey: ["balloons", actionId],
    queryFn: () => getBalloons(actionId!),
    enabled: !!actionId,
  });

  const popMutation = useMutation({
    mutationFn: (id: string) => popBalloon(id),
    onSuccess: (data) => {
      const b = data.balloon;
      setPoppedResult({ show: true, premiado: b.premiado, valor: Number(b.valor) });
      queryClient.invalidateQueries({ queryKey: ["balloons", actionId] });
      setTimeout(() => setPoppedResult((p) => ({ ...p, show: false })), 3000);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["balloons", actionId] });
    },
  });

  if (actionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground font-display text-xl">Carregando...</p>
      </div>
    );
  }

  if (!actionData?.action) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <PartyPopper className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Nenhuma ação ativa</h1>
          <p className="text-muted-foreground">Aguarde o administrador criar uma nova campanha!</p>
        </div>
      </div>
    );
  }

  const balloons = balloonsData?.balloons || [];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto max-w-6xl text-center">
          <h1 className="font-display text-3xl font-bold text-foreground">
            🎈 {actionData.action.nome}
          </h1>
          <p className="text-muted-foreground mt-1">Clique em um balão para estourá-lo!</p>
        </div>
      </header>

      {/* Balloon Grid */}
      <main className="mx-auto max-w-6xl p-6">
        {balloonsLoading ? (
          <p className="text-center text-muted-foreground">Carregando balões...</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {balloons.map((balloon, i) => (
              <BalloonItem
                key={balloon.id}
                balloon={balloon}
                index={i}
                onPop={() => popMutation.mutate(balloon.id)}
                isPopping={popMutation.isPending}
              />
            ))}
          </div>
        )}
      </main>

      {/* Result overlay */}
      <AnimatePresence>
        {poppedResult.show && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPoppedResult((p) => ({ ...p, show: false }))}
          >
            <motion.div
              className="rounded-2xl bg-card p-8 text-center shadow-2xl max-w-sm mx-4"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
            >
              {poppedResult.premiado ? (
                <>
                  <motion.div
                    initial={{ rotate: -10 }}
                    animate={{ rotate: [10, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    <PartyPopper className="mx-auto h-16 w-16 text-secondary mb-4" />
                  </motion.div>
                  <h2 className="font-display text-3xl font-bold text-foreground mb-2">Parabéns! 🎉</h2>
                  <p className="font-display text-4xl font-bold text-primary">
                    R$ {poppedResult.valor.toFixed(2)}
                  </p>
                </>
              ) : (
                <>
                  <Frown className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                  <h2 className="font-display text-2xl font-bold text-foreground mb-2">Não foi dessa vez!</h2>
                  <p className="text-muted-foreground">Tente outro balão 😊</p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
