(function () {
  const data = window.STP_DATA || {};
  const plants = data.plants || [];
  const flags = data.flags || [];
  const summary = data.summary || [];
  const coordinates = data.coordinates || [];

  const $ = (id) => document.getElementById(id);
  const text = (value) => (value == null || value === "" ? "Not disclosed in report" : String(value));
  const escapeHtml = (value) =>
    text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  const number = (value) => {
    const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const exactSummary = (needle) => summary.find((row) => row.metric && row.metric.includes(needle))?.value || "";
  const exactNote = () => summary.find((row) => row.summary_id === "summary_note_01")?.value || "";
  const splitFlags = (plant) => (plant.flag_types || "").split("|").filter(Boolean);
  const statusClass = (status) => {
    if (/over/i.test(status)) return "overloaded";
    if (/under/i.test(status)) return "underutilised";
    if (/full/i.test(status)) return "full";
    return "";
  };
  const accentFor = (status) => {
    if (/over/i.test(status)) return "var(--rust)";
    if (/under/i.test(status)) return "var(--gold)";
    if (/full/i.test(status)) return "var(--green)";
    return "var(--teal)";
  };
  const metricNumber = (summaryText) => number(summaryText) || 0;

  function renderSourceNote() {
    const el = $("stpSourceNote");
    if (!el) return;
    el.innerHTML = `<strong>Source:</strong> ${escapeHtml(plants[0]?.source_docx || "Uploaded RTI report")} <br>${escapeHtml(exactNote())}`;
  }

  function initResearchNavigation() {
    const hub = $("researchHub");
    const categoryView = $("researchCategoryView");
    const project = $("delhi-stp-research");
    const categoryPanels = Array.from(document.querySelectorAll("[data-research-category]"));
    const showHub = () => {
      if (hub) hub.hidden = false;
      if (categoryView) categoryView.hidden = true;
      if (project) project.hidden = true;
    };
    const showCategory = (category) => {
      if (hub) hub.hidden = true;
      if (project) project.hidden = true;
      if (categoryView) categoryView.hidden = false;
      categoryPanels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.researchCategory === category));
    };
    document.querySelectorAll("[data-open-research]").forEach((button) => {
      button.addEventListener("click", () => showCategory(button.dataset.openResearch));
    });
    $("researchBack")?.addEventListener("click", showHub);
    $("openStpProject")?.addEventListener("click", () => {
      if (hub) hub.hidden = true;
      if (categoryView) categoryView.hidden = true;
      if (project) project.hidden = false;
      project.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("stpProjectBack")?.addEventListener("click", () => showCategory("delhi"));
  }

  function metricCard(label, value, note, accent = "var(--teal)") {
    return `
      <article class="stp-metric-card" style="--card-accent:${accent}">
        <span class="stp-metric-label">${escapeHtml(label)}</span>
        <strong class="stp-metric-value">${escapeHtml(value)}</strong>
        <p class="stp-metric-note">${escapeHtml(note)}</p>
      </article>
    `;
  }

  function renderExecutiveMetrics() {
    const el = $("stpExecutiveMetrics");
    if (!el) return;
    el.innerHTML = [
      metricCard("Total STPs", exactSummary("Total STPs identified"), "Plant-level records extracted from the report.", "var(--teal)"),
      metricCard("Installed Capacity", exactSummary("Total Installed Capacity"), "Aggregate capacity as recorded in the report.", "var(--gold)"),
      metricCard("Utilised Capacity", exactSummary("Total Utilised Capacity"), "Aggregate utilised capacity as recorded in the report.", "var(--green)"),
      metricCard("Overall Utilisation", exactSummary("Overall Utilisation Rate"), "Report-level utilisation rate.", "var(--blue)"),
      metricCard("Overloaded Plants", exactSummary("STPs overloaded"), "Summary classification from the report.", "var(--rust)"),
      metricCard("Underutilised Plants", exactSummary("STPs underutilised"), "Summary classification from the report.", "var(--violet)"),
    ].join("");
  }

  function renderDistribution() {
    const el = $("stpUtilisationDistribution");
    if (!el) return;
    const total = metricNumber(exactSummary("Total STPs identified"));
    const rows = [
      ["Fully utilised", exactSummary("STPs at 100% utilisation"), "var(--green)"],
      ["Underutilised", exactSummary("STPs underutilised"), "var(--gold)"],
      ["Overloaded", exactSummary("STPs overloaded"), "var(--rust)"],
    ];
    el.innerHTML = `<div class="stp-bars">${rows
      .map(([label, value, accent]) => {
        const count = metricNumber(value);
        const width = total ? Math.min(100, (count / total) * 100) : 0;
        return `
          <div class="stp-bar-row">
            <div class="stp-bar-top"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
            <div class="stp-bar-track"><div class="stp-bar-fill" style="--bar-width:${width}%;--bar-accent:${accent}"></div></div>
          </div>
        `;
      })
      .join("")}</div>`;
  }

  function rankedPlants(filterStatus, sortDirection) {
    return plants
      .filter((plant) => plant.utilisation_status === filterStatus)
      .sort((a, b) => {
        const left = number(a.rate_percent_max) ?? number(a.rate_percent_min) ?? 0;
        const right = number(b.rate_percent_max) ?? number(b.rate_percent_min) ?? 0;
        return sortDirection === "desc" ? right - left : left - right;
      })
      .slice(0, 8);
  }

  function renderRankedList(id, rows) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = `<div class="stp-ranked-list">${rows
      .map(
        (plant, index) => `
          <div class="stp-ranked-item">
            <div class="stp-ranked-main">
              <span>${index + 1}. ${escapeHtml(plant.stp_name)}</span>
              <strong>${escapeHtml(plant.rate_percent_raw)}</strong>
            </div>
            <div class="stp-ranked-meta">Capacity ${escapeHtml(plant.installed_mgd_raw)} | Utilised ${escapeHtml(plant.utilised_mgd_raw)}</div>
          </div>
        `
      )
      .join("")}</div>`;
  }

  function renderScatter() {
    const el = $("stpScatterPlot");
    if (!el) return;
    const rows = plants.filter((plant) => number(plant.capital_cost_number_raw) != null && number(plant.rate_percent_max) != null);
    if (!rows.length) {
      el.innerHTML = "<p class='stp-card-note'>No capital cost values disclosed for scatter plotting.</p>";
      return;
    }
    const maxCost = Math.max(...rows.map((plant) => number(plant.capital_cost_number_raw) || 0));
    const maxRate = Math.max(120, ...rows.map((plant) => number(plant.rate_percent_max) || 0));
    const points = rows
      .map((plant) => {
        const cost = number(plant.capital_cost_number_raw) || 0;
        const rate = number(plant.rate_percent_max) || 0;
        const x = 70 + (cost / maxCost) * 760;
        const y = 330 - (rate / maxRate) * 270;
        return `
          <circle class="stp-scatter-point" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="6" style="fill:${accentFor(plant.utilisation_status)}">
            <title>${escapeHtml(plant.stp_name)} | Capital: ${escapeHtml(plant.capital_cost_raw)} | Utilisation: ${escapeHtml(plant.rate_percent_raw)}</title>
          </circle>
        `;
      })
      .join("");
    el.innerHTML = `
      <div class="stp-scatter">
        <svg viewBox="0 0 900 380" role="img" aria-label="Capital cost vs utilisation scatter plot">
          <line x1="70" y1="330" x2="850" y2="330" stroke="rgba(244,239,229,.28)" />
          <line x1="70" y1="40" x2="70" y2="330" stroke="rgba(244,239,229,.28)" />
          <line x1="70" y1="${(330 - (100 / maxRate) * 270).toFixed(2)}" x2="850" y2="${(330 - (100 / maxRate) * 270).toFixed(2)}" stroke="rgba(214,161,74,.48)" stroke-dasharray="6 8" />
          <text x="70" y="364" fill="rgba(244,239,229,.62)" font-size="13">Capital cost disclosed in report</text>
          <text x="14" y="48" fill="rgba(244,239,229,.62)" font-size="13">Utilisation %</text>
          <text x="760" y="364" fill="rgba(244,239,229,.5)" font-size="12">Rs ${escapeHtml(maxCost)} Cr</text>
          <text x="28" y="${(330 - (100 / maxRate) * 270).toFixed(2)}" fill="rgba(214,161,74,.8)" font-size="12">100%</text>
          ${points}
        </svg>
      </div>
      <p class="stp-card-note">Only plants with disclosed capital cost values are plotted. Point tooltips preserve the report's raw values.</p>
    `;
  }

  function flagMatches(term) {
    const lower = term.toLowerCase();
    return flags.filter((flag) => `${flag.flag} ${flag.issue} ${flag.implication}`.toLowerCase().includes(lower));
  }

  function renderGovernanceFlagCards() {
    const el = $("stpGovernanceFlagCards");
    if (!el) return;
    const groups = [
      ["Data Withheld", "withheld", "var(--rust)"],
      ["Dual-Zone Conflicts", "dual-zone", "var(--gold)"],
      ["O&M Anomalies", "o&m", "var(--blue)"],
      ["Underperforming New Plants", "new", "var(--violet)"],
      ["Rehabilitation Cases", "rehabilitation", "var(--green)"],
    ];
    el.innerHTML = groups
      .map(([title, term, accent]) => {
        const matches = flagMatches(term);
        const excerpt = matches[0]?.issue || matches[0]?.implication || "No separate governance flag recorded under this exact category.";
        return `
          <article class="stp-flag-card" style="--card-accent:${accent}">
            <span class="stp-card-label">${escapeHtml(title)}</span>
            <strong class="stp-metric-value">${matches.length}</strong>
            <p>${escapeHtml(excerpt)}</p>
          </article>
        `;
      })
      .join("");
  }

  function renderNarrative() {
    const el = $("stpResearchNarrative");
    if (!el) return;
    const chosen = [
      flags.find((flag) => /withheld|bulky|voluminous/i.test(`${flag.issue} ${flag.implication}`)),
      flags.find((flag) => /dual-zone/i.test(`${flag.flag} ${flag.issue}`)),
      flags.find((flag) => /new plant|brand new/i.test(`${flag.issue} ${flag.implication}`)),
      flags.find((flag) => /budget|spike|o&m/i.test(`${flag.issue} ${flag.implication}`)),
    ].filter(Boolean);
    el.innerHTML = `
      <div class="stp-flag-card-grid">
        ${chosen
          .map(
            (flag) => `
              <article class="stp-flag-card">
                <span class="stp-card-label">${escapeHtml(flag.flag)}</span>
                <h4>${escapeHtml(flag.division_stp)}</h4>
                <p>${escapeHtml(flag.issue)}</p>
                <p>${escapeHtml(flag.implication)}</p>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  function coordinateFor(plant, index) {
    const row = coordinates.find((coord) => coord.plant_id === plant.plant_id) || {};
    const lat = number(row.latitude);
    const lon = number(row.longitude);
    const geocoded = coordinates
      .map((coord) => ({ lat: number(coord.latitude), lon: number(coord.longitude) }))
      .filter((coord) => coord.lat != null && coord.lon != null);
    let x = number(row.placeholder_x_percent) ?? 18 + (index % 6) * 12.5;
    let y = number(row.placeholder_y_percent) ?? 18 + Math.floor(index / 6) * 12.5;
    if (lat != null && lon != null && geocoded.length) {
      const minLat = Math.min(...geocoded.map((coord) => coord.lat));
      const maxLat = Math.max(...geocoded.map((coord) => coord.lat));
      const minLon = Math.min(...geocoded.map((coord) => coord.lon));
      const maxLon = Math.max(...geocoded.map((coord) => coord.lon));
      x = 12 + ((lon - minLon) / Math.max(0.001, maxLon - minLon)) * 76;
      y = 12 + ((maxLat - lat) / Math.max(0.001, maxLat - minLat)) * 76;
    }
    return { x, y, lat, lon, status: row.coordinate_status || "Geocoded" };
  }

  function detailHtml(plant) {
    const plantFlags = splitFlags(plant);
    const coord = coordinateFor(plant, 0);
    const mapsUrl = coord.lat != null && coord.lon != null ? `https://www.google.com/maps/search/?api=1&query=${coord.lat},${coord.lon}` : "";
    return `
      <span class="stp-pill ${statusClass(plant.utilisation_status)}">${escapeHtml(plant.utilisation_status)}</span>
      <h4>${escapeHtml(plant.stp_name)}</h4>
      <div class="stp-detail-list">
        <div class="stp-detail-row"><span>Capacity</span><strong>${escapeHtml(plant.installed_mgd_raw)}</strong></div>
        <div class="stp-detail-row"><span>Utilisation</span><strong>${escapeHtml(plant.utilised_mgd_raw)} (${escapeHtml(plant.rate_percent_raw)})</strong></div>
        <div class="stp-detail-row"><span>O&M</span><strong>${escapeHtml(plant.om_expenditure_raw)}</strong></div>
        <div class="stp-detail-row"><span>Capital Cost</span><strong>${escapeHtml(plant.capital_cost_raw)}</strong></div>
        <div class="stp-detail-row"><span>Division</span><strong>${escapeHtml(plant.division)}</strong></div>
        <div class="stp-detail-row"><span>Ownership</span><strong>${escapeHtml(plant.ownership_note)}</strong></div>
        <div class="stp-detail-row"><span>Remarks</span><strong>${escapeHtml(plant.anomaly_remarks_raw)}</strong></div>
      </div>
      <div class="stp-chip-row">${plantFlags.map((flag) => `<span class="stp-pill">${escapeHtml(flag)}</span>`).join("")}</div>
      ${mapsUrl ? `<a class="stp-map-link" href="${mapsUrl}" target="_blank" rel="noopener">Open in Google Maps</a>` : ""}
    `;
  }

  function renderMap() {
    const map = $("stpMap");
    const detail = $("stpMapDetail");
    if (!map || !detail) return;
    map.innerHTML = `<div class="stp-map-outline" aria-hidden="true"></div><div class="stp-map-note">Coordinate-backed map display. Marker links open Google Maps for location review.</div>`;
    plants.forEach((plant, index) => {
      const coord = coordinateFor(plant, index);
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = "stp-map-marker";
      marker.style.left = `${coord.x}%`;
      marker.style.top = `${coord.y}%`;
      marker.style.setProperty("--marker-color", accentFor(plant.utilisation_status));
      marker.setAttribute("aria-label", plant.stp_name);
      marker.title = `${plant.stp_name} | ${plant.rate_percent_raw}`;
      marker.addEventListener("click", () => {
        map.querySelectorAll(".stp-map-marker").forEach((item) => item.classList.remove("is-active"));
        marker.classList.add("is-active");
        detail.innerHTML = detailHtml(plant);
      });
      map.appendChild(marker);
      if (index === 0) marker.click();
    });
  }

  const tableState = { sortKey: "stp_name", sortDir: "asc" };

  function populateSelect(id, label, values) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = [`<option value="">${escapeHtml(label)}</option>`, ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)].join("");
  }

  function setupFilters() {
    populateSelect("stpDivisionFilter", "All divisions", [...new Set(plants.map((p) => p.division).filter(Boolean))].sort());
    populateSelect("stpUtilisationFilter", "All utilisation", [...new Set(plants.map((p) => p.utilisation_status).filter(Boolean))].sort());
    populateSelect("stpCapacityFilter", "All capacities", ["<=5 MGD", "5-20 MGD", "20+ MGD"]);
    populateSelect("stpOwnershipFilter", "All ownership notes", [...new Set(plants.map((p) => p.ownership_note).filter(Boolean))].sort());
    populateSelect("stpFlagFilter", "All flags", [...new Set(plants.flatMap(splitFlags))].sort());
    ["stpSearch", "stpDivisionFilter", "stpUtilisationFilter", "stpCapacityFilter", "stpOwnershipFilter", "stpFlagFilter"].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener("input", renderPlantTable);
    });
  }

  function capacityBucket(plant) {
    const cap = number(plant.installed_mgd_number);
    if (cap == null) return "";
    if (cap <= 5) return "<=5 MGD";
    if (cap <= 20) return "5-20 MGD";
    return "20+ MGD";
  }

  function filteredPlants() {
    const search = ($("stpSearch")?.value || "").toLowerCase();
    const division = $("stpDivisionFilter")?.value || "";
    const status = $("stpUtilisationFilter")?.value || "";
    const capacity = $("stpCapacityFilter")?.value || "";
    const ownership = $("stpOwnershipFilter")?.value || "";
    const flag = $("stpFlagFilter")?.value || "";
    return plants
      .filter((plant) => !search || plant.stp_name.toLowerCase().includes(search))
      .filter((plant) => !division || plant.division === division)
      .filter((plant) => !status || plant.utilisation_status === status)
      .filter((plant) => !capacity || capacityBucket(plant) === capacity)
      .filter((plant) => !ownership || plant.ownership_note === ownership)
      .filter((plant) => !flag || splitFlags(plant).includes(flag))
      .sort((a, b) => {
        const left = a[tableState.sortKey] || "";
        const right = b[tableState.sortKey] || "";
        const numericLeft = number(left);
        const numericRight = number(right);
        const result =
          numericLeft != null && numericRight != null
            ? numericLeft - numericRight
            : String(left).localeCompare(String(right));
        return tableState.sortDir === "asc" ? result : -result;
      });
  }

  function renderPlantTable() {
    const el = $("stpPlantTable");
    if (!el) return;
    const headers = [
      ["stp_name", "Plant"],
      ["division", "Division"],
      ["installed_mgd_number", "Capacity"],
      ["utilised_mgd_raw", "Utilised"],
      ["rate_percent_max", "Rate"],
      ["utilisation_status", "Status"],
      ["om_disclosure_status", "RTI Disclosure"],
      ["capital_cost_raw", "Capital Cost"],
      ["flag_types", "Flags"],
    ];
    el.innerHTML = `
      <thead><tr>${headers
        .map(([key, label]) => `<th data-sort="${key}">${escapeHtml(label)}${tableState.sortKey === key ? (tableState.sortDir === "asc" ? " ↑" : " ↓") : ""}</th>`)
        .join("")}</tr></thead>
      <tbody>${filteredPlants()
        .map(
          (plant) => `
            <tr>
              <td><strong>${escapeHtml(plant.stp_name)}</strong></td>
              <td>${escapeHtml(plant.division)}</td>
              <td>${escapeHtml(plant.installed_mgd_raw)}</td>
              <td>${escapeHtml(plant.utilised_mgd_raw)}</td>
              <td>${escapeHtml(plant.rate_percent_raw)}</td>
              <td><span class="stp-pill ${statusClass(plant.utilisation_status)}">${escapeHtml(plant.utilisation_status)}</span></td>
              <td>${escapeHtml(plant.om_disclosure_status)}</td>
              <td>${escapeHtml(plant.capital_cost_raw)}</td>
              <td><div class="stp-chip-row">${splitFlags(plant).map((flag) => `<span class="stp-pill">${escapeHtml(flag)}</span>`).join("")}</div></td>
            </tr>
          `
        )
        .join("")}</tbody>
    `;
    el.querySelectorAll("th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        tableState.sortDir = tableState.sortKey === key && tableState.sortDir === "asc" ? "desc" : "asc";
        tableState.sortKey = key;
        renderPlantTable();
      });
    });
  }

  function dashboardCard(label, value, note, accent = "var(--teal)") {
    return `
      <article class="stp-dashboard-card" style="--card-accent:${accent}">
        <span class="stp-card-label">${escapeHtml(label)}</span>
        <strong class="stp-metric-value">${escapeHtml(value)}</strong>
        <p class="stp-card-note">${escapeHtml(note)}</p>
      </article>
    `;
  }

  function renderControlGrid() {
    const el = $("stpControlGrid");
    if (!el) return;
    el.innerHTML = [
      dashboardCard("STPs", exactSummary("Total STPs identified"), "All plant-level records.", "var(--teal)").replaceAll("stp-dashboard-card", "stp-control-card"),
      dashboardCard("Installed", exactSummary("Total Installed Capacity"), "System capacity.", "var(--gold)").replaceAll("stp-dashboard-card", "stp-control-card"),
      dashboardCard("Utilised", exactSummary("Total Utilised Capacity"), "Current use.", "var(--green)").replaceAll("stp-dashboard-card", "stp-control-card"),
      dashboardCard("Utilisation", exactSummary("Overall Utilisation Rate"), "Overall rate.", "var(--blue)").replaceAll("stp-dashboard-card", "stp-control-card"),
      dashboardCard("Overloaded", exactSummary("STPs overloaded"), "Above design.", "var(--rust)").replaceAll("stp-dashboard-card", "stp-control-card"),
      dashboardCard("Underutilised", exactSummary("STPs underutilised"), "Below design.", "var(--violet)").replaceAll("stp-dashboard-card", "stp-control-card"),
    ].join("");
  }

  function renderCapacityDashboard() {
    const el = $("stpCapacityDashboard");
    if (!el) return;
    const installed = number(exactSummary("Total Installed Capacity"));
    const utilised = number(exactSummary("Total Utilised Capacity"));
    const idle = installed != null && utilised != null ? (installed - utilised).toFixed(2) + " MGD" : "See report";
    el.innerHTML = [
      dashboardCard("Installed vs utilised", `${exactSummary("Total Installed Capacity")} / ${exactSummary("Total Utilised Capacity")}`, "Aggregate values from the report.", "var(--teal)"),
      dashboardCard("Idle capacity", idle, "Derived as installed capacity minus utilised capacity from the report summary.", "var(--gold)"),
      dashboardCard("Overloaded capacity", exactSummary("STPs overloaded"), "Report summary classification; individual overloaded plants are listed in the explorer.", "var(--rust)"),
    ].join("");
  }

  function miniBarRows(rows, valueGetter, labelGetter, maxValue, accentGetter) {
    return `<div class="stp-mini-bars">${rows
      .map((row) => {
        const value = valueGetter(row) || 0;
        const width = maxValue ? Math.min(100, (value / maxValue) * 100) : 0;
        return `
          <div class="stp-mini-bar">
            <span>${escapeHtml(labelGetter(row))}</span>
            <div class="stp-mini-bar-track"><div class="stp-mini-bar-fill" style="--bar-width:${width}%;--bar-accent:${accentGetter(row)}"></div></div>
            <strong>${escapeHtml(row.rate_percent_raw || row.value || value)}</strong>
          </div>
        `;
      })
      .join("")}</div>`;
  }

  function renderCapacityCharts() {
    const el = $("stpCapacityCharts");
    if (!el) return;
    const byCapacity = plants
      .slice()
      .sort((a, b) => (number(b.installed_mgd_number) || 0) - (number(a.installed_mgd_number) || 0))
      .slice(0, 10);
    const byRate = plants
      .slice()
      .sort((a, b) => (number(b.rate_percent_max) || 0) - (number(a.rate_percent_max) || 0))
      .slice(0, 10);
    el.innerHTML = `
      <article class="stp-chart-card">
        <h4>Largest installed capacities</h4>
        ${miniBarRows(byCapacity, (p) => number(p.installed_mgd_number), (p) => p.stp_name, Math.max(...byCapacity.map((p) => number(p.installed_mgd_number) || 0)), () => "var(--teal)")}
      </article>
      <article class="stp-chart-card">
        <h4>Highest utilisation rates</h4>
        ${miniBarRows(byRate, (p) => number(p.rate_percent_max), (p) => p.stp_name, Math.max(...byRate.map((p) => number(p.rate_percent_max) || 0)), (p) => accentFor(p.utilisation_status))}
      </article>
    `;
  }

  function renderFinancialDashboard() {
    const el = $("stpFinancialDashboard");
    if (!el) return;
    const disclosedCapital = plants.filter((plant) => plant.capital_cost_raw && plant.capital_cost_raw !== "—");
    const anomalies = plants.filter((plant) => splitFlags(plant).includes("O&M Anomaly"));
    const rohani = plants.find((plant) => /Rohini/i.test(plant.stp_name));
    el.innerHTML = [
      dashboardCard("Capital costs disclosed", String(disclosedCapital.length), disclosedCapital.map((p) => `${p.stp_name}: ${p.capital_cost_raw}`).join(" | "), "var(--teal)"),
      dashboardCard("O&M anomalies", String(anomalies.length), "Plants tagged from O&M remarks and governance flags.", "var(--rust)"),
      dashboardCard("Budget utilisation", "62.5%", rohani?.anomaly_remarks_raw || "Recorded in report remarks.", "var(--gold)"),
    ].join("");
  }

  function renderFinancialCharts() {
    const el = $("stpFinancialCharts");
    if (!el) return;
    const capitalRows = plants
      .filter((plant) => number(plant.capital_cost_number_raw) != null)
      .sort((a, b) => (number(b.capital_cost_number_raw) || 0) - (number(a.capital_cost_number_raw) || 0));
    const disclosureRows = ["Full disclosure", "Partial disclosure", "Data withheld"].map((status) => ({
      label: status,
      value: plants.filter((plant) => plant.om_disclosure_status === status).length,
      rate_percent_raw: String(plants.filter((plant) => plant.om_disclosure_status === status).length),
      status,
    }));
    el.innerHTML = `
      <article class="stp-chart-card">
        <h4>Capital cost disclosures</h4>
        ${miniBarRows(capitalRows, (p) => number(p.capital_cost_number_raw), (p) => p.stp_name, Math.max(...capitalRows.map((p) => number(p.capital_cost_number_raw) || 0)), () => "var(--gold)")}
      </article>
      <article class="stp-chart-card">
        <h4>O&M disclosure quality</h4>
        ${miniBarRows(disclosureRows, (row) => row.value, (row) => row.label, Math.max(...disclosureRows.map((row) => row.value)), (row) => row.status === "Data withheld" ? "var(--rust)" : row.status === "Partial disclosure" ? "var(--gold)" : "var(--green)")}
      </article>
    `;
  }

  function renderIssueGrid(id, terms) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = terms
      .map(([label, matcher, accent]) => {
        const matchedFlags = flags.filter((flag) => matcher(flag));
        const textLine = matchedFlags.map((flag) => `${flag.division_stp}: ${flag.issue}`).join(" | ") || "No matching governance flag recorded under this category.";
        return `
          <article class="stp-issue-card" style="--card-accent:${accent}">
            <span class="stp-card-label">${escapeHtml(label)}</span>
            <strong class="stp-metric-value">${matchedFlags.length}</strong>
            <p>${escapeHtml(textLine)}</p>
          </article>
        `;
      })
      .join("");
  }

  function renderGovernanceDashboard() {
    renderIssueGrid("stpGovernanceDashboard", [
      ["Data withheld", (f) => /withheld|voluminous|not provided/i.test(`${f.issue} ${f.implication}`), "var(--rust)"],
      ["Dual-zone conflicts", (f) => /dual-zone|conflict/i.test(`${f.flag} ${f.issue}`), "var(--gold)"],
      ["Ownership conflicts", (f) => /ownership|DDA|PPCL|third-party/i.test(`${f.flag} ${f.issue}`), "var(--blue)"],
      ["Rehabilitation cases", (f) => /rehabilitation/i.test(`${f.issue} ${f.implication}`), "var(--green)"],
      ["Underperforming new infrastructure", (f) => /new plant|brand new|post-upgrade/i.test(`${f.issue} ${f.implication}`), "var(--violet)"],
    ]);
  }

  function renderTransparencyDashboard() {
    const el = $("stpTransparencyDashboard");
    if (!el) return;
    const groups = [
      ["Full disclosure", "Full disclosure", "green"],
      ["Partial disclosure", "Partial disclosure", "yellow"],
      ["Data withheld", "Data withheld", "red"],
    ];
    el.innerHTML = groups
      .map(([label, status, color]) => {
        const rows = plants.filter((plant) => plant.om_disclosure_status === status);
        return `
          <article class="stp-transparency-card ${color}">
            <span class="stp-card-label">${escapeHtml(label)}</span>
            <strong class="stp-metric-value">${rows.length}</strong>
            <p>${escapeHtml(rows.map((plant) => plant.stp_name).join(" | "))}</p>
          </article>
        `;
      })
      .join("");
  }

  let activeFlagCategory = "Overloaded";

  function categoryMatchesPlant(category, plant) {
    const flags = splitFlags(plant);
    if (category === "Data Withheld") return plant.om_disclosure_status === "Data withheld" || flags.includes(category);
    if (category === "Conflict") return flags.includes("Conflict");
    return flags.includes(category);
  }

  function renderFlagExplorer() {
    const buttons = $("stpFlagButtons");
    const list = $("stpFlagExplorer");
    if (!buttons || !list) return;
    const categories = ["Overloaded", "Underutilised", "Data Withheld", "O&M Anomaly", "Conflict", "Ownership Issue"];
    buttons.innerHTML = categories
      .map((category) => `<button class="stp-flag-button ${category === activeFlagCategory ? "is-active" : ""}" type="button" data-flag-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`)
      .join("");
    buttons.querySelectorAll("[data-flag-category]").forEach((button) => {
      button.addEventListener("click", () => {
        activeFlagCategory = button.dataset.flagCategory;
        renderFlagExplorer();
      });
    });
    const rows = plants.filter((plant) => categoryMatchesPlant(activeFlagCategory, plant));
    list.innerHTML = rows
      .map(
        (plant) => `
          <article class="stp-flag-card" style="--card-accent:${accentFor(plant.utilisation_status)}">
            <span class="stp-card-label">${escapeHtml(activeFlagCategory)}</span>
            <h4>${escapeHtml(plant.stp_name)}</h4>
            <p>${escapeHtml(plant.anomaly_remarks_raw)}</p>
            <div class="stp-chip-row">${splitFlags(plant).map((flag) => `<span class="stp-pill">${escapeHtml(flag)}</span>`).join("")}</div>
          </article>
        `
      )
      .join("");
  }

  function init() {
    if (!plants.length) return;
    initResearchNavigation();
    renderSourceNote();
    renderExecutiveMetrics();
    renderDistribution();
    renderRankedList("stpUnderutilisedChart", rankedPlants("Underutilised", "asc"));
    renderRankedList("stpOverloadedChart", rankedPlants("Overloaded", "desc"));
    renderScatter();
    renderGovernanceFlagCards();
    renderNarrative();
    renderMap();
    setupFilters();
    renderPlantTable();
    renderControlGrid();
    renderCapacityDashboard();
    renderCapacityCharts();
    renderFinancialDashboard();
    renderFinancialCharts();
    renderGovernanceDashboard();
    renderTransparencyDashboard();
    renderFlagExplorer();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
