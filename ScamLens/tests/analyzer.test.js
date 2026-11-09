const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = { console, URL, decodeURIComponent, Map, Math, String, Number, RegExp };
vm.createContext(context);
vm.runInContext(fs.readFileSync("ScamLens/analyzer.js", "utf8"), context);
const analyzer = context.ScamLensAnalyzer;

const homograph = analyzer.analyzeUrl("https://аpple.example/login");
assert.ok(homograph.score >= 60);
assert.match(homograph.hits.map(hit => hit.reason).join(" "), /同形字|文字系統/);

const safeUrl = analyzer.analyzeUrl("https://example.com/about");
assert.equal(safeUrl.score, 0);

const landingPage = analyzer.analyzePage({
  text: "限時優惠，請立即付款並輸入驗證碼",
  ctaCount: 4,
  formCount: 1,
  sensitiveFormCount: 1,
  linkCount: 2,
  hasCountdown: true
});
assert.equal(landingPage.score, 100);
assert.equal(analyzer.riskLevel(landingPage.score), "高風險");

console.log("ScamLens analyzer tests passed");
