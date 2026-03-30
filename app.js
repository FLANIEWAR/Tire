const form = document.getElementById("order-form");
const preview = document.getElementById("preview");
const resetBtn = document.getElementById("reset-btn");
const statusBox = document.getElementById("form-status");
const slotDateInput = document.getElementById("slot-date");
const slotTimeSelect = document.getElementById("slot-time");

const inputIds = [
  "car-model",
  "plate-number",
  "radius",
  "wheels-count",
  "note",
  "slot-date",
  "slot-time",
];
const actionSelector = "input[name='actions']";

const setStatus = (message, tone = "") => {
  statusBox.textContent = message;
  statusBox.className = "status";
  if (tone) {
    statusBox.classList.add(`status--${tone}`);
  }
};

const readActions = () =>
  Array.from(document.querySelectorAll(actionSelector))
    .filter((input) => input.checked)
    .map((input) => input.value);

const buildPreview = () => {
  const carModel = document.getElementById("car-model").value.trim();
  const plateNumber = document.getElementById("plate-number").value.trim();
  const radius = document.getElementById("radius").value.trim();
  const wheelsCount = document.getElementById("wheels-count").value.trim();
  const note = document.getElementById("note").value.trim();
  const slotDate = slotDateInput.value;
  const slotTime = slotTimeSelect.value;

  const actions = readActions();

  if (!carModel && !plateNumber && !radius && !wheelsCount && actions.length === 0 && !note && !slotDate && !slotTime) {
    preview.innerHTML = "<p class='preview__empty'>Заполните форму слева, чтобы увидеть итог.</p>";
    return;
  }

  const actionsMarkup =
    actions.length > 0
      ? `<ul class="preview__list">${actions.map((action) => `<li>${action}</li>`).join("")}</ul>`
      : "<p class='preview__item'>Работы не выбраны</p>";

  preview.innerHTML = `
    <p class="preview__item">Модель: ${carModel || "—"}</p>
    <p class="preview__item">Госномер: ${plateNumber || "—"}</p>
    <p class="preview__item">Радиус: ${radius || "—"}</p>
    <p class="preview__item">Кол-во колес: ${wheelsCount || "—"}</p>
    <p class="preview__item">Дата: ${slotDate || "—"}</p>
    <p class="preview__item">Время: ${slotTime || "—"}</p>
    <div>
      <p class="preview__item">Работы:</p>
      ${actionsMarkup}
    </div>
    <p class="preview__item">Комментарий: ${note || "—"}</p>
  `;
};

const isoToday = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
};

const renderSlots = (slots, message) => {
  slotTimeSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = message;
  slotTimeSelect.appendChild(placeholder);

  slots.forEach((slot) => {
    const option = document.createElement("option");
    option.value = slot;
    option.textContent = slot;
    slotTimeSelect.appendChild(option);
  });
};

const loadSlots = async (dateValue) => {
  if (!dateValue) {
    renderSlots([], "Сначала выберите дату");
    return;
  }

  slotTimeSelect.disabled = true;
  renderSlots([], "Загружаем слоты...");

  try {
    const response = await fetch(`/api/slots?date=${dateValue}`);
    if (!response.ok) {
      throw new Error("Не удалось получить слоты.");
    }
    const data = await response.json();
    if (data.slots.length === 0) {
      renderSlots([], "Нет свободных слотов");
      setStatus("На выбранную дату нет свободных слотов.", "warning");
    } else {
      renderSlots(data.slots, "Выберите время");
      setStatus("");
    }
  } catch (error) {
    renderSlots([], "Ошибка загрузки");
    setStatus("Не удалось загрузить доступные слоты. Попробуйте позже.", "error");
  } finally {
    slotTimeSelect.disabled = false;
    buildPreview();
  }
};

const handleSubmit = async (event) => {
  event.preventDefault();
  buildPreview();

  const payload = {
    carModel: document.getElementById("car-model").value.trim(),
    plateNumber: document.getElementById("plate-number").value.trim(),
    radius: Number(document.getElementById("radius").value),
    wheelsCount: Number(document.getElementById("wheels-count").value),
    actions: readActions(),
    note: document.getElementById("note").value.trim(),
    slotDate: slotDateInput.value,
    slotTime: slotTimeSelect.value,
  };

  if (!payload.slotDate || !payload.slotTime) {
    setStatus("Выберите дату и время.", "warning");
    return;
  }

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 409) {
      setStatus("Это время уже занято. Пожалуйста, выберите другое.", "warning");
      await loadSlots(payload.slotDate);
      return;
    }

    if (!response.ok) {
      throw new Error("Ошибка отправки");
    }

    setStatus("Заявка отправлена. Мы закрепили выбранное время.", "success");
    const selectedDate = slotDateInput.value;
    form.reset();
    slotDateInput.value = selectedDate;
    await loadSlots(selectedDate);
    buildPreview();
  } catch (error) {
    setStatus("Не удалось отправить заявку. Попробуйте еще раз.", "error");
  }
};

const handleReset = () => {
  form.reset();
  renderSlots([], "Сначала выберите дату");
  setStatus("");
  buildPreview();
};

inputIds.forEach((id) => {
  const element = document.getElementById(id);
  if (!element) return;
  const eventName = element.tagName === "SELECT" ? "change" : "input";
  element.addEventListener(eventName, buildPreview);
});

document.querySelectorAll(actionSelector).forEach((input) => {
  input.addEventListener("change", buildPreview);
});

slotDateInput.addEventListener("change", (event) => {
  loadSlots(event.target.value);
});

form.addEventListener("submit", handleSubmit);
resetBtn.addEventListener("click", handleReset);

slotDateInput.min = isoToday();
buildPreview();
