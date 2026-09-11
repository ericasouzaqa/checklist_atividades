let bancoDadosGeral = null;
let dataAtualSelecionada = '';
let acaoConfirmacaoPendente = null;
let inicializandoSistema = true;

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
  const slider = document.getElementById('brightnessSlider');

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

  if (closeBtn && overlay) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.classList.add('hidden');
      overlay.classList.remove('open');
    });
  }

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

  if (slider) {
    slider.addEventListener('input', () => {
      applyColorAndTexture(
        inputCor?.value || '#FFF3B0',
        dropdownTextTextures?.value || 'none',
        false
      );
    });
  }

  const btnSalvarModal = document.getElementById('btnSalvarModal');
  if (btnSalvarModal) {
    btnSalvarModal.addEventListener('click', () => {
      applyColorAndTexture(
        inputCor?.value || '#FFF3B0',
        dropdownTextTextures?.value || 'none',
        true
      );
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
  const hojeStr = dataAtualSelecionada;

  const cc = document.getElementById('containerCamposPeriodo');
  if (cc) cc.style.display = mainFilter === 'periodo' ? 'flex' : 'none';

  const fragment = document.createDocumentFragment();
  chavesParaRenderizar.sort().forEach((chaveData) => {
    if (!bancoDadosGeral[chaveData] || !bancoDadosGeral[chaveData].items)
      return;
    const ativos = bancoDadosGeral[chaveData].items.filter((i) => !i.excluida);
    if (ativos.length === 0) return;

    const headerData = document.createElement('div');
    headerData.className = 'historico-data-header';
    headerData.innerHTML = `🗓️ <span>${formatDate(chaveData)}</span>`;
    fragment.appendChild(headerData);

    ativos.forEach((item) => {
      const idxReal = bancoDadosGeral[chaveData].items.indexOf(item);
      const row = document.createElement('div');
      row.className = 'item' + (item.done ? ' done' : '');

      if (mainFilter === 'hoje') {
        row.draggable = true;
        row.dataset.indexReal = idxReal;
        row.dataset.chaveData = chaveData;

        row.addEventListener('dragstart', (e) => {
          row.classList.add('dragging');
          e.dataTransfer.setData('text/plain', idxReal);
        });

        row.addEventListener('dragend', () => {
          row.classList.remove('dragging');
        });
      }

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = item.done;
      cb.addEventListener('change', () => {
        bancoDadosGeral[chaveData].items[idxReal].done = cb.checked;
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
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        abrirModalEdicaoTarefa(chaveData, idxReal);
      });

      const del = document.createElement('button');
      del.className = 'del-btn';
      del.textContent = '✕';
      del.style.webkitAppRegion = 'no-drag';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        abrirCaixaConfirmacaoCustomizada(
          `Remover a tarefa "${item.text}"?`,
          () => {
            const agora = new Date();
            bancoDadosGeral[chaveData].items[idxReal].excluida = true;
            bancoDadosGeral[chaveData].items[idxReal].dataExclusao = hojeStr;
            bancoDadosGeral[chaveData].items[idxReal].horaExclusao =
              String(agora.getHours()).padStart(2, '0') +
              ':' +
              String(agora.getMinutes()).padStart(2, '0');
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
  if (addBtn) addBtn.addEventListener('click', add);
  if (input)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') add();
    });

  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
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
      dia.items
        .filter((i) => !i.excluida)
        .forEach((item) => {
          linhas.push({
            data: chaveData,
            tarefa: item.text,
            status: item.done ? 'Concluída' : 'Pendente',
            horaCriacao: item.horaCriacao || '',
            observacoes: item.observacoes || '',
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
      const header = 'Data;Tarefa;Status;Hora de Criacao;Observacoes';
      const corpo = linhas
        .map((l) =>
          [l.data, l.tarefa, l.status, l.horaCriacao, l.observacoes]
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
      if (typeof XLSX === 'undefined') {
        alert(
          'A biblioteca de exportação para Excel não carregou. Verifique sua conexão com a internet e tente novamente.'
        );
        return;
      }
      const planilha = XLSX.utils.json_to_sheet(
        linhas.map((l) => ({
          Data: l.data,
          Tarefa: l.tarefa,
          Status: l.status,
          'Hora de Criação': l.horaCriacao,
          Observações: l.observacoes,
        }))
      );
      const livro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(livro, planilha, 'Checklist');
      const arrayBuffer = XLSX.write(livro, {
        bookType: 'xlsx',
        type: 'array',
      });
      const resultado = await window.api.exportXlsx(arrayBuffer);
      if (resultado && resultado.success) {
        fecharModalExport();
      } else if (resultado && resultado.error) {
        alert('Não foi possível exportar o Excel: ' + resultado.error);
      }
    });
  }
}

function applyColorAndTexture(hex, textura, save) {
  if (!hex || hex === 'undefined') hex = '#FFF3B0';
  if (!textura) textura = 'none';
  if (!bancoDadosGeral || !bancoDadosGeral[dataAtualSelecionada]) return;

  const num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;

  document.documentElement.style.setProperty('--note-bg', hex);

  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  const corTextoDefinitiva = yiq >= 128 ? '#1A1A1A' : '#FFFFFF';
  const corSubTextoDefinitiva = yiq >= 128 ? '#555555' : '#D0D0D0';
  const corBordaDefinitiva =
    yiq >= 128 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)';
  const corCardDefinitiva =
    yiq >= 128 ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.25)';
  const corCardHoverDefinitiva =
    yiq >= 128 ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.4)';
  const corModalDefinitiva = yiq >= 128 ? '#FFFFFF' : '#1E1E1E';
  const corInputBgDefinitiva =
    yiq >= 128 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)';

  document.documentElement.style.setProperty(
    '--text-color',
    corTextoDefinitiva
  );
  document.documentElement.style.setProperty(
    '--sub-text-color',
    corSubTextoDefinitiva
  );
  document.documentElement.style.setProperty(
    '--border-alpha',
    corBordaDefinitiva
  );
  document.documentElement.style.setProperty('--bg-alpha', corCardDefinitiva);
  document.documentElement.style.setProperty(
    '--bg-hover-alpha',
    corCardHoverDefinitiva
  );
  document.documentElement.style.setProperty('--modal-bg', corModalDefinitiva);
  document.documentElement.style.setProperty(
    '--input-bg-alpha',
    corInputBgDefinitiva
  );

  if (textura === 'glass') {
    document.documentElement.style.setProperty(
      '--textura-ativa',
      'backdrop-filter: blur(16px) saturate(120%); background: rgba(255,255,255,0.1);'
    );
  } else if (textura === 'neon') {
    document.documentElement.style.setProperty(
      '--neon-glow',
      `0 0 20px ${hex}, inset 0 0 10px ${hex}`
    );
  } else if (textura === 'marmore') {
    document.documentElement.style.setProperty(
      '--textura-ativa',
      'background-image: linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px); background-size: 20px 20px;'
    );
  } else if (textura === 'gradiente') {
    document.documentElement.style.setProperty(
      '--gradiente-bg',
      `linear-gradient(135deg, ${hex} 0%, rgba(26,26,26,0.85) 100%)`
    );
  } else if (textura === 'glitter') {
    document.documentElement.style.setProperty(
      '--textura-ativa',
      'background-image: radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px); background-size: 8px 8px;'
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
