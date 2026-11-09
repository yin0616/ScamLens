// Shared, local-only analysis helpers. No page text or URL is sent anywhere.
const SCAM_RULES = [
  { regex: /(立即|馬上|限時|最後機會|倒數|帳戶.*?(凍結|停用|異常))/iu, score: 20, reason: "以緊急字眼製造壓力，催促立即行動" },
  { regex: /(匯款|轉帳|付款|手續費|保證金|代購)/iu, score: 20, reason: "出現金流或付款請求" },
  { regex: /(驗證碼|OTP|密碼|身分證|銀行帳號|信用卡)/iu, score: 25, reason: "索取敏感個資或帳號驗證資訊" },
  { regex: /(bit\.ly|tinyurl|t\.me|line\.me|[a-z0-9-]+\.(xyz|top|click|shop))/iu, score: 15, reason: "偵測到短網址、私訊導流或高風險網域樣式" },
  { regex: /(中獎|免費領取|高報酬|穩賺|投資老師|飆股)/iu, score: 15, reason: "以獎勵或高報酬吸引互動" },
  { regex: /(不要告訴|私下聯絡|加好友|客服專員)/iu, score: 10, reason: "要求轉往私下或非官方管道聯絡" }
];

const CONFUSABLES = new Map([
  ["а", "a"], ["е", "e"], ["о", "o"], ["р", "p"], ["с", "c"], ["х", "x"],
  ["і", "i"], ["ј", "j"], ["у", "y"], ["Α", "A"], ["Β", "B"], ["Ε", "E"],
  ["Ι", "I"], ["Κ", "K"], ["Μ", "M"], ["Ν", "N"], ["Ο", "O"], ["Ρ", "P"]
]);

function normalizeConfusables(value) {
  return [...value].map(char => CONFUSABLES.get(char) || char).join("");
}

function analyzeUrl(rawUrl) {
  const hits = [];
  let parsed;
  try { parsed = new URL(rawUrl); } catch { return { score: 0, hits: [], hostname: "" }; }
  const hostname = parsed.hostname.toLowerCase();
  const rawHost = rawUrl.match(/^[a-z][a-z\d+.-]*:\/\/([^\/?#]+)/iu)?.[1]?.split("@").pop()?.split(":")[0];
  const unicodeHostname = decodeURIComponent(rawHost || hostname).toLowerCase();
  const scripts = [
    /[a-z]/i.test(unicodeHostname) && "Latin",
    /[\u0400-\u04ff]/u.test(unicodeHostname) && "Cyrillic",
    /[\u0370-\u03ff]/u.test(unicodeHostname) && "Greek",
    /[\u4e00-\u9fff]/u.test(unicodeHostname) && "Han"
  ].filter(Boolean);

  if (hostname.includes("xn--")) hits.push({ score: 20, reason: "網域使用 Punycode,可能包含國際化同形字" });
  if (scripts.length >= 2) hits.push({ score: 25, reason: `網域混用不同文字系統（${scripts.join("、")}），可能仿冒熟悉名稱` });
  if (/[\u0400-\u04ff\u0370-\u03ff]/u.test(unicodeHostname) && normalizeConfusables(unicodeHostname) !== unicodeHostname) {
    hits.push({ score: 25, reason: "網域含有外觀近似英文字母的希臘或西里爾字母" });
  }
  if (/^(www\.)?[a-z0-9-]+\.(xyz|top|click|shop|support|live)$/iu.test(hostname)) {
    hits.push({ score: 15, reason: "網域使用較常見於短期導流的高風險網域樣式" });
  }
  if (/(bit\.ly|tinyurl\.com|t\.me|line\.me)/iu.test(hostname)) {
    hits.push({ score: 15, reason: "網址使用短網址或私訊導流服務" });
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    hits.push({ score: 10, reason: "網站未使用 HTTPS 加密連線" });
  }
  return { score: Math.min(100, hits.reduce((sum, hit) => sum + hit.score, 0)), hits, hostname };
}

function analyzeText(text) {
  const hits = SCAM_RULES.filter(rule => rule.regex.test(text));
  return {
    score: Math.min(100, hits.reduce((sum, hit) => sum + hit.score, 0)),
    hits: hits.map(({ score, reason }) => ({ score, reason }))
  };
}

function analyzePage(page = {}) {
  const text = String(page.text || "");
  const hits = [];
  const textResult = analyzeText(text);
  hits.push(...textResult.hits);
  const ctaCount = Number(page.ctaCount || 0);
  const formCount = Number(page.formCount || 0);
  const sensitiveFormCount = Number(page.sensitiveFormCount || 0);
  const linkCount = Number(page.linkCount || 0);
  const shortPage = text.length > 80 && text.length < 1800;

  if (sensitiveFormCount > 0) hits.push({ score: 25, reason: "頁面含有可能收集密碼、付款或驗證資訊的表單" });
  if (shortPage && ctaCount >= 3 && linkCount <= 8) hits.push({ score: 15, reason: "頁面文字較少卻有多個催促行動按鈕，符合一頁式導流特徵" });
  if (formCount > 0 && ctaCount >= 2 && linkCount <= 5) hits.push({ score: 10, reason: "頁面導覽很少但集中要求使用者填寫或送出資料" });
  if (page.hasCountdown) hits.push({ score: 15, reason: "頁面含有倒數或限時優惠元素，可能用來製造急迫感" });
  return { score: Math.min(100, hits.reduce((sum, hit) => sum + hit.score, 0)), hits };
}

function riskLevel(score) {
  if (score >= 60) return "高風險";
  if (score >= 30) return "中風險";
  return "低風險／資訊不足";
}

if (typeof globalThis !== "undefined") {
  globalThis.ScamLensAnalyzer = { analyzeUrl, analyzeText, analyzePage, riskLevel };
}
