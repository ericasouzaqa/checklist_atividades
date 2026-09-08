// ---------- Estado ----------
let bancoDadosGeral = {}; // Estrutura por datas: { "2026-09-08": { color: '#FFF3B0', items: [...] } }
let dataAtualSelecionada = '';

let hue = 50,
  sat = 0.3,
  val = 1; // estado do seletor de cor (HSV)

// ---------- Inicialização ----------
window.addEventListener('DOMContentLoaded', async () => {
  const hoje = new Date();
  dataAtualSelecionada =
    hoje.getFullYear() +
    '-' +
    String(hoje.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(hoje.getDate()).padStart(2, '0');

  const loaded = await window.api.loadData();
  if (loaded) {
    if (loaded.items && !loaded[dataAtualSelecionada]) {
      bancoDadosGeral[dataAtualSelecionada] = loaded;
    } else {
      bancoDadosGeral = loaded;
    }
  }

  const seletor = document.getElementById('seletor-data');
  if (seletor) {
    seletor.value = dataAtualSelecionada;
    seletor.addEventListener('change', (e) => {
      dataAtualSelecionada = e.target.value;
      atualizarInterfacePorData();
    });
  }

  atualizarInterfacePorData();
  setupTitlebar();
  setupColorPanel();
  setupChecklistControls();
  setupExport();
});

function atualizarInterfacePorData() {
  document.getElementById('dateLabel').textContent =
    formatDate(dataAtualSelecionada);

  if (!bancoDadosGeral[dataAtualSelecionada]) {
    bancoDadosGeral[dataAtualSelecionada] = {
      color: '#FFF3B0',
      items: [
        { text: 'Revisar tarefas do dia', done: false },
        { text: 'Verificar builds / pipelines', done: false },
        { text: 'Responder mensagens pendentes', done: false },
      ],
    };
  }

  applyColor(bancoDadosGeral[dataAtualSelecionada].color, false);
  render();
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
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  const d = new Date(dataStr + 'T00:00:00');
  return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
}

async function persist() {
  await window.api.saveData(bancoDadosGeral);
}

function render() {
  const list = document.getElementById('list');
  list.innerHTML = '';
  const dadosDoDia = bancoDadosGeral[dataAtualSelecionada];

  dadosDoDia.items.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'item' + (item.done ? ' done' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = item.done;
    cb.addEventListener('change', () => {
      dadosDoDia.items[idx].done = cb.checked;
      persist();
      render();
    });

    const txt = document.createElement('div');
    txt.className = 'item-text';
    txt.contentEditable = 'true';
    txt.textContent = item.text;
    txt.addEventListener('blur', () => {
      const v = txt.textContent.trim();
      dadosDoDia.items[idx].text = v || item.text;
      persist();
    });
    txt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        txt.blur();
      }
    });

    const del = document.createElement('button');
    del.className = 'del-btn';
    del.textContent = '✕';
    del.addEventListener('click', () => {
      dadosDoDia.items.splice(idx, 1);
      persist();
      render();
    });

    row.appendChild(cb);
    row.appendChild(txt);
    row.appendChild(del);
    list.appendChild(row);
  });

  const total = dadosDoDia.items.length;
  const doneCount = dadosDoDia.items.filter((i) => i.done).length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  document.getElementById('progressBarFill').style.width = pct + '%';
}

function setupChecklistControls() {
  const input = document.getElementById('newItemInput');
  const add = () => {
    const v = input.value.trim();
    if (!v) return;
    bancoDadosGeral[dataAtualSelecionada].items.push({ text: v, done: false });
    input.value = '';
    persist();
    render();
  };
  document.getElementById('addBtn').addEventListener('click', add);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') add();
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    bancoDadosGeral[dataAtualSelecionada].items.forEach(
      (i) => (i.done = false)
    );
    persist();
    render();
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    if (
      confirm('Remover todas as atividades da lista deste dia selecionado?')
    ) {
      bancoDadosGeral[dataAtualSelecionada].items = [];
      persist();
      render();
    }
  });
}
function setupExport() {
  const exportBtn = document.getElementById('exportBtn');
  if (!exportBtn) return;

  exportBtn.addEventListener('click', async () => {
    let csvContent = 'Data;Tarefa;Status\n';
    Object.keys(bancoDadosGeral).forEach((data) => {
      if (bancoDadosGeral[data] && bancoDadosGeral[data].items) {
        bancoDadosGeral[data].items.forEach((item) => {
          const status = item.done ? 'Concluída' : 'Pendente';
          const limpaTexto = item.text.replace(/;/g, ',');
          csvContent += `${data};${limpaTexto};${status}\n`;
        });
      }
    });
    await window.api.exportCsv(csvContent);
  });
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
  document.getElementById('maxBtn').addEventListener('click', () => {
    window.api.toggleMaximize();
  });
  document.getElementById('minBtn').addEventListener('click', () => {
    window.api.minimize();
  });
  document.getElementById('paletteBtn').addEventListener('click', () => {
    document.getElementById('colorPanel').classList.toggle('hidden');
  });
  document.getElementById('closeColorBtn').addEventListener('click', () => {
    document.getElementById('colorPanel').classList.add('hidden');
  });
}

function applyColor(hex, save) {
  if (!bancoDadosGeral[dataAtualSelecionada]) return;
  bancoDadosGeral[dataAtualSelecionada].color = hex;
  document.documentElement.style.setProperty('--note-bg', hex);
  const rgb = hexToRgb(hex);
  document.getElementById('hexInput').value = hex;
  document.getElementById('rInput').value = rgb.r;
  document.getElementById('gInput').value = rgb.g;
  document.getElementById('bInput').value = rgb.b;
  if (save) persist();
}

function setupColorPanel() {
  const canvas = document.getElementById('wheel');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const radius = size / 2;
  const cursor = document.getElementById('wheelCursor');
  const brightnessSlider = document.getElementById('brightnessSlider');

  function drawWheel() {
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - radius;
        const dy = y - radius;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * size + x) * 4;
        if (dist <= radius) {
          let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          if (angle < 0) angle += 360;
          const s = Math.min(dist / radius, 1);
          const [r, g, b] = hsvToRgb(angle, s, val);
          image.data[idx] = r;
          image.data[idx + 1] = g;
          image.data[idx + 2] = b;
          image.data[idx + 3] = 255;
        } else {
          image.data[idx + 3] = 0;
        }
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  function positionCursor() {
    const angleRad = (hue * Math.PI) / 180;
    const dist = sat * radius;
    const x = radius + Math.cos(angleRad) * dist;
    const y = radius + Math.sin(angleRad) * dist;
    const rect = canvas.getBoundingClientRect();
    cursor.style.left =
      rect.left - document.body.getBoundingClientRect().left + x + 'px';
    cursor.style.top =
      rect.top - document.body.getBoundingClientRect().top + y + 'px';
    cursor.style.display = 'block';
  }

  function updateFromHueSat() {
    const [r, g, b] = hsvToRgb(hue, sat, val);
    const hex = rgbToHex(r, g, b);
    applyColor(hex, true);
    positionCursor();
  }

  let dragging = false;
  function handlePointer(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - radius;
    const y = e.clientY - rect.top - radius;
    const dist = Math.min(Math.sqrt(x * x + y * y), radius);
    let angle = (Math.atan2(y, x) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    hue = angle;
    sat = dist / radius;
    updateFromHueSat();
  }

  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    handlePointer(e);
  });
  window.addEventListener('mousemove', (e) => {
    if (dragging) handlePointer(e);
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });

  brightnessSlider.addEventListener('input', () => {
    val = brightnessSlider.value / 100;
    drawWheel();
    updateFromHueSat();
  });

  document.getElementById('hexInput').addEventListener('change', (e) => {
    const hex = normalizeHex(e.target.value);
    if (!hex) return;
    syncFromHex(hex);
  });

  ['rInput', 'gInput', 'bInput'].forEach((id) => {
    document.getElementById(id).addEventListener('change', () => {
      const r = clamp255(document.getElementById('rInput').value);
      const g = clamp255(document.getElementById('gInput').value);
      const b = clamp255(document.getElementById('bInput').value);
      syncFromHex(rgbToHex(r, g, b));
    });
  });

  document.querySelectorAll('#presetRow .swatch').forEach((btn) => {
    btn.addEventListener('click', () => syncFromHex(btn.dataset.color));
  });

  function syncFromHex(hex) {
    const rgb = hexToRgb(hex);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    hue = hsv.h;
    sat = hsv.s;
    val = hsv.v;
    brightnessSlider.value = val * 100;
    drawWheel();
    applyColor(hex, true);
    positionCursor();
  }
}

function hexToRgb(hex) {
  const num = parseInt(hex.replace('#', ''), 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function hsvToRgb(h, s, v) {
  let r, g, b;
  let i = Math.floor(h / 60);
  let f = h / 60 - i;
  let p = v * (1 - s);
  let q = v * (1 - f * s);
  let t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      ((r = v), (g = t), (b = p));
      break;
    case 1:
      ((r = q), (g = v), (b = p));
      break;
    case 2:
      ((r = p), (g = v), (b = t));
      break;
    case 3:
      ((r = p), (g = q), (b = v));
      break;
    case 4:
      ((r = t), (g = p), (b = v));
      break;
    case 5:
      ((r = v), (g = p), (b = q));
      break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
function rgbToHsv(r, g, b) {
  ((r /= 255), (g /= 255), (b /= 255));
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h,
    s,
    v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max === min) {
    h = 0;
  } else {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s, v: v };
}
function clamp255(val) {
  return Math.max(0, Math.min(255, parseInt(val) || 0));
}
function normalizeHex(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex + hex + hex + hex + hex + hex;
  return hex.length === 6 ? '#' + hex : null;
}
