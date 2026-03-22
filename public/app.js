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
  matrix: null
};

const elements = {
  alternativesTable: document.getElementById("alternativesTable"),
  criteriaTable: document.getElementById("criteriaTable"),
  matrixTable: document.getElementById("matrixTable"),
  alternativeForm: document.getElementById("alternativeForm"),
  criterionForm: document.getElementById("criterionForm"),
  evaluationForm: document.getElementById("evaluationForm"),
  analyticsStatus: document.getElementById("analyticsStatus")
};

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

  elements.alternativesTable.querySelectorAll("button[data-action='edit']").forEach(
    (button) => {
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
    }
  );
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

  elements.criteriaTable.querySelectorAll("button[data-action='edit']").forEach(
    (button) => {
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
    }
  );
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
            <td>
              ${cell.value === null ? "-" : cell.value}
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

elements.analyticsStatus.addEventListener("click", async () => {
  try {
    const response = await request(api.analytics);
    showToast(response.message);
  } catch (error) {
    showToast(error.message, "error");
  }
});

loadData().catch((error) => {
  showToast(error.message, "error");
});
