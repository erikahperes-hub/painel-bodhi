import { store } from '../store.js?v=23';
import { esc } from '../util.js?v=23';
import { ic, flor } from '../icons.js?v=23';
import { montarFeed, ETAPAS_CLIENTE } from '../instagram.js?v=23';

export default {
  titulo: () => 'Prévia do cliente',
  sub: () => 'Assim o cliente vê o conteúdo na página de aprovação.',

  render({ ref }) {
    const c = store.obter('cliente', ref);
    if (!c) return `<div class="card empty">${flor()}<h2>Escolha um cliente</h2><p>Abra a prévia a partir da área Conteúdo, com um cliente selecionado.</p><button class="btn pri" data-act="ir" data-rota="conteudo">Ir para Conteúdo</button></div>`;
    return `<div class="card">
      <div class="card-h"><div><h2>${esc(c.nome)}</h2><p class="sub">Só aparecem as peças que já foram enviadas para aprovação.</p></div>
        <div class="actions"><button class="btn sec sm" data-act="ir" data-rota="conteudo" data-ref="${esc(c.id)}">Voltar ao conteúdo</button>
          <button class="btn pri sm" data-act="link-aprovacao" data-cliente="${esc(c.id)}">${ic('link')}Link de aprovação</button></div></div>
      <div id="ig-previa" data-cliente="${esc(c.id)}"></div></div>`;
  },

  montar(el) {
    const alvo = el.querySelector('#ig-previa');
    const c = alvo && store.obter('cliente', alvo.dataset.cliente);
    if (!c) return;
    const pecas = store.todos('conteudo').filter((p) => p.clienteId === c.id && ETAPAS_CLIENTE.includes(p.etapa));
    montarFeed(alvo, { cliente: c, pecas, previa: true });
  },
};
