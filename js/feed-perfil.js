import { esc, iniciais, dataBR, urlSegura } from './util.js?v=113';
import { ic } from './icons.js?v=113';
import { urlImagem } from './drive.js?v=113';
import { ETAPAS, FORMATOS, etapaDe } from './conteudo.js?v=113';

// Aba "Feed" de Conteúdo: o perfil do cliente simulado como no Instagram (foto, @, números, bio, destaques e grade),
// com as tarefas do Conteúdo nos lugares onde vão aparecer. Serve para a equipe ver como o feed fica, sem abrir a prévia do cliente.
// Só monta HTML; o clique em cada peça abre a edição da tarefa (data-act="editar-peca").

export const FILTROS_FEED = [
  ['tudo', 'Tudo'],
  ['arte', 'Só com arte'],
  ['publicado', 'Publicadas'],
  ['aprovado', 'Aprovadas'],
  ['aprovacao', 'Aguardando aprovação'],
  ['criacao', 'Em criação'],
  ['briefing', 'Planejamento'],
];

const capaId = (p) => p.capa || (p.midias || []).find((m) => m.tipo !== 'video')?.id || (p.midias || []).find((m) => m.tipo === 'video')?.id || '';
const temArte = (p) => !!capaId(p);
const ehStory = (p) => p.formato === 'story';
const num = (n) => (n === null || n === undefined || n === '' || Number.isNaN(Number(n)) ? '–' : Number(n).toLocaleString('pt-BR'));
const CORES_DESTAQUE = ['var(--verde)', 'var(--petroleo)', 'var(--coral)', '#7A5B1E', 'var(--ink-3)'];

function casa(p, filtro) {
  if (filtro === 'tudo') return true;
  if (filtro === 'arte') return temArte(p);
  return (p.etapa || 'briefing') === filtro;
}

const TIPO_FORMATO = { feed: 'Estático', reels: 'Reels', carrossel: 'Carrossel' };

// Publicações que já estão no Instagram e não têm tarefa no painel. Uma tarefa publicada "gasta" a publicação do Instagram
// com a mesma data e o mesmo formato, para a mesma peça não aparecer duas vezes.
function postsDoInstagram(real, doFeed) {
  const lista = [...(real?.posts || [])];
  for (const p of doFeed) {
    if (!p.publicar || (p.etapa || 'briefing') !== 'publicado') continue;
    const i = lista.findIndex((x) => x.data === p.publicar.slice(0, 10) && x.tipo === (TIPO_FORMATO[p.formato] || 'Estático'));
    if (i >= 0) lista.splice(i, 1);
  }
  return lista;
}

function pecaIg(x) {
  const dica = [x.legenda ? x.legenda.replace(/\s+/g, ' ').slice(0, 60) : 'Publicação do Instagram', x.tipo, dataBR(x.data), 'já no Instagram'].join(' · ');
  const icone = x.tipo === 'Reels' ? 'play' : x.tipo === 'Carrossel' ? 'layers' : '';
  return `<a class="fp-t ${x.capa ? '' : 'sem'}" href="${esc(urlSegura(x.link) || '#')}" target="_blank" rel="noopener" data-dica="${esc(dica)}" aria-label="${esc(dica)}">
    ${x.capa ? `<img src="${esc(x.capa)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="fp-sem">${ic('image')}<b>Publicação do Instagram</b></span>`}
    ${icone ? `<span class="fp-ic">${ic(icone)}</span>` : ''}
    <span class="fp-d">${esc(dataBR(x.data).slice(0, 5))}</span>
    <i class="fp-st cor-ok"></i></a>`;
}

function peca(p, i) {
  const f = FORMATOS[p.formato] || FORMATOS.feed;
  const e = etapaDe(p);
  const capa = capaId(p);
  const icone = p.formato === 'reels' ? 'play' : p.formato === 'carrossel' ? 'layers' : '';
  const dica = [p.titulo || '(sem título)', f.nome, e.nome, p.publicar ? dataBR(p.publicar) : 'sem data'].join(' · ');
  return `<button class="fp-t ${capa ? '' : 'sem'}" data-act="editar-peca" data-id="${esc(p.id)}" data-dica="${esc(dica)}" aria-label="${esc(dica)}">
    ${capa ? `<img src="${esc(urlImagem(capa, 480))}" data-id="${esc(capa)}" data-w="480" alt="" loading="lazy">` : `<span class="fp-sem">${ic(f.icone || 'image')}<b>${esc(p.titulo || '(sem título)')}</b></span>`}
    ${icone ? `<span class="fp-ic">${ic(icone)}</span>` : ''}
    <span class="fp-d">${p.publicar ? esc(dataBR(p.publicar).slice(0, 5)) : 'sem data'}</span>
    <i class="fp-st cor-${esc(e.cor)}"></i></button>`;
}

// ctx: { cliente, pecas, seguidores, filtro, aba ('grade' | 'reels'), real, conectado }
// real = perfil lido do Instagram (foto, nome, bio, link e números); quando existe, vale mais que o que foi digitado na ficha do cliente.
export function feedPerfil({ cliente, pecas, seguidores, filtro = 'tudo', aba = 'grade', real = null, conectado = false }) {
  const handle = real?.usuario || String(cliente.instagram || '').replace(/^@/, '').trim() || String(cliente.nome || '').trim();
  const nome = real?.nome || cliente.nome || '';
  const foto = real?.foto || cliente.imagem || '';
  const bio = real?.bio || cliente.bio || '';
  const doFeed = pecas.filter((p) => !ehStory(p));
  const stories = pecas.filter(ehStory);
  const visiveis = doFeed
    .filter((p) => casa(p, filtro) && (aba === 'reels' ? p.formato === 'reels' : true))
    .sort((a, b) => String(b.publicar || '9999-99-99').localeCompare(String(a.publicar || '9999-99-99')));
  // Misturadas por data com as tarefas do painel; aparecem em "Tudo", "Só com arte" e "Publicadas".
  const doIg = ['tudo', 'arte', 'publicado'].includes(filtro) ? postsDoInstagram(real, doFeed).filter((x) => (aba === 'reels' ? x.tipo === 'Reels' : true)) : [];
  const itens = [...visiveis.map((p) => ({ d: String(p.publicar || '9999-99-99'), html: peca(p) })), ...doIg.map((x) => ({ d: x.data, html: pecaIg(x) }))]
    .sort((a, b) => b.d.localeCompare(a.d));
  const destaques = (Array.isArray(cliente.destaques) ? cliente.destaques : String(cliente.destaques || '').split('\n')).map((x) => String(x).trim()).filter(Boolean);
  const site = urlSegura(real?.site || cliente.linkBio);
  const contagem = Object.fromEntries(ETAPAS.map((e) => [e.id, doFeed.filter((p) => (p.etapa || 'briefing') === e.id).length]));

  const perfil = `<div class="fp-tel" role="group" aria-label="Simulação do perfil no Instagram">
      <div class="fp-topo"><b>${esc(handle)}</b><span>${ic('bars')}</span></div>
      <div class="fp-id">
        <span class="fp-av">${foto ? `<img src="${esc(foto)}" alt="" referrerpolicy="no-referrer">` : esc(iniciais(nome))}</span>
        <div class="fp-nums"><div><b>${num(real?.publicacoes ?? doFeed.length)}</b><span>publicações</span></div><div><b>${num(real?.seguidores ?? seguidores)}</b><span>seguidores</span></div><div><b>${num(real?.seguindo ?? cliente.seguindo)}</b><span>seguindo</span></div></div>
      </div>
      <div class="fp-bio"><b>${esc(nome)}</b>
        ${cliente.categoria ? `<span class="fp-cat">${esc(cliente.categoria)}</span>` : ''}
        ${bio ? `<p>${esc(bio).replace(/\n/g, '<br>')}</p>` : '<p class="fp-vazio">Sem bio cadastrada. Use “Editar perfil” para escrever a bio, o link e os destaques.</p>'}
        ${site ? `<a href="${esc(site)}" target="_blank" rel="noopener">${esc(site.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>` : ''}</div>
      ${destaques.length ? `<div class="fp-dest">${destaques.map((d, i) => `<div><span style="background:${CORES_DESTAQUE[i % CORES_DESTAQUE.length]}">${esc(d.slice(0, 1).toUpperCase())}</span><small>${esc(d.length > 11 ? `${d.slice(0, 10)}…` : d)}</small></div>`).join('')}</div>` : ''}
      <div class="fp-abas" role="tablist"><button class="${aba === 'grade' ? 'on' : ''}" data-act="feed-aba" data-aba="grade" aria-label="Grade de publicações" role="tab">${ic('grid')}</button><button class="${aba === 'reels' ? 'on' : ''}" data-act="feed-aba" data-aba="reels" aria-label="Só reels" role="tab">${ic('play')}</button></div>
      ${itens.length ? `<div class="fp-grade">${itens.map((x) => x.html).join('')}</div>` : `<div class="fp-nada">Nenhuma publicação neste filtro.</div>`}
    </div>`;

  const lateral = `<aside class="fp-lado">
      <div class="card">
        <h3>O que mostrar na grade</h3>
        <p class="rl-sub">A grade vai da mais nova (em cima) para a mais antiga, como no Instagram. Toque em uma peça do painel para editar a tarefa; as que já estão no Instagram (bolinha verde) abrem a publicação.</p>
        <div class="cbtns" style="margin-top:8px">${FILTROS_FEED.map(([id, nome]) => `<button class="cbtn ${filtro === id ? 'on' : ''}" data-act="feed-filtro" data-filtro="${id}"><i></i>${esc(nome)}${ETAPAS.some((e) => e.id === id) ? ` · ${contagem[id] || 0}` : ''}</button>`).join('')}</div>
      </div>
      <div class="card">
        <h3>Legenda</h3>
        <div class="fp-leg">${ETAPAS.map((e) => `<span><i class="fp-st cor-${esc(e.cor)}"></i>${esc(e.nome)}</span>`).join('')}</div>
        <p class="rl-sub" style="margin-top:8px">${stories.length ? `${stories.length} ${stories.length === 1 ? 'story fica' : 'stories ficam'} de fora da grade (stories não aparecem no feed).` : 'Stories não aparecem na grade do feed.'} ${doFeed.filter((p) => !temArte(p)).length} ${doFeed.filter((p) => !temArte(p)).length === 1 ? 'peça ainda está' : 'peças ainda estão'} sem arte.</p>
      </div>
      <div class="card">
        <h3>Perfil</h3>
        <p class="rl-sub">${real ? 'Foto, nome, bio, link e números vêm direto do Instagram do cliente. Os destaques o Instagram não libera para nenhum aplicativo, então os nomes são digitados aqui.'
          : conectado ? 'Buscando o perfil no Instagram do cliente. Se não aparecer, toque em “Puxar do Instagram”.'
          : 'Bio, link, destaques e quantos o perfil segue. Conecte o Instagram do cliente (tela Relatório) para a foto, a bio e os números virem sozinhos.'}</p>
        <div class="actions">${conectado ? `<button class="btn sec sm" data-act="feed-puxar" data-cliente="${esc(cliente.id)}">${ic('refresh')}Puxar do Instagram</button>` : ''}<button class="btn sec sm" data-act="feed-perfil" data-cliente="${esc(cliente.id)}">${ic('edit')}${real ? 'Editar destaques' : 'Editar perfil'}</button></div>
      </div></aside>`;

  return `<div class="fp">${perfil}${lateral}</div>`;
}
