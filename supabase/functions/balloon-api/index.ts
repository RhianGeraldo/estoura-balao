import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateBalloonValues(
  orcamentoTotal: number,
  qtdPremiados: number,
  valorMultiplo: number,
  valorMinimo: number,
  valorMaximo: number
): number[] {
  const values = new Array(qtdPremiados).fill(valorMinimo);
  let saldoRestante = orcamentoTotal - qtdPremiados * valorMinimo;

  let attempts = 0;
  const maxAttempts = 10000;

  while (saldoRestante > 0 && attempts < maxAttempts) {
    attempts++;
    const idx = Math.floor(Math.random() * qtdPremiados);
    if (values[idx] + valorMultiplo <= valorMaximo) {
      values[idx] += valorMultiplo;
      saldoRestante -= valorMultiplo;
    }
  }

  return values;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/balloon-api\/?/, "");

  try {
    // POST /create-action - Create action + generate balloons
    if (req.method === "POST" && path === "create-action") {
      const body = await req.json();
      const { nome, orcamento_total, qtd_baloes, qtd_premiados, valor_multiplo, valor_minimo, valor_maximo } = body;

      // Validations
      if (qtd_premiados > qtd_baloes) {
        return new Response(JSON.stringify({ error: "Quantidade de premiados não pode ser maior que total de balões" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (qtd_premiados * valor_minimo > orcamento_total) {
        return new Response(JSON.stringify({ error: "Orçamento insuficiente para os valores mínimos" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (valor_minimo > valor_maximo) {
        return new Response(JSON.stringify({ error: "Valor mínimo não pode ser maior que valor máximo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create action
      const { data: action, error: actionError } = await supabase
        .from("actions")
        .insert({ nome, orcamento_total, qtd_baloes, qtd_premiados, valor_multiplo, valor_minimo, valor_maximo })
        .select()
        .single();

      if (actionError) throw actionError;

      // Generate prize values
      const prizeValues = generateBalloonValues(orcamento_total, qtd_premiados, valor_multiplo, valor_minimo, valor_maximo);

      // Create balloon records
      const balloons = [];
      const prizeIndices = new Set<number>();
      while (prizeIndices.size < qtd_premiados) {
        prizeIndices.add(Math.floor(Math.random() * qtd_baloes));
      }

      const prizeIdxArray = Array.from(prizeIndices);
      let prizeCounter = 0;

      for (let i = 0; i < qtd_baloes; i++) {
        const isPrize = prizeIdxArray.includes(i);
        balloons.push({
          action_id: action.id,
          numero: i + 1,
          valor: isPrize ? prizeValues[prizeCounter] : 0,
          premiado: isPrize,
        });
        if (isPrize) prizeCounter++;
      }

      const { error: balloonError } = await supabase.from("balloons").insert(balloons);
      if (balloonError) throw balloonError;

      return new Response(JSON.stringify({ action, balloons_created: qtd_baloes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /active-action - Get active action with stats
    if (req.method === "GET" && path === "active-action") {
      const { data: action, error } = await supabase
        .from("actions")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!action) {
        return new Response(JSON.stringify({ action: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get stats
      const { data: balloons } = await supabase
        .from("balloons")
        .select("valor, premiado, estourado")
        .eq("action_id", action.id);

      const stats = {
        total_baloes: balloons?.length || 0,
        estourados: balloons?.filter((b) => b.estourado).length || 0,
        total_distribuido: balloons?.filter((b) => b.estourado && b.premiado).reduce((sum, b) => sum + Number(b.valor), 0) || 0,
        orcamento_restante: action.orcamento_total - (balloons?.filter((b) => b.estourado && b.premiado).reduce((sum, b) => sum + Number(b.valor), 0) || 0),
      };

      return new Response(JSON.stringify({ action, stats }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /balloons?action_id=xxx - List balloons for action
    if (req.method === "GET" && path === "balloons") {
      const actionId = url.searchParams.get("action_id");
      if (!actionId) {
        return new Response(JSON.stringify({ error: "action_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: balloons, error } = await supabase
        .from("balloons")
        .select("id, numero, estourado, premiado, valor, data_estouro")
        .eq("action_id", actionId)
        .order("numero");

      if (error) throw error;

      // Hide prize info for unpopped balloons
      const safeBalloons = balloons?.map((b) => ({
        ...b,
        valor: b.estourado ? b.valor : null,
        premiado: b.estourado ? b.premiado : null,
      }));

      return new Response(JSON.stringify({ balloons: safeBalloons }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /validate-budget - Validate budget code against external API
    if (req.method === "POST" && path === "validate-budget") {
      const { cod_orcamento } = await req.json();
      if (!cod_orcamento) {
        return new Response(JSON.stringify({ error: "cod_orcamento é obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const today = new Date();
      const dtFim = today.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      const startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 6);
      const dtInicio = startDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

      const apiUrl = `https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/venda_planos?codEstab=1&dtInicio=${dtInicio}&dtFim=${dtFim}&codOrcamento=${cod_orcamento}`;

      const apiRes = await fetch(apiUrl);
      if (!apiRes.ok) {
        return new Response(JSON.stringify({ error: "Erro ao consultar API externa" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const apiData = await apiRes.json();
      const planos = Array.isArray(apiData) ? apiData : [apiData];
      const plano = planos.find((p: any) => String(p.codOrcamento) === String(cod_orcamento));

      if (!plano) {
        return new Response(JSON.stringify({ error: "Orçamento não encontrado", approved: false }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const approved = plano.statusPlano === "Aprovado";
      return new Response(JSON.stringify({
        approved,
        statusPlano: plano.statusPlano,
        cliente: plano.cliente,
        vendedor: plano.vendedor,
        codOrcamento: plano.codOrcamento,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /pop-balloon - Pop a balloon
    if (req.method === "POST" && path === "pop-balloon") {
      const { balloon_id, user_id, cod_orcamento } = await req.json();

      // Check if already popped
      const { data: balloon, error: fetchError } = await supabase
        .from("balloons")
        .select("*")
        .eq("id", balloon_id)
        .single();

      if (fetchError) throw fetchError;
      if (balloon.estourado) {
        return new Response(JSON.stringify({ error: "Balão já estourado!", balloon }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Pop balloon
      const { data: updated, error: updateError } = await supabase
        .from("balloons")
        .update({ estourado: true, user_id: cod_orcamento || user_id || null, data_estouro: new Date().toISOString() })
        .eq("id", balloon_id)
        .select()
        .single();

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ balloon: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /close-action - Close an action
    if (req.method === "POST" && path === "close-action") {
      const { action_id } = await req.json();

      const { data, error } = await supabase
        .from("actions")
        .update({ status: "closed" })
        .eq("id", action_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ action: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
