// "Escolher da pasta do Drive": mostra os arquivos da pasta do cliente (Aprovação / Cliente / AAAA-MM) com miniatura,
// para a pessoa clicar no vídeo, na capa ou na arte da tarefa. Não pede login do Google e não tem limite de tamanho:
// o arquivo só precisa estar salvo na pasta (no PC, a pasta do Drive sincronizada). Lê as pastas compartilhadas como
// "qualquer pessoa com o link" pela chave pública do Drive (a mesma de js/config.js).
import { config } from './config.js?v=208';
import { esc } from './util.js?v=208';
import { ic } from './icons.js?v=208';
import { abrirModal } from './ui.js?v=208';
import { urlImagem } from './drive.js?v=208';

const API = 'https://www.googleapis.com/drive/v3';
const PASTA = 'application/vnd.google-apps.folder';
const aspas = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function listar(q, campos, ordem = 'modifiedTime desc') {
  const p = new URLSearchParams({ q, fields: campos, pageSize: '200', orderBy: ordem, key: config.driveKey });
  let r;
  try { r = await fetch(`${API}/files?${p}`); } catch { throw new Error('Não consegui falar com o Google. Confira a internet.'); }
  if (!r.ok) throw new Error(`O Drive não deixou ler a pasta (${r.status}).`);
  return (await r.json()).files || [];
}

const tamanho = (n) => { const x = Number(n); if (!x) return ''; return x >= 1048576 ? `${(x / 1048576).toFixed(x >= 10485760 ? 0 : 1).replace('.', ',')} MB` : `${Math.max(1, Math.round(x / 1024))} KB`; };
const dia = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };

// Devolve uma lista com os arquivos escolhidos ({ id, name, mimeType }), ou null se a pessoa cancelar.
// tipo: 'video' | 'imagem'. sugerir(arquivo) marca os arquivos que parecem ser desta tarefa.
export function escolherDaPasta({ cliente, mes, titulo, tipo, multi = false, sugerir = () => false }) {
  return new Promise((resolve) => {
    let fim = false;
    const terminar = (v) => { if (!fim) { fim = true; resolve(v); } };
    const m = abrirModal({
      titulo,
      subtitulo: `Arquivos da pasta ${cliente} no Drive. Se você acabou de salvar o arquivo, espere alguns segundos e clique em Atualizar.`,
      largo: true,
      corpo: `<div class="dp-barra"><select data-dp-pasta aria-label="Pasta do mês"></select><button type="button" class="btn sec sm" data-dp-atualizar>${ic('refresh')}Atualizar</button><a class="btn ghost sm" data-dp-abrir target="_blank" rel="noopener noreferrer">Abrir a pasta no Drive</a><input type="search" data-dp-busca placeholder="Buscar pelo nome" aria-label="Buscar arquivo"></div>
        <div class="dp-lista" data-dp-lista><p class="dp-msg">Procurando a pasta…</p></div>
        <div class="modal-f"><button type="button" class="btn ghost" data-dp-cancelar>Cancelar</button><div class="actions"><span class="lbl" data-dp-n></span><button type="button" class="btn pri" data-dp-usar disabled>Usar</button></div></div>`,
      aoFechar: () => terminar(null),
    });
    const q = (s) => m.el.querySelector(s);
    const lista = q('[data-dp-lista]');
    let arquivos = [];
    let escolha = []; // ids na ordem do clique
    let pastaCliente = null;
    let pastas = [];

    const filtro = tipo === 'video' ? "mimeType contains 'video/'" : "mimeType contains 'image/'";
    const atualizarBotao = () => {
      const n = escolha.length;
      q('[data-dp-usar]').disabled = !n;
      q('[data-dp-usar]').textContent = n > 1 ? `Usar ${n} arquivos` : 'Usar este';
      q('[data-dp-n]').textContent = n ? `${n} ${n === 1 ? 'escolhido' : 'escolhidos'}` : '';
    };
    const desenhar = () => {
      const busca = String(q('[data-dp-busca]').value || '').toLowerCase().trim();
      const vis = arquivos.filter((f) => !busca || f.name.toLowerCase().includes(busca))
        .sort((a, b) => (sugerir(b) - sugerir(a)) || (multi ? a.name.localeCompare(b.name, 'pt', { numeric: true }) : String(b.modifiedTime).localeCompare(String(a.modifiedTime))));
      if (!vis.length) {
        lista.innerHTML = `<p class="dp-msg">${arquivos.length ? 'Nenhum arquivo com esse nome.' : `Nenhum ${tipo === 'video' ? 'vídeo' : 'arquivo de imagem'} nesta pasta ainda. Salve o arquivo na pasta do cliente no Drive e clique em Atualizar.`}</p>`;
        return;
      }
      lista.innerHTML = `<div class="dp-grade">${vis.map((f) => {
        const pos = escolha.indexOf(f.id);
        return `<button type="button" class="dp-card${pos >= 0 ? ' on' : ''}" data-dp-id="${esc(f.id)}" aria-pressed="${pos >= 0}" title="${esc(f.name)}">
          <span class="dp-img"><img src="${esc(urlImagem(f.id, 320))}" alt="" loading="lazy" onerror="this.remove()">${tipo === 'video' ? `<i class="dp-play">${ic('play')}</i>` : ''}${pos >= 0 ? `<i class="dp-ok">${multi ? pos + 1 : ic('check')}</i>` : ''}${sugerir(f) ? '<i class="dp-sug">Desta tarefa</i>' : ''}</span>
          <b>${esc(f.name)}</b><small>${esc([tamanho(f.size), dia(f.modifiedTime)].filter(Boolean).join(' · '))}</small></button>`;
      }).join('')}</div>`;
    };
    const carregarArquivos = async () => {
      const pasta = q('[data-dp-pasta]').value;
      if (!pasta) { lista.innerHTML = '<p class="dp-msg">Escolha uma pasta.</p>'; return; }
      q('[data-dp-abrir]').href = `https://drive.google.com/drive/folders/${encodeURIComponent(pasta)}`;
      lista.innerHTML = '<p class="dp-msg">Lendo a pasta…</p>';
      try {
        arquivos = await listar(`'${aspas(pasta)}' in parents and trashed=false and ${filtro}`, 'files(id,name,mimeType,size,modifiedTime)');
        escolha = escolha.filter((id) => arquivos.some((f) => f.id === id));
        desenhar(); atualizarBotao();
      } catch (e) { lista.innerHTML = `<p class="dp-msg">${esc(e.message || 'Não consegui ler a pasta.')} Use “Colar link” na tarefa.</p>`; }
    };
    const iniciar = async () => {
      try {
        if (!config.driveAprovacao || !config.driveKey) throw new Error('Faltam as chaves do Drive em js/config.js.');
        const achadas = await listar(`name='${aspas(cliente)}' and '${aspas(config.driveAprovacao)}' in parents and mimeType='${PASTA}' and trashed=false`, 'files(id,name)');
        pastaCliente = achadas[0];
        if (!pastaCliente) { lista.innerHTML = `<p class="dp-msg">Não achei a pasta “${esc(cliente)}” dentro de Aprovação no Drive. Crie a pasta com o nome do cliente (e uma subpasta ${esc(mes || 'AAAA-MM')}) e salve os arquivos nela.</p>`; return; }
        const sub = await listar(`'${aspas(pastaCliente.id)}' in parents and mimeType='${PASTA}' and trashed=false`, 'files(id,name)', 'name desc');
        pastas = [...sub.filter((p) => /^\d{4}-\d{2}$/.test(p.name)), { id: pastaCliente.id, name: `${cliente} (pasta inicial)` }, ...sub.filter((p) => !/^\d{4}-\d{2}$/.test(p.name))];
        const sel = q('[data-dp-pasta]');
        sel.innerHTML = pastas.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
        const doMes = pastas.find((p) => p.name === mes);
        if (doMes) sel.value = doMes.id;
        await carregarArquivos();
      } catch (e) { lista.innerHTML = `<p class="dp-msg">${esc(e.message || 'Não consegui ler o Drive agora.')}</p>`; }
    };

    m.el.addEventListener('click', (e) => {
      const card = e.target.closest('[data-dp-id]');
      if (card) {
        const id = card.dataset.dpId;
        if (multi) escolha = escolha.includes(id) ? escolha.filter((x) => x !== id) : [...escolha, id];
        else escolha = escolha[0] === id ? [] : [id];
        desenhar(); atualizarBotao();
      }
    });
    m.el.addEventListener('dblclick', (e) => { const card = e.target.closest('[data-dp-id]'); if (card && !multi) { escolha = [card.dataset.dpId]; q('[data-dp-usar]').click(); } });
    q('[data-dp-pasta]').addEventListener('change', () => { escolha = []; carregarArquivos(); });
    q('[data-dp-atualizar]').addEventListener('click', carregarArquivos);
    q('[data-dp-busca]').addEventListener('input', desenhar);
    q('[data-dp-cancelar]').addEventListener('click', () => m.fechar());
    q('[data-dp-usar]').addEventListener('click', () => {
      const lista2 = escolha.map((id) => arquivos.find((f) => f.id === id)).filter(Boolean);
      terminar(lista2.length ? lista2 : null);
      m.fechar();
    });
    iniciar();
  });
}
