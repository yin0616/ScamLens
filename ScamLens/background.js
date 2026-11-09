importScripts("analyzer.js");

const pageResults = new Map();

function analyzeTab(tabId, url, page = {}) {
  const urlResult = ScamLensAnalyzer.analyzeUrl(url || "");
  const pageResult = ScamLensAnalyzer.analyzePage(page);
  const combined = {
    url,
    hostname: urlResult.hostname,
    score: Math.min(100, urlResult.score + pageResult.score),
    level: ScamLensAnalyzer.riskLevel(Math.min(100, urlResult.score + pageResult.score)),
    hits: [...urlResult.hits, ...pageResult.hits],
    updatedAt: Date.now()
  };
  pageResults.set(tabId, combined);
  chrome.tabs.sendMessage(tabId, { type: "SCAMLENS_RESULT", result: combined }).catch(() => {});
  return combined;
}

chrome.tabs.onRemoved.addListener(tabId => pageResults.delete(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" && tab.url) pageResults.delete(tabId);
  if (changeInfo.status === "complete" && tab.url) analyzeTab(tabId, tab.url);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCAMLENS_PAGE_INFO" && sender.tab?.id != null) {
    const result = analyzeTab(sender.tab.id, sender.tab.url || message.url, message.page);
    sendResponse({ ok: true, result });
    return true;
  }
  if (message.type === "SCAMLENS_GET_CURRENT" && message.tabId != null) {
    sendResponse({ result: pageResults.get(message.tabId) || null });
    return true;
  }
});
