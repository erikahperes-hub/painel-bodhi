import { store } from './store.js?v=77';
import { diasAte } from './util.js?v=77';

// Etapas do caminho de cada peça de conteúdo, na ordem em que acontecem.
export const ETAPAS = [
  { id: 'briefing', nome: 'Planejamento', chip: 'mute', cor: 'mute' },
  { id: 'criacao', nome: 'Em criação', chip: 'info', cor: 'info' },
  { id: 'aprovacao', nome: 'Aguardando aprovação', chip: 'info', cor: 'creme' },
  { id: 'ajustes', nome: 'Ajustes', chip: 'warn', cor: 'warn' },
  { id: 'aprovado', nome: 'Aprovado', chip: 'ok', cor: 'ok' },
  { id: 'publicado', nome: 'Publicado', chip: 'mute', cor: 'mute' },
];

// Os quatro formatos, na ordem de exibição. O código interno do estático continua "feed" (é o que já está guardado nas peças).
export const FORMATOS = {
  reels: { nome: 'Reels', icone: 'play' },
  carrossel: { nome: 'Carrossel', icone: 'layers' },
  feed: { nome: 'Estático', icone: 'image' },
  story: { nome: 'Story', icone: 'circle' },
};

// Redes sociais onde a peça é publicada (campo "Rede", como no Asana). O código é o que fica guardado na peça.
export const REDES = {
  instagram: { nome: 'Instagram' },
  tiktok: { nome: 'TikTok' },
  facebook: { nome: 'Facebook' },
  pinterest: { nome: 'Pinterest' },
  linkedin: { nome: 'LinkedIn' },
};

// Aceita a rede como escrita por pessoas ou arquivos ("Instagram", "tik tok", "IG"...). Devolve o código ou ''.
export function redeDe(texto) {
  const n = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  if (/^(instagram|insta|ig)$/.test(n)) return 'instagram';
  if (/^(tiktok|tt)$/.test(n)) return 'tiktok';
  if (/^(facebook|face|fb)$/.test(n)) return 'facebook';
  if (/^pinterest$/.test(n)) return 'pinterest';
  if (/^linkedin$/.test(n)) return 'linkedin';
  return '';
}

// Aceita o formato como escrito por pessoas ou arquivos: "Estático", "estatico", "Feed", "Reels", "carrosséis"... Devolve o código interno ou ''.
export function formatoDe(texto) {
  const n = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/reel/.test(n)) return 'reels';
  if (/carross/.test(n)) return 'carrossel';
  if (/stor/.test(n)) return 'story';
  if (/estatic|feed|post|imagem|foto/.test(n)) return 'feed';
  return '';
}

export const etapaDe = (p) => ETAPAS.find((e) => e.id === p.etapa) || ETAPAS[0];

// Atrasada: passou a data de publicação e a peça ainda não foi publicada.
// Peça concluída (botão de concluir) ou já publicada não conta como atrasada.
export const atrasada = (p) => !!p.publicar && p.etapa !== 'publicado' && !p.concluida && diasAte(p.publicar) !== null && diasAte(p.publicar) < 0;

export const pecas = () => store.todos('conteudo');
export const pecasDoCliente = (clienteId) => pecas().filter((p) => p.clienteId === clienteId);
