import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { categoryTree } from './categories.mjs';
const base = 'https://noyeehmeen.github.io';
const mobile = 'https://m.blog.naver.com/noyeehmeen';
const rssUrl = 'https://rss.blog.naver.com/noyeehmeen.xml';
const title = '노예민 블로그 사이트맵';
const homeTitle = `${title} | 맛집·IT·생활 후기`;
const homeDescription = '문래·영등포 식당과 카페 후기, 생활용품 사용기, 스마트폰·PC 문제 해결 기록을 주제별로 모았습니다. 묶음 글에서 짧은 소개와 네이버 모바일 원문 링크를 찾을 수 있습니다.';
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
    posts.set(url, {
      title: tag(item, 'title'),
      category: tag(item, 'category') || '기타',
      url,
      date: new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10),
      ...(preview && { preview }),
    });
  }
}
const data = [...posts.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.url.localeCompare(a.url));
for (const post of data) {
  if (!/^https:\/\/m\.blog\.naver\.com\/noyeehmeen\/\d+$/.test(post.url)) throw new Error('Non-mobile or invalid post URL');
  delete post.tags;
}
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
const linksPerGroup = 15;
for (const category of categoryPages) {
  const total = Math.ceil(category.posts.length / linksPerGroup);
  category.groups = Array.from({ length: total }, (_, index) => ({
    number: index + 1,
    title: total > 1 ? `${category.name} ${index + 1}` : category.name,
    path: index === 0 ? category.path : `${category.path}page/${index + 1}/`,
    posts: category.posts.slice(index * linksPerGroup, (index + 1) * linksPerGroup),
  }));
}
const categorySubjects = {
  '/category/food/takeout/': '배달·포장 음식 후기',
  '/category/food/restaurants/': '식당·카페 방문 후기',
  '/category/tech/computers/': 'PC 설정과 주변기기 사용기',
  '/category/tech/phones-tablets/': '갤럭시 사용기와 설정',
  '/category/living/products/': '생활용품 사용기',
  '/category/transport/bicycles/': '자전거 수리와 용품 후기',
};
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

const postId = post => post.url.split('/').at(-1);
const postPreview = post => postDetails[postId(post)]?.preview || post.preview ||
  `${post.category} 카테고리에 올린 글입니다. 자세한 내용은 원문에서 읽을 수 있어요.`;

function groupIndex() {
  return categories.filter(category => category.count).map((category, index) => {
    const groups = [category, ...category.children].flatMap(item => item.groups);
    const heading = category.children.length || groups.length > 1
      ? `<h2 class="group-index-heading">${icon(category.name, index)}<a href="${category.path}">${esc(category.name)}</a></h2>`
      : '';
    const items = groups.map(group => {
      const keywords = group.posts.map(post => `${post.title} ${postPreview(post)} ${post.date}`).join(' ');
      return `<li data-search-item data-keywords="${esc(`${category.name} ${group.title} ${keywords}`)}">
        <a href="${group.path}"><strong>${esc(group.title)}</strong><span>${group.posts.length}개 글</span></a>
      </li>`;
    }).join('');
    return `<section class="category group-index" data-search-section>${heading}<ul>${items}</ul></section>`;
  }).join('');
}

function originalList(group, category) {
  const items = group.posts.map(post => {
    const id = postId(post);
    return `<li id="post-${id}" data-search-item data-keywords="${esc(`${category.name} ${post.date}`)}">
      <article>
        <h2 id="title-${id}">${esc(post.title)}</h2>
        <p>${esc(postPreview(post))}</p>
        <a id="original-${id}" href="${post.url}" aria-labelledby="title-${id} original-${id}">${post.url}</a>
      </article>
    </li>`;
  }).join('');
  return `<section class="category original-list" aria-label="${esc(group.title)}의 글" data-search-section><ul>${items}</ul></section>`;
}

function pagination(category, group) {
  if (category.groups.length < 2) return '';
  const links = category.groups.map(item => item === group
    ? `<span aria-current="page">${item.number}</span>`
    : `<a href="${item.path}" aria-label="${esc(item.title)}">${item.number}</a>`).join('');
  return `<nav class="group-pagination" aria-label="묶음 글 선택">${links}</nav>`;
}
const sharedStyle = `
:root{--green:#17694d;--ink:#24382f;--muted:#6a766f;--line:#dce4dc;--paper:#fffef9}*{box-sizing:border-box}body{margin:0;background:#f4f5ee;color:var(--ink);font-family:system-ui,-apple-system,'Malgun Gothic',sans-serif;line-height:1.7}a{color:inherit}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #b07821;outline-offset:4px}.skip{position:absolute;top:-80px}.skip:focus{top:0;background:white;padding:10px;z-index:5}header{border-bottom:1px solid var(--line);background:var(--paper)}.top{max-width:1200px;margin:auto;padding:19px 32px;display:flex;justify-content:space-between;align-items:center}.brand{font-weight:800;text-decoration:none;letter-spacing:.12em;font-size:14px}.top a:last-child{font-size:13px;color:var(--green)}.top{flex-wrap:wrap;gap:14px 24px}.top-menu{display:flex;flex-wrap:wrap;gap:12px 20px;font-size:13px;color:var(--green)}.wrap{max-width:1200px;margin:auto;padding:54px 32px 70px}.eyebrow{font-size:12px;letter-spacing:.16em;color:var(--green);font-weight:700}.hero{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;margin-bottom:40px}h1{font-size:clamp(30px,4vw,48px);letter-spacing:-.06em;line-height:1.35;margin:14px 0}.intro{margin:0;color:var(--muted)}.stamp{border:1px solid #bacbbb;border-radius:50%;width:108px;height:108px;flex-shrink:0;display:grid;align-content:center;text-align:center;color:var(--green);font-size:11px;letter-spacing:.15em;transform:rotate(8deg)}.stamp strong{font-family:Georgia,serif;font-size:34px;line-height:1.3;letter-spacing:0}.layout{display:grid;grid-template-columns:240px minmax(0,1fr);gap:32px}aside{align-self:start;position:sticky;top:24px}.profile{background:var(--green);color:#fff;padding:26px;border-radius:4px}.profile b{font-size:22px}.profile p{font-size:13px;color:#dce9de}.profile a{font-size:13px}.nav{padding:24px 0}.nav h2{font-size:12px;letter-spacing:.08em;color:var(--muted)}.nav a{display:flex;justify-content:space-between;text-decoration:none;padding:8px 0;font-size:14px}.nav a:hover{color:var(--green);text-decoration:underline}.nav span{color:var(--muted);font-size:12px}.note{font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:16px}.search{display:flex;gap:14px;align-items:center;margin-bottom:20px}.search input{width:100%;border:1px solid var(--line);background:var(--paper);border-radius:4px;padding:15px 17px;font:inherit;font-size:14px}.search label{white-space:nowrap;font-size:13px}.category{background:var(--paper);border:1px solid var(--line);padding:24px 28px;margin-bottom:20px;border-radius:4px;scroll-margin-top:20px}h2{font-size:18px;margin:0}ul{list-style:none;margin:0;padding:0}.category li{display:flex;justify-content:space-between;gap:18px;padding:17px 0;border-bottom:1px solid #e9ede5}.category li:last-child{border:0;padding-bottom:0}.category li a{font-size:14px;text-decoration:none;word-break:keep-all;overflow-wrap:anywhere}.category li a:hover{color:var(--green);text-decoration:underline}time{font-size:11px;white-space:nowrap;color:var(--muted);padding-top:3px}footer{border-top:1px solid var(--line);padding:25px 0;color:var(--muted);font-size:12px;margin-top:30px}#empty{padding:32px;text-align:center;color:var(--muted)}[hidden]{display:none!important}@media(max-width:760px){.top{padding:16px 20px}.wrap{padding:30px 20px}.hero{margin-bottom:28px}.stamp{display:none}.layout{grid-template-columns:1fr;gap:20px}aside{position:static}.profile{padding:20px}.profile p{margin:8px 0}.nav{display:none}.note{margin-bottom:0}.category{padding:20px}.category li{flex-direction:column;gap:6px}.search label{display:none}h1{font-size:32px}}

.layout>*{min-width:0}.overview{display:flex;justify-content:space-between;gap:16px;align-items:center;border-top:1px solid var(--line);padding:22px 0 28px}.overview>div{display:flex;align-items:baseline;gap:7px}.overview strong{font-size:25px;color:var(--green);font-variant-numeric:tabular-nums}.overview span{font-size:13px;color:var(--muted)}.overview i{height:16px;border-left:1px solid var(--line);margin:0 12px}.overview p{margin:0;font-size:12px;color:var(--muted)}.overview time{display:inline;font-size:12px}.hero{margin-bottom:24px}.profile{border-radius:14px}.profile-avatar{display:block;width:88px;height:88px;object-fit:contain;border-radius:50%;margin-bottom:18px;background:var(--paper)}.nav{padding:22px 0 0}.nav h2{margin-bottom:12px}.category-links{max-height:calc(100dvh - 310px);min-height:180px;overflow:auto;padding:3px 8px 3px 3px;scrollbar-width:thin;scrollbar-color:#becfbe transparent}.nav .cat-link{align-items:center;justify-content:flex-start;gap:10px;padding:8px;border:1px solid transparent;border-radius:11px;margin:2px 0;transition:background .15s}.nav .cat-link:hover{background:#e9eee3;text-decoration:none}.nav .cat-link.active{background:#e4efdf;border-color:#c7d9c0;color:#145b41;font-weight:700}.cat-icon,.nav .cat-icon{width:33px;height:33px;flex:0 0 33px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:18px;color:#254735}.tone-0{background:#e4eedc}.tone-1{background:#e3edf3}.tone-2{background:#f8e8d7}.tone-3{background:#f0e5f2}.tone-4{background:#f6e3e3}.nav .cat-name{color:inherit;font-size:13px;flex:1}.nav .cat-count{border-radius:6px;padding:0 6px;background:#fff9;font-size:11px;color:var(--muted)}.category{border-radius:14px;padding:24px}.search input{border-radius:10px}.search{margin-bottom:12px}#result{border:0;padding:0;margin:0 0 18px;font-size:13px}#posts{scroll-margin-top:20px}aside>.note{line-height:1.8}
@media(max-width:760px){.overview{display:block;padding:16px 0 24px}.overview p{margin-top:8px}.overview strong{font-size:22px}.nav{display:block;padding-top:18px}.nav h2{font-size:12px}.category-links{display:flex;gap:7px;overflow-x:auto;max-height:none;min-height:0;padding:2px 2px 12px}.nav .cat-link{flex:0 0 auto;margin:0;padding:7px 10px;border-color:var(--line);background:var(--paper);gap:7px}.nav .cat-icon{width:25px;height:25px;flex-basis:25px;border-radius:7px;font-size:15px}.nav .cat-name{white-space:nowrap}.category{padding:18px}aside>.note{display:none}.layout{gap:12px}}

.category-links { display:block; list-style:none; margin:0; overflow-x:hidden; overflow-y:auto; max-height:clamp(180px, calc(100dvh - 420px), 540px); }
.topic-wrap .category-links { max-height:clamp(180px, calc(100dvh - 200px), 680px); }
.category-links > li + li { margin-top:5px; }
.category-links > li > .cat-link { font-weight:700; }
.category-children { list-style:none; margin:2px 0 6px 16px; padding:0 0 0 8px; border-left:1px solid var(--line); }
.category-children .cat-link { padding:4px 7px; }
.category-children .cat-icon { width:25px; height:25px; flex-basis:25px; font-size:14px; border-radius:7px; }
.nav .cat-name { white-space:normal; min-width:0; overflow-wrap:anywhere; }
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
.group-index-heading { display:flex; align-items:center; gap:10px; padding-bottom:12px; border-bottom:1px solid var(--line); }
.group-index-heading a { text-decoration:none; }
.group-index-heading a:hover { text-decoration:underline; }
.group-index ul li { display:block; padding:0; }
.group-index li a { display:flex; justify-content:space-between; align-items:center; gap:8px 16px; min-height:44px; padding:8px 0; }
.group-index li a span { flex:none; color:var(--muted); font-size:12px; }
.original-list { padding:8px clamp(18px,4vw,32px); }
.original-list ul li { display:block; padding:21px 0 24px; scroll-margin-top:24px; }
.original-list ul li:last-child { padding-bottom:21px; }
.original-list li:target article { border-left:3px solid var(--green); padding-left:12px; }
.original-list h2 { margin:0; font-size:17px; line-height:1.6; word-break:keep-all; overflow-wrap:anywhere; }
.original-list p { margin:5px 0 9px; color:#52645a; line-height:1.75; word-break:keep-all; overflow-wrap:anywhere; }
.original-list li a { display:inline-block; color:#176047; text-decoration:underline; text-underline-offset:3px; overflow-wrap:anywhere; word-break:normal; }
.group-pagination { display:flex; flex-wrap:wrap; gap:7px; margin:0 0 18px; }
.group-pagination a,.group-pagination span { min-width:42px; min-height:42px; display:grid; place-items:center; border-radius:8px; border:1px solid var(--line); background:var(--paper); font-size:14px; font-weight:700; text-decoration:none; }
.group-pagination a:hover { border-color:var(--green); }
.group-pagination [aria-current="page"] { border-color:var(--green); background:var(--green); color:#fff; }
.menu-toggle { display:none; }
@media(max-width:760px) { .category-links, .topic-wrap .category-links { max-height:20rem; min-height:0; } .nav .cat-link { margin:2px 0; border-color:transparent; background:transparent; } .topic-wrap { padding-top:28px; } }
@media(max-width:760px) {
  .topic-shortcuts .topic-children { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
  .topic-shortcuts .topic-children a { padding:10px 12px; word-break:keep-all; overflow-wrap:anywhere; }
  .original-list h2 { font-size:16px; }
  .nav.has-toggle .category-nav-title { display:none; }
  .menu-toggle { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; padding:10px 14px; border:1px solid var(--line); border-radius:10px; background:var(--paper); color:var(--green); font:inherit; font-weight:700; cursor:pointer; }
  .menu-toggle::after { content:''; width:8px; height:8px; border-right:2px solid currentColor; border-bottom:2px solid currentColor; transform:rotate(45deg); margin:-4px 2px 0 0; }
  .menu-toggle[aria-expanded="true"]::after { transform:rotate(225deg); margin-top:4px; }
  .nav.has-toggle .menu-toggle[aria-expanded="false"] + .category-links { display:none; }
  .menu-toggle + .category-links { margin-top:8px; }
}
`;
const stylesheetUrl = `/archive.css?v=${createHash('sha256').update(sharedStyle).digest('hex').slice(0, 12)}`;
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
const search = document.querySelector('#search');
if (search) {
  const result = document.querySelector('#result');
  const empty = document.querySelector('#empty');
  const sections = [...document.querySelectorAll('[data-search-section]')].map(element => ({
    element,
    items: [...element.querySelectorAll('[data-search-item]')].map(item => ({
      item,
      text: (item.dataset.keywords + ' ' + item.textContent).replace(/\\s+/g, ' ').toLocaleLowerCase(),
    })),
  }));
  const render = () => {
    const query = search.value.trim().replace(/\\s+/g, ' ').toLocaleLowerCase();
    let total = 0;
    for (const { element, items } of sections) {
      let matches = 0;
      for (const { item, text } of items) {
        const visible = text.includes(query);
        item.hidden = !visible;
        if (visible) matches += 1;
      }
      element.hidden = matches === 0;
      total += matches;
    }
    empty.hidden = !query || total > 0;
    result.hidden = !query || total === 0;
    result.textContent = total + '개의 ' + result.dataset.unit + '을 찾았습니다.';
  };
  search.addEventListener('input', render);
  render();
}
`;
const scriptUrl = `/archive.js?v=${createHash('sha256').update(archiveScript).digest('hex').slice(0, 12)}`;

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
  <link rel="stylesheet" href="${stylesheetUrl}">
  <script src="${scriptUrl}" defer></script>
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
          <p id="result" role="status" class="note" data-unit="묶음 글" hidden></p>
          ${groupIndex()}
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

function categoryPage(category, group = category.groups[0]) {
  const currentPath = group?.path ?? category.path;
  const heading = group?.title ?? category.name;
  const subject = categorySubjects[category.path] ?? category.parent?.name;
  const pageTitle = [heading, subject, '노예민 블로그'].filter(Boolean).join(' | ');
  const canonical = `${base}${currentPath}`;
  const description = category.groups.length > 1
    ? `${category.description} ${group.number}번째 묶음의 글 ${group.posts.length}개를 소개합니다.`
    : category.description;
  const children = category.children.map(child => `<li><a href="${child.path}"><strong>${esc(child.name)}</strong><span>${esc(child.description)}</span></a></li>`).join('');
  const childLinks = children ? `<ul class="topic-children" aria-label="하위 카테고리">${children}</ul>` : '';
  const crumbs = categoryTrail(category);
  if (currentPath === category.path) crumbs[crumbs.length - 1] = { name: heading, path: currentPath };
  else crumbs.push({ name: heading, path: currentPath });
  const trail = breadcrumb(crumbs);
  const pager = pagination(category, group);
  const records = group ? `
    ${pager}
    <div class="search"><label for="search">기록 찾기</label><input id="search" type="search" placeholder="이 묶음에서 검색" aria-label="이 묶음에서 검색"></div>
    <p id="result" role="status" class="note" data-unit="글" hidden></p>
    ${originalList(group, category)}
    <p id="empty" hidden>검색 결과가 없습니다. 다른 단어로 찾아보세요.</p>
    ${pager}` : '';

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="alternate" type="application/rss+xml" title="노예민 네이버 블로그 RSS" href="${rssUrl}">
  <meta property="og:site_name" content="${title}">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <script type="application/ld+json">${trail.data}</script>
  <link rel="stylesheet" href="${stylesheetUrl}">
  <script src="${scriptUrl}" defer></script>
</head>
<body>
  <a class="skip" href="#posts">글 목록으로 이동</a>
  <header><div class="top"><a class="brand" href="/">NOYEEHMEEN / SITEMAP</a><nav class="top-menu" aria-label="주요 메뉴"><a href="/aboutus/">인사말</a><a href="${rssUrl}">RSS 피드 ↗</a></nav></div></header>
  <div class="wrap topic-wrap">
    <div class="layout">
      <aside>${categoryMenu(currentPath)}</aside>
      <main id="posts">
        ${trail.markup}
        <div class="topic-summary"><h1>${esc(heading)}</h1><p>${esc(category.description)}</p></div>
        ${childLinks}
        ${records}
      </main>
    </div>
  </div>
</body>
</html>`;
}

function postRedirect(post, group) {
  const canonical = `${base}${group.path}`;
  const target = `${canonical}#post-${postId(post)}`;
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=${target}">
  <title>${esc(post.title)}</title>
  <link rel="canonical" href="${canonical}">
  <link rel="stylesheet" href="${stylesheetUrl}">
</head>
<body>
  <main class="wrap">
    <h1>${esc(post.title)}</h1>
    <a href="${target}">${esc(group.title)} 묶음에서 보기</a>
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
const categoryPaths = [];
let groupCount = 0;
for (const category of categoryPages) {
  for (const group of category.groups.length ? category.groups : [undefined]) {
    const route = group?.path ?? category.path;
    const directory = `dist${route}`;
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(`${directory}index.html`, categoryPage(category, group));
    categoryPaths.push(route);
    if (!group) continue;
    groupCount += 1;
    for (const post of group.posts) {
      const id = postId(post);
      if (!postDetails[id]) continue;
      const oldDirectory = `dist/posts/${id}/`;
      fs.mkdirSync(oldDirectory, { recursive: true });
      fs.writeFileSync(`${oldDirectory}index.html`, postRedirect(post, group));
    }
  }
}
const sitemapUrls = ['/', '/aboutus/', ...categoryPaths].map(path => `${base}${path}`);
const sitemapEntries = sitemapUrls.map(url => `  <url><loc>${esc(url)}</loc></url>`);
fs.writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.join('\n')}\n</urlset>\n`);
fs.writeFileSync('dist/sitemap.txt', `${sitemapUrls.join('\n')}\n`);
fs.writeFileSync('dist/.nojekyll','');
console.log(`Built ${groupCount} groups of up to ${linksPerGroup} links for ${data.length} Naver posts.`);
