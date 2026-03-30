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
      <td>${order.slotDate}</td>
      <td>${order.slotTime}</td>
      <td>${statusLabel(order.status)}</td>
      <td>${order.carModel}</td>
      <td>${order.plateNumber}</td>
      <td>${order.radius}</td>
      <td>${order.wheelsCount}</td>
      <td>${order.actions.join(", ") || "—"}</td>
      <td>${order.note || "—"}</td>
      <td>${order.createdAt.replace("T", " ").slice(0, 16)}</td>
    `;
    ordersBody.appendChild(row);
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
    renderOrders(data.orders);
    setStatus("");
  } catch (error) {
    setStatus("Не удалось загрузить заявки. Попробуйте позже.", "error");
  }
};

refreshBtn.addEventListener("click", loadOrders);
loadOrders();
setInterval(loadOrders, 30000);
