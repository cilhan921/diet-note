import "./style.css";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

const STORAGE_KEY = "diet-note-records-v1";
const app = document.querySelector("#app");

let records = loadRecords();
const now = new Date();
let selectedDate = formatDate(now);
let visibleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
let currentEditDate = selectedDate;

app.innerHTML = `
  <main class="container">
    <header class="header">
      <h1>다이어트 노트</h1>
      <p>모든 데이터는 이 기기 브라우저에 저장됩니다.</p>
    </header>

    <section class="card">
      <h2>기록 입력</h2>
      <form id="recordForm" class="form">
        <label>날짜
          <input id="date" name="date" type="date" required />
        </label>
        <label>체중 (kg)
          <input id="weight" name="weight" type="number" step="0.1" min="0" placeholder="예: 58.4" />
        </label>
        <label>운동기록
          <input id="exercise" name="exercise" type="text" placeholder="예: 30분 걷기" />
        </label>
        <div class="row">
          <label>단식 시작 (24h)
            <input id="fastStart" name="fastStart" type="text" inputmode="numeric" placeholder="예: 2030 / 9 / 23" />
          </label>
          <label>단식 종료 (24h)
            <input id="fastEnd" name="fastEnd" type="text" inputmode="numeric" placeholder="예: 1230 / 10" />
          </label>
        </div>
        <label>비용 (원)
          <input id="cost" name="cost" type="number" step="1" min="0" placeholder="예: 12000" />
        </label>
        <label>메모
          <textarea id="memo" name="memo" rows="3" placeholder="메모를 입력하세요"></textarea>
        </label>
        <button type="submit">저장하기</button>
      </form>
    </section>

    <section class="card">
      <h2>체중 그래프</h2>
      <canvas id="weightChart" width="320" height="180" aria-label="체중 그래프"></canvas>
    </section>

    <section class="card">
      <div class="calendar-head">
        <h2>운동/단식 달력</h2>
        <input id="monthPicker" type="month" />
      </div>
      <div id="calendar" class="calendar"></div>
      <p class="hint">파란 o: 운동 기록 있음 / 단식시간: 오늘 종료 - (어제 시작 우선, 없으면 최근 시작)</p>
    </section>

    <section class="card">
      <h2>월말 정리</h2>
      <div id="monthlySummary" class="summary"></div>
    </section>

    <section class="card">
      <button id="toggleRecords" class="ghost">저장된 기록 펼치기</button>
      <div id="recordsPanel" class="hidden">
        <h2>저장된 기록</h2>
        <div id="recordsList" class="records-list"></div>
      </div>
    </section>
  </main>
`;

const form = document.querySelector("#recordForm");
const monthPicker = document.querySelector("#monthPicker");
const toggleRecords = document.querySelector("#toggleRecords");
const recordsPanel = document.querySelector("#recordsPanel");
const recordsList = document.querySelector("#recordsList");

document.querySelector("#date").value = selectedDate;
monthPicker.value = visibleMonth;
fillForm(selectedDate);
renderAll();

["#fastStart", "#fastEnd"].forEach((selector) => {
  const input = document.querySelector(selector);
  input.addEventListener("blur", () => {
    const normalized = normalizeTimeInput(input.value);
    input.value = normalized;
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const date = form.date.value;
  const record = {
    date,
    weight: toNumberOrNull(form.weight.value),
    exercise: form.exercise.value.trim(),
    fastStart: normalizeTimeInput(form.fastStart.value),
    fastEnd: normalizeTimeInput(form.fastEnd.value),
    cost: toNumberOrNull(form.cost.value),
    memo: form.memo.value.trim()
  };

  form.fastStart.value = record.fastStart;
  form.fastEnd.value = record.fastEnd;

  records[date] = record;
  currentEditDate = date;
  selectedDate = date;
  saveRecords(records);
  renderAll();
});

form.date.addEventListener("change", () => {
  currentEditDate = form.date.value;
  fillForm(currentEditDate);
});

monthPicker.addEventListener("change", () => {
  visibleMonth = monthPicker.value;
  renderCalendar();
  renderMonthlySummary();
});

toggleRecords.addEventListener("click", () => {
  recordsPanel.classList.toggle("hidden");
  const expanded = !recordsPanel.classList.contains("hidden");
  toggleRecords.textContent = expanded ? "저장된 기록 접기" : "저장된 기록 펼치기";
});

function renderAll() {
  renderChart();
  renderCalendar();
  renderMonthlySummary();
  renderRecordsList();
}

function renderRecordsList() {
  const dates = Object.keys(records).sort((a, b) => b.localeCompare(a));
  if (!dates.length) {
    recordsList.innerHTML = `<p class="empty">아직 기록이 없습니다.</p>`;
    return;
  }
  recordsList.innerHTML = dates
    .map((date) => {
      const rec = records[date];
      const exerciseMark = rec.exercise ? "o" : "-";
      const fastingMinutes = calcFastingMinutesForEndDate(date);
      const fastingText = fastingMinutes != null ? formatMinutesToKorean(fastingMinutes) : "-";
      return `<div class="record-row">
        <button class="record-item" data-date="${date}">
          <strong>${date}</strong>
          <span>체중: ${rec.weight ?? "-"}</span>
          <span>운동: ${exerciseMark}</span>
          <span>단식: ${fastingText}</span>
        </button>
        <button class="delete-record" data-date="${date}" aria-label="${date} 기록 삭제">X</button>
      </div>`;
    })
    .join("");

  document.querySelectorAll(".record-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const date = btn.dataset.date;
      currentEditDate = date;
      selectedDate = date;
      form.date.value = date;
      fillForm(date);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  document.querySelectorAll(".delete-record").forEach((btn) => {
    btn.addEventListener("click", () => {
      const date = btn.dataset.date;
      delete records[date];
      saveRecords(records);

      if (currentEditDate === date) {
        const fallbackDate = findLatestRecordDate() ?? formatDate(new Date());
        currentEditDate = fallbackDate;
        selectedDate = fallbackDate;
        fillForm(fallbackDate);
      }
      renderAll();
    });
  });
}

function fillForm(date) {
  const rec = records[date];
  form.date.value = date;
  form.weight.value = rec?.weight ?? "";
  form.exercise.value = rec?.exercise ?? "";
  form.fastStart.value = rec?.fastStart ?? "";
  form.fastEnd.value = rec?.fastEnd ?? "";
  form.cost.value = rec?.cost ?? "";
  form.memo.value = rec?.memo ?? "";
}

function renderChart() {
  const canvas = document.querySelector("#weightChart");
  const ctx = canvas.getContext("2d");
  const list = Object.values(records)
    .filter((r) => r.weight != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f8f9fc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (list.length < 2) {
    ctx.fillStyle = "#63708b";
    ctx.font = "14px sans-serif";
    ctx.fillText("체중 기록 2개 이상이면 그래프가 표시됩니다.", 16, 90);
    return;
  }

  const padding = 28;
  const chartW = canvas.width - padding * 2;
  const chartH = canvas.height - padding * 2;
  const weights = list.map((r) => r.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = max - min || 1;

  ctx.strokeStyle = "#2f6df6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  list.forEach((r, i) => {
    const x = padding + (i / (list.length - 1)) * chartW;
    const y = padding + ((max - r.weight) / span) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#2f6df6";
  list.forEach((r, i) => {
    const x = padding + (i / (list.length - 1)) * chartW;
    const y = padding + ((max - r.weight) / span) * chartH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#33415c";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  const maxLabelCount = 10;
  const labelStep = Math.max(1, Math.ceil(list.length / maxLabelCount));
  list.forEach((r, i) => {
    const isEdge = i === 0 || i === list.length - 1;
    if (!isEdge && i % labelStep !== 0) return;
    const x = padding + (i / (list.length - 1)) * chartW;
    const y = padding + ((max - r.weight) / span) * chartH;
    ctx.fillText(`${r.weight.toFixed(1)}kg`, x, Math.max(12, y - 8));
  });

  ctx.fillStyle = "#63708b";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`${list[0].date}`, padding, canvas.height - 8);
  const lastText = list[list.length - 1].date;
  const lastWidth = ctx.measureText(lastText).width;
  ctx.fillText(lastText, canvas.width - padding - lastWidth, canvas.height - 8);
}

function renderCalendar() {
  const calendar = document.querySelector("#calendar");
  if (!visibleMonth) return;
  const [y, m] = visibleMonth.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const lastDate = new Date(y, m, 0).getDate();
  const startDay = first.getDay();

  const names = ["일", "월", "화", "수", "목", "금", "토"];
  const days = names.map((n) => `<div class="cell head">${n}</div>`).join("");

  let cells = "";
  for (let i = 0; i < startDay; i++) cells += `<div class="cell empty"></div>`;
  let usedCells = startDay;

  for (let day = 1; day <= lastDate; day++) {
    const date = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const rec = records[date];
    const exercise = rec?.exercise ? `<span class="exercise-dot">o</span>` : "";
    const fastMinutes = calcFastingMinutesForEndDate(date);
    const fastText = fastMinutes != null ? `<small>${formatMinutesToCompact(fastMinutes)}</small>` : `<small></small>`;

    cells += `<button class="cell day" data-date="${date}">
      <span class="day-number">${day}</span>
      ${exercise}
      ${fastText}
    </button>`;
    usedCells += 1;
  }

  while (usedCells < 42) {
    cells += `<div class="cell empty"></div>`;
    usedCells += 1;
  }

  calendar.innerHTML = days + cells;
  calendar.querySelectorAll(".day").forEach((btn) => {
    btn.addEventListener("click", () => {
      const date = btn.dataset.date;
      currentEditDate = date;
      selectedDate = date;
      form.date.value = date;
      fillForm(date);
    });
  });
}

function calcFastingMinutesForEndDate(endDate) {
  const endRec = records[endDate];
  if (!endRec?.fastEnd) return null;

  const startSource = findStartSourceForEndDate(endDate);
  if (!startSource) return null;

  const start = parseDateTime(startSource.date, startSource.fastStart);
  const end = parseDateTime(endDate, endRec.fastEnd);
  if (!start || !end || end <= start) return null;
  return Math.floor((end - start) / 60000);
}

function findStartSourceForEndDate(endDate) {
  let targetDate = dateShift(endDate, -1);
  for (let i = 0; i < 3650; i++) {
    const rec = records[targetDate];
    if (rec?.fastStart) {
      return { date: targetDate, fastStart: rec.fastStart };
    }
    targetDate = dateShift(targetDate, -1);
  }
  return null;
}

function formatMinutesToKorean(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

function formatMinutesToCompact(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function findLatestRecordDate() {
  const dates = Object.keys(records);
  if (!dates.length) return null;
  return dates.sort((a, b) => b.localeCompare(a))[0];
}

function renderMonthlySummary() {
  const target = document.querySelector("#monthlySummary");
  if (!visibleMonth) return;
  const monthRecords = Object.values(records)
    .filter((r) => r.date.startsWith(visibleMonth))
    .sort((a, b) => a.date.localeCompare(b.date));

  const weighted = monthRecords.filter((r) => r.weight != null);
  const first = weighted[0];
  const last = weighted[weighted.length - 1];
  const diff = first && last ? last.weight - first.weight : null;
  const totalCost = monthRecords.reduce((sum, r) => sum + (r.cost ?? 0), 0);

  const diffText =
    diff == null
      ? "체중 기록이 부족합니다."
      : `${first.date} -> ${last.date}: ${diff > 0 ? "+" : ""}${diff.toFixed(1)}kg`;

  target.innerHTML = `
    <p><strong>체중 변동:</strong> ${diffText}</p>
    <p><strong>월 총비용:</strong> ${totalCost.toLocaleString("ko-KR")}원</p>
  `;
}

function normalizeTimeInput(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 2) {
    const h = clamp(Number(digits), 0, 23);
    return `${String(h).padStart(2, "0")}:00`;
  }
  let h = Number(digits.slice(0, 2));
  let m = Number(digits.slice(2, 4));
  h = clamp(h, 0, 23);
  m = clamp(m, 0, 59);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseDateTime(date, hhmm) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

function dateShift(date, offset) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + offset);
  return formatDate(d);
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveRecords(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function toNumberOrNull(value) {
  if (value === "" || value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
