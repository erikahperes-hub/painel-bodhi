import { store } from '../store.js?v=139';
import { esc, toast, baixar, hojeISO } from '../util.js?v=139';
import { ic } from '../icons.js?v=139';
import { formulario, confirmar } from '../ui.js?v=139';

export default {
  titulo: () => 'Configurações',
  sub: () => 'Aparência, conta, dados da Bôdhi e backup.',

  render() {
    const e = store.cfg('empresa', {});
    const local = store.modo === 'local';
    const d = document.documentElement.dataset;
    const visual = d.visual === 'novo' ? 'novo' : 'antigo';
    const modo = d.modo === 'noturno' ? 'noturno' : 'claro';
    const cor = ['rosa', 'verde'].includes(d.cor) ? d.cor : 'areia';
    const op = (k, v, atual, nome) => `<button class="btn ${atual === v ? 'pri' : 'sec'}" data-act="aparencia" data-k="${k}" data-v="${v}" aria-pressed="${atual === v}">${nome}</button>`;
    return `<div class="grid">
      <div class="card c4">
        <div class="card-h"><div><h2>Aparência</h2><p class="sub">Vale só neste navegador. O visual novo tira o branco puro e dá camadas de tom; o modo noturno e as cores rosa e verde funcionam sobre o visual novo (ao escolher um deles, o visual novo liga sozinho).</p></div></div>
        <div class="aparencia">
          <div><span class="lbl">Visual</span><div class="actions">${op('visual', 'antigo', visual, 'Atual')}${op('visual', 'novo', visual, 'Novo')}</div></div>
          <div><span class="lbl">Modo</span><div class="actions">${op('modo', 'claro', modo, 'Claro')}${op('modo', 'noturno', modo, 'Noturno')}</div></div>
          <div><span class="lbl">Cor</span><div class="actions">${op('cor', 'areia', cor, 'Areia')}${op('cor', 'rosa', cor, 'Rosa')}${op('cor', 'verde', cor, 'Verde')}</div></div>
        </div>
      </div>
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
    // Guarda a escolha e recarrega a página (a logo e as cores são montadas na abertura).
    aparencia: (el) => {
      const k = ['visual', 'modo', 'cor'].includes(el.dataset.k) ? el.dataset.k : 'visual';
      try {
        localStorage.setItem(`bodhi.${k}`, el.dataset.v);
        if ((k === 'modo' && el.dataset.v === 'noturno') || (k === 'cor' && el.dataset.v !== 'areia')) localStorage.setItem('bodhi.visual', 'novo');
        if (k === 'visual' && el.dataset.v === 'antigo') { localStorage.setItem('bodhi.modo', 'claro'); localStorage.setItem('bodhi.cor', 'areia'); }
      } catch { toast('Este navegador não deixou guardar a escolha.', true); return; }
      location.reload();
    },
    sair: () => store.sair(),
    'alterar-nome': () => formulario({
      titulo: 'Seu nome', subtitulo: 'Aparece na saudação do painel.',
      campos: [{ nome: 'nome', rotulo: 'Como devemos te chamar?', obrigatorio: true, cheio: true }],
      valores: { nome: store.nomeUsuario() },
      async aoSalvar(v) { await store.definirNome(v.nome); toast('Nome atualizado'); },
    }),
    exportar: () => { baixar(`backup-painel-bodhi-${hojeISO()}.json`, JSON.stringify(store.exportar(), null, 2)); toast('Backup baixado'); },
    importar: () => document.querySelector('[data-importar]')?.click(),
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
