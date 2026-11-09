import fs from 'node:fs';
const base = 'https://noyeehmeen.github.io';
const mobile = 'https://m.blog.naver.com/noyeehmeen';
const title = '노예민 블로그 사이트맵';
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const path = 'posts.json';
const posts = new Map(JSON.parse(fs.readFileSync(path,'utf8').replace(/^\uFEFF/,'')).map(p=>[p.url,p]));
if (!process.argv.includes('--offline')) {
  const res = await fetch('https://rss.blog.naver.com/noyeehmeen.xml', {signal: AbortSignal.timeout(30000)});
  if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  if (!items.length) throw new Error('RSS returned no posts; retaining existing archive.');
  const tag = (s,n) => (s.match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`))?.[1] || '').replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/,'$1').trim();
  for (const [,item] of items) {
    const id = tag(item,'guid').match(/\/noyeehmeen\/(\d+)(?:\?|$)/)?.[1];
    const date = new Date(tag(item,'pubDate'));
    if (!id || !tag(item,'title') || isNaN(date)) throw new Error('Unexpected RSS post format');
    const url = `${mobile}/${id}`;
    posts.set(url,{title:tag(item,'title'),category:tag(item,'category')||'기타',url,date:new Date(date.getTime()+9*3600000).toISOString().slice(0,10)});
  }
}
const data = [...posts.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.url.localeCompare(a.url));
for(const p of data) if(!/^https:\/\/m\.blog\.naver\.com\/noyeehmeen\/\d+$/.test(p.url)) throw new Error('Non-mobile or invalid post URL');
fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');
const cats = [...new Set(data.map(p=>p.category))];
const icons = {'사와서먹은것':'🥡','가서먹은것':'🍽️','해서먹은것':'🍳','먹은것':'🍚','마신것':'☕','스마트폰/태블릿':'📱','노트북/PC':'💻','스마트워치':'⌚','음향기기':'🎧','자전거':'🚲','자동차':'🚗','생활정보':'💡','생활용품':'🧺','좋은향기':'🌿','건강습관만들기':'🌱','건강정보':'🩺','홈트':'🏋️','러닝':'👟','영양제/보조제':'💊','병원다니기':'🏥','안녕하세요':'👋','옷\u00a0신발':'👕','화장품':'🧴','선물학개론':'🎁','머리관리':'✂️','수염관리':'🪒','궁금증창고':'🔎','인간관계취약계층':'💬','국내':'🧳'};
const icon = (cat,i) => '<span class="cat-icon tone-'+(i%5)+'" aria-hidden="true">'+(icons[cat]||'📖')+'</span>';
const updated = new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
const sections = cats.map((cat,i)=>`<section id="category-${i}" class="category"><div class="section-title"><h2>${icon(cat,i)}${esc(cat)}</h2><span>${data.filter(p=>p.category===cat).length}개의 기록</span></div><ul>${data.filter(p=>p.category===cat).map(p=>`<li><a href="${p.url}">${esc(p.title)}</a><time datetime="${p.date}">${p.date.replaceAll('-','. ')}</time></li>`).join('')}</ul></section>`).join('');
let html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="노예민의 섬세한 생활 기록. 음식, 생활용품, IT와 건강에 관한 네이버 블로그 글을 주제별로 찾아보세요."><meta name="robots" content="index,follow"><link rel="canonical" href="${base}/"><meta property="og:title" content="${title}"><meta property="og:description" content="노예민 블로그 사이트맵 — 섬세한 사람의 생존기"><meta property="og:type" content="website"><meta property="og:url" content="${base}/"><style>
:root{--green:#17694d;--ink:#24382f;--muted:#6a766f;--line:#dce4dc;--paper:#fffef9}*{box-sizing:border-box}body{margin:0;background:#f4f5ee;color:var(--ink);font-family:system-ui,-apple-system,'Malgun Gothic',sans-serif;line-height:1.7}a{color:inherit}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #b07821;outline-offset:4px}.skip{position:absolute;top:-80px}.skip:focus{top:0;background:white;padding:10px;z-index:5}header{border-bottom:1px solid var(--line);background:var(--paper)}.top{max-width:1200px;margin:auto;padding:19px 32px;display:flex;justify-content:space-between;align-items:center}.brand{font-weight:800;text-decoration:none;letter-spacing:.12em;font-size:14px}.top a:last-child{font-size:13px;color:var(--green)}.wrap{max-width:1200px;margin:auto;padding:54px 32px 70px}.eyebrow{font-size:12px;letter-spacing:.16em;color:var(--green);font-weight:700}.hero{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;margin-bottom:40px}h1{font-size:clamp(30px,4vw,48px);letter-spacing:-.06em;line-height:1.35;margin:14px 0}.intro{margin:0;color:var(--muted)}.stamp{border:1px solid #bacbbb;border-radius:50%;width:108px;height:108px;flex-shrink:0;display:grid;align-content:center;text-align:center;color:var(--green);font-size:11px;letter-spacing:.15em;transform:rotate(8deg)}.stamp strong{font-family:Georgia,serif;font-size:34px;line-height:1.3;letter-spacing:0}.layout{display:grid;grid-template-columns:240px minmax(0,1fr);gap:32px}aside{align-self:start;position:sticky;top:24px}.profile{background:var(--green);color:#fff;padding:26px;border-radius:4px}.profile b{font-size:22px}.profile p{font-size:13px;color:#dce9de}.profile a{font-size:13px}.nav{padding:24px 0}.nav h2{font-size:12px;letter-spacing:.08em;color:var(--muted)}.nav a{display:flex;justify-content:space-between;text-decoration:none;padding:8px 0;font-size:14px}.nav a:hover{color:var(--green);text-decoration:underline}.nav span{color:var(--muted);font-size:12px}.note{font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:16px}.search{display:flex;gap:14px;align-items:center;margin-bottom:20px}.search input{width:100%;border:1px solid var(--line);background:var(--paper);border-radius:4px;padding:15px 17px;font:inherit;font-size:14px}.search label{white-space:nowrap;font-size:13px}.category{background:var(--paper);border:1px solid var(--line);padding:24px 28px;margin-bottom:20px;border-radius:4px;scroll-margin-top:20px}.section-title{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:14px;border-bottom:1px solid var(--ink)}h2{font-size:18px;margin:0}.section-title span{font-size:12px;color:var(--muted)}ul{list-style:none;margin:0;padding:0}li{display:flex;justify-content:space-between;gap:18px;padding:17px 0;border-bottom:1px solid #e9ede5}li:last-child{border:0;padding-bottom:0}li a{font-size:14px;text-decoration:none;word-break:keep-all;overflow-wrap:anywhere}li a:hover{color:var(--green);text-decoration:underline}time{font-size:11px;white-space:nowrap;color:var(--muted);padding-top:3px}footer{border-top:1px solid var(--line);padding:25px 0;color:var(--muted);font-size:12px;margin-top:30px}#empty{padding:32px;text-align:center;color:var(--muted)}[hidden]{display:none!important}@media(max-width:760px){.top{padding:16px 20px}.wrap{padding:30px 20px}.hero{margin-bottom:28px}.stamp{display:none}.layout{grid-template-columns:1fr;gap:20px}aside{position:static}.profile{padding:20px}.profile p{margin:8px 0}.nav{display:none}.note{margin-bottom:0}.category{padding:20px}li{flex-direction:column;gap:6px}.search label{display:none}h1{font-size:32px}}

.layout>*{min-width:0}.overview{display:flex;justify-content:space-between;gap:16px;align-items:center;border-top:1px solid var(--line);padding:22px 0 28px}.overview>div{display:flex;align-items:baseline;gap:7px}.overview strong{font-size:25px;color:var(--green);font-variant-numeric:tabular-nums}.overview span{font-size:13px;color:var(--muted)}.overview i{height:16px;border-left:1px solid var(--line);margin:0 12px}.overview p{margin:0;font-size:12px;color:var(--muted)}.overview time{display:inline;font-size:12px}.hero{margin-bottom:24px}.profile{border-radius:14px}.nav{padding:22px 0 0}.nav h2{margin-bottom:12px}.category-links{max-height:calc(100dvh - 310px);min-height:180px;overflow:auto;padding:3px 8px 3px 3px;scrollbar-width:thin;scrollbar-color:#becfbe transparent}.nav .cat-link{align-items:center;justify-content:flex-start;gap:10px;padding:8px;border:1px solid transparent;border-radius:11px;margin:2px 0;transition:background .15s}.nav .cat-link:hover{background:#e9eee3;text-decoration:none}.nav .cat-link.active{background:#e4efdf;border-color:#c7d9c0;color:#145b41;font-weight:700}.cat-icon,.nav .cat-icon{width:33px;height:33px;flex:0 0 33px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:18px;color:#254735}.tone-0{background:#e4eedc}.tone-1{background:#e3edf3}.tone-2{background:#f8e8d7}.tone-3{background:#f0e5f2}.tone-4{background:#f6e3e3}.nav .cat-name{color:inherit;font-size:13px;flex:1}.nav .cat-count{border-radius:6px;padding:0 6px;background:#fff9;font-size:11px;color:var(--muted)}.category{border-radius:14px;padding:24px}.section-title{border-bottom:1px solid var(--line);padding-bottom:18px}.section-title h2{display:flex;align-items:center;gap:12px}.section-title .cat-icon{width:40px;height:40px;flex-basis:40px;font-size:22px;border-radius:12px}.section-title>span{font-size:12px;white-space:nowrap;border-radius:20px;background:#f1f4eb;padding:4px 10px}.more-button{display:block;width:100%;margin-top:18px;padding:11px 16px;border:1px solid #d9e4d3;border-radius:9px;background:#f0f5eb;color:var(--green);font:inherit;font-size:13px;cursor:pointer}.more-button:hover{background:#e2eddc}.search input{border-radius:10px}.search{margin-bottom:12px}#result{border:0;padding:0;margin:0 0 18px;font-size:13px}#posts{scroll-margin-top:20px}aside>.note{line-height:1.8}
@media(max-width:760px){.overview{display:block;padding:16px 0 24px}.overview p{margin-top:8px}.overview strong{font-size:22px}.nav{display:block;padding-top:18px}.nav h2{font-size:12px}.category-links{display:flex;gap:7px;overflow-x:auto;max-height:none;min-height:0;padding:2px 2px 12px}.nav .cat-link{flex:0 0 auto;margin:0;padding:7px 10px;border-color:var(--line);background:var(--paper);gap:7px}.nav .cat-icon{width:25px;height:25px;flex-basis:25px;border-radius:7px;font-size:15px}.nav .cat-name{white-space:nowrap}.category{padding:18px}.section-title h2{font-size:16px;gap:9px}.section-title .cat-icon{width:34px;height:34px;flex-basis:34px;font-size:19px}.section-title>span{font-size:11px;padding:3px 8px}aside>.note{display:none}.layout{gap:12px}}
</style></head><body><a class="skip" href="#posts">글 목록으로 이동</a><header><div class="top"><a class="brand" href="/">NOYEEHMEEN / SITEMAP</a><a href="${mobile}">네이버 블로그 ↗</a></div></header><div class="wrap"><div class="hero"><div><div class="eyebrow">THE FINER THINGS IN EVERYDAY LIFE</div><h1>노예민 블로그 사이트맵</h1><p class="intro">먹고, 써보고, 알아가는 일상. 섬세한 사람의 생존기.</p></div><div class="stamp">LIFE NOTES<strong>N.</strong>BY NOYEEHMEEN</div></div><div class="overview"><div><strong>${data.length}</strong><span>개의 글</span><i></i><strong>${cats.length}</strong><span>개의 주제</span></div><p>마지막 갱신 <time datetime="${new Date().toISOString()}">${updated} KST</time></p></div><div class="layout"><aside><div class="profile"><b>노예민</b><p>@noyeehmeen<br>작은 차이도 기록으로 남깁니다.</p><a href="${mobile}">블로그에서 전체 이야기 읽기 ↗</a></div><nav class="nav" aria-label="글 카테고리"><h2>주제별로 둘러보기</h2><div class="category-links"><a href="#posts" class="cat-link active" data-filter="all" aria-current="true"><span class="cat-icon tone-0" aria-hidden="true">▦</span><span class="cat-name">전체보기</span><span class="cat-count">${data.length}</span></a>${cats.map((cat,i)=>`<a class="cat-link" data-filter="category-${i}" href="#category-${i}">${icon(cat,i)}<span class="cat-name">${esc(cat)}</span><span class="cat-count">${data.filter(p=>p.category===cat).length}</span></a>`).join('')}</div></nav><p class="note">현재 ${data.length}개의 공개 글을 모았습니다.<br>2026년 11월 9일 공개 전체 글을 수집했으며, 이후 새 글을 자동으로 추가합니다.</p></aside><main id="posts"><div class="search"><label for="search">기록 찾기</label><input id="search" type="search" placeholder="제목이나 카테고리로 검색" aria-label="글 제목 또는 카테고리 검색"></div><p id="result" role="status" class="note" hidden></p>${sections}<p id="empty" hidden>검색 결과가 없습니다. 다른 단어로 찾아보세요.</p></main></div><footer>© 노예민 · 글 제목을 누르면 네이버 모바일 블로그 원문으로 이동합니다.<br>이곳은 블로그 글을 주제별로 찾아보는 사이트맵입니다.</footer></div><script>
const search=document.querySelector('#search');
const sections=[...document.querySelectorAll('.category')];
const links=[...document.querySelectorAll('.cat-link')];
let selected='all';
const expanded=new Set();
for(const section of sections){
  section.querySelector('ul').id=section.id+'-list';
  const button=document.createElement('button');
  button.type='button';button.className='more-button';button.hidden=true;
  button.setAttribute('aria-controls',section.id+'-list');
  button.addEventListener('click',()=>{const collapse=expanded.has(section.id);if(collapse)expanded.delete(section.id);else expanded.add(section.id);render();if(collapse)section.scrollIntoView({block:'start'});});
  section.append(button);
}
function render(){
  const q=search.value.trim().toLocaleLowerCase();let total=0;
  for(const section of sections){
    const matchCategory=selected==='all'||section.id===selected;
    const rows=[...section.querySelectorAll('li')];
    const matches=rows.filter(li=>(li.textContent+' '+section.querySelector('h2').textContent).toLocaleLowerCase().includes(q));
    const isExpanded=expanded.has(section.id);
    const visible=new Set(isExpanded?matches:matches.slice(0,10));
    for(const li of rows)li.hidden=!visible.has(li);
    section.hidden=!matchCategory||!matches.length;
    if(matchCategory)total+=matches.length;
    section.querySelector('.section-title>span').textContent=matches.length+(q?'개의 검색 결과':'개의 기록');
    const button=section.querySelector('.more-button');
    button.hidden=matches.length<=10;
    button.textContent=isExpanded?'접기 ↑':'더보기 · '+(matches.length-10)+'개 더 보기 ↓';
    button.setAttribute('aria-expanded',String(isExpanded));
  }
  for(const link of links){const active=link.dataset.filter===selected;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');}
  document.querySelector('#empty').hidden=total!==0;
  const result=document.querySelector('#result');result.hidden=false;
  const label=selected==='all'?'전체 글':document.querySelector('#'+selected+' h2').textContent;
  result.textContent=q?label+'에서 '+total+'개의 글을 찾았습니다.':label+' · '+total+'개의 글';
}
for(const link of links)link.addEventListener('click',event=>{event.preventDefault();selected=link.dataset.filter;expanded.clear();render();document.querySelector('#posts').scrollIntoView({block:'start'});});
search.addEventListener('input',()=>{expanded.clear();render();});
render();
</script></body></html>`;
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/index.html',html);
fs.writeFileSync('dist/robots.txt',`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
fs.writeFileSync('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc></url></urlset>`);
fs.writeFileSync('dist/.nojekyll','');
console.log(`Built ${data.length} posts / ${cats.length} categories; all post links use mobile URLs.`);
