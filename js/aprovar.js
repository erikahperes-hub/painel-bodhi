import { config } from './config.js?v=71';
import { logo } from './logo.js?v=71';
import { esc } from './util.js?v=71';
import { flor } from './icons.js?v=71';
import { montarFeed } from './instagram.js?v=71';

// Página pública de aprovação. Não tem login: o código do link (depois do #) identifica o cliente.
// O banco só entrega as peças desse cliente e só aceita aprovar ou pedir alteração nelas.
const SB_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const app = document.getElementById('app');
const token = location.hash.replace(/^#\/?/, '').trim();
const demo = location.hostname === 'localhost' && location.search.includes('demo');

function aviso(titulo, texto) {
  app.innerHTML = `<div class="setup"><div class="card empty">${flor()}<h2>${esc(titulo)}</h2><p>${esc(texto)}</p></div></div>`;
}

async function iniciar() {
  if (!demo && !/^[0-9a-f]{20,}$/i.test(token)) return aviso('Link incompleto', 'Confira se você copiou o link inteiro ou peça um novo para a Bôdhi Marketing.');

  let dados;
  let responder;
  if (demo) {
    dados = await fetch('seed/demo-aprovacao.json', { cache: 'no-store' }).then((r) => r.json());
    responder = async () => { await new Promise((r) => setTimeout(r, 400)); };
  } else {
    const { createClient } = await import(SB_CDN);
    const sb = createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.rpc('aprovacao_ver', { p_token: token });
    if (error) throw error;
    dados = data;
    responder = async (peca, acao, comentario) => {
      const { data: ok, error: erro } = await sb.rpc('aprovacao_responder', { p_token: token, p_peca: peca.id, p_acao: acao, p_comentario: comentario || null });
      if (erro || !ok) throw new Error('Não foi possível enviar agora. Atualize a página e tente de novo.');
    };
  }
  if (!dados) return aviso('Este link não está mais ativo', 'Peça um novo link de aprovação para a Bôdhi Marketing.');

  document.title = `Aprovação de conteúdo · ${dados.cliente.nome}`;
  app.innerHTML = `<div class="pub">
    <header class="pub-h"><a href="https://bodhi.marketing" aria-label="Bôdhi Marketing" rel="noopener">${logo('verde', '#FFFCF6')}</a><p>Aprovação de conteúdo</p></header>
    <div class="card"><div id="feed"></div></div>
    <p class="pub-f">Bôdhi Marketing · Se tiver qualquer dúvida, é só nos chamar.</p></div>`;
  montarFeed(document.getElementById('feed'), { cliente: dados.cliente, pecas: dados.pecas, aoResponder: responder });
}

iniciar().catch((err) => {
  console.error(err);
  aviso('Não consegui abrir a página', 'Verifique sua conexão com a internet e tente de novo em instantes. Se continuar, avise a Bôdhi Marketing.');
});
