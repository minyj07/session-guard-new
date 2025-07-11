document.addEventListener('DOMContentLoaded', () => {
  console.log("Popup DOM loaded.");

  // --- DOM 요소 가져오기 ---
  const logList = document.getElementById('blocked-log-list');
  const clearLogBtn = document.getElementById('clearLogBtn');

  // --- 차단 기록 렌더링 ---
  function renderBlockedLog() {
    console.log('Popup: Attempting to render blocked log.');
    chrome.storage.local.get({ blockedRequests: [] }, (data) => {
      console.log('Popup: Data retrieved from storage:', data);
      if (chrome.runtime.lastError) {
        console.error("Error getting storage:", chrome.runtime.lastError);
        logList.innerHTML = '<li>기록을 불러오는 데 실패했습니다.</li>';
        return;
      }

      const logs = data.blockedRequests;
      console.log('Popup: Logs to render:', logs);
      logList.innerHTML = ''; // 기존 목록 초기화

      if (!logs || logs.length === 0) {
        logList.innerHTML = '<li>탐지 기록이 없습니다.</li>';
        return;
      }

      logs.forEach(log => {
        const li = document.createElement('li');
        li.className = 'log-entry';

        const typeSpan = document.createElement('span');
        typeSpan.className = 'log-type';
        typeSpan.textContent = `유형: ${log.type}`; // WebRequest 차단, 토큰 로깅 시도

        const initiatorSpan = document.createElement('span');
        initiatorSpan.className = 'log-details';
        initiatorSpan.textContent = `출처: ${log.initiator || 'N/A'}`;

        const requestSpan = document.createElement('span');
        requestSpan.className = 'log-details';
        requestSpan.textContent = `요청/내용: ${log.request || 'N/A'}`;

        const matchedTokenSpan = document.createElement('span');
        matchedTokenSpan.className = 'log-details';
        matchedTokenSpan.style.fontWeight = 'bold';
        matchedTokenSpan.style.color = '#d9534f';
        matchedTokenSpan.textContent = `감지 토큰: ${log.matchedToken || 'N/A'}`;

        const contextSpan = document.createElement('span');
        contextSpan.className = 'log-details';
        contextSpan.textContent = `컨텍스트: ${log.context || 'N/A'}`;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'log-time';
        timeSpan.textContent = new Date(log.timestamp).toLocaleString();

        li.appendChild(typeSpan);
        li.appendChild(initiatorSpan);
        li.appendChild(requestSpan);
        li.appendChild(matchedTokenSpan);
        li.appendChild(contextSpan);
        li.appendChild(timeSpan);
        logList.appendChild(li);
      });
    });
  }

  // 기록 지우기 버튼 이벤트
  clearLogBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "clearBlockedLog" }, (response) => {
      if (response && response.status === "완료") {
        renderBlockedLog();
      }
    });
  });

  // 팝업이 열릴 때 목록 렌더링
  renderBlockedLog();

  // 스토리지 변경 감지
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.blockedRequests) {
      renderBlockedLog();
    }
  });

  // --- 설정 관리 ---
  const enableDNR = document.getElementById('enableDNR');
  const enableConsoleLogDetection = document.getElementById('enableConsoleLogDetection');
  const enablePostBodyDetection = document.getElementById('enablePostBodyDetection');

  // 설정 로드
  function loadSettings() {
    chrome.storage.local.get({
      settings: {
        enableDNR: true,
        enableConsoleLogDetection: true,
        enablePostBodyDetection: true
      }
    }, (data) => {
      enableDNR.checked = data.settings.enableDNR;
      enableConsoleLogDetection.checked = data.settings.enableConsoleLogDetection;
      enablePostBodyDetection.checked = data.settings.enablePostBodyDetection;
    });
  }

  // 설정 저장 및 백그라운드에 알림
  function saveSettings() {
    const settings = {
      enableDNR: enableDNR.checked,
      enableConsoleLogDetection: enableConsoleLogDetection.checked,
      enablePostBodyDetection: enablePostBodyDetection.checked
    };
    chrome.storage.local.set({ settings: settings }, () => {
      chrome.runtime.sendMessage({ action: "updateSettings", settings: settings });
    });
  }

  // 설정 변경 이벤트 리스너
  enableDNR.addEventListener('change', saveSettings);
  enableConsoleLogDetection.addEventListener('change', saveSettings);
  enablePostBodyDetection.addEventListener('change', saveSettings);

  // 팝업이 열릴 때 설정 로드
  loadSettings();
});
