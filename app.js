const TROY_OUNCE_GRAMS = 31.1034768;
const GOLD_REFRESH_MS = 60000;
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
const GOLD_CHART_SOURCE = {
  name: "BiQuote XAUUSD",
  url:
    "https://api.codetabs.com/v1/proxy?quest=" +
    encodeURIComponent("https://biquote.io/api/XAUUSD/ohlc?interval=5m&limit=300"),
  parse: (data) => {
    const bars = Array.isArray(data?.bars) ? data.bars : [];

    return bars
      .map((bar) => ({
        time: new Date(bar.openTime).getTime(),
        price: Number(bar.close),
      }))
      .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.price) && point.price > 0)
      .sort((a, b) => a.time - b.time);
  },
};
const GOLD_PRICE_SOURCES = [
  {
    name: "BiQuote XAUUSD",
    url: "https://biquote.io/api/XAUUSD",
    parse: (data) => {
      const mid = Number(data?.mid);
      if (Number.isFinite(mid) && mid > 0) {
        return mid;
      }

      const bid = Number(data?.bid);
      const ask = Number(data?.ask);
      if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0) {
        return (bid + ask) / 2;
      }

      return data?.price;
    },
  },
  {
    name: "gold-api.com",
    url: "https://api.gold-api.com/price/XAU",
    parse: (data) => data?.price,
  },
  {
    name: "goldprice.org",
    url: "https://data-asg.goldprice.org/dbXRates/USD",
    parse: (data) => data?.items?.[0]?.xauPrice,
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
const quickTableBody = document.querySelector("#quick-table-body");
const quickTableRate = document.querySelector("#quick-table-rate");
const spotUsdPrice = document.querySelector("#spot-usd-price");
const spotCnyPrice = document.querySelector("#spot-cny-price");
const spotPriceStatus = document.querySelector("#spot-price-status");
const spotChartLine = document.querySelector("#spot-chart-line");
const spotChartChange = document.querySelector("#spot-chart-change");
const spotChartMeta = document.querySelector("#spot-chart-meta");
const refreshGoldButton = document.querySelector("#refresh-gold-button");

let exchangeRate = null;
let rateMode = "loading";
let lastCalculatedResult = null;
let spotGoldUsd = null;
let spotGoldSource = "";
let goldChartPoints = [];
let goldChartError = "";

const formatResult = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatRate = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const formatUsd = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 0,
});

directionInputs.forEach((input) => {
  input.addEventListener("change", () => {
    if (Number.isFinite(lastCalculatedResult) && lastCalculatedResult > 0) {
      priceInput.value = lastCalculatedResult.toFixed(2);
    }

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
  updateQuickTable();
  updateSpotGoldDisplay();
});

refreshGoldButton.addEventListener("click", refreshGoldData);

updateLabels();
renderQuickTable();
renderSpotChart();
loadSpotGoldPrice();
loadGoldChart();
loadExchangeRate();
setInterval(loadSpotGoldPrice, GOLD_REFRESH_MS);
setInterval(loadGoldChart, GOLD_REFRESH_MS);

function getDirection() {
  return document.querySelector('input[name="direction"]:checked').value;
}

function updateLabels() {
  const isUsdToCny = getDirection() === "usd-to-cny";

  priceLabel.textContent = isUsdToCny ? "美元计价黄金价格" : "人民币计价黄金价格";
  priceUnit.textContent = isUsdToCny ? "美元/盎司" : "人民币/克";
  resultUnit.textContent = isUsdToCny ? "人民币/克" : "美元/盎司";
  formulaText.textContent = isUsdToCny
    ? "USD/oz × 汇率 ÷ 31.1034768 = CNY/g"
    : "CNY/g × 31.1034768 ÷ 汇率 = USD/oz";
  priceInput.placeholder = isUsdToCny ? "2300.00" : "530.00";
}

async function refreshGoldData() {
  refreshGoldButton.disabled = true;
  refreshGoldButton.dataset.loading = "true";

  await Promise.allSettled([loadSpotGoldPrice(), loadGoldChart()]);

  refreshGoldButton.disabled = false;
  refreshGoldButton.dataset.loading = "false";
}

async function loadExchangeRate() {
  setStatus("待汇率", "idle");
  rateSummary.textContent = "获取 USD/CNY 中";

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
      rateSummary.textContent = `自动 USD/CNY ${formatRate.format(rate)}`;
      setStatus("汇率已更新", "ready");
      calculate();
      updateQuickTable();
      updateSpotGoldDisplay();
      return;
    } catch {
      // Try the next public source before asking for manual input.
    }
  }

  exchangeRate = Number(rateInput.value);
  rateMode = "manual";
  manualRateField.classList.remove("is-hidden");
  rateSummary.textContent = "手动 USD/CNY";
  setStatus("请输入汇率", "error");
  calculate();
  updateQuickTable();
  updateSpotGoldDisplay();
}

async function loadSpotGoldPrice() {
  spotPriceStatus.textContent = "正在获取金价";
  spotPriceStatus.dataset.state = "idle";

  for (const source of GOLD_PRICE_SOURCES) {
    try {
      const response = await fetchWithTimeout(source.url, 8000);
      if (!response.ok) {
        throw new Error(`${source.name} 响应异常`);
      }

      const price = Number(source.parse(await response.json()));
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error(`${source.name} 未返回有效金价`);
      }

      spotGoldUsd = price;
      spotGoldSource = source.name;
      updateSpotGoldDisplay();
      return;
    } catch {
      // Try the next public source if one is configured.
    }
  }

  spotGoldUsd = null;
  spotGoldSource = "";
  updateSpotGoldDisplay();
  spotPriceStatus.textContent = "暂时无法获取金价";
  spotPriceStatus.dataset.state = "error";
}

async function loadGoldChart() {
  try {
    const response = await fetchWithTimeout(GOLD_CHART_SOURCE.url, 15000);
    if (!response.ok) {
      throw new Error(`${GOLD_CHART_SOURCE.name} 响应异常`);
    }

    const points = GOLD_CHART_SOURCE.parse(await response.json());
    if (points.length < 2) {
      throw new Error(`${GOLD_CHART_SOURCE.name} 历史数据不足`);
    }

    goldChartPoints = points;
    goldChartError = "";
    renderSpotChart();
  } catch {
    goldChartPoints = [];
    goldChartError = "数据源暂不可用";
    renderSpotChart("error");
  }
}

function fetchWithTimeout(url, timeoutMs) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("请求超时")), timeoutMs);
  });

  return Promise.race([fetch(url, { cache: "no-store" }), timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function calculate() {
  const price = Number(priceInput.value);
  const rate = rateMode === "manual" ? Number(rateInput.value) : exchangeRate;
  const isUsdToCny = getDirection() === "usd-to-cny";

  if (!priceInput.value) {
    lastCalculatedResult = null;
    setResult("--");
    if (rateMode !== "loading") {
      setStatus(rateMode === "manual" ? "输入价格和汇率" : "输入价格", "idle");
    }
    return;
  }

  if (!Number.isFinite(price) || price <= 0) {
    lastCalculatedResult = null;
    setResult("--");
    setStatus("价格需大于 0", "error");
    return;
  }

  if (!Number.isFinite(rate) || rate <= 0) {
    lastCalculatedResult = null;
    setResult("--");
    setStatus(rateMode === "manual" ? "汇率需大于 0" : "待汇率", "error");
    return;
  }

  const result = isUsdToCny
    ? (price * rate) / TROY_OUNCE_GRAMS
    : (price * TROY_OUNCE_GRAMS) / rate;

  lastCalculatedResult = result;
  setResult(formatResult.format(result));
  setStatus("已换算", "ready");
}

function setResult(value) {
  resultNumber.textContent = value;
}

function setStatus(message, state) {
  statusLine.textContent = message;
  statusLine.dataset.state = state;
}

function renderQuickTable() {
  for (let usdPrice = 4000; usdPrice <= 6000; usdPrice += 100) {
    const row = document.createElement("tr");
    const usdCell = document.createElement("td");
    const cnyCell = document.createElement("td");

    usdCell.textContent = formatUsd.format(usdPrice);
    cnyCell.textContent = "--";
    cnyCell.dataset.usdPrice = String(usdPrice);

    row.append(usdCell, cnyCell);
    quickTableBody.append(row);
  }

  updateQuickTable();
}

function updateQuickTable() {
  const rate = rateMode === "manual" ? Number(rateInput.value) : exchangeRate;
  const hasValidRate = Number.isFinite(rate) && rate > 0;

  quickTableRate.textContent = hasValidRate
    ? `按 1 USD = ${formatRate.format(rate)} CNY`
    : "等待汇率";

  quickTableBody.querySelectorAll("[data-usd-price]").forEach((cell) => {
    if (!hasValidRate) {
      cell.textContent = "--";
      return;
    }

    const usdPrice = Number(cell.dataset.usdPrice);
    const cnyPrice = (usdPrice * rate) / TROY_OUNCE_GRAMS;
    cell.textContent = formatResult.format(cnyPrice);
  });
}

function updateSpotGoldDisplay() {
  const rate = rateMode === "manual" ? Number(rateInput.value) : exchangeRate;
  const hasGoldPrice = Number.isFinite(spotGoldUsd) && spotGoldUsd > 0;
  const hasValidRate = Number.isFinite(rate) && rate > 0;

  spotUsdPrice.textContent = hasGoldPrice ? formatResult.format(spotGoldUsd) : "--";

  if (hasGoldPrice && hasValidRate) {
    const cnyPerGram = (spotGoldUsd * rate) / TROY_OUNCE_GRAMS;
    spotCnyPrice.textContent = formatResult.format(cnyPerGram);
    spotPriceStatus.textContent = `已更新：${spotGoldSource}`;
    spotPriceStatus.dataset.state = "ready";
    return;
  }

  spotCnyPrice.textContent = "--";

  if (hasGoldPrice) {
    spotPriceStatus.textContent = "金价已获取，等待汇率";
    spotPriceStatus.dataset.state = "idle";
  }
}

function renderSpotChart(state = "loading") {
  if (!goldChartPoints.length) {
    spotChartLine.setAttribute("d", "");
    spotChartLine.dataset.trend = "flat";
    spotChartChange.textContent = "--";
    spotChartChange.dataset.trend = "flat";
    spotChartMeta.textContent =
      state === "error"
        ? `暂时无法获取 XAU/USD 现货曲线：${goldChartError}`
        : "正在加载 XAU/USD 现货曲线";
    return;
  }

  const prices = goldChartPoints.map((point) => point.price);
  const firstPrice = prices[0];
  const lastPrice = prices.at(-1);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const xStep = 640 / (goldChartPoints.length - 1);
  const points = goldChartPoints.map((point, index) => {
    const x = index * xStep;
    const y = priceRange === 0 ? 90 : 160 - ((point.price - minPrice) / priceRange) * 140;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  spotChartLine.setAttribute("d", `M ${points.join(" L ")}`);

  const change = lastPrice - firstPrice;
  const changePercent = firstPrice > 0 ? (change / firstPrice) * 100 : 0;
  const trend = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const sign = change > 0 ? "+" : "";

  spotChartLine.dataset.trend = trend;
  spotChartChange.dataset.trend = trend;
  spotChartChange.textContent = `${sign}${formatResult.format(change)} (${sign}${changePercent.toFixed(2)}%)`;
  spotChartMeta.textContent = `XAU/USD 现货，过去 24 小时，${goldChartPoints.length} 个 5 分钟点`;
}
