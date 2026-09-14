let A = [];
let W = [];

const $ = x => document.getElementById(x);

const P = [
  '#55a7ff',
  '#27d3c4',
  '#ffb454',
  '#ff729f',
  '#a88cff',
  '#6ee7a8',
  '#ff8b5c',
  '#58d5ff'
];

const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m])
  );

/*
 * Safely render article titles.
 *
 * Supported formatting:
 * - <sup>...</sup>
 * - <sub>...</sub>
 * - escaped forms such as &lt;sup&gt;68&lt;/sup&gt;
 * - the existing small-caps span formatting
 *
 * All other HTML elements are converted to plain text.
 */
const titleHTML = s => {
  const box = document.createElement('div');

  const normalized = String(s ?? '').replace(
    /&lt;(\/?)(sup|sub)&gt;/gi,
    '<$1$2>'
  );

  box.innerHTML = normalized;

  const clean = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        return;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        return;
      }

      const tag = child.tagName.toLowerCase();

      if (tag === 'sup' || tag === 'sub') {
        [...child.attributes].forEach(attribute => {
          child.removeAttribute(attribute.name);
        });

        clean(child);
        return;
      }

      if (
        tag === 'span' &&
        /small-caps/i.test(
          child.getAttribute('style') || ''
        )
      ) {
        [...child.attributes].forEach(attribute => {
          child.removeAttribute(attribute.name);
        });

        child.className = 'small-caps';
        clean(child);
        return;
      }

      child.replaceWith(
        document.createTextNode(child.textContent || '')
      );
    });
  };

  clean(box);

  return box.innerHTML;
};

const uniq = (a, k) =>
  [...new Set(a.map(x => x[k]).filter(Boolean))].sort();

const cnt = (a, k) =>
  a.reduce(
    (m, x) => (
      m[x[k]] = (m[x[k]] || 0) + 1,
      m
    ),
    {}
  );

function ink() {
  return getComputedStyle(document.body)
    .getPropertyValue('--ink');
}

function lay(x = {}) {
  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: {
      color: ink(),
      family: 'Inter,Microsoft YaHei'
    },
    margin: {
      l: 55,
      r: 20,
      t: 15,
      b: 55
    },
    ...x
  };
}

async function boot() {
  [A, W] = await Promise.all([
    fetch('data/articles.json').then(r => r.json()),
    fetch('data/journals.json').then(r => r.json())
  ]);

  $('status').textContent =
    `已载入 ${A.length} 篇文章 / ${W.length} 种监测期刊`;

  [
    'journal',
    'modality',
    'future',
    'anatomy',
    'maturity'
  ].forEach(id => {
    uniq(A, id).forEach(v => {
      $(id).insertAdjacentHTML(
        'beforeend',
        `<option>${esc(v)}</option>`
      );
    });
  });

  [
    'q',
    'journal',
    'modality',
    'future',
    'anatomy',
    'maturity'
  ].forEach(id => {
    $(id).oninput = update;
  });

  $('reset').onclick = () => {
    if ($('reset').disabled) {
      return;
    }

    [
      'q',
      'journal',
      'modality',
      'future',
      'anatomy',
      'maturity'
    ].forEach(id => {
      $(id).value = '';
    });

    update();
  };

  $('theme').onclick = () => {
    document.body.classList.toggle('light');

    localStorage.setItem(
      'theme',
      document.body.classList.contains('light')
        ? 'light'
        : 'dark'
    );

    setTimeout(update, 50);
  };

  if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light');
  }

  update();
}

function data() {
  const q = $('q').value.toLowerCase();

  return A.filter(x =>
    (
      !q ||
      Object.values(x)
        .join(' ')
        .toLowerCase()
        .includes(q)
    ) &&
    [
      'journal',
      'modality',
      'future',
      'anatomy',
      'maturity'
    ].every(k =>
      !$(k).value ||
      x[k] === $(k).value
    )
  );
}

function bar(id, m) {
  const a = Object.entries(m)
    .sort((a, b) => a[1] - b[1]);

  Plotly.react(
    id,
    [{
      type: 'bar',
      orientation: 'h',
      x: a.map(x => x[1]),
      y: a.map(x => x[0]),
      marker: {
        color: a.map((_, i) => P[i % P.length])
      }
    }],
    lay({
      margin: {
        l: 180,
        r: 15,
        t: 10,
        b: 35
      }
    }),
    {
      responsive: true,
      displayModeBar: false
    }
  );
}

function heat(a) {
  const j = uniq(a, 'journal');
  const f = uniq(a, 'future');

  const z = j.map(y =>
    f.map(x =>
      a.filter(d =>
        d.journal === y &&
        d.future === x
      ).length
    )
  );

  Plotly.react(
    'directionJournal',
    [{
      type: 'heatmap',
      x: f,
      y: j,
      z,
      colorscale: 'YlGnBu',
      hovertemplate:
        '%{y}<br>%{x}<br>%{z}篇<extra></extra>'
    }],
    lay({
      margin: {
        l: 190,
        r: 15,
        t: 10,
        b: 145
      },
      xaxis: {
        tickangle: -35
      }
    }),
    {
      responsive: true
    }
  );

  const e = $('directionJournal');

  e.removeAllListeners?.('plotly_click');

  e.on?.('plotly_click', v => {
    $('journal').value = v.points[0].y;
    $('future').value = v.points[0].x;
    update();
  });
}

function metrics(a) {
  const n = cnt(a, 'journal');

  Plotly.react(
    'journalMetrics',
    [{
      type: 'scatter',
      mode: 'markers+text',
      x: W.map(x => x.impact_factor),
      y: W.map(x => x.h_index),
      text: W.map(x => x.abbr),
      textposition: 'top center',
      customdata: W.map(x => [
        x.name,
        n[x.name] || 0
      ]),
      marker: {
        size: W.map(x =>
          n[x.name]
            ? 12 + Math.sqrt(n[x.name]) * 4
            : 9
        ),
        color: W.map(x =>
          n[x.name]
            ? x.impact_factor
            : '#8492a6'
        ),
        colorscale: 'Viridis',
        opacity: W.map(x =>
          n[x.name] ? 0.85 : 0.3
        )
      },
      hovertemplate:
        '%{customdata[0]}<br>' +
        'IF %{x}<br>' +
        'H-index %{y}<br>' +
        '%{customdata[1]}篇' +
        '<extra></extra>'
    }],
    lay({
      xaxis: {
        title: '期刊影响因子'
      },
      yaxis: {
        title: '期刊 H-index'
      }
    }),
    {
      responsive: true
    }
  );
}

function timeline(a) {
  const f = uniq(a, 'future');

  Plotly.react(
    'timeline',
    f.map((g, i) => {
      const s = a.filter(x => x.future === g);

      return {
        type: 'scatter',
        mode: 'markers',
        name: g,
        x: s.map(x => x.date),
        y: s.map(x => x.impact || 0),
        text: s.map(x => x.title),
        marker: {
          size: s.map(x =>
            8 + Math.min(
              15,
              (x.impact || 0) / 2
            )
          ),
          color: P[i % P.length]
        },
        hovertemplate:
          '%{text}<br>' +
          'IF %{y}' +
          '<extra></extra>'
      };
    }),
    lay({
      legend: {
        orientation: 'h',
        y: -0.25
      },
      margin: {
        l: 55,
        r: 15,
        t: 10,
        b: 110
      },
      yaxis: {
        title: '期刊影响因子'
      }
    }),
    {
      responsive: true
    }
  );
}

function cloud(a) {
  const stop = new Set(
    (
      'the and for with from using based medical ' +
      'image imaging model analysis study method ' +
      'framework novel via into between'
    ).split(' ')
  );

  const m = {};

  a.forEach(x => {
    (
      String(x.title || '')
        .toLowerCase()
        .match(/[a-z][a-z0-9-]{2,}/g) ||
      []
    ).forEach(w => {
      if (!stop.has(w)) {
        m[w] = (m[w] || 0) + 1;
      }
    });
  });

  const words = Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([text, n]) => ({
      text,
      n
    }));

  const c = $('wordCloud');

  c.innerHTML = '';

  const w = c.clientWidth || 500;
  const h = c.clientHeight || 360;

  const max = Math.max(
    1,
    ...words.map(x => x.n)
  );

  const scale = d3.scaleSqrt()
    .domain([1, max])
    .range([13, 46]);

  d3.layout.cloud()
    .size([w, h])
    .words(
      words.map(x => ({
        text: x.text,
        size: scale(x.n),
        n: x.n
      }))
    )
    .padding(3)
    .rotate(() =>
      Math.random() > 0.88 ? 90 : 0
    )
    .font('Inter')
    .fontSize(d => d.size)
    .on('end', ws => {
      const svg = d3.select(c)
        .append('svg')
        .attr(
          'viewBox',
          `0 0 ${w} ${h}`
        )
        .append('g')
        .attr(
          'transform',
          `translate(${w / 2},${h / 2})`
        );

      svg.selectAll('text')
        .data(ws)
        .enter()
        .append('text')
        .style(
          'font-size',
          d => d.size + 'px'
        )
        .style(
          'font-weight',
          800
        )
        .style(
          'fill',
          (d, i) => P[i % P.length]
        )
        .attr(
          'text-anchor',
          'middle'
        )
        .attr(
          'transform',
          d =>
            `translate(${d.x},${d.y})` +
            `rotate(${d.rotate})`
        )
        .text(d => d.text)
        .append('title')
        .text(d =>
          `${d.text}: ${d.n}`
        );
    })
    .start();
}

function flow(a) {
  const stages = [
    '发现性/临床前研究',
    '算法、方法或研究方案开发',
    '回顾性或探索性临床研究',
    '前瞻性、纵向或多中心验证',
    '干预性临床试验与治疗验证',
    '证据整合、指南或真实世界证据'
  ];
  const displayLabels = [
    '1. 发现性/<br>临床前研究',
    '2. 算法、方法或<br>研究方案开发',
    '3. 回顾性或探索性<br>临床研究',
    '4. 前瞻性、纵向或<br>多中心验证',
    '5. 干预性临床试验<br>与治疗验证',
    '6. 证据整合、指南或<br>真实世界证据'
  ];

  // Backward compatibility for records that still use the old four-stage taxonomy.
  const legacyStageMap = {
    '算法/方法开发': stages[1],
    '前临床/技术验证': stages[0],
    '临床数据验证': stages[2],
    '临床验证与转化': stages[3]
  };
  const normalizedCounts = a.reduce((result, article) => {
    const stage = legacyStageMap[article.maturity] || article.maturity;
    if (stages.includes(stage)) {
      result[stage] = (result[stage] || 0) + 1;
    }
    return result;
  }, {});
  const vals = stages.map(stage => normalizedCounts[stage] || 0);
  const linkValues = vals.slice(1).map((value, index) =>
    Math.max(0.5, (vals[index] + value) / 2)
  );

  Plotly.react(
    'maturityFlow',
    [{
      type: 'sankey',
      orientation: 'h',
      arrangement: 'snap',
      node: {
        label: displayLabels.map(
          (label, index) => `${label}<br><b>${vals[index]}篇</b>`
        ),
        customdata: stages.map(
          (stage, index) => [stage, vals[index]]
        ),
        hovertemplate:
          '%{customdata[0]}<br>%{customdata[1]}篇<extra></extra>',
        color: P.slice(0, 6),
        pad: 28,
        thickness: 24,
        line: {
          color: 'rgba(255,255,255,.32)',
          width: 1
        }
      },
      link: {
        source: [0, 1, 2, 3, 4],
        target: [1, 2, 3, 4, 5],
        value: linkValues,
        customdata: vals.slice(1),
        hovertemplate:
          '工作流进入下一阶段：%{customdata}篇<extra></extra>',
        color: [
          'rgba(85,167,255,.25)',
          'rgba(39,211,196,.25)',
          'rgba(255,180,84,.25)',
          'rgba(255,114,159,.25)',
          'rgba(168,140,255,.25)'
        ]
      }
    }],
    lay({
      font: {
        color: ink(),
        family: 'Inter,Microsoft YaHei',
        size: 12
      },
      margin: {
        l: 20,
        r: 20,
        t: 25,
        b: 25
      }
    }),
    {
      responsive: true,
      displayModeBar: false
    }
  );

  const chart = $('maturityFlow');
  chart.removeAllListeners?.('plotly_click');
  chart.on?.('plotly_click', event => {
    const point = event.points?.[0];
    if (point?.pointNumber == null || point.source != null) {
      return;
    }
    $('maturity').value = stages[point.pointNumber];
    update();
  });
}

function cards(a) {
  const visibleArticles = a.slice(0, 120);

  $('articles').innerHTML = visibleArticles
    .map((x, index) => {
      return `
        <article class="article">
          <div class="meta">
            ${esc(x.date)} ·
            ${esc(x.journal)} ·
            IF ${x.impact ?? 'NA'}
          </div>

          ${
            x.title_chinese
              ? `
                <h3 class="title-chinese">
                  ${titleHTML(x.title_chinese)}
                </h3>
              `
              : ''
          }

          <h3 class="title-english">
            ${titleHTML(x.title)}
          </h3>

          <span class="pill">
            ${esc(x.modality)}
          </span>

          <span class="pill">
            ${esc(x.future)}
          </span>

          <p>
            ${esc(x.highlight)}
          </p>

          <div
            class="meta doi-container"
            data-article-index="${index}"
          ></div>
        </article>
      `;
    })
    .join('');

  /*
   * Create DOI links using DOM methods.
   * This prevents malformed anchor HTML.
   */
  document
    .querySelectorAll('.doi-container')
    .forEach(container => {
      const index = Number(
        container.dataset.articleIndex
      );

      const article = visibleArticles[index];

      if (!article) {
        container.remove();
        return;
      }

      /*
       * Normalize the DOI value.
       *
       * Supported examples:
       * 10.2967/jnumed.126.272009
       * https://doi.org/10.2967/jnumed.126.272009
       * http://dx.doi.org/10.2967/jnumed.126.272009
       */
      const doi = String(article.doi || '')
        .trim()
        .replace(
          /^https?:\/\/(?:dx\.)?doi\.org\//i,
          ''
        );

      /*
       * Normalize doi_url if it is present.
       * If doi_url contains only a DOI, add the DOI domain.
       */
      let doiUrl = String(
        article.doi_url || ''
      ).trim();

      if (
        doiUrl &&
        !/^https?:\/\//i.test(doiUrl)
      ) {
        doiUrl =
          `https://doi.org/${encodeURI(doiUrl)}`;
      }

      if (!doiUrl && doi) {
        doiUrl =
          `https://doi.org/${encodeURI(doi)}`;
      }

      if (!doiUrl) {
        container.remove();
        return;
      }

      const label = document.createElement('span');
      label.textContent = 'DOI：';

      const link = document.createElement('a');

      link.className = 'doi-link';
      link.href = doiUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';

      link.textContent =
        doi ||
        doiUrl.replace(
          /^https?:\/\/(?:dx\.)?doi\.org\//i,
          ''
        );

      container.append(label, link);
    });
}

function update() {
  const a = data();

  const active = [
    'q',
    'journal',
    'modality',
    'future',
    'anatomy',
    'maturity'
  ].some(id => $(id).value);

  $('reset').disabled = !active;

  $('reset').setAttribute(
    'aria-disabled',
    String(!active)
  );

  $('reset').title = active
    ? '清除当前全部筛选条件'
    : '当前没有已应用的筛选条件';

  $('articleCount').textContent =
    `显示 ${Math.min(a.length, 120)} / ${a.length} 篇`;

  const ifs = a
    .map(x => x.impact)
    .filter(Number.isFinite);

  const tm = cnt(a, 'theme');

  const top = Object.entries(tm)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 3);

  $('kN').textContent = a.length;

  $('kJ').textContent = new Set(
    a.map(x => x.journal)
  ).size;

  $('kA').textContent = a.filter(
    x => x.abstract
  ).length;

  $('kW').textContent = a.filter(
    x => x.watchlist_matched
  ).length;

  $('kIF').textContent = ifs.length
    ? (
        ifs.reduce((s, x) => s + x, 0) /
        ifs.length
      ).toFixed(1)
    : 'NA';

  $('summary').textContent =
    `当前 ${a.length} 篇文章；主要主题：${
      top.map(
        x => x[0] + '（' + x[1] + '篇）'
      ).join('、') ||
      '暂无'
    }。`;

  bar('themeBar', tm);
  bar('modalityBar', cnt(a, 'modality'));
  heat(a);
  metrics(a);
  timeline(a);
  cloud(a);
  flow(a);
  cards(a);
}

boot();