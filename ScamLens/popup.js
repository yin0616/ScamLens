const RULES = [
  { regex: /(立即|馬上|限時|最後機會|帳戶.*?(凍結|停用|異常))/i, score: 20, reason: "以緊急字眼製造壓力，催促立即行動" },
  { regex: /(匯款|轉帳|付款|手續費|保證金|代購)/i, score: 20, reason: "出現金流或付款請求" },
  { regex: /(驗證碼|OTP|密碼|身分證|銀行帳號|信用卡)/i, score: 25, reason: "索取敏感個資或帳號驗證資訊" },
  { regex: /(bit\.ly|tinyurl|t\.me|line\.me|[a-z0-9-]+\.(xyz|top|click|shop))/i, score: 15, reason: "偵測到短網址、私訊導流或高風險網域樣式" },
  { regex: /(中獎|免費領取|高報酬|穩賺|投資老師|飆股)/i, score: 15, reason: "以獎勵或高報酬吸引互動" },
  { regex: /(不要告訴|私下聯絡|加好友|客服專員)/i, score: 10, reason: "要求轉往私下或非官方管道聯絡" }
];

function analyze(text) {
  const hits = RULES.filter(rule => rule.regex.test(text));
  const score = Math.min(100, hits.reduce((sum, hit) => sum + hit.score, 0));
  return { score, hits: hits.map(hit => hit.reason) };
}

function level(score) {
  if (score >= 60) return "高風險";
  if (score >= 30) return "中風險";
  return "低風險／資訊不足";
}

const message = document.querySelector('#message');
const result = document.querySelector('#result');
const status = document.querySelector('#status');
const scoreElement = document.querySelector('#score');
const levelElement = document.querySelector('#level');
const signals = document.querySelector('#signals');

function renderPageResult(result) {
  const pageResult = document.querySelector('#page-result');
  if (!result) {
    pageResult.classList.add('hidden');
    return;
  }
  document.querySelector('#page-host').textContent = result.hostname || result.url || '目前頁面';
  const pageScore = document.querySelector('#page-score');
  const pageLevel = document.querySelector('#page-level');
  pageScore.textContent = result.score;
  pageLevel.textContent = result.level;
  pageLevel.dataset.level = result.score >= 60 ? 'high' : result.score >= 30 ? 'medium' : 'low';
  const pageSignals = document.querySelector('#page-signals');
  pageSignals.replaceChildren(...(result.hits.length ? result.hits : [{ reason: '目前沒有命中已知規則。' }]).slice(0, 6).map(hit => {
    const li = document.createElement('li'); li.textContent = hit.reason; return li;
  }));
  pageResult.classList.remove('hidden');
}

async function scanCurrentPage() {
  if (!chrome?.tabs) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/i.test(tab.url || '')) {
    renderPageResult(null);
    status.textContent = '目前頁面不是可掃描的網站。';
    return;
  }
  chrome.runtime.sendMessage({ type: 'SCAMLENS_GET_CURRENT', tabId: tab.id }, response => {
    if (chrome.runtime.lastError) return;
    renderPageResult(response?.result || { url: tab.url, hostname: new URL(tab.url).hostname, score: 0, level: '等待頁面掃描', hits: [] });
  });
}

function renderAnalysis() {
  const text = message.value.trim();
  if (!text) {
    result.classList.add('hidden');
    status.textContent = '請先貼上訊息、網址或貼文內容。';
    message.focus();
    return;
  }

  const { score, hits } = analyze(text);
  scoreElement.textContent = score;
  levelElement.textContent = level(score);
  levelElement.dataset.level = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  document.querySelector('#meter-fill').style.width = `${score}%`;
  signals.replaceChildren(...(hits.length ? hits : ["尚未命中已知規則；請仍以官方管道核實訊息來源。"]).map(item => {
    const li = document.createElement('li'); li.textContent = item; return li;
  }));
  result.classList.remove('hidden');
  status.textContent = `分析完成：命中 ${hits.length} 個訊號。`;
}

document.querySelector('#analyze').addEventListener('click', renderAnalysis);
message.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') renderAnalysis();
});
document.querySelector('#sample').addEventListener('click', () => {
  message.value = '您的帳戶異常即將凍結，請立即點擊 bit.ly/example 驗證身分，並提供驗證碼。';
  renderAnalysis();
});
document.querySelector('#clear').addEventListener('click', () => {
  message.value = '';
  result.classList.add('hidden');
  status.textContent = '已清除輸入與分析結果。';
  message.focus();
});
document.querySelector('#copy').addEventListener('click', async () => {
  const summary = `ScamLens 風險分數：${scoreElement.textContent}/100（${levelElement.textContent}）\n偵測訊號：\n${[...signals.querySelectorAll('li')].map(li => `- ${li.textContent}`).join('\n')}`;
  try {
    await navigator.clipboard.writeText(summary);
    status.textContent = '分析摘要已複製。';
  } catch {
    status.textContent = '瀏覽器不允許複製，請手動選取結果。';
  }
});

document.querySelector('#refresh-page').addEventListener('click', scanCurrentPage);
scanCurrentPage();
