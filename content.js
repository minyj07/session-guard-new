console.log('[Session Guard] Content script loaded (v5.2 - Injector).');

// 1. 페이지에 injector.js를 주입합니다.
const s = document.createElement('script');
s.src = chrome.runtime.getURL('injector.js');
s.onload = function() {
    this.remove(); // 주입 후 스크립트 태그 제거
};
(document.head || document.documentElement).appendChild(s);

// 2. injector.js로부터 오는 이벤트를 수신합니다.
window.addEventListener('SessionGuard_TokenLog', (event) => {
    console.log('[Session Guard] Event received from injector:', event.detail);
    // 백그라운드 스크립트로 로그를 전달합니다.
    chrome.runtime.sendMessage({ action: "logSecurityEvent", details: event.detail });
});

// 3. DNR 규칙 등록을 위한 토큰 탐지는 content.js가 계속 담당합니다.
const TOKEN_REGEX = /[a-zA-Z0-9\-_\.]{10,}/g;
const MAX_TOKEN_LENGTH = 256;

function findTokensAndRegisterForDNR() {
    const tokens = new Set();
    const storages = [localStorage, sessionStorage];

    // 1. 쿠키에서 토큰 찾기
    if (document.cookie) {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const eqIndex = cookie.indexOf('=');
            if (eqIndex > -1) {
                const value = cookie.slice(eqIndex + 1).trim();
                const matches = value.match(TOKEN_REGEX);
                if (matches) {
                    matches.filter(t => t.length < MAX_TOKEN_LENGTH).forEach(t => tokens.add(t));
                }
            }
        }
    }

    // 2. 숨겨진 입력 필드에서 토큰 찾기
    const hiddenInputs = document.querySelectorAll('input[type="hidden"]');
    for (const input of hiddenInputs) {
        if (input.value) {
            const matches = input.value.match(TOKEN_REGEX);
            if (matches) {
                matches.filter(t => t.length < MAX_TOKEN_LENGTH).forEach(t => tokens.add(t));
            }
        }
    }

    // 3. 웹 스토리지 (localStorage, sessionStorage)에서 토큰 찾기
    for (const storage of storages) {
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key) {
                const value = storage.getItem(key);
                if (value) {
                    const matches = value.match(TOKEN_REGEX);
                    if (matches) {
                        matches.filter(t => t.length < MAX_TOKEN_LENGTH).forEach(t => tokens.add(t));
                    }
                }
            }
        }
    }

    if (tokens.size > 0) {
        chrome.runtime.sendMessage({ action: "registerTokens", tokens: Array.from(tokens) });
    }
}

// 페이지 로드 시 DNR 규칙 등록 실행
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    findTokensAndRegisterForDNR();
} else {
    document.addEventListener('DOMContentLoaded', findTokensAndRegisterForDNR, { once: true });
}