import { store } from '../store.js?v=30';
import { esc, toast, dataBR, urlSegura, hojeISO, mesNome, norm, slug } from '../util.js?v=30';
import { ic, flor } from '../icons.js?v=30';
import { formulario, confirmar, abrirModal } from '../ui.js?v=30';
import { ETAPAS, FORMATOS, etapaDe, atrasada, pecas } from '../conteudo.js?v=30';
import { idDrive, urlAbrir } from '../drive.js?v=30';

const RESPONSAVEIS = ['Érika', 'Milena'];
const PUBLICADAS_VISIVEIS = 10;

// O que fazer em cada etapa: [etapa de destino, texto do botão, estilo].
const PROXIMOS = {
  briefing: [['criacao', 'Iniciar criação']],
  criacao: [['aprovacao', 'Enviar para aprovação']],
  aprovacao: [['aprovado', 'Cliente aprovou', 'verde'], ['ajustes', 'Pediu ajuste', 'sec']],
  ajustes: [['aprovacao', 'Reenviar para aprovação']],
  aprovado: [['publicado', 'Marcar como publicado']],
  publicado: [],
};

const clientesDeTrabalho = () => store.todos('cliente')
  .filter((c) => c.status !== 'inativo')
  .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));

function abrirPeca(p = null, padrao = {}) {
  const clientes = clientesDeTrabalho();
  const atual = p ? store.obter('cliente', p.clienteId) : null;
  if (atual && !clientes.includes(atual)) clientes.push(atual);
  formulario({
    titulo: p ? 'Editar peça' : 'Nova peça de conteúdo',
    subtitulo: 'Cada post, carrossel, reels ou story do cliente vira uma peça acompanhada daqui.',
    largo: true,
    campos: [
      { nome: 'clienteId', rotulo: 'Cliente', tipo: 'select', obrigatorio: true, opcoes: [{ v: '', t: 'Escolha o cliente' }, ...clientes.map((c) => ({ v: c.id, t: c.nome || '(sem nome)' }))] },
      { nome: 'titulo', rotulo: 'Título da peça', obrigatorio: true, placeholder: 'Ex.: Post de lançamento da coleção' },
      { nome: 'formato', rotulo: 'Formato', tipo: 'select', opcoes: Object.entries(FORMATOS).map(([v, f]) => ({ v, t: f.nome })) },
      { nome: 'etapa', rotulo: 'Etapa', tipo: 'select', opcoes: ETAPAS.map((e) => ({ v: e.id, t: e.nome })) },
      { nome: 'publicar', rotulo: 'Data de publicação', tipo: 'data' },
      { nome: 'responsavel', rotulo: 'Responsável', tipo: 'select', opcoes: [{ v: '', t: 'Sem responsável' }, ...RESPONSAVEIS.map((r) => ({ v: r, t: r }))] },
      { nome: 'legenda', rotulo: 'Legenda', tipo: 'area', cheio: true, linhas: 6, ajuda: 'É o texto que o cliente vai ver junto com a arte na hora de aprovar.' },
      { nome: 'secao', tipo: 'secao', rotulo: 'Arquivos para o cliente aprovar' },
      { nome: 'midias', rotulo: 'Arquivos da peça', tipo: 'midias', cheio: true, ajuda: 'Cole o link de cada arquivo da pasta de aprovação no Drive. Carrossel: uma imagem por linha, na ordem dos slides. Reels e story em vídeo: escolha “Vídeo”.' },
      { nome: 'capa', rotulo: 'Capa (imagem)', cheio: true, placeholder: 'Link da imagem de capa no Drive', ajuda: 'Aparece na grade do feed e antes de o vídeo tocar. Se vazio, usa a primeira imagem.' },
      { nome: 'link', rotulo: 'Link do arquivo editável (uso interno)', cheio: true, placeholder: 'Canva, Drive ou onde estiver', ajuda: 'Só vocês veem. Não aparece para o cliente.' },
      { nome: 'ajuste', rotulo: 'Pedido de ajuste do cliente', tipo: 'area', cheio: true, linhas: 3, ajuda: 'O que o cliente pediu para mudar. Aparece em destaque no cartão enquanto estiver em Ajustes.' },
      { nome: 'briefing', rotulo: 'Briefing e observações internas', tipo: 'area', cheio: true, linhas: 3 },
    ],
    valores: p ? { ...p, ...padrao, capa: p.capa ? urlAbrir(p.capa) : '' } : { etapa: 'briefing', formato: 'feed', ...padrao },
    async aoSalvar(v) {
      if (v.link && !urlSegura(v.link)) { toast('O link precisa começar com http:// ou https://', true); return false; }
      if (v.capa && !idDrive(v.capa)) { toast('A capa precisa ser um link de arquivo do Google Drive.', true); return false; }
      await store.salvar('conteudo', { ...(p || { criadoEm: new Date().toISOString() }), ...v, link: urlSegura(v.link), capa: idDrive(v.capa) });
      toast('Peça salva');
    },
    aoExcluir: p ? async (m) => {
      if (await confirmar(`Excluir a peça “${p.titulo}”?`, 'Excluir', true)) { await store.remover('conteudo', p.id); m.fechar(); toast('Peça excluída'); }
    } : null,
  });
}

// Botões do topo do cartão, iguais nas abas Status e Calendário.
function botoesCabecalho(filtro) {
  return `<div class="actions">${filtro ? `<button class="btn sec sm" data-act="ir" data-rota="previa" data-ref="${esc(filtro)}">${ic('image')}Prévia do cliente</button><button class="btn sec sm" data-act="link-aprovacao" data-cliente="${esc(filtro)}">${ic('link')}Link de aprovação</button>` : ''}
    <button class="btn sec sm" data-act="adicionar-lote">${ic('upload')}Adicionar em lote</button>
    <button class="btn pri sm" data-act="nova-peca" data-cliente="${esc(filtro)}">${ic('plus')}Nova peça</button>
    <input type="file" accept="application/json,.json" hidden data-lote></div>`;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// "Adicionar em lote": lê um arquivo de peças (preparado pelo Claude) e cria as que ainda não existem.
// O arquivo pode trazer o cliente pelo nome ("clienteNome": "TRE Clinic") ou pelo código. Aceita
// { "pecas": [ ... ] } ou o formato de backup { "registros": [ { "kind": "conteudo", ... } ] }.
// Só entram campos de peça conhecidos, e o que já existe só tem campos vazios preenchidos (nada que vocês editaram é apagado).
async function adicionarEmLote(arquivo) {
  const brutas = [
    ...(Array.isArray(arquivo?.registros) ? arquivo.registros.filter((r) => r?.kind === 'conteudo' && r.data).map((r) => ({ ...r.data, id: r.id || r.data.id })) : []),
    ...(Array.isArray(arquivo?.pecas) ? arquivo.pecas : []),
  ].filter((p) => p && typeof p === 'object');
  if (!brutas.length) throw new Error('Este arquivo não tem peças para adicionar.');

  const clientes = store.todos('cliente');
  const achar = (p) => {
    const porId = store.obter('cliente', p.clienteId);
    if (porId) return porId;
    const nome = norm(p.clienteNome || '');
    const iguais = nome ? clientes.filter((c) => norm(c.nome) === nome) : [];
    return iguais.length === 1 ? iguais[0] : null;
  };
  const semCliente = new Set();
  const validas = [];
  for (const p of brutas) {
    const c = achar(p);
    if (!c) { semCliente.add(String(p.clienteNome || p.clienteId || '(sem cliente)')); continue; }
    const titulo = String(p.titulo || '').trim() || '(sem título)';
    const publicar = DATA_ISO.test(p.publicar || '') ? p.publicar : '';
    validas.push({
      id: String(p.id || `lote-${c.id}-${publicar || 'sem-data'}-${slug(titulo)}`),
      clienteId: c.id,
      titulo,
      formato: FORMATOS[p.formato] ? p.formato : 'feed',
      etapa: ETAPAS.some((e) => e.id === p.etapa) ? p.etapa : 'criacao',
      publicar,
      legenda: String(p.legenda || ''),
      midias: (Array.isArray(p.midias) ? p.midias : []).map((m) => ({ tipo: m?.tipo === 'video' ? 'video' : 'imagem', id: idDrive(m?.id || m?.url) })).filter((m) => m.id),
      capa: idDrive(p.capa),
      ajuste: String(p.ajuste || ''),
      briefing: String(p.briefing || ''),
      responsavel: RESPONSAVEIS.includes(p.responsavel) ? p.responsavel : '',
      link: urlSegura(p.link),
      criadoEm: new Date().toISOString(),
    });
  }
  if (!validas.length) throw new Error(`Nenhuma peça tem cliente cadastrado no painel (${[...semCliente].join(', ')}). Confira o nome do cliente no arquivo.`);

  const novas = validas.filter((r) => !store.obter('conteudo', r.id)).length;
  const jaExistem = validas.length - novas;
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const aviso = [
    `Adicionar ${plural(novas, 'peça nova', 'peças novas')}?`,
    jaExistem ? `${plural(jaExistem, 'já existe', 'já existem')}: só campos vazios serão preenchidos, sem apagar o que vocês editaram.` : '',
    semCliente.size ? `Ignoradas por cliente não encontrado: ${[...semCliente].join(', ')}.` : '',
  ].filter(Boolean).join(' ');
  if (!(await confirmar(aviso, 'Adicionar'))) return;
  await store.importar({ registros: validas.map((d) => ({ kind: 'conteudo', id: d.id, data: d, mesclar: 'preencher' })) });
  toast(novas ? `${plural(novas, 'peça adicionada', 'peças adicionadas')}` : 'Nada novo para adicionar');
}

function cartao(p, mostrarCliente) {
  const f = FORMATOS[p.formato] || FORMATOS.feed;
  const cli = store.obter('cliente', p.clienteId);
  const meta = [mostrarCliente ? (cli?.nome || 'Cliente removido') : '', p.publicar ? dataBR(p.publicar).slice(0, 5) : 'Sem data', p.responsavel].filter(Boolean).join(' · ');
  const atras = atrasada(p);
  const botoes = (PROXIMOS[p.etapa] || []).map(([para, texto, estilo]) => `<button class="btn ${estilo || 'sec'} sm" data-act="mover-peca" data-id="${p.id}" data-para="${para}">${esc(texto)}</button>`).join('');
  return `<div class="peca">
    <div class="actions" style="gap:6px"><span class="chip info">${ic(f.icone)}${esc(f.nome)}</span>${atras ? '<span class="chip warn">Atrasada</span>' : ''}${p.link && urlSegura(p.link) ? `<a class="chip mute" href="${esc(urlSegura(p.link))}" target="_blank" rel="noopener noreferrer" title="Abrir a arte">${ic('file')}Arte</a>` : ''}</div>
    <button class="peca-t" data-act="editar-peca" data-id="${p.id}">${esc(p.titulo || '(sem título)')}</button>
    <div class="peca-m">${esc(meta)}</div>
    ${p.etapa === 'ajustes' && p.ajuste ? `<div class="peca-aj">${esc(p.ajuste)}</div>` : ''}
    ${botoes ? `<div class="peca-a">${botoes}</div>` : ''}
  </div>`;
}

// Visão escolhida (Status ou Calendário) e mês mostrado no calendário; valem até recarregar a página.
let aba = 'status';
let mesCal = null;
const recarregarTela = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const isoDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function blocoPeca(p, mostrarCliente) {
  const f = FORMATOS[p.formato] || FORMATOS.feed;
  const e = etapaDe(p);
  const cli = store.obter('cliente', p.clienteId)?.nome || '';
  return `<button class="cal-p cor-${e.cor}${atrasada(p) ? ' atras' : ''}" data-act="editar-peca" data-id="${p.id}" title="${esc([p.titulo, cli, f.nome, e.nome].filter(Boolean).join(' · '))}">
    ${ic(f.icone)}<span><b>${esc(p.titulo || '(sem título)')}</b>${mostrarCliente && cli ? `<small>${esc(cli)}</small>` : ''}</span></button>`;
}

function calendario({ filtro, lista, chipsClientes }) {
  const hoje = hojeISO();
  const ym = mesCal || hoje.slice(0, 7);
  const [a, m] = ym.split('-').map(Number);
  const nomeMes = mesNome(m - 1);
  const primeiroDia = new Date(a, m - 1, 1).getDay();
  const semanas = Math.ceil((primeiroDia + new Date(a, m, 0).getDate()) / 7);
  const porDia = {};
  lista.forEach((p) => { if (p.publicar) (porDia[p.publicar.slice(0, 10)] ||= []).push(p); });
  const semData = lista.filter((p) => !p.publicar && p.etapa !== 'publicado');

  const celulas = Array.from({ length: semanas * 7 }, (_, i) => {
    const d = new Date(a, m - 1, 1 - primeiroDia + i);
    const iso = isoDia(d);
    const pecasDia = porDia[iso] || [];
    return `<div class="dia${d.getMonth() !== m - 1 ? ' fora' : ''}${iso === hoje ? ' hoje' : ''}">
      <div class="dia-h"><b>${d.getDate()}</b><button class="dia-add" data-act="nova-peca" data-data="${iso}" data-cliente="${esc(filtro)}" aria-label="Nova peça em ${dataBR(iso)}" title="Nova peça neste dia">+</button></div>
      ${pecasDia.map((p) => blocoPeca(p, !filtro)).join('')}</div>`;
  }).join('');

  return `<div class="card">
    <div class="card-h"><div><h2>${filtro ? esc(store.obter('cliente', filtro).nome) : 'Todos os clientes'}</h2><p class="sub">Cada peça aparece no dia da publicação. Clique em uma peça para abrir ou no + de um dia para criar.</p></div>
      ${botoesCabecalho(filtro)}</div>
    <div class="cbtns" style="margin-bottom:16px">${chipsClientes}</div>
    <div class="toolbar" style="margin-bottom:12px">
      <div class="mes"><button class="iconbtn" data-act="cal-mes" data-passo="-1" aria-label="Mês anterior"><span style="display:grid;transform:scaleX(-1)">${ic('chev')}</span></button>
        <b>${nomeMes[0].toUpperCase()}${nomeMes.slice(1)} de ${a}</b><button class="iconbtn" data-act="cal-mes" data-passo="1" aria-label="Próximo mês">${ic('chev')}</button>
        ${ym !== hoje.slice(0, 7) ? '<button class="btn ghost sm" data-act="cal-mes" data-passo="0">Mês atual</button>' : ''}</div>
      <div class="legenda">${ETAPAS.filter((e) => e.id !== 'publicado').map((e) => `<span class="chip cor-${e.cor}">${esc(e.nome)}</span>`).join('')}<span class="chip cor-mute">Publicado</span></div>
    </div>
    <div class="calbox"><div class="calgrid">${DIAS_SEMANA.map((d) => `<div class="dow">${d}</div>`).join('')}${celulas}</div></div>
    ${semData.length ? `<div class="semdata"><h3>Sem data de publicação</h3><p class="lbl">Abra a peça e escolha a data para ela aparecer no calendário.</p><div class="semdata-l">${semData.map((p) => blocoPeca(p, !filtro)).join('')}</div></div>` : ''}
  </div>`;
}

function ordenarPecas(lista, recentesPrimeiro = false) {
  const dir = recentesPrimeiro ? -1 : 1;
  return [...lista].sort((a, b) => {
    if (!a.publicar && !b.publicar) return 0;
    if (!a.publicar) return 1;
    if (!b.publicar) return -1;
    return dir * a.publicar.localeCompare(b.publicar);
  });
}

export default {
  titulo: () => 'Conteúdo',
  sub: () => 'O que está sendo criado para cada cliente e em que etapa está cada peça.',

  render({ ref }) {
    const clientes = clientesDeTrabalho();
    if (!clientes.length) {
      return `<div class="card empty">${flor()}<h2>Cadastre um cliente primeiro</h2><p>As peças de conteúdo ficam ligadas a um cliente. Cadastre o cliente e volte aqui.</p><button class="btn pri" data-act="ir" data-rota="clientes">Ir para Clientes</button></div>`;
    }
    const filtro = store.obter('cliente', ref) ? ref : '';
    const todas = pecas();
    const lista = filtro ? todas.filter((p) => p.clienteId === filtro) : todas;
    const em = (...ids) => lista.filter((p) => ids.includes(p.etapa));

    const chipsClientes = [`<button class="cbtn ${filtro ? '' : 'on'}" data-act="ir" data-rota="conteudo">Todos · ${todas.length}</button>`,
      ...clientes.map((c) => `<button class="cbtn ${c.id === filtro ? 'on' : ''}" data-act="ir" data-rota="conteudo" data-ref="${c.id}"><i></i>${esc(c.nome || '(sem nome)')} · ${todas.filter((p) => p.clienteId === c.id).length}</button>`)].join('');

    const abas = `<div class="tabs" role="tablist" aria-label="Visões de conteúdo">
      <button class="tab ${aba === 'status' ? 'on' : ''}" role="tab" aria-selected="${aba === 'status'}" data-act="aba-conteudo" data-aba="status">${ic('grid')}Status</button>
      <button class="tab ${aba === 'calendario' ? 'on' : ''}" role="tab" aria-selected="${aba === 'calendario'}" data-act="aba-conteudo" data-aba="calendario">${ic('calendar')}Calendário</button></div>`;
    if (aba === 'calendario') return abas + calendario({ filtro, lista, chipsClientes });

    const colunas = ETAPAS.map((e) => {
      let itens = e.id === 'publicado' ? ordenarPecas(em(e.id), true) : ordenarPecas(em(e.id));
      const total = itens.length;
      if (e.id === 'publicado') itens = itens.slice(0, PUBLICADAS_VISIVEIS);
      return `<section class="kol" aria-label="${esc(e.nome)}">
        <div class="kol-h"><span>${esc(e.nome)}</span><b class="chip ${e.chip}">${total}</b></div>
        ${itens.map((p) => cartao(p, !filtro)).join('') || '<div class="kol-vazio">Nada aqui</div>'}
        ${total > itens.length ? `<div class="kol-vazio">E mais ${total - itens.length} publicadas</div>` : ''}
      </section>`;
    }).join('');

    return abas + `<div class="grid" style="margin-bottom:16px">
        <div class="card stat tone-verde"><div><div class="lbl">Em produção</div><div class="big num">${em('briefing', 'criacao').length}</div><div class="hint">Briefing e criação</div></div><span class="stat-ic">${ic('grid')}</span></div>
        <div class="card stat tone-creme"><div><div class="lbl">Aguardando aprovação</div><div class="big num">${em('aprovacao').length}</div><div class="hint">Com o cliente</div></div><span class="stat-ic">${ic('send')}</span></div>
        <div class="card stat tone-coral"><div><div class="lbl">Pedidos de ajuste</div><div class="big num">${em('ajustes').length}</div><div class="hint">Para refazer</div></div><span class="stat-ic">${ic('edit')}</span></div>
        <div class="card stat tone-coral"><div><div class="lbl">Atrasadas</div><div class="big num">${lista.filter(atrasada).length}</div><div class="hint">Passaram da data de publicação</div></div><span class="stat-ic">${ic('calendar')}</span></div>
      </div>

      <div class="card">
        <div class="card-h"><div><h2>${filtro ? esc(store.obter('cliente', filtro).nome) : 'Todos os clientes'}</h2><p class="sub">${lista.length} ${lista.length === 1 ? 'peça' : 'peças'} no total</p></div>
          ${botoesCabecalho(filtro)}</div>
        <div class="cbtns" style="margin-bottom:16px">${chipsClientes}</div>
        ${lista.length ? `<div class="kanban">${colunas}</div>` : `<div class="empty" style="padding:30px 10px">${flor()}<h2>Nenhuma peça ainda</h2><p>Use “Nova peça” para registrar o primeiro post, carrossel, reels ou story.</p></div>`}
      </div>`;
  },

  montar(el) {
    el.querySelector('[data-lote]')?.addEventListener('change', async (ev) => {
      const f = ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      try { await adicionarEmLote(JSON.parse(await f.text())); } catch (err) { toast(err instanceof SyntaxError ? 'Este arquivo não é válido.' : (err.message || 'Não foi possível adicionar.'), true); }
    });
  },

  acoes: {
    'adicionar-lote': () => document.querySelector('[data-lote]')?.click(),
    'link-aprovacao': async (el) => {
      const c = store.obter('cliente', el.dataset.cliente);
      if (!c) return;
      const montar = (token) => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}aprovar.html#${token}`;
      let url = montar(await store.linkAprovacao(c.id));
      const m = abrirModal({
        titulo: `Link de aprovação: ${c.nome}`,
        subtitulo: 'Envie este link ao cliente. Ele vê só as peças dele (as que estão em “Aguardando aprovação” ou depois) e não precisa de senha.',
        corpo: `<div class="field"><label for="link-ap">Link do cliente</label><input id="link-ap" readonly value="${esc(url)}"></div>
          <p class="lbl" style="margin-top:10px">Quem tem este link consegue ver e aprovar as peças de ${esc(c.nome)}. Se ele for parar em mãos erradas, gere um novo: o antigo deixa de funcionar.</p>
          <div class="modal-f"><button class="btn ghost danger" data-renovar>Gerar novo link</button><div class="actions"><button class="btn sec" data-fechar-link>Fechar</button><button class="btn pri" data-copiar>${ic('link')}Copiar link</button></div></div>`,
      });
      const campo = m.el.querySelector('#link-ap');
      campo.addEventListener('focus', () => campo.select());
      m.el.querySelector('[data-fechar-link]').onclick = () => m.fechar();
      m.el.querySelector('[data-copiar]').onclick = async () => {
        try { await navigator.clipboard.writeText(campo.value); toast('Link copiado'); } catch { campo.select(); toast('Selecionei o link: use Ctrl+C para copiar'); }
      };
      m.el.querySelector('[data-renovar]').onclick = async () => {
        if (!(await confirmar('Gerar um novo link? O link atual deixa de funcionar e você precisa enviar o novo ao cliente.', 'Gerar novo link', true))) return;
        url = montar(await store.linkAprovacao(c.id, true));
        campo.value = url;
        toast('Novo link gerado');
      };
    },
    'aba-conteudo': (el) => { aba = el.dataset.aba === 'calendario' ? 'calendario' : 'status'; recarregarTela(); },
    'cal-mes': (el) => {
      const passo = Number(el.dataset.passo);
      if (!passo) mesCal = null;
      else {
        const [a, m] = (mesCal || hojeISO().slice(0, 7)).split('-').map(Number);
        const d = new Date(a, m - 1 + passo, 1);
        mesCal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      recarregarTela();
    },
    'nova-peca': (el) => abrirPeca(null, { ...(el.dataset.cliente ? { clienteId: el.dataset.cliente } : {}), ...(el.dataset.data ? { publicar: el.dataset.data } : {}) }),
    'editar-peca': (el) => abrirPeca(store.obter('conteudo', el.dataset.id)),
    'mover-peca': async (el) => {
      const p = store.obter('conteudo', el.dataset.id);
      if (!p) return;
      // Ao pedir ajuste, abre a ficha para já anotar o que o cliente pediu.
      if (el.dataset.para === 'ajustes') { abrirPeca(p, { etapa: 'ajustes' }); return; }
      await store.salvar('conteudo', { ...p, etapa: el.dataset.para });
      toast(`Movida para ${etapaDe({ etapa: el.dataset.para }).nome}`);
    },
  },
};
