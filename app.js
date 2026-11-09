const SLOT_MINUTES = 15;
const START_MINUTES = 5 * 60;
const END_MINUTES = 18 * 60;
const SLOT_COUNT = (END_MINUTES - START_MINUTES) / SLOT_MINUTES;
const PROCESS_NORMS = { pick: 210, pack: 70 };
const activityLabels = { pick: "PICK", pack: "PAK", duty: "Dyżur", break: "Przerwa", clean: "Porządki", returns: "Zwroty" };

const employees = [
  { name: "Pracownik 1", group: "Zespół wydania", progress: { pick: 1.04, pack: 0.98 }, blocks: [["09:30", "11:00", "pick"], ["11:00", "11:30", "break"], ["11:30", "13:00", "pick"], ["13:00", "15:00", "pack"], ["15:00", "16:30", "pick"], ["16:30", "17:00", "duty"]] },
  { name: "Pracownik 2", group: "Zespół wydania", progress: { pick: 0.89, pack: 0.93 }, blocks: [["06:00", "09:00", "pack"], ["09:00", "09:30", "break"], ["09:30", "11:30", "pack"], ["11:30", "12:00", "break"], ["12:00", "13:30", "pick"], ["13:30", "15:00", "pack"], ["15:00", "16:00", "clean"], ["16:00", "16:30", "duty"]] },
  { name: "Pracownik 3", group: "Zespół wydania", progress: { pick: 0.86, pack: 0.84 }, blocks: [["06:00", "09:30", "pack"], ["09:30", "10:30", "pick"], ["10:30", "11:00", "break"], ["11:00", "12:30", "pack"], ["12:30", "14:30", "pack"], ["14:30", "15:00", "returns"], ["15:00", "16:30", "pack"]] },
  { name: "Pracownik 4", group: "Zespół wydania", progress: { pick: 0.98, pack: 1.03 }, blocks: [["06:30", "08:30", "pick"], ["08:30", "09:00", "break"], ["09:00", "11:30", "pack"], ["11:30", "12:00", "break"], ["12:00", "14:00", "pack"], ["14:00", "15:00", "returns"], ["15:00", "16:30", "pick"]] },
  { name: "Pracownik 5", group: "Zespół wydania", progress: { pick: 0.94, pack: 0.91 }, blocks: [["06:00", "09:00", "pick"], ["09:00", "10:00", "pack"], ["10:00", "10:30", "break"], ["10:30", "12:00", "pick"], ["12:00", "12:30", "break"], ["12:30", "14:00", "returns"], ["14:00", "16:00", "pack"]] },
  { name: "Pracownik 6", group: "Zespół wydania", progress: { pick: 0.91, pack: 0.95 }, blocks: [["07:00", "09:30", "pack"], ["09:30", "10:30", "pick"], ["10:30", "11:00", "break"], ["11:00", "13:00", "pack"], ["13:00", "15:30", "pick"], ["15:30", "16:30", "clean"], ["16:30", "17:00", "duty"]] },
  { name: "Pracownik 7", group: "Zespół wydania", progress: { pick: 1.01, pack: 0.88 }, blocks: [["06:30", "09:30", "pack"], ["09:30", "10:00", "break"], ["10:00", "12:30", "pick"], ["12:30", "14:30", "pack"], ["14:30", "15:30", "returns"], ["15:30", "17:00", "pack"]] },
  { name: "Pracownik 8", group: "Zespół wydania", progress: { pick: 0.82, pack: 1.00 }, blocks: [["08:00", "10:30", "pick"], ["10:30", "11:00", "break"], ["11:00", "12:30", "pack"], ["12:30", "14:30", "pick"], ["14:30", "15:00", "break"], ["15:00", "16:30", "pack"]] },
];

const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const activityMinutes = (employee, kind, until = END_MINUTES) => employee.blocks.reduce((sum, [start, end, activity]) => {
  if (activity !== kind) return sum;
  const fromMinute = timeToMinutes(start);
  const toMinute = Math.min(timeToMinutes(end), until);
  return sum + Math.max(0, toMinute - fromMinute);
}, 0);

const targetFor = (employee, process) => Math.round(activityMinutes(employee, process) / 60 * PROCESS_NORMS[process]);
const dailyWorkedHours = (employee) => employee.blocks.reduce((sum, [start, end, kind]) => kind === "break" ? sum : sum + (timeToMinutes(end) - timeToMinutes(start)) / 60, 0);
const currentActual = (employee, process) => Math.round(activityMinutes(employee, process, 10 * 60) / 60 * PROCESS_NORMS[process] * employee.progress[process]);
const currentPlan = (employee, process) => Math.round(activityMinutes(employee, process, 10 * 60) / 60 * PROCESS_NORMS[process]);
const slotsAt = (time) => (timeToMinutes(time) - START_MINUTES) / SLOT_MINUTES;

function renderTimeHeader() {
  const header = document.createElement("div");
  header.className = "time-header";
  header.append(createElement("div", "employee-head", "Pracownik"));
  for (let hour = 5; hour < 18; hour += 1) {
    const label = createElement("div", "hour-block", `${String(hour).padStart(2, "0")}:00`);
    label.style.gridColumn = `${2 + (hour - 5) * 4} / span 4`;
    label.style.gridRow = "1";
    header.append(label);
  }
  for (let half = 0; half < 26; half += 1) {
    const hour = 5 + Math.floor(half / 2);
    const minute = half % 2 ? "30" : "00";
    const tick = createElement("div", "half-hour-tick", `${String(hour).padStart(2, "0")}:${minute}`);
    tick.style.gridColumn = `${2 + half * 2} / span 2`;
    tick.style.gridRow = "2";
    header.append(tick);
  }
  return header;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderSchedule() {
  const grid = document.getElementById("schedule-grid");
  grid.replaceChildren(renderTimeHeader());
  const groupRow = createElement("div", "group-row");
  const groupLabel = createElement("div", "group-label", "Zespół wydania · 8 osób");
  groupRow.append(groupLabel);
  grid.append(groupRow);

  employees.forEach((employee) => {
    const row = createElement("div", "employee-row");
    const name = createElement("div", "employee-name", employee.name);
    name.style.gridColumn = "1";
    row.append(name);
    for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
      const cell = createElement("div", "employee-cell");
      cell.style.gridColumn = String(slot + 2);
      cell.setAttribute("aria-hidden", "true");
      row.append(cell);
    }
    employee.blocks.forEach(([start, end, kind], index) => {
      const block = createElement("button", `activity-block ${kind}`, activityLabels[kind]);
      block.type = "button";
      block.style.gridColumn = `${2 + slotsAt(start)} / span ${(timeToMinutes(end) - timeToMinutes(start)) / SLOT_MINUTES}`;
      block.dataset.employee = employee.name;
      block.dataset.blockIndex = String(index);
      block.setAttribute("aria-label", `${employee.name}: ${activityLabels[kind]}, od ${start} do ${end}. Wybierz, aby zmienić czynność.`);
      block.setAttribute("aria-pressed", "false");
      block.addEventListener("click", () => openActivityDialog(employee, index, block));
      row.append(block);
    });
    grid.append(row);
  });

  const rail = createElement("div", "grid-rail");
  rail.append(createElement("div", "rail-label", "Punkty kontrolne"));
  const dayOfWeek = new Date(`${document.getElementById("plan-date").value}T12:00:00`).getDay();
  const inpostCutoff = dayOfWeek === 1 ? "12:00" : "16:00";
  const cutoffItems = [
    { time: "10:00", label: "Cutoff Allegro One" },
    { time: "12:00", label: dayOfWeek === 1 ? "Pozostali + InPost / Orlen (pn)" : "Pozostali kurierzy" },
  ];
  if (dayOfWeek !== 1) cutoffItems.push({ time: inpostCutoff, label: "InPost / Orlen" });
  cutoffItems.forEach((item) => {
    const marker = createElement("div", "cutoff-marker");
    marker.style.gridColumn = `${2 + slotsAt(item.time)} / span 8`;
    marker.append(createElement("b", "", item.time), document.createTextNode(` ${item.label}`));
    rail.append(marker);
  });
  grid.append(rail);
}

function renderNorms() {
  const body = document.querySelector("#norms-table tbody");
  const foot = document.querySelector("#norms-table tfoot");
  body.replaceChildren();
  let totalPick = 0;
  let totalPack = 0;
  let totalHours = 0;
  employees.forEach((employee) => {
    const pick = targetFor(employee, "pick");
    const pack = targetFor(employee, "pack");
    totalPick += pick; totalPack += pack; totalHours += dailyWorkedHours(employee);
    const row = document.createElement("tr");
    [employee.name, formatNumber(pick), formatNumber(pack), `${dailyWorkedHours(employee).toFixed(1).replace(".", ",")} h`].forEach((value) => row.append(createElement("td", "", value)));
    body.append(row);
  });
  foot.replaceChildren();
  const totalRow = document.createElement("tr");
  ["Razem · 8 osób", formatNumber(totalPick), formatNumber(totalPack), `${totalHours.toFixed(1).replace(".", ",")} h`].forEach((value) => totalRow.append(createElement("td", "", value)));
  foot.append(totalRow);
}

function renderActuals() {
  const body = document.querySelector("#actual-table tbody");
  const foot = document.querySelector("#actual-table tfoot");
  body.replaceChildren();
  let pickGoal = 0, packGoal = 0, pickDone = 0, packDone = 0;
  employees.forEach((employee) => {
    const pickGoalPerson = targetFor(employee, "pick");
    const packGoalPerson = targetFor(employee, "pack");
    const pickDonePerson = currentActual(employee, "pick");
    const packDonePerson = currentActual(employee, "pack");
    pickGoal += pickGoalPerson; packGoal += packGoalPerson; pickDone += pickDonePerson; packDone += packDonePerson;
    const processPercents = [];
    if (pickGoalPerson) processPercents.push(pickDonePerson / pickGoalPerson * 100);
    if (packGoalPerson) processPercents.push(packDonePerson / packGoalPerson * 100);
    const completion = Math.round(processPercents.reduce((a, b) => a + b, 0) / processPercents.length || 0);
    const row = document.createElement("tr");
    row.append(createElement("td", "", employee.name));
    row.append(createElement("td", "", `${formatNumber(pickDonePerson)} / ${formatNumber(pickGoalPerson)}`));
    row.append(createElement("td", "", `${formatNumber(packDonePerson)} / ${formatNumber(packGoalPerson)}`));
    const percent = createElement("td");
    percent.append(createElement("span", `completion ${completion >= 90 ? "good" : "behind"}`, `${completion}%`));
    row.append(percent);
    body.append(row);
  });
  foot.replaceChildren();
  const row = document.createElement("tr");
  row.append(createElement("td", "", "Razem · zespół"));
  row.append(createElement("td", "", `${formatNumber(pickDone)} / ${formatNumber(pickGoal)}`));
  row.append(createElement("td", "", `${formatNumber(packDone)} / ${formatNumber(packGoal)}`));
  row.append(createElement("td", "", "—"));
  foot.append(row);
}

function renderPace() {
  const container = document.getElementById("pace-rows");
  container.replaceChildren();
  ["pick", "pack"].forEach((process) => {
    const actual = employees.reduce((sum, employee) => sum + currentActual(employee, process), 0);
    const plan = employees.reduce((sum, employee) => sum + currentPlan(employee, process), 0);
    const variance = actual - plan;
    const pct = plan ? Math.round(actual / plan * 100) : 0;
    const behind = variance < 0;
    const row = createElement("div", "pace-row");
    row.append(createElement("span", `process-pill ${process}`, activityLabels[process]));
    const actualLabel = createElement("span", "pace-number");
    actualLabel.append(document.createTextNode("Wykonanie"), createElement("b", "", formatNumber(actual)));
    row.append(actualLabel);
    const planLabel = createElement("span", "pace-number");
    planLabel.append(document.createTextNode("Plan narastająco"), createElement("b", "", formatNumber(plan)));
    row.append(planLabel);
    const progress = createElement("div", "progress-wrap");
    const track = createElement("div", "progress-track");
    const fill = createElement("div", `progress-fill${behind ? " behind" : ""}`);
    fill.style.width = `${Math.min(pct, 100)}%`;
    track.append(fill);
    progress.append(track, createElement("span", "progress-label", `${pct}%`));
    row.append(progress);
    const statusText = `${variance > 0 ? "+" : ""}${formatNumber(variance)} · ${behind ? "poniżej planu" : variance === 0 ? "zgodnie z planem" : "powyżej planu"}`;
    row.append(createElement("span", `pace-status ${behind ? "behind" : "good"}`, statusText));
    container.append(row);
  });
}

const orderFlow = {
  plannedPL:    [1, 0, 1, 1, 1, 2, 3, 1, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 0],
  plannedUnder: [15,14,30,28,36,35,56,52,51,50,50,50,40,40,40,40,40,40,40,40,40,40,0,0],
  actualPL:     [1, 0, 1, 1, 2, 1, 3, 1],
  actualUnder:  [15,14,28,29,36,35,50,52],
  morningPL: 164,
  morningUnder: 3033,
  observedThrough: "10:00",
};

function renderOrders() {
  const tableBody = document.querySelector("#orders-flow-table tbody");
  const tableFoot = document.querySelector("#orders-flow-table tfoot");
  tableBody.replaceChildren();
  tableFoot.replaceChildren();
  let planPlDay = 0, planUnderDay = 0, planPlToNow = 0, planUnderToNow = 0;
  let actualPlToNow = 0, actualUnderToNow = 0;
  const observedSlotCount = (timeToMinutes(orderFlow.observedThrough) - 6 * 60) / 30;

  for (let slot = 0; slot < 24; slot += 1) {
    const start = 6 * 60 + slot * 30;
    const end = start + 30;
    const formatTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    const planPl = orderFlow.plannedPL[slot] ?? 0;
    const planUnder = orderFlow.plannedUnder[slot] ?? 0;
    const observed = slot < observedSlotCount;
    const actualPl = observed ? (orderFlow.actualPL[slot] ?? 0) : null;
    const actualUnder = observed ? (orderFlow.actualUnder[slot] ?? 0) : null;
    const actualSum = observed ? actualPl + actualUnder : null;
    const planSum = planPl + planUnder;
    const row = document.createElement("tr");
    if (start === timeToMinutes(orderFlow.observedThrough)) row.className = "current-slot";
    const cells = [
      `${formatTime(start)}–${formatTime(end)}`,
      formatNumber(planPl), formatNumber(planUnder), formatNumber(planSum),
      observed ? formatNumber(actualPl) : "—", observed ? formatNumber(actualUnder) : "—", observed ? formatNumber(actualSum) : "—",
    ];
    cells.forEach((value) => row.append(createElement("td", "", value)));
    if (observed) {
      const variance = actualSum - planSum;
      const varianceCell = createElement("td", variance > 0 ? "variance-positive" : variance < 0 ? "variance-negative" : "", `${variance > 0 ? "+" : ""}${formatNumber(variance)}`);
      row.append(varianceCell);
      planPlToNow += planPl; planUnderToNow += planUnder;
      actualPlToNow += actualPl; actualUnderToNow += actualUnder;
    } else {
      row.append(createElement("td", "", "—"));
    }
    planPlDay += planPl; planUnderDay += planUnder;
    tableBody.append(row);
  }

  const planTotal = document.createElement("tr");
  planTotal.append(createElement("td", "", "Planowany napływ · cały dzień"));
  [planPlDay, planUnderDay, planPlDay + planUnderDay, null, null, null, null].forEach((value) => planTotal.append(createElement("td", "", value === null ? "—" : formatNumber(value))));
  tableFoot.append(planTotal);

  const actualTotal = document.createElement("tr");
  actualTotal.append(createElement("td", "", `Rzeczywisty · do ${orderFlow.observedThrough}`));
  [planPlToNow, planUnderToNow, planPlToNow + planUnderToNow, actualPlToNow, actualUnderToNow, actualPlToNow + actualUnderToNow, actualPlToNow + actualUnderToNow - planPlToNow - planUnderToNow].forEach((value, index) => {
    const cls = index === 6 ? value > 0 ? "variance-positive" : value < 0 ? "variance-negative" : "" : "";
    actualTotal.append(createElement("td", cls, `${index === 6 && value > 0 ? "+" : ""}${formatNumber(value)}`));
  });
  tableFoot.append(actualTotal);

  document.getElementById("morning-total").textContent = formatNumber(orderFlow.morningPL + orderFlow.morningUnder);
  document.getElementById("morning-pl").textContent = formatNumber(orderFlow.morningPL);
  document.getElementById("morning-under").textContent = formatNumber(orderFlow.morningUnder);
  const forecastToCutoff = orderFlow.plannedPL.slice(0, 20).reduce((sum, value) => sum + value, 0) + orderFlow.plannedUnder.slice(0, 20).reduce((sum, value) => sum + value, 0);
  const summary = document.getElementById("orders-summary");
  summary.replaceChildren();
  [
    ["Pula startowa · 06:00", formatNumber(orderFlow.morningPL + orderFlow.morningUnder), "zamówień"],
    [".PL · oczekujące", formatNumber(orderFlow.morningPL), "zamówień"],
    ["_PL · oczekujące", formatNumber(orderFlow.morningUnder), "zamówień"],
    ["Prognozowany napływ", formatNumber(forecastToCutoff), "06:00–16:00 · demonstracyjnie"],
  ].forEach(([label, value, detail]) => {
    const stat = createElement("div", "order-stat");
    stat.append(createElement("span", "", label), createElement("strong", "", value), createElement("small", "", detail));
    summary.append(stat);
  });
}

function switchTab(activeButton, activePanel, inactiveButton, inactivePanel) {
  activeButton.classList.add("is-active");
  inactiveButton.classList.remove("is-active");
  activeButton.setAttribute("aria-selected", "true");
  inactiveButton.setAttribute("aria-selected", "false");
  activePanel.hidden = false;
  inactivePanel.hidden = true;
}

document.getElementById("tab-work").addEventListener("click", () => switchTab(document.getElementById("tab-work"), document.getElementById("work-view"), document.getElementById("tab-orders"), document.getElementById("orders-view")));
document.getElementById("tab-orders").addEventListener("click", () => switchTab(document.getElementById("tab-orders"), document.getElementById("orders-view"), document.getElementById("tab-work"), document.getElementById("work-view")));

function formatNumber(number) { return new Intl.NumberFormat("pl-PL").format(number); }

const dialog = document.getElementById("activity-dialog");
let selectedActivityBlock = null;
let editingEnabled = false;
function openActivityDialog(employee, blockIndex, button) {
  if (!editingEnabled) {
    showToast("Wybierz „Edytuj plan”, aby zmienić demonstracyjny harmonogram.");
    return;
  }
  selectedActivityBlock = { employee, blockIndex, button };
  document.getElementById("dialog-title").textContent = `${employee.name} · wybierz czynność`;
  document.getElementById("activity-select").value = employee.blocks[blockIndex][2];
  dialog.showModal();
}

document.getElementById("save-activity").addEventListener("click", (event) => {
  event.preventDefault();
  if (!selectedActivityBlock) return;
  const { employee, blockIndex } = selectedActivityBlock;
  const chosenActivity = document.getElementById("activity-select").value;
  if (chosenActivity === "remove") employee.blocks.splice(blockIndex, 1);
  else employee.blocks[blockIndex][2] = chosenActivity;
  renderSchedule(); renderNorms(); renderActuals(); renderPace();
  dialog.close();
  showToast("Zmieniono blok w lokalnej makiecie. Dane nie są zapisywane do n8n.");
});

document.getElementById("edit-mode").addEventListener("click", (event) => {
  editingEnabled = !editingEnabled;
  event.currentTarget.classList.toggle("is-active", editingEnabled);
  event.currentTarget.setAttribute("aria-pressed", String(editingEnabled));
  showToast(editingEnabled ? "Tryb edycji makiety włączony. Wybierz blok harmonogramu." : "Tryb edycji wyłączony.");
});

document.getElementById("recalculate").addEventListener("click", () => {
  renderNorms(); renderActuals(); renderPace();
  showToast("Odświeżono obliczenia demonstracyjne. Backend n8n nie jest jeszcze podłączony.");
});

document.getElementById("toggle-groups").addEventListener("click", (event) => {
  const rows = document.querySelectorAll(".employee-row");
  const collapsed = event.currentTarget.getAttribute("aria-expanded") === "false";
  rows.forEach((row) => { row.hidden = !collapsed; });
  event.currentTarget.setAttribute("aria-expanded", String(collapsed));
  event.currentTarget.textContent = collapsed ? "⌃" : "⌄";
});

document.getElementById("plan-date").addEventListener("change", (event) => {
  if (!event.target.value) return;
  const selected = new Date(`${event.target.value}T12:00:00`);
  document.getElementById("day-label").textContent = new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(selected);
  renderSchedule();
  showToast("Zmieniono datę widoku demonstracyjnego. Grafik jest przykładowy.");
});

let toastTimeout;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 3300);
}

renderSchedule();
renderNorms();
renderActuals();
renderPace();
renderOrders();
