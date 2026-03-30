const express = require("express");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "tire.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    car_model TEXT NOT NULL,
    plate_number TEXT NOT NULL,
    radius INTEGER NOT NULL,
    wheels_count INTEGER NOT NULL,
    actions TEXT NOT NULL,
    note TEXT,
    slot_date TEXT NOT NULL,
    slot_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL,
    UNIQUE(slot_date, slot_time)
  );
`);

try {
  db.exec(`ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'new';`);
} catch (error) {
  // column exists
}

const insertOrder = db.prepare(`
  INSERT INTO orders (
    car_model,
    plate_number,
    radius,
    wheels_count,
    actions,
    note,
    slot_date,
    slot_time,
    status,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`);

const listOrders = db.prepare(`
  SELECT
    car_model,
    plate_number,
    radius,
    wheels_count,
    actions,
    note,
    slot_date,
    slot_time,
    status,
    created_at
  FROM orders
  ORDER BY slot_date ASC, slot_time ASC;
`);

const bookedSlots = db.prepare(`
  SELECT slot_time
  FROM orders
  WHERE slot_date = ?;
`);

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

  const booked = new Set(bookedSlots.all(date).map((row) => row.slot_time));
  const available = buildSlots().filter((slot) => !booked.has(slot));
  return res.json({ date, slots: available });
});

app.get("/api/orders", (req, res) => {
  const orders = listOrders.all().map((row) => ({
    carModel: row.car_model,
    plateNumber: row.plate_number,
    radius: row.radius,
    wheelsCount: row.wheels_count,
    actions: JSON.parse(row.actions || "[]"),
    note: row.note || "",
    slotDate: row.slot_date,
    slotTime: row.slot_time,
    status: row.status || "new",
    createdAt: row.created_at,
  }));

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

  try {
    insertOrder.run(
      carModel.trim(),
      plateNumber.trim(),
      Number(radius),
      Number(wheelsCount),
      JSON.stringify(actions),
      note.trim(),
      slotDate,
      slotTime,
      status,
      new Date().toISOString()
    );
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      return res.status(409).json({ error: "Время уже занято." });
    }
    return res.status(500).json({ error: "Не удалось сохранить заявку." });
  }

  return res.status(201).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
