import { store } from './store.js?v=32';
import { diasAte } from './util.js?v=32';

// Etapas do caminho de cada peça de conteúdo, na ordem em que acontecem.
export const ETAPAS = [
  { id: 'briefing', nome: 'Briefing', chip: 'mute', cor: 'mute' },
  { id: 'criacao', nome: 'Em criação', chip: 'info', cor: 'info' },
  { id: 'aprovacao', nome: 'Aguardando aprovação', chip: 'info', cor: 'creme' },
  { id: 'ajustes', nome: 'Ajustes', chip: 'warn', cor: 'warn' },
  { id: 'aprovado', nome: 'Aprovado', chip: 'ok', cor: 'ok' },
  { id: 'publicado', nome: 'Publicado', chip: 'mute', cor: 'mute' },
];

export const FORMATOS = {
  feed: { nome: 'Feed', icone: 'image' },
  carrossel: { nome: 'Carrossel', icone: 'layers' },
  reels: { nome: 'Reels', icone: 'play' },
  story: { nome: 'Story', icone: 'circle' },
};

export const etapaDe = (p) => ETAPAS.find((e) => e.id === p.etapa) || ETAPAS[0];

// Atrasada: passou a data de publicação e a peça ainda não foi publicada.
export const atrasada = (p) => !!p.publicar && p.etapa !== 'publicado' && diasAte(p.publicar) !== null && diasAte(p.publicar) < 0;

export const pecas = () => store.todos('conteudo');
export const pecasDoCliente = (clienteId) => pecas().filter((p) => p.clienteId === clienteId);
