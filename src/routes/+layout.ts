// 프로토타입: 상태가 브라우저 localStorage 에만 있으므로 SSR 을 끄고 클라이언트에서만 렌더한다.
// (DB 연동 단계에서 +layout.server.ts 로 데이터를 내려주면서 다시 켠다)
export const ssr = false;
export const prerender = false;
