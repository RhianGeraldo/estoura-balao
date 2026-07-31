import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getActiveActions, getBalloons, popBalloon, validateBudget, validateCrc, getUsuarios, type Balloon, type Unidade } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, Frown, Search, CheckCircle, XCircle, Loader2, Calendar } from "lucide-react";
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
  codOrcamento: string;
  isPlanoAprovado?: boolean;
  isMinVendaMet?: boolean;
  valorBruto?: number;
  vendaMinima?: number;
  msgVenda?: string;
  nivelPermitido?: 'simples' | 'premium' | null;
  isFallbackSimples?: boolean;
  discountPct?: number;
}

export default function GamePage() {
  const queryClient = useQueryClient();
  const [selectedUnidade, setSelectedUnidade] = useState("");
  const [codOrcamentos, setCodOrcamentos] = useState<string[]>([""]);
  const [budgetValidation, setBudgetValidation] = useState<BudgetValidation | null>(null);
  const [validationType, setValidationType] = useState<'orcamento' | 'crc'>('orcamento');
  
  // CRC states
  const [codCrc, setCodCrc] = useState<string>("");
  const [dtInicio, setDtInicio] = useState<string>("");
  const [dtFim, setDtFim] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('pt-BR');
  });
  const [crcValidation, setCrcValidation] = useState<{
    approved: boolean;
    totalIndicacoes: number;
    indicacoesGastas: number;
    indicacoesDisponiveis: number;
    qtd_indicacoes_simples: number;
    qtd_indicacoes_premium: number;
    crcNome?: string;
  } | null>(null);

  const [isUserSearchOpen, setIsUserSearchOpen] = useState(false);

  const [poppedResult, setPoppedResult] = useState<{ show: boolean; premiado: boolean; valor: number; codOrcamento: string | null; vendedor: string | null; codCrc?: string | null; crcNome?: string | null }>({
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
  const isRoulette = gameType === 'roulette';

  // Tracks which balloon is currently spinning so we don't lose it on re-render
  const [rouletteActiveBalloonId, setRouletteActiveBalloonId] = useState<string | null>(null);
  // Stores the result from the API until the wheel animation finishes
  const [pendingRouletteResult, setPendingRouletteResult] = useState<{
    premiado: boolean; valor: number; codOrcamento: string | null; vendedor: string | null; codCrc?: string | null; crcNome?: string | null;
  } | null>(null);
  // Ref always pointing to the latest value — used in callbacks to avoid stale closures
  const pendingRouletteResultRef = useRef(pendingRouletteResult);
  pendingRouletteResultRef.current = pendingRouletteResult;

  const { data: balloonsData, isLoading: balloonsLoading } = useQuery({
    queryKey: ["balloons", actionId],
    queryFn: () => getBalloons(actionId!),
    enabled: !!actionId,
  });

  const { data: usuariosData, isLoading: usuariosLoading } = useQuery({
    queryKey: ["usuarios", selectedUnidade],
    queryFn: () => getUsuarios(selectedUnidade),
    enabled: isUserSearchOpen && !!selectedUnidade,
  });

  // Sync dtInicio with campaign creation date
  useEffect(() => {
    if (action?.created_at) {
      // created_at comes in ISO format from SQLite, or simple date string
      const safeDateStr = action.created_at.replace(' ', 'T');
      const d = new Date(safeDateStr);
      if (!isNaN(d.getTime())) {
        setDtInicio(d.toLocaleDateString('pt-BR'));
      }
    }
  }, [action?.created_at]);

  const validateMutation = useMutation({
    mutationFn: () => {
      const filtered = codOrcamentos.map(c => c.trim()).filter(c => c !== "");
      if (filtered.length === 0) throw new Error("Informe pelo menos um código válido.");
      return validateBudget(filtered, selectedUnidade, action?.id || "");
    },
    onSuccess: (data) => {
      setBudgetValidation(data);
      if (!data.approved) {
        toast.error(`Orçamento com status "${data.statusPlano}". Apenas orçamentos aprovados podem ${gameConfig.actionVerb.toLowerCase()} ${gameConfig.itemNamePlural}.`);
      } else {
        if (data.isFallbackSimples) {
          toast.info("Os balões Premium desta campanha se esgotaram! Você foi redirecionado para jogar nos balões Simples.", { duration: 6000 });
        }
        toast.success(`Orçamento aprovado! Vendedor: ${data.vendedor}`);
      }
    },
    onError: (err: Error) => {
      setBudgetValidation(null);
      toast.error(err.message);
    },
  });

  const popMutation = useMutation({
    mutationFn: (id: string) => {
      if (validationType === 'crc') {
        const balloon = balloonsData?.balloons.find((b: any) => b.id === id);
        const vendedorCrc = crcValidation?.crcNome ? `${crcValidation.crcNome} (CRC)` : `CRC #${codCrc}`;
        return popBalloon(id, undefined, vendedorCrc, "Resgate de Créditos", 'crc', codCrc, balloon?.nivel);
      }
      return popBalloon(id, budgetValidation?.codOrcamento, budgetValidation?.vendedor, budgetValidation?.cliente);
    },
    onSuccess: (data) => {
      const b = data.balloon;

      if (isRoulette) {
        // Roulette: update cache so RouletteItem.useEffect detects estourado=true
        // and starts the wheel animation. Do NOT invalidate yet (would unmount wheel).
        queryClient.setQueryData(["balloons", actionId], (old: any) => {
          if (!old?.balloons) return old;
          return {
            ...old,
            balloons: old.balloons.map((balloon: Balloon) =>
              balloon.id === b.id
                ? { ...balloon, estourado: true, premiado: Boolean(b.premiado), valor: b.valor }
                : balloon
            ),
          };
        });
        // Save result — will be shown AFTER the wheel animation finishes
        setPendingRouletteResult({
          premiado: Boolean(b.premiado),
          valor: Number(b.valor),
          codOrcamento: budgetValidation?.codOrcamento || null,
          vendedor: budgetValidation?.vendedor || null,
          codCrc: validationType === 'crc' ? codCrc : null,
          crcNome: validationType === 'crc' ? crcValidation?.crcNome : null,
        });
        return;
      }

      // Non-roulette: identical original behaviour
      if (b.premiado) confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      setPoppedResult({ 
        show: true, 
        premiado: b.premiado, 
        valor: Number(b.valor), 
        codOrcamento: budgetValidation?.codOrcamento || null, 
        vendedor: budgetValidation?.vendedor || null,
        codCrc: validationType === 'crc' ? codCrc : null,
        crcNome: validationType === 'crc' ? crcValidation?.crcNome : null,
      });
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

  const validateCrcMutation = useMutation({
    mutationFn: () => validateCrc(codCrc, dtInicio, dtFim, selectedUnidade, action?.id || ""),
    onSuccess: (data) => {
      setCrcValidation(data);
      if (data.indicacoesDisponiveis >= data.qtd_indicacoes_simples && data.indicacoesDisponiveis > 0) {
        if (data.indicacoesDisponiveis >= data.qtd_indicacoes_premium && data.qtd_indicacoes_premium > 0 && unpoppedPremiumCount === 0 && unpoppedSimplesCount > 0) {
          toast.info("Os balões Premium desta campanha se esgotaram! Você foi redirecionado para jogar nos balões Simples.", { duration: 6000 });
        }
        toast.success(`CRC validado! Você tem ${data.indicacoesDisponiveis} indicações disponíveis.`);
      } else {
        toast.error(`CRC validado, mas não há saldo de indicações suficientes.`);
      }
    },
    onError: (err: Error) => {
      setCrcValidation(null);
      toast.error(err.message);
    },
  });

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (validationType === 'orcamento') {
      const hasValidCode = codOrcamentos.some(c => c.trim() !== "");
      if (!hasValidCode || !selectedUnidade) return;
      validateMutation.mutate();
    } else {
      if (!codCrc || !dtInicio || !dtFim || !selectedUnidade) return;
      validateCrcMutation.mutate();
    }
  };

  const handleReset = () => {
    setCodOrcamentos([""]);
    setCodCrc("");
    if (action?.created_at) {
      const safeDateStr = action.created_at.replace(' ', 'T');
      const d = new Date(safeDateStr);
      if (!isNaN(d.getTime())) setDtInicio(d.toLocaleDateString('pt-BR'));
    }
    const d = new Date();
    setDtFim(new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('pt-BR'));
    setSelectedUnidade("");
    setBudgetValidation(null);
    setCrcValidation(null);
    setRouletteActiveBalloonId(null);
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
                      Unidades: {a.unidades.map((u: any) => u.nome).join(', ')}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-4 border border-dashed rounded px-2 py-0.5 border-muted-foreground/30">
                      Todas as unidades permitidas
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

  const allBalloons = balloonsData?.balloons || [];
  const unidades = action?.unidades || [];
  
  const canPop = (validationType === 'orcamento' && budgetValidation?.approved === true) || 
                 (validationType === 'crc' && crcValidation !== null && crcValidation.indicacoesDisponiveis >= crcValidation.qtd_indicacoes_simples && crcValidation.indicacoesDisponiveis > 0);
  
  const unpoppedPremiumCount = allBalloons.filter((b: any) => b.nivel === 'premium' && !b.estourado).length;
  const unpoppedSimplesCount = allBalloons.filter((b: any) => (b.nivel === 'simples' || !b.nivel) && !b.estourado).length;

  let nivelPermitido: 'simples' | 'premium' | null = null;
  if (validationType === 'orcamento') {
    nivelPermitido = budgetValidation?.nivelPermitido || 'simples';
  } else if (validationType === 'crc' && crcValidation) {
    if (crcValidation.indicacoesDisponiveis >= crcValidation.qtd_indicacoes_premium && crcValidation.qtd_indicacoes_premium > 0) {
      nivelPermitido = 'premium';
    } else if (crcValidation.indicacoesDisponiveis >= crcValidation.qtd_indicacoes_simples) {
      nivelPermitido = 'simples';
    }
  }

  // Fallback automático para simples se não houver mais balões premium não estourados disponíveis
  if (nivelPermitido === 'premium' && unpoppedPremiumCount === 0 && unpoppedSimplesCount > 0) {
    nivelPermitido = 'simples';
  }

  const balloons = canPop && nivelPermitido
    ? (validationType === 'crc' 
        ? allBalloons.filter((b: any) => {
            if (b.nivel === 'premium' && unpoppedPremiumCount > 0) {
              return crcValidation!.indicacoesDisponiveis >= crcValidation!.qtd_indicacoes_premium && crcValidation!.qtd_indicacoes_premium > 0;
            }
            return b.nivel === 'simples' || !b.nivel;
          })
        : allBalloons.filter((b: any) => b.nivel === nivelPermitido || (!b.nivel && nivelPermitido === 'simples')))
    : allBalloons.filter((b: any) => b.nivel === 'simples' || !b.nivel); // Fallback for old records without nivel

  const handlePop = (balloonId: string) => {
    const balloon = allBalloons.find((b: any) => b.id === balloonId);
    if (!balloon) return;
    
    if (validationType === 'crc' && crcValidation) {
      if (balloon.nivel === 'premium' && crcValidation.indicacoesDisponiveis < crcValidation.qtd_indicacoes_premium) {
        toast.error(`Você precisa de ${crcValidation.qtd_indicacoes_premium} indicações para estourar o balão Premium. (Seu saldo: ${crcValidation.indicacoesDisponiveis})`);
        return;
      }
      if (balloon.nivel === 'simples' && crcValidation.indicacoesDisponiveis < crcValidation.qtd_indicacoes_simples) {
        toast.error(`Você precisa de ${crcValidation.qtd_indicacoes_simples} indicações para estourar o balão Simples. (Seu saldo: ${crcValidation.indicacoesDisponiveis})`);
        return;
      }
    }

    if (isRoulette && !rouletteActiveBalloonId && balloon) {
      setRouletteActiveBalloonId(balloon.id);
    }

    popMutation.mutate(balloonId);
  };

  // For roulette: pin the active ballot by ID so the wheel isn't replaced
  // mid-animation when the query re-renders.
  const activeBalloon = isRoulette
    ? (rouletteActiveBalloonId
        ? balloons.find((b) => b.id === rouletteActiveBalloonId) ?? null
        : balloons.find((b) => !b.estourado) ?? null)
    : null;
  const totalRemaining = isRoulette ? balloons.filter((b) => !b.estourado).length : 0;
  const totalItems = isRoulette ? balloons.length : 0;

  const handleRouletteSpinComplete = () => {
    const r = pendingRouletteResultRef.current;
    if (r) {
      if (r.premiado) confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      setPoppedResult({ show: true, premiado: r.premiado, valor: r.valor, codOrcamento: r.codOrcamento, vendedor: r.vendedor });
      setTimeout(() => {
        setPoppedResult((p) => {
          if (p.show) {
            handleReset();
            setRouletteActiveBalloonId(null); // Unlock ONLY after reset
          }
          return { ...p, show: false };
        });
      }, 10000);
      setPendingRouletteResult(null);
    } else {
      // Safety fallback
      setRouletteActiveBalloonId(null);
    }
    queryClient.invalidateQueries({ queryKey: ["balloons", actionId] });
  };

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
              Validar Participação
            </DialogTitle>
            <DialogDescription>
              Acesso bloqueado. Informe a unidade e os dados necessários para participar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex bg-muted p-1 rounded-lg mb-4 mt-2">
            <button 
              type="button" 
              onClick={() => { setValidationType('orcamento'); handleReset(); }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${validationType === 'orcamento' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Orçamento
            </button>
            <button 
              type="button"
              onClick={() => { setValidationType('crc'); handleReset(); }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${validationType === 'crc' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Indicações (CRC)
            </button>
          </div>

          <form onSubmit={handleValidate} className="space-y-4">
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

            {validationType === 'orcamento' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Códigos dos Orçamentos</label>
                  {codOrcamentos.map((cod, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <Input
                        placeholder="Ex: 123456"
                        value={cod}
                        onChange={(e) => {
                          const newCods = [...codOrcamentos];
                          newCods[index] = e.target.value;
                          setCodOrcamentos(newCods);
                        }}
                        className="text-lg font-display w-full"
                        disabled={validateMutation.isPending}
                      />
                      {codOrcamentos.length > 1 && (
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => {
                            const newCods = codOrcamentos.filter((_, i) => i !== index);
                            setCodOrcamentos(newCods);
                          }}
                          className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          -
                        </Button>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setCodOrcamentos([...codOrcamentos, ""])}
                      className="w-full sm:w-auto"
                    >
                      + Adicionar Orçamento
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={validateMutation.isPending || codOrcamentos.every(c => c.trim() === "") || !selectedUnidade} 
                      className="w-full sm:w-auto ml-auto"
                    >
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
                  <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-destructive">
                      <XCircle className="h-5 w-5 shrink-0" />
                      <p className="font-bold">Validação Falhou</p>
                    </div>
                    
                    <div className="flex flex-col gap-2 text-sm text-destructive pl-7">
                      <div className="flex items-center justify-between border-b border-destructive/20 pb-1">
                        <span>Orçamento Aprovado:</span>
                        <strong className={budgetValidation.isPlanoAprovado ? "text-emerald-500" : "text-destructive"}>
                          {budgetValidation.isPlanoAprovado ? "Sim" : "Não"}
                        </strong>
                      </div>
                      
                      {budgetValidation.vendaMinima !== undefined && budgetValidation.vendaMinima > 0 && (
                        <div className="flex items-center justify-between border-b border-destructive/20 pb-1">
                          <span>Valor Mínimo Atingido:</span>
                          <strong className={budgetValidation.isMinVendaMet ? "text-emerald-500" : "text-destructive"}>
                            {budgetValidation.isMinVendaMet ? "Sim" : "Não"}
                          </strong>
                        </div>
                      )}

                      <div className="mt-2 text-xs opacity-90 space-y-1">
                        {budgetValidation.statusPlano === "Orçamento já utilizado." ? (
                          <p>✨ Este orçamento já utilizou seu limite de {gameConfig.itemNamePlural} (1).</p>
                        ) : (
                          <>
                            {!budgetValidation.isPlanoAprovado && (
                              <p>📌 Status do sistema: {budgetValidation.statusPlano}</p>
                            )}
                            {!budgetValidation.isMinVendaMet && budgetValidation.msgVenda && (
                              <p>📌 {budgetValidation.msgVenda}</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {validationType === 'crc' && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Código do CRC</label>
                    <Button 
                      type="button" 
                      variant="link" 
                      className="h-auto p-0 text-xs h-4" 
                      onClick={() => {
                        if (!selectedUnidade) {
                           toast.error("Selecione a unidade primeiro para buscar o CRC.");
                           return;
                        }
                        setIsUserSearchOpen(true);
                      }}
                    >
                      Buscar meu código
                    </Button>
                  </div>
                  <Input
                    placeholder="Ex: 87200"
                    value={codCrc}
                    onChange={(e) => setCodCrc(e.target.value)}
                    className="text-lg font-display w-full"
                    disabled={validateCrcMutation.isPending}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Inicial</label>
                    <div className="relative">
                      <Input
                        placeholder="DD/MM/YYYY"
                        value={dtInicio}
                        disabled={true}
                        onChange={() => {}}
                        className="bg-muted text-muted-foreground"
                      />
                      <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Final</label>
                    <div className="relative">
                      <Input
                        placeholder="DD/MM/YYYY"
                        value={dtFim}
                        onChange={(e) => setDtFim(e.target.value)}
                        disabled={validateCrcMutation.isPending}
                      />
                      <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end pt-2">
                  <Button 
                    type="submit" 
                    disabled={validateCrcMutation.isPending || !codCrc || !dtInicio || !dtFim || !selectedUnidade} 
                    className="w-full sm:w-auto"
                  >
                    {validateCrcMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span className="ml-2">Consultar Indicações</span>
                  </Button>
                </div>

                {crcValidation && crcValidation.indicacoesDisponiveis < crcValidation.qtd_indicacoes_simples && (
                  <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-destructive">
                      <XCircle className="h-5 w-5 shrink-0" />
                      <p className="font-bold">Sem Saldo Suficiente</p>
                    </div>
                    <p className="text-sm text-destructive pl-7">
                      {crcValidation.indicacoesDisponiveis > 0 
                        ? `Você tem ${crcValidation.indicacoesDisponiveis} indicações, mas precisa de pelo menos ${crcValidation.qtd_indicacoes_simples} para estourar um balão.`
                        : `Foram encontradas ${crcValidation.totalIndicacoes} indicações neste período, mas todas já foram gastas.`}
                    </p>
                  </div>
                )}
              </>
            )}

          </form>
        </DialogContent>
      </Dialog>

      <div className="mx-auto max-w-xl px-6 pt-6">
        {canPop && validationType === 'orcamento' && budgetValidation && (
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
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-muted-foreground">
                      Vendedor: <span className="font-medium text-foreground">{budgetValidation.vendedor}</span>
                    </p>
                    {budgetValidation.nivelPermitido && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 ${
                        budgetValidation.nivelPermitido === 'premium' && !budgetValidation.isFallbackSimples
                          ? 'bg-amber-500/20 text-amber-600 border border-amber-500/30' 
                          : 'bg-primary/20 text-primary border border-primary/30'
                      }`}>
                        Nível: {budgetValidation.nivelPermitido === 'premium' && !budgetValidation.isFallbackSimples ? 'Premium' : 'Simples'}
                        {budgetValidation.isFallbackSimples && (
                          <span className="text-[10px] opacity-80 font-normal">(Premium Esgotado)</span>
                        )}
                      </span>
                    )}
                  </div>
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

        {canPop && validationType === 'crc' && crcValidation && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full">
                <div className="bg-emerald-500/10 p-2 rounded-full">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="font-display font-bold text-foreground">
                    {crcValidation.crcNome ? `${crcValidation.crcNome} (#${codCrc})` : `CRC #${codCrc}`}
                  </p>
                  <div className="flex flex-col gap-1 mt-1">
                    <p className="text-sm text-muted-foreground font-medium">
                      Saldo: <span className="text-emerald-600 font-bold">{crcValidation.indicacoesDisponiveis} Indicações</span>
                    </p>
                    {nivelPermitido && (
                      <span className={`text-xs w-max px-2 py-0.5 rounded-full font-bold ${
                        nivelPermitido === 'premium' 
                          ? 'bg-amber-500/20 text-amber-600 border border-amber-500/30' 
                          : 'bg-primary/20 text-primary border border-primary/30'
                      }`}>
                        Libera: Balão {nivelPermitido === 'premium' ? 'Simples e Premium' : 'Simples'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ({crcValidation.totalIndicacoes} no período, {crcValidation.indicacoesGastas} já gastas)
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

      <main className={`p-6 ${isRoulette ? 'flex flex-col items-center justify-center min-h-[calc(100vh-200px)]' : 'mx-auto max-w-6xl'}`}>
        {balloonsLoading ? (
          <p className="text-center text-muted-foreground">Carregando {gameConfig.itemNamePlural}...</p>
        ) : isRoulette ? (
          // --- ROULETTE LAYOUT ---
          <div className={`flex flex-col items-center gap-6 w-full max-w-lg mx-auto ${!canPop ? "opacity-50 pointer-events-none" : ""}`}>
            {!canPop && (
              <p className="text-sm text-muted-foreground">
                🔒 Valide um orçamento aprovado para girar a roleta
              </p>
            )}
            {activeBalloon ? (
              <GameItem
                key="roulette-wheel"
                balloon={activeBalloon}
                index={0}
                onPop={() => handlePop(activeBalloon.id)}
                isPopping={popMutation.isPending}
                gameType={gameType}
                totalRemaining={totalRemaining}
                totalItems={totalItems}
                onSpinComplete={handleRouletteSpinComplete}
              />
            ) : (
              <div className="text-center py-12">
                <p className="text-4xl mb-4">🎰</p>
                <p className="font-display text-xl font-bold text-foreground">Todos os giros realizados!</p>
                <p className="text-muted-foreground mt-1">Esta campanha foi encerrada.</p>
              </div>
            )}
          </div>
        ) : (
          // --- GRID LAYOUT (balloon, envelope, heart, chest) ---
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
                  onPop={() => handlePop(balloon.id)}
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
                  {poppedResult.codCrc && (
                    <div className="flex flex-col items-center gap-1 mb-4">
                      <p className="text-sm text-muted-foreground font-bold border border-border inline-block px-4 py-1 rounded-full bg-muted/50">
                        {poppedResult.crcNome ? `${poppedResult.crcNome} (#${poppedResult.codCrc})` : `CRC #${poppedResult.codCrc}`}
                      </p>
                    </div>
                  )}
                  <p className="font-display text-4xl font-bold text-primary">R$ {poppedResult.valor?.toFixed(2)}</p>
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
                  {poppedResult.codCrc && (
                    <div className="flex flex-col items-center gap-1 mb-4">
                      <p className="text-sm text-muted-foreground font-bold border border-border inline-block px-4 py-1 rounded-full bg-muted/50">
                        {poppedResult.crcNome ? `${poppedResult.crcNome} (#${poppedResult.codCrc})` : `CRC #${poppedResult.codCrc}`}
                      </p>
                    </div>
                  )}
                  <p className="text-muted-foreground">Tente outro {gameConfig.itemName} 😊</p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>

      {/* User Search Dialog */}
      <Dialog open={isUserSearchOpen} onOpenChange={setIsUserSearchOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-xl md:w-full">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Buscar Usuário</DialogTitle>
            <DialogDescription>
              Encontre seu código na lista abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="max-h-[400px] overflow-y-auto flex flex-col gap-3 pr-2">
              {usuariosLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : usuariosData?.usuarios?.length ? (
                  usuariosData.usuarios.map((u: any) => {
                    const nome = u.nom_usuario || u.nome || u.Nome || u.nomeUsuario || "Sem Nome";
                    const cod = u.cod_usuario || u.CodUsuario || u.id || u.codigo || "???";
                    
                    return (
                    <Button
                      key={cod}
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3 px-4 rounded-xl border border-border/60 hover:bg-muted/50 hover:border-primary/30 transition-all"
                      onClick={() => {
                        setCodCrc(String(cod));
                        setIsUserSearchOpen(false);
                      }}
                    >
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-bold">{nome}</span>
                        <span className="text-xs text-muted-foreground">Código: {cod}</span>
                      </div>
                    </Button>
                  )})
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum usuário carregado.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
