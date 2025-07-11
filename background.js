console.log("[Session Guard] Background script loaded (v8.0 - WebRequest Blocking).");

// --- 상태 변수 ---
let detectedTokensByDomain = {};

// --- 유틸리티 ---
function getDefaultSettings() {
    return { enableBlocking: true, enableConsoleLogDetection: true, enablePostBodyDetection: true };
}

async function getSettings() {
    try {
        const data = await chrome.storage.local.get({ settings: getDefaultSettings() });
        return data.settings;
    } catch (e) {
        return getDefaultSettings();
    }
}

// --- 핵심 로직 ---

// content.js로부터 토큰을 받아 메모리에 저장
function registerTokens(rawTokens, domain) {
    if (!domain || !rawTokens || !rawTokens.length) return;
    const tokens = rawTokens.filter(token => token.length > 10 && token.length < 256);
    detectedTokensByDomain[domain] = tokens;
    console.log(`[Session Guard] Registered ${tokens.length} tokens for domain: ${domain}`);
}

// 로그 저장 함수
function logSecurityEvent(details) {
  getSettings().then(settings => {
    if (details.type === '토큰 로깅 시도' && !settings.enableConsoleLogDetection) return;
    if ((details.type === 'POST 본문 토큰 유출 시도' || details.type === '동일 출처 의심 경로 토큰 유출 시도') && !settings.enablePostBodyDetection) return;

    const logEntry = { ...details, timestamp: new Date().toISOString() };

    chrome.storage.local.get({ blockedRequests: [] }, (data) => {
      if (chrome.runtime.lastError) return;
      const logs = data.blockedRequests;
      logs.unshift(logEntry);
      if (logs.length > 50) logs.length = 50;
      chrome.storage.local.set({ blockedRequests: logs });
    });
  });
}

// --- WebRequest 차단 리스너 ---
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    // 비동기 처리를 위해 Promise를 반환
    return new Promise(async (resolve) => {
        const settings = await getSettings();
        if (!settings.enableBlocking || !details.initiator) {
            return resolve({ cancel: false });
        }

        try {
            const initiatorDomain = new URL(details.initiator).hostname;
            const requestDomain = new URL(details.url).hostname;

            // 요청이 시작된 도메인과 목적지 도메인이 같으면 무시
            if (initiatorDomain === requestDomain) {
                return resolve({ cancel: false });
            }

            const tokensForInitiator = detectedTokensByDomain[initiatorDomain];
            if (!tokensForInitiator || tokensForInitiator.length === 0) {
                return resolve({ cancel: false });
            }

            // 등록된 토큰이 URL에 포함되어 있는지 확인
            for (const token of tokensForInitiator) {
                if (details.url.includes(token)) {
                    console.log(`[Session Guard] Blocking request from ${initiatorDomain} to ${requestDomain} containing token.`);
                    logSecurityEvent({
                        type: "토큰 유출 시도 (WebRequest 차단됨)",
                        initiator: initiatorDomain,
                        request: details.url,
                        matchedToken: token,
                        context: `Request to ${requestDomain} was blocked by webRequest.`
                    });
                    // 요청 차단
                    return resolve({ cancel: true });
                }
            }
        } catch (e) {
            console.error("[Session Guard] Error in webRequest listener:", e);
        }

        // 차단 조건에 해당하지 않으면 요청 허용
        resolve({ cancel: false });
    });
  },
  { urls: ["<all_urls>"] },
  ["blocking"] // 동기적 차단을 위해 'blocking' 옵션 추가
);


// --- 메시지 리스너 ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'clearBlockedLog':
      chrome.storage.local.set({ blockedRequests: [] }, () => sendResponse({ status: "완료" }));
      return true;
    case "registerTokens": // DNR 대신 토큰을 직접 등록
      if (sender.tab && sender.tab.url) {
        const domain = new URL(sender.tab.url).hostname;
        registerTokens(request.tokens, domain);
      }
      break;
    case "logSecurityEvent":
      const initiator = sender.tab && sender.tab.url ? new URL(sender.tab.url).hostname : 'N/A';
      logSecurityEvent({ ...request.details, initiator });
      break;
  }
  return true;
});

// 초기 설치
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('settings', (data) => {
    if (!data.settings) chrome.storage.local.set({ settings: getDefaultSettings() });
  });
});
