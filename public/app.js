const api = {
  alternatives: "/api/alternatives",
  criteria: "/api/criteria",
  evaluations: "/api/evaluations",
  matrix: "/api/matrix",
  analytics: "/api/analytics"
};

const state = {
  alternatives: [],
  criteria: [],
  matrix: null,
  charts: {
    barCautious: null,
    barAdditive: null,
    barMultiplicative: null,
    radar: null
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
  resultsTable: document.getElementById("resultsTable"),
  explanationsContent: document.getElementById("explanationsContent"),
  barChartCautious: document.getElementById("barChartCautious"),
  barChartAdditive: document.getElementById("barChartAdditive"),
  barChartMultiplicative: document.getElementById("barChartMultiplicative"),
  radarChart: document.getElementById("radarChart"),
  confirmModal: document.getElementById("confirmModal"),
  confirmMessage: document.getElementById("confirmMessage"),
  confirmOk: document.getElementById("confirmOk"),
  confirmCancel: document.getElementById("confirmCancel")
};

let confirmResolver = null;

function openConfirm(message) {
  elements.confirmMessage.textContent = message;
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
    const message = await response.json().catch(() => ({ message: "Error" }));
    throw new Error(message.message || "Request failed");
  }

  return response.json();
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
              ${cell.value === null ? '<span class="matrix-cell__empty">-</span>' : cell.value}
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
            value="${criterion.weight || 5}"
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
      let weight = parseInt(event.target.value, 10);
      
      if (weight < 1) weight = 1;
      if (weight > 10) weight = 10;
      event.target.value = weight;

      try {
        await request(`${api.criteria}/${criterionId}/weight`, {
          method: "PATCH",
          body: JSON.stringify({ weight })
        });
        
        const criterion = state.criteria.find((c) => c._id === criterionId);
        if (criterion) criterion.weight = weight;
        
        showToast(`Вага оновлена: ${weight}`);
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  });
}

async function calculateAnalytics() {
  const checkboxes = document.querySelectorAll('input[name="strategy"]:checked');
  const strategies = Array.from(checkboxes).map((cb) => cb.value);

  if (!strategies.length) {
    showToast("Виберіть хоча б одну стратегію.", "error");
    return;
  }

  try {
    elements.calculateBtn.disabled = true;
    elements.calculateBtn.textContent = "Розраховується...";

    const result = await request(`${api.analytics}/calculate`, {
      method: "POST",
      body: JSON.stringify({ strategies })
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
  renderRecommendation(data.recommendation);
  renderResultsTable(data.strategies);
  renderCharts(data.strategies);
  renderExplanations(data.strategies);
}

function renderRecommendation(recommendation) {
  if (!recommendation || !recommendation.winner) {
    elements.recommendationContent.innerHTML =
      '<p class="empty">Недостатньо даних для рекомендації.</p>';
    return;
  }

  elements.recommendationContent.innerHTML = `
    <div class="recommendation-winner">${recommendation.winner.alternativeName}</div>
    <div class="recommendation-score">Загальний бал: ${recommendation.winner.score.toFixed(2)}</div>
    <div class="recommendation-reason"><strong>Причина:</strong> ${recommendation.reason}</div>
  `;
}

function renderResultsTable(strategies) {
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
          const score = result ? result.score.toFixed(2) : "-";
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

function renderCharts(strategies) {
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
    const data = strategies.cautious.results;
    const maxValue = Math.max(...data.map((r) => r.score));
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
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: Math.ceil(maxValue * 1.25),
            title: { display: true, text: "Бал" }
          }
        }
      }
    });
  }

  // Render bar chart for Additive strategy
  if (strategies.additive) {
    elements.barChartAdditive.closest(".chart-wrapper").classList.remove("chart-wrapper--hidden");
    const data = strategies.additive.results;
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
            max: Math.ceil(maxValue * 1.25),
            title: { display: true, text: "Бал" }
          }
        }
      }
    });
  }

  // Render bar chart for Multiplicative strategy with logarithmic scale
  if (strategies.multiplicative) {
    elements.barChartMultiplicative.closest(".chart-wrapper").classList.remove("chart-wrapper--hidden");
    const data = strategies.multiplicative.results;
    const scores = data.map((r) => r.score);
    const maxScore = Math.max(...scores);
    
    // Use logarithmic scale if values are very large
    const useLogScale = maxScore > 10000;
    const displayScores = useLogScale ? scores.map((s) => Math.log10(s + 1)) : scores;
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
            text: useLogScale ? "Мультиплікативна [log₁₀]" : "Мультиплікативна",
            font: { family: "Unbounded", size: 13 }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                const originalValue = scores[context.dataIndex];
                return `Бал: ${originalValue.toExponential(2)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: Math.ceil(maxDisplayValue * 1.25),
            title: { 
              display: true, 
              text: useLogScale ? "log₁₀(Бал)" : "Бал" 
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
      data: result.details.map((d) => d.value),
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
            max: 10,
            ticks: {
              stepSize: 2
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

async function loadData() {
  const [alternatives, criteria, matrix] = await Promise.all([
    request(api.alternatives),
    request(api.criteria),
    request(api.matrix)
  ]);

  state.alternatives = alternatives;
  state.criteria = criteria;
  state.matrix = matrix;

  renderAlternatives();
  renderCriteria();
  renderMatrix();
  renderWeights();
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

loadData().catch((error) => {
  showToast(error.message, "error");
});
