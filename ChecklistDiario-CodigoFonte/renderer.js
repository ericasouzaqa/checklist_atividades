let bancoDadosGeral = null;
let dataAtualSelecionada = '';
let acaoConfirmacaoPendente = null;
let inicializandoSistema = true;

// ==========================================
// ESTADO — LIXEIRA (item 2) e TRANSPORTE DE TAREFAS (item 3/4)
// Itens são identificados por uma chave estável "chaveData|idxReal"
// (a data do item + seu índice real dentro de items[]). Como restaurar
// ou mover nunca faz splice() no meio de uma lista sem já ter copiado
// o item, os índices permanecem válidos durante toda a sessão do
// modal/seleção aberta.
// ==========================================
let lixeiraFiltroAtual = 'todas';
let lixeiraSelecionados = new Set();

let modoSelecaoAtivo = false;
let itensSelecionadosTransporte = new Set();
let chaveContextoTransporte = null;

window.addEventListener('DOMContentLoaded', async () => {
  const hoje = new Date();
  dataAtualSelecionada =
    hoje.getFullYear() +
    '-' +
    String(hoje.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(hoje.getDate()).padStart(2, '0');

  document.getElementById('periodoDe').value = dataAtualSelecionada;
  document.getElementById('periodoAte').value = dataAtualSelecionada;
  document.getElementById('exportDe').value = dataAtualSelecionada;
  document.getElementById('exportAte').value = dataAtualSelecionada;

  const loaded = await window.api.loadData();

  if (loaded && loaded._erroCriticoIntegridade) {
    alert(
      'AVISO CRÍTICO:\nO arquivo de dados foi corrompido e isolado para sua segurança.\nPara evitar a perda do seu histórico, feche o aplicativo e contate o suporte antes de realizar qualquer alteração.'
    );
    bancoDadosGeral = {};
    inicializandoSistema = true;
    return;
  }

  if (loaded) {
    if (loaded.items && !loaded[dataAtualSelecionada]) {
      bancoDadosGeral = {};
      bancoDadosGeral[dataAtualSelecionada] = loaded;
    } else {
      bancoDadosGeral = loaded;
    }
  } else {
    bancoDadosGeral = {};
  }

  const corSalva = bancoDadosGeral._configCorGlobal?.color || '#FFF3B0';
  const texturaSalva = bancoDadosGeral._configCorGlobal?.texture || 'none';
  applyColorAndTexture(corSalva, texturaSalva, false);

  const labelNome = document.getElementById('titlebar-label');
  if (labelNome) {
    labelNome.setAttribute('contenteditable', 'true');
    if (bancoDadosGeral._nomeUsuario) {
      labelNome.textContent = bancoDadosGeral._nomeUsuario;
    }
    labelNome.addEventListener('blur', () => {
      bancoDadosGeral._nomeUsuario =
        labelNome.textContent.trim() || 'Checklist Diário';
      persist();
    });
    labelNome.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        labelNome.blur();
      }
    });
  }

  const seletor = document.getElementById('seletor-data');
  if (seletor) {
    seletor.value = dataAtualSelecionada;
    seletor.addEventListener('change', (e) => {
      let dataInserida = e.target.value;
      if (!dataInserida) return;
      const anoInt = parseInt(dataInserida.substring(0, 4));
      if (anoInt < 1900 || anoInt > 2100) {
        const anoAtualNormal = new Date().getFullYear();
        dataInserida = anoAtualNormal + dataInserida.substring(4);
        seletor.value = dataInserida;
      }
      dataAtualSelecionada = dataInserida;
      atualizarInterfacePorData();
    });
  }

  const flagAutoStart = document.getElementById('flagAutoStart');
  if (flagAutoStart) {
    const statusInicial = await window.api.getAutostart();
    flagAutoStart.checked = statusInicial;
    flagAutoStart.addEventListener('change', async (e) => {
      const novoStatus = await window.api.toggleAutostart(e.target.checked);
      flagAutoStart.checked = novoStatus;
    });
  }

  setupModalEvents();
  setupConfirmModalEvents();
  setupTitlebar();
  setupChecklistControls();
  setupExportLogic();
  setupFiltrosGlobais();
  setupTooltips();
  setupLixeira();
  setupTransporte();

  if (window.api && typeof window.api.onCloseRequested === 'function') {
    window.api.onCloseRequested(async () => {
      if (
        document.activeElement &&
        typeof document.activeElement.blur === 'function'
      ) {
        document.activeElement.blur();
      }
      if (typeof persist === 'function') {
        await persist();
      }
      if (typeof window.api.confirmClose === 'function') {
        window.api.confirmClose();
      }
    });
  }

  inicializandoSistema = false;
  atualizarInterfacePorData();
});

function setupModalEvents() {
  const overlay = document.getElementById('modalOverlay');
  const openBtn = document.getElementById('paletteBtn');
  const closeX = document.getElementById('closeModalX');
  const closeBtn = document.getElementById('btnSalvarModal');
  const inputCor = document.getElementById('inputCorNativa');
  const dropdownTextTextures = document.getElementById('dropdownTexturas');

  if (openBtn && overlay) {
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.classList.remove('hidden');
      overlay.classList.add('open');
    });
  }

  if (closeX && overlay) {
    closeX.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.classList.add('hidden');
      overlay.classList.remove('open');
    });
  }

  // Nota: btnSalvarModal NÃO precisa de um listener extra só para fechar —
  // o listener de salvar (linhas abaixo) já chama applyColorAndTexture(..., true)
  // que persiste, e o botão fecha o modal via o único listener consolidado
  // em btnSalvarModal mais abaixo. Listener de "fechar sem salvar" removido
  // para evitar duplo disparo no mesmo clique.

  const corModoGlobal = document.getElementById('corModoGlobal');
  const corModoLocal = document.getElementById('corModoLocal');
  const corModoPeriodo = document.getElementById('corModoPeriodo');

  if (corModoGlobal)
    corModoGlobal.addEventListener('change', sincRegrasModoCor);
  if (corModoLocal) corModoLocal.addEventListener('change', sincRegrasModoCor);
  if (corModoPeriodo)
    corModoPeriodo.addEventListener('change', sincRegrasModoCor);

  const dropdownTemas = document.getElementById('dropdownTemasPredefinidos');
  if (dropdownTemas) {
    dropdownTemas.addEventListener('change', () => {
      if (dropdownTemas.value !== 'custom') {
        if (inputCor) inputCor.value = dropdownTemas.value;
        applyColorAndTexture(
          dropdownTemas.value,
          dropdownTextTextures?.value || 'none',
          false
        );
      }
    });
  }

  if (inputCor) {
    inputCor.addEventListener('input', () => {
      if (dropdownTemas) dropdownTemas.value = 'custom';
      applyColorAndTexture(
        inputCor.value,
        dropdownTextTextures?.value || 'none',
        false
      );
    });
  }

  if (dropdownTextTextures) {
    dropdownTextTextures.addEventListener('change', () => {
      applyColorAndTexture(
        inputCor?.value || '#FFF3B0',
        dropdownTextTextures.value,
        false
      );
    });
  }

  const btnSalvarModal = document.getElementById('btnSalvarModal');
  if (btnSalvarModal) {
    btnSalvarModal.addEventListener('click', (e) => {
      e.stopPropagation();
      applyColorAndTexture(
        inputCor?.value || '#FFF3B0',
        dropdownTextTextures?.value || 'none',
        true
      );
      // Fechar o modal no mesmo listener, evitando duplo registro
      if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('open');
      }
    });
  }
}

function setupConfirmModalEvents() {
  const overlay = document.getElementById('confirmOverlay');
  const btnYes = document.getElementById('confirmYes');
  const btnNo = document.getElementById('confirmNo');

  if (btnNo && overlay) {
    btnNo.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.classList.remove('open');
      overlay.classList.add('hidden');
      acaoConfirmacaoPendente = null;
    });
  }

  if (btnYes && overlay) {
    btnYes.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.classList.remove('open');
      overlay.classList.add('hidden');
      if (typeof acaoConfirmacaoPendente === 'function') {
        acaoConfirmacaoPendente();
      }
      acaoConfirmacaoPendente = null;
    });
  }
}

function abrirCaixaConfirmacaoCustomizada(mensagem, acaoAprovada) {
  const msgEl = document.getElementById('confirmMessage');
  if (msgEl) msgEl.textContent = mensagem;
  acaoConfirmacaoPendente = acaoAprovada;
  const overlay = document.getElementById('confirmOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.classList.add('open');
  }
}

// Filtro principal (Hoje/Semana/Mês/Ano/Período) e campos de intervalo
// não tinham listener nenhum: trocar a visão não atualizava a lista sozinho.
function setupFiltrosGlobais() {
  const mainFilterSelect = document.getElementById('mainFilterSelect');
  if (mainFilterSelect) {
    mainFilterSelect.addEventListener('change', () => {
      render();
    });
  }

  const periodoDe = document.getElementById('periodoDe');
  const periodoAte = document.getElementById('periodoAte');
  if (periodoDe) periodoDe.addEventListener('change', () => render());
  if (periodoAte) periodoAte.addEventListener('change', () => render());

  const btnClearFilter = document.getElementById('btnClearFilter');
  if (btnClearFilter) {
    btnClearFilter.addEventListener('click', () => {
      const hoje = new Date();
      const hojeStr =
        hoje.getFullYear() +
        '-' +
        String(hoje.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(hoje.getDate()).padStart(2, '0');

      if (mainFilterSelect) mainFilterSelect.value = 'hoje';
      dataAtualSelecionada = hojeStr;

      const seletor = document.getElementById('seletor-data');
      if (seletor) seletor.value = hojeStr;

      atualizarInterfacePorData();
    });
  }
}

function atualizarInterfacePorData() {
  const dateLabel = document.getElementById('dateLabel');
  if (dateLabel) dateLabel.textContent = formatDate(dataAtualSelecionada);

  if (!bancoDadosGeral[dataAtualSelecionada]) {
    const corPadrao =
      bancoDadosGeral._configCorGlobal && bancoDadosGeral._configCorGlobal.color
        ? bancoDadosGeral._configCorGlobal.color
        : '#FFF3B0';
    const txtPadrao =
      bancoDadosGeral._configCorGlobal &&
      bancoDadosGeral._configCorGlobal.texture
        ? bancoDadosGeral._configCorGlobal.texture
        : 'none';

    bancoDadosGeral[dataAtualSelecionada] = {
      color: corPadrao,
      texture: txtPadrao,
      items: [
        {
          text: 'Revisar tarefas do dia',
          done: false,
          excluida: false,
          horaCriacao: '09:00',
          dataExclusao: '',
          horaExclusao: '',
        },
        {
          text: 'Verificar builds / pipelines',
          done: false,
          excluida: false,
          horaCriacao: '10:00',
          dataExclusao: '',
          horaExclusao: '',
        },
        {
          text: 'Responder mensagens pendentes',
          done: false,
          excluida: false,
          horaCriacao: '11:00',
          dataExclusao: '',
          horaExclusao: '',
        },
      ],
    };

    const rGlobal = document.getElementById('corModoGlobal');
    const rLocal = document.getElementById('corModoLocal');
    const rPeriodo = document.getElementById('corModoPeriodo');

    if (rGlobal && rLocal && rPeriodo) {
      const diaDados = bancoDadosGeral[dataAtualSelecionada];
      if (diaDados._isPeriodo) {
        rPeriodo.checked = true;
      } else if (diaDados._isExcecaoLocal) {
        rLocal.checked = true;
      } else {
        rGlobal.checked = true;
      }
    }

    const diaDados = bancoDadosGeral[dataAtualSelecionada];
    applyColorAndTexture(diaDados.color, diaDados.texture || 'none', false);

    const inputCor = document.getElementById('inputCorNativa');
    const dropdownTextTextures = document.getElementById('dropdownTexturas');
    if (inputCor) inputCor.value = diaDados.color;
    if (dropdownTextTextures)
      dropdownTextTextures.value = diaDados.texture || 'none';

    persist();
    render();
  } else {
    const diaDados = bancoDadosGeral[dataAtualSelecionada];
    applyColorAndTexture(diaDados.color, diaDados.texture || 'none', false);

    const inputCor = document.getElementById('inputCorNativa');
    const dropdownTextTextures = document.getElementById('dropdownTexturas');
    if (inputCor) inputCor.value = diaDados.color;
    if (dropdownTextTextures)
      dropdownTextTextures.value = diaDados.texture || 'none';

    render();
  }
}

function sincRegrasModoCor() {
  const rLocal = document.getElementById('corModoLocal');
  const rPeriodo = document.getElementById('corModoPeriodo');
  if (!bancoDadosGeral[dataAtualSelecionada]) return;

  if (rLocal && rLocal.checked) {
    bancoDadosGeral[dataAtualSelecionada]._isExcecaoLocal = true;
    bancoDadosGeral[dataAtualSelecionada]._isPeriodo = false;
  } else if (rPeriodo && rPeriodo.checked) {
    bancoDadosGeral[dataAtualSelecionada]._isPeriodo = true;
    bancoDadosGeral[dataAtualSelecionada]._isExcecaoLocal = false;
  } else {
    bancoDadosGeral[dataAtualSelecionada]._isExcecaoLocal = false;
    bancoDadosGeral[dataAtualSelecionada]._isPeriodo = false;
    if (bancoDadosGeral._configCorGlobal) {
      applyColorAndTexture(
        bancoDadosGeral._configCorGlobal.color,
        bancoDadosGeral._configCorGlobal.texture || 'none',
        true
      );
    }
  }
  persist();
}

function formatDate(dataStr) {
  const dias = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  const meses = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  const d = new Date(dataStr + 'T00:00:00');
  return `${dias[d.getDay()]} , ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

// Nome da aba do XLSX ("Setembro_2026") a partir de uma chave "AAAA-MM-DD"
// — mesma lista de meses do formatDate acima, só que exposta como função
// própria porque a exportação precisa dela fora do escopo de formatDate.
function nomeMesAno(dataStr) {
  const meses = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  const d = new Date(dataStr + 'T00:00:00');
  return `${meses[d.getMonth()]}_${d.getFullYear()}`;
}

async function persist() {
  if (inicializandoSistema) return;
  await window.api.saveData(bancoDadosGeral);
}

// Reaproveitada pelo render() (visão da tela) e pela exportação (CSV/XLSX),
// para que ambos sempre respeitem exatamente o mesmo filtro ativo.
function obterChavesPorFiltro() {
  const mainFilter =
    document.getElementById('mainFilterSelect')?.value || 'hoje';
  const hojeStr = dataAtualSelecionada;
  const dataRef = new Date(hojeStr + 'T00:00:00');
  let chaves = [];

  if (mainFilter === 'hoje') {
    chaves = [hojeStr];
  } else if (mainFilter === 'semana') {
    const diaSemana = dataRef.getDay();
    const inicioSemana = new Date(dataRef);
    inicioSemana.setDate(dataRef.getDate() - diaSemana);
    for (let i = 0; i < 7; i++) {
      const dStr =
        inicioSemana.getFullYear() +
        '-' +
        String(inicioSemana.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(inicioSemana.getDate()).padStart(2, '0');
      chaves.push(dStr);
      inicioSemana.setDate(inicioSemana.getDate() + 1);
    }
  } else if (mainFilter === 'mes') {
    const prefixoMes = hojeStr.substring(0, 7);
    chaves = Object.keys(bancoDadosGeral).filter((k) =>
      k.startsWith(prefixoMes)
    );
  } else if (mainFilter === 'ano') {
    const prefixoAno = hojeStr.substring(0, 4);
    chaves = Object.keys(bancoDadosGeral).filter((k) =>
      k.startsWith(prefixoAno)
    );
  } else if (mainFilter === 'periodo') {
    const de = document.getElementById('periodoDe')?.value;
    const ate = document.getElementById('periodoAte')?.value;
    chaves = Object.keys(bancoDadosGeral).filter((k) => k >= de && k <= ate);
  }

  return { mainFilter, chaves };
}

function render() {
  const list = document.getElementById('list');
  if (!list) return;
  list.innerHTML = '';

  const { mainFilter, chaves: chavesParaRenderizar } = obterChavesPorFiltro();

  const cc = document.getElementById('containerCamposPeriodo');
  if (cc) cc.style.display = mainFilter === 'periodo' ? 'flex' : 'none';

  // Item 1 da auditoria (responsividade): em janelas largas, a visão
  // "Hoje" (que suporta arrastar-para-reordenar, dependente de posição
  // vertical) continua em coluna única; as demais visões (que só juntam
  // vários dias, sem drag-and-drop) viram um grid fluido — os cards
  // aproveitam o espaço extra em vez de deixá-lo vazio.
  list.classList.toggle('modo-grid', mainFilter !== 'hoje');

  const fragment = document.createDocumentFragment();
  chavesParaRenderizar.sort().forEach((chaveData) => {
    if (!bancoDadosGeral[chaveData] || !bancoDadosGeral[chaveData].items)
      return;
    const ativos = bancoDadosGeral[chaveData].items.filter((i) => !i.excluida);
    if (ativos.length === 0) return;

    // No filtro "Hoje" a data já aparece em #dateLabel, logo acima da
    // lista — repetir aqui duplicava a mesma informação (item 1 da
    // auditoria). Nos demais filtros (Semana/Mês/Ano/Período), que juntam
    // vários dias na mesma lista, o header continua necessário.
    if (mainFilter !== 'hoje') {
      const headerData = document.createElement('div');
      headerData.className = 'historico-data-header';
      headerData.innerHTML = `🗓️ <span>${formatDate(chaveData)}</span>`;
      fragment.appendChild(headerData);
    }

    ativos.forEach((item) => {
      const idxReal = bancoDadosGeral[chaveData].items.indexOf(item);
      const row = document.createElement('div');
      row.className = 'item' + (item.done ? ' done' : '');
      // dataset precisa existir em QUALQUER filtro (não só "Hoje"), pois o
      // Transporte de Tarefas (Ctrl+clique e menu de contexto) e a Lixeira
      // dependem dele para identificar a tarefa em qualquer visão.
      row.dataset.indexReal = idxReal;
      row.dataset.chaveData = chaveData;

      // Arrastar-para-reordenar só faz sentido na visão "Hoje" e fica
      // desligado durante o modo de seleção do Transporte: arrastar mudaria
      // a ordem/índices dos itens enquanto uma seleção por índice está
      // ativa, dessincronizando o que está marcado.
      if (mainFilter === 'hoje' && !modoSelecaoAtivo) {
        row.draggable = true;
        row.addEventListener('dragstart', (e) => {
          row.classList.add('dragging');
          e.dataTransfer.setData('text/plain', idxReal);
        });
        row.addEventListener('dragend', () => {
          row.classList.remove('dragging');
        });
      }

      const chaveTransporte = chaveData + '|' + idxReal;
      // O Transporte move tarefas PENDENTES para outro dia (mover uma
      // tarefa já concluída não faz sentido de produto) — mantém coerência
      // com o tooltip do botão "Mover" no rodapé.
      const podeTransportar = !item.done;

      if (podeTransportar) {
        // Gatilho 2 do Transporte (Ctrl/Cmd+clique) e seleção por clique
        // simples quando o modo já está ativo ("Selecionar individualmente").
        row.addEventListener('click', (e) => {
          if (e.target.closest('input, button, a')) return;
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (!modoSelecaoAtivo) ativarModoSelecaoTransporte();
            toggleSelecaoTransporte(chaveTransporte);
            render();
            return;
          }
          if (modoSelecaoAtivo) {
            toggleSelecaoTransporte(chaveTransporte);
            render();
          }
        });

        // Gatilho 3 do Transporte: clique-direito abre "Mover para...".
        row.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          abrirMenuContexto(e.clientX, e.clientY, chaveTransporte);
        });

        if (modoSelecaoAtivo) {
          row.classList.add('selecionavel');
          const selectCb = document.createElement('input');
          selectCb.type = 'checkbox';
          selectCb.className = 'item-select-checkbox';
          selectCb.checked = itensSelecionadosTransporte.has(chaveTransporte);
          selectCb.setAttribute('data-tooltip', 'Selecionar para mover');
          selectCb.addEventListener('change', (e) => {
            e.stopPropagation();
            toggleSelecaoTransporte(chaveTransporte);
          });
          row.appendChild(selectCb);
        }
      }

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = item.done;
      cb.addEventListener('change', () => {
        bancoDadosGeral[chaveData].items[idxReal].done = cb.checked;
        // Uma tarefa concluída sai automaticamente da seleção do
        // Transporte (que só move tarefas pendentes).
        if (cb.checked) itensSelecionadosTransporte.delete(chaveTransporte);
        persist();
        render();
      });

      const txt = document.createElement('div');
      txt.className = 'item-text';
      txt.textContent = item.text;

      const editBtn = document.createElement('button');
      editBtn.className = 'edit-btn';
      editBtn.innerHTML = '✏️';
      editBtn.style.webkitAppRegion = 'no-drag';
      editBtn.setAttribute('data-tooltip', 'Editar tarefa');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        abrirModalEdicaoTarefa(chaveData, idxReal);
      });

      const del = document.createElement('button');
      del.className = 'del-btn';
      del.textContent = '✕';
      del.style.webkitAppRegion = 'no-drag';
      del.setAttribute('data-tooltip', 'Remover tarefa');
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        abrirCaixaConfirmacaoCustomizada(
          `Remover a tarefa "${item.text}"?`,
          () => {
            const agora = new Date();
            bancoDadosGeral[chaveData].items[idxReal].excluida = true;
            bancoDadosGeral[chaveData].items[idxReal].dataExclusao = chaveData;
            bancoDadosGeral[chaveData].items[idxReal].horaExclusao =
              String(agora.getHours()).padStart(2, '0') +
              ':' +
              String(agora.getMinutes()).padStart(2, '0');
            itensSelecionadosTransporte.delete(chaveData + '|' + idxReal);
            persist();
            render();
          }
        );
      });

      row.appendChild(cb);
      row.appendChild(txt);
      row.appendChild(editBtn);
      row.appendChild(del);
      fragment.appendChild(row);
    });
  });

  list.appendChild(fragment);
  if (mainFilter === 'hoje') {
    const novaLista = list.cloneNode(false);
    while (list.firstChild) novaLista.appendChild(list.firstChild);
    list.parentNode.replaceChild(novaLista, list);

    novaLista.addEventListener('dragover', (e) => {
      e.preventDefault();
      const draggingItem = document.querySelector('.dragging');
      if (!draggingItem) return;

      const siblings = [...novaLista.querySelectorAll('.item:not(.dragging)')];
      const nextSibling = siblings.find((sibling) => {
        return (
          e.clientY <=
          sibling.getBoundingClientRect().top +
            sibling.getBoundingClientRect().height / 2
        );
      });
      novaLista.insertBefore(draggingItem, nextSibling);
    });

    novaLista.addEventListener('drop', async (e) => {
      e.preventDefault();
      const currentDOMItems = novaLista.querySelectorAll('.item');
      if (currentDOMItems.length === 0) return;

      const chaveData = currentDOMItems[0].dataset.chaveData;
      const listaOriginal = bancoDadosGeral[chaveData].items;
      const novaOrdemItems = [];

      currentDOMItems.forEach((itemEl) => {
        const idxReal = parseInt(itemEl.dataset.indexReal);
        novaOrdemItems.push(listaOriginal[idxReal]);
      });

      listaOriginal.forEach((item) => {
        if (item.excluida) {
          novaOrdemItems.push(item);
        }
      });

      bancoDadosGeral[chaveData].items = novaOrdemItems;
      await persist();
      render();
    });
  }

  const dadosDoDia = bancoDadosGeral[dataAtualSelecionada] || { items: [] };
  const ativosDia = dadosDoDia.items.filter((i) => !i.excluida);
  const totalAtivos = ativosDia.length;
  const doneCount = ativosDia.filter((i) => i.done).length;
  const pct =
    totalAtivos === 0 ? 0 : Math.round((doneCount / totalAtivos) * 100);

  const pbf = document.getElementById('progressBarFill');
  if (pbf) pbf.style.width = pct + '%';
  const pt = document.getElementById('progresso-texto');
  if (pt) pt.textContent = `Metas concluídas: ${pct}%`;

  const medalhaTxt = document.getElementById('medalha-texto');
  if (medalhaTxt) {
    if (totalAtivos === 0) medalhaTxt.textContent = '📝 Lista limpa!';
    else if (pct <= 30) medalhaTxt.textContent = '🐢 Devagar e sempre!';
    else if (pct <= 69)
      medalhaTxt.textContent = '⚡ No ritmo! Boa produtividade!';
    else if (pct <= 99) medalhaTxt.textContent = '🎯 Foco total! Quase lá!';
    else medalhaTxt.textContent = '🏆 PRODUTIVIDADE MÁXIMA!';
  }

  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.textContent =
      totalAtivos > 0 && doneCount === totalAtivos
        ? 'DESMARCAR TUDO'
        : 'SELECIONAR TUDO';
  }

  // Corrige o item 3 da auditoria: "0 selecionada(s)" não refletia os
  // itens marcados. A contagem agora é recalculada sempre que a lista é
  // redesenhada, além de a cada toggle individual (ver
  // atualizarContadorTransporte).
  atualizarContadorTransporte();
}

function setupChecklistControls() {
  const input = document.getElementById('newItemInput');
  const add = () => {
    const v = input?.value.trim();
    if (!v) return;
    if (!bancoDadosGeral[dataAtualSelecionada]) atualizarInterfacePorData();

    const agora = new Date();
    const horaAtualStr =
      String(agora.getHours()).padStart(2, '0') +
      ':' +
      String(agora.getMinutes()).padStart(2, '0');

    bancoDadosGeral[dataAtualSelecionada].items.push({
      text: v,
      done: false,
      excluida: false,
      horaCriacao: horaAtualStr,
      dataExclusao: '',
      horaExclusao: '',
    });
    if (input) input.value = '';
    persist();
    render();
  };

  const addBtn = document.getElementById('addBtn');
  if (addBtn) {
    addBtn.setAttribute('data-tooltip', 'Adicionar tarefa');
    addBtn.addEventListener('click', add);
  }
  if (input)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') add();
    });

  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.setAttribute('data-tooltip', 'Marcar ou desmarcar todas');
    resetBtn.addEventListener('click', () => {
      const dadosDoDia = bancoDadosGeral[dataAtualSelecionada];
      if (!dadosDoDia) return;
      const ativos = dadosDoDia.items.filter((i) => !i.excluida);
      const todosMarcados = ativos.length > 0 && ativos.every((i) => i.done);
      dadosDoDia.items.forEach((item, idx) => {
        if (!item.excluida)
          bancoDadosGeral[dataAtualSelecionada].items[idx].done =
            !todosMarcados;
      });
      persist();
      render();
    });
  }

  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) {
    clearBtn.setAttribute(
      'data-tooltip',
      'Apaga apenas os itens já concluídos'
    );
    clearBtn.addEventListener('click', () => {
      const dadosDoDia = bancoDadosGeral[dataAtualSelecionada];
      if (!dadosDoDia) return;
      const ativosConcluidos = dadosDoDia.items.filter(
        (i) => !i.excluida && i.done
      );
      if (ativosConcluidos.length === 0) return;

      abrirCaixaConfirmacaoCustomizada(
        `Apagar as ${ativosConcluidos.length} tarefas selecionadas (concluídas)?`,
        () => {
          const agora = new Date();
          dadosDoDia.items.forEach((item, idx) => {
            if (!item.excluida && item.done) {
              bancoDadosGeral[dataAtualSelecionada].items[idx].excluida = true;
              bancoDadosGeral[dataAtualSelecionada].items[idx].dataExclusao =
                dataAtualSelecionada;
              bancoDadosGeral[dataAtualSelecionada].items[idx].horaExclusao =
                String(agora.getHours()).padStart(2, '0') +
                ':' +
                String(agora.getMinutes()).padStart(2, '0');
              itensSelecionadosTransporte.delete(dataAtualSelecionada + '|' + idx);
            }
          });
          persist();
          render();
        }
      );
    });
  }

  const clearAllBtn = document.getElementById('clearAllBtn');
  if (clearAllBtn) {
    clearAllBtn.setAttribute('data-tooltip', 'Apagar todas as tarefas do dia');
    clearAllBtn.addEventListener('click', () => {
      const dadosDoDia = bancoDadosGeral[dataAtualSelecionada];
      if (!dadosDoDia) return;
      const ativos = dadosDoDia.items.filter((i) => !i.excluida);
      if (ativos.length === 0) return;

      abrirCaixaConfirmacaoCustomizada(
        'Tem certeza que deseja apagar TODAS as atividades deste dia?',
        () => {
          const agora = new Date();
          dadosDoDia.items.forEach((item, idx) => {
            if (!item.excluida) {
              bancoDadosGeral[dataAtualSelecionada].items[idx].excluida = true;
              bancoDadosGeral[dataAtualSelecionada].items[idx].dataExclusao =
                dataAtualSelecionada;
              bancoDadosGeral[dataAtualSelecionada].items[idx].horaExclusao =
                String(agora.getHours()).padStart(2, '0') +
                ':' +
                String(agora.getMinutes()).padStart(2, '0');
              itensSelecionadosTransporte.delete(dataAtualSelecionada + '|' + idx);
            }
          });
          persist();
          render();
        }
      );
    });
  }
}

function setupTitlebar() {
  const pinBtn = document.getElementById('pinBtn');
  let pinned = false;
  if (pinBtn) {
    pinBtn.addEventListener('click', async () => {
      pinned = await window.api.togglePin(!pinned);
      pinBtn.classList.toggle('active', pinned);
    });
  }
  const minBtn = document.getElementById('minBtn');
  if (minBtn) {
    minBtn.addEventListener('click', () => {
      window.api.minimize();
    });
  }
  const closeBtn = document.getElementById('closeBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.api.closeApp();
    });
  }
}

// Antes desta função não existir de fato (apenas era chamada), o
// ReferenceError interrompia toda a inicialização do app.
function setupExportLogic() {
  const overlay = document.getElementById('exportModalOverlay');
  const openBtn = document.getElementById('openExportModalBtn');
  const closeX = document.getElementById('closeExportModalX');
  const btnCSV = document.getElementById('btnExportarCSV');
  const btnXLSX = document.getElementById('btnExportarXLSX');

  if (openBtn && overlay) {
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.classList.remove('hidden');
      overlay.classList.add('open');
    });
  }

  if (closeX && overlay) {
    closeX.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.classList.add('hidden');
      overlay.classList.remove('open');
    });
  }

  function coletarDadosParaExportacao() {
    const { chaves } = obterChavesPorFiltro();
    const linhas = [];
    chaves.sort().forEach((chaveData) => {
      const dia = bancoDadosGeral[chaveData];
      if (!dia || !dia.items) return;
      dia.items.forEach((item) => {
        const status = item.excluida
          ? 'Excluída'
          : item.done
            ? 'Concluída'
            : 'Pendente';
        linhas.push({
          data: chaveData,
          tarefa: item.text,
          status,
          horaCriacao: item.horaCriacao || '',
          observacoes: item.observacoes || '',
          dataExclusao: item.dataExclusao || '',
          horaExclusao: item.horaExclusao || '',
        });
      });
    });
    return linhas;
  }

  function fecharModalExport() {
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.classList.remove('open');
  }

  if (btnCSV) {
    btnCSV.addEventListener('click', async () => {
      const linhas = coletarDadosParaExportacao();
      if (linhas.length === 0) {
        alert('Não há tarefas para exportar no filtro de visão selecionado.');
        return;
      }
      const escapar = (v) =>
        String(v).replace(/;/g, ',').replace(/\r?\n/g, ' ');
      const header =
        'Data;Tarefa;Status;Hora de Criacao;Observacoes;Data de Exclusao;Hora de Exclusao';
      const corpo = linhas
        .map((l) =>
          [
            l.data,
            l.tarefa,
            l.status,
            l.horaCriacao,
            l.observacoes,
            l.dataExclusao,
            l.horaExclusao,
          ]
            .map(escapar)
            .join(';')
        )
        .join('\n');
      const csvFinal = header + '\n' + corpo;
      const resultado = await window.api.exportCsv(csvFinal);
      if (resultado && resultado.success) {
        fecharModalExport();
      } else if (resultado && resultado.error) {
        alert('Não foi possível exportar o CSV: ' + resultado.error);
      }
    });
  }

  if (btnXLSX) {
    btnXLSX.addEventListener('click', async () => {
      const linhas = coletarDadosParaExportacao();
      if (linhas.length === 0) {
        alert('Não há tarefas para exportar no filtro de visão selecionado.');
        return;
      }
      // Agrupa por "Mês_Ano" (ex.: "Setembro_2026") — cada chave vira uma
      // aba no workbook, montado no processo principal (main.js já tem
      // "xlsx" como dependency real e expõe 'export-xlsx-multi' via
      // preload). Não existe mais nenhuma lib XLSX carregada aqui no
      // renderer, então gerar o workbook no próprio browser (como o
      // código antigo tentava) nunca funcionava.
      const dadosPorMes = {};
      linhas.forEach((l) => {
        const aba = nomeMesAno(l.data);
        if (!dadosPorMes[aba]) dadosPorMes[aba] = [];
        dadosPorMes[aba].push({
          Data: l.data,
          Tarefa: l.tarefa,
          Status: l.status,
          'Hora de Criação': l.horaCriacao,
          Observações: l.observacoes,
          'Data de Exclusão': l.dataExclusao,
          'Hora de Exclusão': l.horaExclusao,
        });
      });
      const resultado = await window.api.exportXlsxMulti(dadosPorMes);
      if (resultado && resultado.success) {
        fecharModalExport();
      } else if (resultado && resultado.error) {
        alert('Não foi possível exportar o Excel: ' + resultado.error);
      }
    });
  }
}

// ==========================================
// PALETA DERIVADA — geração automática de todos os papéis de cor a
// partir da ÚNICA cor escolhida pela usuária (--note-bg), com contraste
// garantido (WCAG AA) para qualquer tom, não só para o tema padrão.
//
// Antes, cada papel (--palette-accent, --palette-border-strong, etc.)
// era calculado direto no CSS via color-mix() com uma proporção fixa
// (ex.: 45% base + 55% texto). Isso funciona bem para alguns tons, mas
// não garante nada: dependendo da cor escolhida, o resultado podia cair
// abaixo do mínimo de contraste — foi exatamente o que aconteceu com o
// botão primário no tema padrão "Amarelo Post-it" (4.23:1, abaixo do
// 4.5:1 exigido). color-mix() no CSS não tem como "testar e corrigir";
// só sabe misturar. Por isso a geração migrou pra cá: em JS dá pra
// calcular a razão de contraste real (fórmula WCAG) e ajustar a
// luminosidade da cor até o mínimo ser atingido, sem depender de sorte.
// ==========================================

function hexParaRgb(hex) {
  const num = parseInt(hex.replace('#', ''), 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbParaHex({ r, g, b }) {
  const canal = (v) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return '#' + canal(r) + canal(g) + canal(b);
}

// Mesma lógica do color-mix(in srgb, A p%, B (100-p)%) que já era usada
// no style.css — interpolação linear direta por canal, sem correção de
// gama. Mantido idêntico para os papéis que só migraram de CSS pra JS,
// pra não mudar a aparência do que já funcionava.
function misturarRgb(a, b, pesoA) {
  return {
    r: a.r * pesoA + b.r * (1 - pesoA),
    g: a.g * pesoA + b.g * (1 - pesoA),
    b: a.b * pesoA + b.b * (1 - pesoA),
  };
}

// Luminância relativa oficial do WCAG 2.x — não confundir com o YIQ
// (usado só para a decisão rápida preto/branco do texto principal).
// É a base da fórmula de razão de contraste abaixo.
function luminanciaRelativa({ r, g, b }) {
  const canal = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function razaoContraste(rgbA, rgbB) {
  const l1 = luminanciaRelativa(rgbA);
  const l2 = luminanciaRelativa(rgbB);
  const claro = Math.max(l1, l2);
  const escuro = Math.min(l1, l2);
  return (claro + 0.05) / (escuro + 0.05);
}

function rgbParaHsl({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslParaRgb({ h, s, l }) {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue2rgb(p, q, h + 1 / 3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1 / 3) * 255,
  };
}

// Empurra a luminosidade de rgbCor pra longe de rgbReferencia, em
// pequenos passos, até bater o mínimo de contraste entre as duas —
// ou até a luminosidade encostar no teto/piso (cor "impossível" de
// acertar só ajustando L; devolve o melhor resultado encontrado em vez
// de girar num loop infinito ou virar preto/branco puro).
function ajustarContrasteContra(rgbCor, rgbReferencia, minimo) {
  let atual = rgbCor;
  let razao = razaoContraste(atual, rgbReferencia);
  if (razao >= minimo) return atual;

  let hsl = rgbParaHsl(rgbCor);
  const luminanciaRef = luminanciaRelativa(rgbReferencia);
  const passo = luminanciaRef > 0.5 ? -0.03 : 0.03;

  let tentativas = 0;
  while (razao < minimo && tentativas < 24) {
    const novoL = hsl.l + passo;
    if (novoL <= 0.04 || novoL >= 0.96) break;
    hsl = { ...hsl, l: novoL };
    atual = hslParaRgb(hsl);
    razao = razaoContraste(atual, rgbReferencia);
    tentativas++;
  }
  return atual;
}

// Igual em espírito ao anterior, mas para cores cujo texto por cima
// ainda não foi decidido (ex.: o botão principal) — testa preto e
// branco quase-puros a cada passo e ajusta na direção do que já está
// vencendo, até alcançar o mínimo (AA = 4.5:1 para texto normal).
function garantirContrasteAA(rgbBase, minimo) {
  const pretoTexto = { r: 26, g: 26, b: 26 };
  const brancoTexto = { r: 255, g: 255, b: 255 };

  let hsl = rgbParaHsl(rgbBase);
  let atual = rgbBase;
  const melhorTextoPara = (cor) =>
    razaoContraste(cor, pretoTexto) >= razaoContraste(cor, brancoTexto)
      ? pretoTexto
      : brancoTexto;

  let textoEscolhido = melhorTextoPara(atual);
  let razao = razaoContraste(atual, textoEscolhido);

  let tentativas = 0;
  while (razao < minimo && tentativas < 24) {
    // Texto branco vencendo → fundo precisa escurecer. Texto preto
    // vencendo → fundo precisa clarear.
    const passo = textoEscolhido === brancoTexto ? -0.03 : 0.03;
    const novoL = hsl.l + passo;
    if (novoL <= 0.06 || novoL >= 0.94) break;
    hsl = { ...hsl, l: novoL };
    atual = hslParaRgb(hsl);
    textoEscolhido = melhorTextoPara(atual);
    razao = razaoContraste(atual, textoEscolhido);
    tentativas++;
  }
  return { cor: atual, texto: textoEscolhido };
}

// Monta os 8 papéis de cor (texto, borda, superfície, card, hover,
// principal, secundária, destaque) a partir da única cor de base.
function gerarPaleta(hex) {
  const base = hexParaRgb(hex);
  const yiq = (base.r * 299 + base.g * 587 + base.b * 114) / 1000;
  const claro = yiq >= 128;
  const texto = claro ? { r: 26, g: 26, b: 26 } : { r: 255, g: 255, b: 255 };

  // Papéis que já existiam — mesma fórmula/proporção de antes, só
  // centralizada aqui junto com o resto da paleta.
  const subTexto = claro ? { r: 85, g: 85, b: 85 } : { r: 208, g: 208, b: 208 };
  const bordaAlpha = claro ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)';
  const cardAlpha = claro ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.25)';
  const cardHoverAlpha = claro ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.4)';
  const modalSolido = claro
    ? { r: 255, g: 255, b: 255 }
    : { r: 30, g: 30, b: 30 };
  const inputBgAlpha = claro ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)';

  // Superfície (topbar / rodapé / barra de seleção) — um tom a mais de
  // profundidade que os cards, misturando base + texto.
  const superficie = misturarRgb(base, texto, 0.84);

  // Principal: mesmo ponto de partida de antes (45% base + 55% texto),
  // mas agora com o par de texto escolhido e a luminosidade ajustada
  // até garantir AA 4.5:1 — corrige o contraste insuficiente do botão
  // primário relatado na auditoria, em qualquer cor escolhida.
  const principalCru = misturarRgb(base, texto, 0.45);
  const { cor: principal, texto: principalTexto } = garantirContrasteAA(
    principalCru,
    4.5
  );

  // Hover do principal: desloca a luminosidade mais um pouco no sentido
  // oposto ao texto escolhido (clareia se o texto é branco, escurece se
  // é preto) — dá feedback visível de hover sem arriscar derrubar o
  // contraste já garantido acima.
  const principalHsl = rgbParaHsl(principal);
  const direcaoHover = principalTexto.r === 255 ? 0.1 : -0.1;
  const principalHover = hslParaRgb({
    ...principalHsl,
    l: Math.max(0.05, Math.min(0.95, principalHsl.l + direcaoHover)),
  });

  // Secundária (ações de segundo nível — "Exportar CSV", "Não"): mistura
  // mais leve que a principal, próxima da superfície mas com identidade
  // própria, também garantida contra o --text-color global (que é quem
  // fica escrito por cima dela).
  const secundariaCrua = misturarRgb(base, texto, 0.72);
  const secundaria = ajustarContrasteContra(secundariaCrua, texto, 4.5);

  // Destaque (foco de campos, seleção, links): mesma luminosidade/
  // saturação do principal, com o matiz girado ~150° — fica claramente
  // diferente da cor de ação primária sem depender de uma segunda cor
  // escolhida manualmente. Ajustada para permanecer visível (3:1, o
  // mínimo AA para elementos gráficos/bordas) sobre a superfície.
  const destaqueHsl = rgbParaHsl(principal);
  const destaqueCru = hslParaRgb({
    ...destaqueHsl,
    h: (destaqueHsl.h + 150 / 360) % 1,
  });
  const destaque = ajustarContrasteContra(destaqueCru, superficie, 3);

  return {
    texto: rgbParaHex(texto),
    subTexto: rgbParaHex(subTexto),
    bordaAlpha,
    cardAlpha,
    cardHoverAlpha,
    modalSolido: rgbParaHex(modalSolido),
    inputBgAlpha,
    superficie: rgbParaHex(superficie),
    principal: rgbParaHex(principal),
    principalHover: rgbParaHex(principalHover),
    principalTexto: rgbParaHex(principalTexto),
    secundaria: rgbParaHex(secundaria),
    destaque: rgbParaHex(destaque),
    // "R, G, B" cru (sem rgb()/rgba() em volta) para as texturas Mármore
    // e Glitter montarem rgba(var(--textura-overlay-rgb), alpha) no CSS
    // — é o mesmo texto.r/g/b já escolhido por contraste (YIQ) acima,
    // então a sobreposição das texturas acompanha automaticamente o
    // brilho do tema, em vez de usar preto ou branco fixos.
    overlayRgb: `${Math.round(texto.r)}, ${Math.round(texto.g)}, ${Math.round(texto.b)}`,
  };
}

function applyColorAndTexture(hex, textura, save) {
  if (!hex || hex === 'undefined') hex = '#FFF3B0';
  if (!textura) textura = 'none';
  // Não bloqueia a aplicação visual quando a chave do dia ainda não existe:
  // a cor e a textura são propriedades do DOM (CSS vars) e devem ser
  // aplicadas independentemente do estado do banco. Só o bloco "save"
  // precisa do dado da data — e é guardado pelo próprio if (save) abaixo.
  if (save && (!bancoDadosGeral || !bancoDadosGeral[dataAtualSelecionada]))
    return;

  document.documentElement.style.setProperty('--note-bg', hex);

  const paleta = gerarPaleta(hex);

  document.documentElement.style.setProperty('--text-color', paleta.texto);
  document.documentElement.style.setProperty(
    '--sub-text-color',
    paleta.subTexto
  );
  document.documentElement.style.setProperty(
    '--border-alpha',
    paleta.bordaAlpha
  );
  document.documentElement.style.setProperty('--bg-alpha', paleta.cardAlpha);
  document.documentElement.style.setProperty(
    '--bg-hover-alpha',
    paleta.cardHoverAlpha
  );
  document.documentElement.style.setProperty('--modal-bg', paleta.modalSolido);
  document.documentElement.style.setProperty(
    '--input-bg-alpha',
    paleta.inputBgAlpha
  );

  // Papéis novos/recalculados da paleta derivada — ver gerarPaleta().
  // Setados via inline style em :root, por isso sempre vencem os
  // fallbacks em color-mix() que ficam no style.css (que só valem no
  // instante antes desta função rodar pela primeira vez).
  document.documentElement.style.setProperty(
    '--palette-surface-2',
    paleta.superficie
  );
  document.documentElement.style.setProperty(
    '--palette-accent',
    paleta.principal
  );
  document.documentElement.style.setProperty(
    '--palette-accent-hover',
    paleta.principalHover
  );
  document.documentElement.style.setProperty(
    '--palette-accent-text',
    paleta.principalTexto
  );
  document.documentElement.style.setProperty(
    '--palette-secundaria',
    paleta.secundaria
  );
  document.documentElement.style.setProperty(
    '--palette-border-strong',
    paleta.destaque
  );
  document.documentElement.style.setProperty(
    '--textura-overlay-rgb',
    paleta.overlayRgb
  );

  // Antes de aplicar a textura nova, limpa qualquer resíduo da textura
  // anterior. Sem isso, --neon-glow ou --gradiente-bg ficavam "grudados"
  // para sempre depois de usados uma vez, mesmo trocando para outro
  // tema/textura depois (nenhum código aqui nunca chamava
  // removeProperty()). O mesmo vale agora para as classes de textura no
  // body: glass/mármore/glitter deixaram de ser aplicadas via
  // document.body.style direto (que só consegue mexer em UMA
  // propriedade por vez e não tinha como reagir ao tema) e passaram a
  // ser classes CSS, então a limpeza também precisa remover a classe
  // anterior antes de aplicar a nova.
  document.documentElement.style.removeProperty('--neon-glow');
  document.documentElement.style.removeProperty('--gradiente-bg');
  document.body.classList.remove(
    'textura-glass',
    'textura-marmore',
    'textura-glitter'
  );

  if (textura === 'glass' || textura === 'marmore' || textura === 'glitter') {
    document.body.classList.add('textura-' + textura);
  } else if (textura === 'neon') {
    document.documentElement.style.setProperty(
      '--neon-glow',
      `0 0 20px ${hex}, inset 0 0 10px ${hex}`
    );
  } else if (textura === 'gradiente') {
    document.documentElement.style.setProperty(
      '--gradiente-bg',
      `linear-gradient(135deg, ${hex} 0%, rgba(26,26,26,0.85) 100%)`
    );
  }

  if (save) {
    const rLocal = document.getElementById('corModoLocal');
    const rPeriodo = document.getElementById('corModoPeriodo');

    if (rLocal && rLocal.checked) {
      bancoDadosGeral[dataAtualSelecionada].color = hex;
      bancoDadosGeral[dataAtualSelecionada].texture = textura;
      bancoDadosGeral[dataAtualSelecionada]._isExcecaoLocal = true;
      bancoDadosGeral[dataAtualSelecionada]._isPeriodo = false;
    } else if (rPeriodo && rPeriodo.checked) {
      const de = document.getElementById('periodoDe')?.value;
      const ate = document.getElementById('periodoAte')?.value;
      const dataInicio = new Date(de + 'T00:00:00');
      const dataFim = new Date(ate + 'T00:00:00');
      for (
        let d = new Date(dataInicio);
        d <= dataFim;
        d.setDate(d.getDate() + 1)
      ) {
        const dataStr =
          d.getFullYear() +
          '-' +
          String(d.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(d.getDate()).padStart(2, '0');
        if (!bancoDadosGeral[dataStr]) bancoDadosGeral[dataStr] = { items: [] };
        bancoDadosGeral[dataStr].color = hex;
        bancoDadosGeral[dataStr].texture = textura;
        bancoDadosGeral[dataStr]._isPeriodo = true;
        bancoDadosGeral[dataStr]._isExcecaoLocal = false;
      }
    } else {
      bancoDadosGeral._configCorGlobal = { color: hex, texture: textura };
      Object.keys(bancoDadosGeral).forEach((data) => {
        if (bancoDadosGeral[data] && !data.startsWith('_')) {
          if (
            !bancoDadosGeral[data]._isExcecaoLocal &&
            !bancoDadosGeral[data]._isPeriodo
          ) {
            bancoDadosGeral[data].color = hex;
            bancoDadosGeral[data].texture = textura;
          }
        }
      });
    }
    persist();
  }
}

function abrirModalEdicaoTarefa(chaveData, idxReal) {
  const item = bancoDadosGeral[chaveData].items[idxReal];
  const modalEdicao =
    document.getElementById('modalEdicaoTarefaOverlay') ||
    criarEstruturaModalEdicao();

  const it = document.getElementById('inputEditarTitulo');
  if (it) it.value = item.text;
  const io = document.getElementById('inputEditarObservacoes');
  if (io) io.value = item.observacoes || '';

  modalEdicao.classList.remove('hidden');
  modalEdicao.classList.add('open');

  const btnSalvar = document.getElementById('btnSalvarEdicaoTarefa');
  const btnCancelar = document.getElementById('btnCancelarEdicaoTarefa');
  const clonarSalvar = btnSalvar.cloneNode(true);
  const clonarCancelar = btnCancelar.cloneNode(true);
  btnSalvar.parentNode.replaceChild(clonarSalvar, btnSalvar);
  btnCancelar.parentNode.replaceChild(clonarCancelar, btnCancelar);

  clonarCancelar.addEventListener('click', (e) => {
    e.stopPropagation();
    modalEdicao.classList.add('hidden');
    modalEdicao.classList.remove('open');
  });

  clonarSalvar.addEventListener('click', (e) => {
    e.stopPropagation();
    const novoTitulo = document
      .getElementById('inputEditarTitulo')
      .value.trim();
    if (!novoTitulo) return;
    bancoDadosGeral[chaveData].items[idxReal].text = novoTitulo;
    bancoDadosGeral[chaveData].items[idxReal].observacoes = document
      .getElementById('inputEditarObservacoes')
      .value.trim();
    modalEdicao.classList.add('hidden');
    modalEdicao.classList.remove('open');
    persist();
    render();
  });
}

// ==========================================
// TRANSPORTE DE TAREFAS (itens 3 e 4 da auditoria)
// Fluxo: Selecionar -> Mover -> Escolher data -> Confirmar -> Mover,
// preservando todos os dados do item (texto, status, hora de criação,
// observações). 3 gatilhos entram no modo de seleção: botão "Mover" do
// rodapé, Ctrl/Cmd+clique num item, e "Mover para..." no menu de
// contexto (clique-direito).
// ==========================================

function ativarModoSelecaoTransporte() {
  modoSelecaoAtivo = true;
  const bar = document.getElementById('selecaoBar');
  if (bar) bar.classList.remove('hidden');
}

function desativarModoSelecaoTransporte() {
  modoSelecaoAtivo = false;
  itensSelecionadosTransporte.clear();
  const bar = document.getElementById('selecaoBar');
  if (bar) bar.classList.add('hidden');
  render();
}

function toggleSelecaoTransporte(chave) {
  if (itensSelecionadosTransporte.has(chave)) {
    itensSelecionadosTransporte.delete(chave);
  } else {
    itensSelecionadosTransporte.add(chave);
  }
  atualizarContadorTransporte();
}

// Corrige o item 3 da auditoria (contador preso em "0 selecionada(s)").
function atualizarContadorTransporte() {
  const el = document.getElementById('selecaoContagem');
  if (el)
    el.textContent = `${itensSelecionadosTransporte.size} selecionada(s)`;
}

function abrirMenuContexto(x, y, chave) {
  const menu = document.getElementById('itemContextMenu');
  if (!menu) return;
  chaveContextoTransporte = chave;
  menu.style.top = y + 'px';
  menu.style.left = x + 'px';
  menu.classList.remove('hidden');

  // Reposiciona se estourar a borda direita/inferior da janela.
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = Math.max(4, window.innerWidth - rect.width - 4) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top =
        Math.max(4, window.innerHeight - rect.height - 4) + 'px';
    }
  });
}

function fecharMenuContexto() {
  const menu = document.getElementById('itemContextMenu');
  if (menu) menu.classList.add('hidden');
}

function abrirModalMoverData() {
  const overlay = document.getElementById('moverDataOverlay');
  const label = document.getElementById('moverDataLabel');
  const input = document.getElementById('moverDataInput');
  if (label)
    label.textContent = `Mover ${itensSelecionadosTransporte.size} tarefa(s) para:`;
  if (input && !input.value) input.value = dataAtualSelecionada;
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.classList.add('open');
  }
}

function fecharModalMoverData() {
  const overlay = document.getElementById('moverDataOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.classList.remove('open');
  }
}

// Move fisicamente os itens (splice na origem + push no destino),
// preservando 100% dos dados de cada tarefa — nada é recriado do zero.
// Processa os índices em ordem decrescente por data de origem para que
// remover um item não desloque o índice dos próximos a remover na mesma
// lista.
function moverTarefasParaData(chaves, dataDestino) {
  const porOrigem = {};
  chaves.forEach((chave) => {
    const separador = chave.lastIndexOf('|');
    const chaveData = chave.substring(0, separador);
    const idx = parseInt(chave.substring(separador + 1));
    if (!porOrigem[chaveData]) porOrigem[chaveData] = [];
    porOrigem[chaveData].push(idx);
  });

  if (!bancoDadosGeral[dataDestino]) {
    const corPadrao = bancoDadosGeral._configCorGlobal?.color || '#FFF3B0';
    const txtPadrao = bancoDadosGeral._configCorGlobal?.texture || 'none';
    bancoDadosGeral[dataDestino] = {
      color: corPadrao,
      texture: txtPadrao,
      items: [],
    };
  }

  Object.keys(porOrigem).forEach((chaveData) => {
    if (!bancoDadosGeral[chaveData] || !bancoDadosGeral[chaveData].items)
      return;
    const indicesDesc = porOrigem[chaveData].sort((a, b) => b - a);
    const listaOrigem = bancoDadosGeral[chaveData].items;
    indicesDesc.forEach((idx) => {
      const [itemMovido] = listaOrigem.splice(idx, 1);
      if (itemMovido) bancoDadosGeral[dataDestino].items.push(itemMovido);
    });
  });

  persist();
}

function setupTransporte() {
  const moveBtn = document.getElementById('moveBtn');
  const btnCancelarSelecao = document.getElementById('btnCancelarSelecao');
  const btnMoverSelecionadas = document.getElementById(
    'btnMoverSelecionadas'
  );
  const moverOverlay = document.getElementById('moverDataOverlay');
  const closeMoverDataX = document.getElementById('closeMoverDataX');
  const btnMoverContinuar = document.getElementById('btnMoverContinuar');
  const moverDataInput = document.getElementById('moverDataInput');
  const ctxMenu = document.getElementById('itemContextMenu');
  const ctxMoverItem = document.getElementById('ctxMoverItem');

  if (moveBtn) {
    moveBtn.addEventListener('click', () => {
      if (modoSelecaoAtivo) {
        desativarModoSelecaoTransporte();
        return;
      }
      ativarModoSelecaoTransporte();
      render();
    });
  }

  if (btnCancelarSelecao) {
    btnCancelarSelecao.addEventListener('click', () => {
      desativarModoSelecaoTransporte();
    });
  }

  if (btnMoverSelecionadas) {
    btnMoverSelecionadas.addEventListener('click', () => {
      if (itensSelecionadosTransporte.size === 0) return;
      abrirModalMoverData();
    });
  }

  if (closeMoverDataX) {
    closeMoverDataX.addEventListener('click', (e) => {
      e.stopPropagation();
      // Fecha só o modal de data: a seleção continua ativa, permitindo
      // escolher outra data sem perder o que já foi marcado.
      fecharModalMoverData();
    });
  }

  if (btnMoverContinuar) {
    btnMoverContinuar.addEventListener('click', (e) => {
      e.stopPropagation();
      const destino = moverDataInput?.value;
      if (!destino) return;
      const quantidade = itensSelecionadosTransporte.size;
      const chavesParaMover = [...itensSelecionadosTransporte];
      fecharModalMoverData();
      abrirCaixaConfirmacaoCustomizada(
        `Mover ${quantidade} tarefa(s) para ${formatDate(destino)}?`,
        () => {
          moverTarefasParaData(chavesParaMover, destino);
          desativarModoSelecaoTransporte();
        }
      );
    });
  }

  // Gatilho 3: menu de contexto (clique-direito num item -> "Mover para...")
  if (ctxMoverItem) {
    ctxMoverItem.addEventListener('click', (e) => {
      e.stopPropagation();
      fecharMenuContexto();
      if (!chaveContextoTransporte) return;
      itensSelecionadosTransporte.clear();
      itensSelecionadosTransporte.add(chaveContextoTransporte);
      ativarModoSelecaoTransporte();
      render();
      abrirModalMoverData();
    });
  }

  // Fecha o menu de contexto ao clicar fora ou pressionar Esc.
  document.addEventListener('click', (e) => {
    if (ctxMenu && !ctxMenu.classList.contains('hidden')) {
      if (!e.target.closest('#itemContextMenu')) fecharMenuContexto();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharMenuContexto();
  });
}

// ==========================================
// LIXEIRA (item 2 da auditoria)
// Fluxo: Escolher data -> Mostrar cards -> Selecionar tudo /
// individualmente -> Restaurar selecionadas / todas -> Confirmar ->
// Restaurar. Ao restaurar, o item some da lixeira e volta para a data
// original (basta zerar a flag "excluida" — o item nunca sai de
// items[], então "voltar para a data original" é automático).
// ==========================================

// Retorna { chaveData, idx, item } de todas as tarefas excluídas,
// respeitando o filtro de data ativo na Lixeira ("todas" ou uma data
// específica), ordenado por data.
function obterItensExcluidosVisiveis() {
  const resultado = [];
  Object.keys(bancoDadosGeral).forEach((chaveData) => {
    if (chaveData.startsWith('_')) return;
    const dia = bancoDadosGeral[chaveData];
    if (!dia || !dia.items) return;
    dia.items.forEach((item, idx) => {
      if (!item.excluida) return;
      if (lixeiraFiltroAtual !== 'todas' && chaveData !== lixeiraFiltroAtual)
        return;
      resultado.push({ chaveData, idx, item });
    });
  });
  resultado.sort((a, b) => a.chaveData.localeCompare(b.chaveData));
  return resultado;
}

// Restaura (des-exclui) uma lista de chaves "chaveData|idx". Não faz
// splice nenhum: só volta "excluida" para false, então o item continua
// exatamente onde estava dentro de items[] — reaparece automaticamente
// na data original assim que a checklist principal for redesenhada.
function restaurarChaves(chaves) {
  chaves.forEach((chave) => {
    const separador = chave.lastIndexOf('|');
    const chaveData = chave.substring(0, separador);
    const idx = parseInt(chave.substring(separador + 1));
    const dia = bancoDadosGeral[chaveData];
    if (!dia || !dia.items || !dia.items[idx]) return;
    dia.items[idx].excluida = false;
    dia.items[idx].dataExclusao = '';
    dia.items[idx].horaExclusao = '';
  });
  persist();
  render();
}

function atualizarContadorLixeira() {
  const contagem = document.getElementById('lixeiraContagem');
  if (contagem)
    contagem.textContent = `${lixeiraSelecionados.size} selecionada(s)`;
}

function sincronizarCheckboxTudoLixeira() {
  const chkTudo = document.getElementById('lixeiraSelecionarTudo');
  if (!chkTudo) return;
  const visiveis = obterItensExcluidosVisiveis();
  chkTudo.checked =
    visiveis.length > 0 &&
    visiveis.every(({ chaveData, idx }) =>
      lixeiraSelecionados.has(chaveData + '|' + idx)
    );
}

function renderLixeira() {
  const lista = document.getElementById('lixeiraLista');
  const filtroSelect = document.getElementById('lixeiraFiltroData');
  if (!lista) return;

  // Popula o filtro de data só com datas que realmente têm itens na
  // lixeira, mantendo a seleção atual quando ainda for válida.
  if (filtroSelect) {
    const datasComExcluidos = new Set();
    Object.keys(bancoDadosGeral).forEach((chaveData) => {
      if (chaveData.startsWith('_')) return;
      const dia = bancoDadosGeral[chaveData];
      if (dia && dia.items && dia.items.some((i) => i.excluida)) {
        datasComExcluidos.add(chaveData);
      }
    });
    const listaDatas = [...datasComExcluidos].sort().reverse();
    const valorPreservado =
      lixeiraFiltroAtual === 'todas' || listaDatas.includes(lixeiraFiltroAtual)
        ? lixeiraFiltroAtual
        : 'todas';
    filtroSelect.innerHTML = '<option value="todas">Todas as datas</option>';
    listaDatas.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = formatDate(d);
      filtroSelect.appendChild(opt);
    });
    lixeiraFiltroAtual = valorPreservado;
    filtroSelect.value = valorPreservado;
  }

  const itensVisiveis = obterItensExcluidosVisiveis();
  lista.innerHTML = '';

  if (itensVisiveis.length === 0) {
    const vazio = document.createElement('div');
    vazio.className = 'lixeira-empty';
    vazio.textContent = '🗑️ A lixeira está vazia.';
    lista.appendChild(vazio);
  } else {
    let ultimaData = null;
    itensVisiveis.forEach(({ chaveData, idx, item }) => {
      if (chaveData !== ultimaData) {
        ultimaData = chaveData;
        const header = document.createElement('div');
        header.className = 'lixeira-day-header';

        const span = document.createElement('span');
        span.textContent = '🗓️ ' + formatDate(chaveData);

        const btnDia = document.createElement('button');
        btnDia.className = 'lixeira-restore-day-btn';
        btnDia.textContent = 'Restaurar dia';
        btnDia.setAttribute(
          'data-tooltip',
          'Restaurar todas as tarefas apagadas deste dia'
        );
        btnDia.addEventListener('click', (e) => {
          e.stopPropagation();
          const chavesDoDia = itensVisiveis
            .filter((v) => v.chaveData === chaveData)
            .map((v) => v.chaveData + '|' + v.idx);
          abrirCaixaConfirmacaoCustomizada(
            `Restaurar todas as tarefas apagadas de ${formatDate(chaveData)}?`,
            () => {
              restaurarChaves(chavesDoDia);
              chavesDoDia.forEach((c) => lixeiraSelecionados.delete(c));
              renderLixeira();
            }
          );
        });

        header.appendChild(span);
        header.appendChild(btnDia);
        lista.appendChild(header);
      }

      const chave = chaveData + '|' + idx;
      const row = document.createElement('div');
      row.className = 'lixeira-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'item-select-checkbox';
      cb.checked = lixeiraSelecionados.has(chave);
      cb.addEventListener('change', () => {
        if (cb.checked) lixeiraSelecionados.add(chave);
        else lixeiraSelecionados.delete(chave);
        atualizarContadorLixeira();
        sincronizarCheckboxTudoLixeira();
      });

      const info = document.createElement('div');
      info.className = 'lixeira-item-info';
      const txt = document.createElement('div');
      txt.className = 'lixeira-item-text';
      txt.textContent = item.text;
      const meta = document.createElement('div');
      meta.className = 'lixeira-item-meta';
      const dataRef = item.dataExclusao || chaveData;
      meta.textContent = `Apagada em ${formatDate(dataRef)}${item.horaExclusao ? ' às ' + item.horaExclusao : ''}`;
      info.appendChild(txt);
      info.appendChild(meta);

      const btnRestaurar = document.createElement('button');
      btnRestaurar.className = 'lixeira-restore-btn';
      btnRestaurar.textContent = '↩️';
      btnRestaurar.setAttribute('data-tooltip', 'Restaurar esta tarefa');
      btnRestaurar.addEventListener('click', (e) => {
        e.stopPropagation();
        restaurarChaves([chave]);
        lixeiraSelecionados.delete(chave);
        renderLixeira();
      });

      row.appendChild(cb);
      row.appendChild(info);
      row.appendChild(btnRestaurar);
      lista.appendChild(row);
    });
  }

  atualizarContadorLixeira();
  sincronizarCheckboxTudoLixeira();
}

function setupLixeira() {
  const overlay = document.getElementById('lixeiraOverlay');
  const openBtn = document.getElementById('trashBtn');
  const closeX = document.getElementById('closeLixeiraX');
  const filtroSelect = document.getElementById('lixeiraFiltroData');
  const chkTudo = document.getElementById('lixeiraSelecionarTudo');
  const btnRestaurarSel = document.getElementById(
    'btnLixeiraRestaurarSelecionadas'
  );
  const btnRestaurarTodas = document.getElementById(
    'btnLixeiraRestaurarTodas'
  );

  if (openBtn && overlay) {
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      lixeiraSelecionados.clear();
      lixeiraFiltroAtual = 'todas';
      renderLixeira();
      overlay.classList.remove('hidden');
      overlay.classList.add('open');
    });
  }

  if (closeX && overlay) {
    closeX.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.classList.add('hidden');
      overlay.classList.remove('open');
    });
  }

  if (filtroSelect) {
    filtroSelect.addEventListener('change', () => {
      lixeiraFiltroAtual = filtroSelect.value;
      lixeiraSelecionados.clear();
      renderLixeira();
    });
  }

  if (chkTudo) {
    chkTudo.addEventListener('change', () => {
      const visiveis = obterItensExcluidosVisiveis();
      if (chkTudo.checked) {
        visiveis.forEach(({ chaveData, idx }) =>
          lixeiraSelecionados.add(chaveData + '|' + idx)
        );
      } else {
        lixeiraSelecionados.clear();
      }
      renderLixeira();
    });
  }

  if (btnRestaurarSel) {
    btnRestaurarSel.addEventListener('click', () => {
      if (lixeiraSelecionados.size === 0) return;
      const quantidade = lixeiraSelecionados.size;
      abrirCaixaConfirmacaoCustomizada(
        `Restaurar ${quantidade} tarefa(s) selecionada(s)?`,
        () => {
          restaurarChaves([...lixeiraSelecionados]);
          lixeiraSelecionados.clear();
          renderLixeira();
        }
      );
    });
  }

  if (btnRestaurarTodas) {
    btnRestaurarTodas.addEventListener('click', () => {
      const visiveis = obterItensExcluidosVisiveis();
      if (visiveis.length === 0) return;
      abrirCaixaConfirmacaoCustomizada(
        `Restaurar todas as ${visiveis.length} tarefa(s) apagada(s)?`,
        () => {
          restaurarChaves(
            visiveis.map(({ chaveData, idx }) => chaveData + '|' + idx)
          );
          lixeiraSelecionados.clear();
          renderLixeira();
        }
      );
    });
  }
}

// ==========================================
// TOOLTIPS
// ==========================================

function setupTooltips() {
  // Cria o container de tooltip uma única vez
  let box = document.getElementById('tooltip-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'tooltip-box';
    document.body.appendChild(box);
  }

  let hideTimer = null;

  function showTooltip(el) {
    const label = el.getAttribute('data-tooltip');
    if (!label) return;
    clearTimeout(hideTimer);
    box.textContent = label;
    box.classList.add('visible');

    const rect = el.getBoundingClientRect();
    const bw = box.offsetWidth;
    const bh = box.offsetHeight;
    // Posiciona acima do elemento, centralizado
    let top = rect.top - bh - 8;
    let left = rect.left + rect.width / 2 - bw / 2;
    // Evita sair pela esquerda/direita
    left = Math.max(6, Math.min(left, window.innerWidth - bw - 6));
    // Se não couber acima, vai abaixo
    if (top < 4) top = rect.bottom + 8;
    box.style.top = top + 'px';
    box.style.left = left + 'px';
  }

  function hideTooltip() {
    hideTimer = setTimeout(() => box.classList.remove('visible'), 80);
  }

  // Delegação de eventos: captura qualquer elemento com data-tooltip,
  // incluindo botões criados dinamicamente por render()
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target) showTooltip(target);
  });
  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target) hideTooltip();
  });
  // Esconde ao clicar para não ficar travado após a ação
  document.addEventListener('click', () => box.classList.remove('visible'));
}

function criarEstruturaModalEdicao() {
  const div = document.getElementById('modalEdicaoTarefaOverlay');
  if (div) return div;
  const novaDiv = document.createElement('div');
  novaDiv.id = 'modalEdicaoTarefaOverlay';
  novaDiv.className = 'modal-overlay hidden';
  novaDiv.innerHTML = `
    <div class="modal-content">
      <h3>✏️ Editar Tarefa</h3>
      <label>Título</label>
      <input type="text" id="inputEditarTitulo" />
      <label>Observações</label>
      <textarea id="inputEditarObservacoes"></textarea>
      <div style="display: flex; gap: 6px; margin-top: 12px;">
        <button id="btnCancelarEdicaoTarefa" class="link-btn" style="flex: 1;">Cancelar</button>
        <button id="btnSalvarEdicaoTarefa" class="link-btn" style="flex: 1; font-weight: 600;">Salvar</button>
      </div>
    </div>
  `;
  document.body.appendChild(novaDiv);
  return novaDiv;
}
