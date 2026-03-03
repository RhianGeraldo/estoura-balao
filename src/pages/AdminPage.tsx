import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createAction, getActiveAction, closeAction, getUnidades, createUnidade, deleteUnidade, type ActionPayload } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PartyPopper, Trophy, Target, DollarSign, XCircle, Building2, Trash2, Plus } from "lucide-react";

const defaultValues: ActionPayload = {
  nome: "",
  orcamento_total: 1000,
  qtd_baloes: 20,
  qtd_premiados: 5,
  valor_multiplo: 10,
  valor_minimo: 50,
  valor_maximo: 500,
};

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ActionPayload>(defaultValues);
  const [unidadeNome, setUnidadeNome] = useState("");
  const [unidadeToken, setUnidadeToken] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["active-action"],
    queryFn: getActiveAction,
    refetchInterval: 5000,
  });

  const { data: unidadesData } = useQuery({
    queryKey: ["unidades"],
    queryFn: getUnidades,
  });

  const createMutation = useMutation({
    mutationFn: createAction,
    onSuccess: () => {
      toast.success("Ação criada e balões gerados com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["active-action"] });
      setForm(defaultValues);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => closeAction(id),
    onSuccess: () => {
      toast.success("Ação encerrada!");
      queryClient.invalidateQueries({ queryKey: ["active-action"] });
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
    const numFields: (keyof ActionPayload)[] = ["orcamento_total", "qtd_baloes", "qtd_premiados", "valor_multiplo", "valor_minimo", "valor_maximo"];
    setForm((f) => ({ ...f, [field]: numFields.includes(field) ? Number(value) : value }));
  };

  const action = data?.action;
  const stats = data?.stats;
  const unidades = unidadesData?.unidades || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <PartyPopper className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-display font-bold text-foreground">Estoura Balão</h1>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">Admin</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6 space-y-6">
        {/* Unidades Section */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Unidades
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {unidades.length > 0 && (
              <div className="space-y-2">
                {unidades.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-2">
                    <span className="font-medium text-foreground">{u.nome}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteUnidadeMutation.mutate(u.id)}
                      disabled={deleteUnidadeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleCreateUnidade} className="flex gap-2 items-end">
              <div className="flex-1">
                <Label htmlFor="unidade-nome">Nome da Unidade</Label>
                <Input id="unidade-nome" value={unidadeNome} onChange={(e) => setUnidadeNome(e.target.value)} placeholder="Ex: Unidade Centro" required />
              </div>
              <div className="flex-1">
                <Label htmlFor="unidade-token">Token da API</Label>
                <Input id="unidade-token" type="password" value={unidadeToken} onChange={(e) => setUnidadeToken(e.target.value)} placeholder="Token de acesso" required />
              </div>
              <Button type="submit" disabled={createUnidadeMutation.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Action Section */}
        {action ? (
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Trophy className="h-5 w-5 text-secondary" />
                Ação Ativa: {action.nome}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={<Target className="h-5 w-5" />} label="Total Balões" value={stats?.total_baloes ?? 0} />
                <StatCard icon={<PartyPopper className="h-5 w-5" />} label="Estourados" value={stats?.estourados ?? 0} />
                <StatCard icon={<DollarSign className="h-5 w-5" />} label="Distribuído" value={`R$ ${(stats?.total_distribuido ?? 0).toFixed(2)}`} />
                <StatCard icon={<DollarSign className="h-5 w-5" />} label="Restante" value={`R$ ${(stats?.orcamento_restante ?? 0).toFixed(2)}`} />
              </div>
              <div className="mt-6 flex justify-end">
                <Button variant="destructive" onClick={() => closeMutation.mutate(action.id)} disabled={closeMutation.isPending}>
                  <XCircle className="mr-2 h-4 w-4" /> Encerrar Ação
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Criar Nova Ação</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="nome">Nome da Ação</Label>
                    <Input id="nome" value={form.nome} onChange={(e) => update("nome", e.target.value)} placeholder="Ex: Campanha de Natal" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="orcamento">Orçamento Total (R$)</Label>
                      <Input id="orcamento" type="number" value={form.orcamento_total} onChange={(e) => update("orcamento_total", e.target.value)} min={1} required />
                    </div>
                    <div>
                      <Label htmlFor="qtd_baloes">Qtd. Balões</Label>
                      <Input id="qtd_baloes" type="number" value={form.qtd_baloes} onChange={(e) => update("qtd_baloes", e.target.value)} min={1} required />
                    </div>
                    <div>
                      <Label htmlFor="qtd_premiados">Qtd. Premiados</Label>
                      <Input id="qtd_premiados" type="number" value={form.qtd_premiados} onChange={(e) => update("qtd_premiados", e.target.value)} min={1} required />
                    </div>
                    <div>
                      <Label htmlFor="valor_multiplo">Valor Múltiplo (R$)</Label>
                      <Input id="valor_multiplo" type="number" value={form.valor_multiplo} onChange={(e) => update("valor_multiplo", e.target.value)} min={1} required />
                    </div>
                    <div>
                      <Label htmlFor="valor_minimo">Valor Mínimo (R$)</Label>
                      <Input id="valor_minimo" type="number" value={form.valor_minimo} onChange={(e) => update("valor_minimo", e.target.value)} min={1} required />
                    </div>
                    <div>
                      <Label htmlFor="valor_maximo">Valor Máximo (R$)</Label>
                      <Input id="valor_maximo" type="number" value={form.valor_maximo} onChange={(e) => update("valor_maximo", e.target.value)} min={1} required />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Gerando Balões..." : "🎈 Gerar Balões"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}
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
