// Função segura que conversa com o Asaas. A chave fica guardada aqui no servidor (segredo ASAAS_API_KEY),
// nunca dentro do site. Só responde para quem está logado no painel.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const PAGO = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
const status = (s: string) => (PAGO.includes(s) ? 'pago' : s === 'PENDING' ? 'pendente' : s === 'OVERDUE' ? 'atrasado' : 'outro');
const iso = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ erro: 'Sem login' }, 401);

  const chave = Deno.env.get('ASAAS_API_KEY');
  if (!chave) return json({ configurado: false });
  const base = Deno.env.get('ASAAS_ENV') === 'sandbox' ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3';

  const asaas = async (caminho: string, init: RequestInit = {}) => {
    const r = await fetch(base + caminho, {
      ...init,
      headers: { 'Content-Type': 'application/json', access_token: chave, 'User-Agent': 'painel-bodhi', ...(init.headers ?? {}) },
    });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(corpo?.errors?.[0]?.description ?? `Asaas respondeu ${r.status}`);
    return corpo;
  };

  try {
    const { acao, ...d } = await req.json();

    if (acao === 'resumo') {
      const hoje = new Date();
      const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      const [mes, atrasadas, clientes] = await Promise.all([
        asaas(`/payments?dueDate[ge]=${iso(ini)}&dueDate[le]=${iso(fim)}&limit=100`),
        asaas('/payments?status=OVERDUE&limit=100'),
        asaas('/customers?limit=100'),
      ]);
      const nomes: Record<string, string> = Object.fromEntries((clientes.data ?? []).map((c: any) => [c.id, c.name]));
      const vistos = new Set<string>();
      const pagamentos = [...(mes.data ?? []), ...(atrasadas.data ?? [])]
        .filter((p: any) => !vistos.has(p.id) && vistos.add(p.id))
        .map((p: any) => ({
          id: p.id, cliente: nomes[p.customer] ?? '', valor: p.value, vencimento: p.dueDate,
          status: status(p.status), descricao: p.description ?? '', link: p.invoiceUrl ?? '',
        }))
        .sort((a: any, b: any) => (a.vencimento < b.vencimento ? 1 : -1));
      const soma = (s: string) => pagamentos.filter((p: any) => p.status === s).reduce((t: number, p: any) => t + p.valor, 0);
      return json({ configurado: true, pagamentos, totais: { recebido: soma('pago'), pendente: soma('pendente'), atrasado: soma('atrasado') } });
    }

    if (acao === 'criar') {
      const { nome, cpfCnpj, valor, vencimento, forma, descricao } = d;
      if (!nome || !valor || !vencimento) return json({ erro: 'Faltam dados da cobrança' }, 400);
      let clienteId: string | undefined;
      if (cpfCnpj) {
        const achados = await asaas(`/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`);
        clienteId = achados.data?.[0]?.id;
      }
      if (!clienteId) clienteId = (await asaas('/customers', { method: 'POST', body: JSON.stringify({ name: nome, cpfCnpj: cpfCnpj || undefined }) })).id;
      const cobranca = await asaas('/payments', {
        method: 'POST',
        body: JSON.stringify({ customer: clienteId, billingType: forma || 'UNDEFINED', value: valor, dueDate: vencimento, description: descricao }),
      });
      return json({ ok: true, id: cobranca.id, link: cobranca.invoiceUrl });
    }

    return json({ erro: 'Ação desconhecida' }, 400);
  } catch (e) {
    return json({ erro: (e as Error).message }, 502);
  }
});
