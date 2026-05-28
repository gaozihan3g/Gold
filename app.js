const TROY_OUNCE_GRAMS = 31.1034768;
const RATE_SOURCES = [
  {
    name: "open.er-api.com",
    url: "https://open.er-api.com/v6/latest/USD",
    parse: (data) => data?.rates?.CNY,
  },
  {
    name: "frankfurter.app",
    url: "https://api.frankfurter.app/latest?from=USD&to=CNY",
    parse: (data) => data?.rates?.CNY,
  },
];

const priceInput = document.querySelector("#price-input");
const rateInput = document.querySelector("#rate-input");
const manualRateField = document.querySelector("#manual-rate-field");
const directionInputs = document.querySelectorAll('input[name="direction"]');
const priceLabel = document.querySelector("#price-label");
const priceUnit = document.querySelector("#price-unit");
const resultNumber = document.querySelector("#result-number");
const resultUnit = document.querySelector("#result-unit");
const formulaText = document.querySelector("#formula-text");
const rateSummary = document.querySelector("#rate-summary");
const statusLine = document.querySelector("#status-line");

let exchangeRate = null;
let rateMode = "loading";

const formatResult = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatRate = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

directionInputs.forEach((input) => {
  input.addEventListener("change", () => {
    updateLabels();
    calculate();
  });
});

priceInput.addEventListener("input", calculate);
rateInput.addEventListener("input", () => {
  if (rateMode === "manual") {
    exchangeRate = Number(rateInput.value);
  }
  calculate();
});

updateLabels();
loadExchangeRate();

function getDirection() {
  return document.querySelector('input[name="direction"]:checked').value;
}

function updateLabels() {
  const isUsdToCny = getDirection() === "usd-to-cny";

  priceLabel.textContent = isUsdToCny ? "美元计价黄金价格" : "人民币计价黄金价格";
  priceUnit.textContent = isUsdToCny ? "美元/盎司" : "人民币/克";
  resultUnit.textContent = isUsdToCny ? "人民币/克" : "美元/盎司";
  formulaText.textContent = isUsdToCny
    ? "人民币/克 = 美元/盎司 × 汇率 ÷ 31.1034768"
    : "美元/盎司 = 人民币/克 × 31.1034768 ÷ 汇率";
  priceInput.placeholder = isUsdToCny ? "2300.00" : "530.00";
}

async function loadExchangeRate() {
  setStatus("正在获取自动汇率", "idle");
  rateSummary.textContent = "正在获取 USD/CNY 汇率";

  for (const source of RATE_SOURCES) {
    try {
      const response = await fetch(source.url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`${source.name} 响应异常`);
      }

      const rate = Number(source.parse(await response.json()));
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error(`${source.name} 未返回有效汇率`);
      }

      exchangeRate = rate;
      rateMode = "auto";
      manualRateField.classList.add("is-hidden");
      rateSummary.textContent = `自动汇率：1 USD = ${formatRate.format(rate)} CNY`;
      setStatus("自动汇率已获取", "ready");
      calculate();
      return;
    } catch {
      // Try the next public source before asking for manual input.
    }
  }

  exchangeRate = Number(rateInput.value);
  rateMode = "manual";
  manualRateField.classList.remove("is-hidden");
  rateSummary.textContent = "自动汇率暂不可用，请手动输入 USD/CNY";
  setStatus("无法自动获取汇率，请手动输入", "error");
  calculate();
}

function calculate() {
  const price = Number(priceInput.value);
  const rate = rateMode === "manual" ? Number(rateInput.value) : exchangeRate;
  const isUsdToCny = getDirection() === "usd-to-cny";

  if (!priceInput.value) {
    setResult("--");
    if (rateMode !== "loading") {
      setStatus(rateMode === "manual" ? "请输入价格和汇率" : "请输入黄金价格", "idle");
    }
    return;
  }

  if (!Number.isFinite(price) || price <= 0) {
    setResult("--");
    setStatus("黄金价格必须大于 0", "error");
    return;
  }

  if (!Number.isFinite(rate) || rate <= 0) {
    setResult("--");
    setStatus(rateMode === "manual" ? "美元兑人民币汇率必须大于 0" : "正在等待自动汇率", "error");
    return;
  }

  const result = isUsdToCny
    ? (price * rate) / TROY_OUNCE_GRAMS
    : (price * TROY_OUNCE_GRAMS) / rate;

  setResult(formatResult.format(result));
  setStatus("已完成实时换算", "ready");
}

function setResult(value) {
  resultNumber.textContent = value;
}

function setStatus(message, state) {
  statusLine.textContent = message;
  statusLine.dataset.state = state;
}
