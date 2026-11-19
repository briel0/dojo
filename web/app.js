// Desenha o quadrinho a partir do activity.json gerado pelo coletor. Sem framework (decisão 8).
'use strict';

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const SOURCE_NAMES = {
  github: 'GitHub', codeforces: 'Codeforces', grub: 'GRUB', workout: 'Treinos', teaching: 'Aulas', foryou: 'For you',
};
// Atividades que pintam a célula, na ordem em que a dividem (decisões 3 e 4). A aula não pinta:
// vira um quadradinho discreto no meio da célula (decisão 16).
const ACTIVITIES = [
  { name: 'código', color: 'var(--code)', done: (c) => (c.github || 0) + (c.codeforces || 0) + (c.grub || 0) > 0 },
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
  if (counts.grub) parts.push(`${plural(counts.grub, 'AC', 'ACs')} no GRUB`);
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
  renderForYou(data);
  renderGrub(data);
  renderFooter(data);
}

function sinceText(days) {
  if (days === null) return 'sem registro';
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  return `${days} dias`;
}

/**
 * "For you": o treino feito há mais tempo em destaque e a lista inteira embaixo, já na ordem do coletor
 * (decisão 17). Sem arquivo de definições no coletor, a seção fica escondida.
 */
function renderForYou(data) {
  const foryou = data.foryou;
  if (!foryou || !foryou.treinos || foryou.treinos.length === 0) return;
  const [next] = foryou.treinos;
  document.getElementById('foryou-name').textContent = next.nome.toUpperCase();
  document.getElementById('foryou-why').textContent = next.dias === null
    ? `sem registro nos últimos ${foryou.janela_dias} dias`
    : `o que você não faz há mais tempo (${sinceText(next.dias)})`;
  document.getElementById('foryou-src').textContent = `${foryou.janela_dias} DIAS · API TREINOS`;

  const list = document.getElementById('foryou-list');
  for (const item of foryou.treinos) {
    const row = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'foryou-name';
    name.textContent = item.nome;
    const since = document.createElement('span');
    since.className = item.dias === null ? 'foryou-since muted' : 'foryou-since';
    since.textContent = sinceText(item.dias);
    const when = document.createElement('span');
    when.className = 'foryou-when muted';
    if (item.ultimo) {
      const date = parseDay(item.ultimo);
      when.textContent = `${String(date.getUTCDate()).padStart(2, '0')} ${MONTHS[date.getUTCMonth()]}`;
    }
    row.append(name, since, when);
    list.append(row);
  }
  document.getElementById('rec-treino').hidden = false;
  document.getElementById('foryou').hidden = false;
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

// Card GRUB (decisão 19): o problema do dia ao vivo, pelo proxy do nginx só para as rotas públicas
// (/grub/api/v1/daily...). Horários em Brasília, como no site do GRUB.
const GRUB = '/grub/api/v1/daily';
const GRUB_VISIBLE = 5; // ranking: top 5 quando o dono não resolveu; senão top 3 e a vizinhança dele
const timeBR = (iso) => new Date(iso).toLocaleTimeString('pt-BR', {
  hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
});

async function grubJSON(path) {
  const response = await fetch(GRUB + path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function untilText(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

/** As linhas do ranking: top 3 + vizinhos do dono (se ele resolveu) ou o top 5, com "…" nos saltos. */
function rankingRows(ranking, meIndex) {
  const keep = new Set();
  if (meIndex < 0) ranking.slice(0, GRUB_VISIBLE).forEach((_, i) => keep.add(i));
  else {
    for (let i = 0; i < Math.min(3, ranking.length); i++) keep.add(i);
    for (let i = meIndex - 1; i <= meIndex + 1; i++) if (i >= 0 && i < ranking.length) keep.add(i);
  }
  const rows = [];
  let last = -1;
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (last >= 0 && i > last + 1) rows.push(null);
    rows.push(ranking[i]);
    last = i;
  }
  return rows;
}

function renderGrubRanking(ranking, userId) {
  const list = document.getElementById('grub-list');
  list.replaceChildren();
  const meIndex = ranking.findIndex((entry) => entry.user_id === userId);
  for (const entry of rankingRows(ranking, meIndex)) {
    const row = document.createElement('li');
    if (!entry) {
      row.className = 'gap';
      row.textContent = '…';
      list.append(row);
      continue;
    }
    if (entry.user_id === userId) row.className = 'is-me';
    const name = document.createElement('span');
    name.className = 'foryou-name';
    name.textContent = `${entry.rank}º ${entry.user_id === userId ? 'você' : entry.name}`;
    const penalty = document.createElement('span');
    penalty.className = 'foryou-since';
    penalty.textContent = `${entry.penalty} min`;
    const streak = document.createElement('span');
    streak.className = 'foryou-when muted';
    streak.textContent = entry.streak ? `seq. ${entry.streak}` : '';
    row.append(name, penalty, streak);
    list.append(row);
  }
  return meIndex >= 0 ? ranking[meIndex] : null;
}

let grubTimer = null;

async function renderGrub(data) {
  if (!data.grub || !data.grub.user_id) return;
  const box = document.getElementById('rec-grub');
  const userId = data.grub.user_id;
  const state = document.getElementById('grub-state');
  const title = document.getElementById('grub-title');
  const why = document.getElementById('grub-why');
  const foot = document.getElementById('grub-foot');
  box.hidden = false;
  document.getElementById('foryou').hidden = false;
  clearInterval(grubTimer);
  try {
    const daily = await grubJSON('');
    if (daily.state === 'none' || !daily.day) {
      box.classList.remove('urgent');
      state.textContent = 'FECHADO';
      title.textContent = '';
      why.textContent = daily.next_opens_at ? `o próximo abre às ${timeBR(daily.next_opens_at)}` : 'nenhum problema do dia ainda';
      document.getElementById('grub-list').replaceChildren();
      foot.textContent = '';
      return;
    }
    const day = await grubJSON(`/days/${daily.day.date}`);
    title.textContent = daily.day.problem.title;
    const mine = renderGrubRanking(day.ranking, userId);
    foot.textContent = `${plural(day.solvers, 'pessoa resolveu', 'pessoas resolveram')}`;
    const open = daily.state === 'open';
    box.classList.toggle('urgent', open && !mine);

    if (mine) {
      state.textContent = `RESOLVIDO · ${mine.rank}º`;
      why.textContent = `penalidade de ${mine.penalty} min${mine.streak ? ` · sequência de ${mine.streak}` : ''}`;
    } else if (open) {
      state.textContent = 'EM ABERTO';
      // A sequência só aparece no ranking do mês enquanto o dono não resolveu o dia
      let streak = 0;
      try {
        const month = await grubJSON(`/month?m=${daily.day.date.slice(0, 7)}`);
        streak = (month.ranking.find((entry) => entry.user_id === userId) || {}).streak || 0;
      } catch { /* sem a sequência, o card segue */ }
      const tick = () => {
        const left = new Date(daily.day.closes_at) - Date.now();
        if (left <= 0) {
          clearInterval(grubTimer);
          renderGrub(data);
          return;
        }
        why.textContent = `fecha em ${untilText(left)}${streak ? ` · sequência de ${streak} em risco` : ''}`;
      };
      tick();
      grubTimer = setInterval(tick, 30000);
    } else {
      state.textContent = 'FECHADO';
      why.textContent = `ranking final · o próximo abre às ${timeBR(daily.next_opens_at)}`;
    }
  } catch (error) {
    box.classList.remove('urgent');
    state.textContent = 'FORA DO AR';
    title.textContent = '';
    why.textContent = `não consegui falar com o GRUB (${error.message})`;
    foot.textContent = '';
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
