// Arquivos de aprovação ficam numa pasta do Google Drive compartilhada como "qualquer pessoa com o link".
// O painel guarda só o código do arquivo; o cliente nunca recebe um link do Drive.

// Aceita o link do arquivo (compartilhar ou abrir) ou o próprio código. Devolve o código ou ''.
export function idDrive(entrada) {
  const t = String(entrada || '').trim();
  if (/^[\w-]{20,}$/.test(t)) return t;
  try {
    const u = new URL(t);
    if (!/(^|\.)google\.com$|(^|\.)googleusercontent\.com$/.test(u.hostname)) return '';
    const m = u.pathname.match(/\/d\/([\w-]{20,})/);
    return m ? m[1] : (u.searchParams.get('id') || '').match(/^[\w-]{20,}$/)?.[0] || '';
  } catch { return ''; }
}

// Explica por que um link não serve. Link de pasta é o engano mais comum.
export function avisoLinkDrive(entrada) {
  let pasta = false;
  try { const u = new URL(String(entrada || '').trim()); pasta = u.hostname === 'drive.google.com' && /^\/drive(\/|$)/.test(u.pathname); } catch { /* não é um link */ }
  return pasta
    ? 'Esse é o link de uma pasta. Abra a pasta, clique com o botão direito no arquivo e use Compartilhar > Copiar link.'
    : 'Esse não parece um link de arquivo do Google Drive. Clique com o botão direito no arquivo e use Compartilhar > Copiar link.';
}

// O Google às vezes recusa imagens pedidas em rajada. Nas tentativas seguintes alternamos entre dois endereços dele.
export const urlImagem = (id, largura = 1080, tentativa = 0) => (tentativa % 2
  ? `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w${largura}`
  : `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${largura}${tentativa ? `&t=${tentativa}` : ''}`);
export const urlPlayer = (id) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
export const urlBaixar = (id) => `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
export const urlAbrir = (id) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
