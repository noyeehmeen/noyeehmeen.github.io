import fs from 'node:fs';
import { categoryTree } from './categories.mjs';
const base = 'https://noyeehmeen.github.io';
const mobile = 'https://m.blog.naver.com/noyeehmeen';
const rssUrl = 'https://rss.blog.naver.com/noyeehmeen.xml';
const title = '노예민 블로그 사이트맵';
const homeTitle = `${title} | 맛집·IT·생활 후기`;
const homeDescription = '문래·영등포 식당과 카페 방문 후기, 생활용품 사용기, 스마트폰·PC 문제 해결 기록을 주제별로 찾아보세요. 각 글의 짧은 소개와 네이버 블로그 원문 링크를 함께 제공합니다.';
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const path = 'posts.json';
const postDetails = JSON.parse(fs.readFileSync('post-details.json', 'utf8'));
const posts = new Map(JSON.parse(fs.readFileSync(path,'utf8').replace(/^\uFEFF/,'')).map(p=>[p.url,p]));

const textEntities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…' };

function rssText(value) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, key) => {
    if (key[0] !== '#') return textEntities[key.toLowerCase()] ?? entity;
    const code = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  }).replace(/[\u200b\ufeff]/g, '').replace(/\s+/g, ' ').trim();
}

function rssPreview(value) {
  const preview = rssText(value).replace(/\.{3,}$/, '…');
  if (preview.length <= 126) return preview;
  const sentence = [...preview.slice(0, 126).matchAll(/[.!?](?=\s|$)/g)].at(-1);
  if (sentence?.index >= 45) return preview.slice(0, sentence.index + 1);
  const words = preview.slice(0, 126).replace(/\s+\S*$/, '').trimEnd();
  return (words.length >= 55 ? words : preview.slice(0, 126)).replace(/[.…,]+$/, '') + '…';
}

function rssTags(value) {
  const tags = rssText(value).split(',').map(tag => tag.trim().replace(/^#+/, ''));
  const excluded = /^(?:노예민|리빙테크드|아무튼건강|noyeehmeen|livingteched|[a-z]+\d+kg|\d+)$/i;
  return [...new Set(tags)].filter(tag => /^[\p{L}\p{N}_-]{2,24}$/u.test(tag) && !excluded.test(tag)).slice(0, 4);
}

if (!process.argv.includes('--offline')) {
  const res = await fetch(rssUrl, {signal: AbortSignal.timeout(30000)});
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
    const previous = posts.get(url);
    const preview = rssPreview(tag(item, 'description')) || previous?.preview;
    const tags = rssTags(tag(item, 'tag'));
    posts.set(url, {
      title: tag(item, 'title'),
      category: tag(item, 'category') || '기타',
      url,
      date: new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10),
      ...(preview && { preview }),
      ...(tags.length && { tags }),
    });
  }
}
const data = [...posts.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.url.localeCompare(a.url));
for(const p of data) if(!/^https:\/\/m\.blog\.naver\.com\/noyeehmeen\/\d+$/.test(p.url)) throw new Error('Non-mobile or invalid post URL');
fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');
const categoryKey = name => name.replace(/\s+/g, ' ').trim();
const postsByCategory = new Map();
for (const post of data) {
  const key = categoryKey(post.category);
  if (!postsByCategory.has(key)) postsByCategory.set(key, []);
  postsByCategory.get(key).push(post);
}

function buildCategory([slug, name, description, children = []], parent = null) {
  const path = `${parent?.path ?? '/category/'}${slug}/`;
  const category = { name, description, path, parent, posts: postsByCategory.get(name) ?? [] };
  category.children = children.map(child => buildCategory(child, category));
  category.count = category.posts.length + category.children.reduce((count, child) => count + child.count, 0);
  return category;
}

const categories = categoryTree.map(entry => buildCategory(entry));
const knownNames = new Set(categories.flatMap(category => [category.name, ...category.children.map(child => child.name)]));
const uncategorizedPosts = data.filter(post => !knownNames.has(categoryKey(post.category)));
if (uncategorizedPosts.length) {
  categories.push({ name: '기타', path: '/category/other/', description: '기존 분류에 속하지 않는 노예민 블로그의 공개 글을 모았습니다.', posts: uncategorizedPosts, children: [], count: uncategorizedPosts.length });
}

const categoryPages = categories.flatMap(category => [category, ...category.children]);
const postCategories = new Map(categoryPages.flatMap(category => category.posts.map(post => [post.url, category])));
const categorySubjects = {
  '/category/food/takeout/': '배달·포장 음식 후기',
  '/category/food/restaurants/': '식당·카페 방문 후기',
  '/category/tech/computers/': 'PC 설정과 주변기기 사용기',
  '/category/tech/phones-tablets/': '갤럭시 사용기와 설정',
  '/category/living/products/': '생활용품 사용기',
  '/category/transport/bicycles/': '자전거 수리와 용품 후기',
};
const legacyIds = new Map([...postsByCategory.keys()].map((name, i) => [name, `category-${i}`]));
const icons = {'사와서먹은것':'🥡','가서먹은것':'🍽️','해서먹은것':'🍳','먹은것':'🍚','마신것':'☕','스마트폰/태블릿':'📱','노트북/PC':'💻','스마트워치':'⌚','음향기기':'🎧','자전거':'🚲','자동차':'🚗','생활정보':'💡','생활용품':'🧺','좋은향기':'🌿','건강습관만들기':'🌱','건강정보':'🩺','홈트':'🏋️','러닝':'👟','영양제/보조제':'💊','병원다니기':'🏥','안녕하세요':'👋','옷\u00a0신발':'👕','화장품':'🧴','선물학개론':'🎁','머리관리':'✂️','수염관리':'🪒','궁금증창고':'🔎','인간관계취약계층':'💬','국내':'🧳'};
const icon = (cat,i) => '<span class="cat-icon tone-'+(i%5)+'" aria-hidden="true">'+(icons[cat]||'📖')+'</span>';
const updated = new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
function categoryLink(category, currentPath, tone = 0) {
  const active = category.path === currentPath;
  const current = active ? ' aria-current="page"' : '';
  return `<a class="cat-link${active ? ' active' : ''}" href="${category.path}"${current}>${icon(category.name, tone)}<span class="cat-name">${esc(category.name)}</span><span class="cat-count">${category.count}</span></a>`;
}

function categoryMenu(currentPath) {
  const all = { path: '/', name: '전체 보기', count: data.length };
  const groups = categories.map((category, i) => {
    const children = category.children.map(child => `<li>${categoryLink(child, currentPath, i)}</li>`).join('');
    const nested = children ? `<ul class="category-children">${children}</ul>` : '';
    return `<li>${categoryLink(category, currentPath, i)}${nested}</li>`;
  }).join('');
  return `<nav class="nav" aria-label="글 카테고리"><h2 class="category-nav-title">카테고리</h2><button type="button" class="menu-toggle" aria-controls="category-menu" aria-expanded="false" hidden>카테고리 전체 보기</button><ul class="category-links" id="category-menu"><li>${categoryLink(all, currentPath)}</li>${groups}</ul></nav>`;
}

function topicShortcuts() {
  const topics = [
    ['/category/food/restaurants/', '식당·카페 방문 후기', '문래·영등포의 식당과 카페'],
    ['/category/tech/', 'IT 기기와 설정', '스마트폰, PC, 기기 연결 문제'],
    ['/category/living/products/', '생활용품 사용기', '직접 조립하고 써본 생활용품'],
    ['/category/transport/bicycles/', '자전거 용품과 수리', '펑크와 소음, 거치대 사용기'],
  ];
  const links = topics.map(([path, label, detail]) => `<li><a href="${path}"><strong>${label}</strong><span>${detail}</span></a></li>`).join('');
  return `<section class="topic-shortcuts" aria-labelledby="topic-shortcuts-heading"><h2 id="topic-shortcuts-heading">주제별로 둘러보기</h2><ul class="topic-children">${links}</ul></section>`;
}

function postPresentation(post) {
  const id = post.url.split('/').at(-1);
  const details = postDetails[id];
  const preview = details?.preview || post.preview || `${post.category} 카테고리에 올린 글입니다. 자세한 내용은 원문에서 읽을 수 있어요.`;
  const tags = (details?.tags ?? post.tags ?? []).map(tag => `<span>#${esc(tag)}</span>`).join('');
  return { id, path: `/posts/${id}/`, preview, tags: tags ? `<div class="post-tags">${tags}</div>` : '' };
}

function postSections(selectedCategories, currentPath) {
  return selectedCategories.filter(category => category.posts.length).map((category, i) => {
    const id = legacyIds.get(category.name) ?? 'category-other';
    const rows = category.posts.map(post => {
      const searchCategory = [post.category, category.parent?.name].filter(Boolean).join(' ');
      const view = postPresentation(post);
      return `<li class="post-entry" data-category="${esc(searchCategory)}">
        <article>
          <div class="post-heading">
            <h3 id="post-${view.id}-title"><a href="${view.path}">${esc(post.title)}</a></h3>
            <time datetime="${post.date}">${post.date.replaceAll('-','. ')}</time>
          </div>
          <p class="post-preview">${esc(view.preview)}</p>
          <div class="post-footer">
            ${view.tags}
            <a class="post-read" id="post-${view.id}-link" href="${post.url}" aria-labelledby="post-${view.id}-link post-${view.id}-title">네이버 블로그 원문 <span aria-hidden="true">↗</span></a>
          </div>
        </article>
      </li>`;
    }).join('');
    const heading = currentPath === category.path ? '글 목록' : `<a href="${category.path}">${esc(category.name)}</a>`;
    return `<section id="${id}" class="category"><div class="section-title"><h2>${icon(category.name, i)}${heading}</h2><span>${category.posts.length}개의 기록</span></div><ul>${rows}</ul></section>`;
  }).join('');
}
const sharedStyle = `
:root{--green:#17694d;--ink:#24382f;--muted:#6a766f;--line:#dce4dc;--paper:#fffef9}*{box-sizing:border-box}body{margin:0;background:#f4f5ee;color:var(--ink);font-family:system-ui,-apple-system,'Malgun Gothic',sans-serif;line-height:1.7}a{color:inherit}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #b07821;outline-offset:4px}.skip{position:absolute;top:-80px}.skip:focus{top:0;background:white;padding:10px;z-index:5}header{border-bottom:1px solid var(--line);background:var(--paper)}.top{max-width:1200px;margin:auto;padding:19px 32px;display:flex;justify-content:space-between;align-items:center}.brand{font-weight:800;text-decoration:none;letter-spacing:.12em;font-size:14px}.top a:last-child{font-size:13px;color:var(--green)}.top{flex-wrap:wrap;gap:14px 24px}.top-menu{display:flex;flex-wrap:wrap;gap:12px 20px;font-size:13px;color:var(--green)}.wrap{max-width:1200px;margin:auto;padding:54px 32px 70px}.eyebrow{font-size:12px;letter-spacing:.16em;color:var(--green);font-weight:700}.hero{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;margin-bottom:40px}h1{font-size:clamp(30px,4vw,48px);letter-spacing:-.06em;line-height:1.35;margin:14px 0}.intro{margin:0;color:var(--muted)}.stamp{border:1px solid #bacbbb;border-radius:50%;width:108px;height:108px;flex-shrink:0;display:grid;align-content:center;text-align:center;color:var(--green);font-size:11px;letter-spacing:.15em;transform:rotate(8deg)}.stamp strong{font-family:Georgia,serif;font-size:34px;line-height:1.3;letter-spacing:0}.layout{display:grid;grid-template-columns:240px minmax(0,1fr);gap:32px}aside{align-self:start;position:sticky;top:24px}.profile{background:var(--green);color:#fff;padding:26px;border-radius:4px}.profile b{font-size:22px}.profile p{font-size:13px;color:#dce9de}.profile a{font-size:13px}.nav{padding:24px 0}.nav h2{font-size:12px;letter-spacing:.08em;color:var(--muted)}.nav a{display:flex;justify-content:space-between;text-decoration:none;padding:8px 0;font-size:14px}.nav a:hover{color:var(--green);text-decoration:underline}.nav span{color:var(--muted);font-size:12px}.note{font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:16px}.search{display:flex;gap:14px;align-items:center;margin-bottom:20px}.search input{width:100%;border:1px solid var(--line);background:var(--paper);border-radius:4px;padding:15px 17px;font:inherit;font-size:14px}.search label{white-space:nowrap;font-size:13px}.category{background:var(--paper);border:1px solid var(--line);padding:24px 28px;margin-bottom:20px;border-radius:4px;scroll-margin-top:20px}.section-title{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:14px;border-bottom:1px solid var(--ink)}h2{font-size:18px;margin:0}.section-title span{font-size:12px;color:var(--muted)}ul{list-style:none;margin:0;padding:0}.category li{display:flex;justify-content:space-between;gap:18px;padding:17px 0;border-bottom:1px solid #e9ede5}.category li:last-child{border:0;padding-bottom:0}.category li a{font-size:14px;text-decoration:none;word-break:keep-all;overflow-wrap:anywhere}.category li a:hover{color:var(--green);text-decoration:underline}time{font-size:11px;white-space:nowrap;color:var(--muted);padding-top:3px}footer{border-top:1px solid var(--line);padding:25px 0;color:var(--muted);font-size:12px;margin-top:30px}#empty{padding:32px;text-align:center;color:var(--muted)}[hidden]{display:none!important}@media(max-width:760px){.top{padding:16px 20px}.wrap{padding:30px 20px}.hero{margin-bottom:28px}.stamp{display:none}.layout{grid-template-columns:1fr;gap:20px}aside{position:static}.profile{padding:20px}.profile p{margin:8px 0}.nav{display:none}.note{margin-bottom:0}.category{padding:20px}.category li{flex-direction:column;gap:6px}.search label{display:none}h1{font-size:32px}}

.layout>*{min-width:0}.overview{display:flex;justify-content:space-between;gap:16px;align-items:center;border-top:1px solid var(--line);padding:22px 0 28px}.overview>div{display:flex;align-items:baseline;gap:7px}.overview strong{font-size:25px;color:var(--green);font-variant-numeric:tabular-nums}.overview span{font-size:13px;color:var(--muted)}.overview i{height:16px;border-left:1px solid var(--line);margin:0 12px}.overview p{margin:0;font-size:12px;color:var(--muted)}.overview time{display:inline;font-size:12px}.hero{margin-bottom:24px}.profile{border-radius:14px}.profile-avatar{display:block;width:88px;height:88px;object-fit:contain;border-radius:50%;margin-bottom:18px;background:var(--paper)}.nav{padding:22px 0 0}.nav h2{margin-bottom:12px}.category-links{max-height:calc(100dvh - 310px);min-height:180px;overflow:auto;padding:3px 8px 3px 3px;scrollbar-width:thin;scrollbar-color:#becfbe transparent}.nav .cat-link{align-items:center;justify-content:flex-start;gap:10px;padding:8px;border:1px solid transparent;border-radius:11px;margin:2px 0;transition:background .15s}.nav .cat-link:hover{background:#e9eee3;text-decoration:none}.nav .cat-link.active{background:#e4efdf;border-color:#c7d9c0;color:#145b41;font-weight:700}.cat-icon,.nav .cat-icon{width:33px;height:33px;flex:0 0 33px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:18px;color:#254735}.tone-0{background:#e4eedc}.tone-1{background:#e3edf3}.tone-2{background:#f8e8d7}.tone-3{background:#f0e5f2}.tone-4{background:#f6e3e3}.nav .cat-name{color:inherit;font-size:13px;flex:1}.nav .cat-count{border-radius:6px;padding:0 6px;background:#fff9;font-size:11px;color:var(--muted)}.category{border-radius:14px;padding:24px}.section-title{border-bottom:1px solid var(--line);padding-bottom:18px}.section-title h2{display:flex;align-items:center;gap:12px}.section-title .cat-icon{width:40px;height:40px;flex-basis:40px;font-size:22px;border-radius:12px}.section-title>span{font-size:12px;white-space:nowrap;border-radius:20px;background:#f1f4eb;padding:4px 10px}.more-button{display:block;width:100%;margin-top:18px;padding:11px 16px;border:1px solid #d9e4d3;border-radius:9px;background:#f0f5eb;color:var(--green);font:inherit;font-size:13px;cursor:pointer}.more-button:hover{background:#e2eddc}.search input{border-radius:10px}.search{margin-bottom:12px}#result{border:0;padding:0;margin:0 0 18px;font-size:13px}#posts{scroll-margin-top:20px}aside>.note{line-height:1.8}
@media(max-width:760px){.overview{display:block;padding:16px 0 24px}.overview p{margin-top:8px}.overview strong{font-size:22px}.nav{display:block;padding-top:18px}.nav h2{font-size:12px}.category-links{display:flex;gap:7px;overflow-x:auto;max-height:none;min-height:0;padding:2px 2px 12px}.nav .cat-link{flex:0 0 auto;margin:0;padding:7px 10px;border-color:var(--line);background:var(--paper);gap:7px}.nav .cat-icon{width:25px;height:25px;flex-basis:25px;border-radius:7px;font-size:15px}.nav .cat-name{white-space:nowrap}.category{padding:18px}.section-title h2{font-size:16px;gap:9px}.section-title .cat-icon{width:34px;height:34px;flex-basis:34px;font-size:19px}.section-title>span{font-size:11px;padding:3px 8px}aside>.note{display:none}.layout{gap:12px}}

.category-links { display:block; list-style:none; margin:0; overflow-x:hidden; overflow-y:auto; max-height:clamp(180px, calc(100dvh - 420px), 540px); }
.topic-wrap .category-links { max-height:clamp(180px, calc(100dvh - 200px), 680px); }
.category-links > li + li { margin-top:5px; }
.category-links > li > .cat-link { font-weight:700; }
.category-children { list-style:none; margin:2px 0 6px 16px; padding:0 0 0 8px; border-left:1px solid var(--line); }
.category-children .cat-link { padding:4px 7px; }
.category-children .cat-icon { width:25px; height:25px; flex-basis:25px; font-size:14px; border-radius:7px; }
.nav .cat-name { white-space:normal; min-width:0; overflow-wrap:anywhere; }
.section-title h2 a { text-decoration:none; }
.section-title h2 a:hover { text-decoration:underline; }
.breadcrumb { margin:0 0 18px; color:var(--muted); font-size:13px; overflow-wrap:anywhere; }
.breadcrumb a { color:var(--green); }
.topic-summary { margin:0 0 26px; padding-bottom:20px; border-bottom:1px solid var(--line); }
.topic-summary h1 { font-size:clamp(27px, 4vw, 41px); }
.topic-summary p { color:var(--muted); margin:0; }
.topic-children { list-style:none; display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,205px),1fr)); gap:12px; padding:0; margin:0 0 26px; }
.topic-children a { display:block; height:100%; padding:14px 16px; border:1px solid var(--line); border-radius:12px; background:var(--paper); text-decoration:none; }
.topic-children a:hover { border-color:var(--green); }
.topic-children strong { display:block; color:var(--green); }
.topic-children span { display:block; margin-top:4px; font-size:13px; color:var(--muted); }
.hero .intro { max-width:58ch; }
.topic-shortcuts { margin-bottom:26px; }
.topic-shortcuts h2 { font-size:18px; margin:0 0 12px; }
.topic-shortcuts .topic-children { margin:0; }
.category .post-entry { display:block; padding:16px 0; }
.category .post-entry:last-child { padding-bottom:0; }
.post-heading { display:flex; align-items:baseline; justify-content:space-between; gap:6px 16px; }
.post-heading h3 { margin:0; font-size:16px; line-height:1.55; }
.category .post-heading a { font-size:inherit; }
.post-preview { margin:6px 0 11px; color:#52645a; line-height:1.65; }
.post-footer { display:flex; align-items:center; flex-wrap:wrap; gap:8px 16px; }
.post-tags { display:flex; flex-wrap:wrap; gap:4px 6px; }
.post-tags span { padding:2px 8px; border-radius:6px; background:#eef3e9; color:#365747; font-size:12px; }
.post-footer .post-read { margin-left:auto; color:var(--green); font-size:12px; font-weight:700; text-decoration:underline; text-underline-offset:3px; }
.post-detail { max-width:800px; }
.post-detail article { padding:clamp(22px,5vw,52px); border:1px solid var(--line); border-radius:16px; background:var(--paper); }
.post-detail h1 { margin:0 0 10px; font-size:clamp(25px,4vw,38px); word-break:keep-all; overflow-wrap:anywhere; }
.post-detail time { font-size:13px; }
.post-detail .post-preview { margin:24px 0 16px; }
.post-original { display:inline-block; margin-top:26px; padding:9px 16px; border-radius:8px; background:var(--green); color:white; font-size:14px; font-weight:700; text-decoration:none; }
.post-original:hover { text-decoration:underline; }
.menu-toggle { display:none; }
@media(max-width:760px) { .category-links, .topic-wrap .category-links { max-height:20rem; min-height:0; } .nav .cat-link { margin:2px 0; border-color:transparent; background:transparent; } .topic-wrap { padding-top:28px; } }
@media(max-width:760px) {
  .topic-shortcuts .topic-children { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
  .topic-shortcuts .topic-children a { padding:10px 12px; word-break:keep-all; overflow-wrap:anywhere; }
  .post-heading { flex-wrap:wrap; }
  .post-heading h3 { flex-basis:100%; }
  .post-footer { align-items:flex-start; flex-direction:column; }
  .post-footer .post-read { margin-left:0; }
  .nav.has-toggle .category-nav-title { display:none; }
  .menu-toggle { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; padding:10px 14px; border:1px solid var(--line); border-radius:10px; background:var(--paper); color:var(--green); font:inherit; font-weight:700; cursor:pointer; }
  .menu-toggle::after { content:''; width:8px; height:8px; border-right:2px solid currentColor; border-bottom:2px solid currentColor; transform:rotate(45deg); margin:-4px 2px 0 0; }
  .menu-toggle[aria-expanded="true"]::after { transform:rotate(225deg); margin-top:4px; }
  .nav.has-toggle .menu-toggle[aria-expanded="false"] + .category-links { display:none; }
  .menu-toggle + .category-links { margin-top:8px; }
}
`;
const archiveScript = `
const menuToggle = document.querySelector('.menu-toggle');
if (menuToggle) {
  menuToggle.hidden = false;
  menuToggle.closest('.nav').classList.add('has-toggle');
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
  });
}
const search=document.querySelector('#search');
const sections=[...document.querySelectorAll('.category')];
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
    const rows=[...section.querySelectorAll('li')];
    const heading = section.querySelector('h2').textContent;
    const matches = rows.filter(row => {
      const text = [...row.querySelectorAll('.post-heading, .post-preview, .post-tags')].map(element => element.textContent);
      return [...text, row.dataset.category, heading].join(' ').toLocaleLowerCase().includes(q);
    });
    const isExpanded=expanded.has(section.id);
    const visible=new Set(isExpanded?matches:matches.slice(0,10));
    for(const li of rows)li.hidden=!visible.has(li);
    section.hidden=!matches.length;
    total+=matches.length;
    section.querySelector('.section-title>span').textContent=matches.length+(q?'개의 검색 결과':'개의 기록');
    const button=section.querySelector('.more-button');
    button.hidden=matches.length<=10;
    button.textContent=isExpanded?'접기 ↑':'더보기 · '+(matches.length-10)+'개 더 보기 ↓';
    button.setAttribute('aria-expanded',String(isExpanded));
  }
  document.querySelector('#empty').hidden=total!==0;
  const result=document.querySelector('#result');result.hidden=false;
  result.textContent=q?total+'개의 글을 찾았습니다.':'전체 글 · '+total+'개의 글';
}
search.addEventListener('input',()=>{expanded.clear();render();});
render();
`;

const siteNameData = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: title,
  alternateName: '노예민 블로그',
  url: `${base}/`,
  inLanguage: 'ko',
});

const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="google-site-verification" content="H6TtorJx-t9AjujSdW7PjEeQms2zDN9W-8OMC3fIIVc">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(homeTitle)}</title>
  <meta name="description" content="${esc(homeDescription)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${base}/">
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="alternate" type="application/rss+xml" title="노예민 네이버 블로그 RSS" href="${rssUrl}">
  <meta property="og:site_name" content="${title}">
  <meta property="og:title" content="${esc(homeTitle)}">
  <meta property="og:description" content="${esc(homeDescription)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${base}/">
  <script type="application/ld+json">${siteNameData}</script>
  <link rel="stylesheet" href="/archive.css">
  <script src="/archive.js" defer></script>
</head>
<body>
  <a class="skip" href="#posts">글 목록으로 이동</a>
  <header><div class="top"><a class="brand" href="/">NOYEEHMEEN / SITEMAP</a><nav class="top-menu" aria-label="주요 메뉴"><a href="/aboutus/">인사말</a><a href="${rssUrl}">RSS 피드 ↗</a></nav></div></header>
  <main class="wrap">
    <div class="hero">
      <div>
        <h1>${title}</h1>
        <p class="intro">${homeDescription}</p>
      </div>
      <div class="stamp" aria-hidden="true">LIFE NOTES<strong>N.</strong>BY NOYEEHMEEN</div>
    </div>
    <div class="overview">
      <div><strong>${data.length}</strong><span>개의 글</span><i></i><strong>${categoryPages.length}</strong><span>개의 주제</span></div>
      <p>마지막 갱신 <time datetime="${new Date().toISOString()}">${updated} KST</time></p>
    </div>
    <div class="layout">
      <aside>
        <div class="profile">
          <img class="profile-avatar" src="/profile.png" alt="노예민 글자가 적힌 연두색 원형 블로그 프로필" width="88" height="88">
          <b>노예민</b>
          <p>@noyeehmeen<br>작은 차이도 기록으로 남깁니다.</p>
          <a href="${mobile}">블로그에서 전체 이야기 읽기 ↗</a>
        </div>
        ${categoryMenu('/')}
        <p class="note">2026년 11월 9일 공개 전체 글을 수집했으며, 이후 새 글을 자동으로 추가합니다.</p>
      </aside>
      <div>
        ${topicShortcuts()}
        <div id="posts">
          <div class="search"><label for="search">기록 찾기</label><input id="search" type="search" placeholder="제목이나 카테고리로 검색" aria-label="글 제목 또는 카테고리 검색"></div>
          <p id="result" role="status" class="note" hidden></p>
          ${postSections(categoryPages)}
          <p id="empty" hidden>검색 결과가 없습니다. 다른 단어로 찾아보세요.</p>
        </div>
      </div>
    </div>
    <footer>© 노예민</footer>
  </main>
</body>
</html>`;

function categoryTrail(category) {
  return [{ name: '전체 보기', path: '/' }, ...(category.parent ? [category.parent] : []), category];
}

function breadcrumb(crumbs) {
  const links = crumbs.slice(0, -1).map(item => `<a href="${item.path}">${esc(item.name)}</a>`);
  const current = `<span aria-current="page">${esc(crumbs.at(-1).name)}</span>`;
  const data = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: `${base}${item.path}` })),
  }).replaceAll('<', '\\u003c');
  return { markup: `<nav class="breadcrumb" aria-label="현재 위치">${[...links, current].join(' › ')}</nav>`, data };
}

function categoryPage(category) {
  const subject = categorySubjects[category.path] ?? category.parent?.name;
  const pageTitle = [category.name, subject, '노예민 블로그'].filter(Boolean).join(' | ');
  const canonical = `${base}${category.path}`;
  const children = category.children.map(child => `<li><a href="${child.path}"><strong>${esc(child.name)}</strong><span>${esc(child.description)}</span></a></li>`).join('');
  const childLinks = children ? `<ul class="topic-children" aria-label="하위 카테고리">${children}</ul>` : '';
  const trail = breadcrumb(categoryTrail(category));

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(category.description)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="alternate" type="application/rss+xml" title="노예민 네이버 블로그 RSS" href="${rssUrl}">
  <meta property="og:site_name" content="${title}">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(category.description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <script type="application/ld+json">${trail.data}</script>
  <link rel="stylesheet" href="/archive.css">
  <script src="/archive.js" defer></script>
</head>
<body>
  <a class="skip" href="#posts">글 목록으로 이동</a>
  <header><div class="top"><a class="brand" href="/">NOYEEHMEEN / SITEMAP</a><nav class="top-menu" aria-label="주요 메뉴"><a href="/aboutus/">인사말</a><a href="https://rss.blog.naver.com/noyeehmeen.xml">RSS 피드 ↗</a></nav></div></header>
  <div class="wrap topic-wrap">
    <div class="layout">
      <aside>${categoryMenu(category.path)}</aside>
      <main id="posts">
        ${trail.markup}
        <div class="topic-summary"><h1>${esc(category.name)}</h1><p>${esc(category.description)}</p></div>
        ${childLinks}
        <div class="search"><label for="search">기록 찾기</label><input id="search" type="search" placeholder="이 카테고리에서 검색"></div>
        <p id="result" role="status" class="note" hidden></p>
        ${postSections([category, ...category.children], category.path)}
        <p id="empty" hidden>검색 결과가 없습니다. 다른 단어로 찾아보세요.</p>
      </main>
    </div>
  </div>
</body>
</html>`;
}

function postPage(post, view) {
  const category = postCategories.get(post.url);
  const trail = breadcrumb([...categoryTrail(category), { name: post.title, path: view.path }]);
  const canonical = `${base}${view.path}`;
  const pageTitle = `${post.title} | 노예민 블로그`;
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(view.preview)}">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <meta property="og:site_name" content="${title}">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(view.preview)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <script type="application/ld+json">${trail.data}</script>
  <link rel="stylesheet" href="/archive.css">
</head>
<body>
  <a class="skip" href="#post">글 소개로 이동</a>
  <header><div class="top"><a class="brand" href="/">NOYEEHMEEN / SITEMAP</a><nav class="top-menu" aria-label="주요 메뉴"><a href="/aboutus/">인사말</a><a href="${rssUrl}">RSS 피드 ↗</a></nav></div></header>
  <main class="wrap post-detail" id="post">
    ${trail.markup}
    <article>
      <h1>${esc(post.title)}</h1>
      <time datetime="${post.date}">${post.date.replaceAll('-','. ')}</time>
      <p class="post-preview">${esc(view.preview)}</p>
      ${view.tags}
      <a class="post-original" href="${post.url}">네이버 블로그 원문 <span aria-hidden="true">↗</span></a>
    </article>
  </main>
</body>
</html>`;
}

fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/index.html',html);
fs.writeFileSync('dist/archive.css', sharedStyle);
fs.writeFileSync('dist/archive.js', archiveScript);
fs.copyFileSync('favicon.ico', 'dist/favicon.ico');
fs.copyFileSync('profile.png', 'dist/profile.png');
fs.mkdirSync('dist/aboutus', { recursive: true });
fs.copyFileSync('aboutus.html', 'dist/aboutus/index.html');
fs.writeFileSync('dist/robots.txt',`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
for (const category of categoryPages) {
  const directory = `dist${category.path}`;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(`${directory}index.html`, categoryPage(category));
}
const postPaths = [];
for (const post of data) {
  const view = postPresentation(post);
  const directory = `dist${view.path}`;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(`${directory}index.html`, postPage(post, view));
  postPaths.push(view.path);
}
const sitemapUrls = ['/', '/aboutus/', ...categoryPages.map(category => category.path), ...postPaths].map(path => `${base}${path}`);
const sitemapEntries = sitemapUrls.map(url => `  <url><loc>${esc(url)}</loc></url>`);
fs.writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.join('\n')}\n</urlset>\n`);
fs.writeFileSync('dist/sitemap.txt', `${sitemapUrls.join('\n')}\n`);
fs.writeFileSync('dist/.nojekyll','');
console.log(`Built ${postPaths.length} post pages and ${categoryPages.length} category pages; originals use mobile URLs.`);
