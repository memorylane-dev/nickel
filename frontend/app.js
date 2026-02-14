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
        `<td>${row.date}</td>` +
        `<td>${fmt(row.cash_settlement)}</td>` +
        `<td class="${cls}">${arrow(row.cash_change)} ${row.cash_change != null ? sign + fmt(row.cash_change) : "-"}</td>` +
        `<td class="${cls}">${row.cash_change_pct != null ? sign + row.cash_change_pct + "%" : "-"}</td>` +
        `<td>${fmt(row.three_month)}</td>` +
        `<td>${fmtInt(row.stock)}</td>`;
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

// Init
loadLatest();
loadPrices(1);
