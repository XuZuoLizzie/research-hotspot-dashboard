'use strict';
/*
 * 医学影像文献智能分析仪表板 —— 纯静态前端（无服务器端依赖）
 * 数据：data/articles.json + data/journals.json（fetch）；
 *       若以 file:// 直接打开导致 fetch 失败，则回退加载 data/bundle.js（可选）。
 */

/* ------------------------------------------------------------------ */
/* 常量与工具                                                          */
/* ------------------------------------------------------------------ */
const $ = id => document.getElementById(id);
const P = ['#55a7ff', '#27d3c4', '#ffb454', '#ff729f', '#a88cff', '#6ee7a8', '#ff8b5c', '#58d5ff'];
const DIMS = [
  { key: 'journal', label: '期刊' },
  { key: 'modality', label: '影像模态' },
  { key: 'theme', label: '研究主题' },
  { key: 'future', label: '研究方向' },
  { key: 'anatomy', label: '解剖/疾病领域' },
  { key: 'maturity', label: '证据成熟度' }
];
const DIM_LABEL = Object.fromEntries(DIMS.map(d => [d.key, d.label]));
const STAGES = [
  '发现性/临床前研究',
  '算法、方法或研究方案开发',
  '回顾性或探索性临床研究',
  '前瞻性、纵向或多中心验证',
  '干预性临床试验与治疗验证',
  '证据整合、指南或真实世界证据'
];
const STAGE_DISPLAY = [
  '1. 发现性/<br>临床前研究',
  '2. 算法、方法或<br>研究方案开发',
  '3. 回顾性或探索性<br>临床研究',
  '4. 前瞻性、纵向或<br>多中心验证',
  '5. 干预性临床试验<br>与治疗验证',
  '6. 证据整合、指南或<br>真实世界证据'
];
// 兼容旧的四阶段分类
const LEGACY_STAGE = {
  '算法/方法开发': STAGES[1],
  '前临床/技术验证': STAGES[0],
  '临床数据验证': STAGES[2],
  '临床验证与转化': STAGES[3]
};
const FLOWS = {
  'theme,future,maturity': '主题 → 方向 → 成熟度',
  'modality,anatomy,maturity': '模态 → 解剖 → 成熟度',
  'journal,theme,maturity': '期刊 → 主题 → 成熟度',
  'modality,future,maturity': '模态 → 方向 → 成熟度'
};
const MAX_CARDS = 120;

const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const normJ = s => String(s || '').normalize('NFKC').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
const hashStr = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const cssVar = n => getComputedStyle(document.body).getPropertyValue(n).trim();
const ink = () => cssVar('--ink');
const muted = () => cssVar('--muted');
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/* 安全渲染标题：仅保留 sup/sub 及 small-caps span，其余转为纯文本 */
function titleHTML(s) {
  const box = document.createElement('div');
  box.innerHTML = String(s ?? '').replace(/&lt;(\/?)(sup|sub)&gt;/gi, '<$1$2>');
  const clean = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) return;
      if (child.nodeType !== Node.ELEMENT_NODE) { child.remove(); return; }
      const tag = child.tagName.toLowerCase();
      if (tag === 'sup' || tag === 'sub') {
        [...child.attributes].forEach(at => child.removeAttribute(at.name));
        clean(child); return;
      }
      if (tag === 'span' && /small-caps/i.test(child.getAttribute('style') || '')) {
        [...child.attributes].forEach(at => child.removeAttribute(at.name));
        child.className = 'small-caps'; clean(child); return;
      }
      child.replaceWith(document.createTextNode(child.textContent || ''));
    });
  };
  clean(box);
  return box.innerHTML;
}
function plain(s) { const d = document.createElement('div'); d.innerHTML = titleHTML(s); return d.textContent.trim(); }

/* DOI 规范化：支持纯 DOI、https://doi.org/…、http://dx.doi.org/… 以及仅含 DOI 的 doi_url */
function doiInfo(a) {
  const doi = String(a.doi || '').trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  let url = String(a.doi_url || '').trim();
  if (url && !/^https?:\/\//i.test(url)) url = `https://doi.org/${encodeURI(url)}`;
  if (!url && doi) url = `https://doi.org/${encodeURI(doi)}`;
  return { doi, url: /^https?:\/\//i.test(url) ? url : '' };
}

/* ------------------------------------------------------------------ */
/* 数据与状态                                                          */
/* ------------------------------------------------------------------ */
let A = [];
let W = [];
const JMETA = new Map();      // normalized name -> journal meta
const ABBR2NAME = new Map();
const ORDER = {};             // dim -> ordered values
let IF_MIN = 0, IF_MAX = 0, DATE_MIN = '', DATE_MAX = '';
let currentList = [];
let modalIndex = -1;
let chipActions = [];
const openFacets = new Set(['maturity']);

const state = {
  q: '',
  f: Object.fromEntries(DIMS.map(d => [d.key, new Set()])),
  ifMin: 0, ifMax: 0, dateFrom: '', dateTo: '',
  absOnly: false, ids: null,
  pivotX: 'future', pivotY: 'journal', pivotNorm: 'count',
  colorBy: 'future', flow: 'theme,future,maturity'
};

const abbr = name => JMETA.get(normJ(name))?.abbr || name;
const dimText = (k, v) => (k === 'journal' ? abbr(v) : v);
const colorFor = (k, v) => P[Math.max(0, ORDER[k].indexOf(v)) % P.length];
const countBy = (list, k) => list.reduce((m, a) => (m[a[k]] = (m[a[k]] || 0) + 1, m), {});
const tokens = () => state.q.toLowerCase().split(/\s+/).filter(Boolean);
const ifActive = () => state.ifMin > IF_MIN || state.ifMax < IF_MAX;

function prepare(articles, journals) {
  W = journals;
  journals.forEach(j => { JMETA.set(normJ(j.name), j); ABBR2NAME.set(j.abbr, j.name); });
  A = articles.map(raw => {
    const a = { ...raw };
    const meta = JMETA.get(normJ(a.journal));
    if (meta) a.journal = meta.name; // 统一期刊名（修复 “-” 与 “–” 不一致导致的匹配失败）
    a.maturity = LEGACY_STAGE[a.maturity] || a.maturity;
    const imp = a.impact == null || a.impact === '' ? NaN : Number(a.impact);
    a.impact = Number.isFinite(imp) ? imp : (meta?.impact_factor ?? null);
    a._en = plain(a.title);
    a._zh = plain(a.title_chinese);
    a._text = [a._en, a._zh, a.abstract, a.highlight, a.journal, a.doi, a.modality, a.theme, a.future, a.anatomy, a.maturity]
      .join(' ').toLowerCase();
    return a;
  });
  DIMS.forEach(({ key }) => {
    const c = countBy(A, key);
    let vals = Object.keys(c).filter(v => v && v !== 'undefined');
    if (key === 'maturity') vals = [...STAGES.filter(s => c[s]), ...vals.filter(v => !STAGES.includes(v))];
    else vals.sort((x, y) => c[y] - c[x] || x.localeCompare(y));
    ORDER[key] = vals;
  });
  const ifs = A.map(a => a.impact).filter(Number.isFinite);
  IF_MIN = Math.floor(Math.min(...ifs) * 10) / 10;
  IF_MAX = Math.ceil(Math.max(...ifs) * 10) / 10;
  const dates = A.map(a => a.date).filter(Boolean).sort();
  DATE_MIN = dates[0]; DATE_MAX = dates[dates.length - 1];
  state.ifMin = IF_MIN; state.ifMax = IF_MAX;
}

/* 过滤：skip 参数用于“分面计数”——排除某一维度自身的条件 */
function pass(a, skip, toks) {
  if (toks.length && !toks.every(t => a._text.includes(t))) return false;
  if (ifActive()) {
    if (!Number.isFinite(a.impact) || a.impact < state.ifMin || a.impact > state.ifMax) return false;
  }
  if (state.dateFrom && a.date < state.dateFrom) return false;
  if (state.dateTo && a.date > state.dateTo) return false;
  if (state.absOnly && !a.abstract) return false;
  if (state.ids && !state.ids.has(a.ID)) return false;
  for (const { key } of DIMS) {
    if (key === skip) continue;
    const s = state.f[key];
    if (s.size && !s.has(a[key])) return false;
  }
  return true;
}
const listExcept = (dim, toks) => A.filter(a => pass(a, dim, toks));

function anyFilter() {
  return Boolean(state.q || ifActive() || state.dateFrom || state.dateTo || state.absOnly || state.ids ||
    DIMS.some(d => state.f[d.key].size));
}

function toggle(dim, v) {
  const s = state.f[dim];
  if (s.has(v)) s.delete(v); else s.add(v);
  update();
}
/* 同时设置多个维度为单值；若与当前完全一致则清除（用于热力图/旭日图） */
function setExact(pairs) {
  const same = pairs.every(([k, v]) => state.f[k].size === 1 && state.f[k].has(v));
  pairs.forEach(([k, v]) => { state.f[k] = same ? new Set() : new Set([v]); });
  update();
}
function toggleToken(word) {
  const toks = state.q.split(/\s+/).filter(Boolean);
  const i = toks.findIndex(t => t.toLowerCase() === word.toLowerCase());
  if (i >= 0) toks.splice(i, 1); else toks.push(word);
  state.q = toks.join(' ');
  $('q').value = state.q;
  update();
}

function resetAll() {
  state.q = '';
  DIMS.forEach(d => state.f[d.key].clear());
  state.ifMin = IF_MIN; state.ifMax = IF_MAX;
  state.dateFrom = ''; state.dateTo = '';
  state.absOnly = false; state.ids = null;
  update();
}

/* ------------------------------------------------------------------ */
/* 侧栏、筛选标签、KPI                                                 */
/* ------------------------------------------------------------------ */
function syncControls() {
  $('q').value = state.q;
  ['ifMin', 'ifMax'].forEach(id => { $(id).min = IF_MIN; $(id).max = IF_MAX; });
  $('ifMin').value = state.ifMin; $('ifMax').value = state.ifMax;
  $('ifLabel').textContent = `${state.ifMin.toFixed(1)} – ${state.ifMax.toFixed(1)}`;
  ['dateFrom', 'dateTo'].forEach(id => { $(id).min = DATE_MIN; $(id).max = DATE_MAX; });
  $('dateFrom').value = state.dateFrom || DATE_MIN;
  $('dateTo').value = state.dateTo || DATE_MAX;
  $('absOnly').checked = state.absOnly;
  $('kpiAbs').classList.toggle('is-on', state.absOnly);
  $('pivotX').value = state.pivotX; $('pivotY').value = state.pivotY; $('pivotNorm').value = state.pivotNorm;
  $('colorBy').value = state.colorBy; $('flowSel').value = state.flow;
}

function renderFacets(toks) {
  $('facets').innerHTML = DIMS.map(d => {
    const counts = countBy(listExcept(d.key, toks), d.key);
    const sel = state.f[d.key];
    const items = ORDER[d.key].map(v => {
      const n = counts[v] || 0;
      const on = sel.has(v);
      return `<label class="facet-item ${n || on ? '' : 'is-empty'}">
        <input type="checkbox" data-dim="${d.key}" value="${esc(v)}" ${on ? 'checked' : ''}>
        <span class="facet-name" title="${esc(v)}">${esc(dimText(d.key, v))}</span>
        <span class="facet-count">${n}</span></label>`;
    }).join('');
    const open = openFacets.has(d.key) || sel.size;
    return `<details class="facet" data-dim="${d.key}" ${open ? 'open' : ''}>
      <summary><span>${d.label}</span>${sel.size ? `<span class="facet-badge">${sel.size}</span>
      <button type="button" class="facet-clear" data-clear="${d.key}">清除</button>` : ''}</summary>
      <div class="facet-list">${items}</div></details>`;
  }).join('');
}

function renderChips() {
  chipActions = [];
  const add = (text, fn) => chipActions.push({ text, fn });
  if (state.q) add(`检索：${state.q}`, () => { state.q = ''; });
  DIMS.forEach(d => state.f[d.key].forEach(v => add(`${d.label}：${dimText(d.key, v)}`, () => state.f[d.key].delete(v))));
  if (ifActive()) add(`影响因子：${state.ifMin.toFixed(1)}–${state.ifMax.toFixed(1)}`, () => { state.ifMin = IF_MIN; state.ifMax = IF_MAX; });
  if (state.dateFrom || state.dateTo) add(`日期：${state.dateFrom || DATE_MIN} 至 ${state.dateTo || DATE_MAX}`, () => { state.dateFrom = ''; state.dateTo = ''; });
  if (state.absOnly) add('仅含摘要', () => { state.absOnly = false; });
  if (state.ids) add(`图上圈选：${state.ids.size} 篇`, () => { state.ids = null; });
  $('chips').innerHTML = chipActions.map((c, i) => `<button type="button" class="chip" data-chip="${i}">${esc(c.text)} <b>×</b></button>`).join('') +
    (chipActions.length > 1 ? '<button type="button" class="chip clear-all" data-chip="all">清除全部</button>' : '');
}

function renderKPIs(list) {
  const ifs = list.map(x => x.impact).filter(Number.isFinite);
  const strong = list.filter(x => STAGES.indexOf(x.maturity) >= 3).length;
  $('kN').textContent = list.length;
  $('kJ').textContent = new Set(list.map(x => x.journal)).size;
  $('kA').textContent = list.filter(x => x.abstract).length;
  $('kP').textContent = list.length ? `${Math.round(strong / list.length * 100)}%` : '—';
  $('kIF').textContent = ifs.length ? (ifs.reduce((s, x) => s + x, 0) / ifs.length).toFixed(1) : 'NA';
  const top = (k, n) => Object.entries(countBy(list, k)).sort((x, y) => y[1] - x[1]).slice(0, n);
  const fmt = arr => arr.map(([v, c]) => `${esc(v)}（${c}篇）`).join('、') || '暂无';
  $('summary').innerHTML = list.length
    ? `当前 <b>${list.length}</b> 篇文章。主要主题：${fmt(top('theme', 3))}；主要模态：${fmt(top('modality', 2))}；` +
      `证据成熟度以“${esc(top('maturity', 1)[0]?.[0] || '—')}”为主，前瞻性/干预/证据整合类占 ${Math.round(strong / list.length * 100)}%。`
    : '当前筛选条件下没有文章。';
}

function renderStatus(list) {
  $('status').textContent = `已载入 ${A.length} 篇文章 / ${W.length} 种监测期刊；当前显示 ${list.length} 篇`;
  const active = anyFilter();
  $('reset').disabled = !active;
  $('reset').setAttribute('aria-disabled', String(!active));
  $('reset').title = active ? '清除当前全部筛选条件' : '当前没有已应用的筛选条件';
}

/* ------------------------------------------------------------------ */
/* 文献卡片（原始卡片设计）                                            */
/* ------------------------------------------------------------------ */
function cardHTML(x) {
  const { doi, url } = doiInfo(x);
  return `<article class="article">
    <div class="meta">${esc(x.date)} · ${esc(x.journal)} · IF ${x.impact ?? 'NA'}</div>
    ${x.title_chinese ? `<h3 class="title-chinese">${titleHTML(x.title_chinese)}</h3>` : ''}
    <h3 class="title-english">${titleHTML(x.title)}</h3>
    <span class="pill">${esc(x.modality)}</span>
    <span class="pill">${esc(x.future)}</span>
    <p>${esc(x.highlight)}</p>
    ${url ? `<div class="meta doi-container"><span>DOI：</span><a class="doi-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(doi || url)}</a></div>` : ''}
  </article>`;
}

function renderCards(list) {
  const vis = list.slice(0, MAX_CARDS);
  $('articles').innerHTML = vis.length
    ? vis.map(cardHTML).join('')
    : '<div class="empty">没有符合条件的文献。</div>';
  $('articleCount').textContent = `显示 ${Math.min(list.length, MAX_CARDS)} / ${list.length} 篇`;
}

/* ------------------------------------------------------------------ */
/* 详情弹窗（由时间轴散点打开）                                        */
/* ------------------------------------------------------------------ */
function openModal(id) {
  let idx = currentList.findIndex(a => a.ID === id);
  if (idx < 0) { const a = A.find(x => x.ID === id); if (!a) return; currentList = [a, ...currentList]; idx = 0; }
  modalIndex = idx;
  renderModal();
  $('modal').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal() { $('modal').hidden = true; document.body.style.overflow = ''; }
function renderModal() {
  const a = currentList[modalIndex];
  if (!a) return;
  const { doi, url } = doiInfo(a);
  $('mMeta').textContent = `${a.date} · ${a.journal} · IF ${a.impact ?? 'NA'}`;
  $('mPos').textContent = `${modalIndex + 1} / ${currentList.length}`;
  $('mPrev').disabled = modalIndex <= 0;
  $('mNext').disabled = modalIndex >= currentList.length - 1;
  $('mBody').innerHTML = `
    ${a.title_chinese ? `<h3 id="mTitle">${titleHTML(a.title_chinese)}</h3>` : ''}
    <div class="en" ${a.title_chinese ? '' : 'id="mTitle"'}>${titleHTML(a.title)}</div>
    <div style="margin-top:10px">${DIMS.filter(d => d.key !== 'journal').map(d => `<span class="pill">${esc(a[d.key])}</span>`).join('')}</div>
    <h4>要点（中文）</h4><p>${esc(a.highlight)}</p>
    <h4>英文摘要</h4><p>${a.abstract ? esc(a.abstract) : '［原始数据未提供摘要］'}</p>
    <dl class="kv">
      <dt>期刊</dt><dd>${esc(a.journal)}（${esc(abbr(a.journal))}）</dd>
      <dt>期刊 H-index</dt><dd>${a.h_index ?? '—'}</dd>
      <dt>DOI</dt><dd>${url ? `<a class="doi-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(doi || url)}</a>` : '—'}</dd>
    </dl>`;
}
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ------------------------------------------------------------------ */
/* 图表                                                                */
/* ------------------------------------------------------------------ */
const CFG = { responsive: true, displaylogo: false, displayModeBar: 'hover', modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'] };
function lay(x = {}) {
  return {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: ink(), family: 'Inter,Microsoft YaHei' },
    margin: { l: 55, r: 20, t: 15, b: 55 },
    hoverlabel: { font: { family: 'Inter,Microsoft YaHei' } },
    ...x
  };
}
function bind(id, evt, fn) {
  const el = $(id);
  el.removeAllListeners?.(evt);
  el.on?.(evt, fn);
}
function emptyChart(id, msg = '当前筛选条件下无数据') {
  Plotly.react(id, [], lay({
    xaxis: { visible: false }, yaxis: { visible: false },
    annotations: [{ text: msg, showarrow: false, font: { size: 14, color: muted() }, xref: 'paper', yref: 'paper', x: .5, y: .5 }]
  }), CFG);
}

function barChart(id, dim, base) {
  const c = countBy(base, dim);
  const sel = state.f[dim];
  const ys = ORDER[dim].filter(v => c[v] || sel.has(v)).reverse();
  if (!ys.length) return emptyChart(id);
  Plotly.react(id, [{
    type: 'bar', orientation: 'h',
    x: ys.map(v => c[v] || 0), y: ys, text: ys.map(v => c[v] || 0), textposition: 'auto', cliponaxis: false,
    marker: {
      color: ys.map(v => colorFor(dim, v)),
      opacity: ys.map(v => (!sel.size || sel.has(v) ? 0.95 : 0.3)),
      line: { width: ys.map(v => (sel.has(v) ? 2 : 0)), color: ink() }
    },
    hovertemplate: '%{y}<br>%{x} 篇<br><i>点击加入/移出筛选</i><extra></extra>'
  }], lay({ margin: { l: 10, r: 20, t: 10, b: 30 }, yaxis: { automargin: true }, xaxis: { gridcolor: 'rgba(148,163,184,.15)' } }), CFG);
  bind(id, 'plotly_click', ev => { const p = ev.points?.[0]; if (p) toggle(dim, p.y); });
}

function pivotChart(list) {
  const X = state.pivotX, Y = state.pivotY;
  if (!list.length) return emptyChart('pivot');
  const cx = countBy(list, X), cy = countBy(list, Y);
  const xs = ORDER[X].filter(v => cx[v]);
  const ys = ORDER[Y].filter(v => cy[v]);
  const cnt = ys.map(y => xs.map(x => list.filter(a => a[Y] === y && a[X] === x).length));
  const z = cnt.map((row, i) => row.map((n, j) => {
    if (!n) return null;
    if (state.pivotNorm === 'row') return n / cy[ys[i]] * 100;
    if (state.pivotNorm === 'col') return n / cx[xs[j]] * 100;
    return n;
  }));
  const pct = state.pivotNorm !== 'count';
  const ticks = (k, vals) => ({ type: 'category', showgrid: false, zeroline: false, tickvals: vals, ticktext: vals.map(v => trunc(dimText(k, v), 16)), automargin: true });
  Plotly.react('pivot', [{
    type: 'heatmap', x: xs, y: ys, z, customdata: cnt, colorscale: 'YlGnBu', xgap: 2, ygap: 2,
    texttemplate: pct ? '%{z:.0f}%' : '%{z}', hoverongaps: false,
    colorbar: { title: { text: pct ? '%' : '篇', side: 'right' }, thickness: 12, outlinewidth: 0 },
    hovertemplate: `${DIM_LABEL[Y]}：%{y}<br>${DIM_LABEL[X]}：%{x}<br>%{customdata} 篇${pct ? '（%{z:.1f}%）' : ''}<br><i>点击筛选</i><extra></extra>`
  }], lay({
    margin: { l: 10, r: 10, t: 10, b: 10 },
    xaxis: { ...ticks(X, xs), tickangle: -30, side: 'bottom' },
    yaxis: { ...ticks(Y, ys), autorange: 'reversed' }
  }), CFG);
  bind('pivot', 'plotly_click', ev => { const p = ev.points?.[0]; if (p) setExact([[X, p.x], [Y, p.y]]); });
}

function sunburstChart(list) {
  if (!list.length) return emptyChart('sunburst');
  const nodes = new Map();
  const add = (id, label, parent, color, alpha) => {
    if (!nodes.has(id)) nodes.set(id, { id, label, parent, value: 0, color: hexA(color, alpha) });
    nodes.get(id).value += 1;
  };
  list.forEach(a => {
    const c = colorFor('modality', a.modality);
    const m = a.modality, ma = `${m}|${a.anatomy}`;
    add(m, m, '', c, 0.95); add(ma, a.anatomy, m, c, 0.55);
  });
  const N = [...nodes.values()];
  Plotly.react('sunburst', [{
    type: 'sunburst', ids: N.map(n => n.id), labels: N.map(n => n.label), parents: N.map(n => n.parent), values: N.map(n => n.value),
    branchvalues: 'total', insidetextorientation: 'radial', textfont: { size: 11 },
    marker: { colors: N.map(n => n.color), line: { color: cssVar('--panel'), width: 1 } },
    hovertemplate: '<b>%{label}</b><br>%{value} 篇<br>占上级 %{percentParent:.0%}<br><i>点击筛选</i><extra></extra>'
  }], lay({ margin: { l: 5, r: 5, t: 5, b: 5 } }), CFG);
  bind('sunburst', 'plotly_sunburstclick', ev => {
    const id = ev.points?.[0]?.id;
    if (!id) return false;
    const [m, an] = id.split('|');
    const pairs = [['modality', m]];
    if (an) pairs.push(['anatomy', an]);
    setExact(pairs);
    return false; // 阻止默认的下钻缩放，改为联动筛选
  });
}

function metricsChart(list) {
  const n = countBy(list, 'journal');
  const sel = state.f.journal;
  Plotly.react('journalMetrics', [{
    type: 'scatter', mode: 'markers+text',
    x: W.map(j => j.impact_factor), y: W.map(j => j.h_index), text: W.map(j => j.abbr), textposition: 'top center',
    textfont: { size: 10, color: W.map(j => (n[j.name] ? ink() : muted())) },
    customdata: W.map(j => [j.name, n[j.name] || 0]),
    marker: {
      size: W.map(j => (n[j.name] ? 12 + Math.sqrt(n[j.name]) * 4 : 8)),
      color: W.map(j => (n[j.name] ? j.impact_factor : '#8492a6')), colorscale: 'Viridis',
      opacity: W.map(j => (n[j.name] ? 0.88 : 0.28)),
      line: { width: W.map(j => (sel.has(j.name) ? 3 : 0.5)), color: W.map(j => (sel.has(j.name) ? '#ff729f' : 'rgba(255,255,255,.4)')) }
    },
    hovertemplate: '%{customdata[0]}<br>IF %{x}<br>H-index %{y}<br>当前 %{customdata[1]} 篇<br><i>点击筛选期刊</i><extra></extra>'
  }], lay({ xaxis: { title: { text: '期刊影响因子' }, gridcolor: 'rgba(148,163,184,.15)' }, yaxis: { title: { text: '期刊 H-index' }, gridcolor: 'rgba(148,163,184,.15)' } }), CFG);
  bind('journalMetrics', 'plotly_click', ev => { const p = ev.points?.[0]; if (p) toggle('journal', p.customdata[0]); });
}

/* 仅用于显示的确定性抖动：日期 ±5 天、影响因子 ±0.2；悬停与筛选均使用真实值 */
function jitterDate(a) {
  const off = ((hashStr(a.ID) % 1000) / 1000 - 0.5) * 2 * 5 * 86400 * 1000;
  return new Date(new Date(`${a.date}T12:00:00Z`).getTime() + off).toISOString();
}
const jitterIF = a => a.impact + ((hashStr(`if${a.ID}`) % 1000) / 1000 - 0.5) * 0.4;

function timelineChart(list) {
  const pts = list.filter(a => a.date && Number.isFinite(a.impact));
  if (!pts.length) return emptyChart('timeline');
  const by = state.colorBy;
  const groups = ORDER[by].filter(v => pts.some(a => a[by] === v));
  const traces = groups.map(g => {
    const s = pts.filter(a => a[by] === g);
    return {
      type: 'scatter', mode: 'markers', name: g,
      x: s.map(jitterDate), y: s.map(jitterIF),
      customdata: s.map(a => [a.ID, a.date, abbr(a.journal), trunc(a._zh || a._en, 46), a.impact]),
      marker: { size: 9, color: colorFor(by, g), opacity: 0.8, line: { width: 0.5, color: 'rgba(255,255,255,.45)' } },
      hovertemplate: '%{customdata[3]}<br>%{customdata[1]} · %{customdata[2]} · IF %{customdata[4]}<extra>%{fullData.name}</extra>'
    };
  });
  Plotly.react('timeline', traces, lay({
    uirevision: 'timeline', dragmode: 'zoom', selections: [],
    legend: { orientation: 'h', y: -0.18, font: { size: 11 } },
    margin: { l: 55, r: 15, t: 10, b: 30 },
    xaxis: { type: 'date', rangeslider: { visible: false }, gridcolor: 'rgba(148,163,184,.12)' },
    yaxis: { title: { text: '期刊影响因子' }, gridcolor: 'rgba(148,163,184,.15)' }
  }), { ...CFG, modeBarButtonsToRemove: ['autoScale2d'] });
  bind('timeline', 'plotly_click', ev => { const p = ev.points?.[0]; if (p) openModal(p.customdata[0]); });
  bind('timeline', 'plotly_selected', ev => {
    const ids = (ev?.points || []).map(p => p.customdata?.[0]).filter(v => v != null);
    if (!ids.length) return;
    state.ids = new Set(ids);
    update();
    toast(`已圈选 ${ids.length} 篇文章`);
  });
}

function flowChart(list) {
  if (!list.length) return emptyChart('flow');
  const keys = state.flow.split(',');
  const stageScale = STAGES.map((_, i) => [i / (STAGES.length - 1), P[i]]);
  Plotly.react('flow', [{
    type: 'parcats', arrangement: 'freeform', hoveron: 'category', hoverinfo: 'count+probability',
    dimensions: keys.map(k => ({
      label: DIM_LABEL[k],
      values: list.map(a => dimText(k, a[k])),
      categoryorder: 'array',
      // 仅包含当前数据中出现的类别（parcats 不允许 categoryarray 含缺失类别）
      categoryarray: ORDER[k].filter(v => list.some(a => a[k] === v)).map(v => dimText(k, v))
    })),
    line: { color: list.map(a => Math.max(0, STAGES.indexOf(a.maturity))), colorscale: stageScale, cmin: 0, cmax: STAGES.length - 1, shape: 'hspline' },
    labelfont: { size: 13, color: ink() }, tickfont: { size: 11, color: ink() }
  }], lay({ margin: { l: 170, r: 190, t: 30, b: 15 } }), CFG);
  bind('flow', 'plotly_click', ev => {
    const cons = ev?.constraints;
    if (!cons) return;
    Object.entries(cons).forEach(([idx, val]) => {
      const k = keys[Number(idx)];
      if (!k) return;
      const raw = k === 'journal' ? (ABBR2NAME.get(val) || val) : val;
      const s = state.f[k];
      if (s.has(raw)) s.delete(raw); else s.add(raw);
    });
    update();
  });
}

const STOP = new Set(('the and for with from using based medical image images imaging model models analysis study method methods ' +
  'framework novel via into between patients patient after its their toward towards versus among within across during ' +
  'without new use are can how not our this that than when what which while multi').split(' '));
function cloudChart(list) {
  const m = {};
  list.forEach(x => {
    (String(x._en || '').toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []).forEach(w => {
      if (!STOP.has(w)) m[w] = (m[w] || 0) + 1;
    });
  });
  const words = Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 60);
  const c = $('wordCloud');
  c.innerHTML = '';
  if (!words.length) { c.innerHTML = '<div class="empty">当前筛选条件下无关键词</div>'; return; }
  const w = c.clientWidth || 500, h = c.clientHeight || 360;
  const max = Math.max(1, ...words.map(x => x[1]));
  const scale = d3.scaleSqrt().domain([1, max]).range([12, 44]);
  const active = new Set(tokens());
  const seeded = rng(hashStr(words.map(x => x[0]).join()));
  d3.layout.cloud().size([w, h]).random(seeded)
    .words(words.map(([text, n]) => ({ text, n, size: scale(n) })))
    .padding(3)
    .rotate(d => (hashStr(d.text) % 9 === 0 ? 90 : 0))
    .font('Inter').fontSize(d => d.size)
    .on('end', ws => {
      const g = d3.select(c).append('svg').attr('viewBox', `0 0 ${w} ${h}`)
        .append('g').attr('transform', `translate(${w / 2},${h / 2})`);
      g.selectAll('text').data(ws).enter().append('text')
        .attr('class', d => (active.has(d.text) ? 'is-on' : ''))
        .style('font-size', d => `${d.size}px`).style('font-weight', 800)
        .style('fill', (d, i) => P[i % P.length])
        .attr('text-anchor', 'middle')
        .attr('transform', d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
        .text(d => d.text)
        .on('click', (e, d) => toggleToken(d.text))
        .append('title').text(d => `${d.text}：${d.n} 篇标题出现 · 点击加入/移出检索`);
    })
    .start();
}

function maturityChart(base) {
  const vals = STAGES.map(s => base.filter(a => a.maturity === s).length);
  const sel = state.f.maturity;
  const linkValues = vals.slice(1).map((v, i) => Math.max(0.5, (vals[i] + v) / 2));
  Plotly.react('maturityFlow', [{
    type: 'sankey', orientation: 'h', arrangement: 'snap',
    node: {
      label: STAGE_DISPLAY.map((l, i) => `${l}<br><b>${vals[i]}篇</b>`),
      customdata: STAGES.map((s, i) => [s, vals[i]]),
      hovertemplate: '%{customdata[0]}<br>%{customdata[1]}篇<br><i>点击加入/移出筛选</i><extra></extra>',
      color: STAGES.map((s, i) => (!sel.size || sel.has(s) ? P[i] : hexA(P[i], 0.25))),
      pad: 22, thickness: 22,
      line: { color: 'rgba(255,255,255,.32)', width: 1 } // 注意：数组形式的 line.width 会导致标签定位异常
    },
    link: {
      source: [0, 1, 2, 3, 4], target: [1, 2, 3, 4, 5], value: linkValues, customdata: vals.slice(1),
      hovertemplate: '框架中的下一阶段：%{customdata}篇<extra></extra>',
      color: P.slice(0, 5).map(c => hexA(c, 0.25))
    }
  }], lay({ font: { color: ink(), family: 'Inter,Microsoft YaHei', size: 11 }, margin: { l: 10, r: 10, t: 20, b: 20 } }), { ...CFG, displayModeBar: false });
  bind('maturityFlow', 'plotly_click', ev => {
    const p = ev.points?.[0];
    if (p?.pointNumber == null || p.source != null) return;
    toggle('maturity', STAGES[p.pointNumber]);
  });
}

/* ------------------------------------------------------------------ */
/* 主刷新                                                              */
/* ------------------------------------------------------------------ */
function update() {
  const toks = tokens();
  const list = A.filter(a => pass(a, null, toks));
  currentList = list;
  syncControls();
  renderStatus(list);
  renderChips();
  renderFacets(toks);
  renderKPIs(list);
  renderCards(list);
  barChart('themeBar', 'theme', listExcept('theme', toks));
  barChart('modalityBar', 'modality', listExcept('modality', toks));
  pivotChart(list);
  sunburstChart(list);
  metricsChart(list);
  timelineChart(list);
  flowChart(list);
  cloudChart(list);
  maturityChart(listExcept('maturity', toks));
}

/* ------------------------------------------------------------------ */
/* 事件绑定                                                            */
/* ------------------------------------------------------------------ */
function populateSelects() {
  const opts = (keys, labels) => keys.map(k => `<option value="${k}">${esc(labels[k])}</option>`).join('');
  $('pivotX').innerHTML = opts(DIMS.map(d => d.key), DIM_LABEL);
  $('pivotY').innerHTML = opts(DIMS.map(d => d.key), DIM_LABEL);
  $('colorBy').innerHTML = opts(DIMS.map(d => d.key).filter(k => k !== 'journal'), DIM_LABEL);
  $('flowSel').innerHTML = opts(Object.keys(FLOWS), FLOWS);
}

function bindEvents() {
  $('q').addEventListener('input', debounce(() => { state.q = $('q').value.trim(); update(); }, 220));

  const onIF = debounce(update, 150);
  ['ifMin', 'ifMax'].forEach(id => $(id).addEventListener('input', () => {
    let lo = parseFloat($('ifMin').value), hi = parseFloat($('ifMax').value);
    if (lo > hi) { if (id === 'ifMin') lo = hi; else hi = lo; }
    state.ifMin = lo; state.ifMax = hi;
    $('ifMin').value = lo; $('ifMax').value = hi;
    $('ifLabel').textContent = `${lo.toFixed(1)} – ${hi.toFixed(1)}`;
    onIF();
  }));

  ['dateFrom', 'dateTo'].forEach(id => $(id).addEventListener('change', () => {
    let from = $('dateFrom').value, to = $('dateTo').value;
    if (from && to && from > to) [from, to] = [to, from];
    state.dateFrom = from && from > DATE_MIN ? from : '';
    state.dateTo = to && to < DATE_MAX ? to : '';
    update();
  }));

  $('absOnly').addEventListener('change', e => { state.absOnly = e.target.checked; update(); });
  $('kpiAbs').addEventListener('click', () => { state.absOnly = !state.absOnly; update(); });

  $('facets').addEventListener('change', e => {
    const t = e.target;
    if (t.matches('input[type=checkbox][data-dim]')) toggle(t.dataset.dim, t.value);
  });
  $('facets').addEventListener('click', e => {
    const b = e.target.closest('[data-clear]');
    if (!b) return;
    e.preventDefault();
    state.f[b.dataset.clear].clear();
    update();
  });
  $('facets').addEventListener('toggle', e => {
    const d = e.target.closest?.('details[data-dim]');
    if (!d) return;
    if (d.open) openFacets.add(d.dataset.dim); else openFacets.delete(d.dataset.dim);
  }, true);

  $('chips').addEventListener('click', e => {
    const b = e.target.closest('[data-chip]');
    if (!b) return;
    if (b.dataset.chip === 'all') { resetAll(); return; }
    chipActions[Number(b.dataset.chip)]?.fn();
    update();
  });

  $('reset').addEventListener('click', () => { if (!$('reset').disabled) resetAll(); });

  ['pivotX', 'pivotY'].forEach(id => $(id).addEventListener('change', e => {
    const other = id === 'pivotX' ? 'pivotY' : 'pivotX';
    if (e.target.value === state[other]) state[other] = state[id]; // 交换，避免同维度
    state[id] = e.target.value;
    update();
  }));
  $('pivotNorm').addEventListener('change', e => { state.pivotNorm = e.target.value; update(); });
  $('colorBy').addEventListener('change', e => { state.colorBy = e.target.value; update(); });
  $('flowSel').addEventListener('change', e => { state.flow = e.target.value; update(); });

  $('modal').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
  $('mPrev').addEventListener('click', () => { if (modalIndex > 0) { modalIndex--; renderModal(); } });
  $('mNext').addEventListener('click', () => { if (modalIndex < currentList.length - 1) { modalIndex++; renderModal(); } });
  document.addEventListener('keydown', e => {
    if ($('modal').hidden) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') $('mPrev').click();
    if (e.key === 'ArrowRight') $('mNext').click();
  });

  $('theme').addEventListener('click', () => {
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
    setTimeout(update, 30);
  });
  window.addEventListener('resize', debounce(() => cloudChart(A.filter(a => pass(a, null, tokens()))), 250));
}

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */
async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
async function loadData() {
  try {
    const [articles, journals] = await Promise.all([fetchJSON('data/articles.json'), fetchJSON('data/journals.json')]);
    return { articles, journals };
  } catch (err) {
    // file:// 打开时 fetch 会被浏览器拦截，回退到可选的 data/bundle.js
    if (!window.DASHBOARD_DATA) { try { await loadScript('data/bundle.js'); } catch (e) { /* ignore */ } }
    if (window.DASHBOARD_DATA) return window.DASHBOARD_DATA;
    throw err;
  }
}

async function boot() {
  if (localStorage.getItem('theme') === 'light') document.body.classList.add('light');
  try {
    const { articles, journals } = await loadData();
    prepare(articles, journals);
  } catch (err) {
    $('status').innerHTML = `无法读取 data/*.json（${esc(err.message)}）。请通过静态服务器或 GitHub Pages 访问，或先运行 tools/build_bundle.py 生成 data/bundle.js。`;
    return;
  }
  populateSelects();
  bindEvents();
  update();
}

boot();
