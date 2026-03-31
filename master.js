const ordersBody = document.getElementById("orders-body");
const ordersEmpty = document.getElementById("orders-empty");
const refreshBtn = document.getElementById("refresh-btn");
const statusBox = document.getElementById("orders-status");

const setStatus = (message, tone = "") => {
  statusBox.textContent = message;
  statusBox.className = "status";
  if (tone) {
    statusBox.classList.add(`status--${tone}`);
  }
};

const statusLabel = (value) => {
  const map = {
    new: "Новая",
    in_progress: "В работе",
    done: "Готово",
  };
  return map[value] || value || "Новая";
};

const statusOptions = (current) =>
  [
    { value: "new", label: "Новая" },
    { value: "in_progress", label: "В работе" },
    { value: "done", label: "Готово" },
  ]
    .map(
      (option) =>
        `<option value="${option.value}"${option.value === current ? " selected" : ""}>${
          option.label
        }</option>`
    )
    .join("");

const SLOT_START_MINUTES = 9 * 60;
const SLOT_END_MINUTES = 21 * 60;
const SLOT_STEP_MINUTES = 30;

const buildSlots = () => {
  const slots = [];
  for (let minutes = SLOT_START_MINUTES; minutes < SLOT_END_MINUTES; minutes += SLOT_STEP_MINUTES) {
    const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mins = String(minutes % 60).padStart(2, "0");
    slots.push(`${hours}:${mins}`);
  }
  return slots;
};

const renderTimeOptions = (select, slots, selected, placeholder) => {
  select.innerHTML = "";
  const stub = document.createElement("option");
  stub.value = "";
  stub.textContent = placeholder;
  select.appendChild(stub);

  slots.forEach((slot) => {
    const option = document.createElement("option");
    option.value = slot;
    option.textContent = slot;
    if (slot === selected) {
      option.selected = true;
    }
    select.appendChild(option);
  });
};

const fetchSlots = async (date, currentSlot) => {
  const response = await fetch(`/api/slots?date=${encodeURIComponent(date)}`);
  if (!response.ok) {
    throw new Error("Не удалось загрузить список слотов");
  }
  const data = await response.json();
  const slots = Array.isArray(data.slots) ? data.slots : [];
  if (currentSlot && !slots.includes(currentSlot)) {
    return [currentSlot, ...slots];
  }
  return slots;
};

const syncTimeOptions = async (dateInput, timeSelect, currentSlot) => {
  const dateValue = dateInput.value;
  if (!dateValue) {
    renderTimeOptions(timeSelect, [], "", "Сначала выберите дату");
    return;
  }

  const requestedDate = dateValue;
  renderTimeOptions(timeSelect, buildSlots(), currentSlot, "Загрузка...");

  try {
    const slots = await fetchSlots(dateValue, currentSlot);
    if (dateInput.value !== requestedDate) {
      return;
    }
    renderTimeOptions(timeSelect, slots, currentSlot, "Выберите время");
  } catch (error) {
    if (dateInput.value !== requestedDate) {
      return;
    }
    renderTimeOptions(timeSelect, buildSlots(), currentSlot, "Не удалось загрузить время");
  }
};

const renderOrders = (orders) => {
  ordersBody.innerHTML = "";
  if (!orders.length) {
    ordersEmpty.style.display = "block";
    return;
  }

  ordersEmpty.style.display = "none";
  orders.forEach((order) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="order-slot-date">${order.slotDate || "—"}</td>
      <td class="order-slot-time">${order.slotTime || "—"}</td>
      <td class="order-status-label">${statusLabel(order.status)}</td>
      <td>${order.carModel}</td>
      <td>${order.plateNumber}</td>
      <td>${order.phone || "—"}</td>
      <td>${order.radius}</td>
      <td>${order.wheelsCount}</td>
      <td>${order.actions.join(", ") || "—"}</td>
      <td>${order.note || "—"}</td>
      <td>${order.createdAt.replace("T", " ").slice(0, 16)}</td>
      <td>
        <div class="order-edit">
          <input type="date" class="order-date" value="${order.slotDate || ""}" />
          <select class="order-time"></select>
          <select class="order-status">${statusOptions(order.status)}</select>
          <button class="btn btn--ghost btn--small order-save">Сохранить</button>
          <button class="btn btn--ghost btn--small order-delete">Удалить</button>
        </div>
        <p class="order-message" role="status" aria-live="polite"></p>
      </td>
    `;
    ordersBody.appendChild(row);

    const dateInput = row.querySelector(".order-date");
    const timeSelect = row.querySelector(".order-time");
    const statusSelect = row.querySelector(".order-status");
    const saveBtn = row.querySelector(".order-save");
    const deleteBtn = row.querySelector(".order-delete");
    const messageBox = row.querySelector(".order-message");
    const slotDateCell = row.querySelector(".order-slot-date");
    const slotTimeCell = row.querySelector(".order-slot-time");
    const statusCell = row.querySelector(".order-status-label");

    const getCurrentSlot = () => (dateInput.value === order.slotDate ? order.slotTime : "");

    const refreshTimeOptions = (currentSlot) => {
      syncTimeOptions(dateInput, timeSelect, currentSlot);
    };

    refreshTimeOptions(getCurrentSlot());

    dateInput.addEventListener("change", () => {
      refreshTimeOptions(getCurrentSlot());
    });

    saveBtn.addEventListener("click", async () => {
      const slotDate = dateInput.value;
      const slotTime = timeSelect.value;
      const status = statusSelect.value;

      if (!slotDate || !slotTime) {
        messageBox.textContent = "Выберите дату и время.";
        messageBox.className = "order-message order-message--error";
        return;
      }

      messageBox.textContent = "Сохраняем...";
      messageBox.className = "order-message";

      try {
        const response = await fetch(`/api/orders/${order.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slotDate, slotTime, status }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Ошибка обновления");
        }

        messageBox.textContent = "Сохранено";
        messageBox.className = "order-message order-message--success";
        slotDateCell.textContent = slotDate;
        slotTimeCell.textContent = slotTime;
        statusCell.textContent = statusLabel(status);
        order.slotDate = slotDate;
        order.slotTime = slotTime;
        order.status = status;
      } catch (error) {
        messageBox.textContent = error.message || "Ошибка обновления";
        messageBox.className = "order-message order-message--error";
      }
    });

    deleteBtn.addEventListener("click", async () => {
      const confirmed = window.confirm("Удалить заявку без возможности восстановления?");
      if (!confirmed) {
        return;
      }

      messageBox.textContent = "Удаляем...";
      messageBox.className = "order-message";

      try {
        const response = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Ошибка удаления");
        }

        row.remove();
        if (!ordersBody.children.length) {
          ordersEmpty.style.display = "block";
        }
      } catch (error) {
        messageBox.textContent = error.message || "Ошибка удаления";
        messageBox.className = "order-message order-message--error";
      }
    });
  });
};

const loadOrders = async () => {
  setStatus("Обновляем список...");
  try {
    const response = await fetch("/api/orders");
    if (!response.ok) {
      throw new Error("Ошибка загрузки");
    }
    const data = await response.json();
    renderOrders(data.orders || []);
    setStatus("");
  } catch (error) {
    setStatus("Не удалось загрузить заявки. Попробуйте позже.", "error");
  }
};

refreshBtn.addEventListener("click", loadOrders);
loadOrders();
setInterval(loadOrders, 30000);
