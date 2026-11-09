(() => {
  let lastSignature = "";
  let scanTimer;

  function collectPageInfo() {
    const visibleText = document.body?.innerText?.replace(/\s+/g, " ").trim() || "";
    const fields = [...document.querySelectorAll("input, textarea, select")];
    const sensitiveFormCount = fields.filter(field => {
      const value = `${field.type} ${field.name} ${field.id} ${field.placeholder} ${field.autocomplete}`;
      return /(password|passcode|otp|驗證|密碼|信用卡|card|cvv|銀行|account)/iu.test(value);
    }).length;
    const buttons = [...document.querySelectorAll("button, input[type='submit'], a")];
    const ctaCount = buttons.filter(element => /(立即|馬上|限時|購買|付款|領取|登入|驗證|claim|buy|pay|login|verify|now)/iu.test(element.innerText || element.value || "")).length;
    const hasCountdown = /(\d{1,2}\s*[:：]\s*\d{1,2}|倒數|剩餘時間|限時優惠|limited time|countdown)/iu.test(document.body?.innerText || "");
    return { text: visibleText.slice(0, 12000), ctaCount, formCount: document.forms.length, sensitiveFormCount, linkCount: document.querySelectorAll("a[href]").length, hasCountdown };
  }

  function scanPage() {
    const page = collectPageInfo();
    const signature = `${location.href}|${page.text.length}|${page.ctaCount}|${page.formCount}|${page.sensitiveFormCount}|${page.linkCount}|${page.hasCountdown}`;
    if (signature === lastSignature) return;
    lastSignature = signature;
    chrome.runtime.sendMessage({ type: "SCAMLENS_PAGE_INFO", url: location.href, page }, response => {
      if (chrome.runtime.lastError || !response?.result) return;
      renderWarning(response.result);
    });
  }

  scanPage();
  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanPage, 1200);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  chrome.runtime.onMessage.addListener(message => {
    if (message.type === "SCAMLENS_RESULT") renderWarning(message.result);
  });

  function renderWarning(result) {
    document.querySelector("#scamlens-warning")?.remove();
    if (result.score < 30) return;
    const banner = document.createElement("aside");
    banner.id = "scamlens-warning";
    banner.setAttribute("role", "alert");
    banner.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:min(760px,calc(100vw - 24px));display:flex;align-items:center;gap:12px;padding:12px 14px;background:#fff7ed;color:#431407;border:2px solid #fb923c;border-radius:10px;box-shadow:0 8px 24px #0004;font:14px/1.45 -apple-system,BlinkMacSystemFont,'Noto Sans TC',sans-serif";
    banner.innerHTML = `<strong>ScamLens：${result.level}</strong><span>風險 ${result.score}/100｜${result.hits.slice(0, 3).map(hit => hit.reason).join("；")}</span><button type="button">關閉</button>`;
    banner.querySelector("button").style.cssText = "margin-left:auto;flex:none;padding:5px 8px;border:1px solid #9a3412;border-radius:6px;background:#ffedd5;color:#431407;cursor:pointer";
    banner.querySelector("button").addEventListener("click", () => banner.remove());
    document.documentElement.appendChild(banner);
  }
})();
