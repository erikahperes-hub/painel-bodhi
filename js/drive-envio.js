// Envio de arquivos do computador direto para o Drive: pasta Aprovação / nome do cliente / AAAA-MM.
// Entra com o Google da pessoa (Érika ou Milena, listadas como usuárias de teste no Google Cloud). Nada é guardado no painel:
// o login vale por cerca de 1 hora e só existe nesta aba. O código do arquivo enviado é o que fica na tarefa.
import { config } from './config.js?v=202';

const GIS = 'https://accounts.google.com/gsi/client';
const ESCOPO = 'https://www.googleapis.com/auth/drive';
const API = 'https://www.googleapis.com/drive/v3';
const PASTA = 'application/vnd.google-apps.folder';
let token = '';
let expira = 0;
const pastas = new Map();

export const tokenValido = () => !!token && Date.now() < expira - 60000;

// Carrega o login do Google ao abrir a tarefa, para o clique em "Enviar" abrir a janela na hora (senão o navegador bloqueia).
export function prepararGoogle() {
  if (window.google?.accounts?.oauth2 || document.querySelector(`script[src="${GIS}"]`)) return;
  const s = document.createElement('script');
  s.src = GIS;
  s.async = true;
  document.head.appendChild(s);
}

// Precisa ser chamada direto de um clique.
export function entrarGoogle() {
  return new Promise((ok, erro) => {
    if (!config.googleClientId) { erro(new Error('Falta configurar o login do Google (googleClientId em js/config.js).')); return; }
    if (!window.google?.accounts?.oauth2) { erro(new Error('O login do Google ainda está carregando. Espere um instante e clique de novo.')); return; }
    const cliente = window.google.accounts.oauth2.initTokenClient({
      client_id: config.googleClientId,
      scope: ESCOPO,
      callback: (r) => {
        if (r.error) { erro(new Error(r.error === 'access_denied' ? 'O Google não deixou entrar. Use o Gmail da Érika ou da Milena.' : 'Não consegui entrar no Google.')); return; }
        token = r.access_token;
        expira = Date.now() + (Number(r.expires_in) || 3600) * 1000;
        ok(token);
      },
      error_callback: (e) => erro(new Error(e?.type === 'popup_failed_to_open' ? 'O navegador bloqueou a janela do Google. Permita pop-ups para este endereço e tente de novo.' : e?.type === 'popup_closed' ? 'Entrada no Google cancelada.' : 'Não consegui entrar no Google.')),
    });
    cliente.requestAccessToken({ prompt: token ? '' : 'select_account' });
  });
}

async function api(caminho, opcoes = {}) {
  let r;
  try {
    r = await fetch(`${API}${caminho}`, { ...opcoes, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opcoes.headers || {}) } });
  } catch { throw new Error('Não consegui falar com o Google. Confira a internet.'); }
  if (r.status === 401) { token = ''; throw new Error('O login do Google expirou. Clique em enviar de novo para entrar.'); }
  if (!r.ok) throw new Error(`O Google recusou o pedido (${r.status}).`);
  return r.json();
}

async function acharOuCriar(nome, pai) {
  const chave = `${pai}/${nome}`;
  if (pastas.has(chave)) return pastas.get(chave);
  const q = `name='${nome.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and '${pai}' in parents and mimeType='${PASTA}' and trashed=false`;
  const r = await api(`/files?${new URLSearchParams({ q, fields: 'files(id)', pageSize: '5' })}`);
  const id = r.files?.[0]?.id || (await api('/files?fields=id', { method: 'POST', body: JSON.stringify({ name: nome, mimeType: PASTA, parents: [pai] }) })).id;
  pastas.set(chave, id);
  return id;
}

// Pasta do mês do cliente dentro da Aprovação (cria o que faltar).
export async function pastaDestino(nomeCliente, mes) {
  if (!config.driveAprovacao) throw new Error('Falta o código da pasta Aprovação (driveAprovacao em js/config.js).');
  const doCliente = await acharOuCriar(String(nomeCliente || 'Sem cliente').trim(), config.driveAprovacao);
  return acharOuCriar(mes, doCliente);
}

// Sessão de envio retomável + PUT com progresso. Funciona para vídeos grandes. Depois deixa o arquivo "qualquer pessoa com o link".
export async function enviarArquivo(arquivo, { nome, pasta, aoProgredir }) {
  let ini;
  try {
    ini = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': arquivo.type || 'application/octet-stream', 'X-Upload-Content-Length': String(arquivo.size) },
      body: JSON.stringify({ name: nome, parents: [pasta] }),
    });
  } catch { throw new Error('Não consegui falar com o Google. Confira a internet.'); }
  if (ini.status === 401) { token = ''; throw new Error('O login do Google expirou. Clique em enviar de novo para entrar.'); }
  const url = ini.headers.get('Location');
  if (!ini.ok || !url) throw new Error(`O Google não aceitou o envio (${ini.status}).`);
  const enviado = await new Promise((ok, erro) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    x.upload.onprogress = (e) => { if (e.lengthComputable) aoProgredir?.(e.loaded / e.total); };
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) { try { ok(JSON.parse(x.responseText)); } catch { erro(new Error('Resposta inesperada do Google.')); } } else erro(new Error(`O envio falhou (${x.status}).`));
    };
    x.onerror = () => erro(new Error('A internet caiu durante o envio. Tente de novo.'));
    x.send(arquivo);
  });
  await api(`/files/${encodeURIComponent(enviado.id)}/permissions?fields=id`, { method: 'POST', body: JSON.stringify({ role: 'reader', type: 'anyone' }) }).catch(() => {});
  return enviado;
}

// Nome padrão da skill painel-conteudo: AAAA-MM-DD_formato_titulo-curto[_NN | _capa].extensão
const FORMATO = { feed: 'estatico', reels: 'reels', carrossel: 'carrossel', story: 'story' };
export function nomeDoArquivo(t, arquivo, n, capa) {
  const data = /^\d{4}-\d{2}-\d{2}$/.test(t.publicar || '') ? t.publicar : new Date().toISOString().slice(0, 10);
  const slug = String(t.titulo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-$/, '') || 'sem-titulo';
  const ext = (arquivo.name.match(/\.([A-Za-z0-9]+)$/) || [])[1]?.toLowerCase() || (arquivo.type.split('/')[1] || 'bin');
  const suf = capa ? '_capa' : (t.formato === 'carrossel' || n > 1 ? `_${String(n).padStart(2, '0')}` : '');
  return `${data}_${FORMATO[t.formato] || 'estatico'}_${slug}${suf}.${ext}`;
}
