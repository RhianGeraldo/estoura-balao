import { supabase } from "@/integrations/supabase/client";

const FUNCTION_NAME = "balloon-api";

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
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchApi(path: string, method: "GET" | "POST" = "GET", body?: any) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FUNCTION_NAME}/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
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
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FUNCTION_NAME}/unidades?id=${id}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API error");
  return data;
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

export async function popBalloon(balloonId: string, codOrcamento?: string) {
  return fetchApi("pop-balloon", "POST", { balloon_id: balloonId, cod_orcamento: codOrcamento });
}

export async function closeAction(actionId: string) {
  return fetchApi("close-action", "POST", { action_id: actionId });
}
