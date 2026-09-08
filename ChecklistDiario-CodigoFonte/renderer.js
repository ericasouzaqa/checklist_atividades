// ---------- Estado ----------
let data = {
  color: '#FFF3B0',
  items: [
    { text: 'Revisar tarefas do dia', done: false },
    { text: 'Verificar builds / pipelines', done: false },
    { text: 'Responder mensagens pendentes', done: false }
  ]
};

let hue = 50, sat = 0.3, val = 1; // estado do seletor de cor (HSV)

// ---------- Inicialização ----------
window.addEventListener('DOMContentLoaded', async () => {
  const loaded = await window.api.loadData();
  if (loaded && loaded.items) data = loaded;

  document.getElementById('dateLabel').textContent = formatDate();
  applyColor(data.color, false);
  render();
  setupTitlebar();
  setupColorPanel();
  setupChecklistControls();
});

function formatDate() {
  const dias = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const d = new Date();
  const s = `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function persist() {
  await window.api.saveData(data);
}

// ---------- Checklist ----------
function render() {
  const list = document.getElementById('list');
  list.innerHTML = '';

  data.items.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'item' + (item.done ? ' done' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = item.done;
    cb.addEventListener('change', () => {
      data.items[idx].done = cb.checked;
      persist();
      render();
    });

    const txt = document.createElement('div');
    txt.className = 'item-text';
    txt.contentEditable = 'true';
    txt.textContent = item.text;
    txt.addEventListener('blur', () => {
      const v = txt.textContent.trim();
      data.items[idx].text = v || item.text;
      persist();
    });
    txt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); txt.blur(); }
    });

    const del = document.createElement('button');
    del.className = 'del-btn';
    del.textContent = '✕';
    del.addEventListener('click', () => {
      data.items.splice(idx, 1);
      persist();
      render();
    });

    row.appendChild(cb);
    row.appendChild(txt);
    row.appendChild(del);
    list.appendChild(row);
  });

  const total = data.items.length;
  const doneCount = data.items.filter(i => i.done).length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  document.getElementById('progressBarFill').style.width = pct + '%';
}

function setupChecklistControls() {
  const input = document.getElementById('newItemInput');
  const add = () => {
    const v = input.value.trim();
    if (!v) return;
    data.items.push({ text: v, done: false });
    input.value = '';
    persist();
    render();
  };
  document.getElementById('addBtn').addEventListener('click', add);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

  document.getElementById('resetBtn').addEventListener('click', () => {
    data.items.forEach(i => i.done = false);
    persist();
    render();
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('Remover todas as atividades da lista?')) {
      data.items = [];
      persist();
      render();
    }
  });
}

// ---------- Barra de título: pin / paleta / minimizar / maximizar ----------
function setupTitlebar() {
  const pinBtn = document.getElementById('pinBtn');
  let pinned = false;
  pinBtn.addEventListener('click', async () => {
    pinned = await window.api.togglePin(!pinned);
    pinBtn.classList.toggle('active', pinned);
    pinBtn.title = pinned
      ? 'Fixado por cima das outras janelas (clique para soltar)'
      : 'Fixar por cima das outras janelas';
  });

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

// ---------- Cor do fundo ----------
function applyColor(hex, save) {
  data.color = hex;
  document.documentElement.style.setProperty('--note-bg', hex);
  const rgb = hexToRgb(hex);
  document.getElementById('hexInput').value = hex;
  document.getElementById('rInput').value = rgb.r;
  document.getElementById('gInput').value = rgb.g;
  document.getElementById('bInput').value = rgb.b;
  if (save) persist();
}

// ---------- Roda de cores (HSV completo) ----------
function setupColorPanel() {
  const canvas = document.getElementById('wheel');
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
          let angle = Math.atan2(dy, dx) * 180 / Math.PI;
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
    const angleRad = hue * Math.PI / 180;
    const dist = sat * radius;
    const x = radius + Math.cos(angleRad) * dist;
    const y = radius + Math.sin(angleRad) * dist;
    const rect = canvas.getBoundingClientRect();
    cursor.style.left = (rect.left - document.body.getBoundingClientRect().left + x) + 'px';
    cursor.style.top = (rect.top - document.body.getBoundingClientRect().top + y) + 'px';
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
    let angle = Math.atan2(y, x) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    hue = angle;
    sat = dist / radius;
    updateFromHueSat();
  }

  canvas.addEventListener('mousedown', (e) => { dragging = true; handlePointer(e); });
  window.addEventListener('mousemove', (e) => { if (dragging) handlePointer(e); });
  window.addEventListener('mouseup', () => { dragging = false; });

  brightnessSlider.addEventListener('input', () => {
    val = brightnessSlider.value / 100;
    drawWheel();
    updateFromHueSat();
  });

  // Campos manuais
  document.getElementById('hexInput').addEventListener('change', (e) => {
    const hex = normalizeHex(e.target.value);
    if (!hex) return;
    syncFromHex(hex);
  });
  ['rInput', 'gInput', 'bInput'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      const r = clamp255(document.getElementById('rInput').value);
      const g = clamp255(document.getElementById('gInput').value);
      const b = clamp255(document.getElementById('bInput').value);
      syncFromHex(rgbToHex(r, g, b));
    });
  });

  document.querySelectorAll('#presetRow .swatch').forEach(btn => {
    btn.addEventListener('click', () => syncFromHex(btn.dataset.color));
  });

  function syncFromHex(hex) {
    const rgb = hexToRgb(hex);
    const [h, s, v] = rgbToHsv(rgb.r, rgb.g, rgb.b);
    hue = h; sat = s; val = v;
    brightnessSlider.value = Math.round(v * 100);
    drawWheel();
    applyColor(hex, true);
    positionCursor();
  }

  // Estado inicial a partir da cor carregada
  const rgb0 = hexToRgb(data.color);
  const [h0, s0, v0] = rgbToHsv(rgb0.r, rgb0.g, rgb0.b);
  hue = h0; sat = s0; val = v0;
  brightnessSlider.value = Math.round(v0 * 100);
  drawWheel();
  positionCursor();
}

// ---------- Utilitários de cor ----------
function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return [h, s, v];
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function normalizeHex(v) {
  v = v.trim();
  if (!v.startsWith('#')) v = '#' + v;
  return /^#[0-9A-Fa-f]{6}$/.test(v) ? v : null;
}

function clamp255(v) {
  v = parseInt(v, 10);
  if (isNaN(v)) return 0;
  return Math.max(0, Math.min(255, v));
}
