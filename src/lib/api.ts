// API client for local Express server

export interface ActionPayload {
  nome: string;
  orcamento_total: number;
  qtd_baloes: number;
  qtd_premiados: number;
  valor_multiplo: number;
  valor_minimo: number;
  valor_maximo: number;
}

export interface Action {
  id: string;
  nome: string;
  orcamento_total: number;
  qtd_baloes: number;
  qtd_premiados: number;
  valor_multiplo: number;
  valor_minimo: number;
  valor_maximo: number;
  status: string;
  created_at: string;
}

export interface ActionStats {
  total_baloes: number;
  estourados: number;
  total_distribuido: number;
  orcamento_restante: number;
}

export interface Balloon {
  id: string;
  numero: number;
  estourado: boolean;
  premiado: boolean | null;
  valor: number | null;
  data_estouro: string | null;
}

export interface Unidade {
  id: string;
  nome: string;
  token: string;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchApi(path: string, method: "GET" | "POST" | "DELETE" = "GET", body?: any) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
  const url = `${baseUrl}/api/${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = localStorage.getItem("adminToken");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API error");
  return data;
}

export async function createAction(payload: ActionPayload) {
  return fetchApi("create-action", "POST", payload);
}

export async function getActiveAction(): Promise<{ action: Action | null; stats?: ActionStats }> {
  return fetchApi("active-action", "GET");
}

export async function getBalloons(actionId: string): Promise<{ balloons: Balloon[] }> {
  return fetchApi(`balloons?action_id=${actionId}`, "GET");
}

export async function getUnidades(): Promise<{ unidades: Unidade[] }> {
  return fetchApi("unidades", "GET");
}

export async function createUnidade(nome: string, token: string): Promise<{ unidade: Unidade }> {
  return fetchApi("unidades", "POST", { nome, token });
}

export async function deleteUnidade(id: string) {
  return fetchApi(`unidades?id=${id}`, "DELETE");
}

export async function validateBudget(codOrcamento: string, unidadeId: string): Promise<{
  approved: boolean;
  statusPlano: string;
  cliente: string;
  vendedor: string;
  codOrcamento: number;
}> {
  return fetchApi("validate-budget", "POST", { cod_orcamento: codOrcamento, unidade_id: unidadeId });
}

export async function popBalloon(balloonId: string, codOrcamento?: string, vendedor?: string, cliente?: string) {
  return fetchApi("pop-balloon", "POST", { balloon_id: balloonId, cod_orcamento: codOrcamento, vendedor, cliente });
}

export async function getVendedoresStats(actionId: string): Promise<{ history: { vendedor: string, cliente: string, cod_orcamento: string, valor: number, premiado: boolean, data_estouro: string }[] }> {
  return fetchApi(`vendedores-stats?action_id=${actionId}`, "GET");
}

export async function closeAction(actionId: string) {
  return fetchApi("close-action", "POST", { action_id: actionId });
}

export async function getActions(): Promise<{ actions: (Action & { estourados: number })[] }> {
  return fetchApi("actions", "GET");
}

export async function reopenAction(actionId: string) {
  return fetchApi("reopen-action", "POST", { action_id: actionId });
}

// --- AUTH ---

export async function login(username: string, password: string): Promise<{ token: string, username: string }> {
  return fetchApi("login", "POST", { username, password });
}

export async function getUsers(): Promise<{ users: { id: string, username: string, created_at: string }[] }> {
  return fetchApi("users", "GET");
}

export async function createUser(username: string, password: string) {
  return fetchApi("users", "POST", { username, password });
}

export async function deleteUser(id: string) {
  return fetchApi(`users/${id}`, "DELETE");
}
