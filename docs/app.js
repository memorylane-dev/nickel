const PER_PAGE = 30;
let currentPage = 1;
let allPrices = [];
let stats = {};

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

function renderSummary() {
  if (allPrices.length === 0) return;
  var d = allPrices[0];

  document.getElementById("latest-price").textContent = "$" + fmt(d.cash);
  document.getElementById("latest-3m").textContent = "$" + fmt(d.three_month);
  document.getElementById("latest-stock").textContent = fmtInt(d.stock) + " t";
  document.getElementById("latest-date").textContent = d.date;

  var changeEl = document.getElementById("latest-change");
  var cls = changeClass(d.change);
  changeEl.className = "card-change " + cls;
  if (d.change != null) {
    var sign = d.change > 0 ? "+" : "";
    changeEl.textContent =
      arrow(d.change) + " " + sign + fmt(d.change) +
      " (" + sign + d.change_pct + "%)";
  }
}

function renderPage(page) {
  currentPage = page;
  var totalPages = Math.ceil(allPrices.length / PER_PAGE);
  var start = (page - 1) * PER_PAGE;
  var end = start + PER_PAGE;
  var pageData = allPrices.slice(start, end);

  var tbody = document.getElementById("table-body");
  tbody.innerHTML = "";

  for (var i = 0; i < pageData.length; i++) {
    var row = pageData[i];
    var cls = changeClass(row.change);
    var sign = row.change > 0 ? "+" : "";
    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td data-label="Date">' + row.date + "</td>" +
      '<td data-label="Cash">' + fmt(row.cash) + "</td>" +
      '<td data-label="Change" class="' + cls + '">' + arrow(row.change) + " " +
        (row.change != null ? sign + fmt(row.change) : "-") + "</td>" +
      '<td data-label="Change %" class="' + cls + '">' +
        (row.change_pct != null ? sign + row.change_pct + "%" : "-") + "</td>" +
      '<td data-label="3-Month">' + fmt(row.three_month) + "</td>" +
      '<td data-label="Stock">' + fmtInt(row.stock) + "</td>";
    tbody.appendChild(tr);
  }

  renderPagination(page, totalPages);
}

function renderPagination(page, totalPages) {
  var nav = document.getElementById("pagination");
  nav.innerHTML = "";

  if (totalPages <= 1) return;

  var prev = document.createElement("button");
  prev.textContent = "\u2190 Prev";
  prev.disabled = page <= 1;
  prev.addEventListener("click", function () { renderPage(page - 1); });
  nav.appendChild(prev);

  var maxButtons = 7;
  var start = Math.max(1, page - Math.floor(maxButtons / 2));
  var end = Math.min(totalPages, start + maxButtons - 1);
  if (end - start < maxButtons - 1) {
    start = Math.max(1, end - maxButtons + 1);
  }

  if (start > 1) {
    nav.appendChild(pageBtn(1, page));
    if (start > 2) {
      var dots = document.createElement("span");
      dots.textContent = "...";
      dots.style.padding = "0 0.3rem";
      nav.appendChild(dots);
    }
  }

  for (var i = start; i <= end; i++) {
    nav.appendChild(pageBtn(i, page));
  }

  if (end < totalPages) {
    if (end < totalPages - 1) {
      var dots = document.createElement("span");
      dots.textContent = "...";
      dots.style.padding = "0 0.3rem";
      nav.appendChild(dots);
    }
    nav.appendChild(pageBtn(totalPages, page));
  }

  var next = document.createElement("button");
  next.textContent = "Next \u2192";
  next.disabled = page >= totalPages;
  next.addEventListener("click", function () { renderPage(page + 1); });
  nav.appendChild(next);
}

function pageBtn(num, current) {
  var btn = document.createElement("button");
  btn.textContent = num;
  if (num === current) btn.classList.add("active");
  btn.addEventListener("click", function () { renderPage(num); });
  return btn;
}

/* ── 30-Day Chart ── */

var priceChart = null;

function linearRegression(ys) {
  var n = ys.length;
  var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (var i = 0; i < n; i++) {
    sumX += i;
    sumY += ys[i];
    sumXY += i * ys[i];
    sumX2 += i * i;
  }
  var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  var intercept = (sumY - slope * sumX) / n;
  return ys.map(function (_, i) {
    return Math.round((intercept + slope * i) * 100) / 100;
  });
}

function bollingerBands(ys, period) {
  var n = ys.length;
  var upper = [], lower = [];
  for (var i = 0; i < n; i++) {
    var start = Math.max(0, i - period + 1);
    var win = ys.slice(start, i + 1);
    var wMean = win.reduce(function (a, b) { return a + b; }, 0) / win.length;
    var wStd = Math.sqrt(
      win.reduce(function (a, v) { return a + (v - wMean) * (v - wMean); }, 0) / win.length
    );
    upper.push(Math.round((wMean + 2 * wStd) * 100) / 100);
    lower.push(Math.round((wMean - 2 * wStd) * 100) / 100);
  }
  return { upper: upper, lower: lower };
}

function renderChart() {
  var rows = allPrices
    .filter(function (r) { return r.cash != null; })
    .slice(0, 30)
    .reverse();
  if (rows.length < 2) return;

  var isMobile = window.matchMedia("(max-width: 700px)").matches;
  var labels = rows.map(function (r) { return r.date.slice(5); });
  var prices = rows.map(function (r) { return r.cash; });
  var trend = linearRegression(prices);
  var bands = bollingerBands(prices, Math.min(20, rows.length));

  var ctx = document.getElementById("price-chart").getContext("2d");
  if (priceChart) priceChart.destroy();

  priceChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Upper Band (+2\u03c3)",
          data: bands.upper,
          borderColor: "rgba(220,38,38,0.25)",
          backgroundColor: "rgba(220,38,38,0.04)",
          borderWidth: 1,
          borderDash: [4, 3],
          pointRadius: 0,
          fill: false,
          order: 3
        },
        {
          label: "Lower Band (-2\u03c3)",
          data: bands.lower,
          borderColor: "rgba(22,163,74,0.25)",
          backgroundColor: "rgba(22,163,74,0.04)",
          borderWidth: 1,
          borderDash: [4, 3],
          pointRadius: 0,
          fill: "-1",
          order: 4
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
          order: 1
        },
        {
          label: "Trend",
          data: trend,
          borderColor: "rgba(245,158,11,0.7)",
          borderWidth: 2,
          borderDash: [8, 4],
          pointRadius: 0,
          fill: false,
          order: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        title: {
          display: true,
          text: "Cash Settlement \u2013 Last 30 Trading Days",
          font: { size: isMobile ? 11 : 14, weight: "600" },
          color: "#333",
          padding: { bottom: isMobile ? 8 : 12 }
        },
        legend: {
          position: isMobile ? "bottom" : "top",
          labels: {
            boxWidth: isMobile ? 10 : 14,
            padding: isMobile ? 10 : 14,
            font: { size: isMobile ? 10 : 11 },
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return c.dataset.label + ": $" + fmt(c.raw);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: isMobile ? 9 : 10 },
            maxRotation: isMobile ? 0 : 45,
            autoSkipPadding: isMobile ? 14 : 8
          }
        },
        y: {
          grid: { color: "rgba(0,0,0,0.06)" },
          ticks: {
            font: { size: isMobile ? 10 : 11 },
            callback: function (v) { return "$" + v.toLocaleString(); }
          }
        }
      }
    }
  });
}

// Load data
fetch("data.json")
  .then(function (res) { return res.json(); })
  .then(function (json) {
    allPrices = json.prices;
    stats = json.stats;
    renderSummary();
    renderChart();
    renderPage(1);
  })
  .catch(function (e) {
    console.error("Failed to load data:", e);
    document.getElementById("table-body").innerHTML =
      '<tr><td colspan="6" class="loading">Failed to load data</td></tr>';
  });
