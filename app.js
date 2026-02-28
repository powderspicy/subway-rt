const builtInTemplates = [
  {
    id: "morning",
    label: "Morning Express",
    name: "Morning Express",
    steps: [
      ["Brush teeth", 10],
      ["Get dressed", 10],
      ["Eat breakfast", 15],
      ["Pack bag", 5],
      ["Head out", 8],
    ],
  },
  {
    id: "workday",
    label: "Workday Launch",
    name: "Workday Launch",
    steps: [
      ["Review priorities", 12],
      ["Email triage", 20],
      ["Deep work block", 45],
      ["Break", 10],
      ["Team sync", 30],
    ],
  },
  {
    id: "evening",
    label: "Evening Wind-Down",
    name: "Evening Wind-Down",
    steps: [
      ["Kitchen reset", 15],
      ["Prep tomorrow", 12],
      ["Shower", 10],
      ["Read", 20],
      ["Lights out", 5],
    ],
  },
];

const stationSuffixes = ["Ave", "Junction", "Crossing", "Terminal", "Square", "Heights", "Point", "Wharf", "Central"];
const SAVED_TEMPLATES_KEY = "subway_routine_saved_templates_v1";
const LINE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789".split("");
const LINE_COLOR_PALETTE = [
  "#0039A6",
  "#EE352E",
  "#00933C",
  "#B933AD",
  "#996633",
  "#808183",
  "#6CBE45",
  "#FCCC0A",
  "#00A1DE",
  "#FF6319",
  "#A7A9AC",
  "#8E44AD",
  "#00B894",
  "#E84393",
  "#FD79A8",
  "#6C5CE7",
  "#0984E3",
  "#2D3436",
  "#D63031",
  "#00CEC9",
  "#E17055",
  "#00A8FF",
  "#C0392B",
  "#16A085",
  "#D980FA",
  "#FF00AA",
];
const STATION_DWELL_REAL_MS = 10000;

const els = {
  templateSelect: document.getElementById("templateSelect"),
  loadTemplateBtn: document.getElementById("loadTemplateBtn"),
  saveTemplateBtn: document.getElementById("saveTemplateBtn"),
  routineName: document.getElementById("routineName"),
  stepsInput: document.getElementById("stepsInput"),
  buildBtn: document.getElementById("buildBtn"),
  startBtn: document.getElementById("startBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  resumeBtn: document.getElementById("resumeBtn"),
  skipBtn: document.getElementById("skipBtn"),
  resetBtn: document.getElementById("resetBtn"),
  speedSlider: document.getElementById("speedSlider"),
  speedValue: document.getElementById("speedValue"),
  lineBadge: document.getElementById("lineBadge"),
  lineTitle: document.getElementById("lineTitle"),
  countdown: document.getElementById("countdown"),
  delayTimer: document.getElementById("delayTimer"),
  announcement: document.getElementById("announcement"),
  mapSvg: document.getElementById("mapSvg"),
  historyBody: document.getElementById("historyBody"),
  useActualBtn: document.getElementById("useActualBtn"),
};

const state = {
  route: null,
  runStatus: "idle",
  currentSegment: 0,
  rafId: null,
  segmentStartTs: 0,
  segmentDurationMs: 0,
  pauseStartTs: 0,
  speedSecPerMin: 60,
  realtimeMode: true,
  trainPos: null,
  segmentDelayMs: 0,
  delayStartTs: 0,
  isDelayActive: false,
  history: [],
  lineStyle: randomLineStyle(),
  lastTickTs: 0,
  runSimElapsedMs: 0,
  nextConductorSimMs: 2 * 60 * 1000,
  nextTrainFxSimMs: 60 * 1000,
  audioCtx: null,
  savedTemplates: [],
  preferredLineStyle: null,
  isDwellActive: false,
  dwellTimeoutId: null,
  dwellStartedTs: 0,
  dwellRemainingMs: STATION_DWELL_REAL_MS,
  approachAnnounced: false,
};

init();

function init() {
  state.savedTemplates = loadSavedTemplates();
  initTemplates();
  bindEvents();
  loadTemplate(`builtin:${builtInTemplates[0].id}`);
  buildRouteFromInput();
  syncSpeedFromSlider();
  updateSpeedControls();
  updateControlState();
}

function bindEvents() {
  els.loadTemplateBtn.addEventListener("click", () => loadTemplate(els.templateSelect.value));
  els.saveTemplateBtn.addEventListener("click", saveCurrentLineTemplate);
  els.buildBtn.addEventListener("click", buildRouteFromInput);
  els.startBtn.addEventListener("click", startRun);
  els.pauseBtn.addEventListener("click", pauseRun);
  els.resumeBtn.addEventListener("click", resumeRun);
  els.skipBtn.addEventListener("click", skipStop);
  els.resetBtn.addEventListener("click", resetRun);
  els.useActualBtn.addEventListener("click", applyActualsToInput);

  els.speedSlider.addEventListener("input", () => {
    if (state.runStatus === "idle" || state.runStatus === "completed") {
      syncSpeedFromSlider();
      updateSpeedControls();
    }
  });

  window.addEventListener("keydown", handleShortcutKeys);
}

function updateSpeedControls() {
  els.speedSlider.disabled = state.runStatus === "running" || state.runStatus === "paused";
  els.speedValue.textContent = state.realtimeMode ? "Real-time" : `${state.speedSecPerMin} sec / minute`;
}

function syncSpeedFromSlider() {
  const value = Number(els.speedSlider.value);
  state.realtimeMode = value >= 11;
  state.speedSecPerMin = state.realtimeMode ? 60 : value;
  state.nextConductorSimMs = initialConductorIntervalMs();
  state.nextTrainFxSimMs = initialTrainFxIntervalMs();
}

function initialConductorIntervalMs() {
  return state.realtimeMode ? 2 * 60 * 1000 : (2 + Math.random() * 2) * 60000;
}

function initialTrainFxIntervalMs() {
  return state.realtimeMode ? 27 * 1000 : (0.75 + Math.random() * 1.5) * 60000;
}

function nextConductorIntervalMs() {
  return state.realtimeMode ? 2 * 60 * 1000 : (2 + Math.random() * 3) * 60000;
}

function nextTrainFxIntervalMs() {
  return state.realtimeMode ? 27 * 1000 : (0.9 + Math.random() * 1.8) * 60000;
}

function initTemplates() {
  els.templateSelect.innerHTML = "";
  builtInTemplates.forEach((tpl) => {
    const opt = document.createElement("option");
    opt.value = `builtin:${tpl.id}`;
    opt.textContent = tpl.label;
    els.templateSelect.appendChild(opt);
  });

  state.savedTemplates.forEach((tpl) => {
    const opt = document.createElement("option");
    opt.value = `saved:${tpl.id}`;
    opt.textContent = `Saved: ${tpl.label}`;
    els.templateSelect.appendChild(opt);
  });
}

function loadTemplate(key) {
  const [kind, id] = String(key).split(":");
  const source = kind === "saved" ? state.savedTemplates : builtInTemplates;
  const tpl = source.find((t) => t.id === id);
  if (!tpl) {
    return;
  }
  els.routineName.value = tpl.name;
  els.stepsInput.value = tpl.steps.map(([name, min]) => `${name},${min}`).join("\n");
  state.preferredLineStyle = tpl.lineStyle || null;
}

function saveCurrentLineTemplate() {
  try {
    const steps = parseSteps(els.stepsInput.value);
    const name = (els.routineName.value || "").trim() || "Custom Line";
    const id = slugify(name);

    const template = {
      id,
      label: name,
      name,
      steps: steps.map((s) => [s.activity, s.plannedMin]),
      lineStyle: state.route ? state.lineStyle : randomLineStyle(),
    };

    const existingIdx = state.savedTemplates.findIndex((t) => t.id === id);
    if (existingIdx >= 0) {
      state.savedTemplates[existingIdx] = template;
    } else {
      state.savedTemplates.push(template);
    }

    saveSavedTemplates(state.savedTemplates);
    initTemplates();
    els.templateSelect.value = `saved:${id}`;
    setAnnouncement(`Saved line template: ${name}.`);
  } catch (err) {
    setAnnouncement(`Save failed: ${err.message}`);
  }
}

function loadSavedTemplates() {
  try {
    const raw = localStorage.getItem(SAVED_TEMPLATES_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && item.id && item.name && Array.isArray(item.steps))
      .map((item) => ({
        ...item,
        lineStyle: normalizeLineStyle(item.lineStyle),
      }));
  } catch (_err) {
    return [];
  }
}

function saveSavedTemplates(templates) {
  localStorage.setItem(SAVED_TEMPLATES_KEY, JSON.stringify(templates));
}

function slugify(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `line-${Date.now()}`;
}

function normalizeLineStyle(style) {
  if (!style || typeof style !== "object") {
    return randomLineStyle();
  }
  const badge = typeof style.badge === "string" && style.badge ? style.badge.slice(0, 1).toUpperCase() : null;
  const color = typeof style.color === "string" && /^#[0-9a-fA-F]{6}$/.test(style.color) ? style.color : null;
  if (!badge || !color) {
    return randomLineStyle();
  }
  return { badge, color, text: isLightHex(color) ? "#111" : "#fff" };
}

function isLightHex(hexColor) {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) {
    return false;
  }
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 170;
}

function toStationName(activity, idx) {
  const clean = activity
    .replace(/[^\w\s]/g, "")
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return `${clean} ${stationSuffixes[idx % stationSuffixes.length]}`;
}

function parseSteps(raw) {
  const rows = raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const steps = rows.map((row, idx) => {
    const parts = row.split(",");
    if (parts.length < 2) {
      throw new Error(`Invalid line ${idx + 1}. Use: activity,minutes`);
    }

    const activity = parts.slice(0, -1).join(",").trim();
    const min = Number(parts.at(-1).trim());

    if (!activity) {
      throw new Error(`Line ${idx + 1} is missing activity name.`);
    }
    if (!Number.isFinite(min) || min <= 0) {
      throw new Error(`Line ${idx + 1} has invalid minutes.`);
    }

    return {
      activity,
      plannedMin: min,
      stationName: toStationName(activity, idx),
    };
  });

  if (steps.length < 1) {
    throw new Error("Add at least one step.");
  }

  return steps;
}

function randomLineStyle() {
  const badge = LINE_CHARS[Math.floor(Math.random() * LINE_CHARS.length)];
  const color = LINE_COLOR_PALETTE[Math.floor(Math.random() * LINE_COLOR_PALETTE.length)];
  return { badge, color, text: isLightHex(color) ? "#111" : "#fff" };
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pickRandomDifferent(current, options) {
  const choices = options.filter((opt) => opt !== current);
  return choices[Math.floor(Math.random() * choices.length)];
}

function createTransferLineData(points, mainStyle) {
  const stationCount = points.length;
  const candidates = [];
  for (let i = 0; i < stationCount - 1; i += 1) {
    candidates.push(i);
  }
  if (candidates.length === 0) {
    return null;
  }

  const desired = candidates.length >= 6 ? 2 : 1;
  const picked = [];
  while (picked.length < desired && candidates.length > 0) {
    const idx = Math.floor(Math.random() * candidates.length);
    picked.push(candidates.splice(idx, 1)[0]);
  }
  picked.sort((a, b) => a - b);

  const transferStyle = randomLineStyle();
  if (transferStyle.color === mainStyle.color) {
    transferStyle.color = LINE_COLOR_PALETTE[(LINE_COLOR_PALETTE.indexOf(mainStyle.color) + 3) % LINE_COLOR_PALETTE.length];
    transferStyle.text = isLightHex(transferStyle.color) ? "#111" : "#fff";
  }

  let pathPoints;
  if (picked.length === 1) {
    const p = points[picked[0]];
    const vertical = Math.random() < 0.5;
    pathPoints = vertical
      ? [{ x: p.x, y: 40 }, { x: p.x, y: 480 }]
      : [{ x: 40, y: p.y }, { x: 960, y: p.y }];
  } else {
    const first = points[picked[0]];
    const last = points[picked[picked.length - 1]];
    const start = { x: clamp(first.x - randomBetween(80, 150), 30, 970), y: clamp(first.y + randomBetween(-70, 70), 40, 480) };
    const end = { x: clamp(last.x + randomBetween(80, 150), 30, 970), y: clamp(last.y + randomBetween(-70, 70), 40, 480) };
    pathPoints = [start, ...picked.map((i) => points[i]), end];
  }

  return {
    style: transferStyle,
    intersections: picked,
    pathPoints,
  };
}

function buildRouteFromInput() {
  try {
    const steps = parseSteps(els.stepsInput.value);
    const routineName = els.routineName.value.trim() || "Untitled Line";

    const stations = [
      ...steps,
      {
        activity: "Complete routine",
        plannedMin: 0,
        stationName: `${routineName} Terminal`,
      },
    ];

    state.lineStyle = state.preferredLineStyle || randomLineStyle();
    state.preferredLineStyle = null;
    const points = buildPoints(stations.length);
    const transferLine = createTransferLineData(points, state.lineStyle);
    state.route = {
      name: routineName,
      stations,
      points,
      transferLine,
      totalPlannedSimMs: steps.reduce((sum, s) => sum + s.plannedMin * 60000, 0),
    };

    state.runStatus = "idle";
    state.currentSegment = 0;
    state.history = [];
    state.isDelayActive = false;
    state.segmentDelayMs = 0;
    state.runSimElapsedMs = 0;
    state.nextConductorSimMs = initialConductorIntervalMs();
    state.nextTrainFxSimMs = initialTrainFxIntervalMs();
    state.trainPos = { ...state.route.points[0] };
    state.approachAnnounced = false;

    els.lineTitle.textContent = `${routineName} Line`;
    els.lineBadge.textContent = state.lineStyle.badge;
    els.lineBadge.style.background = state.lineStyle.color;
    els.lineBadge.style.color = state.lineStyle.text;
    setAnnouncement("Line built. Press Start Run to depart the first station.");
    els.countdown.textContent = "--:--";
    els.delayTimer.textContent = "Delay 00:00";

    renderMap();
    renderHistory();
    updateControlState();
  } catch (err) {
    setAnnouncement(`Build error: ${err.message}`);
  }
}

function buildPoints(stationCount) {
  const xStart = 90;
  const xEnd = 920;
  const rows = [90, 150, 220, 300, 380, 440];

  if (stationCount === 1) {
    return [{ x: xStart, y: rows[Math.floor(Math.random() * rows.length)] }];
  }

  const step = (xEnd - xStart) / (stationCount - 1);
  const points = [];
  let row = rows[Math.floor(Math.random() * rows.length)];

  for (let i = 0; i < stationCount; i += 1) {
    if (i > 0 && Math.random() < 0.55) {
      row = pickRandomDifferent(row, rows);
    }

    const baseX = xStart + step * i;
    const xJitter = i === 0 || i === stationCount - 1 ? 0 : randomBetween(-22, 22);
    const yJitter = randomBetween(-10, 10);

    const x = i === 0 ? xStart : i === stationCount - 1 ? xEnd : clamp(baseX + xJitter, xStart + 30, xEnd - 30);
    const y = clamp(row + yJitter, 70, 450);
    points.push({ x, y });
  }

  return points;
}

function renderMap() {
  const svg = els.mapSvg;
  svg.innerHTML = "";

  if (!state.route) {
    return;
  }

  if (state.route.transferLine) {
    const transfer = state.route.transferLine;
    const transferPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    transferPath.setAttribute("d", toOrthogonalPathD(transfer.pathPoints));
    transferPath.setAttribute("fill", "none");
    transferPath.setAttribute("stroke", transfer.style.color);
    transferPath.setAttribute("stroke-width", "10");
    transferPath.setAttribute("stroke-linecap", "round");
    transferPath.setAttribute("stroke-linejoin", "round");
    transferPath.setAttribute("opacity", "0.9");
    svg.appendChild(transferPath);

    const transferBadgePoint = transfer.pathPoints[transfer.pathPoints.length - 1];
    const badge = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const badgeCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    badgeCircle.setAttribute("cx", transferBadgePoint.x);
    badgeCircle.setAttribute("cy", transferBadgePoint.y);
    badgeCircle.setAttribute("r", "14");
    badgeCircle.setAttribute("fill", transfer.style.color);
    badgeCircle.setAttribute("stroke", "#111");
    badgeCircle.setAttribute("stroke-width", "2");

    const badgeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    badgeText.setAttribute("x", transferBadgePoint.x);
    badgeText.setAttribute("y", transferBadgePoint.y + 5);
    badgeText.setAttribute("text-anchor", "middle");
    badgeText.setAttribute("font-size", "14");
    badgeText.setAttribute("font-weight", "800");
    badgeText.setAttribute("fill", transfer.style.text);
    badgeText.textContent = transfer.style.badge;
    badge.appendChild(badgeCircle);
    badge.appendChild(badgeText);
    svg.appendChild(badge);
  }

  const linePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  linePath.setAttribute("d", toOrthogonalPathD(state.route.points));
  linePath.setAttribute("fill", "none");
  linePath.setAttribute("stroke", state.lineStyle.color);
  linePath.setAttribute("stroke-width", "14");
  linePath.setAttribute("stroke-linecap", "round");
  linePath.setAttribute("stroke-linejoin", "round");
  svg.appendChild(linePath);

  const outlinePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  outlinePath.setAttribute("d", toOrthogonalPathD(state.route.points));
  outlinePath.setAttribute("fill", "none");
  outlinePath.setAttribute("stroke", "#fff");
  outlinePath.setAttribute("stroke-width", "6");
  outlinePath.setAttribute("stroke-linecap", "round");
  outlinePath.setAttribute("stroke-linejoin", "round");
  outlinePath.setAttribute("opacity", "0.9");
  svg.appendChild(outlinePath);

  state.route.stations.forEach((station, idx) => {
    const p = state.route.points[idx];
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.classList.add("station");

    if (idx < state.currentSegment) {
      g.classList.add("completed");
    }
    if (idx === state.currentSegment && (state.runStatus === "running" || state.runStatus === "paused")) {
      g.classList.add("current");
    }
    if (idx === state.currentSegment && state.isDelayActive) {
      g.classList.add("delayed");
    }

    const hit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    hit.setAttribute("cx", p.x);
    hit.setAttribute("cy", p.y);
    hit.setAttribute("r", "24");
    hit.setAttribute("fill", "transparent");

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", p.x);
    circle.setAttribute("cy", p.y);
    circle.setAttribute("r", "12");
    circle.classList.add("station-circle");

    if (state.route.transferLine && state.route.transferLine.intersections.includes(idx)) {
      const interchange = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      interchange.setAttribute("cx", p.x);
      interchange.setAttribute("cy", p.y);
      interchange.setAttribute("r", "18");
      interchange.setAttribute("fill", "none");
      interchange.setAttribute("stroke", state.route.transferLine.style.color);
      interchange.setAttribute("stroke-width", "4");
      g.appendChild(interchange);
    }

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    const isUp = p.y > 250;
    label.setAttribute("x", p.x);
    label.setAttribute("y", isUp ? p.y - 22 : p.y + 30);
    label.setAttribute("text-anchor", "middle");
    label.classList.add("station-label");
    label.textContent = station.stationName;

    g.appendChild(hit);
    g.appendChild(circle);
    g.appendChild(label);
    svg.appendChild(g);
  });

  if (state.trainPos) {
    drawTrain(svg, state.trainPos.x, state.trainPos.y);
  }
}

function toOrthogonalPathD(points) {
  if (points.length === 0) {
    return "";
  }

  const commands = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    if (prev.x !== current.x && prev.y !== current.y) {
      commands.push(`L ${current.x} ${prev.y}`);
    }
    commands.push(`L ${current.x} ${current.y}`);
  }
  return commands.join(" ");
}

function drawTrain(svg, x, y) {
  const train = document.createElementNS("http://www.w3.org/2000/svg", "g");
  train.setAttribute("transform", `translate(${x}, ${y})`);

  const car = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  car.setAttribute("x", "-14");
  car.setAttribute("y", "-10");
  car.setAttribute("width", "28");
  car.setAttribute("height", "20");
  car.setAttribute("rx", "5");
  car.classList.add("train");

  const stripe = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  stripe.setAttribute("x", "-14");
  stripe.setAttribute("y", "3");
  stripe.setAttribute("width", "28");
  stripe.setAttribute("height", "4");
  stripe.setAttribute("fill", "#fccc0a");

  const windowLeft = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  windowLeft.setAttribute("x", "-10");
  windowLeft.setAttribute("y", "-6");
  windowLeft.setAttribute("width", "8");
  windowLeft.setAttribute("height", "6");
  windowLeft.classList.add("train-tip");

  const windowRight = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  windowRight.setAttribute("x", "2");
  windowRight.setAttribute("y", "-6");
  windowRight.setAttribute("width", "8");
  windowRight.setAttribute("height", "6");
  windowRight.classList.add("train-tip");

  const light = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  light.setAttribute("cx", "0");
  light.setAttribute("cy", "7");
  light.setAttribute("r", "1.8");
  light.setAttribute("fill", "#fff");

  train.appendChild(car);
  train.appendChild(stripe);
  train.appendChild(windowLeft);
  train.appendChild(windowRight);
  train.appendChild(light);
  svg.appendChild(train);
}

function handleShortcutKeys(event) {
  if (!state.route) {
    return;
  }
  const tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
  if (tag === "input" || tag === "textarea" || tag === "select" || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  const key = event.key.toLowerCase();
  if (key === "d") {
    event.preventDefault();
    toggleDelayForStation(state.currentSegment);
  } else if (key === "n") {
    event.preventDefault();
    skipStop();
  } else if (key === "p") {
    event.preventDefault();
    jumpToPreviousStop();
  }
}

function segmentData(index) {
  const from = state.route.stations[index];
  const to = state.route.stations[index + 1];
  const fromPoint = state.route.points[index];
  const toPoint = state.route.points[index + 1];
  const trackPoints = buildSegmentTrack(fromPoint, toPoint);

  return {
    from,
    to,
    plannedMin: from.plannedMin,
    fromPoint,
    toPoint,
    trackPoints,
  };
}

function buildSegmentTrack(from, to) {
  if (from.y === to.y || from.x === to.x) {
    return [from, to];
  }
  return [from, { x: to.x, y: from.y }, to];
}

function startRun() {
  if (!state.route || state.runStatus === "running") {
    return;
  }

  if (state.currentSegment >= state.route.stations.length - 1) {
    state.currentSegment = 0;
    state.history = [];
    state.runSimElapsedMs = 0;
    state.nextConductorSimMs = initialConductorIntervalMs();
    state.nextTrainFxSimMs = initialTrainFxIntervalMs();
  }

  syncSpeedFromSlider();
  state.runStatus = "running";
  state.lastTickTs = performance.now();
  if (state.currentSegment === 0) {
    announceFirstStationThenDepart();
  } else {
    departCurrentSegment();
  }
  updateControlState();
}

function announceFirstStationThenDepart() {
  if (!state.route || state.currentSegment >= state.route.stations.length - 1) {
    departCurrentSegment();
    return;
  }

  const segment = segmentData(state.currentSegment);
  const minutes = Math.max(1, Math.ceil(segment.plannedMin));
  const message = `Now at ${segment.from.stationName}. Next stop ${segment.to.stationName} in about ${minutes} minute${
    minutes === 1 ? "" : "s"
  }.`;
  state.isDwellActive = true;
  state.dwellRemainingMs = 0;
  state.dwellStartedTs = performance.now();
  els.countdown.textContent = "Boarding";

  announceThen(message, () => {
    if (state.runStatus !== "running") {
      return;
    }
    playTrainSound("conductor");
    state.dwellRemainingMs = 1200;
    state.dwellStartedTs = performance.now();
    scheduleDwellDeparture();
  });
}

function departCurrentSegment() {
  if (state.currentSegment >= state.route.stations.length - 1) {
    completeRun();
    return;
  }

  const segment = segmentData(state.currentSegment);
  const text = closingDoorsAnnouncement();
  announceThen(text, () => {
    if (state.runStatus !== "running" || state.isDwellActive) {
      return;
    }
    state.segmentDurationMs = simMinToRealMs(segment.plannedMin);
    state.segmentStartTs = performance.now();
    state.segmentDelayMs = 0;
    state.isDelayActive = false;
    state.approachAnnounced = false;
    playTrainSound("depart");

    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
    }
    state.lastTickTs = performance.now();
    state.rafId = requestAnimationFrame(tick);
  });
}

function closingDoorsAnnouncement() {
  return Math.random() < 0.5 ? "Stand clear of the closing doors." : "Please don't block the doors.";
}

function tick(ts) {
  if (state.runStatus !== "running") {
    state.rafId = null;
    return;
  }

  const realDelta = Math.max(0, ts - (state.lastTickTs || ts));
  state.lastTickTs = ts;
  state.runSimElapsedMs += realToSimMs(realDelta);

  const segment = segmentData(state.currentSegment);
  const elapsedReal = state.isDelayActive ? state.delayStartTs - state.segmentStartTs : ts - state.segmentStartTs;
  const progress = Math.min(1, Math.max(0, elapsedReal / state.segmentDurationMs));

  state.trainPos = interpolateOnTrack(segment.trackPoints, progress);
  renderMap();
  renderTimers(ts, elapsedReal);
  maybeApproachAnnouncement(elapsedReal, segment);

  if (!state.isDelayActive) {
    maybeConductorMessage();
    maybePlayTrainFx();
  }

  if (progress >= 1 && !state.isDelayActive) {
    arriveAtNextStation(ts);
    return;
  }

  state.rafId = requestAnimationFrame(tick);
}

function interpolateOnTrack(trackPoints, t) {
  if (trackPoints.length === 2) {
    return lerpPoint(trackPoints[0], trackPoints[1], t);
  }

  const lengths = [];
  let total = 0;
  for (let i = 1; i < trackPoints.length; i += 1) {
    const len = Math.hypot(trackPoints[i].x - trackPoints[i - 1].x, trackPoints[i].y - trackPoints[i - 1].y);
    lengths.push(len);
    total += len;
  }

  let distance = total * t;
  for (let i = 1; i < trackPoints.length; i += 1) {
    if (distance <= lengths[i - 1]) {
      return lerpPoint(trackPoints[i - 1], trackPoints[i], lengths[i - 1] === 0 ? 0 : distance / lengths[i - 1]);
    }
    distance -= lengths[i - 1];
  }

  return { ...trackPoints.at(-1) };
}

function lerpPoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function renderTimers(ts, elapsedReal) {
  const remainingReal = Math.max(0, state.segmentDurationMs - elapsedReal);
  els.countdown.textContent = formatSimMs(realToSimMs(remainingReal));

  const liveDelayReal = state.isDelayActive ? ts - state.delayStartTs : 0;
  const delaySim = realToSimMs(state.segmentDelayMs + liveDelayReal);
  els.delayTimer.textContent = `Delay ${formatSimMs(delaySim)}`;
}

function maybeConductorMessage() {
  if (state.runSimElapsedMs < state.nextConductorSimMs || state.runStatus !== "running") {
    return;
  }

  const segment = segmentData(state.currentSegment);
  const remainingMin = Math.max(1, Math.ceil(remainingToNextStopMs() / 60000));
  const msg = `Conductor update: about ${remainingMin} minute${remainingMin === 1 ? "" : "s"} to ${segment.to.stationName}.`;
  setAnnouncement(msg, true);
  playTrainSound("conductor");
  state.nextConductorSimMs += nextConductorIntervalMs();
}

function maybeApproachAnnouncement(elapsedReal, segment) {
  if (!state.route || state.isDelayActive || state.approachAnnounced) {
    return;
  }

  const remainingReal = Math.max(0, state.segmentDurationMs - elapsedReal);
  if (remainingReal <= 10000 && remainingReal > 0) {
    state.approachAnnounced = true;
    setAnnouncement(`Now arriving at ${segment.to.stationName}.`, true);
  }
}

function maybePlayTrainFx() {
  if (state.runStatus !== "running" || state.runSimElapsedMs < state.nextTrainFxSimMs) {
    return;
  }
  playTrainSound("train");
  state.nextTrainFxSimMs += nextTrainFxIntervalMs();
}

function remainingToNextStopMs() {
  if (!state.route || state.currentSegment >= state.route.stations.length - 1) {
    return 0;
  }

  const now = performance.now();
  const elapsedReal = state.isDelayActive ? state.delayStartTs - state.segmentStartTs : now - state.segmentStartTs;
  return realToSimMs(Math.max(0, state.segmentDurationMs - elapsedReal));
}

function arriveAtNextStation(ts, dwellMs = STATION_DWELL_REAL_MS) {
  const segment = segmentData(state.currentSegment);
  const actualRealMs = ts - state.segmentStartTs + state.segmentDelayMs;

  state.history.push({
    from: segment.from.stationName,
    to: segment.to.stationName,
    plannedMin: segment.plannedMin,
    actualMin: realToSimMs(actualRealMs) / 60000,
    delayMin: realToSimMs(state.segmentDelayMs) / 60000,
  });

  state.currentSegment += 1;
  state.trainPos = { ...segment.toPoint };
  renderMap();
  renderHistory();

  state.nextConductorSimMs = state.runSimElapsedMs + nextConductorIntervalMs();
  playTrainSound("arrive");
  if (state.currentSegment >= state.route.stations.length - 1) {
    completeRun();
    return;
  }
  beginStationDwell(segment.to.stationName, dwellMs);
}

function beginStationDwell(stationName, dwellMs = STATION_DWELL_REAL_MS) {
  state.isDwellActive = true;
  state.dwellRemainingMs = dwellMs;
  state.dwellStartedTs = 0;
  els.countdown.textContent = "Boarding";
  const transferText = transferAnnouncementForStation(state.currentSegment);
  const upcoming = state.currentSegment < state.route.stations.length - 1 ? segmentData(state.currentSegment) : null;
  let message = "";

  if (upcoming) {
    message = `Doors open at ${stationName}. Next stop ${upcoming.to.stationName} in about ${Math.max(
      1,
      Math.ceil(upcoming.plannedMin)
    )} minute${Math.ceil(upcoming.plannedMin) === 1 ? "" : "s"}.${transferText ? ` ${transferText}` : ""}`;
  } else {
    message = `Doors open at ${stationName}. Departing shortly.${transferText ? ` ${transferText}` : ""}`;
  }

  announceThen(message, () => {
    if (state.runStatus !== "running" || !state.isDwellActive) {
      return;
    }
    if (upcoming) {
      playTrainSound("conductor");
    }
    state.dwellStartedTs = performance.now();
    scheduleDwellDeparture();
  });
}

function transferAnnouncementForStation(stationIndex) {
  const transfer = state.route && state.route.transferLine;
  if (!transfer || !transfer.intersections.includes(stationIndex)) {
    return "";
  }
  return `Transfer is available to the ${transfer.style.badge} line.`;
}

function scheduleDwellDeparture() {
  clearDwellTimeout();
  state.dwellTimeoutId = setTimeout(() => {
    state.dwellTimeoutId = null;
    state.isDwellActive = false;
    state.dwellRemainingMs = STATION_DWELL_REAL_MS;
    departCurrentSegment();
  }, Math.max(0, state.dwellRemainingMs));
}

function clearDwellTimeout() {
  if (state.dwellTimeoutId) {
    clearTimeout(state.dwellTimeoutId);
    state.dwellTimeoutId = null;
  }
}

function toggleDelayForStation(stationIndex) {
  if (state.runStatus !== "running" || !state.route) {
    return;
  }
  if (state.isDwellActive) {
    setAnnouncement("Train is currently boarding at the station.");
    return;
  }

  const clickedName = state.route.stations[stationIndex].stationName;

  if (!state.isDelayActive) {
    state.isDelayActive = true;
    state.delayStartTs = performance.now();
    setAnnouncement(`Delay reported near ${clickedName}. Train is holding. Press D again to resume.`, true);
    playTrainSound("delay");
  } else {
    const delayMs = performance.now() - state.delayStartTs;
    state.segmentDelayMs += delayMs;
    state.segmentStartTs += delayMs;
    state.isDelayActive = false;
    setAnnouncement(`Delay cleared near ${clickedName}. Service is now moving.`, true);
    playTrainSound("depart");
  }

  renderMap();
}

function jumpToPreviousStop() {
  if (!state.route || (state.runStatus !== "running" && state.runStatus !== "paused")) {
    return;
  }
  if (state.currentSegment <= 0) {
    setAnnouncement("Already at the first station.");
    return;
  }

  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
  clearDwellTimeout();
  state.isDwellActive = false;
  state.isDelayActive = false;
  state.segmentDelayMs = 0;

  const targetSegment = state.isDwellActive ? state.currentSegment - 1 : state.currentSegment;
  const clampedTarget = Math.max(0, targetSegment);
  state.currentSegment = clampedTarget;
  state.history = state.history.slice(0, clampedTarget);
  state.trainPos = { ...state.route.points[clampedTarget] };
  renderHistory();
  renderMap();

  const stationName = state.route.stations[clampedTarget].stationName;
  setAnnouncement(`Returned to ${stationName}.`, true);
  playTrainSound("arrive");

  if (state.runStatus === "running") {
    beginStationDwell(stationName);
  } else {
    els.countdown.textContent = "--:--";
  }
}

function pauseRun() {
  if (state.runStatus !== "running") {
    return;
  }

  state.runStatus = "paused";
  state.pauseStartTs = performance.now();
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
  if (state.isDwellActive) {
    if (state.dwellStartedTs > 0) {
      const elapsed = Math.max(0, performance.now() - state.dwellStartedTs);
      state.dwellRemainingMs = Math.max(0, state.dwellRemainingMs - elapsed);
    }
    clearDwellTimeout();
  }

  setAnnouncement("Run paused.");
  updateControlState();
}

function resumeRun() {
  if (state.runStatus !== "paused") {
    return;
  }

  const pausedDelta = performance.now() - state.pauseStartTs;
  state.segmentStartTs += pausedDelta;
  if (state.isDelayActive) {
    state.delayStartTs += pausedDelta;
  }

  state.runStatus = "running";
  state.lastTickTs = performance.now();
  if (state.isDwellActive) {
    state.dwellStartedTs = performance.now();
    scheduleDwellDeparture();
  } else {
    state.rafId = requestAnimationFrame(tick);
  }
  setAnnouncement("Run resumed.");
  updateControlState();
}

function skipStop() {
  if (state.runStatus !== "running" || !state.route) {
    return;
  }
  if (state.isDwellActive) {
    return;
  }

  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }

  if (state.isDelayActive) {
    const delayMs = performance.now() - state.delayStartTs;
    state.segmentDelayMs += delayMs;
    state.segmentStartTs += delayMs;
    state.isDelayActive = false;
  }

  arriveAtNextStation(performance.now());
}

function resetRun() {
  if (!state.route) {
    return;
  }

  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
  clearDwellTimeout();

  state.runStatus = "idle";
  state.currentSegment = 0;
  state.isDelayActive = false;
  state.segmentDelayMs = 0;
  state.runSimElapsedMs = 0;
  state.nextConductorSimMs = initialConductorIntervalMs();
  state.nextTrainFxSimMs = initialTrainFxIntervalMs();
  state.isDwellActive = false;
  state.dwellRemainingMs = STATION_DWELL_REAL_MS;
  state.approachAnnounced = false;
  state.trainPos = { ...state.route.points[0] };
  els.countdown.textContent = "--:--";
  els.delayTimer.textContent = "Delay 00:00";

  setAnnouncement("Run reset to first station.");
  renderMap();
  updateControlState();
}

function completeRun() {
  state.runStatus = "completed";
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
  clearDwellTimeout();
  state.isDwellActive = false;

  els.countdown.textContent = "Arrived";
  setAnnouncement("End of line. Routine complete.", true);
  playTrainSound("arrive");
  renderMap();
  updateControlState();
}

function updateControlState() {
  const hasRoute = Boolean(state.route);
  const isIdle = state.runStatus === "idle";
  const isRunning = state.runStatus === "running";
  const isPaused = state.runStatus === "paused";

  els.startBtn.disabled = !hasRoute || (!isIdle && state.runStatus !== "completed");
  els.pauseBtn.disabled = !isRunning;
  els.resumeBtn.disabled = !isPaused;
  els.skipBtn.disabled = !isRunning || state.isDwellActive;
  els.resetBtn.disabled = !hasRoute;
  els.buildBtn.disabled = isRunning || isPaused;
  els.saveTemplateBtn.disabled = isRunning || isPaused;
  els.useActualBtn.disabled = state.history.length === 0;
  updateSpeedControls();
}

function setAnnouncement(text, speak = false) {
  els.announcement.textContent = text;
  if (speak) {
    speakText(text);
  }
}

function announceThen(text, onDone) {
  els.announcement.textContent = text;
  if (!("speechSynthesis" in window)) {
    if (typeof onDone === "function") {
      setTimeout(onDone, 150);
    }
    return;
  }

  let called = false;
  const done = () => {
    if (called) {
      return;
    }
    called = true;
    if (typeof onDone === "function") {
      onDone();
    }
  };

  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.pitch = 1;
  utter.onend = done;
  utter.onerror = done;
  window.speechSynthesis.speak(utter);
}

function speakText(text) {
  if (!("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.pitch = 1;
  window.speechSynthesis.speak(utter);
}

function playTrainSound(type) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    return;
  }

  if (!state.audioCtx) {
    state.audioCtx = new Ctx();
  }

  const ctx = state.audioCtx;
  const now = ctx.currentTime;

  const beep = (freq, len, gain = 0.05, wave = "sine", offset = 0) => {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0, now + offset);
    amp.gain.linearRampToValueAtTime(gain, now + offset + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.001, now + offset + len);
    osc.connect(amp).connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + len);
  };

  if (type === "depart") {
    beep(700, 0.18, 0.05, "triangle", 0);
    beep(880, 0.2, 0.04, "triangle", 0.12);
  } else if (type === "arrive") {
    beep(740, 0.14, 0.045, "sine", 0);
    beep(590, 0.18, 0.04, "sine", 0.1);
  } else if (type === "delay") {
    beep(220, 0.3, 0.06, "sawtooth", 0);
    beep(180, 0.35, 0.06, "sawtooth", 0.18);
  } else if (type === "conductor") {
    beep(520, 0.22, 0.04, "square", 0);
    beep(460, 0.22, 0.035, "square", 0.22);
  } else if (type === "train") {
    const variant = Math.floor(Math.random() * 3);
    if (variant === 0) {
      beep(95, 1.1, 0.03, "sawtooth", 0);
      beep(125, 0.9, 0.02, "triangle", 0.08);
      beep(180, 0.15, 0.016, "square", 0.35);
      beep(180, 0.15, 0.016, "square", 0.72);
    } else if (variant === 1) {
      beep(88, 1.0, 0.028, "triangle", 0);
      beep(112, 1.2, 0.02, "sawtooth", 0.04);
      beep(230, 0.08, 0.02, "square", 0.28);
      beep(210, 0.08, 0.018, "square", 0.56);
      beep(230, 0.08, 0.02, "square", 0.84);
    } else {
      beep(102, 1.3, 0.024, "sawtooth", 0);
      beep(142, 0.8, 0.018, "triangle", 0.12);
      beep(190, 0.12, 0.015, "square", 0.22);
      beep(170, 0.12, 0.015, "square", 0.48);
    }
  }
}

function renderHistory() {
  els.historyBody.innerHTML = "";

  if (state.history.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="5">No timing data yet.</td>';
    els.historyBody.appendChild(row);
    updateControlState();
    return;
  }

  state.history.forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.from}</td>
      <td>${entry.to}</td>
      <td>${entry.plannedMin.toFixed(1)} min</td>
      <td>${entry.actualMin.toFixed(1)} min</td>
      <td>${entry.delayMin.toFixed(1)} min</td>
    `;
    els.historyBody.appendChild(row);
  });

  updateControlState();
}

function applyActualsToInput() {
  if (!state.route || state.history.length === 0) {
    return;
  }

  const lines = state.route.stations
    .slice(0, -1)
    .map((station, idx) => {
      const hist = state.history[idx];
      const minutes = hist ? Math.max(0.5, hist.actualMin) : station.plannedMin;
      return `${station.activity},${minutes.toFixed(1)}`;
    });

  els.stepsInput.value = lines.join("\n");
  setAnnouncement("Actuals copied into step timings. Build Line to apply them.");
}

function simMinToRealMs(min) {
  return min * state.speedSecPerMin * 1000;
}

function realToSimMs(realMs) {
  return realMs * (60 / state.speedSecPerMin);
}

function formatSimMs(simMs) {
  const totalSec = Math.ceil(simMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
