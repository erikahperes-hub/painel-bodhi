// Preencha depois de criar o projeto no Supabase (veja LEIA-ME.md, passo 2).
// A chave "anon" é pública por desenho: quem protege os dados é o login + as regras do banco.
export const config = {
  supabaseUrl: 'https://dmxycyxqfxzmotnlyixz.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRteHljeXhxZnh6bW90bmx5aXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NDgzMDIsImV4cCI6MjEwNTMyNDMwMn0.2IEath7jNbrsii2608tUhyONPVYCCuGpxqZohkWmmek',
  asaasFunction: 'asaas',
  instagramFunction: 'instagram',
  // Endereço do Worker do Cloudflare que entrega os vídeos com player próprio (LEIA-ME, "Vídeos com player próprio").
  // Vazio = usa o player do Drive.
  midiaProxy: 'https://bodhi-midia.erikahperes.workers.dev',
  // Chave do Google para "Importar da pasta" (só lê o Drive e só vale em painel.bodhi.marketing; pública por desenho, como a anon).
  // Projeto "My First Project" no Google Cloud (conta erikahperes@gmail.com), API Drive ativada, restrição por site.
  driveKey: 'AIzaSyBMslqhcuZ6o8O8IZY9W5VQ6rRRjfGVTro',
  // "Enviar do computador" (js/drive-envio.js): ID do cliente OAuth "Painel Bôdhi (anexos)" no mesmo projeto do Google Cloud (público por desenho,
  // só vale em painel.bodhi.marketing) e código da pasta Aprovação no Drive (pública por desenho).
  googleClientId: '655896643773-nahd3vna03vd4530dpv2r7b40vgarqsh.apps.googleusercontent.com',
  driveAprovacao: '16cdti1VEzkvn1fisGq8X5qkQaozL9BIm',
};
