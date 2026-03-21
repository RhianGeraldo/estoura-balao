import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getActiveActions, getBalloons, popBalloon, validateBudget, type Balloon, type Unidade } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, Frown, Search, CheckCircle, XCircle, Loader2 } from "lucide-react";
import GameItem from "@/components/BalloonItem";
import { getGameTypeConfig, type GameType } from "@/lib/gameTypes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface BudgetValidation {
  approved: boolean;
  statusPlano: string;
  cliente: string;
  vendedor: string;
  codOrcamento: number;
}

export default function GamePage() {
  const queryClient = useQueryClient();
  const [selectedUnidade, setSelectedUnidade] = useState("");
  const [codOrcamento, setCodOrcamento] = useState("");
  const [budgetValidation, setBudgetValidation] = useState<BudgetValidation | null>(null);
  const [poppedResult, setPoppedResult] = useState<{ show: boolean; premiado: boolean; valor: number; codOrcamento: number | null; vendedor: string | null }>({
    show: false,
    premiado: false,
    valor: 0,
    codOrcamento: null,
    vendedor: null,
  });

  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  const { data: actionsData, isLoading: actionLoading } = useQuery({
    queryKey: ["active-actions-game"],
    queryFn: getActiveActions,
  });

  const actionsList = actionsData?.actions || [];
  const actionObj = selectedActionId 
    ? actionsList.find((a: any) => a.action.id === selectedActionId)
    : (actionsList.length === 1 ? actionsList[0] : null);

  const action = actionObj?.action || null;
  const actionId = action?.id;
  const gameType = (action?.tipo_jogo || 'balloon') as GameType;
  const gameConfig = getGameTypeConfig(gameType);

  const { data: balloonsData, isLoading: balloonsLoading } = useQuery({
    queryKey: ["balloons", actionId],
    queryFn: () => getBalloons(actionId!),
    enabled: !!actionId,
  });

  const validateMutation = useMutation({
    mutationFn: () => validateBudget(codOrcamento.trim(), selectedUnidade),
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
    mutationFn: (id: string) => popBalloon(id, codOrcamento, budgetValidation?.vendedor, budgetValidation?.cliente),
    onSuccess: (data) => {
      const b = data.balloon;
      if (b.premiado) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
      setPoppedResult({ show: true, premiado: b.premiado, valor: Number(b.valor), codOrcamento: budgetValidation?.codOrcamento || null, vendedor: budgetValidation?.vendedor || null });
      queryClient.invalidateQueries({ queryKey: ["balloons", actionId] });
      setTimeout(() => {
        setPoppedResult((p) => {
          if (p.show) handleReset();
          return { ...p, show: false };
        });
      }, 10000);
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ["balloons", actionId] });
    },
  });

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codOrcamento.trim() || !selectedUnidade) return;
    validateMutation.mutate();
  };

  const handleReset = () => {
    setCodOrcamento("");
    setSelectedUnidade("");
    setBudgetValidation(null);
  };

  if (actionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground font-display text-xl">Carregando...</p>
      </div>
    );
  }

  if (actionsList.length === 0) {
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

  if (!action) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-4xl space-y-8">
          <div className="text-center">
            <h1 className="font-display text-4xl font-bold text-foreground">Escolha uma Campanha</h1>
            <p className="text-muted-foreground mt-2">Clique em uma das campanhas ativas disponíveis para jogar.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            {actionsList.map(({ action: a }: any) => {
              const gtConfig = getGameTypeConfig(a.tipo_jogo || 'balloon');
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedActionId(a.id)}
                  className="w-full sm:w-[320px] lg:w-[350px] flex flex-col items-center justify-center bg-card p-8 rounded-xl border-2 border-border border-b-4 hover:border-primary hover:bg-muted/50 transition-all hover:-translate-y-1 active:translate-y-0 text-center"
                >
                  <span className="text-6xl mb-4 drop-shadow-sm">{gtConfig.emoji}</span>
                  <h3 className="font-display font-bold text-xl w-full">{a.nome}</h3>
                  {a.unidades && a.unidades.length > 0 ? (
                    <p className="text-xs text-muted-foreground mt-4 font-medium">
                      Lojas: {a.unidades.map((u: any) => u.nome).join(', ')}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-4 border border-dashed rounded px-2 py-0.5 border-muted-foreground/30">
                      Todas as lojas permitidas
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const balloons = balloonsData?.balloons || [];
  const unidades = action?.unidades || [];
  const canPop = budgetValidation?.approved === true;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          {actionsList.length > 1 && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedActionId(null)} className="absolute left-4 top-4 md:static">
              &larr; Voltar
            </Button>
          )}
          <div className="text-center mx-auto">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              {gameConfig.emoji} {action.nome}
            </h1>
            <p className="text-muted-foreground mt-1">Selecione a unidade e informe o código do orçamento</p>
          </div>
          {/* Spacer to keep center alignment when back button is present */}
          {actionsList.length > 1 && <div className="hidden md:block w-[76px]" />}
        </div>
      </header>

      <Dialog open={!canPop}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-xl md:w-full [&>button]:hidden" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader className="relative">
            {actionsList.length > 1 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedActionId(null)} className="absolute -top-2 right-0 text-muted-foreground hover:text-foreground">
                Trocar Jogo
              </Button>
            )}
            <DialogTitle className="font-display flex items-center gap-2 text-2xl pt-2">
              <PartyPopper className="h-6 w-6 text-primary" />
              Validar Orçamento
            </DialogTitle>
            <DialogDescription>
              Acesso bloqueado. Informe a unidade e o código do orçamento aprovado para participar.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleValidate} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Unidade</label>
              <Select value={selectedUnidade} onValueChange={setSelectedUnidade}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Código do Orçamento</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Ex: 123456"
                  value={codOrcamento}
                  onChange={(e) => setCodOrcamento(e.target.value)}
                  className="text-lg font-display w-full"
                  disabled={validateMutation.isPending}
                />
                <Button type="submit" disabled={validateMutation.isPending || !codOrcamento.trim() || !selectedUnidade} className="w-full sm:w-auto mt-2 sm:mt-0">
                  {validateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span className="ml-2">Buscar</span>
                </Button>
              </div>
            </div>

            {budgetValidation && !budgetValidation.approved && (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm text-destructive">
                  <p><strong>Status: {budgetValidation.statusPlano}</strong></p>
                  {budgetValidation.statusPlano === "Orçamento já utilizado" ? (
                    <p>Este orçamento já utilizou seu limite de {gameConfig.itemNamePlural} disponíveis (1).</p>
                  ) : (
                    <p>Apenas orçamentos com status "Aprovado" podem participar.</p>
                  )}
                </div>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>

      <div className="mx-auto max-w-xl px-6 pt-6">
        {canPop && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full">
                <div className="bg-primary/10 p-2 rounded-full">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-display font-bold text-foreground">
                    Orçamento #{budgetValidation.codOrcamento}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Vendedor: <span className="font-medium text-foreground">{budgetValidation.vendedor}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cliente: {budgetValidation.cliente}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset} className="w-full sm:w-auto">
                <XCircle className="h-4 w-4 mr-1" /> Sair
              </Button>
            </div>
          </div>
        )}
      </div>

      <main className="mx-auto max-w-6xl p-6">
        {balloonsLoading ? (
          <p className="text-center text-muted-foreground">Carregando balões...</p>
        ) : (
          <>
            {!canPop && (
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">
                  🔒 Valide um orçamento aprovado para desbloquear os {gameConfig.itemNamePlural}
                </p>
              </div>
            )}
            <div className={`flex flex-wrap justify-center gap-4 max-w-5xl mx-auto ${!canPop ? "opacity-50 pointer-events-none" : ""}`}>
              {balloons.map((balloon, i) => (
                <GameItem
                  key={balloon.id}
                  balloon={balloon}
                  index={i}
                  onPop={() => popMutation.mutate(balloon.id)}
                  isPopping={popMutation.isPending}
                  gameType={gameType}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <AnimatePresence>
        {poppedResult.show && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setPoppedResult((p) => ({ ...p, show: false }));
              handleReset();
            }}
          >
            <motion.div
              className="rounded-2xl bg-card p-8 text-center shadow-2xl max-w-sm mx-4"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              onClick={(e) => e.stopPropagation()}
            >
              {poppedResult.premiado ? (
                <>
                  <motion.div initial={{ rotate: -10 }} animate={{ rotate: [10, -10, 10, 0] }} transition={{ duration: 0.5 }}>
                    <PartyPopper className="mx-auto h-16 w-16 text-secondary mb-4" />
                  </motion.div>
                  <h2 className="font-display text-3xl font-bold text-foreground mb-2">Parabéns! 🎉</h2>
                  {poppedResult.codOrcamento && (
                    <div className="flex flex-col items-center gap-1 mb-4">
                      <p className="text-sm text-muted-foreground font-bold border border-border inline-block px-4 py-1 rounded-full bg-muted/50">
                        Orçamento #{poppedResult.codOrcamento}
                      </p>
                      <p className="text-xs text-muted-foreground">Vendedor: {poppedResult.vendedor}</p>
                    </div>
                  )}
                  <p className="font-display text-4xl font-bold text-primary">R$ {poppedResult.valor.toFixed(2)}</p>
                </>
              ) : (
                <>
                  <Frown className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                  <h2 className="font-display text-2xl font-bold text-foreground mb-2">Não foi dessa vez!</h2>
                  {poppedResult.codOrcamento && (
                    <div className="flex flex-col items-center gap-1 mb-4">
                      <p className="text-sm text-muted-foreground font-bold border border-border inline-block px-4 py-1 rounded-full bg-muted/50">
                        Orçamento #{poppedResult.codOrcamento}
                      </p>
                      <p className="text-xs text-muted-foreground">Vendedor: {poppedResult.vendedor}</p>
                    </div>
                  )}
                  <p className="text-muted-foreground">Tente outro {gameConfig.itemName} 😊</p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
