import { store } from '../store.js';
import { esc, toast, baixar, hojeISO } from '../util.js';
import { ic } from '../icons.js';
import { formulario, abrirModal, confirmar } from '../ui.js';
import { modeloAtual } from '../docs/contrato.js';
import { CLAUSULAS_PADRAO, PREAMBULO_PADRAO, VARIAVEIS } from '../docs/modeloContrato.js';

function editarModelo() {
  const modelo = modeloAtual();
  const opcoesQuando = ['', ...VARIAVEIS].map((v) => `<option value="${v}">${v ? `Só se “${v}” estiver preenchido` : 'Sempre aparece'}</option>`).join('');
  const linha = (cl = { titulo: '', texto: '', quando: '' }) => `<div class="card" data-cl style="box-shadow:none;border:1px solid var(--line);padding:16px;margin-bottom:12px">
    <div class="field"><label>Título da cláusula</label><input data-t value="${esc(cl.titulo)}"></div>
    <div class="field" style="margin-top:10px"><label>Texto</label><textarea data-x rows="4">${esc(cl.texto)}</textarea></div>
    <div class="field" style="margin-top:10px"><label>Quando aparece</label><select data-q>${opcoesQuando.replace(`value="${cl.quando || ''}"`, `value="${cl.quando || ''}" selected`)}</select></div>
    <button type="button" class="btn ghost sm danger" data-rm style="margin-top:8px">${ic('trash')}Remover cláusula</button></div>`;
  const corpo = `<p class="lbl" style="margin-bottom:12px">Use {{nome}} para inserir dados do contrato. Disponíveis: ${VARIAVEIS.map((v) => `<code>{{${v}}}</code>`).join(' ')}</p>
    <div class="field"><label>Abertura do contrato (partes)</label><textarea data-pre rows="5">${esc(modelo.preambulo)}</textarea></div>
    <div style="margin-top:14px" data-lista>${modelo.clausulas.map(linha).join('')}</div>
    <button type="button" class="btn sec sm" data-add>${ic('plus')}Adicionar cláusula</button>
    <div class="modal-f"><button type="button" class="btn ghost danger" data-restaurar>Restaurar modelo padrão</button><div class="actions"><button class="btn sec" data-cancelar>Cancelar</button><button class="btn pri" data-salvar>Salvar modelo</button></div></div>`;
  const m = abrirModal({ titulo: 'Modelo de contrato', subtitulo: 'Ajuste as cláusulas quando o modelo da Bôdhi estiver revisado. Vale para todos os contratos gerados daqui em diante.', corpo, largo: true });
  m.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-cancelar]')) m.fechar();
    if (e.target.closest('[data-add]')) m.el.querySelector('[data-lista]').insertAdjacentHTML('beforeend', linha());
    const rm = e.target.closest('[data-rm]');
    if (rm) rm.closest('[data-cl]').remove();
    if (e.target.closest('[data-restaurar]') && await confirmar('Voltar ao modelo padrão? As cláusulas editadas serão substituídas.', 'Restaurar', true)) {
      await store.salvarCfg('modeloContrato', { preambulo: PREAMBULO_PADRAO, clausulas: CLAUSULAS_PADRAO });
      m.fechar(); toast('Modelo padrão restaurado');
    }
    if (e.target.closest('[data-salvar]')) {
      const clausulas = [...m.el.querySelectorAll('[data-cl]')].map((c, i) => ({
        id: 'c' + i, titulo: c.querySelector('[data-t]').value.trim(), texto: c.querySelector('[data-x]').value.trim(), quando: c.querySelector('[data-q]').value,
      })).filter((c) => c.titulo && c.texto);
      await store.salvarCfg('modeloContrato', { preambulo: m.el.querySelector('[data-pre]').value.trim() || PREAMBULO_PADRAO, clausulas });
      m.fechar(); toast('Modelo de contrato salvo');
    }
  });
}

export default {
  titulo: () => 'Configurações',
  sub: () => 'Conta, dados da Bôdhi, modelo de contrato e backup.',

  render() {
    const e = store.cfg('empresa', {});
    const local = store.modo === 'local';
    return `<div class="grid">
      <div class="card c2">
        <h2>Conta</h2><p class="sub">${local ? 'Modo local: os dados ficam só neste navegador.' : 'Login com e-mail e senha. Os dados são compartilhados entre as sócias.'}</p>
        <dl class="kv" style="margin-top:0"><div><div class="k">${local ? 'Modo' : 'E-mail'}</div><div class="v">${local ? 'Local (teste)' : esc(store.emailUsuario())}</div></div>
        <div><div class="k">Banco de dados</div><div class="v">${local ? 'Neste navegador' : 'Supabase conectado'}</div></div>
        ${local ? '' : `<div><div class="k">Seu nome</div><div class="v">${esc(store.nomeUsuario() || 'Não definido')}</div></div>`}</dl>
        ${local ? '' : `<div class="actions" style="margin-top:14px"><button class="btn sec sm" data-act="alterar-nome">${ic('edit')}Alterar meu nome</button><button class="btn sec sm" data-act="sair">${ic('logout')}Sair da conta</button></div>`}
      </div>

      <div class="card c2">
        <div class="card-h"><div><h2>Dados da Bôdhi</h2><p class="sub">Usados como CONTRATADA nos contratos</p></div><button class="btn ghost sm" data-act="editar-empresa" aria-label="Editar">${ic('edit')}</button></div>
        <dl class="kv" style="margin-top:0"><div><div class="k">Razão social</div><div class="v">${esc(e.razao || 'Não preenchido')}</div></div><div><div class="k">CNPJ</div><div class="v">${esc(e.cnpj || '–')}</div></div>
        <div><div class="k">Endereço</div><div class="v">${esc(e.endereco || '–')}</div></div><div><div class="k">Representante</div><div class="v">${esc(e.representante || '–')}</div></div></dl>
      </div>

      <div class="card c2">
        <h2>Modelo de contrato</h2><p class="sub">O modelo padrão ainda está em revisão. Edite as cláusulas aqui, sem precisar de ajuda.</p>
        <button class="btn pri sm" data-act="editar-modelo">${ic('edit')}Editar modelo</button>
      </div>

      <div class="card c2">
        <h2>Backup dos dados</h2><p class="sub">Baixe uma cópia de tudo (clientes, propostas, contratos). Guarde em um lugar seguro.</p>
        <div class="actions"><button class="btn sec sm" data-act="exportar">${ic('download')}Baixar backup</button><button class="btn sec sm" data-act="importar">Restaurar de um backup</button></div>
        <input type="file" accept="application/json" hidden data-importar>
      </div>
    </div>`;
  },

  montar(el) {
    el.querySelector('[data-importar]')?.addEventListener('change', async (ev) => {
      const f = ev.target.files[0];
      if (!f) return;
      try {
        if (!(await confirmar('Restaurar este backup? Itens com o mesmo identificador serão substituídos.', 'Restaurar', true))) return;
        await store.importar(JSON.parse(await f.text()));
        toast('Backup restaurado');
      } catch (err) { toast(err.message || 'Arquivo inválido', true); }
      ev.target.value = '';
    });
  },

  acoes: {
    sair: () => store.sair(),
    'alterar-nome': () => formulario({
      titulo: 'Seu nome', subtitulo: 'Aparece na saudação do painel.',
      campos: [{ nome: 'nome', rotulo: 'Como devemos te chamar?', obrigatorio: true, cheio: true }],
      valores: { nome: store.nomeUsuario() },
      async aoSalvar(v) { await store.definirNome(v.nome); toast('Nome atualizado'); },
    }),
    exportar: () => { baixar(`backup-painel-bodhi-${hojeISO()}.json`, JSON.stringify(store.exportar(), null, 2)); toast('Backup baixado'); },
    importar: () => document.querySelector('[data-importar]')?.click(),
    'editar-modelo': editarModelo,
    'editar-empresa': () => {
      const e = store.cfg('empresa', {});
      formulario({
        titulo: 'Dados da Bôdhi',
        campos: [
          { nome: 'razao', rotulo: 'Razão social', obrigatorio: true }, { nome: 'cnpj', rotulo: 'CNPJ' },
          { nome: 'endereco', rotulo: 'Endereço', cheio: true }, { nome: 'representante', rotulo: 'Representante legal', cheio: true },
        ],
        valores: e,
        async aoSalvar(v) { await store.salvarCfg('empresa', v); toast('Dados salvos'); },
      });
    },
  },
};
