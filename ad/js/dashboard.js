let A=[];
const $=id=>document.getElementById(id);
const P=['#55a7ff','#27d3c4','#ffb454','#ff729f','#a88cff','#6ee7a8','#ff8b5c','#58d5ff'];
const FILTERS=['q','journal','modality','future','anatomy','maturity'];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const uniq=(a,k)=>[...new Set(a.map(x=>x[k]).filter(Boolean))].sort((x,y)=>String(x).localeCompare(String(y),'zh-CN'));
const cnt=(a,k)=>a.reduce((m,x)=>{if(x[k])m[x[k]]=(m[x[k]]||0)+1;return m;},{});
const number=v=>Number.isFinite(Number(v))?Number(v):0;
function ink(){return getComputedStyle(document.body).getPropertyValue('--ink').trim()}
function lay(extra={}){return {paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',font:{color:ink(),family:'Inter,Microsoft YaHei'},margin:{l:55,r:20,t:20,b:55},...extra}}
function plot(id,traces,layout={}){
  const el=$(id);
  if(!el) return;
  if(typeof window.Plotly==='undefined'){
    el.innerHTML='<div class="chart-error">图表库 Plotly 未能载入。请检查网络或站点的内容安全策略（CSP）。</div>';
    return;
  }
  Plotly.react(el,traces,lay(layout),{responsive:true,displayModeBar:false});
}
function normalizeUrl(x){
  const raw=String(x.doi_url||'').trim();
  const href=raw.match(/href=["']([^"']+)/i)?.[1];
  const plain=raw.match(/https?:\/\/[^\s"'<>]+/i)?.[0];
  let url=(href||plain||'').replace(/&quot;.*$/,'').replace(/[",]+$/,'');
  if(!url&&x.doi) url='https://doi.org/'+String(x.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i,'');
  return url;
}
function validate(raw){
  if(!Array.isArray(raw)) throw new Error('JSON 顶层必须是文章对象数组。');
  return raw.filter(x=>x&&typeof x==='object').map((x,i)=>({...x,id:x.id??i+1,citation:number(x.citation),impact:number(x.impact)}));
}
function setData(raw,name='JSON'){A=validate(raw);populateFilters();$('status').textContent=`已从 ${name} 载入 ${A.length} 篇文章`;$('error').hidden=true;update()}
function populateFilters(){
  ['journal','modality','future','anatomy','maturity'].forEach(id=>{const el=$(id);el.innerHTML=`<option value="">${{journal:'全部期刊',modality:'全部模态',future:'全部研究方向',anatomy:'全部领域',maturity:'全部阶段'}[id]}</option>`;uniq(A,id).forEach(v=>el.add(new Option(v,v)))})
}
function data(){const q=$('q').value.trim().toLowerCase();return A.filter(x=>(!q||Object.values(x).join(' ').toLowerCase().includes(q))&&['journal','modality','future','anatomy','maturity'].every(k=>!$(k).value||x[k]===$(k).value))}
function bar(id,m){const a=Object.entries(m).sort((x,y)=>x[1]-y[1]);plot(id,[{type:'bar',orientation:'h',x:a.map(x=>x[1]),y:a.map(x=>x[0]),marker:{color:a.map((_,i)=>P[i%P.length])},hovertemplate:'%{y}<br>%{x} 篇<extra></extra>'}],{margin:{l:190,r:15,t:10,b:35}})}
function heat(a){const js=uniq(a,'journal'),fs=uniq(a,'future'),z=js.map(j=>fs.map(f=>a.filter(d=>d.journal===j&&d.future===f).length));plot('directionJournal',[{type:'heatmap',x:fs,y:js,z,colorscale:'YlGnBu',hovertemplate:'%{y}<br>%{x}<br>%{z} 篇<extra></extra>'}],{margin:{l:200,r:15,t:10,b:145},xaxis:{tickangle:-35}});const e=$('directionJournal');e.removeAllListeners?.('plotly_click');e.on?.('plotly_click',v=>{$('journal').value=v.points[0].y;$('future').value=v.points[0].x;update()})}
function metrics(a){const themes=uniq(a,'theme');const traces=themes.map((t,i)=>{const s=a.filter(x=>x.theme===t);return {type:'scatter',mode:'markers',name:t,x:s.map(x=>x.impact),y:s.map(x=>x.citation),customdata:s.map(x=>[x.title_chinese||x.title,x.journal,x.date]),marker:{size:s.map(x=>Math.max(9,Math.min(30,9+Math.sqrt(x.citation)*3))),color:P[i%P.length],opacity:.82,line:{width:1,color:'rgba(255,255,255,.35)'}},hovertemplate:'%{customdata[0]}<br>%{customdata[1]} · %{customdata[2]}<br>影响因子 %{x}<br>引用 %{y}<extra></extra>'}});plot('articleMetrics',traces,{xaxis:{title:'文章所在期刊影响因子'},yaxis:{title:'文章引用次数',rangemode:'tozero'},legend:{orientation:'h',y:-.25},margin:{l:65,r:20,t:15,b:115}})}
function timeline(a){const groups=uniq(a,'future');const traces=groups.map((g,i)=>{const s=a.filter(x=>x.future===g);return {type:'scatter',mode:'markers',name:g,x:s.map(x=>x.date),y:s.map(x=>x.citation),customdata:s.map(x=>[x.title_chinese||x.title,x.journal,x.impact]),marker:{size:s.map(x=>Math.max(9,Math.min(28,8+x.impact*1.6))),color:P[i%P.length],opacity:.8},hovertemplate:'%{customdata[0]}<br>%{customdata[1]}<br>%{x}<br>引用 %{y} · IF %{customdata[2]}<extra></extra>'}});plot('timeline',traces,{xaxis:{title:'发表日期'},yaxis:{title:'文章引用次数',rangemode:'tozero'},legend:{orientation:'h',y:-.25},margin:{l:65,r:20,t:15,b:115}})}
function cloud(a){const c=$('wordCloud');if(!c)return;if(typeof window.d3==='undefined'||!d3.layout||!d3.layout.cloud){c.innerHTML='<div class="chart-error">词云库未能载入。其他图表不受影响。</div>';return}const stop=new Set('the and for with from using based medical image imaging model analysis study method framework novel via into between effects disease patients'.split(' '));const m={};a.forEach(x=>(String(x.title||'').toLowerCase().match(/[a-z][a-z0-9-]{2,}/g)||[]).forEach(w=>{if(!stop.has(w))m[w]=(m[w]||0)+1}));const words=Object.entries(m).sort((x,y)=>y[1]-x[1]).slice(0,60).map(([text,n])=>({text,n}));c.innerHTML='';if(!words.length){c.textContent='暂无可生成的英文关键词';return}const w=c.clientWidth||500,h=c.clientHeight||360,max=Math.max(...words.map(x=>x.n));const scale=d3.scaleSqrt().domain([1,max]).range([13,46]);d3.layout.cloud().size([w,h]).words(words.map(x=>({...x,size:scale(x.n)}))).padding(3).rotate(()=>Math.random()>.9?90:0).font('Inter').fontSize(d=>d.size).on('end',ws=>{const svg=d3.select(c).append('svg').attr('viewBox',`0 0 ${w} ${h}`).append('g').attr('transform',`translate(${w/2},${h/2})`);svg.selectAll('text').data(ws).enter().append('text').style('font-size',d=>d.size+'px').style('font-family','Inter').style('fill',(_,i)=>P[i%P.length]).attr('text-anchor','middle').attr('transform',d=>`translate(${d.x},${d.y})rotate(${d.rotate})`).text(d=>d.text).append('title').text(d=>`${d.text}: ${d.n}`)}).start()}
function cards(a){const v=a.slice(0,120);$('articleCount').textContent=`显示 ${v.length} / ${a.length} 篇`;$('articles').classList.toggle('empty-state',!v.length);$('articles').innerHTML=v.length?v.map(x=>{const url=normalizeUrl(x);return `<article class="article"><div class="meta">${esc(x.date)} · ${esc(x.journal)} · 引用 ${x.citation} · IF ${x.impact||'NA'}</div><h3>${esc(x.title_chinese||x.title)}</h3>${x.title_chinese?`<h4>${esc(x.title)}</h4>`:''}<div><span class="pill">${esc(x.modality||'未分类')}</span><span class="pill">${esc(x.theme||'未分类')}</span>${x.watchlist_matched?'<span class="pill">Watchlist</span>':''}</div>${x.highlight?`<details class="abstract-dropdown"><summary>研究亮点</summary><div class="abstract-text">${esc(x.highlight)}</div></details>`:''}${x.abstract?`<details class="abstract-dropdown"><summary>英文摘要</summary><div class="abstract-text">${esc(x.abstract)}</div></details>`:''}${url?`<p><a class="doi-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">DOI：${esc(x.doi||url)}</a></p>`:''}</article>`}).join(''):'当前筛选条件下没有文章。'}
function update(){const a=data(),active=FILTERS.some(id=>$(id).value);$('reset').disabled=!active;const citations=a.reduce((s,x)=>s+x.citation,0),tm=cnt(a,'theme'),top=Object.entries(tm).sort((x,y)=>y[1]-x[1]).slice(0,3);$('kN').textContent=a.length;$('kJ').textContent=new Set(a.map(x=>x.journal).filter(Boolean)).size;$('kC').textContent=citations;$('kAvgC').textContent=a.length?(citations/a.length).toFixed(1):'0';$('kW').textContent=a.filter(x=>x.watchlist_matched).length;$('summary').textContent=`当前 ${a.length} 篇文章，总引用 ${citations} 次；主要主题：${top.map(x=>`${x[0]}（${x[1]}篇）`).join('、')||'暂无'}。`;bar('themeBar',tm);bar('modalityBar',cnt(a,'modality'));heat(a);metrics(a);timeline(a);cloud(a);bar('maturityBar',cnt(a,'maturity'));cards(a)}
function showLoadError(message){
  A=[];
  $('status').textContent='未能载入 data/articles.json';
  $('error').textContent=message;
  $('error').hidden=false;
  update();
}
function boot(){
  FILTERS.forEach(id=>$(id).addEventListener('input',update));
  $('reset').onclick=()=>{FILTERS.forEach(id=>$(id).value='');update()};
  $('theme').onclick=()=>{
    document.body.classList.toggle('light');
    localStorage.setItem('theme',document.body.classList.contains('light')?'light':'dark');
    update();
  };
  if(localStorage.getItem('theme')==='light') document.body.classList.add('light');
  fetch('data/articles.json',{cache:'no-store'})
    .then(r=>{
      if(!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
      return r.json();
    })
    .then(x=>setData(x,'data/articles.json'))
    .catch(e=>showLoadError(
      `自动载入失败：${e.message}。请确认 data/articles.json 存在，并通过 Web 服务器访问仪表板，而不是直接打开本地 HTML 文件。`
    ));
}
boot();
