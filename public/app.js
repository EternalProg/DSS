const api = {
  alternatives: "/api/alternatives",
  criteria: "/api/criteria",
  evaluations: "/api/evaluations",
  matrix: "/api/matrix",
  analytics: "/api/analytics",
  importCsv: "/api/import/csv",
  consensus: "/api/consensus",
  rules: "/api/rules",
  voting: "/api/voting",
  triads: "/api/triads",
  triadsImport: "/api/triads/import"
};

const state = {
  alternatives: [],
  criteria: [],
  matrix: null,
  rules: [],
  charts: {
    barCautious: null,
    barAdditive: null,
    barMultiplicative: null,
    radar: null,
    consensus: {
      E7: null,
      E1: null,
      E2: null
    }
  }
};

const elements = {
  alternativesTable: document.getElementById("alternativesTable"),
  criteriaTable: document.getElementById("criteriaTable"),
  matrixTable: document.getElementById("matrixTable"),
  alternativeForm: document.getElementById("alternativeForm"),
  criterionForm: document.getElementById("criterionForm"),
  evaluationForm: document.getElementById("evaluationForm"),
  weightsGrid: document.getElementById("weightsGrid"),
  calculateBtn: document.getElementById("calculateBtn"),
  analyticsResults: document.getElementById("analyticsResults"),
  recommendationCard: document.getElementById("recommendationCard"),
  recommendationContent: document.getElementById("recommendationContent"),
  logicStatus: document.getElementById("logicStatus"),
  resultsTable: document.getElementById("resultsTable"),
  explanationsContent: document.getElementById("explanationsContent"),
  barChartCautious: document.getElementById("barChartCautious"),
  barChartAdditive: document.getElementById("barChartAdditive"),
  barChartMultiplicative: document.getElementById("barChartMultiplicative"),
  radarChart: document.getElementById("radarChart"),
  confirmModal: document.getElementById("confirmModal"),
  confirmMessage: document.getElementById("confirmMessage"),
  confirmOk: document.getElementById("confirmOk"),
  confirmCancel: document.getElementById("confirmCancel"),
  csvImportForm: document.getElementById("csvImportForm"),
  csvImportBtn: document.getElementById("csvImportBtn"),
  csvImportHelpBtn: document.getElementById("csvImportHelpBtn"),
  csvImportStatus: document.getElementById("csvImportStatus"),
  votingImportForm: document.getElementById("votingImportForm"),
  votingImportBtn: document.getElementById("votingImportBtn"),
  votingImportHelpBtn: document.getElementById("votingImportHelpBtn"),
  votingImportStatus: document.getElementById("votingImportStatus"),
  votingResults: document.getElementById("votingResults"),
  triadsImportForm: document.getElementById("triadsImportForm"),
  triadsImportBtn: document.getElementById("triadsImportBtn"),
  triadsImportHelpBtn: document.getElementById("triadsImportHelpBtn"),
  triadsImportStatus: document.getElementById("triadsImportStatus"),
  confirmTitle: document.getElementById("confirmTitle"),
  consensusForm: document.getElementById("consensusForm"),
  consensusVariantField: document.getElementById("consensusVariantField"),
  consensusPField: document.getElementById("consensusPField"),
  consensusApplyField: document.getElementById("consensusApplyField"),
  consensusCalcBtn: document.getElementById("consensusCalcBtn"),
  consensusStatus: document.getElementById("consensusStatus"),
  consensusResults: document.getElementById("consensusResults"),
  thresholdsGrid: document.getElementById("thresholdsGrid"),
  ruleForm: document.getElementById("ruleForm"),
  rulesTable: document.getElementById("rulesTable"),
  rulePercentField: document.getElementById("rulePercentField"),
  ruleTargetCriterionField: document.getElementById("ruleTargetCriterionField")
};

let confirmResolver = null;

function openModal(title, message, { okText = "OK", cancelText = "Закрити", danger = false } = {}) {
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.innerHTML = message;

  elements.confirmOk.textContent = okText;
  elements.confirmCancel.textContent = cancelText;
  elements.confirmOk.classList.toggle("danger", Boolean(danger));

  elements.confirmModal.classList.add("is-open");
  elements.confirmModal.setAttribute("aria-hidden", "false");

  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function openConfirm(message) {
  // Preserve existing behavior for delete confirmations.
  elements.confirmTitle.textContent = "Підтвердження";
  elements.confirmMessage.textContent = message;
  elements.confirmCancel.textContent = "Скасувати";
  elements.confirmOk.textContent = "Видалити";
  elements.confirmOk.classList.add("danger");
  elements.confirmModal.classList.add("is-open");
  elements.confirmModal.setAttribute("aria-hidden", "false");
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function closeConfirm(result) {
  elements.confirmModal.classList.remove("is-open");
  elements.confirmModal.setAttribute("aria-hidden", "true");
  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
}

elements.confirmCancel.addEventListener("click", () => closeConfirm(false));
elements.confirmOk.addEventListener("click", () => closeConfirm(true));
elements.confirmModal
  .querySelector(".modal__backdrop")
  .addEventListener("click", () => closeConfirm(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && elements.confirmModal.classList.contains("is-open")) {
    closeConfirm(false);
  }
});

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  if (type === "error") {
    toast.style.borderColor = "#d9664a";
  }
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      const text = await response.text().catch(() => "");
      body = { message: `HTTP ${response.status}`, raw: text ? text.slice(0, 400) : "" };
    }
    const error = new Error(body?.message || `HTTP ${response.status}`);
    error.details = body || { message: error.message };
    throw error;
  }

  return response.json();
}

async function requestMultipart(url, formData, { method = "POST" } = {}) {
  const response = await fetch(url, {
    method,
    body: formData
  });

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      const text = await response.text().catch(() => "");
      body = { message: `HTTP ${response.status}`, raw: text ? text.slice(0, 400) : "" };
    }
    const error = new Error(body?.message || `HTTP ${response.status}`);
    error.details = body || { message: error.message };
    throw error;
  }

  return response.json();
}

async function requestText(url, text, { method = "POST", contentType = "text/plain" } = {}) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": contentType },
    body: text
  });

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      const raw = await response.text().catch(() => "");
      body = { message: `HTTP ${response.status}`, raw: raw ? raw.slice(0, 400) : "" };
    }
    const error = new Error(body?.message || `HTTP ${response.status}`);
    error.details = body || { message: error.message };
    throw error;
  }

  return response.json();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function idToKey(id) {
  if (id == null) return "";
  if (typeof id === "string") return id;
  // Handle possible extended-json shapes.
  if (typeof id === "object") {
    if (typeof id.$oid === "string") return id.$oid;
    if (typeof id.oid === "string") return id.oid;
    // bson ObjectId shape (from some serializers)
    if (typeof id.toHexString === "function") return id.toHexString();
  }
  return String(id);
}

function buildIdLookup(items) {
  const map = new Map();
  for (const it of items) {
    const rawId = it?._id;
    const keys = new Set([
      idToKey(rawId),
      String(rawId),
      typeof rawId?.toString === "function" ? rawId.toString() : ""
    ]);
    for (const k of keys) {
      const key = String(k || "");
      if (!key) continue;
      if (!map.has(key)) map.set(key, it);
    }
  }
  return map;
}

function formatImportErrors(details) {
  const errors = Array.isArray(details?.errors) ? details.errors : [];
  const total = details?.meta?.totalErrors;
  const header = typeof total === "number" ? `Знайдено помилок: ${total}.` : "Помилки імпорту.";

  if (!errors.length) {
    return `<p>${escapeHtml(details?.message || header)}</p>`;
  }

  const rows = errors
    .slice(0, 50)
    .map((e) => {
      const code = e?.code ? `<span class="chip">${escapeHtml(e.code)}</span>` : "";
      const msg = e?.message ? escapeHtml(e.message) : "(без опису)";
      const hint = e?.hint ? `<div class="muted" style="margin-top:6px;">${escapeHtml(e.hint)}</div>` : "";
      return `<li style="margin-bottom:10px;">${code} <strong>${msg}</strong>${hint}</li>`;
    })
    .join("");

  const more = errors.length > 50 ? `<p class="muted">Показано перші 50 помилок з ${errors.length}.</p>` : "";

  return `
    <p>${escapeHtml(header)}</p>
    ${more}
    <ol style="padding-left: 18px;">${rows}</ol>
  `;
}

function renderAlternatives() {
  if (!state.alternatives.length) {
    elements.alternativesTable.innerHTML =
      '<div class="empty">Ще немає альтернатив.</div>';
    return;
  }

  const rows = state.alternatives
    .map(
      (alternative) => `
        <tr>
          <td>${alternative.name}</td>
          <td>${alternative.description || ""}</td>
          <td>
            <button class="ghost" data-action="edit" data-id="${alternative._id}">
              Редагувати
            </button>
            <button class="ghost" data-action="delete" data-id="${alternative._id}">
              Видалити
            </button>
          </td>
        </tr>`
    )
    .join("");

  elements.alternativesTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Назва</th>
          <th>Опис</th>
          <th>Дія</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  elements.alternativesTable
    .querySelectorAll("button[data-action='edit']")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const alternative = state.alternatives.find(
          (item) => item._id === button.dataset.id
        );
        if (!alternative) return;
        elements.alternativeForm.id.value = alternative._id;
        elements.alternativeForm.name.value = alternative.name;
        elements.alternativeForm.description.value =
          alternative.description || "";
      });
    });

  elements.alternativesTable
    .querySelectorAll("button[data-action='delete']")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const alternative = state.alternatives.find(
          (item) => item._id === button.dataset.id
        );
        if (!alternative) return;

        const confirmed = await openConfirm(
          `Видалити альтернативу "${alternative.name}" та всі її оцінки?`
        );
        if (!confirmed) return;

        try {
          await request(`${api.alternatives}/${alternative._id}`, {
            method: "DELETE"
          });
          showToast("Альтернатива видалена.");
          await loadData();
        } catch (error) {
          showToast(error.message, "error");
        }
      });
    });
}

function renderCriteria() {
  if (!state.criteria.length) {
    elements.criteriaTable.innerHTML =
      '<div class="empty">Ще немає критеріїв.</div>';
    return;
  }

  const rows = state.criteria
    .map(
      (criterion) => `
        <tr>
          <td>${criterion.name}</td>
          <td><span class="chip">${criterion.type}</span></td>
          <td>${criterion.description || ""}</td>
          <td>
            <button class="ghost" data-action="edit" data-id="${criterion._id}">
              Редагувати
            </button>
            <button class="ghost" data-action="delete" data-id="${criterion._id}">
              Видалити
            </button>
          </td>
        </tr>`
    )
    .join("");

  elements.criteriaTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Назва</th>
          <th>Тип</th>
          <th>Опис</th>
          <th>Дія</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  elements.criteriaTable
    .querySelectorAll("button[data-action='edit']")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const criterion = state.criteria.find(
          (item) => item._id === button.dataset.id
        );
        if (!criterion) return;
        elements.criterionForm.id.value = criterion._id;
        elements.criterionForm.name.value = criterion.name;
        elements.criterionForm.type.value = criterion.type;
        elements.criterionForm.description.value = criterion.description || "";
      });
    });

  elements.criteriaTable
    .querySelectorAll("button[data-action='delete']")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const criterion = state.criteria.find(
          (item) => item._id === button.dataset.id
        );
        if (!criterion) return;

        const confirmed = await openConfirm(
          `Видалити критерій "${criterion.name}" та всі його оцінки?`
        );
        if (!confirmed) return;

        try {
          await request(`${api.criteria}/${criterion._id}`, {
            method: "DELETE"
          });
          showToast("Критерій видалений.");
          await loadData();
        } catch (error) {
          showToast(error.message, "error");
        }
      });
    });
}

function renderMatrix() {
  if (!state.matrix) {
    elements.matrixTable.innerHTML =
      '<div class="empty">Матриця ще не завантажена.</div>';
    return;
  }

  if (!state.matrix.alternatives.length || !state.matrix.criteria.length) {
    elements.matrixTable.innerHTML =
      '<div class="empty">Додайте альтернативи та критерії.</div>';
    return;
  }

  const headerCells = state.matrix.criteria
    .map((criterion) => `<th>${criterion.name}</th>`)
    .join("");

  const rows = state.matrix.rows
    .map((row) => {
      const cells = row.values
        .map(
          (cell) => `
            <td class="matrix-cell" 
                data-alternative-id="${row.alternativeId}" 
                data-criterion-id="${cell.criterionId}"
                data-value="${cell.value === null ? '' : cell.value}"
                title="Подвійний клік для редагування">
              ${cell.value === null ? '<span class="matrix-cell__empty">-</span>' : formatNumber(cell.value, 2)}
            </td>`
        )
        .join("");
      return `<tr><td>${row.alternativeName}</td>${cells}</tr>`;
    })
    .join("");

  elements.matrixTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Альтернатива</th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  // Add double-click handlers for inline editing
  elements.matrixTable.querySelectorAll(".matrix-cell").forEach((cell) => {
    cell.addEventListener("dblclick", handleMatrixCellEdit);
  });
}

async function handleMatrixCellEdit(event) {
  const cell = event.currentTarget;
  
  // Prevent editing if already in edit mode
  if (cell.querySelector("input")) return;

  const alternativeId = cell.dataset.alternativeId;
  const criterionId = cell.dataset.criterionId;
  const currentValue = cell.dataset.value;

  // Create input element
  const input = document.createElement("input");
  input.type = "number";
  input.step = "0.01";
  input.className = "matrix-cell__input";
  input.value = currentValue;
  input.placeholder = "0";

  // Replace cell content with input
  cell.innerHTML = "";
  cell.appendChild(input);
  input.focus();
  input.select();

  // Handle save on blur or Enter
  const saveValue = async () => {
    const newValue = parseFloat(input.value);
    
    if (isNaN(newValue)) {
      // Restore original display
      await loadData();
      return;
    }

    try {
      await request(api.evaluations, {
        method: "POST",
        body: JSON.stringify({
          alternativeId,
          criterionId,
          value: newValue
        })
      });
      showToast("Оцінка оновлена");
      await loadData();
    } catch (error) {
      showToast(error.message, "error");
      await loadData();
    }
  };

  input.addEventListener("blur", saveValue);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    }
    if (e.key === "Escape") {
      loadData(); // Cancel and restore
    }
  });
}

function fillEvaluationOptions() {
  const alternativeOptions = state.alternatives
    .map((alternative) => `<option value="${alternative._id}">${alternative.name}</option>`)
    .join("");
  const criterionOptions = state.criteria
    .map((criterion) => `<option value="${criterion._id}">${criterion.name}</option>`)
    .join("");

  elements.evaluationForm.alternativeId.innerHTML = alternativeOptions;
  elements.evaluationForm.criterionId.innerHTML = criterionOptions;
}

function renderWeights() {
  if (!state.criteria.length) {
    elements.weightsGrid.innerHTML =
      '<div class="empty">Спочатку додайте критерії.</div>';
    return;
  }

  const items = state.criteria
    .map(
      (criterion) => `
        <div class="weight-item">
          <div class="weight-item__info">
            <div class="weight-item__name">${criterion.name}</div>
            <div class="weight-item__type">${criterion.type === "maximize" ? "більше краще" : "менше краще"}</div>
          </div>
          <input 
            type="number" 
            class="weight-item__input" 
            data-id="${criterion._id}"
            value="${criterion.weight ?? ""}"
            placeholder="1-10"
            min="1"
            max="10"
            step="1"
          />
        </div>`
    )
    .join("");

  elements.weightsGrid.innerHTML = items;

  elements.weightsGrid.querySelectorAll(".weight-item__input").forEach((input) => {
    input.addEventListener("change", async (event) => {
      const criterionId = event.target.dataset.id;
      const criterion = state.criteria.find((c) => c._id === criterionId);
      const weight = Number(event.target.value);

      if (!Number.isInteger(weight) || weight < 1 || weight > 10) {
        event.target.value = criterion?.weight ?? "";
        showToast("Вага повинна бути цілим числом від 1 до 10.", "error");
        return;
      }

      try {
        await request(`${api.criteria}/${criterionId}/weight`, {
          method: "PATCH",
          body: JSON.stringify({ weight })
        });

        if (criterion) criterion.weight = weight;

        showToast(`Вага оновлена: ${weight}`);
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  });
}

function renderThresholds() {
  if (!elements.thresholdsGrid) return;
  if (!state.criteria.length) {
    elements.thresholdsGrid.innerHTML = '<div class="empty">Спочатку додайте критерії.</div>';
    return;
  }

  const items = state.criteria
    .map((criterion) => {
      const enabled = Boolean(criterion.thresholdEnabled);
      const value = criterion.thresholdValue ?? "";
      const note = criterion.thresholdNote ?? "";
      const signText = criterion.type === "maximize" ? ">=" : "<=";
      return `
        <div class="threshold-item">
          <div class="threshold-item__info">
            <div class="weight-item__name">${escapeHtml(criterion.name)}</div>
            <div class="weight-item__type">${escapeHtml(criterion.type)}: x ${signText} поріг</div>
          </div>
          <div class="threshold-item__controls">
            <label class="threshold-item__toggle">
              <input type="checkbox" class="threshold-item__enabled" data-id="${criterion._id}" ${enabled ? "checked" : ""} />
              Поріг
            </label>
            <input
              type="number"
              class="threshold-item__value"
              data-id="${criterion._id}"
              value="${escapeHtml(value)}"
              placeholder="-"
              step="0.01"
              ${enabled ? "" : "disabled"}
              title="Порогове значення"
            />
            <input
              type="text"
              class="threshold-item__note"
              data-id="${criterion._id}"
              value="${escapeHtml(note)}"
              placeholder="Пояснення (опційно)"
              title="Пояснення порогу"
            />
          </div>
        </div>
      `;
    })
    .join("");

  elements.thresholdsGrid.innerHTML = items;

  const enabledEls = elements.thresholdsGrid.querySelectorAll(".threshold-item__enabled");
  const valueEls = elements.thresholdsGrid.querySelectorAll(".threshold-item__value");
  const noteEls = elements.thresholdsGrid.querySelectorAll(".threshold-item__note");

  enabledEls.forEach((el) => {
    el.addEventListener("change", async (event) => {
      const criterionId = event.target.dataset.id;
      const enabled = Boolean(event.target.checked);
      const valueEl = elements.thresholdsGrid.querySelector(`.threshold-item__value[data-id="${criterionId}"]`);
      const noteEl = elements.thresholdsGrid.querySelector(`.threshold-item__note[data-id="${criterionId}"]`);
      const rawValue = valueEl ? valueEl.value : "";
      const value = rawValue === "" ? null : rawValue;
      const note = noteEl ? noteEl.value : "";

      if (valueEl) valueEl.disabled = !enabled;

      try {
        await request(`${api.criteria}/${criterionId}/threshold`, {
          method: "PATCH",
          body: JSON.stringify({ enabled, value: enabled ? value : null, note })
        });
        showToast("Поріг оновлено.");
        await loadData();
      } catch (error) {
        showToast(error.message, "error");
        await loadData();
      }
    });
  });

  valueEls.forEach((el) => {
    el.addEventListener("change", async (event) => {
      const criterionId = event.target.dataset.id;
      const enabledEl = elements.thresholdsGrid.querySelector(`.threshold-item__enabled[data-id="${criterionId}"]`);
      const enabled = Boolean(enabledEl?.checked);
      const noteEl = elements.thresholdsGrid.querySelector(`.threshold-item__note[data-id="${criterionId}"]`);
      const note = noteEl ? noteEl.value : "";
      try {
        await request(`${api.criteria}/${criterionId}/threshold`, {
          method: "PATCH",
          body: JSON.stringify({ enabled, value: event.target.value, note })
        });
        showToast("Поріг оновлено.");
        await loadData();
      } catch (error) {
        showToast(error.message, "error");
        await loadData();
      }
    });
  });

  noteEls.forEach((el) => {
    el.addEventListener("blur", async (event) => {
      const criterionId = event.target.dataset.id;
      const enabledEl = elements.thresholdsGrid.querySelector(`.threshold-item__enabled[data-id="${criterionId}"]`);
      const enabled = Boolean(enabledEl?.checked);
      const valueEl = elements.thresholdsGrid.querySelector(`.threshold-item__value[data-id="${criterionId}"]`);
      const value = valueEl ? valueEl.value : "";
      try {
        await request(`${api.criteria}/${criterionId}/threshold`, {
          method: "PATCH",
          body: JSON.stringify({ enabled, value: enabled ? value : null, note: event.target.value })
        });
      } catch (error) {
        // Don't toast on blur spam; keep minimal.
      }
    });
  });
}

function setRuleFormUI() {
  if (!elements.ruleForm || !elements.rulePercentField || !elements.ruleTargetCriterionField) return;
  const action = elements.ruleForm.action?.value;
  const isAdjust = action === "adjust_percent";
  elements.rulePercentField.style.display = isAdjust ? "" : "none";
  elements.ruleTargetCriterionField.style.display = isAdjust ? "" : "none";
  if (elements.ruleForm.percent) {
    elements.ruleForm.percent.required = Boolean(isAdjust);
  }
}

function fillRuleCriterionOptions() {
  if (!elements.ruleForm) return;
  const opts = state.criteria
    .map((c) => `<option value="${c._id}">${escapeHtml(c.name)}</option>`)
    .join("");
  if (elements.ruleForm.criterionId) elements.ruleForm.criterionId.innerHTML = opts;
  if (elements.ruleForm.targetCriterionId) elements.ruleForm.targetCriterionId.innerHTML = opts;
}

function renderRules() {
  if (!elements.ruleForm || !elements.rulesTable) return;

  fillRuleCriterionOptions();
  setRuleFormUI();

  if (!state.rules.length) {
    elements.rulesTable.innerHTML = '<div class="empty">Ще немає правил.</div>';
    return;
  }

  const critById = buildIdLookup(state.criteria);

      const rows = state.rules
    .map((r) => {
      const cid = idToKey(r.when?.criterionId);
      const crit = critById.get(cid);
      const op = r.when?.operator ?? "";
      const val = r.when?.value;
      const action = r.then?.action;
      const enabled = r.enabled !== false;
      let actionText = action;
      if (action === "exclude") actionText = "виключити альтернативу";
      if (action === "adjust_percent") {
        const pct = r.then?.percent;
        const tid = idToKey(r.then?.targetCriterionId ?? cid);
        const tCrit = critById.get(tid);
        actionText = `змінити оцінку на ${pct}% (критерій: ${escapeHtml(tCrit?.name ?? tid)})`;
      }

      return `<tr>
        <td>${enabled ? '<span class="chip">ON</span>' : '<span class="chip">OFF</span>'}</td>
        <td>${escapeHtml(crit?.name ?? cid)}</td>
        <td><span class="score-cell">${escapeHtml(op)} ${escapeHtml(String(val))}</span></td>
        <td>${actionText}</td>
        <td>${escapeHtml(r.note || "")}</td>
        <td>
          <button class="ghost" data-action="edit" data-id="${r._id}">Редагувати</button>
          <button class="ghost" data-action="delete" data-id="${r._id}">Видалити</button>
        </td>
      </tr>`;
    })
    .join("");

  elements.rulesTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Статус</th>
          <th>Критерій</th>
          <th>Умова</th>
          <th>Дія</th>
          <th>Пояснення</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  elements.rulesTable.querySelectorAll("button[data-action='delete']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const ok = await openConfirm("Видалити правило?");
      if (!ok) return;
      try {
        await request(`${api.rules}/${id}`, { method: "DELETE" });
        showToast("Правило видалено.");
        await loadData();
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  });

  elements.rulesTable.querySelectorAll("button[data-action='edit']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const r = state.rules.find((x) => String(x._id) === String(id));
      if (!r) return;
      elements.ruleForm.id.value = r._id;
      elements.ruleForm.criterionId.value = idToKey(r.when?.criterionId);
      elements.ruleForm.operator.value = r.when?.operator ?? ">";
      elements.ruleForm.value.value = r.when?.value ?? "";
      elements.ruleForm.action.value = r.then?.action ?? "exclude";
      elements.ruleForm.percent.value = r.then?.percent ?? "";
      elements.ruleForm.targetCriterionId.value = idToKey(r.then?.targetCriterionId ?? r.when?.criterionId);
      elements.ruleForm.note.value = r.note ?? "";
      elements.ruleForm.enabled.checked = r.enabled !== false;
      setRuleFormUI();
      elements.ruleForm.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

async function calculateAnalytics() {
  const checkboxes = document.querySelectorAll('input[name="strategy"]:checked');
  const strategies = Array.from(checkboxes).map((cb) => cb.value);
  const scaleMode = document.querySelector('input[name="scaleMode"]:checked')?.value || "raw";

  if (!strategies.length) {
    showToast("Виберіть хоча б одну стратегію.", "error");
    return;
  }

  try {
    elements.calculateBtn.disabled = true;
    elements.calculateBtn.textContent = "Розраховується...";

    const result = await request(`${api.analytics}/calculate`, {
      method: "POST",
      body: JSON.stringify({ strategies, scaleMode })
    });

    renderAnalyticsResults(result);
    elements.analyticsResults.style.display = "block";
    showToast("Аналіз завершено.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    elements.calculateBtn.disabled = false;
    elements.calculateBtn.textContent = "Розрахувати";
  }
}

function renderAnalyticsResults(data) {
  const scaleMode = data?.logic?.scaleMode || "raw";
  renderRecommendation(data.recommendation, scaleMode);
  renderLogicStatus(data);
  renderResultsTable(data.strategies, scaleMode);
  renderCharts(data.strategies, scaleMode);
  renderExplanations(data.strategies);
}

function renderLogicStatus(data) {
  if (!elements.logicStatus) return;
  const counts = data?.counts;
  const logic = data?.logic;
  const meta = data?.meta;

  const before = counts?.before;
  const after = counts?.after;
  const excludedRule = logic?.excludedByRule ? Object.keys(logic.excludedByRule).length : 0;
  const excludedTh = logic?.excludedByThreshold ? Object.keys(logic.excludedByThreshold).length : 0;
  const adjusted = Array.isArray(logic?.adjusted) ? logic.adjusted.length : 0;

  const hasInfo =
    (before && after) || excludedRule || excludedTh || adjusted;
  if (!hasInfo) {
    elements.logicStatus.style.display = "none";
    elements.logicStatus.textContent = "";
    return;
  }

  const parts = [];
  if (before && after) {
    parts.push(`Альтернативи: ${before.alternatives} → ${after.alternatives}`);
    parts.push(`Оцінки: ${before.evaluations} → ${after.evaluations}`);
  }
  if (excludedTh) parts.push(`Відсічено порогами: ${excludedTh}`);
  if (excludedRule) parts.push(`Відфільтровано правилами: ${excludedRule}`);
  if (adjusted) parts.push(`Скориговано оцінок: ${adjusted}`);
  if (meta?.scaleMode) parts.push(`Шкала: ${meta.scaleMode}`);
  if (meta?.analyticsImplVersion) parts.push(`Analytics v${meta.analyticsImplVersion}`);

  elements.logicStatus.style.display = "block";
  elements.logicStatus.textContent = parts.join("; ") + ".";
}

function formatScoreCell(value, scaleMode) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  if (scaleMode === "normalized") {
    if (n !== 0 && Math.abs(n) < 1e-4) return n.toExponential(2);
    return n.toFixed(4);
  }
  return n.toFixed(2);
}

function renderRecommendation(recommendation, scaleMode = "raw") {
  if (!recommendation || !recommendation.winner) {
    elements.recommendationContent.innerHTML =
      '<p class="empty">Недостатньо даних для рекомендації.</p>';
    return;
  }

  elements.recommendationContent.innerHTML = `
    <div class="recommendation-winner">${recommendation.winner.alternativeName}</div>
    <div class="recommendation-score">Загальний бал: ${formatScoreCell(recommendation.winner.score, scaleMode)}</div>
    <div class="recommendation-reason"><strong>Причина:</strong> ${recommendation.reason}</div>
  `;
}

function renderResultsTable(strategies, scaleMode = "raw") {
  const strategyKeys = Object.keys(strategies);
  
  if (!strategyKeys.length) {
    elements.resultsTable.innerHTML = '<div class="empty">Немає результатів.</div>';
    return;
  }

  const headerCells = strategyKeys
    .map((key) => `<th>${strategies[key].name}</th>`)
    .join("");

  const allAlternatives = new Set();
  strategyKeys.forEach((key) => {
    strategies[key].results.forEach((r) => allAlternatives.add(r.alternativeName));
  });

  const rows = Array.from(allAlternatives)
    .map((altName) => {
      const cells = strategyKeys
        .map((key) => {
          const result = strategies[key].results.find((r) => r.alternativeName === altName);
          const rank = strategies[key].results.findIndex((r) => r.alternativeName === altName) + 1;
          const score = result ? formatScoreCell(result.score, scaleMode) : "-";
          const badgeClass = rank === 1 ? "" : rank === 2 ? "rank-badge--silver" : "rank-badge--bronze";
          return `<td>
            <span class="rank-badge ${badgeClass}">${rank}</span>
            <span class="score-cell">${score}</span>
          </td>`;
        })
        .join("");
      return `<tr><td>${altName}</td>${cells}</tr>`;
    })
    .join("");

  elements.resultsTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Альтернатива</th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderCharts(strategies, scaleMode = "raw") {
  const colors = {
    cautious: {
      bg: "rgba(187, 97, 44, 0.7)",
      border: "rgba(187, 97, 44, 1)"
    },
    additive: {
      bg: "rgba(91, 87, 86, 0.7)",
      border: "rgba(91, 87, 86, 1)"
    },
    multiplicative: {
      bg: "rgba(29, 27, 26, 0.7)",
      border: "rgba(29, 27, 26, 1)"
    }
  };

  const alternativeColors = [
    { bg: "rgba(187, 97, 44, 0.3)", border: "rgba(187, 97, 44, 1)" },
    { bg: "rgba(91, 87, 86, 0.3)", border: "rgba(91, 87, 86, 1)" },
    { bg: "rgba(29, 27, 26, 0.3)", border: "rgba(29, 27, 26, 1)" },
    { bg: "rgba(166, 189, 219, 0.3)", border: "rgba(166, 189, 219, 1)" }
  ];

  // Destroy existing charts
  if (state.charts.barCautious) state.charts.barCautious.destroy();
  if (state.charts.barAdditive) state.charts.barAdditive.destroy();
  if (state.charts.barMultiplicative) state.charts.barMultiplicative.destroy();
  if (state.charts.radar) state.charts.radar.destroy();

  // Hide all bar chart wrappers first
  elements.barChartCautious.closest(".chart-wrapper").classList.add("chart-wrapper--hidden");
  elements.barChartAdditive.closest(".chart-wrapper").classList.add("chart-wrapper--hidden");
  elements.barChartMultiplicative.closest(".chart-wrapper").classList.add("chart-wrapper--hidden");

  // Render bar chart for Cautious strategy
  if (strategies.cautious) {
    elements.barChartCautious.closest(".chart-wrapper").classList.remove("chart-wrapper--hidden");
    const data = [...strategies.cautious.results].sort((a, b) => b.score - a.score);
    const scores = data.map((r) => r.score);
    const maxValue = Math.max(...scores);
    const positiveScores = scores.filter((s) => Number.isFinite(s) && s > 0);
    const minNonZero = positiveScores.length ? Math.min(...positiveScores) : 1e-12;
    const ratio = maxValue > 0 ? maxValue / Math.max(minNonZero, 1e-12) : 1;
    const useLogAxis = scaleMode === "normalized" && positiveScores.length >= 2 && ratio >= 100;
    state.charts.barCautious = new Chart(elements.barChartCautious, {
      type: "bar",
      data: {
        labels: data.map((r) => r.alternativeName),
        datasets: [{
          label: "Обережна стратегія",
          data: data.map((r) => r.score),
          backgroundColor: colors.cautious.bg,
          borderColor: colors.cautious.border,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: "Обережна",
            font: { family: "Unbounded", size: 13 }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                const originalValue = scores[context.dataIndex];
                return `Бал: ${formatScoreCell(originalValue, scaleMode)}`;
              }
            }
          }
        },
        scales: {
          y: {
            type: useLogAxis ? "logarithmic" : "linear",
            beginAtZero: !useLogAxis,
            min: useLogAxis ? minNonZero : 0,
            max: useLogAxis ? maxValue : (scaleMode === "normalized" ? 1 : Math.ceil(maxValue * 1.25)),
            title: { display: true, text: useLogAxis ? "log(Бал)" : "Бал" }
          }
        }
      }
    });
  }

  // Render bar chart for Additive strategy
  if (strategies.additive) {
    elements.barChartAdditive.closest(".chart-wrapper").classList.remove("chart-wrapper--hidden");
    const data = [...strategies.additive.results].sort((a, b) => b.score - a.score);
    const maxValue = Math.max(...data.map((r) => r.score));
    state.charts.barAdditive = new Chart(elements.barChartAdditive, {
      type: "bar",
      data: {
        labels: data.map((r) => r.alternativeName),
        datasets: [{
          label: "Адитивна стратегія",
          data: data.map((r) => r.score),
          backgroundColor: colors.additive.bg,
          borderColor: colors.additive.border,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: "Адитивна",
            font: { family: "Unbounded", size: 13 }
          },
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: scaleMode === "normalized" ? 1 : Math.ceil(maxValue * 1.25),
            title: { display: true, text: "Бал" }
          }
        }
      }
    });
  }

  // Render bar chart for Multiplicative strategy with logarithmic scale
  if (strategies.multiplicative) {
    elements.barChartMultiplicative.closest(".chart-wrapper").classList.remove("chart-wrapper--hidden");
    const data = [...strategies.multiplicative.results].sort((a, b) => b.score - a.score);
    const scores = data.map((r) => r.score);
    const maxScore = Math.max(...scores);
    const positiveScores = scores.filter((s) => Number.isFinite(s) && s > 0);
    const minNonZero = positiveScores.length ? Math.min(...positiveScores) : 1e-12;
    const ratio = maxScore > 0 ? maxScore / Math.max(minNonZero, 1e-12) : 1;
    
    // Use log axis when spread is huge (otherwise smaller bars disappear).
    const useLogAxis = positiveScores.length >= 2 && ratio >= 1000;
    // For non-log axis we may still compress enormous values in raw mode.
    const useLogTransform = !useLogAxis && scaleMode !== "normalized" && maxScore > 10000;
    const displayScores = useLogTransform ? scores.map((s) => Math.log10(s + 1)) : scores;
    const maxDisplayValue = Math.max(...displayScores);
    
    state.charts.barMultiplicative = new Chart(elements.barChartMultiplicative, {
      type: "bar",
      data: {
        labels: data.map((r) => r.alternativeName),
        datasets: [{
          label: "Мультиплікативна стратегія",
          data: displayScores,
          backgroundColor: colors.multiplicative.bg,
          borderColor: colors.multiplicative.border,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: useLogAxis
              ? "Мультиплікативна [log]"
              : useLogTransform
                ? "Мультиплікативна [log₁₀]"
                : "Мультиплікативна",
            font: { family: "Unbounded", size: 13 }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                const originalValue = scores[context.dataIndex];
                return `Бал: ${formatScoreCell(originalValue, scaleMode)}`;
              }
            }
          }
        },
        scales: {
          y: {
            type: useLogAxis ? "logarithmic" : "linear",
            beginAtZero: !useLogAxis,
            min: useLogAxis ? minNonZero : undefined,
            max: useLogAxis
              ? maxScore
              : scaleMode === "normalized"
                ? 1
                : Math.ceil(maxDisplayValue * 1.25),
            title: { 
              display: true, 
              text: useLogAxis ? "log(Бал)" : useLogTransform ? "log₁₀(Бал)" : "Бал" 
            }
          }
        }
      }
    });
  }

  // Radar Chart - alternative profiles
  const firstStrategy = strategies.additive || strategies.cautious || strategies.multiplicative;
  
  if (firstStrategy && firstStrategy.results.length > 0 && firstStrategy.results[0].details) {
    const criteriaLabels = firstStrategy.results[0].details.map((d) => d.criterionName);
    
    const radarDatasets = firstStrategy.results.slice(0, 4).map((result, idx) => ({
      label: result.alternativeName,
      data: result.details.map((detail) => detail.value),
      backgroundColor: alternativeColors[idx % alternativeColors.length].bg,
      borderColor: alternativeColors[idx % alternativeColors.length].border,
      borderWidth: 2,
      pointBackgroundColor: alternativeColors[idx % alternativeColors.length].border
    }));

    state.charts.radar = new Chart(elements.radarChart, {
      type: "radar",
      data: {
        labels: criteriaLabels,
        datasets: radarDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: "Профілі альтернатив за критеріями",
            font: { family: "Unbounded", size: 14 }
          },
          legend: {
            position: "bottom"
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: scaleMode === "normalized" ? 1 : 10,
            ticks: {
              stepSize: scaleMode === "normalized" ? 0.2 : 2
            }
          }
        }
      }
    });
  }
}

function renderExplanations(strategies) {
  const strategyKeys = Object.keys(strategies);
  
  if (!strategyKeys.length) {
    elements.explanationsContent.innerHTML = "";
    return;
  }

  const cards = strategyKeys
    .map((key) => {
      const strategy = strategies[key];
      return `
        <div class="explanation-card">
          <h4>
            ${strategy.name}
            <span class="chip">${strategy.formula}</span>
          </h4>
          <pre>${strategy.explanation}</pre>
        </div>
      `;
    })
    .join("");

  elements.explanationsContent.innerHTML = cards;
}

function formatNumber(value, digits = 4) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(digits);
}

function destroyConsensusCharts() {
  for (const k of ["E7", "E1", "E2"]) {
    if (state.charts.consensus[k]) {
      state.charts.consensus[k].destroy();
      state.charts.consensus[k] = null;
    }
  }
}

function getCriterionSign(type) {
  return type === "minimize" ? -1 : 1;
}

function buildRankingFromCells(cells) {
  const altById = buildIdLookup(state.alternatives);
  const signByCritId = new Map(
    state.criteria.map((c) => [idToKey(c._id), getCriterionSign(c.type)])
  );

  // If consensus cells include pre-joined names from the backend, prefer them.
  const altNameById = new Map();
  for (const cell of cells) {
    const altId = idToKey(cell?.alternativeId);
    const altName = cell?.alternativeName;
    if (altId && typeof altName === "string" && altName.trim()) {
      if (!altNameById.has(altId)) altNameById.set(altId, altName.trim());
    }
  }

  const agg = new Map();
  for (const cell of cells) {
    const altId = idToKey(cell.alternativeId);
    const critId = idToKey(cell.criterionId);
    const value = Number(cell.value);
    if (!Number.isFinite(value)) continue;
    const sign = signByCritId.get(critId) ?? 1;

    if (!agg.has(altId)) agg.set(altId, { sum: 0, count: 0 });
    const a = agg.get(altId);
    a.sum += sign * value;
    a.count += 1;
  }

  const rows = Array.from(agg.entries())
    .map(([alternativeId, { sum, count }]) => ({
      alternativeId,
      name: altById.get(alternativeId)?.name ?? altNameById.get(alternativeId) ?? alternativeId,
      score: count ? sum / count : 0,
      count
    }))
    .sort((a, b) => b.score - a.score);

  return rows.map((r, idx) => ({ ...r, rank: idx + 1 }));
}

function renderConsensusCards(resultsByMethod) {
  if (!elements.consensusResults) return;
  destroyConsensusCharts();

  const methods = ["E7", "E1", "E2"].filter((m) => resultsByMethod[m]);
  if (!methods.length) {
    elements.consensusResults.innerHTML = '<div class="empty">Немає результатів.</div>';
    return;
  }

  const cardsHtml = methods
    .map((methodId) => {
      const data = resultsByMethod[methodId];
      const title =
        methodId === "E7"
          ? "Алгебраїчний (E7, експертиза 7)"
          : methodId === "E1"
            ? "Статистичний (E1, експертиза 1)"
            : "Статистичний (E2, експертиза 2)";

      let meta = "";
      if (methodId === "E7") meta = `variant=${escapeHtml(String(data.variant || "utilitarian"))}`;
      if (methodId === "E1") meta = "a=Σ(αᵢ·aᵢ); σ²=Σ(αᵢ·(a−aᵢ)²)";
      if (methodId === "E2") meta = data?.p ? `p=${escapeHtml(String(data.p))}` : "";

      const chartId = `consensusChart_${methodId}`;
      const rankingTableId = `consensusRanking_${methodId}`;
      const detailsId = `consensusDetails_${methodId}`;

      return `
        <div class="consensus-card" data-method="${methodId}">
          <div class="consensus-card__header">
            <div class="consensus-card__title">${escapeHtml(title)}</div>
            ${meta ? `<div class="consensus-card__meta">${escapeHtml(meta)}</div>` : ""}
            ${data?.applied?.ok ? `<div class="chip">ОЦІНКИ оновлено: ${data.applied.total}</div>` : ""}
          </div>
          <div class="table" id="${rankingTableId}"></div>
          <div class="chart-wrapper chart-wrapper--bar" style="margin-top:12px;">
            <canvas id="${chartId}"></canvas>
          </div>
          <details class="consensus-details" id="${detailsId}">
            <summary>Показати деталі</summary>
            <div class="table" style="margin-top:10px;"></div>
          </details>
        </div>
      `;
    })
    .join("");

  elements.consensusResults.innerHTML = `<div class="consensus-results-grid">${cardsHtml}</div>`;

  // Fill ranking tables + charts + details.
  for (const methodId of methods) {
    const data = resultsByMethod[methodId];
    const rankingEl = document.getElementById(`consensusRanking_${methodId}`);
    const detailsEl = document.getElementById(`consensusDetails_${methodId}`);
    const detailsTableEl = detailsEl?.querySelector(".table");
    const canvas = document.getElementById(`consensusChart_${methodId}`);

    if (!rankingEl || !canvas) continue;

    if (methodId === "E7" || methodId === "E1" || methodId === "E2") {
      const cells = Array.isArray(data?.cells) ? data.cells : [];
      const ranking = buildRankingFromCells(cells);
      const rows = ranking
        .map((r) => `<tr>
          <td><span class="rank-badge">${r.rank}</span></td>
          <td>${escapeHtml(r.name)}</td>
          <td><span class="score-cell">${formatNumber(r.score, 4)}</span></td>
          <td class="muted">n=${r.count}</td>
        </tr>`)
        .join("");
      rankingEl.innerHTML = `
        <div class="muted" style="margin-bottom:10px;">Бал = середнє Σ(sⱼ·xᵢⱼ) по критеріях, де sⱼ=+1 для maximize, sⱼ=-1 для minimize.</div>
        <table>
          <thead>
            <tr>
              <th>Місце</th>
              <th>Альтернатива</th>
              <th>Середній бал</th>
              <th class="muted">Критерії</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;

      state.charts.consensus[methodId] = new Chart(canvas, {
        type: "bar",
        data: {
          labels: ranking.map((r) => r.name),
          datasets: [
            {
              label: "Середній бал",
              data: ranking.map((r) => r.score),
              backgroundColor:
                methodId === "E7"
                  ? "rgba(58, 105, 255, 0.5)"
                  : methodId === "E1"
                    ? "rgba(187, 97, 44, 0.55)"
                    : "rgba(46, 160, 67, 0.5)",
              borderColor:
                methodId === "E7"
                  ? "rgba(58, 105, 255, 1)"
                  : methodId === "E1"
                    ? "rgba(187, 97, 44, 1)"
                    : "rgba(46, 160, 67, 1)",
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: `${methodId}: Ранжування альтернатив`, font: { family: "Unbounded", size: 13 } },
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });

      if (detailsTableEl) {
        // Compact details table: alternative, criterion, agreed value (+ key diagnostics).
        const altById = buildIdLookup(state.alternatives);
        const critById = buildIdLookup(state.criteria);
        const detailRows = cells
          .map((cell) => {
            const altId = idToKey(cell.alternativeId);
            const critId = idToKey(cell.criterionId);
            const altName = altById.get(altId)?.name ?? cell?.alternativeName ?? altId;
            const critName = critById.get(critId)?.name ?? cell?.criterionName ?? critId;
            const meta = cell.meta || {};
            const diag =
              methodId === "E7"
                ? (meta.variant === "egalitarian" ? `t=${formatNumber(meta.t, 4)}` : `F(a)=${formatNumber(meta.objective, 4)}`)
                : `σ²=${formatNumber(meta.sigma2, 4)}`;
            return {
              altName,
              critName,
              html: `<tr>
                <td>${escapeHtml(altName)}</td>
                <td>${escapeHtml(critName)}</td>
                <td><span class="score-cell">${formatNumber(cell.value, 4)}</span></td>
                <td class="muted">${escapeHtml(diag)}</td>
              </tr>`
            };
          })
          .sort((a, b) => a.altName.localeCompare(b.altName) || a.critName.localeCompare(b.critName));

        detailsTableEl.innerHTML = `
          <table>
            <thead>
              <tr>
                <th>Альтернатива</th>
                <th>Критерій</th>
                <th>Узгоджене</th>
                <th class="muted">Діагностика</th>
              </tr>
            </thead>
            <tbody>${detailRows.map((x) => x.html).join("")}</tbody>
          </table>
        `;
      }
    }
  }
}

function setConsensusStatus(message, { type = "info" } = {}) {
  if (!elements.consensusStatus) return;
  elements.consensusStatus.style.display = "block";
  elements.consensusStatus.textContent = message;
  elements.consensusStatus.classList.toggle("callout--info", type === "info");
}

function syncMethodCardSelection(formEl, inputName) {
  if (!formEl) return;
  formEl.querySelectorAll(".method-card").forEach((label) => {
    const input = label.querySelector(`input[type="radio"][name="${inputName}"]`);
    label.classList.toggle("method-card--selected", Boolean(input?.checked));
  });
}

function getSelectedConsensusMethods() {
  if (!elements.consensusForm) return [];
  return Array.from(
    elements.consensusForm.querySelectorAll('input[name="consensusMethod"]:checked')
  ).map((el) => String(el.value).trim().toUpperCase());
}

function handleConsensusMethodUI() {
  syncMethodCardSelection(elements.consensusForm, "consensusMethod");
  const methods = getSelectedConsensusMethods();
  if (!elements.consensusVariantField || !elements.consensusPField) return;

  const hasE7 = methods.includes("E7");
  const hasE1 = methods.includes("E1");
  const hasE2 = methods.includes("E2");
  elements.consensusVariantField.style.display = hasE7 ? "" : "none";
  elements.consensusPField.style.display = hasE2 ? "" : "none";

  // Only E7/E2 can be applied to the evaluations matrix.
  if (elements.consensusApplyField) {
    elements.consensusApplyField.style.display = hasE7 || hasE1 || hasE2 ? "" : "none";
  }
}

async function calculateConsensus(event) {
  event?.preventDefault?.();
  if (!elements.consensusForm) return;

  handleConsensusMethodUI();
  const formData = new FormData(elements.consensusForm);
  const methods = getSelectedConsensusMethods();
  if (!methods.length) {
    showToast("Оберіть метод.", "error");
    return;
  }

  const method = methods[0];

  const variant = String(formData.get("variant") || "utilitarian").trim().toLowerCase();
  const pRaw = String(formData.get("p") || "").trim();
  const p = pRaw ? Number(pRaw) : null;

  const applyCheckbox = elements.consensusForm.querySelector('input[name="applyToEvaluations"]');
  const applyChecked = Boolean(applyCheckbox?.checked);
  const canApply = method === "E7" || method === "E1" || method === "E2";
  const applyToEvaluations = applyChecked && canApply;

  const prevText = elements.consensusCalcBtn?.textContent;
  if (elements.consensusCalcBtn) {
    elements.consensusCalcBtn.disabled = true;
    elements.consensusCalcBtn.textContent = "Обчислення...";
  }
  if (elements.consensusResults) elements.consensusResults.innerHTML = "";
  if (elements.consensusStatus) elements.consensusStatus.style.display = "none";

  try {
    // Ensure we have alternatives/criteria loaded for id->name mapping.
    if (!state.alternatives.length || !state.criteria.length) {
      await loadData();
    }

    const reqBody = { method };
    if (method === "E7") reqBody.variant = variant || "utilitarian";
    if (method === "E2" && p != null) reqBody.p = p;
    if (applyToEvaluations) reqBody.applyToEvaluations = true;

    const result = await request(`${api.consensus}/calculate`, {
      method: "POST",
      body: JSON.stringify(reqBody)
    });

     if (Array.isArray(result?.warnings) && result.warnings.length) {
       // Show the first warning prominently; details are still available via the modal in case of errors.
       const w = result.warnings[0];
       showToast(w?.message || "Є попередження під час узгодження.", "info");
     }

    const summary = `${method}: комірок ${result.cells?.length ?? 0}`;
    setConsensusStatus(`Узгодження виконано. ${summary}.`);

    renderConsensusCards({ [method]: result });

    if (applyToEvaluations && result?.applied?.ok) {
      showToast(`Оцінки оновлено (${method}): ${result.applied.total} комірок.`);
      await loadData();

      // Make the change obvious: scroll to the matrix.
      const target = document.getElementById("evaluations") || document.getElementById("screen-model");
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      showToast("Узгодження виконано.");
    }
  } catch (error) {
    const details = error?.details;
    const html = formatImportErrors(details);
    await openModal("Помилка узгодження", html, {
      okText: "OK",
      cancelText: "Закрити",
      danger: false
    });
    showToast(error.message, "error");
  } finally {
    if (elements.consensusCalcBtn) {
      elements.consensusCalcBtn.disabled = false;
      elements.consensusCalcBtn.textContent = prevText || "Обчислити";
    }
  }
}

async function loadData() {
  const [alternatives, criteria, matrix, rules] = await Promise.all([
    request(api.alternatives),
    request(api.criteria),
    request(api.matrix),
    request(api.rules)
  ]);

  state.alternatives = alternatives;
  state.criteria = criteria;
  state.matrix = matrix;
  state.rules = Array.isArray(rules) ? rules : [];

  renderAlternatives();
  renderCriteria();
  renderMatrix();
  renderWeights();
  renderThresholds();
  renderRules();
  fillEvaluationOptions();
}

elements.alternativeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.alternativeForm);
  const payload = Object.fromEntries(formData.entries());
  const id = payload.id;
  delete payload.id;

  try {
    if (id) {
      await request(`${api.alternatives}/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      showToast("Альтернатива оновлена.");
    } else {
      await request(api.alternatives, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showToast("Альтернатива додана.");
    }
    elements.alternativeForm.reset();
    await loadData();
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.alternativeForm.querySelector("button[data-action='reset']").addEventListener(
  "click",
  () => {
    elements.alternativeForm.reset();
  }
);

elements.criterionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.criterionForm);
  const payload = Object.fromEntries(formData.entries());
  const id = payload.id;
  delete payload.id;

  try {
    if (id) {
      await request(`${api.criteria}/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      showToast("Критерій оновлений.");
    } else {
      await request(api.criteria, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showToast("Критерій доданий.");
    }
    elements.criterionForm.reset();
    await loadData();
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.criterionForm.querySelector("button[data-action='reset']").addEventListener(
  "click",
  () => {
    elements.criterionForm.reset();
  }
);

elements.evaluationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.evaluationForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    await request(api.evaluations, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showToast("Оцінка збережена.");
    elements.evaluationForm.reset();
    await loadData();
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.calculateBtn.addEventListener("click", calculateAnalytics);

if (elements.csvImportForm) {
  elements.csvImportHelpBtn?.addEventListener("click", async () => {
    await openModal(
      "Як підготувати CSV",
      `
        <p>Експортуйте відповіді Google Forms у CSV і завантажте файл сюди.</p>
        <p class="muted">Важливо: у системі мають існувати альтернативи та критерії, які відповідають заголовкам CSV (наприклад, C1..C6 та [A1 Назва]).</p>
      `,
      { okText: "Зрозуміло", cancelText: "Закрити", danger: false }
    );
  });

  elements.csvImportForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fileInput = elements.csvImportForm.querySelector('input[type="file"][name="file"]');
    const file = fileInput?.files?.[0];
    if (!file) {
      showToast("Оберіть CSV файл.", "error");
      return;
    }

    const csvText = await file.text();

    const prevText = elements.csvImportBtn?.textContent;
    if (elements.csvImportBtn) {
      elements.csvImportBtn.disabled = true;
      elements.csvImportBtn.textContent = "Імпорт...";
    }

    if (elements.csvImportStatus) {
      elements.csvImportStatus.style.display = "none";
      elements.csvImportStatus.textContent = "";
      elements.csvImportStatus.classList.remove("callout--info");
    }

    try {
      const result = await requestText(api.importCsv, csvText, {
        method: "POST",
        contentType: "text/csv"
      });
      showToast("CSV імпортовано.");

      if (elements.csvImportStatus) {
        elements.csvImportStatus.style.display = "block";
        elements.csvImportStatus.classList.add("callout--info");
        const imported = result?.imported;
        const summary = [
          typeof imported?.experts === "number" ? `Експерти: ${imported.experts}` : null,
          typeof imported?.evaluations === "number" ? `Оцінки: ${imported.evaluations}` : null,
          typeof imported?.rankings === "number" ? `Ранжування: ${imported.rankings}` : null
        ]
          .filter(Boolean)
          .join("; ");
        elements.csvImportStatus.textContent = summary ? `Імпорт успішний. ${summary}` : "Імпорт успішний.";
      }

      await loadData();
      fileInput.value = "";
    } catch (error) {
      const details = error?.details;
      const html = formatImportErrors(details);
      await openModal("Помилка імпорту CSV", html, { okText: "OK", cancelText: "Закрити", danger: false });
      showToast(error.message, "error");
    } finally {
      if (elements.csvImportBtn) {
        elements.csvImportBtn.disabled = false;
        elements.csvImportBtn.textContent = prevText || "Імпортувати";
      }
    }
  });
}

if (elements.votingImportForm) {
  syncMethodCardSelection(elements.votingImportForm, "voteMethod");
  elements.votingImportForm
    .querySelectorAll('input[name="voteMethod"]')
    .forEach((el) => el.addEventListener("change", () => syncMethodCardSelection(elements.votingImportForm, "voteMethod")));

  elements.votingImportHelpBtn?.addEventListener("click", async () => {
    await openModal(
      "Формат CSV (голосування за ваги)",
      `
        <p>Експортуйте Google Таблицю у CSV і завантажте файл сюди.</p>
        <p class="muted">Формат: перша колонка — код/ПІБ експерта. Далі колонки критеріїв <strong>C1..Cn</strong>.</p>
        <p class="muted">Значення в клітинках: або <strong>ранги 1..n</strong> (1 = найважливіший), або <strong>оцінки</strong> (більше = важливіше). Якщо це оцінки, система сама перетворить їх у ранги.</p>
      `,
      { okText: "Зрозуміло", cancelText: "Закрити", danger: false }
    );
  });

  elements.votingImportForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fileInput = elements.votingImportForm.querySelector('input[type="file"][name="file"]');
    const file = fileInput?.files?.[0];
    if (!file) {
      showToast("Оберіть CSV файл.", "error");
      return;
    }

    const method =
      elements.votingImportForm.querySelector('input[name="voteMethod"]:checked')?.value ||
      "plurality";

    const csvText = await file.text();
    const prevText = elements.votingImportBtn?.textContent;
    if (elements.votingImportBtn) {
      elements.votingImportBtn.disabled = true;
      elements.votingImportBtn.textContent = "Імпорт...";
    }

    if (elements.votingImportStatus) {
      elements.votingImportStatus.style.display = "none";
      elements.votingImportStatus.textContent = "";
      elements.votingImportStatus.classList.remove("callout--info");
    }

    try {
      const result = await requestText(`${api.voting}/import?method=${encodeURIComponent(method)}`, csvText, {
        method: "POST",
        contentType: "text/csv"
      });

      showToast("Ваги критеріїв обчислено.");
      if (elements.votingImportStatus) {
        elements.votingImportStatus.style.display = "block";
        elements.votingImportStatus.classList.add("callout--info");
        const updated = result?.applied?.updated;
        const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
        const warningText = warnings.length ? ` Попередження: ${warnings[0].message}` : "";
        elements.votingImportStatus.textContent =
          typeof updated === "number"
            ? `Ваги оновлено. Оновлених критеріїв: ${updated}.${warningText}`
            : `Ваги оновлено.${warningText}`;
      }

      if (elements.votingResults) {
        const ranked = Array.isArray(result?.ranked) ? result.ranked : [];
        const critById = buildIdLookup(state.criteria);
        if (!ranked.length) {
          elements.votingResults.innerHTML = "";
        } else {
          const rows = ranked
            .map((r, idx) => {
              const c = critById.get(idToKey(r.criterionId));
              return `<tr>
                <td><span class="rank-badge">${idx + 1}</span></td>
                <td>${escapeHtml(c?.name ?? String(r.criterionId))}</td>
                <td><span class="score-cell">${formatNumber(r.score, 4)}</span></td>
                <td><span class="score-cell">${escapeHtml(String(r.weight))}</span></td>
              </tr>`;
            })
            .join("");
          elements.votingResults.innerHTML = `
            <table>
              <thead>
                <tr>
                  <th>Місце</th>
                  <th>Критерій</th>
                  <th>Бал методу</th>
                  <th>Вага (1–10)</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          `;
        }
      }

      await loadData();
      fileInput.value = "";
    } catch (error) {
      const details = error?.details;
      const html = formatImportErrors(details);
      await openModal("Помилка імпорту голосування", html, { okText: "OK", cancelText: "Закрити", danger: false });
      showToast(error.message, "error");
    } finally {
      if (elements.votingImportBtn) {
        elements.votingImportBtn.disabled = false;
        elements.votingImportBtn.textContent = prevText || "Імпортувати та обчислити ваги";
      }
    }
  });
}

if (elements.triadsImportForm) {
  elements.triadsImportHelpBtn?.addEventListener("click", async () => {
    await openModal(
      "Формат CSV (тріади E2)",
      `
        <p>Для методу узгодження <strong>E2</strong> потрібні тріадні оцінки кожного експерта для кожної комірки (альтернатива × критерій).</p>
        <p class="muted">Формат CSV: один рядок = одна тріада.</p>
        <p class="muted">Обов'язкові колонки: <code>expert</code>, <code>alternative</code>, <code>criterion</code>, <code>optimistic</code>, <code>realistic</code>, <code>pessimistic</code>.</p>
        <p class="muted">Значення мають задовольняти: optimistic ≤ realistic ≤ pessimistic.</p>
        <pre>expert,alternative,criterion,optimistic,realistic,pessimistic
E1,Moodle,C1,2,5,8
E1,Moodle,C2,4,6,9</pre>
      `,
      { okText: "Зрозуміло", cancelText: "Закрити", danger: false }
    );
  });

  elements.triadsImportForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fileInput = elements.triadsImportForm.querySelector('input[type="file"][name="file"]');
    const file = fileInput?.files?.[0];
    if (!file) {
      showToast("Оберіть CSV файл.", "error");
      return;
    }

    const csvText = await file.text();

    const prevText = elements.triadsImportBtn?.textContent;
    if (elements.triadsImportBtn) {
      elements.triadsImportBtn.disabled = true;
      elements.triadsImportBtn.textContent = "Імпорт...";
    }

    if (elements.triadsImportStatus) {
      elements.triadsImportStatus.style.display = "none";
      elements.triadsImportStatus.textContent = "";
      elements.triadsImportStatus.classList.remove("callout--info");
    }

    try {
      const result = await requestText(api.triadsImport, csvText, {
        method: "POST",
        contentType: "text/csv"
      });

      showToast("Тріади імпортовано.");

      if (elements.triadsImportStatus) {
        elements.triadsImportStatus.style.display = "block";
        elements.triadsImportStatus.classList.add("callout--info");
        const imported = result?.imported;
        const triads = typeof imported?.triads === "number" ? `Тріади: ${imported.triads}` : null;
        const upserted =
          typeof imported?.upsertedOrModified === "number"
            ? `Оновлено/додано: ${imported.upsertedOrModified}`
            : null;
        const summary = [triads, upserted].filter(Boolean).join("; ");
        elements.triadsImportStatus.textContent = summary ? `Імпорт успішний. ${summary}` : "Імпорт успішний.";
      }

      // No need to reload the full model; E2 will read triads directly.
      fileInput.value = "";
    } catch (error) {
      const details = error?.details;
      const html = formatImportErrors(details);
      await openModal("Помилка імпорту тріад (E2)", html, { okText: "OK", cancelText: "Закрити", danger: false });
      showToast(error.message, "error");
    } finally {
      if (elements.triadsImportBtn) {
        elements.triadsImportBtn.disabled = false;
        elements.triadsImportBtn.textContent = prevText || "Імпортувати тріади (E2)";
      }
    }
  });
}

if (elements.consensusForm) {
  handleConsensusMethodUI();
  elements.consensusForm
    .querySelectorAll('input[name="consensusMethod"], input[name="applyToEvaluations"], select[name="variant"], select[name="p"]')
    .forEach((el) => el.addEventListener("change", handleConsensusMethodUI));
  elements.consensusForm.addEventListener("submit", calculateConsensus);
}

if (elements.ruleForm) {
  setRuleFormUI();
  elements.ruleForm.action?.addEventListener("change", setRuleFormUI);
  elements.ruleForm.querySelector("button[data-action='reset']")?.addEventListener("click", () => {
    elements.ruleForm.reset();
    if (elements.ruleForm.id) elements.ruleForm.id.value = "";
    setRuleFormUI();
  });

  elements.ruleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(elements.ruleForm);
    const payload = Object.fromEntries(formData.entries());

    const id = payload.id;
    delete payload.id;
    payload.enabled = elements.ruleForm.enabled?.checked ? true : false;

    try {
      if (id) {
        await request(`${api.rules}/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        showToast("Правило оновлено.");
      } else {
        await request(api.rules, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        showToast("Правило додано.");
      }
      elements.ruleForm.reset();
      if (elements.ruleForm.id) elements.ruleForm.id.value = "";
      setRuleFormUI();
      await loadData();
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

loadData().catch((error) => {
  showToast(error.message, "error");
});
