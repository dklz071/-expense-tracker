(() => {
  'use strict';

  const STORAGE_KEY = 'dashboard-financeiro:transacoes';

  const CATEGORIAS = {
    receita: ['Salário', 'Freelance', 'Investimentos', 'Outros'],
    despesa: ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Outros'],
  };

  const CORES = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const $ = (id) => document.getElementById(id);

  const form = $('form-transacao');
  const campoDescricao = $('descricao');
  const campoValor = $('valor');
  const campoTipo = $('tipo');
  const campoCategoria = $('categoria');
  const campoData = $('data');

  const filtroTipo = $('filtro-tipo');
  const filtroCategoria = $('filtro-categoria');
  const filtroMes = $('filtro-mes');
  const btnLimpar = $('limpar-filtros');

  const totalReceitas = $('total-receitas');
  const totalDespesas = $('total-despesas');
  const saldoEl = $('saldo');

  const tabelaCorpo = $('tabela-corpo');
  const semTransacoes = $('sem-transacoes');
  const contagem = $('contagem');

  const vazioCategorias = $('vazio-categorias');
  const vazioMensal = $('vazio-mensal');
  const avisoChart = $('aviso-chart');

  let transacoes = carregar();
  let graficoCategorias = null;
  let graficoMensal = null;

  /* ---------- Utilitários ---------- */

  function gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function hojeISO() {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  function formatarData(iso) {
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  function arredondar(n) {
    return Math.round(n * 100) / 100;
  }

  function transacaoValida(t) {
    return (
      t &&
      typeof t.id === 'string' &&
      (t.tipo === 'receita' || t.tipo === 'despesa') &&
      typeof t.descricao === 'string' &&
      typeof t.categoria === 'string' &&
      typeof t.valor === 'number' &&
      Number.isFinite(t.valor) &&
      t.valor > 0 &&
      typeof t.data === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(t.data)
    );
  }

  /* ---------- Armazenamento ---------- */

  function carregar() {
    try {
      const bruto = localStorage.getItem(STORAGE_KEY);
      if (!bruto) return [];
      const dados = JSON.parse(bruto);
      return Array.isArray(dados) ? dados.filter(transacaoValida) : [];
    } catch (erro) {
      console.error('Não foi possível ler os dados salvos:', erro);
      return [];
    }
  }

  function salvar() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transacoes));
    } catch (erro) {
      console.error('Não foi possível salvar os dados:', erro);
    }
  }

  /* ---------- Selects de categoria ---------- */

  function preencherSelect(select, categorias, incluirTodas) {
    select.innerHTML = '';
    if (incluirTodas) {
      const opt = document.createElement('option');
      opt.value = 'todas';
      opt.textContent = 'Todas';
      select.appendChild(opt);
    }
    categorias.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
  }

  function atualizarCategoriasFormulario() {
    preencherSelect(campoCategoria, CATEGORIAS[campoTipo.value], false);
  }

  function iniciarFiltroCategorias() {
    const todas = Array.from(new Set([...CATEGORIAS.receita, ...CATEGORIAS.despesa]));
    preencherSelect(filtroCategoria, todas, true);
  }

  /* ---------- Filtros ---------- */

  function obterFiltradas() {
    const tipo = filtroTipo.value;
    const categoria = filtroCategoria.value;
    const mes = filtroMes.value;

    return transacoes.filter((t) => {
      if (tipo !== 'todos' && t.tipo !== tipo) return false;
      if (categoria !== 'todas' && t.categoria !== categoria) return false;
      if (mes && !t.data.startsWith(mes)) return false;
      return true;
    });
  }

  /* ---------- Renderização ---------- */

  function renderResumo(lista) {
    let receitas = 0;
    let despesas = 0;
    lista.forEach((t) => {
      if (t.tipo === 'receita') receitas += t.valor;
      else despesas += t.valor;
    });
    receitas = arredondar(receitas);
    despesas = arredondar(despesas);
    const saldo = arredondar(receitas - despesas);

    totalReceitas.textContent = moeda.format(receitas);
    totalDespesas.textContent = moeda.format(despesas);
    saldoEl.textContent = moeda.format(saldo);
    saldoEl.classList.toggle('positivo', saldo > 0);
    saldoEl.classList.toggle('negativo', saldo < 0);
  }

  function criarCelula(texto, classe) {
    const td = document.createElement('td');
    td.textContent = texto;
    if (classe) td.className = classe;
    return td;
  }

  function renderTabela(lista) {
    tabelaCorpo.innerHTML = '';

    const ordenada = [...lista].sort((a, b) => {
      if (a.data === b.data) return 0;
      return a.data < b.data ? 1 : -1;
    });

    ordenada.forEach((t) => {
      const tr = document.createElement('tr');

      tr.appendChild(criarCelula(formatarData(t.data)));
      tr.appendChild(criarCelula(t.descricao));
      tr.appendChild(criarCelula(t.categoria));

      const tdTipo = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `badge badge-${t.tipo}`;
      badge.textContent = t.tipo === 'receita' ? 'Receita' : 'Despesa';
      tdTipo.appendChild(badge);
      tr.appendChild(tdTipo);

      const sinal = t.tipo === 'receita' ? '+ ' : '- ';
      tr.appendChild(criarCelula(sinal + moeda.format(t.valor), `direita valor-${t.tipo}`));

      const tdAcoes = document.createElement('td');
      tdAcoes.className = 'direita';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-excluir';
      btn.dataset.id = t.id;
      btn.setAttribute('aria-label', `Excluir ${t.descricao}`);
      btn.title = 'Excluir';
      btn.textContent = '🗑️';
      tdAcoes.appendChild(btn);
      tr.appendChild(tdAcoes);

      tabelaCorpo.appendChild(tr);
    });

    semTransacoes.hidden = ordenada.length > 0;
    contagem.textContent = ordenada.length > 0 ? `(${ordenada.length})` : '';
  }

  function atualizarGraficos(lista) {
    if (typeof Chart === 'undefined') {
      avisoChart.hidden = false;
      return;
    }
    avisoChart.hidden = true;

    /* Despesas por categoria */
    const porCategoria = {};
    lista.forEach((t) => {
      if (t.tipo === 'despesa') {
        porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + t.valor;
      }
    });
    const labelsCat = Object.keys(porCategoria);
    const dadosCat = labelsCat.map((k) => arredondar(porCategoria[k]));
    vazioCategorias.hidden = labelsCat.length > 0;

    if (!graficoCategorias) {
      graficoCategorias = new Chart($('grafico-categorias'), {
        type: 'doughnut',
        data: {
          labels: labelsCat,
          datasets: [{ data: dadosCat, backgroundColor: CORES, borderWidth: 2 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ${moeda.format(ctx.parsed)}`,
              },
            },
          },
        },
      });
    } else {
      graficoCategorias.data.labels = labelsCat;
      graficoCategorias.data.datasets[0].data = dadosCat;
      graficoCategorias.update();
    }

    /* Receitas x despesas por mês */
    const porMes = {};
    lista.forEach((t) => {
      const mes = t.data.slice(0, 7);
      if (!porMes[mes]) porMes[mes] = { receita: 0, despesa: 0 };
      porMes[mes][t.tipo] += t.valor;
    });
    const meses = Object.keys(porMes).sort();
    const labelsMes = meses.map((m) => `${m.slice(5)}/${m.slice(0, 4)}`);
    const dadosReceitas = meses.map((m) => arredondar(porMes[m].receita));
    const dadosDespesas = meses.map((m) => arredondar(porMes[m].despesa));
    vazioMensal.hidden = meses.length > 0;

    if (!graficoMensal) {
      graficoMensal = new Chart($('grafico-mensal'), {
        type: 'bar',
        data: {
          labels: labelsMes,
          datasets: [
            { label: 'Receitas', data: dadosReceitas, backgroundColor: '#10b981' },
            { label: 'Despesas', data: dadosDespesas, backgroundColor: '#ef4444' },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (valor) => moeda.format(valor) },
            },
          },
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${moeda.format(ctx.parsed.y)}`,
              },
            },
          },
        },
      });
    } else {
      graficoMensal.data.labels = labelsMes;
      graficoMensal.data.datasets[0].data = dadosReceitas;
      graficoMensal.data.datasets[1].data = dadosDespesas;
      graficoMensal.update();
    }
  }

  function renderizar() {
    const lista = obterFiltradas();
    renderResumo(lista);
    renderTabela(lista);
    atualizarGraficos(lista);
  }

  /* ---------- Eventos ---------- */

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();

    const descricao = campoDescricao.value.trim();
    const valor = arredondar(parseFloat(campoValor.value));
    const tipo = campoTipo.value;
    const categoria = campoCategoria.value;
    const data = campoData.value;

    if (!descricao || !Number.isFinite(valor) || valor <= 0 || !data) {
      alert('Preencha todos os campos corretamente.');
      return;
    }

    transacoes.push({ id: gerarId(), descricao, valor, tipo, categoria, data });
    salvar();

    form.reset();
    atualizarCategoriasFormulario();
    campoData.value = hojeISO();
    campoDescricao.focus();

    renderizar();
  });

  campoTipo.addEventListener('change', atualizarCategoriasFormulario);

  [filtroTipo, filtroCategoria, filtroMes].forEach((campo) => {
    campo.addEventListener('change', renderizar);
  });

  btnLimpar.addEventListener('click', () => {
    filtroTipo.value = 'todos';
    filtroCategoria.value = 'todas';
    filtroMes.value = '';
    renderizar();
  });

  tabelaCorpo.addEventListener('click', (evento) => {
    const botao = evento.target.closest('.btn-excluir');
    if (!botao) return;
    if (!confirm('Deseja realmente excluir esta transação?')) return;

    transacoes = transacoes.filter((t) => t.id !== botao.dataset.id);
    salvar();
    renderizar();
  });

  /* ---------- Início ---------- */

  atualizarCategoriasFormulario();
  iniciarFiltroCategorias();
  campoData.value = hojeISO();
  renderizar();
})();
