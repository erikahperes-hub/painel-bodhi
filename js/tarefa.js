import { store } from './store.js?v=206';
import { esc, toast, dataBR, urlSegura, diasAte } from './util.js?v=206';
import { ic } from './icons.js?v=206';
import { confirmar, abrirGaveta, abrirModal } from './ui.js?v=206';
import { ETAPAS, FORMATOS, REDES, atrasada } from './conteudo.js?v=206';
import { idDrive, avisoLinkDrive, urlAbrir, urlImagem } from './drive.js?v=206';
import { escolherDaPasta } from './drive-escolher.js?v=206';
import { prepararGoogle, tokenValido, entrarGoogle, pastaDestino, enviarArquivo, nomeDoArquivo } from './drive-envio.js?v=206';

// Ficha da tarefa de conteúdo. Pensada para o dia a dia de quem cria posts:
//  - em cima, o caminho da tarefa (planejamento até publicado) com o próximo passo em destaque;
//  - à esquerda, o conteúdo (ideia e roteiro, legenda, arquivos);
//  - à direita, a prévia do post, o essencial (responsável, data, cliente) e a conversa da equipe.
// A classificação (formato, funil e rede) fica recolhida numa linha só, para não poluir.
// Tudo se salva sozinho quando a pessoa muda algo; uma tarefa nova só é criada ao clicar em "Criar tarefa".
// Comentários e atividade ficam na própria tarefa (campos `comentarios` e `atividade`).

const RESPONSAVEIS = ['Érika', 'Milena'];
const FUNIL = { topo: 'Topo de funil', meio: 'Meio de funil', fundo: 'Fundo de funil' };
// Mostra o quadro de ajuste só enquanto há o que fazer: na etapa Ajustes, ou com pedido antigo em etapa de trabalho.
const mostraAjuste = (t) => t.etapa === 'ajustes' || !!(t.ajuste && !['aprovacao', 'aprovado', 'publicado'].includes(t.etapa));
const PLANO = { '': 'Não enviado ao cliente', aprovacao: 'Aguardando aprovação do cliente', ajustes: 'Alteração pedida pelo cliente', aprovado: 'Aprovado pelo cliente' };
const LIMITE_LEGENDA = 2200; // limite de caracteres da legenda no Instagram
// Próximo passo em cada etapa: [etapa de destino, texto do botão, estilo].
const PROXIMOS = {
  briefing: [['criacao', 'Iniciar criação']],
  criacao: [['aprovacao', 'Enviar para aprovação']],
  aprovacao: [['aprovado', 'Cliente aprovou', 'verde'], ['ajustes', 'Pediu ajuste', 'sec']],
  ajustes: [['aprovacao', 'Reenviar para aprovação']],
  aprovado: [['publicado', 'Marcar como publicado']],
  publicado: [],
};
const APELIDOS = { erika: 'Érika', 'erika hollengschwandtner': 'Érika', 'milena oliveira': 'Milena', milena: 'Milena' };

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const primeiroNome = (n) => APELIDOS[norm(n)] || String(n || '').trim().split(/\s+/)[0] || 'Equipe';
const inicial = (n) => (primeiroNome(n)[0] || '?').toUpperCase();
const quem = () => {
  const nome = store.nomeUsuario();
  if (nome) return primeiroNome(nome);
  const mail = (store.emailUsuario() || '').split('@')[0];
  return mail ? primeiroNome(mail.charAt(0).toUpperCase() + mail.slice(1)) : 'Equipe';
};
const quando = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const links = (t) => esc(t).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u.length > 60 ? `${u.slice(0, 57)}…` : u}</a>`);
const crescer = (el) => { el.style.height = 'auto'; el.style.height = `${Math.max(el.scrollHeight, 44)}px`; };
const contar = (txt) => `${String(txt || '').length.toLocaleString('pt-BR')} de ${LIMITE_LEGENDA.toLocaleString('pt-BR')}`;

export function abrirTarefa(p = null, padrao = {}) {
  let id = p?.id || '';
  let rascunho = p ? null : { etapa: 'briefing', formato: 'feed', midias: [], ...padrao };
  let classeAberta = false;
  let ativAberta = false;
  let fila = Promise.resolve();
  const pendentes = new Map(); // campos de texto esperando para salvar
  const timers = {};
  let g;

  const atual = () => (id ? store.obter('conteudo', id) : null) || rascunho || {};
  const clientes = () => {
    const lista = store.todos('cliente').filter((c) => c.status !== 'inativo').sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
    const dele = store.obter('cliente', atual().clienteId);
    if (dele && !lista.includes(dele)) lista.push(dele);
    return lista;
  };
  const nomeEtapa = (e) => ETAPAS.find((x) => x.id === e)?.nome || e;
  // As tarefas do mesmo cliente na ordem da data: serve para o "anterior" e "próxima".
  const vizinhas = () => {
    const t = atual();
    if (!id || !t.clienteId) return [];
    return store.todos('conteudo').filter((x) => x.clienteId === t.clienteId && (!x.arquivada || t.arquivada))
      .sort((a, b) => String(a.publicar || '9999').localeCompare(String(b.publicar || '9999')) || String(a.titulo || '').localeCompare(String(b.titulo || '')));
  };

  // O círculo de concluir, como no calendário: vazio quando em aberto, verde com o visto quando concluída.
  const marca = (t) => {
    const on = !!t.concluida;
    return `<span class="ft-chk-w"><button type="button" class="ft-chk${on ? ' on' : ''}" data-t="concluir" aria-pressed="${on}" ${id ? '' : 'disabled'} title="${id ? (on ? 'Concluída. Clique para reabrir' : 'Marcar como concluída') : 'Crie a tarefa primeiro'}" aria-label="${on ? 'Tarefa concluída' : 'Marcar tarefa como concluída'}">${ic('check')}</button><span class="ft-chk-l">${on ? 'Concluída' : 'Concluir'}</span></span>`;
  };

  // ---------- partes da tela ----------
  const topo = (t) => {
    const lista = vizinhas();
    const pos = lista.findIndex((x) => x.id === id);
    const nav = lista.length > 1 ? `<span class="ft-nav"><button type="button" class="iconbtn ft-ib" data-t="viz" data-v="-1" aria-label="Tarefa anterior" title="Tarefa anterior (Alt + ←)" ${pos <= 0 ? 'disabled' : ''}><span class="ft-seta e">${ic('chev')}</span></button><button type="button" class="iconbtn ft-ib" data-t="viz" data-v="1" aria-label="Próxima tarefa" title="Próxima tarefa (Alt + →)" ${pos >= lista.length - 1 ? 'disabled' : ''}><span class="ft-seta d">${ic('chev')}</span></button></span>` : '';
    return `<header class="ft-top">
      <div class="ft-id">
        ${eyebrow(t)}
        <div class="ft-linha">${marca(t)}<input class="ft-titulo" data-campo="titulo" value="${esc(t.titulo || '')}" placeholder="Título da tarefa" aria-label="Título da tarefa" maxlength="200"></div>
      </div>
      <div class="ft-topo-d"><span class="ft-salvo" data-salvo aria-live="polite"></span>${id ? `<button type="button" class="btn pri sm ft-env" data-t="enviar" title="Gera o link para o cliente aprovar só esta tarefa">${ic('send')}<span>Enviar ao cliente</span></button>` : ''}${nav}${id ? `<button type="button" class="iconbtn ft-ib" data-t="arquivar" aria-label="${atual().arquivada ? 'Restaurar tarefa' : 'Arquivar tarefa'}" title="${atual().arquivada ? 'Restaurar tarefa (volta para o quadro e o calendário)' : 'Arquivar tarefa (some do quadro, do calendário e do feed, e dá para restaurar)'}">${ic('arquivo')}</button>` : ''}${id ? `<button type="button" class="iconbtn ft-ib" data-t="excluir" aria-label="Excluir tarefa" title="Excluir tarefa">${ic('trash')}</button>` : ''}<button type="button" class="iconbtn ft-ib" data-t="fechar" aria-label="Fechar" title="Fechar (Esc)">${ic('x')}</button></div>
    </header>`;
  };

  // O caminho da tarefa: cada etapa é um passo; o atual fica em destaque e o próximo passo vira botão.
  const jornada = (t) => {
    const at = ETAPAS.findIndex((e) => e.id === t.etapa);
    const on = !!t.concluida;
    const proximos = (PROXIMOS[t.etapa] || []).map(([para, texto, estilo]) => `<button type="button" class="btn ${estilo || 'pri'} sm" data-t="etapa" data-v="${para}">${esc(texto)}</button>`).join('');
    return `<div class="ft-jor">
      <ol class="ft-passos" aria-label="Caminho da tarefa">${ETAPAS.map((e, i) => `<li class="${i < at ? 'feito' : i === at ? 'atual' : ''}"><button type="button" data-t="etapa" data-v="${e.id}" aria-current="${i === at ? 'step' : 'false'}" title="Mover para ${esc(e.nome)}"><i>${i < at ? ic('check') : i + 1}</i><span>${esc(e.nome)}</span></button></li>`).join('')}</ol>
      <div class="ft-acoes">${proximos}</div>
    </div>`;
  };

  const miniatura = (m, i) => `<div class="ft-th" data-i="${i}"><img src="${esc(urlImagem(m.id, 320))}" data-id="${esc(m.id)}" alt="" loading="lazy"><span class="ft-th-t">${m.tipo === 'video' ? ic('play') : ''}${i + 1}</span><button type="button" class="ft-th-x" data-t="rm-midia" data-i="${i}" aria-label="Remover arquivo ${i + 1}">${ic('x')}</button><a class="ft-th-a" href="${esc(urlAbrir(m.id))}" target="_blank" rel="noopener noreferrer" aria-label="Abrir arquivo ${i + 1} no Drive"></a></div>`;

  // Vídeo, capa e arte, cada um no seu lugar. Reels e story: vídeo e capa. Carrossel e estático: a arte.
  const arquivos = (t) => {
    const ms = t.midias || [];
    const iv = ms.findIndex((m) => m.tipo === 'video');
    const video = iv >= 0 ? ms[iv] : null;
    const imagens = ms.map((m, i) => ({ ...m, i })).filter((m) => m.tipo !== 'video');
    const vertical = t.formato === 'reels' || t.formato === 'story';
    const carrossel = t.formato === 'carrossel';
    const botao = (acao, rot, extra = '') => `<button type="button" class="ft-slot-b" data-t="${acao}" ${extra}>${rot}</button>`;
    const abrir = (id) => `<a class="ft-slot-b" href="${esc(urlAbrir(id))}" target="_blank" rel="noopener noreferrer">Abrir</a>`;
    const vazio = (slot, icone, rot, dica) => `<button type="button" class="ft-slot vazio" data-t="slot" data-slot="${slot}">${ic(icone)}<span class="ft-slot-c"><b>${rot}</b><span>${dica}</span></span></button>`;
    const cheio = (id, rot, sobre, acoes) => `<div class="ft-slot cheio"><div class="ft-slot-img"><img src="${esc(urlImagem(id, 240))}" data-id="${esc(id)}" alt="" loading="lazy">${sobre}</div><div class="ft-slot-c"><b>${rot}</b><div class="ft-slot-a">${acoes}</div></div></div>`;
    const slotVideo = video
      ? cheio(video.id, 'Vídeo', `<span class="ft-slot-p">${ic('play')}</span>`, `${botao('slot', 'Trocar', 'data-slot="video"')}${abrir(video.id)}${botao('rm-midia', 'Tirar', `data-i="${iv}"`)}`)
      : vazio('video', 'play', 'Vídeo', 'Escolher da pasta do Drive');
    const slotCapa = t.capa
      ? cheio(t.capa, 'Capa', '', `${botao('slot', 'Trocar', 'data-slot="capa"')}${abrir(t.capa)}${botao('rm-capa', 'Tirar')}`)
      : vazio('capa', 'image', 'Capa', 'Escolher da pasta do Drive');
    const miniArte = (m, k) => `<div class="ft-th" data-i="${m.i}"><img src="${esc(urlImagem(m.id, 320))}" data-id="${esc(m.id)}" alt="" loading="lazy"><span class="ft-th-t">${k + 1}</span><button type="button" class="ft-th-x" data-t="rm-midia" data-i="${m.i}" aria-label="Tirar a arte ${k + 1}">${ic('x')}</button><a class="ft-th-a" href="${esc(urlAbrir(m.id))}" target="_blank" rel="noopener noreferrer" aria-label="Abrir a arte ${k + 1} no Drive"></a></div>`;
    const slotArte = `<div class="ft-slot arte"><div class="ft-slot-ti"><b>${carrossel ? 'Slides do carrossel' : 'Arte'}</b>${imagens.length ? `<span class="ft-n">${imagens.length}</span>` : ''}${botao('slot', imagens.length ? (carrossel ? 'Adicionar mais' : 'Trocar') : 'Escolher da pasta do Drive', 'data-slot="arte"')}</div>${imagens.length ? `<div class="ft-ths">${imagens.map(miniArte).join('')}</div>` : `<p class="ft-slot-d">${carrossel ? 'Um arquivo por slide, na ordem em que o cliente vai ver.' : 'A imagem do post.'}</p>`}</div>`;
    const partes = vertical ? `${slotVideo}${slotCapa}${imagens.length ? slotArte : ''}` : `${video ? slotVideo : ''}${slotArte}`;
    return `<div class="ft-slots">${partes}</div>
      <details class="ft-mais ft-outro"><summary>Colar link ou enviar do computador</summary>
        <div class="ft-add"><select data-nova="tipo" aria-label="O que é o arquivo">${vertical ? '<option value="video">Vídeo</option><option value="capa">Capa</option>' : '<option value="imagem">Arte</option><option value="video">Vídeo</option>'}</select><input data-nova="url" placeholder="Cole o link do arquivo no Drive e aperte Enter" aria-label="Link do arquivo no Drive"><button type="button" class="btn sec sm" data-t="add-midia">${ic('plus')}Adicionar</button></div>
        <div class="ft-add ft-add-pc"><button type="button" class="btn sec sm" data-t="enviar-pc" title="Envia a arte ou o vídeo do computador para a pasta do cliente no Drive (pede login do Google)">${ic('upload')}Enviar do computador ao Drive</button><input type="file" data-envio hidden multiple accept="image/*,video/*"><button type="button" class="btn ghost sm" data-t="enviar-capa" title="Envia a capa do computador para o Drive (pede login do Google)">${ic('upload')}Enviar capa</button><input type="file" data-envio-capa hidden accept="image/*"><span class="ft-envio-st" data-envio-st aria-live="polite"></span></div>
      </details>`;
  };

  // Anexos da equipe (briefing, referências, contrato, print, PDF...): vão para o armazenamento do próprio painel (Supabase Storage,
  // bucket "anexos"), sem login do Google. Só a equipe vê. A lista fica na tarefa, no campo `anexos`.
  const LIMITE_ANEXO = 50 * 1024 * 1024;
  const tamanho = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round((n || 0) / 1024))} KB`);
  const iconeAnexo = (a) => (/^image\//.test(a.tipo || '') ? 'image' : /^video\//.test(a.tipo || '') ? 'play' : 'doc');
  const anexosSecao = (t) => {
    const lista = t.anexos || [];
    const item = (a) => `<li><span class="ft-anx-ic">${ic(iconeAnexo(a))}</span><button type="button" class="ft-anx-n" data-t="abrir-anexo" data-id="${esc(a.id)}" title="Abrir ou baixar"><b>${esc(a.nome)}</b><small>${esc(tamanho(a.tam))} · ${esc(primeiroNome(a.por))} · ${esc(quando(a.em))}</small></button><button type="button" class="ft-anx-x" data-t="rm-anexo" data-id="${esc(a.id)}" aria-label="Remover ${esc(a.nome)}" title="Remover">${ic('x')}</button></li>`;
    return `<section class="ft-s ft-anx" data-anexos>
      <div class="ft-h"><h3>Anexos${lista.length ? ` <span class="ft-n">${lista.length}</span>` : ''}</h3><span class="ft-h-d"><button type="button" class="btn sec sm" data-t="anexar">${ic('upload')}Anexar arquivo</button></span></div>
      <input type="file" data-anexo-in hidden multiple>
      ${lista.length ? `<ul class="ft-anx-l">${lista.map(item).join('')}</ul>` : '<p class="ft-anx-v">Arraste arquivos para cá ou use o botão. Serve para briefing, referência, contrato, print e PDF.</p>'}
      <small class="ft-envio-st" data-anexo-st aria-live="polite"></small>
      <p class="ft-ajuda">Só a equipe vê. Até 50 MB por arquivo. A arte e o vídeo que o cliente aprova continuam no Drive.</p></section>`;
  };

  const previa = (t) => {
    const ms = t.midias || [];
    const capa = t.capa || ms.find((m) => m.tipo !== 'video')?.id || ms[0]?.id || '';
    const f = FORMATOS[t.formato] || FORMATOS.feed;
    const vertical = t.formato === 'reels' || t.formato === 'story';
    const cli = store.obter('cliente', t.clienteId);
    return `<div class="ft-prev${vertical ? ' vert' : ''}">
      <div class="ft-prev-arte">${capa ? `<img src="${esc(urlImagem(capa, 640))}" data-id="${esc(capa)}" alt="Prévia da arte">` : `<div class="ft-prev-vazio">${ic(f.icone)}<b>Sem arte ainda</b><span>Escolha em “Arquivos”.</span></div>`}${ms.length > 1 ? `<span class="ft-prev-n">1/${ms.length}</span>` : ''}${t.formato === 'reels' && capa ? `<span class="ft-prev-p">${ic('play')}</span>` : ''}</div>
      <div class="ft-prev-leg"><b>${esc(cli?.nome || 'cliente')}</b> ${esc((t.legenda || '').slice(0, 140)) || '<em>Sem legenda ainda</em>'}${(t.legenda || '').length > 140 ? '…' : ''}</div>
    </div>`;
  };

  // Em cima do título: primeiro o cliente, depois a classificação (formato, funil e rede) em chips que abrem o editor.
  const eyebrow = (t) => {
    const f = FORMATOS[t.formato] || FORMATOS.feed;
    const cli = store.obter('cliente', t.clienteId);
    const chip = (cls, txt) => `<button type="button" class="chip ${cls} ft-chipb" data-t="classe" title="Alterar a classificação" aria-expanded="${classeAberta}">${txt}</button>`;
    const falta = (nome) => `<button type="button" class="chip ft-add-c" data-t="classe" title="Adicionar ${nome.toLowerCase()}">+ ${nome}</button>`;
    return `<div class="ft-eyebrow"><span class="ft-cli">${esc(cli?.nome || 'Escolha o cliente')}</span><span class="ft-pontos">${chip(`fm-${FORMATOS[t.formato] ? t.formato : 'feed'}`, `${ic(f.icone)}${esc(f.nome)}`)}${FUNIL[t.funil] ? chip('mute', esc(FUNIL[t.funil])) : falta('Funil')}${REDES[t.rede] ? chip(`rd-${t.rede}`, esc(REDES[t.rede].nome)) : falta('Rede')}<button type="button" class="ft-lapis" data-t="classe" aria-label="Alterar a classificação" title="Alterar a classificação">${ic('edit')}</button></span></div>`;
  };

  // Seletores de formato, funil e rede: ficam escondidos e só abrem quando a pessoa clica nos chips.
  const editor = (t) => {
    if (!classeAberta) return '';
    // O item escolhido aparece com a mesma cor do chip lá em cima (e um contorno), igual às cores do calendário.
    const pill = (nome, v, texto, cor, icone = '') => {
      const sel = String(v) === String(t[nome] || (nome === 'formato' ? 'feed' : ''));
      return `<button type="button" class="ft-pill${sel ? ` sel ${cor}` : ''}" data-t="set" data-n="${nome}" data-v="${esc(v)}" aria-pressed="${sel}">${icone}${esc(texto)}</button>`;
    };
    return `<div class="ft-ed">
      <div><span class="ft-rot">Formato</span><div class="ft-pills">${Object.entries(FORMATOS).map(([v, f]) => pill('formato', v, f.nome, `fm-${v}`, ic(f.icone))).join('')}</div></div>
      <div><span class="ft-rot">Etapa do funil</span><div class="ft-pills">${Object.entries(FUNIL).map(([v, n]) => pill('funil', v, n.replace(' de funil', ''), 'mute')).join('')}</div></div>
      <div><span class="ft-rot">Rede</span><div class="ft-pills">${Object.entries(REDES).map(([v, r]) => pill('rede', v, r.nome, `rd-${v}`)).join('')}</div></div>
    </div>`;
  };

  const detalhes = (t) => {
    const atras = atrasada(t);
    const d = t.publicar ? diasAte(t.publicar) : null;
    const dica = !t.publicar ? '' : atras ? '<span class="chip warn">Atrasada</span>' : d === 0 ? '<span class="chip info">Hoje</span>' : '';
    return `<dl class="ft-det">
      <div><dt>Responsável</dt><dd class="ft-pills">${RESPONSAVEIS.map((r) => `<button type="button" class="ft-pill${t.responsavel === r ? ' on' : ''}" data-t="set" data-n="responsavel" data-v="${r}" aria-pressed="${t.responsavel === r}"><i class="ft-av">${inicial(r)}</i>${esc(r)}</button>`).join('')}</dd></div>
      <div><dt>Publicar em</dt><dd><input type="date" data-campo="publicar" value="${esc(t.publicar || '')}" aria-label="Data de publicação">${dica}</dd></div>
      <div><dt>Cliente</dt><dd><select data-campo="clienteId" aria-label="Cliente"><option value="">Escolha o cliente</option>${clientes().map((c) => `<option value="${esc(c.id)}"${c.id === t.clienteId ? ' selected' : ''}>${esc(c.nome || '(sem nome)')}</option>`).join('')}</select></dd></div>
    </dl>`;
  };

  // Arte e arquivos num lugar só (lado direito): prévia do post, miniaturas, campo para adicionar e opções extras.
  const arte = (t) => `<section class="ft-arte"><h3>Arquivos</h3><div data-arquivos>${arquivos(t)}</div><details class="ft-mais ft-vprev"><summary>Ver como fica no feed</summary><div data-previa>${previa(t)}</div></details>
    <details class="ft-mais"><summary>Mais opções</summary>
      <label class="ft-lbl" for="ft_link">Arquivo editável (só a equipe vê)</label><input id="ft_link" data-campo="link" value="${esc(t.link || '')}" placeholder="Canva, Drive ou onde estiver">
      <label class="ft-lbl" for="ft_video">Vídeo no Drive (só a equipe vê)</label><input id="ft_video" data-campo="videoDrive" value="${esc(t.videoDrive || '')}" placeholder="Link do vídeo no Drive">
      <label class="ft-lbl" for="ft_ig">Link do post no Instagram</label><input id="ft_ig" data-campo="igLink" value="${esc(t.igLink || '')}" placeholder="https://www.instagram.com/p/…">
      <label class="ft-ck"><input type="checkbox" data-collab ${t.collab ? 'checked' : ''}><span>Collab: outro perfil postou e nos chamou de colaborador (sem arquivo nosso). Se a gente postou, não marque.</span></label>
    </details></section>`;

  // Aprovação da ideia e do roteiro pelo cliente (antes de produzir). A equipe só envia ou cancela o envio;
  // "alteração pedida" e "aprovado" vêm da resposta do cliente no link dele.
  const planoLinha = (t) => {
    const v = t.planejamento || '';
    const botao = (para, texto, cls = 'sec') => `<button type="button" class="btn ${cls} sm" data-t="plano" data-v="${para}">${esc(texto)}</button>`;
    if (v === 'aprovacao') return `<span class="chip info">${ic('send')}Ideia enviada, aguardando o cliente</span>${botao('', 'Cancelar envio', 'ghost')}`;
    if (v === 'ajustes') return `<span class="chip warn">${ic('alert')}O cliente pediu alteração</span>${botao('aprovacao', 'Reenviar ao cliente')}`;
    if (v === 'aprovado') return `<span class="chip ok">${ic('check')}Ideia aprovada pelo cliente</span>${botao('', 'Desfazer', 'ghost')}`;
    return `${botao('aprovacao', 'Enviar ideia para o cliente aprovar')}<span class="ft-ajuda-l">O cliente lê a ideia e o roteiro no link dele. Só envie depois de revisar o texto.</span>`;
  };

  const esquerda = (t) => {
    const ajustes = mostraAjuste(t);
    const ajustesPlano = t.planejamento === 'ajustes' || (t.ajustePlano && !['aprovacao', 'aprovado'].includes(t.planejamento || ''));
    return `
      ${ajustes ? `<section class="ft-s ft-alerta"><h3>${ic('alert')}O cliente pediu ajuste</h3><textarea data-campo="ajuste" rows="2" placeholder="O que o cliente pediu para mudar">${esc(t.ajuste || '')}</textarea></section>` : ''}
      ${ajustesPlano ? `<section class="ft-s ft-alerta"><h3>${ic('alert')}Alteração pedida no planejamento</h3><textarea data-campo="ajustePlano" rows="2" placeholder="O que o cliente pediu para mudar na ideia ou no roteiro">${esc(t.ajustePlano || '')}</textarea></section>` : ''}
      <section class="ft-s"><h3>Ideia e roteiro</h3><textarea data-campo="roteiro" rows="4" placeholder="Qual é a ideia? Como é o vídeo, cena a cena? Quando o planejamento é enviado para aprovação, o cliente lê este texto: escreva sem comentário interno.">${esc(t.roteiro || '')}</textarea><div class="ft-plano" data-plano>${planoLinha(t)}</div></section>
      <section class="ft-s"><div class="ft-h"><h3>Legenda</h3><span class="ft-h-d"><small class="ft-cont" data-cont>${contar(t.legenda)}</small><button type="button" class="btn ghost sm" data-t="copiar">${ic('link')}Copiar</button></span></div><textarea data-campo="legenda" rows="4" placeholder="Texto que o cliente vê junto com a arte na hora de aprovar.">${esc(t.legenda || '')}</textarea></section>
      ${t.id || id ? anexosSecao(t) : ''}`;
  };

  // Comentários em destaque; os fixados ficam no alto (é para onde vão os combinados que não podem se perder).
  // O que mudou na tarefa (etapa, responsável, data...) fica recolhido, para não poluir.
  const conversa = (t) => {
    const coms = [...(t.comentarios || [])].sort((x, y) => String(x.d).localeCompare(String(y.d)));
    const fixados = coms.filter((c) => c.fixado);
    const resto = coms.filter((c) => !c.fixado);
    // Histórico: o que a equipe mudou (etapa, responsável, data...) junto com o que o cliente fez no link dele
    // (aprovou, pediu alteração e o que pediu, com dia e hora). Os mais recentes primeiro.
    const ativ = (t.atividade || []).map((a) => ({ d: a.d, a: a.a, t: a.t, tipo: 'equipe' }));
    if (t.criadoEm && !ativ.some((a) => a.t === 'criou esta tarefa')) ativ.push({ d: t.criadoEm, a: '', t: 'Tarefa criada', tipo: 'equipe' });
    for (const h of t.historico || []) {
      const plano = String(h.acao || '').startsWith('plano_');
      const aprovou = h.acao === 'aprovar' || h.acao === 'plano_aprovar';
      const ajustou = h.acao === 'ajustar' || h.acao === 'plano_ajustar';
      if (!aprovou && !ajustou) continue;
      ativ.push({ d: h.quando, a: 'Cliente', tipo: aprovou ? 'ok' : 'ajuste', detalhe: h.comentario || '',
        t: aprovou ? (plano ? 'aprovou a ideia do planejamento' : 'aprovou o conteúdo') : (plano ? 'pediu alteração na ideia do planejamento' : 'pediu alteração') });
    }
    ativ.sort((x, y) => String(y.d).localeCompare(String(x.d)));
    const com = (c) => `<li class="ft-m${c.fixado ? ' fixado' : ''}"><i class="ft-av g">${esc(inicial(c.a))}</i><div class="ft-balao"><div class="ft-m-h"><b>${esc(primeiroNome(c.a))}</b><small>${c.fixado ? 'Fixado · ' : ''}${esc(quando(c.d))}</small>${c.id ? `<span class="ft-m-b"><button type="button" class="ft-m-p${c.fixado ? ' on' : ''}" data-t="fixar" data-id="${esc(c.id)}" aria-label="${c.fixado ? 'Desafixar comentário' : 'Fixar comentário no alto'}" title="${c.fixado ? 'Desafixar' : 'Fixar no alto'}">${ic('bookmark')}</button><button type="button" class="ft-m-x" data-t="rm-com" data-id="${esc(c.id)}" aria-label="Excluir comentário" title="Excluir comentário">${ic('x')}</button></span>` : ''}</div><p>${links(c.t)}</p></div></li>`;
    const ev = (a) => `<li class="ft-ev ${a.tipo}">${a.a ? `<b>${esc(a.tipo === 'equipe' ? primeiroNome(a.a) : a.a)}</b> ` : ''}${esc(a.t)} <small>${esc(quando(a.d))}</small>${a.detalhe ? `<p class="ft-ev-d">${links(a.detalhe)}</p>` : ''}</li>`;
    return `<h3>Comentários${coms.length ? ` <span class="ft-n">${coms.length}</span>` : ''}</h3>
      ${fixados.length ? `<ul class="ft-conv ft-fix">${fixados.map(com).join('')}</ul>` : ''}
      <ul class="ft-conv">${resto.map(com).join('') || (fixados.length ? '' : '<li class="ft-vazio">Nenhum comentário ainda. Use este espaço para combinados, legendas alternativas e avisos da equipe. Para não perder um aviso, clique no marcador do comentário para fixá-lo no alto.</li>')}</ul>
      ${ativ.length ? `<section class="ft-hist"><h3>Histórico <span class="ft-n">${ativ.length}</span></h3><ul class="ft-conv">${ativ.map(ev).join('')}</ul></section>` : ''}`;
  };

  const rodapeConversa = () => `<form class="ft-novo" data-novo><i class="ft-av g">${esc(inicial(quem()))}</i><textarea rows="1" data-comentar placeholder="Escreva um comentário (Enter envia)" aria-label="Comentário"></textarea><button type="submit" class="btn pri sm" aria-label="Enviar comentário">${ic('send')}</button></form>`;

  const montar = () => {
    const t = atual();
    return `${topo(t)}<div class="ft-ed-w" data-ed>${editor(t)}</div>${jornada(t)}
      <div class="ft-cols">
        <div class="ft-esq" data-esq>${esquerda(t)}</div>
        <aside class="ft-dir">
          <div class="ft-dir-c">
            <div data-detalhes>${detalhes(t)}</div>
            ${arte(t)}
            <section class="ft-conv-w" data-conversa>${id ? conversa(t) : ''}</section>
          </div>
          ${id ? rodapeConversa() : '<div class="ft-novo cria"><button type="button" class="btn sec" data-t="fechar">Cancelar</button><button type="button" class="btn pri" data-t="criar">Criar tarefa</button></div>'}
        </aside>
      </div>`;
  };

  // ---------- salvar ----------
  const indicar = (m, ok = true) => {
    const el = g?.el.querySelector('[data-salvo]');
    if (!el) return;
    el.textContent = m;
    el.className = `ft-salvo${ok ? '' : ' erro'}`;
    if (ok && m === 'Salvo') setTimeout(() => { if (el.textContent === 'Salvo') el.textContent = ''; }, 1800);
  };
  const registrar = (t, texto) => ({ ...t, atividade: [...(t.atividade || []), { d: new Date().toISOString(), a: quem(), t: texto }].slice(-200) });

  // Aplica uma mudança. Em tarefa já criada salva na hora; na nova só guarda no rascunho.
  const mudar = (patch, atividade = '') => {
    if (!id) { rascunho = { ...rascunho, ...patch }; return Promise.resolve(); }
    fila = fila.then(async () => {
      const antes = store.obter('conteudo', id);
      if (!antes) return;
      let novo = { ...antes, ...patch };
      if (atividade) novo = registrar(novo, atividade);
      indicar('Salvando…');
      try { await store.salvar('conteudo', novo); indicar('Salvo'); } catch (e) { indicar('Não salvou', false); toast(e.message || 'Não consegui salvar agora.', true); }
    });
    return fila;
  };
  const descarregar = () => { for (const [, fn] of pendentes) fn(); pendentes.clear(); };

  const q = (s) => g.el.querySelector(s);
  const pintarTopo = () => {
    const t = atual();
    q('.ft-eyebrow').outerHTML = eyebrow(t);
    q('.ft-chk-w').outerHTML = marca(t);
    g.el.classList.toggle('feita', !!t.concluida);
    q('[data-ed]').innerHTML = editor(t);
    q('.ft-jor').outerHTML = jornada(t);
  };
  const pintarLado = () => { q('[data-previa]').innerHTML = previa(atual()); q('[data-detalhes]').innerHTML = detalhes(atual()); pintarTopo(); };
  const pintarConversa = () => { const el = q('[data-conversa]'); if (el) el.innerHTML = id ? conversa(atual()) : ''; };
  const pintarArquivos = () => { q('[data-arquivos]').innerHTML = arquivos(atual()); q('[data-previa]').innerHTML = previa(atual()); };
  const recarregarEsquerda = async () => { descarregar(); await fila; q('[data-esq]').innerHTML = esquerda(atual()); q('[data-esq]').querySelectorAll('textarea').forEach(crescer); };

  const trocarEtapa = async (para) => {
    const t = atual();
    if (!para || para === t.etapa) return;
    const patch = { etapa: para };
    if (para === 'publicado' && !t.concluida) { patch.concluida = true; patch.concluidaEm = new Date().toISOString(); }
    await mudar(patch, `mudou a etapa para ${nomeEtapa(para)}`);
    pintarTopo(); pintarConversa();
    // O quadro "O cliente pediu ajuste" some quando o cliente reaprova ou a peça é aprovada/publicada (o pedido fica no Histórico).
    const t2 = atual();
    const precisa = !!mostraAjuste(t2);
    if (precisa !== !!q('[data-campo="ajuste"]')) await recarregarEsquerda();
  };

  const salvarCampo = (el) => {
    const nome = el.dataset.campo;
    let v = el.value;
    if (nome === 'titulo') v = v.trim();
    if (nome === 'link') { v = v.trim(); if (v && !urlSegura(v)) { indicar('O link precisa começar com http:// ou https://', false); return; } v = urlSegura(v); }
    if (nome === 'capa') { v = v.trim(); if (v && !idDrive(v)) { indicar('Capa: ' + avisoLinkDrive(v), false); return; } v = idDrive(v); }
    if (nome === 'igLink' || nome === 'videoDrive') { v = v.trim(); if (v && !urlSegura(v)) { indicar('O link precisa começar com http:// ou https://', false); return; } v = urlSegura(v); }
    if (nome === 'titulo' && id && !v) { indicar('Dê um título à tarefa', false); return; }
    return mudar({ [nome]: v }).then(() => { if (nome === 'capa' || nome === 'legenda') q('[data-previa]').innerHTML = previa(atual()); });
  };

  const criar = async () => {
    const t = rascunho;
    const titulo = (q('.ft-titulo').value || '').trim();
    if (!t.clienteId) { toast('Escolha o cliente da tarefa (campo Cliente, à direita).', true); q('[data-campo="clienteId"]')?.focus(); return; }
    if (!titulo) { toast('Dê um título à tarefa.', true); q('.ft-titulo').focus(); return; }
    const campo = (n) => q(`[data-campo="${n}"]`)?.value ?? '';
    const link = campo('link').trim();
    const capa = campo('capa').trim();
    if (link && !urlSegura(link)) { toast('O link precisa começar com http:// ou https://', true); return; }
    if (capa && !idDrive(capa)) { toast('Capa: ' + avisoLinkDrive(capa), true); return; }
    const novo = {
      ...t, titulo, link: urlSegura(link), capa: idDrive(capa),
      roteiro: campo('roteiro'), legenda: campo('legenda'),
      criadoEm: new Date().toISOString(), concluida: false,
    };
    try {
      const salvo = await store.salvar('conteudo', registrar(novo, 'criou esta tarefa'));
      id = salvo.id; rascunho = null;
      toast('Tarefa criada');
      g.el.innerHTML = montar();
      iniciar();
    } catch (e) { toast(e.message || 'Não consegui criar a tarefa agora.', true); }
  };

  // Envio do computador para o Drive (Aprovação / cliente / mês). O login do Google precisa de um clique; depois dele, outro clique abre a escolha do arquivo.
  // Anexos da equipe: envio, abrir/baixar e remover.
  const statusAnexo = (txt) => { const s = q('[data-anexo-st]'); if (s) s.textContent = txt; };
  const pintarAnexos = () => { const el = q('[data-anexos]'); if (el) el.outerHTML = anexosSecao(atual()); };
  const enviarAnexos = async (lista) => {
    const sb = store.supabase();
    if (!sb) { toast('Anexar funciona só no painel publicado (conectado ao Supabase).', true); return; }
    if (!id) { toast('Crie a tarefa primeiro para poder anexar arquivos.', true); return; }
    let n = 0;
    for (const f of lista) {
      if (f.size > LIMITE_ANEXO) { toast(`“${f.name}” passa de 50 MB. Para arquivo grande, coloque na pasta do cliente no Drive.`, true); continue; }
      const t0 = atual();
      const aid = Math.random().toString(36).slice(2, 10);
      const seguro = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_');
      const caminho = `${t0.clienteId || 'sem-cliente'}/${id}/${aid}-${seguro}`;
      statusAnexo(`Enviando ${f.name}…`);
      const { error } = await sb.storage.from('anexos').upload(caminho, f, { contentType: f.type || 'application/octet-stream', upsert: false });
      if (error) { statusAnexo(''); toast(/bucket|not found/i.test(error.message || '') ? 'Falta ativar os anexos no Supabase: rode o arquivo supabase/anexos.sql no SQL Editor.' : `Não consegui enviar “${f.name}”: ${error.message || 'tente de novo'}`, true); continue; }
      await mudar({ anexos: [...(atual().anexos || []), { id: aid, nome: f.name, tipo: f.type || '', tam: f.size, caminho, em: new Date().toISOString(), por: quem() }] }, `anexou o arquivo ${f.name}`);
      n += 1;
      pintarAnexos(); pintarConversa();
    }
    statusAnexo('');
    if (n) toast(n > 1 ? `${n} arquivos anexados` : 'Arquivo anexado');
  };
  const abrirAnexo = async (aid) => {
    const a = (atual().anexos || []).find((x) => x.id === aid);
    const sb = store.supabase();
    if (!a || !sb) return;
    const w = window.open('about:blank', '_blank');
    const { data, error } = await sb.storage.from('anexos').createSignedUrl(a.caminho, 3600);
    if (error || !data?.signedUrl) { w?.close(); toast('Não consegui abrir o arquivo agora.', true); return; }
    if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  };
  const removerAnexo = async (aid) => {
    const a = (atual().anexos || []).find((x) => x.id === aid);
    const sb = store.supabase();
    if (!a || !sb) return;
    if (!(await confirmar(`Remover o anexo “${a.nome}”? O arquivo é apagado.`, 'Remover', true))) return;
    const { error } = await sb.storage.from('anexos').remove([a.caminho]);
    if (error) { toast('Não consegui apagar o arquivo agora.', true); return; }
    await mudar({ anexos: (atual().anexos || []).filter((x) => x.id !== aid) }, `removeu o anexo ${a.nome}`);
    pintarAnexos(); pintarConversa();
    toast('Anexo removido');
  };

  const statusEnvio = (txt) => { const s = q('[data-envio-st]'); if (s) s.textContent = txt; };
  const botaoEnviar = async (capa) => {
    if (!tokenValido()) {
      try { await entrarGoogle(); toast('Google conectado. Clique de novo para escolher o arquivo.'); } catch (e) { toast(e.message || 'Não consegui entrar no Google.', true); }
      return;
    }
    q(capa ? '[data-envio-capa]' : '[data-envio]').click();
  };
  const enviarDoComputador = async (lista, comoCapa) => {
    const t0 = atual();
    const cli = store.obter('cliente', t0.clienteId);
    if (!cli) { toast('Escolha o cliente da tarefa antes de enviar arquivos.', true); return; }
    try {
      statusEnvio('Preparando a pasta no Drive…');
      const pasta = await pastaDestino(cli.nome, (/^\d{4}-\d{2}/.test(t0.publicar || '') ? t0.publicar : new Date().toISOString()).slice(0, 7));
      for (const f of lista) {
        if (/\.mov$/i.test(f.name)) toast('Dica: vídeo .mov do iPhone pode não tocar no celular do cliente. Se der problema, exporte em MP4.');
        const n = (atual().midias || []).length + 1;
        const nome = nomeDoArquivo(atual(), f, n, comoCapa);
        const r = await enviarArquivo(f, { nome, pasta, aoProgredir: (p) => statusEnvio(`Enviando ${f.name}… ${Math.round(p * 100)}%`) });
        if (comoCapa) { await mudar({ capa: r.id }); const c = q('#ft_capa'); if (c) c.value = urlAbrir(r.id); pintarArquivos(); }
        else { await mudar({ midias: [...(atual().midias || []), { tipo: f.type.startsWith('video') ? 'video' : 'imagem', id: r.id }] }); pintarArquivos(); }
      }
      statusEnvio('');
      toast(lista.length > 1 ? 'Arquivos enviados para o Drive' : 'Arquivo enviado para o Drive');
    } catch (e) { statusEnvio(''); toast(e.message || 'Não consegui enviar o arquivo.', true); }
  };

  // Escolher da pasta do Drive: vídeo, capa ou arte (slides). O arquivo só precisa estar salvo na pasta do cliente.
  const escolherArquivo = async (slot) => {
    const t = atual();
    const cli = store.obter('cliente', t.clienteId);
    if (!cli) { toast('Escolha o cliente da tarefa (à direita) antes de escolher arquivos.', true); return; }
    const mes = (/^\d{4}-\d{2}/.test(t.publicar || '') ? t.publicar : new Date().toISOString()).slice(0, 7);
    const palavras = new Set(norm(t.titulo).split(/[^a-z0-9]+/).filter((w) => w.length > 3));
    const sugerir = (f) => (t.publicar && f.name.startsWith(t.publicar) ? 2 : 0) + ([...palavras].filter((w) => norm(f.name).includes(w)).length >= 2 ? 1 : 0);
    const titulo = slot === 'video' ? 'Escolher o vídeo' : slot === 'capa' ? 'Escolher a capa' : t.formato === 'carrossel' ? 'Escolher os slides' : 'Escolher a arte';
    const lista = await escolherDaPasta({ cliente: cli.nome, mes, titulo, tipo: slot === 'video' ? 'video' : 'imagem', multi: slot === 'arte' && t.formato === 'carrossel', sugerir });
    if (!lista?.length) return;
    const ms = atual().midias || [];
    if (slot === 'video') await mudar({ midias: [{ tipo: 'video', id: lista[0].id }, ...ms.filter((m) => m.tipo !== 'video')] }, 'escolheu o vídeo da pasta do Drive');
    else if (slot === 'capa') await mudar({ capa: lista[0].id }, 'escolheu a capa da pasta do Drive');
    else if (t.formato === 'carrossel') await mudar({ midias: [...ms, ...lista.map((f) => ({ tipo: 'imagem', id: f.id }))] }, `escolheu ${lista.length} ${lista.length === 1 ? 'slide' : 'slides'} da pasta do Drive`);
    else await mudar({ midias: [...ms.filter((m) => m.tipo === 'video'), { tipo: 'imagem', id: lista[0].id }] }, 'escolheu a arte da pasta do Drive');
    pintarArquivos();
  };

  const adicionarArquivo = async () => {
    const url = q('[data-nova=url]');
    const tipo = q('[data-nova=tipo]').value;
    const texto = url.value.trim();
    if (!texto) { url.focus(); return; }
    const fid = idDrive(texto);
    if (!fid) { toast(avisoLinkDrive(texto), true); return; }
    if (tipo === 'capa') await mudar({ capa: fid });
    else if (tipo === 'video') await mudar({ midias: [{ tipo: 'video', id: fid }, ...(atual().midias || []).filter((m) => m.tipo !== 'video')] });
    else await mudar({ midias: [...(atual().midias || []), { tipo, id: fid }] });
    pintarArquivos();
    q('[data-nova=url]')?.focus();
  };

  const enviarComentario = async () => {
    const campo = q('[data-comentar]');
    const texto = campo.value.trim();
    if (!texto) return;
    campo.value = '';
    crescer(campo);
    const novo = { id: `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, a: quem(), d: new Date().toISOString(), t: texto };
    await mudar({ comentarios: [...(atual().comentarios || []), novo] });
    pintarConversa();
    const w = q('.ft-dir-c'); if (w) w.scrollTop = w.scrollHeight;
  };

  const salvarDepois = (el) => {
    const chave = el.dataset.campo;
    if (!chave) return;
    pendentes.set(chave, () => salvarCampo(el));
    clearTimeout(timers[chave]);
    timers[chave] = setTimeout(() => { if (pendentes.has(chave)) { pendentes.get(chave)(); pendentes.delete(chave); } }, 700);
    if (id) indicar('Digitando…');
  };

  const iniciar = () => {
    g.el.classList.toggle('feita', !!atual().concluida);
    g.el.querySelectorAll('textarea').forEach(crescer);
    const w = q('.ft-dir-c'); if (w) w.scrollTop = w.scrollHeight;
  };

  // Link para o cliente aprovar só esta tarefa, com mensagem pronta para colar no WhatsApp.
  const enviarAoCliente = async () => {
    let t = atual();
    if (!id) return;
    descarregar();
    await fila;
    if (t.etapa === 'publicado') { toast('Esta tarefa já foi publicada: o link dela não funcionaria mais.', true); return; }
    const emAprovacao = ['aprovacao', 'ajustes', 'aprovado'].includes(t.etapa);
    const ideia = !emAprovacao && ['aprovacao', 'ajustes', 'aprovado'].includes(t.planejamento || '');
    if (!emAprovacao && !ideia) {
      if (!(await confirmar(`Esta tarefa está em “${nomeEtapa(t.etapa)}”. Para o cliente poder aprovar, ela vai para “Aguardando aprovação”. Continuar?`, 'Continuar'))) return;
      await trocarEtapa('aprovacao');
      t = atual();
    }
    let verTudo = true;
    let token;
    try { token = await store.linkTarefa(t.clienteId, id, { verTudo }); } catch (e) { toast(e.message || 'Não consegui gerar o link agora.', true); return; }
    const montarUrl = (tk) => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}a#${tk}`;
    let url = montarUrl(token);
    const eIdeia = !emAprovacao && ideia;
    const oQue = eIdeia ? 'a ideia' : ({ reels: 'o reels', carrossel: 'o carrossel', story: 'o story', feed: 'o post' }[t.formato] || 'o post');
    const mensagem = () => `Oi! Tudo bem? Separei ${oQue} “${t.titulo || 'novo conteúdo'}” para você aprovar.

É só abrir o link, ${eIdeia ? 'ler a ideia e o roteiro' : 'conferir a arte e a legenda'} e tocar em Aprovar ou Pedir alteração:
${url}

Qualquer dúvida, é só chamar!`;
    const m = abrirModal({
      titulo: 'Enviar ao cliente para aprovar',
      subtitulo: `${store.obter('cliente', t.clienteId)?.nome || ''}: ${t.titulo || ''}`,
      corpo: `<div class="field"><label for="ln-url">Link só desta tarefa</label><input id="ln-url" readonly value="${esc(url)}"></div>
        <label class="ln-check"><input type="checkbox" data-vertudo checked><span>Deixar o cliente ver também o feed e as outras tarefas dele<small>Ele abre esta tarefa primeiro. Se fechar, vê o feed completo para conferir como fica. Desligue para mostrar só esta.</small></span></label>
        <div class="field" style="margin-top:12px"><label for="ln-msg">Mensagem pronta (WhatsApp)</label><textarea id="ln-msg" readonly rows="6"></textarea></div>
        <p class="lbl" style="margin-top:8px">O link para de funcionar sozinho quando a tarefa for publicada. “Novo link” desativa este e cria outro.</p>
        <div class="modal-f"><button type="button" class="btn ghost danger" data-novo>Novo link</button><div class="actions"><button type="button" class="btn sec" data-copiar-link>${ic('link')}Copiar link</button>${navigator.share ? `<button type="button" class="btn sec" data-compartilhar>${ic('send')}Compartilhar</button>` : ''}<button type="button" class="btn pri" data-copiar-msg>${ic('comment')}Copiar mensagem</button></div></div>`,
    });
    const msg = m.el.querySelector('#ln-msg');
    const urlEl = m.el.querySelector('#ln-url');
    msg.value = mensagem();
    const copiar = async (texto, ok) => { try { await navigator.clipboard.writeText(texto); toast(ok); } catch { toast('Não consegui copiar. Selecione o texto e use Ctrl+C.', true); } };
    urlEl.addEventListener('focus', () => urlEl.select());
    m.el.querySelector('[data-copiar-link]').onclick = () => copiar(url, 'Link copiado');
    m.el.querySelector('[data-copiar-msg]').onclick = () => copiar(msg.value, 'Mensagem copiada');
    const comp = m.el.querySelector('[data-compartilhar]');
    if (comp) comp.onclick = async () => { try { await navigator.share({ title: t.titulo || 'Aprovação', text: msg.value }); } catch { /* fechou a janela */ } };
    m.el.querySelector('[data-vertudo]').addEventListener('change', async (e) => {
      verTudo = e.target.checked;
      try { await store.linkTarefa(t.clienteId, id, { verTudo }); toast(verTudo ? 'O cliente poderá ver o feed completo' : 'O cliente verá só esta tarefa'); } catch (err) { toast(err.message || 'Não consegui mudar agora.', true); e.target.checked = !verTudo; verTudo = !verTudo; }
    });
    m.el.querySelector('[data-novo]').onclick = async () => {
      if (!(await confirmar('Gerar um novo link? O link atual deixa de funcionar e você precisa enviar o novo ao cliente.', 'Gerar novo link', true))) return;
      try { token = await store.linkTarefa(t.clienteId, id, { verTudo, renovar: true }); url = montarUrl(token); urlEl.value = url; msg.value = mensagem(); toast('Novo link gerado'); } catch (err) { toast(err.message || 'Não consegui gerar agora.', true); }
    };
  };

  const irParaVizinha = async (passo) => {
    const lista = vizinhas();
    const outra = lista[lista.findIndex((x) => x.id === id) + passo];
    if (!outra) return;
    descarregar();
    await fila;
    g.fechar();
    abrirTarefa(outra);
  };

  // ---------- eventos ----------
  const aoClicar = async (e) => {
    const b = e.target.closest('[data-t]');
    if (!b || b.disabled) return;
    const a = b.dataset.t;
    if (a === 'fechar') return g.fechar();
    if (a === 'criar') return criar();
    if (a === 'viz') return irParaVizinha(Number(b.dataset.v));
    if (a === 'enviar') return enviarAoCliente();
    if (a === 'classe') { classeAberta = !classeAberta; pintarTopo(); return; }
    if (a === 'concluir') {
      const feita = !atual().concluida;
      await mudar({ concluida: feita, concluidaEm: feita ? new Date().toISOString() : '' }, feita ? 'marcou como concluída' : 'voltou a tarefa para em aberto');
      pintarTopo(); pintarConversa();
      return;
    }
    if (a === 'etapa') return trocarEtapa(b.dataset.v);
    if (a === 'set') {
      const n = b.dataset.n; const v = b.dataset.v;
      const t = atual();
      const novo = t[n] === v && ['responsavel', 'funil', 'rede'].includes(n) ? '' : v;
      await mudar({ [n]: novo }, n === 'responsavel' ? (novo ? `atribuiu a tarefa a ${novo}` : 'tirou o responsável') : '');
      pintarLado(); if (n === 'formato') pintarArquivos(); if (n === 'responsavel') pintarConversa();
      return;
    }
    if (a === 'copiar') {
      const txt = q('[data-campo="legenda"]').value;
      if (!txt.trim()) { toast('Ainda não há legenda para copiar.', true); return; }
      try { await navigator.clipboard.writeText(txt); toast('Legenda copiada'); } catch { toast('Não consegui copiar. Selecione o texto e use Ctrl+C.', true); }
      return;
    }
    if (a === 'add-midia') return adicionarArquivo();
    if (a === 'slot') return escolherArquivo(b.dataset.slot);
    if (a === 'rm-capa') { await mudar({ capa: '' }, 'tirou a capa'); pintarArquivos(); return; }
    if (a === 'anexar') return q('[data-anexo-in]')?.click();
    if (a === 'abrir-anexo') return abrirAnexo(b.dataset.id);
    if (a === 'rm-anexo') return removerAnexo(b.dataset.id);
    if (a === 'enviar-pc') return botaoEnviar(false);
    if (a === 'enviar-capa') return botaoEnviar(true);
    if (a === 'rm-midia') {
      const i = Number(b.dataset.i);
      await mudar({ midias: (atual().midias || []).filter((_, k) => k !== i) });
      pintarArquivos();
      return;
    }
    if (a === 'plano') {
      const para = b.dataset.v;
      await mudar({ planejamento: para, ...(para === 'aprovacao' ? { ajustePlano: '' } : {}) }, para === 'aprovacao' ? 'enviou a ideia para o cliente aprovar' : para === '' ? 'cancelou o envio da ideia ao cliente' : '');
      const alvo = q('[data-plano]'); if (alvo) alvo.innerHTML = planoLinha(atual());
      pintarConversa();
      return;
    }
    if (a === 'fixar') {
      await mudar({ comentarios: (atual().comentarios || []).map((c) => (c.id === b.dataset.id ? { ...c, fixado: !c.fixado } : c)) });
      pintarConversa();
      return;
    }
    if (a === 'rm-com') {
      if (!(await confirmar('Excluir este comentário?', 'Excluir', true))) return;
      await mudar({ comentarios: (atual().comentarios || []).filter((c) => c.id !== b.dataset.id) });
      pintarConversa();
      return;
    }
    if (a === 'arquivar') {
      const t = atual();
      const arquivando = !t.arquivada;
      if (arquivando && !(await confirmar(`Arquivar a tarefa “${t.titulo}”? Ela some do quadro, do calendário e do feed, e não aparece mais para o cliente. Dá para restaurar depois em Filtros > Arquivadas.`, 'Arquivar'))) return;
      await mudar({ arquivada: arquivando, arquivadaEm: arquivando ? new Date().toISOString() : '' }, arquivando ? 'arquivou esta tarefa' : 'restaurou esta tarefa');
      g.fechar();
      toast(arquivando ? 'Tarefa arquivada' : 'Tarefa restaurada');
      return;
    }
    if (a === 'excluir') {
      const t = atual();
      if (await confirmar(`Excluir a tarefa “${t.titulo}”?`, 'Excluir', true)) { await store.remover('conteudo', id); g.fechar(); toast('Tarefa excluída'); }
    }
  };

  prepararGoogle();
  g = abrirGaveta({
    titulo: p ? 'Tarefa de conteúdo' : 'Nova tarefa de conteúdo',
    corpo: montar(),
    aoFechar: descarregar,
  });
  g.el.addEventListener('click', aoClicar);
  g.el.addEventListener('toggle', (e) => { if (e.target.matches('[data-ativ]')) ativAberta = e.target.open; }, true);
  // Arrastar arquivos para a caixa de Anexos.
  g.el.addEventListener('dragover', (e) => { const s = e.target.closest?.('[data-anexos]'); if (s && [...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); s.classList.add('arrastando-arq'); } });
  g.el.addEventListener('dragleave', (e) => { const s = e.target.closest?.('[data-anexos]'); if (s && !s.contains(e.relatedTarget)) s.classList.remove('arrastando-arq'); });
  g.el.addEventListener('drop', (e) => { const s = e.target.closest?.('[data-anexos]'); if (!s) return; e.preventDefault(); s.classList.remove('arrastando-arq'); const lista = [...(e.dataTransfer?.files || [])]; if (lista.length) enviarAnexos(lista); });
  g.el.addEventListener('input', (e) => {
    const el = e.target;
    if (el.matches('textarea')) crescer(el);
    if (el.matches('[data-comentar]')) return;
    const campo = el.dataset.campo;
    if (campo === 'legenda') { const c = q('[data-cont]'); if (c) { c.textContent = contar(el.value); c.classList.toggle('estourou', el.value.length > LIMITE_LEGENDA); } }
    if (!campo || ['clienteId', 'publicar', 'planejamento'].includes(campo)) return;
    if (!id) { rascunho = { ...rascunho, [campo]: el.value }; if (campo === 'legenda') q('[data-previa]').innerHTML = previa(atual()); return; }
    salvarDepois(el);
  });
  g.el.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.matches('[data-collab]')) { await mudar({ collab: el.checked }, el.checked ? 'marcou como collab' : 'tirou a marcação de collab'); return; }
    if (el.matches('[data-anexo-in]')) {
      const lista = [...(el.files || [])];
      el.value = '';
      if (lista.length) enviarAnexos(lista);
      return;
    }
    if (el.matches('[data-envio], [data-envio-capa]')) {
      const lista = [...(el.files || [])];
      el.value = '';
      if (lista.length) enviarDoComputador(lista, el.matches('[data-envio-capa]'));
      return;
    }
    const campo = el.dataset.campo;
    if (!campo) return;
    if (['clienteId', 'publicar', 'planejamento'].includes(campo)) {
      const antes = atual()[campo] || '';
      if (campo === 'clienteId' && !el.value && id) { el.value = antes; return; }
      await mudar({ [campo]: el.value }, campo === 'publicar' ? (el.value ? `mudou a data de publicação para ${dataBR(el.value)}` : 'tirou a data de publicação') : '');
      pintarLado(); if (campo === 'publicar') pintarConversa();
      return;
    }
    descarregar();
  });
  g.el.addEventListener('submit', (e) => { e.preventDefault(); enviarComentario(); });
  g.el.addEventListener('keydown', (e) => {
    if (e.target.matches('[data-comentar]') && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); enviarComentario(); }
    if (e.target.matches('[data-nova=url]') && e.key === 'Enter') { e.preventDefault(); adicionarArquivo(); }
    if (e.target.matches('.ft-titulo') && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); irParaVizinha(e.key === 'ArrowLeft' ? -1 : 1); }
  });
  // Arte do Drive às vezes demora a gerar a miniatura: tenta de novo uma vez com outro endereço.
  g.el.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || !img.dataset.id || img.dataset.tentou) return;
    img.dataset.tentou = '1';
    setTimeout(() => { img.src = urlImagem(img.dataset.id, 640, 1); }, 600);
  }, true);
  iniciar();

  // As antigas "observações internas" viram um comentário fixado (uma vez só, ao abrir a tarefa).
  const migrarNota = () => {
    const t = atual();
    const txt = String(t.briefing || '').trim();
    if (!id || !txt) return;
    const c = { id: `nota-${Date.now().toString(36)}`, a: 'Equipe', d: t.atualizadoEm || t.criadoEm || new Date().toISOString(), t: txt, fixado: true };
    mudar({ comentarios: [...(t.comentarios || []), c], briefing: '' }).then(pintarConversa);
  };
  migrarNota();

  // Veio do botão "Pediu ajuste" (ou outro atalho): já aplica a etapa e leva o cursor para onde anotar.
  if (p && padrao.etapa && padrao.etapa !== p.etapa) {
    trocarEtapa(padrao.etapa).then(() => { if (padrao.etapa === 'ajustes') q('[data-campo="ajuste"]')?.focus(); });
  } else if (!p) q('.ft-titulo').focus();
}
