# Medical Imaging Literature Analysis Dashboard

An interactive, Chinese-language dashboard for exploring medical imaging literature by research direction, imaging modality, journal, anatomical area, evidence maturity, and publication date.

The dashboard analyzes article titles and abstracts, presents structured Chinese highlights, and combines article-level information with journal-level metrics such as impact factor and H-index.

## Live site


- **Current dashboard:** `https://xuzuolizzie.github.io/literature-dashboard/`
- **Latest archived release:** `https://xuzuolizzie.github.io/literature-dashboard/latest/`
- **Version archive:** `https://xuzuolizzie.github.io/literature-dashboard/versions/`

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
├── source-data/
│   ├── original_research_screened_articles.csv
│   └── journals_watchlist.csv
├── scripts/
│   └── build_data.py
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

## Run locally

Because the application loads JSON with `fetch()`, do not open `index.html` directly from the file system.

From the repository root, run:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

To stop the server, press `Ctrl+C` in the terminal.

## Deploy to GitHub Pages

### 1. Create the repository

Create a public GitHub repository, for example:

```text
literature-dashboard
```

### 2. Push the dashboard

```bash
git init
git add .
git commit -m "Initial dashboard release"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/literature-dashboard.git
git push -u origin main
```

### 3. Enable GitHub Pages

In the repository on GitHub:

1. Open **Settings**.
2. Select **Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select the `main` branch.
5. Select the repository root, `/ (root)`.
6. Save the configuration.

The project URL will normally be:

```text
https://YOUR-USERNAME.github.io/literature-dashboard/
```

## Update the article data

### Input files

The article source file should include fields equivalent to:

```text
Author
Title
Publication Title
DOI
Abstract Note
Date
Issue
Volume
Journal Abbreviation
```

The journal watchlist should include:

```text
name
abbr
category
impact_factor
h_index
```

### Recommended update workflow

1. Replace the source article file:

```text
source-data/original_research_screened_articles.csv
```

2. If journal metrics changed, replace:

```text
source-data/journals_watchlist.csv
```

3. Rebuild the processed data:

```bash
python scripts/build_data.py
```

4. Confirm that the following files were regenerated:

```text
data/articles.json
data/journals.json
```

5. Preview the dashboard locally:

```bash
python -m http.server 8000
```

6. Review the updated dashboard, especially:
   - article and journal counts;
   - research classifications;
   - Chinese highlights;
   - English abstract dropdowns;
   - DOI links;
   - journal metrics;
   - all interactive plots and filters.

7. Commit and publish:

```bash
git add .
git commit -m "Update literature data YYYY-MM-DD"
git push origin main
```

### Data-quality note

The classifications and Chinese highlights are generated from article titles and available abstracts. They are intended for literature surveillance and trend analysis, not as a substitute for reviewing the original publication.

For records without abstracts, the dashboard should not infer detailed methods or results. Such records should clearly indicate that the summary is based on the title and that the original paper must be consulted.

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
https://YOUR-USERNAME.github.io/literature-dashboard/versions/2026-07-16/
https://YOUR-USERNAME.github.io/literature-dashboard/versions/2026-08-01/
```

### Create a version snapshot

On macOS, Linux, or Git Bash:

```bash
VERSION=YYYY-MM-DD
mkdir -p "versions/$VERSION"
cp index.html "versions/$VERSION/"
cp -R css "versions/$VERSION/"
cp -R js "versions/$VERSION/"
cp -R data "versions/$VERSION/"
```

On PowerShell:

```powershell
$Version = "YYYY-MM-DD"
New-Item -ItemType Directory -Force "versions/$Version"
Copy-Item index.html "versions/$Version/"
Copy-Item css "versions/$Version/" -Recurse
Copy-Item js "versions/$Version/" -Recurse
Copy-Item data "versions/$Version/" -Recurse
```

### Update the `latest` alias

On macOS, Linux, or Git Bash:

```bash
rm -rf latest
mkdir latest
cp index.html latest/
cp -R css latest/
cp -R js latest/
cp -R data latest/
```

On PowerShell:

```powershell
Remove-Item latest -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory latest
Copy-Item index.html latest/
Copy-Item css latest/ -Recurse
Copy-Item js latest/ -Recurse
Copy-Item data latest/ -Recurse
```

Commit the release and create a Git tag:

```bash
git add .
git commit -m "Release dashboard YYYY-MM-DD"
git tag dashboard-YYYY-MM-DD
git push origin main
git push origin dashboard-YYYY-MM-DD
```

Do not overwrite a published version directory. If a correction is required, publish a new version such as:

```text
versions/2026-08-01-r1/
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
  "highlight": "中文结构化研究要点。"
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

## Contributing

Contributions are welcome through issues and pull requests.

When submitting a change:

1. Keep the existing data schema compatible with `dashboard.js`.
2. Test the site through a local HTTP server.
3. Verify both light and dark themes.
4. Check all filters and visualizations.
5. Confirm that DOI links open correctly.
6. Do not include sensitive or restricted data.

## License

MIT License for dashboard source code.

## Acknowledgments

This dashboard uses open-source front-end libraries including Plotly, D3.js, `d3-cloud`, DataTables, and jQuery.
