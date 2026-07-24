# Medical Imaging Literature Analysis Dashboard

An interactive, Chinese-language dashboard for exploring medical imaging literature by research direction, imaging modality, journal, anatomical area, evidence maturity, and publication date.

The dashboard analyzes article titles and abstracts, presents structured Chinese highlights, and combines article-level information with journal-level metrics such as impact factor and H-index.

## Live site


- **Current dashboard:** `https://xuzuolizzie.github.io/research-hotspot-dashboard/`
- **Latest archived release:** `https://xuzuolizzie.github.io/research-hotspot-dashboard/latest/`
- **Version archive:** `https://xuzuolizzie.github.io/research-hotspot-dashboard/versions/`

## Features

- Interactive filtering by:
  - journal;
  - imaging modality;
  - research direction;
  - anatomical or disease area;
  - evidence-maturity stage.
- Free-text search across titles, abstracts, journals, and classification labels.
- Chinese article highlights describing the research objective, methods, and key findings.
- Collapsible English abstracts for records with abstract data.
- Clickable DOI links in the article table.
- Interactive visualizations:
  - research direction × journal heatmap;
  - journal H-index × journal impact factor bubble chart;
  - publication time × journal impact factor plot;
  - English keyword word cloud;
  - evidence-maturity pathway diagram;
  - research-theme and imaging-modality distributions.
- Light and dark themes.
- Responsive layout for desktop and smaller screens.
- Versioned static releases with stable URLs.

## Technology

This is a static web application. It does not require a Python web framework or application server in production.

The dashboard uses:

- HTML5 and CSS;
- JavaScript;
- Plotly;
- D3.js and `d3-cloud`;
- jQuery;
- DataTables;
- JSON data files loaded through `fetch()`.

External front-end libraries are loaded from public CDNs. An internet connection is therefore required unless the libraries are downloaded and served locally.

## Repository structure

```text
literature-dashboard/
├── .nojekyll
├── README.md
├── index.html
├── css/
│   └── dashboard.css
├── js/
│   └── dashboard.js
├── data/
│   ├── articles.json
│   └── journals.json
├── latest/
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── data/
└── versions/
    ├── index.html
    ├── YYYY-MM-DD/
    └── YYYY-MM-DD/
```

The `source-data/` and `scripts/` directories are recommended for a maintainable update workflow. If they are not included in the public repository, update the generated JSON files locally before publishing.

## Archive releases with stable URLs

Each published version can be copied into its own directory:

```text
versions/YYYY-MM-DD/
```

For example:

```text
versions/2026-07-16/
versions/2026-08-01/
```

This creates stable URLs such as:

```text
https://xuzuolizzie.github.io/research-hotspot-dashboard/versions/2026-07-16/
https://xuzuolizzie.github.io/research-hotspot-dashboard/versions/2026-08-01/
```


## Data schema

### `data/articles.json`

Typical fields include:

```json
{
  "id": 1,
  "date": "YYYY-MM-DD",
  "journal": "Journal name",
  "title": "Article title",
  "doi": "10.xxxx/example",
  "doi_url": "https://doi.org/10.xxxx/example",
  "abstract": "English abstract",
  "modality": "MRI/磁共振",
  "theme": "研究主题",
  "future": "研究方向",
  "anatomy": "解剖或疾病领域",
  "maturity": "证据成熟度",
  "impact": 0.0,
  "hindex": 0,
  "watchlist_matched": true,
  "highlight": "中文结构化研究要点。",
  "title_chinese": "中文标题"
}
```

### `data/journals.json`

Typical fields include:

```json
{
  "name": "Journal name",
  "abbr": "Journal abbreviation",
  "category": "imaging",
  "impact_factor": 0.0,
  "h_index": 0
}
```

## Privacy and copyright

- GitHub Pages websites are publicly accessible. Do not publish confidential, personal, patient-level, licensed, or otherwise restricted data.
- Article titles, abstracts, metrics, and metadata may be subject to publisher or database terms. Confirm that the repository and public dashboard use them in a permitted manner.
- DOI links direct users to the publisher or DOI landing page; availability of full text depends on the publication's access terms.

## Limitations

- Automated topic and maturity classifications may require expert review.
- Journal metrics are snapshots from the supplied watchlist and may change over time.
- Missing abstracts limit the specificity of article highlights.
- The dashboard is a literature-analysis tool and does not provide medical advice or clinical recommendations.
- CDN-hosted dependencies may be unavailable in restricted or offline environments.


## License

MIT License for dashboard source code.

## Acknowledgments

This dashboard uses open-source front-end libraries including Plotly, D3.js, `d3-cloud`, DataTables, and jQuery.
