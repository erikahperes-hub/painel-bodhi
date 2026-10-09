// Cloudflare Worker (gratuito): entrega os vídeos do Drive para a página de aprovação com um player de verdade.
// Em vez do player do Drive (com faixa preta, botão que abre o Drive e qualidade baixa), a página usa a tag <video>.
//
// Como colocar no ar: veja a seção "Vídeos com player próprio" do LEIA-ME.md.
// Nada aqui é secreto: o Worker só repassa arquivos que já estão compartilhados como "qualquer pessoa com o link".

// Páginas que podem usar este Worker. Quem pedir de outro lugar recebe 403.
const PERMITIDOS = ['https://painel.bodhi.marketing', 'http://localhost:5173'];

export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Método não permitido', { status: 405 });

    const de = request.headers.get('Origin') || request.headers.get('Referer') || '';
    if (!PERMITIDOS.some((o) => de === o || de.startsWith(o + '/'))) return new Response('Acesso negado', { status: 403 });

    const id = new URL(request.url).searchParams.get('id') || '';
    if (!/^[\w-]{20,}$/.test(id)) return new Response('Arquivo inválido', { status: 400 });

    // O Drive aceita pedir o vídeo aos pedaços (Range), o que permite tocar, avançar e voltar sem baixar tudo.
    const pedido = new Headers();
    const faixa = request.headers.get('Range');
    if (faixa) pedido.set('Range', faixa);
    const origem = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, { headers: pedido, redirect: 'follow' });

    const tipo = origem.headers.get('content-type') || '';
    if (!origem.ok && origem.status !== 206) return new Response('O Drive não entregou o arquivo', { status: 502 });
    if (!/^(video|audio)\//.test(tipo)) return new Response('O Drive não liberou este vídeo agora', { status: 502 });

    const saida = new Headers();
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      if (origem.headers.has(h)) saida.set(h, origem.headers.get(h));
    }
    saida.set('Accept-Ranges', 'bytes');
    saida.set('Cache-Control', 'public, max-age=3600');
    saida.set('Content-Disposition', 'inline');
    saida.set('Access-Control-Allow-Origin', de.startsWith('http') ? new URL(de).origin : '*');
    return new Response(origem.body, { status: origem.status, headers: saida });
  },
};
