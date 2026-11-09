# 노예민 블로그 사이트맵

- 사이트: https://noyeehmeen.github.io/
- 네이버 모바일 블로그: https://m.blog.naver.com/noyeehmeen
- 공개 RSS에서 글 제목, 날짜, 카테고리와 모바일 원문 링크를 수집합니다. 본문은 복제하지 않습니다.
- 매일 한국 시간 오전 8시 17분에 GitHub Actions가 수집·저장·배포합니다. 실행은 GitHub 사정에 따라 지연될 수 있습니다.
- Actions → Update blog sitemap and publish → Run workflow로 즉시 갱신할 수 있습니다.
- 2026년 11월 9일 네이버 공개 전체 목록 258개를 수집했습니다. 가장 오래된 글은 2025년 3월 14일이며, 29개 카테고리와 모바일 원문 링크를 확인했습니다. 이후 새 글은 RSS로 수집해 posts.json에 누적됩니다.
- 비공개 전환·삭제한 글은 자동으로 삭제되지 않습니다. posts.json에서 해당 항목을 제거하세요.
- 공개 저장소에서 장기간 활동이 없으면 GitHub가 예약 실행을 중지할 수 있습니다. Actions에서 확인하고 다시 활성화하세요.
- 구글 Search Console에는 https://noyeehmeen.github.io/ 를 URL 접두어 속성으로 등록하고 소유권 확인 후 sitemap.xml을 제출하세요. 이 sitemap.xml은 GitHub 사이트 자체의 URL을 안내합니다. 네이버 원문의 색인은 보장되지 않습니다.

## 로컬 실행

Node.js 22 이상에서 `node build.mjs`를 실행하면 dist에 사이트가 생성됩니다.
네트워크 없이 저장된 목록만 사용하려면 `node build.mjs --offline`을 실행하세요.
Pages의 Source는 GitHub Actions로 설정합니다. publish.yml은 저장소의 .github/workflows/publish.yml 경로에 둡니다.
