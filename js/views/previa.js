import { store } from '../store.js?v=75';
import { esc, hojeISO } from '../util.js?v=75';
import { ic, flor } from '../icons.js?v=75';
import { montarFeed, ETAPAS_CLIENTE } from '../instagram.js?v=75';

export default {
  titulo: () => 'Prévia do cliente',
  sub: () => 'Assim o cliente vê o conteúdo na página de aprovação.',

  render({ ref }) {
    const c = store.obter('cliente', ref);
    if (!c) return `<div class="card empty">${flor()}<h2>Escolha um cliente</h2><p>Abra a prévia a partir da área Conteúdo, com um cliente selecionado.</p><button class="btn pri" data-act="ir" data-rota="conteudo">Ir para Conteúdo</button></div>`;
    return `<div class="card">
      <div class="card-h"><div><h2>${esc(c.nome)}</h2><p class="sub">É assim que o cliente vê a página dele. As ideias do Planejamento que ainda não foram enviadas aparecem aqui marcadas como “Ainda não enviado”, só para você conferir.</p></div>
        <div class="actions"><button class="btn sec sm" data-act="ir" data-rota="conteudo" data-ref="${esc(c.id)}">Voltar ao conteúdo</button>
          <button class="btn pri sm" data-act="link-aprovacao" data-cliente="${esc(c.id)}">${ic('link')}Link de aprovação</button></div></div>
      <div id="ig-previa" data-cliente="${esc(c.id)}"></div></div>`;
  },

  montar(el) {
    const alvo = el.querySelector('#ig-previa');
    const c = alvo && store.obter('cliente', alvo.dataset.cliente);
    if (!c) return;
    // Igual ao que o banco entrega ao cliente (função aprovacao_ver): peças enviadas para aprovação do conteúdo ou do planejamento.
    // O roteiro (interno) só vai nas peças enviadas para aprovação do planejamento.
    const noPlano = (p) => ['aprovacao', 'ajustes', 'aprovado'].includes(p.planejamento);
    // Ideias do Planejamento que ainda não foram enviadas: aparecem só aqui, na prévia, marcadas como "Ainda não enviado".
    const rascunho = (p) => p.etapa === 'briefing' && !p.planejamento;
    // Regra do link real: o que espera resposta aparece sempre; o aprovado/publicado, do começo do mês passado em diante
    // (do passado, só se tiver arte).
    const hoje = hojeISO();
    const [a, m] = hoje.split('-').map(Number);
    const inicio = new Date(a, m - 2, 1);
    const inicioISO = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}-01`;
    const temArte = (p) => (p.midias || []).length > 0 || !!p.capa;
    const visivel = (p) => {
      if (['aprovacao', 'ajustes'].includes(p.etapa) || ['aprovacao', 'ajustes'].includes(p.planejamento)) return true;
      if (!(['aprovado', 'publicado'].includes(p.etapa) || p.planejamento === 'aprovado')) return false;
      const d = p.publicar || '';
      return d >= hoje || (d >= inicioISO && temArte(p)) || (p.etapa === 'aprovado' && !d);
    };
    const pecas = store.todos('conteudo')
      .filter((p) => p.clienteId === c.id && (visivel(p) || rascunho(p)))
      .map((p) => (noPlano(p) ? p : rascunho(p) ? { ...p, _rascunho: true, planejamento: '', ajustePlano: '' } : { ...p, roteiro: '', planejamento: '', ajustePlano: '', funil: '' }));
    montarFeed(alvo, { cliente: c, pecas, previa: true });
  },
};
