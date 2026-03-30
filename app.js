const form = document.getElementById("order-form");
const preview = document.getElementById("preview");
const resetBtn = document.getElementById("reset-btn");

const inputIds = ["car-model", "plate-number", "note"];
const actionSelector = "input[name='actions']";

const buildPreview = () => {
  const carModel = document.getElementById("car-model").value.trim();
  const plateNumber = document.getElementById("plate-number").value.trim();
  const note = document.getElementById("note").value.trim();

  const actions = Array.from(document.querySelectorAll(actionSelector))
    .filter((input) => input.checked)
    .map((input) => input.value);

  if (!carModel && !plateNumber && actions.length === 0 && !note) {
    preview.innerHTML = "<p class='preview__empty'>Заполните форму слева, чтобы увидеть итог.</p>";
    return;
  }

  const actionsMarkup =
    actions.length > 0
      ? `<ul class="preview__list">${actions
          .map((action) => `<li>${action}</li>`)
          .join("")}</ul>`
      : "<p class='preview__item'>Работы не выбраны</p>";

  preview.innerHTML = `
    <p class="preview__item">Модель: ${carModel || "—"}</p>
    <p class="preview__item">Госномер: ${plateNumber || "—"}</p>
    <div>
      <p class="preview__item">Работы:</p>
      ${actionsMarkup}
    </div>
    <p class="preview__item">Комментарий: ${note || "—"}</p>
  `;
};

const handleSubmit = (event) => {
  event.preventDefault();
  buildPreview();
  form.reset();
  buildPreview();
};

const handleReset = () => {
  form.reset();
  buildPreview();
};

inputIds.forEach((id) => {
  document.getElementById(id).addEventListener("input", buildPreview);
});

document.querySelectorAll(actionSelector).forEach((input) => {
  input.addEventListener("change", buildPreview);
});

form.addEventListener("submit", handleSubmit);
resetBtn.addEventListener("click", handleReset);

buildPreview();
