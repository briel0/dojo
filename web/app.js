// Desenha o quadrinho a partir do activity.json gerado pelo coletor. Sem framework (decisão 8).
'use strict';

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const SOURCE_NAMES = { github: 'GitHub', codeforces: 'Codeforces', workout: 'Treinos', teaching: 'Aulas' };
// Atividades que pintam a célula, na ordem em que a dividem (decisões 3 e 4). A aula não pinta:
// vira um quadradinho discreto no meio da célula (decisão 16).
const ACTIVITIES = [
  { name: 'código', color: 'var(--code)', done: (c) => (c.github || 0) + (c.codeforces || 0) > 0 },
  { name: 'treino', color: 'var(--workout)', done: (c) => (c.workout || 0) > 0 },
];
const taught = (c) => (c.teaching || 0) > 0;
const WEEKS = 53; // últimos 12 meses em colunas completas (decisão 12)
const DAY_MS = 86400000;

// As datas são dias do calendário (já em Brasília no JSON); em UTC as contas não sofrem com fuso.
const parseDay = (iso) => new Date(iso + 'T00:00:00Z');
const isoDay = (date) => date.toISOString().slice(0, 10);
const addDays = (date, n) => new Date(date.getTime() + n * DAY_MS);

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

function describe(counts) {
  const parts = [];
  if (counts.github) parts.push(plural(counts.github, 'contribuição', 'contribuições'));
  if (counts.codeforces) parts.push(plural(counts.codeforces, 'submissão', 'submissões'));
  if (counts.workout) parts.push(plural(counts.workout, 'treino', 'treinos'));
  if (counts.teaching) parts.push(plural(counts.teaching, 'aula', 'aulas'));
  return parts.length ? parts.join(' · ') : 'descanso';
}

/**
 * A cor da célula: vazia, uma atividade inteira, ou faixas diagonais iguais, uma por atividade feita
 * (decisão 4). Ex.: código e treino = metade vermelha, metade âmbar.
 */
function fillOf(counts) {
  const colors = ACTIVITIES.filter((activity) => activity.done(counts)).map((activity) => activity.color);
  if (colors.length === 0) return 'var(--empty)';
  if (colors.length === 1) return colors[0];
  const step = 100 / colors.length;
  const stops = colors.map((color, i) => `${color} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`);
  return `linear-gradient(135deg, ${stops.join(', ')})`;
}

function render(data) {
  const grid = document.getElementById('grid');
  const today = parseDay(data.to);
  // Começa num domingo, 52 semanas antes do domingo desta semana
  const start = addDays(today, -today.getUTCDay() - (WEEKS - 1) * 7);
  let selected = null;

  function select(cell, day) {
    if (selected) selected.classList.remove('selected');
    selected = cell;
    cell.classList.add('selected');
    document.getElementById('sel-date').textContent =
      `${String(day.date.getUTCDate()).padStart(2, '0')} ${MONTHS[day.date.getUTCMonth()]}`;
    document.getElementById('sel-weekday').textContent =
      `${WEEKDAYS[day.date.getUTCDay()]} · ${day.date.getUTCFullYear()}`;
    document.getElementById('sel-text').textContent = day.future ? 'ainda não jogado' : describe(day.counts);
  }

  let todayCell = null;
  let todayDay = null;
  for (let w = 0; w < WEEKS; w++) {
    const week = document.createElement('div');
    week.className = 'week';
    const sunday = addDays(start, w * 7);
    const month = document.createElement('span');
    month.className = 'month';
    month.setAttribute('aria-hidden', 'true');
    if (sunday.getUTCDate() <= 7) month.textContent = MONTHS[sunday.getUTCMonth()];
    week.append(month);

    for (let r = 0; r < 7; r++) {
      const date = addDays(sunday, r);
      const iso = isoDay(date);
      const future = date > today;
      const counts = data.days[iso] || {};
      const day = { date, future, counts };
      const label = `${String(date.getUTCDate()).padStart(2, '0')} ${MONTHS[date.getUTCMonth()]}`;

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      if (future) cell.dataset.kind = 'future';
      else {
        cell.style.background = fillOf(counts);
        if (taught(counts)) cell.classList.add('taught');
      }
      cell.setAttribute('aria-label', `${label} — ${future ? 'ainda não jogado' : describe(counts)}`);
      cell.title = cell.getAttribute('aria-label');
      cell.addEventListener('mouseenter', () => select(cell, day));
      cell.addEventListener('focus', () => select(cell, day));
      if (iso === data.to) {
        cell.classList.add('today');
        todayCell = cell;
        todayDay = day;
      }
      week.append(cell);
    }
    grid.append(week);
  }

  if (todayCell) select(todayCell, todayDay);
  // Em telas estreitas, mostra o fim (hoje) primeiro
  const scroll = document.getElementById('grid-scroll');
  scroll.scrollLeft = scroll.scrollWidth;
  renderFooter(data);
}

function renderFooter(data) {
  const footer = document.getElementById('footer');
  const updated = new Date(data.generated_at).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  });
  const failed = Object.entries(data.sources || {}).filter(([, status]) => !status.ok);
  footer.textContent = `Atualizado em ${updated}. Passe o mouse ou use Tab nos dias para ver o detalhe.`;
  for (const [source, status] of failed) {
    const line = document.createElement('div');
    line.className = 'error';
    line.textContent = `${SOURCE_NAMES[source] || source}: falhou na última coleta (${status.error}); mostrando os dados anteriores.`;
    footer.append(line);
  }
}

fetch('activity.json', { cache: 'no-store' })
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then(render)
  .catch((error) => {
    document.getElementById('sel-text').textContent = `não consegui carregar os dados (${error.message})`;
  });
