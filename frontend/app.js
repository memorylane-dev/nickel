const PER_PAGE = 30;
let currentPage = 1;

function fmt(n) {
  if (n == null) return "-";
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtInt(n) {
  if (n == null) return "-";
  return Number(n).toLocaleString("en-US");
}

function changeClass(val) {
  if (val == null) return "flat";
  return val > 0 ? "up" : val < 0 ? "down" : "flat";
}

function arrow(val) {
  if (val == null) return "-";
  if (val > 0) return "\u25b2";
  if (val < 0) return "\u25bc";
  return "-";
}

async function loadLatest() {
  try {
    const res = await fetch("/api/prices/latest");
    const d = await res.json();
    if (!d) return;

    document.getElementById("latest-price").textContent =
      "$" + fmt(d.cash_settlement);
    document.getElementById("latest-3m").textContent =
      "$" + fmt(d.three_month);
    document.getElementById("latest-stock").textContent =
      fmtInt(d.stock) + " t";
    document.getElementById("latest-date").textContent = d.date;

    const changeEl = document.getElementById("latest-change");
    const cls = changeClass(d.cash_change);
    changeEl.className = "card-change " + cls;
    if (d.cash_change != null) {
      const sign = d.cash_change > 0 ? "+" : "";
      changeEl.textContent =
        arrow(d.cash_change) +
        " " +
        sign +
        fmt(d.cash_change) +
        " (" +
        sign +
        d.cash_change_pct +
        "%)";
    }
  } catch (e) {
    console.error("Failed to load latest:", e);
  }
}

async function loadPrices(page) {
  currentPage = page;
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading...</td></tr>';

  try {
    const res = await fetch(
      `/api/prices?page=${page}&per_page=${PER_PAGE}`
    );
    const json = await res.json();

    tbody.innerHTML = "";
    for (const row of json.data) {
      const cls = changeClass(row.cash_change);
      const sign = row.cash_change > 0 ? "+" : "";
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td data-label="Date">${row.date}</td>` +
        `<td data-label="Cash">${fmt(row.cash_settlement)}</td>` +
        `<td data-label="Change" class="${cls}">${arrow(row.cash_change)} ${row.cash_change != null ? sign + fmt(row.cash_change) : "-"}</td>` +
        `<td data-label="Change %" class="${cls}">${row.cash_change_pct != null ? sign + row.cash_change_pct + "%" : "-"}</td>` +
        `<td data-label="3-Month">${fmt(row.three_month)}</td>` +
        `<td data-label="Stock">${fmtInt(row.stock)}</td>`;
      tbody.appendChild(tr);
    }

    renderPagination(json.page, json.total_pages);
  } catch (e) {
    console.error("Failed to load prices:", e);
    tbody.innerHTML =
      '<tr><td colspan="6" class="loading">Failed to load data</td></tr>';
  }
}

function renderPagination(page, totalPages) {
  const nav = document.getElementById("pagination");
  nav.innerHTML = "";

  if (totalPages <= 1) return;

  const prev = document.createElement("button");
  prev.textContent = "\u2190 Prev";
  prev.disabled = page <= 1;
  prev.addEventListener("click", () => loadPrices(page - 1));
  nav.appendChild(prev);

  const maxButtons = 7;
  let start = Math.max(1, page - Math.floor(maxButtons / 2));
  let end = Math.min(totalPages, start + maxButtons - 1);
  if (end - start < maxButtons - 1) {
    start = Math.max(1, end - maxButtons + 1);
  }

  if (start > 1) {
    nav.appendChild(pageBtn(1, page));
    if (start > 2) {
      const dots = document.createElement("span");
      dots.textContent = "...";
      dots.style.padding = "0 0.3rem";
      nav.appendChild(dots);
    }
  }

  for (let i = start; i <= end; i++) {
    nav.appendChild(pageBtn(i, page));
  }

  if (end < totalPages) {
    if (end < totalPages - 1) {
      const dots = document.createElement("span");
      dots.textContent = "...";
      dots.style.padding = "0 0.3rem";
      nav.appendChild(dots);
    }
    nav.appendChild(pageBtn(totalPages, page));
  }

  const next = document.createElement("button");
  next.textContent = "Next \u2192";
  next.disabled = page >= totalPages;
  next.addEventListener("click", () => loadPrices(page + 1));
  nav.appendChild(next);
}

function pageBtn(num, current) {
  const btn = document.createElement("button");
  btn.textContent = num;
  if (num === current) btn.classList.add("active");
  btn.addEventListener("click", () => loadPrices(num));
  return btn;
}

/* ── 30-Day Chart ── */

let priceChart = null;

function linearRegression(ys) {
  const n = ys.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += ys[i];
    sumXY += i * ys[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return ys.map((_, i) => Math.round((intercept + slope * i) * 100) / 100);
}

function bollingerBands(ys, period) {
  const n = ys.length;
  const mean = ys.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(ys.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
  const upper = [], lower = [];
  // Rolling window (or full-period if fewer points)
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - period + 1);
    const window = ys.slice(start, i + 1);
    const wMean = window.reduce((a, b) => a + b, 0) / window.length;
    const wStd = Math.sqrt(window.reduce((a, v) => a + (v - wMean) ** 2, 0) / window.length);
    upper.push(Math.round((wMean + 2 * wStd) * 100) / 100);
    lower.push(Math.round((wMean - 2 * wStd) * 100) / 100);
  }
  return { upper, lower };
}

async function loadChart() {
  try {
    const res = await fetch("/api/prices?page=1&per_page=30");
    const json = await res.json();
    const rows = json.data.filter(r => r.cash_settlement != null).reverse();
    if (rows.length < 2) return;
    const isMobile = window.matchMedia("(max-width: 700px)").matches;

    const labels = rows.map(r => r.date.slice(5)); // MM-DD
    const prices = rows.map(r => r.cash_settlement);
    const trend = linearRegression(prices);
    const bands = bollingerBands(prices, Math.min(20, rows.length));

    const ctx = document.getElementById("price-chart").getContext("2d");

    if (priceChart) priceChart.destroy();

    priceChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Upper Band (+2σ)",
            data: bands.upper,
            borderColor: "rgba(220,38,38,0.25)",
            backgroundColor: "rgba(220,38,38,0.04)",
            borderWidth: 1,
            borderDash: [4, 3],
            pointRadius: 0,
            fill: false,
            order: 3,
          },
          {
            label: "Lower Band (-2σ)",
            data: bands.lower,
            borderColor: "rgba(22,163,74,0.25)",
            backgroundColor: "rgba(22,163,74,0.04)",
            borderWidth: 1,
            borderDash: [4, 3],
            pointRadius: 0,
            fill: "-1",          // fill between upper and lower
            order: 4,
          },
          {
            label: "Cash Settlement",
            data: prices,
            borderColor: "#2563eb",
            backgroundColor: "rgba(37,99,235,0.08)",
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: "#2563eb",
            fill: false,
            tension: 0.15,
            order: 1,
          },
          {
            label: "Trend",
            data: trend,
            borderColor: "rgba(245,158,11,0.7)",
            borderWidth: 2,
            borderDash: [8, 4],
            pointRadius: 0,
            fill: false,
            order: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: "Cash Settlement – Last 30 Trading Days",
            font: { size: isMobile ? 11 : 14, weight: "600" },
            color: "#333",
            padding: { bottom: isMobile ? 8 : 12 },
          },
          legend: {
            position: isMobile ? "bottom" : "top",
            labels: {
              boxWidth: isMobile ? 10 : 14,
              padding: isMobile ? 10 : 14,
              font: { size: isMobile ? 10 : 11 },
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ": $" + fmt(ctx.raw);
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: isMobile ? 9 : 10 },
              maxRotation: isMobile ? 0 : 45,
              autoSkipPadding: isMobile ? 14 : 8,
            },
          },
          y: {
            grid: { color: "rgba(0,0,0,0.06)" },
            ticks: {
              font: { size: isMobile ? 10 : 11 },
              callback: function (v) { return "$" + v.toLocaleString(); },
            },
          },
        },
      },
    });
  } catch (e) {
    console.error("Failed to load chart:", e);
  }
}

// Init
loadLatest();
loadChart();
loadPrices(1);
