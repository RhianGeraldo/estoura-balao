import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getActiveAction, getBalloons, popBalloon, validateBudget, type Balloon } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, Frown, Search, CheckCircle, XCircle, Loader2 } from "lucide-react";
import BalloonItem from "@/components/BalloonItem";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BudgetValidation {
  approved: boolean;
  statusPlano: string;
  cliente: string;
  vendedor: string;
  codOrcamento: number;
}

export default function GamePage() {
  const queryClient = useQueryClient();
  const [codOrcamento, setCodOrcamento] = useState("");
  const [budgetValidation, setBudgetValidation] = useState<BudgetValidation | null>(null);
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

  const validateMutation = useMutation({
    mutationFn: (code: string) => validateBudget(code),
    onSuccess: (data) => {
      setBudgetValidation(data);
      if (!data.approved) {
        toast.error(`Orçamento com status "${data.statusPlano}". Apenas orçamentos aprovados podem estourar balões.`);
      } else {
        toast.success(`Orçamento aprovado! Vendedor: ${data.vendedor}`);
      }
    },
    onError: (err: Error) => {
      setBudgetValidation(null);
      toast.error(err.message);
    },
  });

  const popMutation = useMutation({
    mutationFn: (id: string) => popBalloon(id, codOrcamento),
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

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codOrcamento.trim()) return;
    validateMutation.mutate(codOrcamento.trim());
  };

  const handleReset = () => {
    setCodOrcamento("");
    setBudgetValidation(null);
  };

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
  const canPop = budgetValidation?.approved === true;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto max-w-6xl text-center">
          <h1 className="font-display text-3xl font-bold text-foreground">
            🎈 {actionData.action.nome}
          </h1>
          <p className="text-muted-foreground mt-1">Informe o código do orçamento para estourar um balão!</p>
        </div>
      </header>

      {/* Budget Validation */}
      <div className="mx-auto max-w-xl px-6 pt-6">
        {!canPop ? (
          <form onSubmit={handleValidate} className="flex gap-2">
            <Input
              placeholder="Código do Orçamento"
              value={codOrcamento}
              onChange={(e) => setCodOrcamento(e.target.value)}
              className="text-center text-lg font-display"
              disabled={validateMutation.isPending}
            />
            <Button type="submit" disabled={validateMutation.isPending || !codOrcamento.trim()}>
              {validateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2">Validar</span>
            </Button>
          </form>
        ) : (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-display font-bold text-foreground text-sm">
                    Orçamento #{budgetValidation.codOrcamento} — Aprovado
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {budgetValidation.vendedor} • {budgetValidation.cliente}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <XCircle className="h-4 w-4 mr-1" /> Trocar
              </Button>
            </div>
          </div>
        )}

        {budgetValidation && !budgetValidation.approved && (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">
              Status: <strong>{budgetValidation.statusPlano}</strong> — Apenas orçamentos com status "Aprovado" podem participar.
            </p>
          </div>
        )}
      </div>

      {/* Balloon Grid */}
      <main className="mx-auto max-w-6xl p-6">
        {balloonsLoading ? (
          <p className="text-center text-muted-foreground">Carregando balões...</p>
        ) : (
          <>
            {!canPop && (
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">
                  🔒 Valide um orçamento aprovado para desbloquear os balões
                </p>
              </div>
            )}
            <div className={`grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4 ${!canPop ? "opacity-50 pointer-events-none" : ""}`}>
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
          </>
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
