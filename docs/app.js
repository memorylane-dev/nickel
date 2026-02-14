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
      "<td>" + row.date + "</td>" +
      "<td>" + fmt(row.cash) + "</td>" +
      '<td class="' + cls + '">' + arrow(row.change) + " " +
        (row.change != null ? sign + fmt(row.change) : "-") + "</td>" +
      '<td class="' + cls + '">' +
        (row.change_pct != null ? sign + row.change_pct + "%" : "-") + "</td>" +
      "<td>" + fmt(row.three_month) + "</td>" +
      "<td>" + fmtInt(row.stock) + "</td>";
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

// Load data
fetch("data.json")
  .then(function (res) { return res.json(); })
  .then(function (json) {
    allPrices = json.prices;
    stats = json.stats;
    renderSummary();
    renderPage(1);
  })
  .catch(function (e) {
    console.error("Failed to load data:", e);
    document.getElementById("table-body").innerHTML =
      '<tr><td colspan="6" class="loading">Failed to load data</td></tr>';
  });
