
console.log('[Session Guard] Injector script loaded (v1.2 - Robust Fetch Patch).');

// --- 설정 ---
const TOKEN_REGEX_G = new RegExp(/[a-zA-Z0-9\-_\.]{10,}/g);
const SUSPICIOUS_PATH_KEYWORDS = ['log', 'track', 'api/collect'];

// --- 원본 함수 저장 ---
const originalFetch = window.fetch;
const originalConsoleLog = console.log;

// --- 유틸리티 함수 ---
function dispatchLogEvent(detail) {
    window.dispatchEvent(new CustomEvent('SessionGuard_TokenLog', { detail }));
}

// --- 함수 재정의 (Monkey Patching) ---

// 1. console.log 재정의
console.log = function(...args) {
    originalConsoleLog.apply(this, args); // 원래 기능은 그대로 실행
    try {
        for (const arg of args) {
            if (typeof arg === 'string') {
                const matches = arg.match(TOKEN_REGEX_G);
                if (matches) {
                    matches.forEach(token => {
                        dispatchLogEvent({
                            type: '토큰 로깅 시도',
                            request: arg.substring(0, 200), // 로그 내용 일부
                            matchedToken: token,
                            context: 'console.log()'
                        });
                    });
                }
            }
        }
    } catch (e) {
        originalConsoleLog('[Session Guard] Error in console.log patch:', e);
    }
};

// 2. fetch 재정의 (로직 개선 및 진단 로그 추가)
window.fetch = function(url, options) {
    try {
        // POST/PUT 등 body가 있는 요청만 검사
        if (options && options.body) {
            const requestUrl = new URL(url, window.location.origin);
            const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
            const tokens = bodyStr.match(TOKEN_REGEX_G);

            if (tokens) {
                originalConsoleLog(`[Session Guard] Detected tokens in fetch to: ${requestUrl}`);

                let eventDetail = null;
                const path = requestUrl.pathname.toLowerCase();

                // Case 1: 동일 출처의 의심스러운 경로로 요청하는 경우
                if (requestUrl.origin === window.location.origin && SUSPICIOUS_PATH_KEYWORDS.some(keyword => path.includes(keyword))) {
                    eventDetail = {
                        type: '동일 출처 의심 경로 토큰 유출 시도',
                        request: url.toString(),
                        context: `Suspicious same-origin request to ${requestUrl.pathname}`
                    };
                }
                // Case 2: 다른 출처로 요청하는 경우 (일반적인 POST 유출)
                else if (requestUrl.origin !== window.location.origin) {
                    eventDetail = {
                        type: 'POST 본문 토큰 유출 시도',
                        request: url.toString(),
                        context: `Cross-origin fetch POST body to ${requestUrl.origin}`
                    };
                }

                if (eventDetail) {
                    tokens.forEach(token => {
                        const detailWithToken = { ...eventDetail, matchedToken: token };
                        originalConsoleLog('[Session Guard] Dispatching log event:', detailWithToken); // 진단 로그
                        dispatchLogEvent(detailWithToken);
                    });
                }
            }
        }
    } catch (e) {
        originalConsoleLog('[Session Guard] Error in fetch patch:', e);
    }

    return originalFetch.apply(this, arguments);
};

console.log('[Session Guard] Injector script fully initialized.');
