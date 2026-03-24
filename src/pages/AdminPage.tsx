import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createAction, getActiveActions, updateAction, closeAction, getUnidades, createUnidade, deleteUnidade, getVendedoresStats, getActions, reopenAction, getUsers, createUser, deleteUser, changePassword, updateUser, type ActionPayload } from "@/lib/api";
import { GAME_TYPE_LIST, getGameTypeConfig } from "@/lib/gameTypes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PartyPopper, Trophy, Target, DollarSign, XCircle, Building2, Trash2, Plus, ChevronDown, ChevronUp, LogOut, User, Edit, CheckCircle } from "lucide-react";

const defaultValues: ActionPayload = {
  nome: "",
  tipo_jogo: "balloon",
  orcamento_total: 1000,
  qtd_baloes: 20,
  qtd_premiados: 5,
  valor_multiplo: 10,
  valor_minimo: 50,
  valor_maximo: 500,
  venda_minima: 0,
  unidades: [],
};

export default function AdminPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<ActionPayload>(defaultValues);
  const [editingAction, setEditingAction] = useState<{ id: string, nome: string, unidades: string[] } | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    navigate("/login");
  };
  const [unidadeNome, setUnidadeNome] = useState("");
  const [unidadeToken, setUnidadeToken] = useState("");

  const { data: activeActionsData, isLoading } = useQuery({
    queryKey: ["active-actions"],
    queryFn: getActiveActions,
    refetchInterval: 5000,
  });

  const { data: unidadesData } = useQuery({
    queryKey: ["unidades"],
    queryFn: getUnidades,
  });
  
  const unidades = unidadesData?.unidades || [];

  const createMutation = useMutation({
    mutationFn: createAction,
    onSuccess: () => {
      const gt = getGameTypeConfig(form.tipo_jogo || "balloon");
      toast.success(`Ação criada e ${gt.itemNamePlural} gerados com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["active-actions"] });
      setForm(defaultValues);
      setIsCreateModalOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => closeAction(id),
    onSuccess: () => {
      toast.success("Ação encerrada!");
      queryClient.invalidateQueries({ queryKey: ["active-actions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; payload: { nome: string; unidades: string[] } }) => updateAction(data.id, data.payload),
    onSuccess: () => {
      toast.success("Ação atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["active-actions"] });
      setEditingAction(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createUnidadeMutation = useMutation({
    mutationFn: () => createUnidade(unidadeNome, unidadeToken),
    onSuccess: () => {
      toast.success("Unidade cadastrada!");
      queryClient.invalidateQueries({ queryKey: ["unidades"] });
      setUnidadeNome("");
      setUnidadeToken("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteUnidadeMutation = useMutation({
    mutationFn: (id: string) => deleteUnidade(id),
    onSuccess: () => {
      toast.success("Unidade removida!");
      queryClient.invalidateQueries({ queryKey: ["unidades"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const handleCreateUnidade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unidadeNome.trim() || !unidadeToken.trim()) return;
    createUnidadeMutation.mutate();
  };

  const update = (field: keyof ActionPayload, value: string) => {
    const numFields: (keyof ActionPayload)[] = ["orcamento_total", "qtd_baloes", "qtd_premiados", "valor_multiplo", "valor_minimo", "valor_maximo", "venda_minima"];
    if (numFields.includes(field)) {
      // Allow empty string so user can clear the input
      if (value === "") {
        setForm((f) => ({ ...f, [field]: "" as unknown as number }));
      } else {
        const val = Number(value);
        if (!isNaN(val)) {
          setForm((f) => ({ ...f, [field]: val }));
        }
      }
    } else {
      setForm((f) => ({ ...f, [field]: value }));
    }
  };

  const budgetStats = (() => {
    const totalBase = form.qtd_premiados * form.valor_minimo;
    const disponivel = form.orcamento_total - totalBase;
    const multiplo = Math.max(1, form.valor_multiplo || 1);
    const sobra = disponivel > 0 ? disponivel % multiplo : 0;
    
    // Sugestão de múltiplo para ser 100% exato (procurando o maior divisor comum entre os "bonitos")
    let sugestao = 1;
    if (disponivel > 0) {
      const common = [100, 50, 25, 20, 10, 5, 2, 1];
      for (const m of common) {
        if (disponivel % m === 0) {
          sugestao = m;
          break;
        }
      }
    }
    
    return { disponivel, sobra, sugestao };
  })();



  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <PartyPopper className="h-8 w-8 text-primary" />
            <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Estoura Balão</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => window.open('/', '_blank')}>
              Ir para o Jogo
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4 mr-1" />
              Sair
            </Button>
            <span className="hidden sm:inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">Admin</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="flex flex-col sm:flex-row w-full max-w-3xl mx-auto h-auto p-1 bg-muted rounded-lg">
            <TabsTrigger value="dashboard" className="w-full sm:w-auto">Ações Ativas</TabsTrigger>
            <TabsTrigger value="history" className="w-full sm:w-auto">Histórico</TabsTrigger>
            <TabsTrigger value="unidades" className="w-full sm:w-auto">Unidades</TabsTrigger>
            <TabsTrigger value="users" className="w-full sm:w-auto">Admins</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Ações Ativas List */}
            {(activeActionsData?.actions || []).length === 0 ? (
              <Card className="border-dashed border-2 bg-muted/30">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <PartyPopper className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <h3 className="font-display text-xl font-bold text-foreground">A festa ainda não começou!</h3>
                  <p className="text-muted-foreground mt-2 max-w-sm mb-6 mx-auto">
                    Nenhuma campanha está rolando no momento. Crie sua primeira ação para engajar seus clientes.
                  </p>
                  <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> Criar Nova Ação
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h2 className="font-display text-2xl font-bold flex items-center gap-2">
                    <Trophy className="h-6 w-6 text-primary" />
                    Campanhas Ativas
                  </h2>
                  <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> Nova Ação
                  </Button>
                </div>
                {(activeActionsData?.actions || []).map(({ action, stats }) => (
                  <Card key={action.id} className="border-2 border-primary/20">
                    <CardHeader>
                      <CardTitle className="font-display flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{getGameTypeConfig(action.tipo_jogo || 'balloon').emoji}</span>
                          <div className="flex flex-col">
                            <span>{action.nome}</span>
                            {action.created_by_name && (
                              <span className="text-xs font-normal text-muted-foreground mt-0.5">🧑‍💼 Criado por: {action.created_by_name}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingAction({ id: action.id, nome: action.nome, unidades: action.unidades?.map((u: any) => u.id) || [] })}>
                            <Edit className="mr-2 h-4 w-4" /> Editar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => closeMutation.mutate(action.id)} disabled={closeMutation.isPending}>
                            <XCircle className="mr-2 h-4 w-4" /> Encerrar Ação
                          </Button>
                        </div>
                      </CardTitle>
                      {action.unidades && action.unidades.length > 0 && (
                        <CardDescription>
                          Unidades participantes: {action.unidades.map(u => u.nome).join(', ')}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                        <StatCard icon={<Target className="h-5 w-5" />} label="Qtd de Itens" value={stats?.total_baloes ?? 0} />
                        <StatCard icon={<PartyPopper className="h-5 w-5" />} label="Abertos" value={stats?.estourados ?? 0} />
                        <StatCard icon={<DollarSign className="h-5 w-5" />} label="Distribuído" value={`R$ ${(stats?.total_distribuido ?? 0).toFixed(2)}`} />
                        <StatCard icon={<DollarSign className="h-5 w-5" />} label="Restante" value={`R$ ${((action.orcamento_total || 0) - (stats?.total_distribuido ?? 0)).toFixed(2)}`} />
                      </div>

                      {/* Popped History and Rankings Section */}
                      <div className="mt-8 pt-6 border-t border-border grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                          <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-yellow-500" />
                            Ranking de Vendedores
                          </h3>
                          <SellerRankings actionId={action.id} />
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                            <PartyPopper className="h-5 w-5 text-primary" />
                            Histórico de Prêmios
                          </h3>
                          <PoppedHistory actionId={action.id} gameType={action.tipo_jogo || 'balloon'} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Modal de Edição */}
                <Dialog open={!!editingAction} onOpenChange={(open) => !open && setEditingAction(null)}>
                  <DialogContent className="sm:max-w-md w-[95vw] rounded-lg p-6">
                    <DialogHeader>
                      <DialogTitle className="font-display">Editar Ação</DialogTitle>
                      <DialogDescription>
                        Altere o nome ou as unidades participantes desta campanha. Os limites financeiros e regras do jogo não podem ser alterados após ativados.
                      </DialogDescription>
                    </DialogHeader>
                    {editingAction && (
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        updateMutation.mutate({ id: editingAction.id, payload: { nome: editingAction.nome, unidades: editingAction.unidades } });
                      }} className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Nome da Ação</Label>
                          <Input value={editingAction.nome} onChange={(e) => setEditingAction({ ...editingAction, nome: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between mb-2 mt-4">
                            <Label>Unidades Participantes <span className="text-red-500">*</span></Label>
                            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                              const allIds = unidades.map((u: any) => u.id) || [];
                              if (editingAction.unidades.length === allIds.length && allIds.length > 0) {
                                setEditingAction({ ...editingAction, unidades: [] });
                              } else {
                                setEditingAction({ ...editingAction, unidades: allIds });
                              }
                            }}>
                              {editingAction.unidades.length === unidades.length && unidades.length > 0 ? "Desmarcar Todas" : "Selecionar Todas"}
                            </Button>
                          </div>
                          {(!unidades || unidades.length === 0) ? (
                            <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md text-center">Nenhuma unidade cadastrada.</div>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {unidades.map((u: any) => (
                                <button key={u.id} type="button" onClick={() => {
                                  const list = editingAction.unidades.includes(u.id) ? editingAction.unidades.filter(id => id !== u.id) : [...editingAction.unidades, u.id];
                                  setEditingAction({ ...editingAction, unidades: list });
                                }} className={`p-2 border rounded-md text-sm transition-all focus:outline-none flex flex-col items-center justify-center gap-1 min-h-[60px] ${editingAction.unidades.includes(u.id) ? "border-primary bg-primary/10 text-primary-foreground font-medium" : "border-border bg-background hover:bg-muted"}`}>
                                  <span className="truncate w-full text-center" title={u.nome}>{u.nome}</span>
                                  {editingAction.unidades.includes(u.id) && <CheckCircle className="h-4 w-4 text-primary shrink-0" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-2">
                          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setEditingAction(null)}>Cancelar</Button>
                          <Button type="submit" className="w-full sm:w-auto" disabled={updateMutation.isPending || editingAction.unidades.length === 0}>
                            {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                          </Button>
                        </div>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Modal de Criação */}
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogContent className="sm:max-w-3xl w-[95vw] rounded-lg p-6 max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl">Criar Nova Ação</DialogTitle>
                </DialogHeader>
                  {isLoading ? (
                    <p className="text-muted-foreground">Carregando...</p>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="nome">Nome da Ação</Label>
                        <Input id="nome" value={form.nome} onChange={(e) => update("nome", e.target.value)} placeholder="Ex: Campanha de Natal" required />
                      </div>

                      <div>
                        <Label>Tipo de Jogo</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                          {GAME_TYPE_LIST.map((gt) => (
                            <button
                              key={gt.id}
                              type="button"
                              onClick={() => setForm((f) => ({ ...f, tipo_jogo: gt.id }))}
                              className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-sm ${
                                form.tipo_jogo === gt.id
                                  ? "border-primary bg-primary/10 shadow-sm"
                                  : "border-border bg-muted/30 hover:border-primary/40"
                              }`}
                            >
                              <span className="text-2xl">{gt.emoji}</span>
                              <span className="font-display font-medium text-foreground">{gt.labelPlural}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Unidades Selector */}
                      <div className="space-y-3 mt-4">
                        <div className="flex items-center justify-between">
                          <Label>Unidades Participantes <span className="text-red-500">*</span></Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              const allIds = unidadesData?.unidades.map((u: any) => u.id) || [];
                              if (form.unidades?.length === allIds.length && allIds.length > 0) {
                                setForm((f) => ({ ...f, unidades: [] }));
                              } else {
                                setForm((f) => ({ ...f, unidades: allIds }));
                              }
                            }}
                          >
                            {form.unidades?.length === (unidadesData?.unidades.length || 0) && (unidadesData?.unidades.length || 0) > 0 ? "Desmarcar Todas" : "Selecionar Todas"}
                          </Button>
                        </div>
                        {(!unidadesData?.unidades || unidadesData.unidades.length === 0) ? (
                          <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md text-center">
                            Nenhuma unidade cadastrada. Adicione unidades na aba "Unidades" primeiro.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {unidadesData.unidades.map((u: any) => {
                              const isSelected = form.unidades?.includes(u.id);
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => {
                                    const current = form.unidades || [];
                                    const next = current.includes(u.id) 
                                      ? current.filter(id => id !== u.id)
                                      : [...current, u.id];
                                    setForm(f => ({ ...f, unidades: next }));
                                  }}
                                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                                    isSelected 
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background text-foreground border-border hover:border-primary/50"
                                  }`}
                                >
                                  {u.nome}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <div>
                          <Label htmlFor="orcamento">Orçamento Total (R$)</Label>
                          <Input id="orcamento" type="number" value={form.orcamento_total ?? ""} onChange={(e) => update("orcamento_total", e.target.value)} min={1} required />
                        </div>
                        <div>
                          <Label htmlFor="qtd_baloes">Qtd. {getGameTypeConfig(form.tipo_jogo || "balloon").labelPlural}</Label>
                          <Input id="qtd_baloes" type="number" value={form.qtd_baloes ?? ""} onChange={(e) => update("qtd_baloes", e.target.value)} min={1} required />
                        </div>
                        <div>
                          <Label htmlFor="qtd_premiados">Qtd. Premiados</Label>
                          <Input id="qtd_premiados" type="number" value={form.qtd_premiados ?? ""} onChange={(e) => update("qtd_premiados", e.target.value)} min={1} required />
                        </div>
                        <div>
                          <Label htmlFor="valor_multiplo">Valor Múltiplo (R$)</Label>
                          <Input id="valor_multiplo" type="number" value={form.valor_multiplo ?? ""} onChange={(e) => update("valor_multiplo", e.target.value)} min={1} required />
                        </div>
                        <div>
                          <Label htmlFor="valor_minimo">Valor Mínimo (R$)</Label>
                          <Input id="valor_minimo" type="number" value={form.valor_minimo ?? ""} onChange={(e) => update("valor_minimo", e.target.value)} min={1} required />
                        </div>
                        <div>
                          <Label htmlFor="valor_maximo">Valor Máximo (R$)</Label>
                          <Input id="valor_maximo" type="number" value={form.valor_maximo ?? ""} onChange={(e) => update("valor_maximo", e.target.value)} min={1} required />
                        </div>
                        <div>
                          <Label htmlFor="venda_minima">Venda Mínima p/ Estourar (R$)</Label>
                          <Input id="venda_minima" type="number" value={form.venda_minima ?? ""} onChange={(e) => update("venda_minima", e.target.value)} min={0} required />
                        </div>
                      </div>

                      {/* Budget Utilization Helper */}
                      <div className={`p-4 rounded-lg border-2 mt-4 transition-all ${budgetStats.sobra === 0 ? 'bg-primary/5 border-primary/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-bold flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Resumo da Distribuição
                          </h4>
                          {budgetStats.sobra === 0 ? (
                            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">100% Exato</span>
                          ) : (
                            <span className="text-[10px] bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Ajuste Sugerido</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs">Total Distribuído</p>
                            <p className="font-bold text-foreground">R$ {(form.orcamento_total - budgetStats.sobra).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Sobra do Orçamento</p>
                            <p className={`font-bold ${budgetStats.sobra > 0 ? 'text-amber-600' : 'text-primary'}`}>R$ {budgetStats.sobra.toFixed(2)}</p>
                          </div>
                        </div>
                        {budgetStats.sobra > 0 && (
                          <div className="mt-3 pt-3 border-t border-amber-500/10">
                            <p className="text-xs text-muted-foreground mb-2">
                              Para usar 100% do orçamento, sugerimos usar um múltiplo de <b>R$ {budgetStats.sugestao}</b>.
                            </p>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              className="h-7 text-xs border-amber-500/30 hover:bg-amber-500/10 text-amber-700"
                              onClick={() => setForm(f => ({ ...f, valor_multiplo: budgetStats.sugestao }))}
                            >
                              Aplicar Sugestão (R$ {budgetStats.sugestao})
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-6">
                        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" className="w-full sm:w-auto" disabled={createMutation.isPending || !form.unidades || form.unidades.length === 0}>
                          {createMutation.isPending ? "Gerando..." : `${getGameTypeConfig(form.tipo_jogo || "balloon").emoji} Gerar ${getGameTypeConfig(form.tipo_jogo || "balloon").labelPlural}`}
                        </Button>
                      </div>
                    </form>
                  )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <ActionHistoryTab />
          </TabsContent>

          <TabsContent value="unidades" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Unidades Autorizadas
                </CardTitle>
                <CardDescription>Gerencie as unidades e seus respectivos tokens da Belle Software.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {unidades.map((unidade) => (
                    <div key={unidade.id} className="rounded-lg border border-border p-4 flex justify-between items-center group bg-card">
                      <div>
                        <h3 className="font-bold text-foreground">{unidade.nome}</h3>
                        <p className="text-xs text-muted-foreground mt-1 truncate max-w-[150px]" title={unidade.token}>
                          Token: {unidade.token.substring(0, 10)}...
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteUnidadeMutation.mutate(unidade.id)}
                        disabled={deleteUnidadeMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleCreateUnidade} className="flex flex-col sm:flex-row gap-4 items-end bg-muted/50 p-4 rounded-lg border border-border">
                  <div className="flex-1 space-y-2 w-full">
                    <Label htmlFor="unidadeNome">Nome da Unidade</Label>
                    <Input id="unidadeNome" value={unidadeNome} onChange={(e) => setUnidadeNome(e.target.value)} placeholder="Ex: Clínica Mantena" required />
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    <Label htmlFor="unidadeToken">Token da API Belle</Label>
                    <Input id="unidadeToken" value={unidadeToken} onChange={(e) => setUnidadeToken(e.target.value)} placeholder="Bearer xxx..." required />
                  </div>
                  <Button type="submit" className="w-full sm:w-auto" disabled={createUnidadeMutation.isPending}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
      <div className="flex justify-center text-primary mb-1">{icon}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-display font-bold text-foreground">{String(value)}</p>
    </div>
  );
}

function SellerRankings({ actionId }: { actionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["vendedores-stats", actionId],
    queryFn: () => getVendedoresStats(actionId),
    refetchInterval: 5000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando ranking...</p>;
  if (!data?.history || data.history.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>;

  // Aggregate history back into stats
  const statsMap = new Map<string, number>();
  data.history.forEach(item => {
    statsMap.set(item.vendedor, (statsMap.get(item.vendedor) || 0) + 1);
  });

  const stats = Array.from(statsMap.entries())
    .map(([vendedor, baloes_estourados]) => ({ vendedor, baloes_estourados }))
    .sort((a, b) => b.baloes_estourados - a.baloes_estourados);

  return (
    <div className="grid grid-cols-1 gap-3">
      {stats.map((stat, index) => (
        <div key={index} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full font-bold shadow-sm ${index === 0 ? "bg-yellow-400 text-yellow-900" : index === 1 ? "bg-slate-300 text-slate-800" : index === 2 ? "bg-amber-600 text-orange-50" : "bg-primary/10 text-primary"}`}>
              {index + 1}º
            </div>
            <span className="font-medium text-sm truncate max-w-[120px]" title={stat.vendedor}>{stat.vendedor}</span>
          </div>
          <span className="font-bold text-primary">{stat.baloes_estourados} {stat.baloes_estourados === 1 ? 'item' : 'itens'}</span>
        </div>
      ))}
    </div>
  );
}

function ActionHistoryTab() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["actions-history"],
    queryFn: getActions,
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => reopenAction(id),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["active-action"] });
      queryClient.invalidateQueries({ queryKey: ["active-actions"] });
      queryClient.invalidateQueries({ queryKey: ["actions-history"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <p className="text-muted-foreground mt-8 text-center">Carregando histórico...</p>;
  if (!data?.actions || data.actions.length === 0) return <p className="text-muted-foreground mt-8 text-center text-lg">Nenhuma campanha foi criada ainda.</p>;

  return (
    <div className="grid gap-4">
      {data.actions.map((act) => (
        <Card key={act.id} className={act.status === "active" ? "border-primary border-2 shadow-md relative" : "opacity-80"}>
          {act.status === "active" && (
            <div className="absolute top-4 right-4 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-bold">
              ATIVA
            </div>
          )}
          <CardHeader>
            <CardTitle>{getGameTypeConfig(act.tipo_jogo).emoji} {act.nome}</CardTitle>
            <CardDescription className="flex flex-col gap-0.5 mt-1">
              <span>Criada em {new Date(act.created_at).toLocaleDateString("pt-BR")}</span>
              {act.created_by_name && (
                <span>🧑‍💼 Criado por: {act.created_by_name}</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 text-sm w-full md:w-auto">
                <div>
                  <p className="text-muted-foreground">{getGameTypeConfig(act.tipo_jogo).labelPlural}</p>
                  <p className="font-bold">{act.estourados || 0} / {act.qtd_baloes}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Orçamento</p>
                  <p className="font-bold">R$ {Number(act.orcamento_total).toFixed(2)}</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-muted-foreground">Prêmio Max</p>
                  <p className="font-bold">R$ {Number(act.valor_maximo).toFixed(2)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <Button
                  variant="ghost"
                  onClick={() => setExpandedId(expandedId === act.id ? null : act.id)}
                  className="w-full sm:w-auto"
                >
                  {expandedId === act.id ? (
                    <><ChevronUp className="h-4 w-4 mr-1" /> Esconder Detalhes</>
                  ) : (
                    <><ChevronDown className="h-4 w-4 mr-1" /> Ver Detalhes</>
                  )}
                </Button>
                {act.status === "closed" && (
                  <Button 
                    variant="outline" 
                    onClick={() => reopenMutation.mutate(act.id)}
                    disabled={reopenMutation.isPending || (act.estourados >= act.qtd_baloes)}
                    title={
                      act.estourados >= act.qtd_baloes 
                        ? "Esta campanha não pode ser reaberta pois todos os itens já foram abertos." 
                        : "Reabrir Campanha"
                    }
                  >
                    Reabrir Campanha
                  </Button>
                )}
              </div>
            </div>

            {expandedId === act.id && (
              <div className="mt-4 pt-6 border-t border-border grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4">
                <div>
                  <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Ranking de Vendedores
                  </h3>
                  <SellerRankings actionId={act.id} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                    <PartyPopper className="h-5 w-5 text-primary" />
                    Histórico de {getGameTypeConfig(act.tipo_jogo).labelPlural}
                  </h3>
                  <PoppedHistory actionId={act.id} gameType={act.tipo_jogo} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PoppedHistory({ actionId, gameType }: { actionId: string, gameType: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["vendedores-stats", actionId],
    queryFn: () => getVendedoresStats(actionId),
    refetchInterval: 5000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando histórico...</p>;
  
  const gt = getGameTypeConfig(gameType);
  if (!data?.history || data.history.length === 0) return <p className="text-sm text-muted-foreground">Nenhum(a) {gt.itemName} {gt.actionVerb.toLowerCase()} ainda.</p>;

  return (
    <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2">
      {data.history.map((item, index) => (
        <div key={index} className="flex flex-col rounded-md border border-border bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-foreground">#{item.cod_orcamento}</span>
            <span className={`font-bold ${item.premiado ? 'text-primary' : 'text-muted-foreground'}`}>
              {item.premiado ? `R$ ${item.valor.toFixed(2)}` : 'Não Premiado'}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="truncate pr-2" title={item.cliente}>Cliente: {item.cliente}</span>
            <span className="whitespace-nowrap font-medium" title={item.vendedor}>{item.vendedor}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function UsersTab() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [editingUser, setEditingUser] = useState<{ id: string, username: string, nome: string } | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editNome, setEditNome] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const queryClient = useQueryClient();
  const loggedUser = localStorage.getItem("adminUser") || "";

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (password.length < 6) throw new Error("A senha deve ter no mínimo 6 caracteres.");
      return createUser(username, password, nome);
    },
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      setUsername("");
      setPassword("");
      setNome("");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const changePwMutation = useMutation({
    mutationFn: () => changePassword(currentPw, newPw),
    onSuccess: (data) => {
      toast.success(data.message);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateUserMutation = useMutation({
    mutationFn: (payload: { username: string, nome: string, password?: string }) => {
      if (payload.password && payload.password.length > 0 && payload.password.length < 6) {
        throw new Error("A nova senha deve ter no mínimo 6 caracteres.");
      }
      return updateUser(editingUser!.id, payload);
    },
    onSuccess: (data: any) => {
      toast.success(data.message);
      setEditingUser(null);
      setEditPassword("");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditNome(user.nome || "");
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) return toast.error("As senhas não coincidem.");
    changePwMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Usuários Administradores</CardTitle>
          <CardDescription>Gerencie quem tem acesso ao painel de controle</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4">
                {data?.users?.map((user: any) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">
                          {user.nome || "Sem Nome"} <span className="font-normal text-muted-foreground text-sm">({user.username})</span>
                        </p>
                        <p className="text-xs text-muted-foreground border-t border-border/50 pt-1 mt-1">
                          Criado em {new Date(user.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10" onClick={() => handleOpenEdit(user)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => { if (confirm("Deseja apagar este administrador?")) deleteMutation.mutate(user.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="flex flex-col sm:flex-row gap-4 items-end bg-muted/50 p-4 rounded-lg border border-border">
                <div className="flex-1 space-y-2 w-full">
                  <Label htmlFor="newNome">Nome Completo</Label>
                  <Input id="newNome" placeholder="Ex: João Silva" value={nome} onChange={(e) => setNome(e.target.value)} required />
                </div>
                <div className="flex-1 space-y-2 w-full">
                  <Label htmlFor="newUsername">E-mail / Usuário</Label>
                  <Input id="newUsername" type="email" placeholder="admin@email.com" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div className="flex-1 space-y-2 w-full">
                  <Label htmlFor="newPassword">Senha</Label>
                  <Input id="newPassword" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full sm:w-auto" disabled={createMutation.isPending}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </form>
            </div>
          )}

          <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Editar Administrador</DialogTitle>
                <DialogDescription>Altere os dados de acesso do administrador selecionado.</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                updateUserMutation.mutate({
                  username: editUsername,
                  nome: editNome,
                  password: editPassword || undefined
                });
              }} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="editNome">Nome Completo</Label>
                  <Input id="editNome" value={editNome} onChange={(e) => setEditNome(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editUsername">E-mail / Usuário</Label>
                  <Input id="editUsername" type="email" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editPassword">Nova Senha (opcional)</Label>
                  <Input id="editPassword" type="password" placeholder="Deixe em branco para manter a atual" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
                  <Button type="submit" disabled={updateUserMutation.isPending}>
                    {updateUserMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Alterar Minha Senha</CardTitle>
          <CardDescription>Você está logado como <strong>{loggedUser}</strong></CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div className="space-y-2">
              <Label htmlFor="currentPw">Senha Atual</Label>
              <Input id="currentPw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPw">Nova Senha</Label>
              <Input id="newPw" type="password" placeholder="Mínimo 6 caracteres" value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPw">Confirmar Nova Senha</Label>
              <Input id="confirmPw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
            </div>
            <Button type="submit" disabled={changePwMutation.isPending}>
              Alterar Senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
