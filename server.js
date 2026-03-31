const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const ordersFile = path.join(dataDir, "orders.json");

const loadOrders = () => {
  if (!fs.existsSync(ordersFile)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(ordersFile, "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray(data.orders)) {
      return data.orders;
    }
    return [];
  } catch (error) {
    return [];
  }
};

const saveOrders = (orders) => {
  fs.writeFileSync(ordersFile, JSON.stringify({ orders }, null, 2));
};

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

const allowedSlots = new Set(buildSlots());

app.use(express.json());
app.use(express.static(__dirname));

app.get("/api/slots", (req, res) => {
  const date = req.query.date;
  if (!date) {
    return res.status(400).json({ error: "Дата не указана." });
  }

  const orders = loadOrders();
  const booked = new Set(
    orders.filter((order) => order.slotDate === date).map((order) => order.slotTime)
  );
  const available = buildSlots().filter((slot) => !booked.has(slot));
  return res.json({ date, slots: available });
});

app.get("/api/orders", (req, res) => {
  const orders = loadOrders()
    .slice()
    .sort((a, b) => {
      if (a.slotDate === b.slotDate) {
        return String(a.slotTime).localeCompare(String(b.slotTime));
      }
      return String(a.slotDate).localeCompare(String(b.slotDate));
    });

  res.json({ orders });
});

app.post("/api/orders", (req, res) => {
  const {
    carModel,
    plateNumber,
    radius,
    wheelsCount,
    actions = [],
    note = "",
    slotDate,
    slotTime,
    status = "new",
  } = req.body || {};

  if (!carModel || !plateNumber || !radius || !wheelsCount || !slotDate || !slotTime) {
    return res.status(400).json({ error: "Заполните все обязательные поля." });
  }

  if (!allowedSlots.has(slotTime)) {
    return res.status(400).json({ error: "Недопустимое время." });
  }

  const orders = loadOrders();
  const isTaken = orders.some(
    (order) => order.slotDate === slotDate && order.slotTime === slotTime
  );

  if (isTaken) {
    return res.status(409).json({ error: "Время уже занято." });
  }

  const nextId = orders.reduce((maxId, order) => Math.max(maxId, Number(order.id) || 0), 0) + 1;

  const order = {
    id: nextId,
    carModel: carModel.trim(),
    plateNumber: plateNumber.trim(),
    radius: Number(radius),
    wheelsCount: Number(wheelsCount),
    actions: Array.isArray(actions) ? actions : [],
    note: note.trim(),
    slotDate,
    slotTime,
    status,
    createdAt: new Date().toISOString(),
  };

  orders.push(order);
  saveOrders(orders);

  return res.status(201).json({ ok: true });
});

app.put("/api/orders/:id", (req, res) => {
  const id = Number(req.params.id);
  const { slotDate, slotTime, status = "new" } = req.body || {};

  if (!id || !slotDate || !slotTime) {
    return res.status(400).json({ error: "Заполните дату и время." });
  }

  if (!allowedSlots.has(slotTime)) {
    return res.status(400).json({ error: "Недопустимое время." });
  }

  const orders = loadOrders();
  const orderIndex = orders.findIndex((order) => Number(order.id) === id);

  if (orderIndex === -1) {
    return res.status(404).json({ error: "Заявка не найдена." });
  }

  const isTaken = orders.some(
    (order) => Number(order.id) !== id && order.slotDate === slotDate && order.slotTime === slotTime
  );

  if (isTaken) {
    return res.status(409).json({ error: "Время уже занято." });
  }

  orders[orderIndex] = {
    ...orders[orderIndex],
    slotDate,
    slotTime,
    status,
  };

  saveOrders(orders);

  return res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
