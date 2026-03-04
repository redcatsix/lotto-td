// engine.js
// Lotto TD - round-based auto play
// ✅ 웨이브 타입 시스템: 매 스테이지 다양한 적 조합/특수 웨이브

import { createEconomyState } from "./economy.js?v=20260303_wave";
import { ENEMY_TYPES, WAVE_TYPE, WAVE_TYPE_INFO, rollWaveType, makeEnemy, pickEnemyTypeForWave } from "./enemies.js?v=20260303_wave";
import {
  UNIT_TYPES,
  UNIT_DEFS,
  ITEM_RARITY,
  rarityName,
  rarityColor,
  rarityRank,
  nextRarity,
  rollUnitType,
  rollItemRarityForDraw,
  rollOptions,
  createUnit,
  formatOption,
  OPTION_KIND,
  optionKindName,
  optionDescription,
  targetPriorityName,
} from "./units.js?v=20260303_wave";

import {
  SKILL_NODES,
  SKILL_BRANCHES,
  SKILL_MAX_LEVEL,
  loadMetaState,
  saveMetaState,
  computeSkillMods,
  canUpgradeSkill,
  getSkillLevel,
  isTierUnlocked,
  skillUpgradeCost,
} from "./skills.js?v=20260303_wave";

// --------------------
// Helpers
// --------------------

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2(ax, ay, bx, by) { const dx = ax-bx, dy = ay-by; return dx*dx+dy*dy; }
function fmtPct01(x) { return `${(x*100).toFixed(1)}%`; }
function fmtCells(x) { return `${x.toFixed(1)}칸`; }

function pickWeighted(items, weights) {
  let total = 0;
  for (const w of weights) total += w;
  const r = Math.random() * total;
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    acc += weights[i];
    if (r <= acc) return items[i];
  }
  return items[items.length - 1];
}

function shuffledCopy(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function safeText(s) {
  return String(s).replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[ch]));
}

function rollItemRarityBestOf(n, rollFn, rankFn) {
  let best = rollFn();
  for (let i = 1; i < n; i++) {
    const r = rollFn();
    if (rankFn(r) > rankFn(best)) best = r;
  }
  return best;
}

function scoreOptionSet(options, rarityRank, OPTION_KIND) {
  let s = 0;
  for (const o of options) {
    const rr = rarityRank(o.rarity);
    s += (rr + 1) * 1000;
    const v = Number(o.value) || 0;
    switch (o.kind) {
      case OPTION_KIND.MULTISHOT: s += v * 320; break;
      case OPTION_KIND.RICOCHET: s += v * 280; break;
      case OPTION_KIND.RICOCHET_POWER: s += v * 8000; break;
      case OPTION_KIND.CRIT_CHANCE: s += v * 22000; break;
      case OPTION_KIND.CRIT_MULT: s += v * 1500; break;
      case OPTION_KIND.DMG_PCT: s += v * 9000; break;
      case OPTION_KIND.ASPD_PCT: s += v * 8200; break;
      case OPTION_KIND.TARGET_PRIORITY: {
        const pv = String(o.value || "");
        if (pv === "BOSS") s += 5200;
        else if (pv === "ELITE") s += 3800;
        else if (pv === "HIGH_HP") s += 2400;
        else if (pv === "LOW_HP") s += 2200;
        else s += 1400;
        break;
      }
      case OPTION_KIND.SPLASH_MUL: s += v * 8200; break;
      case OPTION_KIND.BLAST_RADIUS: s += v * 2200; break;
      case OPTION_KIND.SLOW_DURATION: s += v * 900; break;
      case OPTION_KIND.SLOW_POWER: s += v * 12000; break;
      case OPTION_KIND.EXECUTE_PCT: s += v * 8500; break;
      case OPTION_KIND.PRESSURE_DMG: s += v * 9000; break;
      case OPTION_KIND.MAXHP_PCT_DMG: s += v * 250000; break;
      default: s += v * 500; break;
    }
  }
  return s;
}

function rollOptionsBestOf(n, rollOptionsFn, unitType, itemRarity, rarityRank, OPTION_KIND) {
  let best = rollOptionsFn(unitType, itemRarity);
  let bestScore = scoreOptionSet(best, rarityRank, OPTION_KIND);
  for (let i = 1; i < n; i++) {
    const cand = rollOptionsFn(unitType, itemRarity);
    const sc = scoreOptionSet(cand, rarityRank, OPTION_KIND);
    if (sc > bestScore) { best = cand; bestScore = sc; }
  }
  return best;
}

// --------------------
// Layout
// --------------------

function cellKey(r, c) { return `${r},${c}`; }

function createBoardLayout(viewW, viewH) {
  const gridSize = 5;
  const gap = 12;
  const gridW = Math.round(viewH * 0.88);
  const cell = Math.floor((gridW - (gridSize - 1) * gap) / gridSize);
  const gridWReal = gridSize * cell + (gridSize - 1) * gap;
  const gridX = Math.round((viewW - gridWReal) / 2);
  const gridY = Math.round((viewH - gridWReal) / 2);

  const cells = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const x = gridX + c * (cell + gap);
      const y = gridY + r * (cell + gap);
      cells.push({ r, c, x, y, w: cell, h: cell });
    }
  }

  const innerX = gridX + 1 * (cell + gap);
  const innerY = gridY + 1 * (cell + gap);
  const innerW = 3 * cell + 2 * gap;
  const path = { x: innerX - gap / 2, y: innerY - gap / 2, w: innerW + gap, h: innerW + gap };
  const pxPerCell = cell + gap;

  const coreCell = cells.find((cc) => cc.r === 2 && cc.c === 2);
  const core = {
    x: coreCell.x + coreCell.w / 2,
    y: coreCell.y + coreCell.h / 2,
    r: Math.min(coreCell.w, coreCell.h) * 0.22,
  };

  return { gridSize, gap, cell, gridX, gridY, gridW: gridWReal, cells, path, pxPerCell, core };
}

function getCellAt(board, x, y) {
  for (const cell of board.cells) {
    if (x >= cell.x && x <= cell.x + cell.w && y >= cell.y && y <= cell.y + cell.h) return cell;
  }
  return null;
}

function rectPerimeter(path) { return 2 * (path.w + path.h); }

function pointOnRect(path, d) {
  const P = rectPerimeter(path);
  let t = ((d % P) + P) % P;
  if (t <= path.w) return { x: path.x + t, y: path.y };
  t -= path.w;
  if (t <= path.h) return { x: path.x + path.w, y: path.y + t };
  t -= path.h;
  if (t <= path.w) return { x: path.x + path.w - t, y: path.y + path.h };
  t -= path.w;
  return { x: path.x, y: path.y + path.h - t };
}

const VFX_INTENSITY_BASE = 0.30;
const DMG_FLOATERS_INTENSITY = 0.60;
const HOTZONE_COUNT_BASE = 6;
const HOTZONE_ASPD_BONUS_BASE = 0.12;
const HOTZONE_CRIT_BONUS_BASE = 0.06;
const REROLL_STREAK_NEED = 2;

const DIRS = { UP: "UP", DOWN: "DOWN", LEFT: "LEFT", RIGHT: "RIGHT" };

function shortNum(n) {
  const x = Math.floor(n);
  if (x >= 1_000_000) return (x / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'm';
  if (x >= 1_000) return (x / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(x);
}

function makeStageStats(stage) {
  return { stage, dmg: new Map(), kills: new Map(), crits: new Map(), best: { rank: -1, rarity: null, type: null }, specials: 0 };
}

function clampInt(v, a, b) { const n = Math.round(v); return Math.max(a, Math.min(b, n)); }
function snap(x) { return Math.round(x); }

function lerpAngle(a, b, t) {
  const TAU = Math.PI * 2;
  let d = ((b - a) % TAU + TAU) % TAU;
  if (d > Math.PI) d -= TAU;
  return a + d * t;
}

function distToRectPerimeter(px, py, rect) {
  const x1 = rect.x, y1 = rect.y, x2 = rect.x + rect.w, y2 = rect.y + rect.h;
  const cx = clamp(px, x1, x2), cy = clamp(py, y1, y2);
  const outside = Math.hypot(px - cx, py - cy);
  if (outside > 0) return outside;
  const dL = px - x1, dR = x2 - px, dT = py - y1, dB = y2 - py;
  return Math.min(dL, dR, dT, dB);
}

function pathRectFromAnchor(board, r0, c0) {
  const pxPerCell = board.pxPerCell;
  const innerX = board.gridX + c0 * pxPerCell;
  const innerY = board.gridY + r0 * pxPerCell;
  const innerW = 3 * board.cell + 2 * board.gap;
  return { x: innerX - board.gap / 2, y: innerY - board.gap / 2, w: innerW + board.gap, h: innerW + board.gap };
}

// --------------------
// Engine
// --------------------

export async function initEngine() {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const stageArea = document.getElementById("stage-area");
  const elStage = document.getElementById("stage");
  const elCore = document.getElementById("core-hp");
  const elTCommon = document.getElementById("t-common");
  const elTRare = document.getElementById("t-rare");
  const elTLegend = document.getElementById("t-legend");
  const elAccXp = document.getElementById("acc-xp");
  const xpBadge = document.getElementById("xp-badge");

  const helpBtn = document.getElementById("help-btn");
  const skillBtn = document.getElementById("skill-btn");
  const speedBtn = document.getElementById("speed-btn");
  const vfxBtn = document.getElementById("vfx-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const shopPanel = document.getElementById("shop-panel");
  const shopCommonItems = document.getElementById("shop-common-items");
  const shopRareItems = document.getElementById("shop-rare-items");
  const shopLegendItems = document.getElementById("shop-legend-items");
  const elShopCommon = document.getElementById("shop-common");
  const elShopRare = document.getElementById("shop-rare");
  const elShopLegend = document.getElementById("shop-legend");

  const dpsPanel = document.getElementById("dps-panel");
  const dpsRows = [1, 2, 3].map((i) => ({
    name: document.getElementById(`dps-name-${i}`),
    val: document.getElementById(`dps-val-${i}`),
    bar: document.getElementById(`dps-bar-${i}`),
  }));

  const buyMenu = document.getElementById("buy-menu");
  const buyDrawBtn = document.getElementById("buy-draw");
  const buyCancelBtn = document.getElementById("buy-cancel");

  const tooltip = document.getElementById("tooltip-panel");
  const ttTitle = document.getElementById("tt-title");
  const ttSub = document.getElementById("tt-sub");
  const ttStats = document.getElementById("tt-stats");
  const ttOptions = document.getElementById("tt-options");
  const ttHint = document.getElementById("tt-hint");

  const modBtn = document.getElementById("mod-btn");
  const awakenBtn = document.getElementById("awaken-btn");
  const rerollBtn = document.getElementById("reroll-btn");
  const legendRerollBtn = document.getElementById("legend-reroll-btn");

  const helpOverlay = document.getElementById("help-overlay");
  const helpClose = document.getElementById("help-close");
  const helpBody = document.getElementById("help-body");

  const specialOverlay = document.getElementById("special-overlay");
  const specialCards = document.getElementById("special-cards");
  const specialRandomBtn = document.getElementById("special-random");

  const gameoverOverlay = document.getElementById("gameover-overlay");
  const gameoverSkillBtn = document.getElementById("gameover-skill-btn");
  const restartBtn = document.getElementById("restart-btn");
  const gameoverBody = document.getElementById("gameover-body");

  const skillOverlay = document.getElementById("skill-overlay");
  const skillCloseBtn = document.getElementById("skill-close");
  const skillTree = document.getElementById("skill-tree");
  const skillLines = document.getElementById("skill-lines");
  const skillTreeWrap = document.getElementById("skill-tree-wrap");
  const skillDetail = document.getElementById("skill-detail");
  const skillInline = document.getElementById("skill-inline");
  const elSkillXp = document.getElementById("skill-xp");

  // ✅ 웨이브 타입 예고 UI 요소 (index.html에 추가됨)
  const waveTypeIndicator = document.getElementById("wave-type-indicator");
  const waveTypeName = document.getElementById("wave-type-name");
  const waveTypeDesc = document.getElementById("wave-type-desc");

  const logical = { w: 900, h: 600 };
  const LEGEND_REROLL_COMMON_COST_BASE = 5;
  const DPS_METER_WINDOW = 2.0;

  const meta = loadMetaState();
  let metaMods = computeSkillMods(meta);

  function canUpgradeAnySkill(meta) {
    try {
      for (const node of SKILL_NODES) {
        const chk = canUpgradeSkill(meta, node);
        if (chk && chk.ok) return true;
      }
    } catch (e) {}
    return false;
  }

  function syncMetaUI() {
    if (elAccXp) elAccXp.textContent = String(meta.xp ?? 0);
    const ready = canUpgradeAnySkill(meta);
    if (skillBtn) skillBtn.classList.toggle("ready", ready);
    if (xpBadge) xpBadge.classList.toggle("ready", ready);
    if (elSkillXp) elSkillXp.textContent = String(meta.xp ?? 0);
  }
  syncMetaUI();

  const LS_KEY_VFX = "lotto_vfx_enabled";
  function loadBoolLS(key, defVal) {
    try { const v = localStorage.getItem(key); if (v == null) return defVal; return v === "1" || v === "true"; } catch { return defVal; }
  }
  function saveBoolLS(key, val) {
    try { localStorage.setItem(key, val ? "1" : "0"); } catch {}
  }
  const initialVfxEnabled = loadBoolLS(LS_KEY_VFX, true);

  function resizeCanvasToDisplay() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.max(2, Math.floor(rect.width * dpr));
    const targetH = Math.max(2, Math.floor(rect.height * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) { canvas.width = targetW; canvas.height = targetH; }
  }

  function fitCanvasCSS() {
    const rect = stageArea.getBoundingClientRect();
    const pad = 10;
    let availW = rect.width - pad * 2;
    try {
      const side = document.getElementById("side-ui");
      const st = window.getComputedStyle(stageArea);
      const dir = st.flexDirection || "row";
      const gap = parseFloat(st.gap || st.columnGap || "0") || 0;
      if (side && dir.startsWith("row")) {
        const sw = side.getBoundingClientRect().width;
        availW = Math.max(360, availW - sw - gap);
      }
    } catch {}
    const maxW = Math.min(1200, availW);
    const maxH = Math.min(820, rect.height - pad * 2);
    const aspect = logical.w / logical.h;
    let w = maxW, h = w / aspect;
    if (h > maxH) { h = maxH; w = h * aspect; }
    w = Math.max(360, w); h = w / aspect;
    canvas.style.width = `${Math.floor(w)}px`;
    canvas.style.height = `${Math.floor(h)}px`;
    resizeCanvasToDisplay();
  }

  const ro = new ResizeObserver(() => fitCanvasCSS());
  ro.observe(stageArea);
  window.addEventListener("resize", () => fitCanvasCSS());
  requestAnimationFrame(() => fitCanvasCSS());

  // ---------------- state ----------------

  const state = {
    econ: createEconomyState(),
    stage: 1,
    coreHp: 20,
    coreHpMax: 20,
    gameOver: false,
    timeScale: 1,
    legendTypeBag: [],
    board: createBoardLayout(logical.w, logical.h),
    pathAnchor: { r0: 1, c0: 1 },
    shiftDir: DIRS.RIGHT,
    shiftRepeat: 0,
    pathShiftAnim: null,
    hotZones: new Map(),
    specialBoosts: new Map(),
    rerollStreak: { key: null, count: 0 },
    units: new Map(),
    enemies: [],
    beams: [],
    rings: [],
    puffs: [],
    floaters: [],
    screenShake: { t: 0, life: 0, strength: 0, seed: Math.random() * 1000, maxOffset: 12 },
    drag: { active: false, unit: null, fromKey: null, fromCell: null, x: 0, y: 0, hoverCell: null, hoverValid: false },
    dragCandidate: null,
    selectedKey: null,
    buyCell: null,
    roundPhase: "PREP",
    prepTimer: 3.0,
    wave: null,
    uiPause: false,
    userPause: false,
    vfxEnabled: initialVfxEnabled,
    pendingSpecial: null,
    banner: { title: "", sub: "", t: 0 },
    stageStats: makeStageStats(1),
    stageFury: null,
    msg: { text: "", t: 0 },

    // ✅ 웨이브 타입 관련 state
    currentWaveType: WAVE_TYPE.NORMAL,
    nextWaveType: WAVE_TYPE.NORMAL,
    waveTypeAnim: 0,   // 웨이브 타입 예고 배너 타이머
  };

  state.meta = meta;
  state.metaMods = metaMods;
  state.metaAwarded = false;
  state.lastXpGain = 0;

  state.hotZoneCount = HOTZONE_COUNT_BASE + (state.metaMods.hotCountAdd ?? 0);
  state.hotAspdBonus = HOTZONE_ASPD_BONUS_BASE + (state.metaMods.hotAspdAdd ?? 0);
  state.hotCritBonus = HOTZONE_CRIT_BONUS_BASE + (state.metaMods.hotCritAdd ?? 0);
  state.prepBase = Math.max(1.25, 3.0 - (state.metaMods.prepReduceSec ?? 0));
  state.prepTimer = state.prepBase;
  state.legendRerollCommonCost = Math.max(1, LEGEND_REROLL_COMMON_COST_BASE - (state.metaMods.legendRerollDiscount ?? 0));
  state.coreHp = Math.max(1, state.coreHp + Math.round(state.metaMods.coreHpAdd ?? 0));
  state.coreHpMax = state.coreHp;
  state.econ.tickets.common += Math.round(state.metaMods.startCommonAdd ?? 0);
  state.econ.tickets.rare += Math.round(state.metaMods.startRareAdd ?? 0);
  state.econ.tickets.legend += Math.round(state.metaMods.startLegendAdd ?? 0);

  const ALL_UNIT_TYPES = Object.values(UNIT_TYPES);

  function refillLegendTypeBag() { state.legendTypeBag = shuffledCopy(ALL_UNIT_TYPES); }

  function pickLegendUnitType(excludeType) {
    if (!Array.isArray(state.legendTypeBag) || state.legendTypeBag.length === 0) refillLegendTypeBag();
    let guard = state.legendTypeBag.length;
    while (guard-- > 0) {
      const t = state.legendTypeBag.pop();
      if (t !== excludeType) return t;
      state.legendTypeBag.unshift(t);
    }
    const pool = ALL_UNIT_TYPES.filter((t) => t !== excludeType);
    return pool[Math.floor(Math.random() * pool.length)] || excludeType || ALL_UNIT_TYPES[0];
  }

  // ---------------- UI helpers ----------------

  function syncTopUI() {
    elStage.textContent = String(state.stage);
    elCore.textContent = String(state.coreHp);
    elTCommon.textContent = String(state.econ.tickets.common);
    elTRare.textContent = String(state.econ.tickets.rare);
    elTLegend.textContent = String(state.econ.tickets.legend);
    if (elShopCommon) elShopCommon.textContent = String(state.econ.tickets.common);
    if (elShopRare) elShopRare.textContent = String(state.econ.tickets.rare);
    if (elShopLegend) elShopLegend.textContent = String(state.econ.tickets.legend);
    syncMetaUI();
    speedBtn.textContent = `${state.timeScale}x`;
    if (vfxBtn) {
      const on = !!state.vfxEnabled;
      vfxBtn.textContent = on ? "FX ON" : "FX OFF";
      vfxBtn.classList.toggle("active", on);
      vfxBtn.classList.toggle("off", !on);
    }
    if (pauseBtn) {
      pauseBtn.textContent = state.userPause ? "▶" : "⏸";
      pauseBtn.classList.toggle("active", !!state.userPause);
    }
    renderShopPanel();
    updateWaveTypeUI();
  }

  // ✅ 웨이브 타입 UI 업데이트
  function updateWaveTypeUI() {
    if (!waveTypeIndicator) return;

    const wt = state.roundPhase === "PREP" ? state.nextWaveType : state.currentWaveType;
    const info = WAVE_TYPE_INFO[wt] || WAVE_TYPE_INFO[WAVE_TYPE.NORMAL];
    const isBoss = isBossRound(state.stage);

    if (isBoss) {
      waveTypeIndicator.style.display = "flex";
      waveTypeIndicator.style.borderColor = "rgba(177,151,252,0.60)";
      waveTypeIndicator.style.background = "rgba(177,151,252,0.08)";
      if (waveTypeName) { waveTypeName.textContent = "⚡ 보스전"; waveTypeName.style.color = "#b197fc"; }
      if (waveTypeDesc) waveTypeDesc.textContent = "강력한 보스가 등장합니다!";
    } else if (wt === WAVE_TYPE.NORMAL) {
      waveTypeIndicator.style.display = "none";
    } else {
      waveTypeIndicator.style.display = "flex";
      waveTypeIndicator.style.borderColor = `${info.color}66`;
      waveTypeIndicator.style.background = `${info.color}12`;
      if (waveTypeName) { waveTypeName.textContent = `${getWaveTypeIcon(wt)} ${info.name} 웨이브`; waveTypeName.style.color = info.color; }
      if (waveTypeDesc) waveTypeDesc.textContent = state.roundPhase === "PREP" ? `예고: ${info.desc}` : info.desc;
    }
  }

  function getWaveTypeIcon(wt) {
    switch (wt) {
      case WAVE_TYPE.SWARM:          return "🐛";
      case WAVE_TYPE.ARMORED:        return "🛡️";
      case WAVE_TYPE.RUSH:           return "💨";
      case WAVE_TYPE.SIEGE:          return "🏰";
      case WAVE_TYPE.ELITE_VANGUARD: return "⚔️";
      case WAVE_TYPE.SPLIT:          return "↔️";
      case WAVE_TYPE.PHANTOM:        return "👻";
      default: return "•";
    }
  }

  // ---------------- DPS meter ----------------
  const dpsUi = { last: 0 };

  function fmtCompact(n) {
    const v = Math.max(0, Math.floor(n || 0));
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}m`;
    if (v >= 10_000) return `${(v / 1_000).toFixed(1)}k`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(2)}k`;
    return String(v);
  }

  function updateDpsMeters(dt) {
    const decay = Math.exp(-dt / DPS_METER_WINDOW);
    for (const [, u] of state.units) u.dpsMeter = (u.dpsMeter || 0) * decay;
  }

  function updateDpsMeterUI(force = false) {
    if (!dpsPanel || !dpsRows || dpsRows.length === 0) return;
    const now = perfNow() / 1000;
    if (!force && now - dpsUi.last < 0.15) return;
    dpsUi.last = now;
    const list = [];
    for (const [, u] of state.units) {
      if (u.isSupport) continue;
      list.push({ u, dps: (u.dpsMeter || 0) / DPS_METER_WINDOW, total: u.totalDamage || 0 });
    }
    list.sort((a, b) => b.dps - a.dps);
    const top = list[0]?.dps || 0.0001;
    for (let i = 0; i < 3; i++) {
      const row = dpsRows[i];
      if (!row) continue;
      const it = list[i];
      if (!it || it.dps <= 0.01) {
        if (row.name) row.name.textContent = "—";
        if (row.val) row.val.textContent = "0/s";
        if (row.bar) { row.bar.style.width = "0%"; row.bar.style.opacity = "0.35"; }
        continue;
      }
      if (row.name) row.name.textContent = `${rarityName(it.u.itemRarity)} ${it.u.name}`;
      if (row.val) row.val.textContent = `${Math.round(it.dps)}/s · ${fmtCompact(it.total)}`;
      if (row.bar) {
        row.bar.style.width = `${clamp((it.dps / top) * 100, 0, 100).toFixed(1)}%`;
        row.bar.style.opacity = "0.85";
        row.bar.style.background = rarityColor(it.u.itemRarity);
      }
    }
  }

  function hideMenus() {
    buyMenu.classList.add("hidden");
    tooltip.classList.add("hidden");
    state.buyCell = null;
    state.selectedKey = null;
  }

  function clampMenuToViewport(el, x, y) {
    const pad = 10;
    el.style.left = "0px"; el.style.top = "0px";
    el.classList.remove("hidden");
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    el.style.left = `${Math.floor(clamp(x, pad, vw - r.width - pad))}px`;
    el.style.top = `${Math.floor(clamp(y, pad, vh - r.height - pad))}px`;
  }

  function showBuyMenu(clientX, clientY, cell) {
    state.buyCell = cell;
    tooltip.classList.add("hidden");
    buyDrawBtn.disabled = state.econ.tickets.common <= 0;
    clampMenuToViewport(buyMenu, clientX, clientY);
  }

  // ---------------- Moving Rail & Hotzones ----------------

  function dirVec(dir) {
    switch (dir) {
      case DIRS.UP: return { x: 0, y: -1 };
      case DIRS.DOWN: return { x: 0, y: 1 };
      case DIRS.LEFT: return { x: -1, y: 0 };
      case DIRS.RIGHT: return { x: 1, y: 0 };
      default: return { x: 0, y: 0 };
    }
  }

  function dirArrow(dir) {
    switch (dir) {
      case DIRS.UP: return "↑"; case DIRS.DOWN: return "↓";
      case DIRS.LEFT: return "←"; case DIRS.RIGHT: return "→";
      default: return "·";
    }
  }

  function canMoveAnchor(r0, c0, dir) {
    const v = dirVec(dir);
    return r0 + v.y >= 0 && r0 + v.y <= 2 && c0 + v.x >= 0 && c0 + v.x <= 2;
  }

  function pickNextShiftDir() {
    const dirs = [DIRS.UP, DIRS.DOWN, DIRS.LEFT, DIRS.RIGHT];
    const a = state.pathAnchor;
    const valid = dirs.filter((d) => canMoveAnchor(a.r0, a.c0, d));
    if (valid.length === 0) return DIRS.RIGHT;
    const blocked = state.shiftRepeat >= 2 ? state.shiftDir : null;
    const pool = blocked ? valid.filter((d) => d !== blocked) : valid;
    const finalPool = pool.length > 0 ? pool : valid;
    return finalPool[Math.floor(Math.random() * finalPool.length)];
  }

  function applyShiftForUpcomingStage() {
    const dir = pickNextShiftDir();
    const a = state.pathAnchor;
    const v = dirVec(dir);
    const nr = clampInt(a.r0 + v.y, 0, 2);
    const nc = clampInt(a.c0 + v.x, 0, 2);
    if (dir === state.shiftDir) state.shiftRepeat += 1; else state.shiftRepeat = 0;
    state.shiftDir = dir;
    const prev = { ...state.board.path };
    state.pathAnchor = { r0: nr, c0: nc };
    const next = pathRectFromAnchor(state.board, nr, nc);
    state.board.path = next;
    state.pathShiftAnim = { from: { x: prev.x, y: prev.y }, to: { x: next.x, y: next.y }, t: 0, dur: 0.22 };
    rollHotZones(dir);
    state.specialBoosts.clear();

    // ✅ 다음 웨이브 타입 미리 결정 (보스 라운드 제외)
    const boss = isBossRound(state.stage);
    state.nextWaveType = rollWaveType(state.stage, boss);
  }

  function rollHotZones(dir) {
    state.hotZones.clear();
    const b = state.board;
    const thresh = b.pxPerCell * 0.78;
    const dv = dirVec(dir);
    const pcx = b.path.x + b.path.w / 2;
    const pcy = b.path.y + b.path.h / 2;
    const candidates = [];
    for (const cell of b.cells) {
      if (cell.r === 2 && cell.c === 2) continue;
      const cx = cell.x + cell.w / 2, cy = cell.y + cell.h / 2;
      const d = distToRectPerimeter(cx, cy, b.path);
      if (d > thresh) continue;
      const closeness = 1 - clamp(d / thresh, 0, 1);
      const nx = (cx - pcx) / b.gridW, ny = (cy - pcy) / b.gridW;
      const dot = nx * dv.x + ny * dv.y;
      const forward = Math.max(0, dot);
      candidates.push({ key: cellKey(cell.r, cell.c), w: Math.max(0.08, 0.20 + 1.25 * closeness + 1.55 * forward), forward });
    }
    if (candidates.length === 0) {
      for (const cell of b.cells) {
        if (cell.r === 2 && cell.c === 2) continue;
        candidates.push({ key: cellKey(cell.r, cell.c), w: 1, forward: 0 });
      }
    }
    const frontPool = candidates.filter((c) => c.forward > 0.03);
    const backPool = candidates.filter((c) => c.forward <= 0.03);
    const chosen = [];
    const hzCount = Math.max(2, state.hotZoneCount ?? HOTZONE_COUNT_BASE);
    const frontCount = Math.min(4, hzCount);
    function pickOne(pool) {
      if (!pool || pool.length === 0) return null;
      const items = pool.map((p) => p.key);
      const weights = pool.map((p) => p.w);
      const pick = pickWeighted(items, weights);
      const idx = pool.findIndex((p) => p.key === pick);
      if (idx >= 0) pool.splice(idx, 1);
      return pick;
    }
    const fp = frontPool.slice(), bp = backPool.slice();
    while (chosen.length < frontCount && fp.length > 0) { const k = pickOne(fp); if (!k) break; chosen.push(k); }
    const restPool = candidates.filter((c) => !chosen.includes(c.key)).slice();
    while (chosen.length < hzCount && restPool.length > 0) { const k = pickOne(restPool); if (!k) break; chosen.push(k); }
    for (const k of chosen) { state.hotZones.set(k, Math.random() < 0.60 ? "ASPD" : "CRIT"); }
  }

  function hotKindForKey(key) { return state.hotZones.get(key) || null; }
  function isHotKey(key) { return state.hotZones.has(key); }
  function hotMulForKey(key) { const b = state.specialBoosts.get(key); if (!b) return 1; if (b.stage !== state.stage) return 1; return b.hotMul ?? 1; }

  function applyRarityBoost(r, boost) {
    let out = r;
    const n = Math.max(0, Math.min(2, boost | 0));
    for (let i = 0; i < n; i++) out = nextRarity(out);
    return out;
  }

  function optionBoostForUnit(u) { return Math.max(0, Math.min(2, (u && u.optBoost) ? (u.optBoost | 0) : 0)); }
  function optionCapRarityForUnit(u) { return applyRarityBoost(u.itemRarity, optionBoostForUnit(u)); }

  function stageModsForUnit(key, u) {
    let cdMul = 1.0, critAdd = 0.0, dmgMul = 1.0;
    const hk = hotKindForKey(key);
    if (hk) {
      const mul = hotMulForKey(key);
      if (hk === "ASPD") cdMul = clamp(1 - (state.hotAspdBonus ?? HOTZONE_ASPD_BONUS_BASE) * mul, 0.55, 1.0);
      else critAdd = (state.hotCritBonus ?? HOTZONE_CRIT_BONUS_BASE) * mul;
    }
    if (state.stageFury && state.stageFury.stage === state.stage) {
      cdMul *= (state.stageFury.cdMul ?? 1.0);
      dmgMul *= (state.stageFury.dmgMul ?? 1.0);
    }
    cdMul = clamp(cdMul, 0.40, 1.0);
    return { cdMul, critAdd, dmgMul };
  }

  function applyMetaToUnit(u) {
    if (!u) return;
    const m = state.metaMods;
    if (!m) return;
    u.damage = Math.max(1, Math.round(u.damage * (1 + (m.dmgPct ?? 0))));
    const def = UNIT_DEFS[u.type] || {};
    const floorCd = def.cooldownFloor ?? 0.22;
    u.cooldown = Math.max(floorCd, u.cooldown * clamp(1 - (m.cdReducePct ?? 0), 0.55, 1.0));
    u.cd = Math.min(u.cd ?? 0, u.cooldown);
    u.critChance = clamp((u.critChance ?? 0) + (m.critChanceAdd ?? 0), 0, 0.95);
    u.critMult = Math.max(1.1, (u.critMult ?? 1.5) + (m.critMultAdd ?? 0));
    if (m.penAdd) u.penetration = Math.max(0, (u.penetration || 0) + m.penAdd);
  }

  function maybeUpgradeRarityOnce(r, chance) {
    if (!chance || chance <= 0) return r;
    if (Math.random() >= chance) return r;
    return nextRarity(r);
  }

  function applyRarityUpChances(r) {
    const ch = clamp(state.metaMods?.rarityUpChance ?? 0, 0, 0.25);
    let out = maybeUpgradeRarityOnce(r, ch);
    out = maybeUpgradeRarityOnce(out, ch * 0.35);
    return out;
  }

  function rollItemRarityForDrawWithMeta() { return applyRarityUpChances(rollItemRarityForDraw()); }

  function rarityClass(r) {
    switch (r) {
      case ITEM_RARITY.NORMAL: return "r-normal"; case ITEM_RARITY.MAGIC: return "r-magic";
      case ITEM_RARITY.RARE: return "r-rare"; case ITEM_RARITY.LEGENDARY: return "r-legend";
      case ITEM_RARITY.UNIQUE: return "r-unique"; case ITEM_RARITY.MYTHIC: return "r-mythic";
      default: return "r-normal";
    }
  }

  function buildTooltip(unit) {
    const rName = rarityName(unit.itemRarity);
    const title = `${rName} ${unit.name}`;
    const color = rarityColor(unit.itemRarity);
    ttTitle.innerHTML = `<span class="${rarityClass(unit.itemRarity)}">${safeText(title)}</span>`;
    ttSub.textContent = UNIT_DEFS[unit.type]?.desc ?? "";
    const lines = [];
    if (unit.isSupport) {
      lines.push(`역할: 지원`);
      lines.push(`오라: 사거리 x${(unit.auraProvideRangeMul||1.2).toFixed(2)} / 치명 x${(unit.auraProvideCritChanceMul||1.2).toFixed(2)}`);
    } else {
      const aps = 1 / unit.cooldown;
      lines.push(`공격력: ${unit.damage}`);
      lines.push(`공속: ${aps.toFixed(2)}/s (쿨: ${unit.cooldown.toFixed(2)}s)`);
      lines.push(`사거리: ${fmtCells(unit.rangeCells)}`);
      lines.push(`관통: ${Number(unit.penetration||0).toFixed(1)}`);
      lines.push(`우선: ${targetPriorityName(unit.targetPriority)}`);
      lines.push(`치명: ${(unit.critChance*100).toFixed(1)}% / x${unit.critMult.toFixed(2)}`);
    }
    if (!unit.isSupport) {
      if (unit.multiShots > 0) lines.push(`멀티샷: +${unit.multiShots}`);
      if (unit.ricochet > 0) lines.push(`연쇄: +${unit.ricochet} (감쇠: ${(unit.ricochetFactor*100).toFixed(0)}%)`);
      if (unit.blastRadiusCells > 0) lines.push(`폭발: ${fmtCells(unit.blastRadiusCells)} / 스플래시 ${(unit.splashMul*100).toFixed(0)}%`);
      if (unit.slowDuration > 0) lines.push(`둔화: ${unit.slowDuration.toFixed(1)}s / x${unit.slowFactor.toFixed(2)}`);
      if (unit.executeBonus > 0) lines.push(`처형: +${Math.round(unit.executeBonus*100)}%`);
      if (unit.pressureDmg > 0) lines.push(`압박: 최대 +${Math.round(unit.pressureDmg*100)}%`);
      if (unit.maxHpPctDmg > 0) lines.push(`최대체력 비례: +${fmtPct01(unit.maxHpPctDmg)}`);
      if (unit.magSize > 0) lines.push(`탄창: ${unit.magAmmo}/${unit.magSize} / 재장전 ${unit.reloadTime.toFixed(1)}s`);
      if (unit.overheatMax > 0) lines.push(`과열: ${unit.overheatShots}/${unit.overheatMax} / 냉각 ${unit.overheatCool.toFixed(1)}s`);
      if (unit.auraOn) lines.push(`오라 버프 ON: 사거리 x${unit.auraRangeMul.toFixed(2)} / 치명 x${unit.auraCritChanceMul.toFixed(2)}`);
    }
    ttStats.textContent = lines.join("\n");
    const optLines = [];
    for (const opt of unit.options) {
      optLines.push({ text: formatOption(opt), color: rarityColor(opt.rarity), rarity: opt.rarity });
    }
    ttOptions.innerHTML = optLines.map((o) => `<div style="color:${o.color}; font-weight:${rarityRank(o.rarity)>=3?800:600};">${safeText(o.text)}</div>`).join("");
    const isMythic = unit.itemRarity === ITEM_RARITY.MYTHIC;
    const key = cellKey(unit.r, unit.c);
    const hk = hotKindForKey(key);
    const hotMul = hotMulForKey(key);
    const ha = state.hotAspdBonus ?? HOTZONE_ASPD_BONUS_BASE;
    const hc = state.hotCritBonus ?? HOTZONE_CRIT_BONUS_BASE;
    const hotLine = hk ? (hk==="ASPD" ? `HOT ZONE: 공속 +${Math.round(ha*100*hotMul)}%` : `HOT ZONE: 치명 +${Math.round(hc*100*hotMul)}%p`) : "";
    const streak = state.rerollStreak.key === key ? state.rerollStreak.count : 0;
    const nextCount = (state.rerollStreak.key===key ? (streak+1) : 1);
    const bestOfBase = (nextCount>=REROLL_STREAK_NEED) ? 3 : (nextCount>=1 ? 2 : 1);
    const bestOfBonus = state.metaMods?.streakBestOfBonus ?? 0;
    const bestOfNext = Math.min(4, bestOfBase+bestOfBonus);
    const bonusHint = streak < REROLL_STREAK_NEED ? `베스트오브${bestOfNext}` : "";
    const streakLine = (streak>=REROLL_STREAK_NEED)
      ? `연속 리롤: <b style="color:#ffd43b;">SPECIAL 준비 완료!</b>`
      : (streak>=1 ? `연속 리롤: ${streak}/${REROLL_STREAK_NEED} (${bonusHint})` : `연속 리롤: 0/${REROLL_STREAK_NEED}`);
    const ob = optionBoostForUnit(unit);
    const optBoostLine = ob > 0 ? `옵션 각인: <b style="color:${rarityColor(nextRarity(unit.itemRarity))};">+${ob}</b>` : "";
    modBtn.disabled = state.econ.tickets.rare <= 0;
    awakenBtn.disabled = isMythic || state.econ.tickets.legend <= 0;
    rerollBtn.disabled = state.econ.tickets.common <= 0;
    legendRerollBtn.disabled = isMythic || state.econ.tickets.legend <= 0 || state.econ.tickets.common < (state.legendRerollCommonCost ?? LEGEND_REROLL_COMMON_COST_BASE);
    ttHint.innerHTML = `<span style="color:${color}; font-weight:800;">${rName}</span> 일반=뽑기/리롤 · 레어=개조 · 전설=각성/전설리롤(전설1+일반${state.legendRerollCommonCost??LEGEND_REROLL_COMMON_COST_BASE})`
      + (hotLine ? `<br/>${hotLine}` : "")
      + (optBoostLine ? `<br/>${optBoostLine}` : "")
      + `<br/>${streakLine}`
      + (isMythic ? `<br/><b style="color:${rarityColor(ITEM_RARITY.MYTHIC)};">신화는 각성/전설리롤 불가</b>` : "");
  }

  function showTooltip(clientX, clientY, key) {
    const unit = state.units.get(key);
    if (!unit) return;
    state.selectedKey = key;
    buyMenu.classList.add("hidden");
    buildTooltip(unit);
    clampMenuToViewport(tooltip, clientX, clientY);
  }

  function openHelp() { helpBody.innerHTML = buildHelpHTML(); helpOverlay.classList.remove("hidden"); }
  function closeHelp() { helpOverlay.classList.add("hidden"); }

  // ---------------- Shop panel ----------------

  function renderShopPanel() {
    if (!shopPanel) return;
    const common = state.econ.tickets.common ?? 0;
    const rare = state.econ.tickets.rare ?? 0;
    const legend = state.econ.tickets.legend ?? 0;
    const isPrep = state.roundPhase === "PREP";
    const hasSel = !!state.selectedKey && state.units.has(state.selectedKey);
    const furyActive = !!(state.stageFury && state.stageFury.stage === state.stage);

    const commonItems = [
      { id: "C_CORE_PATCH", title: "코어 수리 +1", desc: "PREP에서만. 코어 최대치까지.", cost: 3, enabled: common >= 3 && isPrep && state.coreHp < (state.coreHpMax ?? 20), currency: "common" },
      { id: "C_STREAK_PLUS", title: "연속 리롤 +1스택", desc: "선택한 타워의 리롤 스택 +1", cost: 2, enabled: common >= 2 && hasSel, currency: "common" },
    ];
    const rareItems = [
      { id: "R_COMMON_PACK", title: "일반 티켓 +6", desc: "도박 연료 보충.", cost: 1, enabled: rare >= 1, currency: "rare" },
      { id: "R_HOT_REROLL", title: "HOT ZONE 재배치", desc: "이번 스테이지 HOT ZONE 재굴림. (PREP)", cost: 1, enabled: rare >= 1 && isPrep, currency: "rare" },
      { id: "R_SPECIAL_CHARGE", title: "SPECIAL 충전", desc: "다음 리롤을 SPECIAL PICK으로.", cost: 2, enabled: rare >= 2 && hasSel, currency: "rare" },
    ];
    const legendItems = [
      { id: "L_HOT_OVERDRIVE", title: "HOT ZONE 오버드라이브", desc: "HOT ZONE 배율 x2. (PREP)", cost: 1, enabled: legend >= 1 && isPrep, currency: "legend" },
      { id: "L_STAGE_FURY", title: "스테이지 광폭", desc: "이번 스테이지 공격력 +20%, 공속 +10%.", cost: 1, enabled: legend >= 1 && !furyActive, currency: "legend" },
    ];

    function renderList(root, items, curLabel) {
      if (!root) return;
      root.innerHTML = items.map((it) => {
        const dis = it.enabled ? "" : "disabled";
        return `<button class="shop-item" data-shopid="${it.id}" data-cur="${it.currency}" ${dis}><div class="shop-title">${safeText(it.title)}</div><div class="shop-desc">${safeText(it.desc)}</div><div class="shop-cost">비용: ${curLabel} ${it.cost}</div></button>`;
      }).join("");
    }
    renderList(shopCommonItems, commonItems, "일반");
    renderList(shopRareItems, rareItems, "레어");
    renderList(shopLegendItems, legendItems, "전설");
  }

  function handleShopPurchase(id, currency) {
    function fail(msg) { state.msg = { text: msg, t: 0.9 }; }
    const c = state.econ.tickets.common ?? 0;
    const r = state.econ.tickets.rare ?? 0;
    const l = state.econ.tickets.legend ?? 0;

    if (currency === "common") {
      if (id === "C_CORE_PATCH") {
        if (state.roundPhase !== "PREP") return fail("PREP에서만 가능");
        if (c < 3) return fail("일반 티켓 부족");
        if (state.coreHp >= (state.coreHpMax ?? 20)) return fail("코어가 이미 최대");
        state.econ.tickets.common -= 3; state.coreHp = Math.min(state.coreHpMax??20, state.coreHp+1);
        state.msg = { text: "코어 수리 +1", t: 0.8 }; syncTopUI(); return;
      }
      if (id === "C_STREAK_PLUS") {
        if (c < 2) return fail("일반 티켓 부족");
        const key = state.selectedKey;
        if (!key || !state.units.has(key)) return fail("타워를 선택하세요");
        state.econ.tickets.common -= 2;
        const cur = (state.rerollStreak.key===key) ? state.rerollStreak.count : 0;
        state.rerollStreak = { key, count: Math.min(REROLL_STREAK_NEED, cur+1) };
        state.msg = { text: "연속 리롤 +1", t: 0.8 }; syncTopUI(); buildTooltip(state.units.get(key)); return;
      }
    }
    if (currency === "rare") {
      if (id === "R_COMMON_PACK") { if (r<1) return fail("레어 티켓 부족"); state.econ.tickets.rare-=1; state.econ.tickets.common+=6; state.msg={text:"일반 티켓 +6",t:0.8}; syncTopUI(); return; }
      if (id === "R_HOT_REROLL") { if (r<1) return fail("레어 티켓 부족"); if (state.roundPhase!=="PREP") return fail("PREP에서만"); state.econ.tickets.rare-=1; rollHotZones(state.shiftDir); state.specialBoosts.clear(); state.msg={text:"HOT ZONE 재배치!",t:0.8}; syncTopUI(); return; }
      if (id === "R_SPECIAL_CHARGE") {
        if (r<2) return fail("레어 티켓 부족");
        const key = state.selectedKey;
        if (!key || !state.units.has(key)) return fail("타워를 선택하세요");
        state.econ.tickets.rare-=2; state.rerollStreak={key, count:REROLL_STREAK_NEED};
        state.msg={text:"SPECIAL 충전 완료",t:0.8}; syncTopUI(); buildTooltip(state.units.get(key)); return;
      }
    }
    if (currency === "legend") {
      if (id === "L_HOT_OVERDRIVE") {
        if (l<1) return fail("전설 티켓 부족");
        if (state.roundPhase!=="PREP") return fail("PREP에서만 추천");
        state.econ.tickets.legend-=1;
        for (const k of state.hotZones.keys()) state.specialBoosts.set(k, { hotMul:2, stage:state.stage });
        state.msg={text:"HOT ZONE 오버드라이브!",t:0.9}; syncTopUI(); return;
      }
      if (id === "L_STAGE_FURY") {
        if (l<1) return fail("전설 티켓 부족");
        if (state.stageFury && state.stageFury.stage===state.stage) return fail("이미 적용됨");
        state.econ.tickets.legend-=1; state.stageFury={stage:state.stage, dmgMul:1.20, cdMul:0.90};
        state.msg={text:"스테이지 광폭!",t:0.9}; syncTopUI(); return;
      }
    }
  }

  // ---------------- Skill tree ----------------

  let selectedSkillId = null;

  function hideSkillInline() { if (!skillInline) return; skillInline.classList.add("hidden"); skillInline.style.visibility="visible"; }

  function positionSkillInline(id) {
    if (!skillInline || !skillTreeWrap || !skillTree) return;
    if (!id) { hideSkillInline(); return; }
    const el = skillTree.querySelector(`[data-skill="${id}"]`);
    if (!el) { hideSkillInline(); return; }
    skillInline.classList.remove("hidden"); skillInline.style.visibility="hidden";
    const wrapRect = skillTreeWrap.getBoundingClientRect();
    const nodeRect = el.getBoundingClientRect();
    const popRect = skillInline.getBoundingClientRect();
    let x = nodeRect.right - wrapRect.left + 10;
    let y = nodeRect.top - wrapRect.top + 2;
    if (x + popRect.width > wrapRect.width - 8) x = nodeRect.left - wrapRect.left - popRect.width - 10;
    x = clamp(x, 8, wrapRect.width - popRect.width - 8);
    y = clamp(y, 8, wrapRect.height - popRect.height - 8);
    skillInline.style.left=`${x}px`; skillInline.style.top=`${y}px`; skillInline.style.visibility="visible";
  }

  function tryUpgradeSkill(node) {
    const chk2 = canUpgradeSkill(meta, node);
    if (!chk2.ok) { state.msg={text:"업그레이드 불가",t:0.8}; return false; }
    const cur2 = getSkillLevel(meta, node.id);
    if (cur2 >= SKILL_MAX_LEVEL) return false;
    const cost2 = chk2.cost ?? skillUpgradeCost(node, cur2);
    meta.xp = Math.max(0, (meta.xp??0) - cost2);
    meta.skills[node.id] = cur2 + 1;
    saveMetaState(meta); syncMetaUI(); return true;
  }

  function renderSkillInline(id) {
    if (!skillInline) return;
    if (!id) { hideSkillInline(); return; }
    const node = SKILL_NODES.find((n) => n.id === id) || null;
    if (!node) { hideSkillInline(); return; }
    const cur = getSkillLevel(meta, node.id);
    const maxed = cur >= SKILL_MAX_LEVEL;
    const next = Math.min(SKILL_MAX_LEVEL, cur + 1);
    const cost = maxed ? 0 : skillUpgradeCost(node, cur);
    const chk = canUpgradeSkill(meta, node);
    let hint = "";
    if (!chk.ok) {
      if (chk.reason==="TIER_LOCK") hint=`이전 티어(T${node.tier-1}) 1레벨 필요`;
      else if (chk.reason==="PARENT_LOCK") hint="이전 스킬 1레벨 필요";
      else if (chk.reason==="NO_XP") hint=`XP 부족 (${cost})`;
      else if (chk.reason==="MAX") hint="MAX";
    }
    const curFx = fmtEffect(node, cur);
    const nextFx = maxed ? "-" : fmtEffect(node, next);
    skillInline.innerHTML = `
      <div class="title">${safeText(node.name)}</div>
      <div class="sub">Lv ${cur}/${SKILL_MAX_LEVEL} → ${next}/${SKILL_MAX_LEVEL}</div>
      <div class="sub">현재 ${safeText(curFx)} · 다음 ${safeText(nextFx)}</div>
      ${hint ? `<div class="hint">${safeText(hint)}</div>` : `<div class="hint">Cost: <b>${cost}</b> XP</div>`}
      <div class="row"><button class="up" id="skill-inline-up" ${chk.ok?"":"disabled"}>+1 업그레이드</button><button class="x" id="skill-inline-x">✕</button></div>`;
    const up = document.getElementById("skill-inline-up");
    if (up) up.addEventListener("click", (ev) => { ev.stopPropagation(); if (tryUpgradeSkill(node)) { renderSkillTree(); renderSkillDetail(node.id); } });
    const x = document.getElementById("skill-inline-x");
    if (x) x.addEventListener("click", (ev) => { ev.stopPropagation(); selectedSkillId=null; hideSkillInline(); renderSkillTree(); renderSkillDetail(null); });
    requestAnimationFrame(() => positionSkillInline(id));
  }

  function openSkillTree() {
    if (!skillOverlay) return;
    buyMenu.classList.add("hidden"); tooltip.classList.add("hidden");
    renderSkillTree(); renderSkillDetail(selectedSkillId);
    skillOverlay.classList.remove("hidden"); state.uiPause = true;
  }

  function closeSkillTree() {
    if (!skillOverlay) return;
    skillOverlay.classList.add("hidden"); hideSkillInline();
    state.uiPause = isSpecialOpen();
  }

  function branchNameByCol(col) { return SKILL_BRANCHES.find((x) => x.col === col)?.name ?? ""; }

  function fmtPct(v, digits=1) { return (v*100).toFixed(digits); }

  function fmtEffect(node, lv) {
    if (!node?.effect) return "-";
    const k = node.effect.kind, per = node.effect.perLevel ?? 0;
    if (k==="HOT_COUNT_ADD") return lv>=10?"+1":"+0";
    if (k==="STREAK_BESTOF_BONUS") return `+${lv>=10?2:(lv>=5?1:0)}`;
    if (k==="LEGEND_REROLL_DISCOUNT") return `-${Math.floor(lv/3)}`;
    if (k==="CORE_DMG_MUL") return `-${fmtPct(Math.min(0.30,per*lv),0)}%`;
    if (k==="ENEMY_HP_MUL") return `-${fmtPct(Math.min(0.20,per*lv),0)}%`;
    const v = per * lv;
    switch (k) {
      case "DMG_PCT": case "BOSS_DMG_PCT": case "ELITE_DMG_PCT": case "PRESSURE_DMG_PCT": case "EXECUTE_DMG_PCT": return `+${fmtPct(v,1)}%`;
      case "CD_REDUCE_PCT": return `-${fmtPct(v,1)}%`;
      case "RANGE_ADD": return `+${v.toFixed(2)}칸`;
      case "CRIT_CHANCE_ADD": case "HOT_CRIT_ADD": return `+${fmtPct(v,2)}%p`;
      case "HOT_ASPD_ADD": return `+${fmtPct(v,1)}%p`;
      case "CRIT_MULT_ADD": return `+${v.toFixed(2)}`;
      case "SLOW_POWER": return `+${fmtPct(v,1)}%`;
      case "PEN_ADD": return `+${v.toFixed(2)}`;
      case "CORE_HP_ADD": case "START_COMMON_ADD": case "START_RARE_ADD": case "START_LEGEND_ADD": return `+${Math.round(v)}`;
      case "PREP_REDUCE": return `-${v.toFixed(2)}s`;
      case "RARITY_UP_CHANCE": case "REROLL_REFUND_CHANCE": case "EXTRA_COMMON_CHANCE": case "EXTRA_RARE_CHANCE":
      case "BOSS_EXTRA_LEGEND_CHANCE": case "SPECIAL_REFUND_CHANCE": case "MYTHIC_JACKPOT_CHANCE": return `+${fmtPct(v,1)}%`;
      default: return String(v);
    }
  }

  function renderSkillTree() {
    if (!skillTree) return;
    syncMetaUI();
    const map = new Map();
    for (const n of SKILL_NODES) map.set(`${n.tier}_${n.col}`, n);
    const frags = [];
    for (let tier = 1; tier <= 12; tier++) {
      for (let col = 0; col < 3; col++) {
        const node = map.get(`${tier}_${col}`);
        if (!node) { frags.push(`<div></div>`); continue; }
        const cur = getSkillLevel(meta, node.id);
        const maxed = cur >= SKILL_MAX_LEVEL;
        const chk = canUpgradeSkill(meta, node);
        const locked = (!maxed && !chk.ok && (chk.reason==="TIER_LOCK"||chk.reason==="PARENT_LOCK"));
        const cost = maxed ? 0 : skillUpgradeCost(node, cur);
        const cls = ["skill-node", locked?"locked":"", maxed?"maxed":""].filter(Boolean).join(" ");
        const bname = branchNameByCol(node.col);
        const sel = (selectedSkillId===node.id) ? "style=\"outline:2px solid rgba(116,192,252,0.55);\"" : "";
        const costLine = maxed?"MAX":(locked?"LOCK":`Cost ${cost} XP`);
        frags.push(`<button class="${cls}" data-skill="${node.id}" ${sel}><div class="k">T${node.tier} · ${safeText(bname)}</div><div class="n">${safeText(node.name)}</div><div class="l">Lv ${cur}/${SKILL_MAX_LEVEL} · ${safeText(fmtEffect(node,cur))}</div><div class="c">${safeText(costLine)}</div></button>`);
      }
    }
    skillTree.innerHTML = frags.join("\n");
    skillTree.querySelectorAll("[data-skill]").forEach((el) => {
      el.addEventListener("click", () => { selectedSkillId=el.getAttribute("data-skill"); renderSkillTree(); renderSkillDetail(selectedSkillId); });
    });
    renderSkillInline(selectedSkillId);
    requestAnimationFrame(() => { drawSkillLines(); positionSkillInline(selectedSkillId); });
  }

  function renderSkillDetail(id) {
    if (!skillDetail) return;
    const node = SKILL_NODES.find((n) => n.id === id) || null;
    if (!node) { skillDetail.innerHTML = `<div class="small">왼쪽에서 스킬을 선택하세요.</div>`; return; }
    const cur = getSkillLevel(meta, node.id);
    const next = Math.min(SKILL_MAX_LEVEL, cur+1);
    const cost = cur>=SKILL_MAX_LEVEL ? 0 : skillUpgradeCost(node, cur);
    const chk = canUpgradeSkill(meta, node);
    let lockText = "";
    if (!chk.ok) {
      if (chk.reason==="TIER_LOCK") lockText=`잠김: T${node.tier-1}에서 1레벨 필요`;
      else if (chk.reason==="PARENT_LOCK") lockText="잠김: 이전 스킬 1레벨 필요";
      else if (chk.reason==="NO_XP") lockText=`XP 부족: ${cost} 필요`;
      else if (chk.reason==="MAX") lockText="MAX 레벨";
    }
    skillDetail.innerHTML = `
      <div class="big">${safeText(node.name)}</div>
      <div class="small" style="margin-bottom:8px;">T${node.tier} · ${safeText(branchNameByCol(node.col))} · Lv ${cur}/${SKILL_MAX_LEVEL}</div>
      <div class="desc">${safeText(node.desc)}\n\n현재: ${safeText(fmtEffect(node,cur))}\n다음: ${safeText(cur>=SKILL_MAX_LEVEL?"-":fmtEffect(node,next))}\n\n※ 효과는 다음 런부터.</div>
      <div class="meta" style="margin-top:10px;">보유 XP: <b>${meta.xp??0}</b> · 비용: <b>${cost}</b></div>
      ${lockText?`<div class="small" style="margin-top:8px;color:rgba(255,107,107,0.92);">${safeText(lockText)}</div>`:""}
      <div class="btnrow"><button id="skill-upgrade" ${chk.ok?"":"disabled"}>업그레이드</button><button id="skill-close2">닫기</button></div>`;
    const up = document.getElementById("skill-upgrade");
    if (up) up.addEventListener("click", () => { if (tryUpgradeSkill(node)) { renderSkillTree(); renderSkillDetail(node.id); } });
    const c2 = document.getElementById("skill-close2");
    if (c2) c2.addEventListener("click", () => closeSkillTree());
  }

  function drawSkillLines() {
    if (!skillLines || !skillTreeWrap || !skillTree) return;
    while (skillLines.firstChild) skillLines.removeChild(skillLines.firstChild);
    const wrapRect = skillTreeWrap.getBoundingClientRect();
    skillLines.setAttribute("width", String(wrapRect.width));
    skillLines.setAttribute("height", String(wrapRect.height));
    skillLines.setAttribute("viewBox", `0 0 ${wrapRect.width} ${wrapRect.height}`);
    const getCenter = (el) => {
      const r = el.getBoundingClientRect();
      return { x: (r.left+r.right)/2-wrapRect.left, y: (r.top+r.bottom)/2-wrapRect.top };
    };
    for (const node of SKILL_NODES) {
      const el = skillTree.querySelector(`[data-skill="${node.id}"]`);
      if (!el) continue;
      for (const pid of (node.parents||[])) {
        const pel = skillTree.querySelector(`[data-skill="${pid}"]`);
        if (!pel) continue;
        const a = getCenter(pel), b = getCenter(el);
        const parentLv = getSkillLevel(meta, pid);
        const line = document.createElementNS("http://www.w3.org/2000/svg","line");
        line.setAttribute("x1",String(a.x)); line.setAttribute("y1",String(a.y));
        line.setAttribute("x2",String(b.x)); line.setAttribute("y2",String(b.y));
        line.setAttribute("stroke",`rgba(255,255,255,${parentLv>=1?0.38:0.14})`);
        line.setAttribute("stroke-width","2"); line.setAttribute("stroke-linecap","round");
        skillLines.appendChild(line);
      }
    }
  }

  // ---------------- SPECIAL pick ----------------

  function isSpecialOpen() { return specialOverlay && !specialOverlay.classList.contains("hidden"); }

  function effectLabel(kind) {
    switch (kind) {
      case "RARITY_UP": return "등급 뻥 (베스트오브4)";
      case "OPTION_UP": return "옵션 각인 (+1, 유지)";
      case "HOT_OVERDRIVE": return "HOT 2배 (이번 스테이지)";
      case "REROLL_REFUND": return "티켓 환급 (+1 일반)";
      default: return "SPECIAL";
    }
  }

  function closeSpecialPick() {
    if (!specialOverlay) return;
    specialOverlay.classList.add("hidden"); state.pendingSpecial=null; state.uiPause=false;
  }

  function openGameOver() {
    if (!gameoverOverlay) return;
    buyMenu.classList.add("hidden"); tooltip.classList.add("hidden");
    if (helpOverlay) helpOverlay.classList.add("hidden");
    if (specialOverlay) specialOverlay.classList.add("hidden");
    if (skillOverlay) skillOverlay.classList.add("hidden");

    const st = state.stage;
    const sp = state.stageStats?.specials ?? 0;
    let bestText = "-";
    const best = state.stageStats?.best;
    if (best && best.rank >= 0) bestText = `${rarityName(best.rarity)} ${UNIT_DEFS[best.type]?.name??best.type}`;

    if (gameoverBody) {
      if (!state.metaAwarded) {
        const cleared = Math.max(0, st-1);
        const bestRank = best?.rank ?? 0;
        const bossTag = isBossRound(st) ? 1 : 0;
        const xpGain = Math.max(10, Math.round(30 + cleared*16 + bossTag*18 + sp*8 + bestRank*10));
        meta.xp = Math.max(0, (meta.xp??0) + xpGain);
        state.lastXpGain = xpGain; state.metaAwarded = true;
        saveMetaState(meta); syncMetaUI();
      }
      gameoverBody.innerHTML = `
        <div style="margin-bottom:8px;"><b>Stage ${st}</b> 에서 코어가 파괴되었습니다.</div>
        <div class="small">획득 XP: <b>+${state.lastXpGain||0}</b> · 보유 XP: <b>${meta.xp??0}</b></div>
        <div class="small">이번 스테이지 SPECIAL: <b>${sp}</b></div>
        <div class="small">이번 스테이지 최고 뽑기: <b>${safeText(bestText)}</b></div>
      `;
    }
    gameoverOverlay.classList.remove("hidden");
  }

  function applyRerollResultAtKey(key, result, { isSpecial = false } = {}) {
    if (!key || !result) return;
    const { nt, nr, opts, kind } = result;
    rebuildUnitAtKey(key, nt, nr, opts);
    const uu2 = state.units.get(key);
    if (uu2) uu2.optBoost = (result.optBoost != null) ? (result.optBoost|0) : (uu2.optBoost??0);
    if (isSpecial) {
      if (state.stageStats) state.stageStats.specials = (state.stageStats.specials??0)+1;
      const uu = state.units.get(key);
      if (uu) { addHitRing(uu.x, uu.y, "rgba(255,212,59,0.70)", true); addPuff(uu.x, uu.y, "rgba(255,212,59,0.45)", 1.25); }
      if (kind==="HOT_OVERDRIVE") state.specialBoosts.set(key, { hotMul:2, stage:state.stage });
      if (kind==="REROLL_REFUND") state.econ.tickets.common += 1;
      const ch = state.metaMods?.specialRefundChance ?? 0;
      if (ch > 0 && Math.random() < ch) {
        state.econ.tickets.common += 1;
        const uu3 = state.units.get(key);
        if (uu3) addFloater(uu3.x, uu3.y-18, "+1 일반", "rgba(255,255,255,0.85)", false);
      }
    }
    const uuJack = state.units.get(key);
    if (uuJack && uuJack.itemRarity===ITEM_RARITY.MYTHIC) {
      const ch = state.metaMods?.mythicJackpotChance ?? 0;
      if (ch > 0 && Math.random() < ch) {
        state.econ.tickets.legend += 1;
        addFloater(uuJack.x, uuJack.y-18, "+1 전설", "rgba(255,107,107,0.95)", true);
      }
    }
    const title = `${rarityName(nr)} ${UNIT_DEFS[nt]?.name??nt}`;
    state.msg = isSpecial ? { text:`SPECIAL PICK!  ${title}`, t:1.0 } : { text:title, t:0.8 };
    syncTopUI();
    if (state.selectedKey===key) { buildTooltip(state.units.get(key)); if (tooltip) tooltip.classList.remove("hidden"); }
  }

  function openSpecialPick(key, candidates) {
    if (!specialOverlay || !specialCards) { applyRerollResultAtKey(key, candidates&&candidates[0], { isSpecial:true }); return; }
    state.uiPause = true; state.pendingSpecial = { key, candidates };
    buyMenu.classList.add("hidden"); tooltip.classList.add("hidden");
    const html = (candidates||[]).map((c, idx) => {
      const rName = rarityName(c.nr); const rCol = rarityColor(c.nr); const uName = UNIT_DEFS[c.nt]?.name??c.nt;
      const optsHtml = (c.opts||[]).map((opt) => `<div style="color:${rarityColor(opt.rarity)};font-weight:${rarityRank(opt.rarity)>=3?800:600};">${safeText(formatOption(opt))}</div>`).join('');
      return `<button class="special-card" data-idx="${idx}" style="border-color:${rCol};"><div class="sc-title"><span class="${rarityClass(c.nr)}">${safeText(rName)}</span> ${safeText(uName)}</div><div class="sc-sub">${safeText(effectLabel(c.kind))} · 옵션 ${(c.opts||[]).length}줄</div><div class="sc-tag">${safeText(effectLabel(c.kind))}</div><div class="sc-opts">${optsHtml}</div></button>`;
    }).join('');
    specialCards.innerHTML = html || '<div class="small">후보 생성 실패</div>';
    specialOverlay.classList.remove("hidden");
  }

  function pickSpecialIndex(idx) {
    const p = state.pendingSpecial;
    if (!p || !p.candidates || !p.candidates[idx]) return;
    closeSpecialPick(); applyRerollResultAtKey(p.key, p.candidates[idx], { isSpecial:true });
  }

  if (specialCards) specialCards.addEventListener("click", (ev) => { const btn=ev.target.closest('.special-card'); if (!btn) return; const idx=Number(btn.getAttribute('data-idx')); if (Number.isFinite(idx)) pickSpecialIndex(idx); });
  if (specialRandomBtn) specialRandomBtn.addEventListener("click", () => { const p=state.pendingSpecial; if (!p||!p.candidates||p.candidates.length===0) return; pickSpecialIndex(Math.floor(Math.random()*p.candidates.length)); });

  // ---------------- Round & tickets ----------------

  function isBossRound(stage) { return stage % 10 === 0; }

  function waveParamsForStage(stage, waveType) {
    const boss = isBossRound(stage);
    if (boss) {
      return {
        pages: 2,
        pageSize: 6 + Math.floor((stage-1)/20),
        spawnEvery: 0.28,
        pageGap: 1.00,
        bossDelay: 1.6,
      };
    }

    // ✅ 웨이브 타입별 파라미터 조정
    const basePageSize = 6 + Math.floor((stage-1)/10);
    let pages = 3, pageSize = basePageSize, spawnEvery = 0.30, pageGap = 0.90;

    switch (waveType) {
      case WAVE_TYPE.SWARM:
        // 대군: 적 수 +50%, 빠른 스폰
        pages = 4;
        pageSize = Math.round(basePageSize * 1.5);
        spawnEvery = 0.20;
        pageGap = 0.70;
        break;
      case WAVE_TYPE.SIEGE:
        // 공성: 느린 스폰, 페이지 적음
        pages = 2;
        pageSize = Math.round(basePageSize * 0.75);
        spawnEvery = 0.50;
        pageGap = 1.30;
        break;
      case WAVE_TYPE.RUSH:
        // 돌격: 모두 한 번에 러시
        pages = 2;
        pageSize = Math.round(basePageSize * 1.2);
        spawnEvery = 0.18;
        pageGap = 0.55;
        break;
      case WAVE_TYPE.SPLIT:
        // 분리: 짧은 갭으로 2그룹
        pages = 4;
        pageSize = Math.round(basePageSize * 0.8);
        spawnEvery = 0.25;
        pageGap = 0.45;
        break;
      case WAVE_TYPE.PHANTOM:
        // 유령: 초고속 스폰
        pages = 3;
        pageSize = Math.round(basePageSize * 1.3);
        spawnEvery = 0.14;
        pageGap = 0.60;
        break;
    }

    return { pages, pageSize, spawnEvery, pageGap, bossDelay: 0 };
  }

  function startStage(stage) {
    const boss = isBossRound(stage);

    // ✅ 웨이브 타입 적용
    const wt = state.nextWaveType ?? WAVE_TYPE.NORMAL;
    state.currentWaveType = wt;

    const p = waveParamsForStage(stage, wt);

    if (!state.stageStats || state.stageStats.stage !== stage) state.stageStats = makeStageStats(stage);
    state.stageStats.dmg.clear(); state.stageStats.kills.clear(); state.stageStats.crits.clear();

    state.wave = {
      stage, boss,
      waveType: wt,
      pages: p.pages, pageSize: p.pageSize, spawnEvery: p.spawnEvery, pageGap: p.pageGap, bossDelay: p.bossDelay,
      elapsed: 0, next: 0, page: 0, spawnedInPage: 0, doneSpawning: false, bossSpawned: false,
      totalSpawned: 0, totalToSpawn: p.pages * p.pageSize + (boss ? 1 : 0),
    };

    state.roundPhase = "RUN";

    // ✅ 웨이브 타입 예고 메시지
    const winfo = WAVE_TYPE_INFO[wt];
    if (boss) {
      state.msg = { text: `BOSS ROUND ${stage}`, t: 1.4 };
    } else if (wt !== WAVE_TYPE.NORMAL && winfo) {
      state.msg = { text: `${winfo.name.toUpperCase()} WAVE! ${stage}`, t: 1.4 };
      // 웨이브 시작 시 화면 흔들기 (특수 웨이브 강조)
      triggerScreenShake(0.22, 0.18, 10);
    } else {
      state.msg = { text: `ROUND ${stage}`, t: 1.4 };
    }

    updateWaveTypeUI();
  }

  function grantStageRewards(stage) {
    const gain = { common: 0, rare: 0, legend: 0 };
    state.econ.tickets.common += 1; gain.common += 1;
    if (stage % 3 === 0) { state.econ.tickets.rare += 1; gain.rare += 1; }
    if (isBossRound(stage)) {
      state.econ.tickets.legend += 1; state.econ.tickets.rare += 1; state.econ.tickets.common += 1;
      gain.legend += 1; gain.rare += 1; gain.common += 1;
      const ch = state.metaMods?.bossExtraLegendChance ?? 0;
      if (ch > 0 && Math.random() < ch) { state.econ.tickets.legend += 1; gain.legend += 1; }
    }
    const cch = state.metaMods?.extraCommonChance ?? 0;
    if (cch > 0 && Math.random() < cch) { state.econ.tickets.common += 1; gain.common += 1; }
    const rch = state.metaMods?.extraRareChance ?? 0;
    if (rch > 0 && Math.random() < rch) { state.econ.tickets.rare += 1; gain.rare += 1; }
    return gain;
  }

  function clearStage(stage) {
    const g = grantStageRewards(stage);
    const tag = `+C${g.common} +R${g.rare} +L${g.legend}`;
    state.msg = { text: `CLEAR!  ${tag}`, t: 1.2 };
    state.stage += 1;
    state.roundPhase = "PREP";
    const base = isBossRound(state.stage) ? 3.5 : 2.5;
    state.prepTimer = Math.max(1.25, base - (state.metaMods?.prepReduceSec ?? 0));
    state.wave = null;
    applyShiftForUpcomingStage();
    state.stageStats = makeStageStats(state.stage);
    syncTopUI();
  }

  function decorateEnemyVisual(en) { en.animSeed = Math.random() * 10; }

  function spawnEnemy(type, waveType) {
    const wt = waveType || state.currentWaveType || WAVE_TYPE.NORMAL;
    const en = makeEnemy(type, state.board.path, state.stage, {}, wt);
    decorateEnemyVisual(en);
    const ehm = state.metaMods?.enemyHpMul ?? 1;
    if (ehm !== 1) { en.maxHp = Math.max(1, Math.round(en.maxHp * ehm)); en.hp = en.maxHp; }
    en.dist = -Math.random() * 22;
    const p = pointOnRect(state.board.path, en.dist);
    en.x = p.x; en.y = p.y;
    state.enemies.push(en);
  }

  function spawnBoss() {
    const boss = makeEnemy(ENEMY_TYPES.BOSS, state.board.path, state.stage);
    decorateEnemyVisual(boss);
    boss.dist = 0;
    const p = pointOnRect(state.board.path, boss.dist);
    boss.x = p.x; boss.y = p.y;
    boss.maxLaps = 3; boss.coreDmg = 10;
    const ehm = state.metaMods?.enemyHpMul ?? 1;
    if (ehm !== 1) { boss.maxHp = Math.max(1, Math.round(boss.maxHp * ehm)); boss.hp = boss.maxHp; }
    state.enemies.push(boss);
  }

  function confirmHighRarityReroll(actionName, unit, extraCostText="") {
    const isHigh = rarityRank(unit.itemRarity) >= rarityRank(ITEM_RARITY.LEGENDARY);
    if (!isHigh) return true;
    return window.confirm(`${rarityName(unit.itemRarity)} ${unit.name}\n\n정말 ${actionName} 하시겠습니까?${extraCostText?`\n${extraCostText}`:""}\n(되돌릴 수 없음)`);
  }

  // ---------------- Units actions ----------------

  function rebuildUnitAtKey(key, newType, newRarity, newOptions) {
    const prev = state.units.get(key);
    if (!prev) return;
    const cell = state.board.cells.find((cc) => cc.r===prev.r && cc.c===prev.c);
    const u = createUnit(newType, newRarity, newOptions, cell, state.board.pxPerCell);
    u.animSeed = prev.animSeed ?? Math.random() * 1000;
    u.kick = prev.kick ?? 0;
    u.optBoost = prev.optBoost ?? 0;
    u.totalDamage = prev.totalDamage ?? 0;
    u.dpsMeter = prev.dpsMeter ?? 0;
    applyMetaToUnit(u);
    u.cd = Math.min(prev.cd, u.cooldown);
    state.units.set(key, u);
    recordBestRoll(u.type, u.itemRarity);
  }

  function modSelectedUnit() {
    const key = state.selectedKey; if (!key) return;
    const u = state.units.get(key); if (!u) return;
    if (state.econ.tickets.rare <= 0) { state.msg={text:"레어 티켓 부족",t:0.8}; return; }
    state.econ.tickets.rare -= 1;
    const optCap = optionCapRarityForUnit(u);
    const opts = rollOptions(u.type, optCap);
    rebuildUnitAtKey(key, u.type, u.itemRarity, opts);
    syncTopUI(); buildTooltip(state.units.get(key));
  }

  function awakenSelectedUnit() {
    const key = state.selectedKey; if (!key) return;
    const u = state.units.get(key); if (!u) return;
    if (u.itemRarity===ITEM_RARITY.MYTHIC) { state.msg={text:"신화는 각성 불가",t:0.9}; return; }
    if (state.econ.tickets.legend <= 0) { state.msg={text:"전설 티켓 부족",t:0.9}; return; }
    state.econ.tickets.legend -= 1;
    const nr = nextRarity(u.itemRarity);
    const optCap = applyRarityBoost(nr, optionBoostForUnit(u));
    const opts = rollOptions(u.type, optCap);
    rebuildUnitAtKey(key, u.type, nr, opts);
    state.msg={text:"각성!",t:0.8}; syncTopUI(); buildTooltip(state.units.get(key));
  }

  function rerollSelectedUnit() {
    const key = state.selectedKey; if (!key) return;
    const u = state.units.get(key); if (!u) return;
    const isHot = isHotKey(key);
    const streak = state.rerollStreak.key===key ? state.rerollStreak.count : 0;
    const willSpecial = streak >= REROLL_STREAK_NEED;
    if (state.econ.tickets.common <= 0) { state.msg={text:"일반 티켓 부족",t:0.8}; return; }
    if (!confirmHighRarityReroll("리롤", u, "비용: 일반 1")) return;
    state.econ.tickets.common -= 1;
    const refundCh = state.metaMods?.rerollRefundChance ?? 0;
    if (refundCh > 0 && Math.random() < refundCh) {
      state.econ.tickets.common += 1;
      addFloater(u.x, u.y-18, "+1 일반", "rgba(255,255,255,0.85)", false);
    }
    if (willSpecial) { state.rerollStreak={key:null, count:0}; }
    else {
      const nextCount = state.rerollStreak.key===key ? (streak+1) : 1;
      state.rerollStreak = { key, count: nextCount };
    }
    if (willSpecial) {
      const kinds = isHot ? shuffledCopy(["RARITY_UP","OPTION_UP","HOT_OVERDRIVE"]) : shuffledCopy(["RARITY_UP","OPTION_UP","REROLL_REFUND"]);
      const candidates = [];
      const usedTypes = new Set();
      for (const kind of kinds) {
        let nt = rollUnitType(); let guard = 8;
        while (guard-- > 0 && usedTypes.has(nt)) nt = rollUnitType();
        usedTypes.add(nt);
        let nr = rollItemRarityForDrawWithMeta();
        if (kind==="RARITY_UP") {
          const all = [rollItemRarityForDrawWithMeta(),rollItemRarityForDrawWithMeta(),rollItemRarityForDrawWithMeta(),nr];
          all.sort((x,y) => rarityRank(y)-rarityRank(x)); nr=all[0];
          if (rarityRank(nr)<rarityRank(ITEM_RARITY.MAGIC)) nr=ITEM_RARITY.MAGIC;
        }
        const baseBoost = optionBoostForUnit(u);
        const newBoost = Math.max(0, Math.min(2, baseBoost + (kind==="OPTION_UP"?1:0)));
        const opts = rollOptions(nt, applyRarityBoost(nr, newBoost));
        candidates.push({ kind, nt, nr, opts, optBoost: newBoost });
      }
      state.msg={text:"SPECIAL PICK!",t:0.8}; openSpecialPick(key, candidates); syncTopUI(); return;
    }
    const nt = rollUnitType();
    const postCount = state.rerollStreak.key===key ? state.rerollStreak.count : 0;
    const bestOfBase = (postCount>=REROLL_STREAK_NEED) ? 3 : (postCount>=1 ? 2 : 1);
    const bestOfBonus = state.metaMods?.streakBestOfBonus ?? 0;
    const bestOf = Math.min(4, bestOfBase+bestOfBonus);
    const nr = bestOf>1 ? rollItemRarityBestOf(bestOf, rollItemRarityForDrawWithMeta, rarityRank) : rollItemRarityForDrawWithMeta();
    const optCap = applyRarityBoost(nr, optionBoostForUnit(u));
    const opts = bestOf>1 ? rollOptionsBestOf(bestOf, rollOptions, nt, optCap, rarityRank, OPTION_KIND) : rollOptions(nt, optCap);
    rebuildUnitAtKey(key, nt, nr, opts);
    const bonusTag = bestOf>1 ? ` (BONUSx${bestOf})` : "";
    state.msg={text:`${rarityName(nr)} ${UNIT_DEFS[nt]?.name??nt}${bonusTag}`,t:0.8};
    syncTopUI(); buildTooltip(state.units.get(key));
  }

  function rollItemRarityForLegendReroll(minRank) {
    const r = Math.random(); const rLegend = rarityRank(ITEM_RARITY.LEGENDARY);
    if (minRank<=rLegend) { if (r<0.92) return ITEM_RARITY.LEGENDARY; if (r<0.995) return ITEM_RARITY.UNIQUE; return ITEM_RARITY.MYTHIC; }
    if (r<0.97) return ITEM_RARITY.UNIQUE; return ITEM_RARITY.MYTHIC;
  }

  function legendRerollSelectedUnit() {
    const key = state.selectedKey; if (!key) return;
    const u = state.units.get(key); if (!u) return;
    if (u.itemRarity===ITEM_RARITY.MYTHIC) return;
    if (state.econ.tickets.legend<=0) { state.msg={text:"전설 티켓 부족",t:0.9}; return; }
    const cc = state.legendRerollCommonCost ?? LEGEND_REROLL_COMMON_COST_BASE;
    if (state.econ.tickets.common<cc) { state.msg={text:`일반 티켓 ${cc} 필요`,t:0.9}; return; }
    if (!confirmHighRarityReroll("전설리롤", u, `비용: 전설1+일반${cc}`)) return;
    state.econ.tickets.legend -= 1; state.econ.tickets.common -= cc;
    const nt = pickLegendUnitType(u.type);
    const minRank = Math.max(rarityRank(ITEM_RARITY.LEGENDARY), rarityRank(u.itemRarity));
    const nr = applyRarityUpChances(rollItemRarityForLegendReroll(minRank));
    const optCap = applyRarityBoost(nr, optionBoostForUnit(u));
    const opts = rollOptions(nt, optCap);
    rebuildUnitAtKey(key, nt, nr, opts);
    const uuJack = state.units.get(key);
    if (uuJack && uuJack.itemRarity===ITEM_RARITY.MYTHIC) {
      const ch = state.metaMods?.mythicJackpotChance ?? 0;
      if (ch>0 && Math.random()<ch) { state.econ.tickets.legend+=1; addFloater(uuJack.x, uuJack.y-18, "+1 전설", "rgba(255,107,107,0.95)", true); }
    }
    state.msg={text:`${rarityName(nr)} ${UNIT_DEFS[nt]?.name??nt}`,t:0.9}; syncTopUI(); buildTooltip(state.units.get(key));
  }

  function drawUnitAtCell(cell) {
    if (!cell) return;
    if (cell.r===2 && cell.c===2) return;
    const key = cellKey(cell.r, cell.c);
    if (state.units.has(key)) return;
    if (state.econ.tickets.common<=0) return;
    state.econ.tickets.common -= 1;
    const type = rollUnitType(); const rarity = rollItemRarityForDrawWithMeta();
    const opts = rollOptions(type, rarity);
    const unit = createUnit(type, rarity, opts, cell, state.board.pxPerCell);
    unit.animSeed = Math.random() * 1000; unit.kick = 0;
    applyMetaToUnit(unit);
    state.units.set(key, unit); recordBestRoll(unit.type, unit.itemRarity);
    if (unit.itemRarity===ITEM_RARITY.MYTHIC) {
      const ch = state.metaMods?.mythicJackpotChance ?? 0;
      if (ch>0 && Math.random()<ch) { state.econ.tickets.legend+=1; state.msg={text:"JACKPOT! 전설 +1",t:0.9}; }
    }
    syncTopUI();
  }

  // ---------------- Stage stats ----------------

  function statAdd(map, key, v) { if (!map) return; map.set(key, (map.get(key)||0)+v); }

  function recordDamage(key, dmg, isCrit) {
    const u = key ? state.units.get(key) : null;
    if (u) { u.totalDamage=(u.totalDamage||0)+dmg; u.dpsMeter=(u.dpsMeter||0)+dmg; }
    const st = state.stageStats;
    if (!st || st.stage!==state.stage) return;
    statAdd(st.dmg, key, dmg);
    if (isCrit) statAdd(st.crits, key, 1);
  }

  function recordKill(key) {
    const st = state.stageStats;
    if (!st || st.stage!=null && st.stage!==state.stage) return;
    statAdd(st.kills, key, 1);
  }

  function recordBestRoll(type, rarity) {
    const st = state.stageStats;
    if (!st || st.stage!==state.stage) return;
    const rk = rarityRank(rarity);
    if (rk > (st.best?.rank??-1)) st.best = { rank:rk, rarity, type };
  }

  // ---------------- Combat logic ----------------

  function enemyProgress(en) {
    const P = rectPerimeter(state.board.path);
    return en.laps + clamp(en.dist/P, 0, 1) + (en.rushing?10:0);
  }

  function pressureProgress(en) {
    if (en.rushing) return 1;
    const P = rectPerimeter(state.board.path);
    return clamp((en.laps + clamp(en.dist/P,0,1)) / Math.max(1,en.maxLaps||1), 0, 1);
  }

  function berserkerScore(en) { let s=enemyProgress(en); if(en.isBoss) s+=1000; else if(en.type===ENEMY_TYPES.ELITE) s+=100; return s; }
  function bossScore(en) { return (en.isBoss?10000:0)+enemyProgress(en); }
  function eliteScore(en) { return (en.type===ENEMY_TYPES.ELITE?3000:0)+enemyProgress(en); }
  function lowHpScore(en) { return (1-(en.maxHp>0?clamp(en.hp/en.maxHp,0,1):1))*10+enemyProgress(en); }
  function highHpScore(en) { return Math.log10((en.maxHp??1)+1)*5+enemyProgress(en); }

  function sortTargetsForUnit(u, arr) {
    const mode = u?.targetPriority;
    if (!mode||mode==="FRONT") { arr.sort((a,b)=>enemyProgress(b)-enemyProgress(a)); return; }
    switch (mode) {
      case "BERSERKER": arr.sort((a,b)=>berserkerScore(b)-berserkerScore(a)); return;
      case "BOSS": arr.sort((a,b)=>bossScore(b)-bossScore(a)); return;
      case "ELITE": arr.sort((a,b)=>eliteScore(b)-eliteScore(a)); return;
      case "LOW_HP": arr.sort((a,b)=>lowHpScore(b)-lowHpScore(a)); return;
      case "HIGH_HP": arr.sort((a,b)=>highHpScore(b)-highHpScore(a)); return;
      case "NEAR": arr.sort((a,b)=>{const ux=u.x??0,uy=u.y??0;const d=dist2(a.x,a.y,ux,uy)-dist2(b.x,b.y,ux,uy);return d!==0?d:enemyProgress(b)-enemyProgress(a);}); return;
      case "FAR": arr.sort((a,b)=>{const ux=u.x??0,uy=u.y??0;const d=dist2(b.x,b.y,ux,uy)-dist2(a.x,a.y,ux,uy);return d!==0?d:enemyProgress(b)-enemyProgress(a);}); return;
      case "BACK": arr.sort((a,b)=>enemyProgress(a)-enemyProgress(b)); return;
      default: arr.sort((a,b)=>enemyProgress(b)-enemyProgress(a)); return;
    }
  }

  function applySlow(en, factor, duration) {
    if (duration<=0) return;
    const sp = state.metaMods?.slowPower ?? 0;
    const f2 = sp>0 ? (factor*(1-sp)) : factor;
    en.slows.push({ factor:clamp(f2,0.18,0.98), t:duration });
  }

  function armorInteraction(pen, armor) {
    const a = Math.max(0, Number(armor)||0), p = Math.max(0, Number(pen)||0);
    if (a<=0.01) return { mul:1.0, ricochet:false };
    if (p>=a) { const over=p-a; return { mul:1+Math.min(0.15,over*0.03), ricochet:false }; }
    const ratio = clamp(p/a,0,1);
    const mul = 0.10+0.90*ratio*ratio;
    return { mul, ricochet:mul<0.78 };
  }

  function calcDamage(u, en, extra={}) {
    let dmg = u.damage * (extra.dmgMul??1);
    if (u.executeBonus>0 && en.hp/en.maxHp<=0.35) dmg *= 1+u.executeBonus;
    const m = state.metaMods;
    if (m) {
      if (en.isBoss) dmg *= 1+(m.bossDmgPct??0);
      else if (en.type===ENEMY_TYPES.ELITE) dmg *= 1+(m.eliteDmgPct??0);
      const pp = pressureProgress(en);
      if (pp>0) dmg *= 1+(m.pressureDmgPct??0)*pp;
      if (en.hp/en.maxHp<=0.35) dmg *= 1+(m.executeDmgPct??0);
    }
    if (u.pressureDmg>0) { const pp2=pressureProgress(en); if(pp2>0) dmg*=1+u.pressureDmg*pp2; }
    if (u.maxHpPctDmg>0) dmg += en.maxHp*u.maxHpPctDmg;
    let isCrit = false;
    const cc = clamp((u.critChance+(extra.critAdd??0))*(extra.critChanceMul??1),0,0.95);
    if (cc>0 && Math.random()<cc) { isCrit=true; dmg*=u.critMult; }
    const rawDmg = Math.max(1, Math.round(dmg));
    const ai = armorInteraction(u.penetration, en.armor);
    return { dmg:Math.max(1,Math.round(rawDmg*ai.mul)), rawDmg, isCrit, ricochet:ai.ricochet, armorMul:ai.mul };
  }

  function addBeam(x1, y1, x2, y2, color) {
    if (!state.vfxEnabled) return;
    state.beams.push({ x1, y1, x2, y2, t:0.10, color });
    const dx=x2-x1, dy=y2-y1, len=Math.hypot(dx,dy);
    if (len>40) {
      const nx=dx/len, ny=dy/len;
      const count = clamp(Math.floor(len/110),2,5);
      for (let i=0; i<count; i++) {
        const t=(i+1)/(count+1);
        const px=x1+dx*t+(Math.random()-0.5)*4, py=y1+dy*t+(Math.random()-0.5)*4;
        const life=0.16+Math.random()*0.10;
        state.puffs.push({ x:px,y:py,vx:nx*(20+Math.random()*40)+(Math.random()-0.5)*10,vy:ny*(20+Math.random()*40)+(Math.random()-0.5)*10,t:life,life,g:0,fric:0.86,r:1.6+Math.random()*1.2,color });
      }
    }
  }

  function triggerScreenShake(strength=0.25, dur=0.20, maxOffset=12) {
    if (!state.vfxEnabled) return;
    const s = state.screenShake; if (!s) return;
    s.life=Math.max(s.life||0,dur); s.t=Math.max(s.t||0,dur);
    s.strength=clamp((s.strength||0)+strength,0,1); s.maxOffset=Math.max(s.maxOffset||12,maxOffset);
    if (!s.seed) s.seed=Math.random()*1000;
  }

  function addFloater(x, y, text, color, crit) {
    const isNum=/^\d+$/.test(String(text));
    const dmgCrit = !!crit && isNum;
    const life = dmgCrit?0.95:0.85;
    state.floaters.push({ x,y,text,t:life,life,vy:dmgCrit?-52:-38,size:dmgCrit?24:16,color,crit,shake:dmgCrit,seed:Math.random()*1000 });
  }

  function densityScoreAt(candidate, all, r2) {
    let score=0;
    for (const en of all) { if(dist2(en.x,en.y,candidate.x,candidate.y)<=r2) score+=en.isBoss?1.35:(en.type===ENEMY_TYPES.ELITE?1.15:1.0); }
    return score;
  }

  function smartTargetsForUnit(u, inRange, shotCount) {
    const n = Math.max(1, Math.min(shotCount|0, inRange.length));
    if (inRange.length<=1) return inRange.slice(0,n);
    const ordered = inRange.slice();
    sortTargetsForUnit(u, ordered);
    if (u.type===UNIT_TYPES.MORTAR || u.type===UNIT_TYPES.CANNON) {
      const cand=ordered.slice(0,Math.min(10,ordered.length));
      const r=Math.max(1.0,u.blastRadiusCells||0)*state.board.pxPerCell;
      const r2=r*r;
      const scores=new Map();
      for (const e of cand) scores.set(e.id, densityScoreAt(e,inRange,r2));
      cand.sort((a,b)=>{const da=scores.get(a.id)||0,db=scores.get(b.id)||0;return db!==da?db-da:enemyProgress(b)-enemyProgress(a);});
      return cand.slice(0,n);
    }
    if (u.type===UNIT_TYPES.SNIPER||u.type===UNIT_TYPES.GIANTSLAYER) {
      const cand=ordered.slice(0,Math.min(12,ordered.length));
      cand.sort((a,b)=>b.hp!==a.hp?b.hp-a.hp:enemyProgress(b)-enemyProgress(a));
      return cand.slice(0,n);
    }
    return ordered.slice(0,n);
  }

  function addHitRing(x, y, color, crit=false) {
    if (!state.vfxEnabled) return;
    state.rings.push({ x,y,t:crit?0.42:0.30,r:crit?6:4,grow:crit?260:180,color,crit });
  }

  function addPuff(x, y, color, power=1.0) {
    if (!state.vfxEnabled) return;
    const vfx=VFX_INTENSITY_BASE;
    const count=Math.max(2,Math.round((6+6*power)*vfx));
    for (let i=0; i<count; i++) {
      const ang=Math.random()*Math.PI*2;
      const spd=(40+Math.random()*120)*power*(0.75+0.25*vfx);
      const life=0.45+Math.random()*0.25;
      state.puffs.push({ x,y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-10,t:life,life,g:90,fric:0.90,r:2+Math.random()*3,color });
    }
  }

  function dealDamage(attackerKey, u, en, baseDmg, isCrit, hitX, hitY, flags={}) {
    const ric=!!flags.ricochet;
    en.hp-=baseDmg; en.hitFlash=0.14;
    if (attackerKey) { en.lastHitKey=attackerKey; recordDamage(attackerKey,baseDmg,isCrit); }
    const ringCol=rarityColor(u.itemRarity);
    const floaterCol=isCrit?"rgba(255,107,107,0.95)":(ric?"rgba(210,210,210,0.92)":"rgba(255,255,255,0.92)");
    addFloater(hitX,hitY,`${baseDmg}`,floaterCol,isCrit);
    addHitRing(hitX,hitY,ringCol,isCrit);
    if (ric && flags.showRicochetText!==false) {
      en.ricochetPopupCd=en.ricochetPopupCd??0;
      if (en.ricochetPopupCd<=0) { addFloater(hitX,hitY-18,"도탄!","rgba(210,210,210,0.92)",false); en.ricochetPopupCd=0.35; }
    }
    if (u.slowDuration>0) applySlow(en,u.slowFactor,u.slowDuration);
  }

  function applySplash(attackerKey, u, centerX, centerY, mainTargetId, mainRawDmg) {
    if (u.blastRadiusCells<=0||u.splashMul<=0) return;
    const r2=(u.blastRadiusCells*state.board.pxPerCell)**2;
    for (const en of state.enemies) {
      if (en.id===mainTargetId) continue;
      if (dist2(en.x,en.y,centerX,centerY)<=r2) {
        const ai=armorInteraction(u.penetration,en.armor);
        const splashDmg=Math.max(1,Math.round(Math.max(1,Math.round(mainRawDmg*u.splashMul))*ai.mul));
        en.hp-=splashDmg; en.hitFlash=0.10;
        if (attackerKey) { en.lastHitKey=attackerKey; recordDamage(attackerKey,splashDmg,false); }
        addFloater(en.x,en.y,`${splashDmg}`,ai.ricochet?"rgba(210,210,210,0.82)":"rgba(255,255,255,0.85)",false);
        addHitRing(en.x,en.y,"rgba(255,255,255,0.55)",false);
        if (u.slowDuration>0) applySlow(en,u.slowFactor,u.slowDuration*0.75);
      }
    }
  }

  function applyRicochet(attackerKey, u, fromEnemy, startRawDmg, hitX, hitY) {
    if (u.ricochet<=0) return;
    let last=fromEnemy, raw=startRawDmg;
    const used=new Set([fromEnemy.id]);
    const chainR2=(state.board.pxPerCell*3.0)**2;
    for (let i=0; i<u.ricochet; i++) {
      raw=Math.max(1,Math.round(raw*u.ricochetFactor));
      let best=null, bestD2=Infinity;
      for (const en of state.enemies) {
        if (used.has(en.id)) continue;
        const d2=dist2(en.x,en.y,last.x,last.y);
        if (d2<=chainR2&&d2<bestD2) { best=en; bestD2=d2; }
      }
      if (!best) break;
      used.add(best.id);
      addBeam(last.x,last.y,best.x,best.y,"rgba(255,255,255,0.55)");
      const ai=armorInteraction(u.penetration,best.armor);
      const dmg=Math.max(1,Math.round(raw*ai.mul));
      best.hp-=dmg; best.hitFlash=0.10;
      if (attackerKey) { best.lastHitKey=attackerKey; recordDamage(attackerKey,dmg,false); }
      addFloater(best.x,best.y,`${dmg}`,ai.ricochet?"rgba(210,210,210,0.92)":"rgba(255,255,255,0.92)",false);
      addHitRing(best.x,best.y,"rgba(255,255,255,0.45)",false);
      if (u.slowDuration>0) applySlow(best,u.slowFactor,u.slowDuration*0.65);
      last=best;
    }
  }

  function cleanupDeadEnemies() {
    if (state.enemies.length===0) return;
    const alive=[];
    for (const en of state.enemies) {
      if (en.hp>0) { alive.push(en); continue; }
      if (!en.diedToCore&&en.lastHitKey) recordKill(en.lastHitKey);
      const c=en.color||"rgba(255,255,255,0.9)";
      const power=en.isBoss?2.2:(en.type===ENEMY_TYPES.ELITE?1.4:1.0);
      addPuff(en.x,en.y,c,power); addHitRing(en.x,en.y,c,en.isBoss);
      if (en.isBoss) { state.msg={text:"BOSS DOWN!",t:0.9}; triggerScreenShake(0.60,0.22,18); }
    }
    state.enemies=alive;
  }

  // ---------------- Aura ----------------

  function applyAuraBuffs() {
    for (const [,u] of state.units) { u.auraOn=false; u.auraRangeMul=1.0; u.auraCritChanceMul=1.0; }
    for (const [,sup] of state.units) {
      if (!sup||!sup.isSupport||sup.type!==UNIT_TYPES.RADAR) continue;
      const cells=Math.max(1,sup.auraProvideCells||1);
      const gs=state.board.gridSize||5;
      for (let dr=-cells; dr<=cells; dr++) {
        for (let dc=-cells; dc<=cells; dc++) {
          if (dr===0&&dc===0) continue;
          const rr=sup.r+dr, cc=sup.c+dc;
          if (rr<0||rr>=gs||cc<0||cc>=gs) continue;
          if (rr===2&&cc===2) continue;
          const k=cellKey(rr,cc); const tu=state.units.get(k);
          if (!tu||tu.isSupport) continue;
          tu.auraOn=true;
          tu.auraRangeMul=Math.max(tu.auraRangeMul||1.0,sup.auraProvideRangeMul||1.2);
          tu.auraCritChanceMul=Math.max(tu.auraCritChanceMul||1.0,sup.auraProvideCritChanceMul||1.2);
        }
      }
    }
  }

  function updateUnits(dt) {
    applyAuraBuffs();
    for (const [key, u] of state.units) {
      u.kick=Math.max(0,(u.kick||0)-dt*6); u.aimAngle=u.aimAngle??0;
      if (u.reloadT!=null&&u.reloadT>0) { u.reloadT=Math.max(0,u.reloadT-dt); if(u.reloadT<=0&&u.magSize>0) u.magAmmo=u.magSize; }
      if (u.overheatT!=null&&u.overheatT>0) { u.overheatT=Math.max(0,u.overheatT-dt); if(u.overheatT<=0) u.overheatShots=0; }
      if (u.isSupport) { u.aimAngle=(u.aimAngle+dt*0.9)%(Math.PI*2); continue; }
      const mods=stageModsForUnit(key,u);
      const def=UNIT_DEFS[u.type]||{};
      const effCooldown=Math.max(def.cooldownFloor??0.20, u.cooldown*mods.cdMul);
      u.cd-=dt;
      const rangeMul=u.auraOn?(u.auraRangeMul??1.0):1.0;
      const effRange=(u.range??0)*rangeMul;
      const r2=effRange*effRange;
      const inRange=r2>0?state.enemies.filter((en)=>dist2(en.x,en.y,u.x,u.y)<=r2):[];
      const shotCount=1+u.multiShots;
      const targetsForAim=inRange.length>0?smartTargetsForUnit(u,inRange,shotCount):[];
      if (targetsForAim.length>0) {
        const aim=targetsForAim[0]; const desired=Math.atan2(aim.y-u.y,aim.x-u.x);
        u.aimAngle=lerpAngle(u.aimAngle,desired,clamp(dt*14,0,1));
      }
      if (u.cd>0) continue;
      if (targetsForAim.length===0) { u.cd=0.05; continue; }
      if (u.reloadT>0) { u.cd=0.05; continue; }
      if (u.overheatT>0) { u.cd=0.05; continue; }
      if (u.magSize>0&&u.magAmmo<=0) { u.reloadT=u.reloadTime; u.cd=0.05; continue; }
      const targets=smartTargetsForUnit(u,inRange,shotCount);
      if (targets.length>0&&u.itemRarity===ITEM_RARITY.MYTHIC) triggerScreenShake(0.16,0.20,12);
      const critChanceMul=u.auraOn?(u.auraCritChanceMul??1.0):1.0;
      for (const en of targets) {
        const hit=calcDamage(u,en,{critAdd:mods.critAdd,dmgMul:mods.dmgMul,critChanceMul});
        addBeam(u.x,u.y,en.x,en.y,rarityColor(u.itemRarity));
        u.kick=Math.max(u.kick||0,0.18);
        dealDamage(key,u,en,hit.dmg,hit.isCrit,en.x,en.y,{ricochet:hit.ricochet});
        if (u.blastRadiusCells>0&&u.splashMul>0) applySplash(key,u,en.x,en.y,en.id,hit.rawDmg);
        if (u.ricochet>0) applyRicochet(key,u,en,hit.rawDmg,en.x,en.y);
      }
      if (u.magSize>0) { u.magAmmo=Math.max(0,(u.magAmmo||0)-1); if(u.magAmmo<=0){u.magAmmo=0;u.reloadT=u.reloadTime;} }
      if (u.overheatMax>0) { u.overheatShots=(u.overheatShots||0)+1; if(u.overheatShots>=u.overheatMax){u.overheatShots=0;u.overheatT=u.overheatCool;} }
      const burstMul=(u.magSize>0&&u.magAmmo>0)?(u.burstCdMul||1.0):1.0;
      u.cd=effCooldown*burstMul;
    }
    cleanupDeadEnemies();
  }

  function updateEnemies(dt) {
    const core=state.board.core;
    const P=rectPerimeter(state.board.path);
    for (const en of state.enemies) {
      for (const s of en.slows) s.t-=dt;
      en.slows=en.slows.filter((s)=>s.t>0);
      if (en.ricochetPopupCd!=null) en.ricochetPopupCd=Math.max(0,en.ricochetPopupCd-dt);
      let slowMul=1.0;
      if (en.slows.length>0) { slowMul=1.0; for (const s of en.slows) slowMul=Math.min(slowMul,s.factor); }
      const spd=en.speed*slowMul;
      if (en.pendingCoreHit) { en.hitFlash=Math.max(0,en.hitFlash-dt*6); continue; }
      if (!en.rushing) {
        en.dist+=spd*dt;
        if (en.dist>=P) { en.dist-=P; en.laps+=1; if(en.laps>=en.maxLaps) en.rushing=true; }
        const p=pointOnRect(state.board.path,en.dist);
        en.x=p.x; en.y=p.y;
      } else {
        const vx=core.x-en.x, vy=core.y-en.y;
        const len=Math.hypot(vx,vy)||1; const rs=spd*1.25;
        en.x+=(vx/len)*rs*dt; en.y+=(vy/len)*rs*dt;
        if (Math.hypot(core.x-en.x,core.y-en.y)<=core.r*1.15) {
          const mul=state.metaMods?.coreDmgMul??1;
          en.pendingCoreHit=true; en.pendingCoreDmg=Math.max(1,Math.round(en.coreDmg*mul));
          en.x=core.x-(vx/len)*core.r*0.95; en.y=core.y-(vy/len)*core.r*0.95;
        }
      }
      en.hitFlash=Math.max(0,en.hitFlash-dt*6);
    }
  }

  function processPendingCoreHits() {
    if (state.gameOver) return;
    let any=false;
    for (const en of state.enemies) {
      if (!en.pendingCoreHit) continue;
      en.pendingCoreHit=false; const cdmg=Math.max(1,Math.round(en.pendingCoreDmg??en.coreDmg??1)); en.pendingCoreDmg=0;
      if (en.hp<=0) continue;
      any=true; en.diedToCore=true; en.hp=0; state.coreHp-=cdmg;
      state.msg={text:`CORE -${cdmg}`,t:0.6};
      if (state.coreHp<=0) { state.coreHp=0; state.gameOver=true; openGameOver(); break; }
    }
    if (any) { if(state.coreHp<0) state.coreHp=0; syncTopUI(); cleanupDeadEnemies(); }
  }

  function updateWave(dt) {
    if (state.roundPhase!=="RUN"||!state.wave) return;
    const w=state.wave;
    w.elapsed+=dt;
    while (!w.doneSpawning && w.elapsed>=w.next) {
      if (w.page<w.pages) {
        // ✅ 웨이브 타입에 맞는 적 타입 선택
        const et = pickEnemyTypeForWave(w.waveType||WAVE_TYPE.NORMAL, w.stage, w.page, w.spawnedInPage);
        spawnEnemy(et, w.waveType);
        w.spawnedInPage++; w.totalSpawned++;
        if (w.spawnedInPage>=w.pageSize) {
          w.page++; w.spawnedInPage=0;
          if (w.page<w.pages) w.next=w.elapsed+w.pageGap;
          else { if(w.boss) w.next=w.elapsed+w.bossDelay; else w.doneSpawning=true; }
        } else { w.next=w.elapsed+w.spawnEvery; }
      } else {
        if (w.boss&&!w.bossSpawned) { spawnBoss(); w.bossSpawned=true; w.totalSpawned++; }
        w.doneSpawning=true;
      }
    }
    if (w.doneSpawning&&state.enemies.length===0) clearStage(w.stage);
  }

  function updateEffects(dt) {
    if (state.pathShiftAnim) { state.pathShiftAnim.t+=dt; if(state.pathShiftAnim.t>=state.pathShiftAnim.dur) state.pathShiftAnim=null; }
    for (const b of state.beams) b.t-=dt;
    state.beams=state.beams.filter((b)=>b.t>0);
    for (const r of state.rings) { r.t-=dt; r.r+=r.grow*dt; }
    state.rings=state.rings.filter((r)=>r.t>0);
    for (const p of state.puffs) { p.t-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=(p.fric??0.90); p.vy=p.vy*(p.fric??0.90)+(p.g??90)*dt; }
    state.puffs=state.puffs.filter((p)=>p.t>0);
    for (const f of state.floaters) { f.t-=dt; f.y+=f.vy*dt; f.vy+=90*dt; }
    state.floaters=state.floaters.filter((f)=>f.t>0);
    state.msg.t=Math.max(0,state.msg.t-dt);
    if (state.banner) state.banner.t=Math.max(0,(state.banner.t||0)-dt);
    if (state.screenShake) {
      const s=state.screenShake;
      if ((s.t||0)>0) {
        s.t=Math.max(0,(s.t||0)-dt);
        if (s.t<=0) { s.t=0; s.life=0; s.strength=0; s.maxOffset=12; }
      }
    }
    updateDpsMeterUI();
  }

  function update(dt) {
    if (state.gameOver) { updateEffects(dt); return; }
    if (state.uiPause||state.userPause) { updateEffects(dt); return; }
    updateDpsMeters(dt);
    if (state.roundPhase==="PREP") {
      state.prepTimer-=dt;
      if (state.prepTimer<=0) startStage(state.stage);
    }
    updateWave(dt); updateEnemies(dt); updateUnits(dt); processPendingCoreHits(); updateEffects(dt);
  }

  // ---------------- Render ----------------

  function setLogicalTransform() {
    const sx=canvas.width/logical.w, sy=canvas.height/logical.h;
    ctx.setTransform(sx,0,0,sy,0,0);
    const s=state.screenShake;
    if (s&&state.vfxEnabled&&(s.t||0)>0) {
      const p=clamp((s.t||0)/Math.max(0.0001,s.life||s.t),0,1);
      const amp=(p*p)*(s.strength||0)*(s.maxOffset||12);
      const now=perfNow()/1000;
      ctx.translate(Math.sin(now*47+(s.seed||0))*amp, Math.sin(now*53+(s.seed||0)*1.7)*amp);
    }
  }

  function drawBackground() {
    ctx.save();
    const g=ctx.createLinearGradient(0,0,0,logical.h);
    g.addColorStop(0,"rgba(255,255,255,0.04)"); g.addColorStop(1,"rgba(255,255,255,0.01)");
    ctx.fillStyle=g; ctx.fillRect(0,0,logical.w,logical.h);
    ctx.globalAlpha=0.12; ctx.strokeStyle="rgba(255,255,255,0.25)"; ctx.lineWidth=1;
    const step=30;
    for (let x=0; x<=logical.w; x+=step) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,logical.h); ctx.stroke(); }
    for (let y=0; y<=logical.h; y+=step) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(logical.w,y); ctx.stroke(); }
    ctx.restore();
  }

  function drawGrid() {
    const b=state.board;
    ctx.save(); ctx.lineWidth=2; ctx.strokeStyle="rgba(255,255,255,0.15)";
    roundRect(ctx,b.gridX-12,b.gridY-12,b.gridW+24,b.gridW+24,18); ctx.stroke(); ctx.restore();

    // ✅ 웨이브 타입 색상으로 그리드 테두리 하이라이트
    const wt = state.roundPhase==="PREP" ? state.nextWaveType : state.currentWaveType;
    const wtInfo = WAVE_TYPE_INFO[wt];
    const wtColor = (wtInfo && wt!==WAVE_TYPE.NORMAL) ? wtInfo.color : null;

    for (const cell of b.cells) {
      const isCore=cell.r===2&&cell.c===2;
      const key=cellKey(cell.r,cell.c);
      const hk=hotKindForKey(key);
      ctx.save();
      ctx.fillStyle=isCore?"rgba(255,107,107,0.08)":"rgba(255,255,255,0.05)";
      roundRect(ctx,cell.x,cell.y,cell.w,cell.h,14); ctx.fill();
      if (hk) {
        const pulse=0.55+0.45*Math.sin(perfNow()/220+(cell.r*7+cell.c));
        const a=0.10+0.08*pulse;
        ctx.fillStyle=hk==="ASPD"?`rgba(116,192,252,${a})`:`rgba(255,212,59,${a})`;
        roundRect(ctx,cell.x+2,cell.y+2,cell.w-4,cell.h-4,12); ctx.fill();
        ctx.lineWidth=2; ctx.strokeStyle=hk==="ASPD"?"rgba(116,192,252,0.35)":"rgba(255,212,59,0.35)"; ctx.stroke();
        ctx.save(); ctx.globalAlpha=0.88;
        ctx.fillStyle=hk==="ASPD"?"rgba(116,192,252,0.95)":"rgba(255,212,59,0.95)";
        ctx.font="900 11px ui-sans-serif, system-ui"; ctx.textAlign="left"; ctx.textBaseline="top";
        ctx.fillText("HOT",cell.x+8,cell.y+6);
        ctx.font="800 10px ui-sans-serif, system-ui";
        const ha=state.hotAspdBonus??HOTZONE_ASPD_BONUS_BASE, hc=state.hotCritBonus??HOTZONE_CRIT_BONUS_BASE;
        ctx.fillText(hk==="ASPD"?`공속+${Math.round(ha*100)}%`:`치명+${Math.round(hc*100)}%p`,cell.x+8,cell.y+20);
        ctx.restore();
      }
      ctx.strokeStyle="rgba(255,255,255,0.10)"; ctx.lineWidth=1; ctx.stroke();
      ctx.restore();
    }

    if (state.drag&&state.drag.active&&state.drag.hoverCell) {
      const hc=state.drag.hoverCell; const ok=!!state.drag.hoverValid;
      ctx.save(); ctx.lineWidth=3;
      ctx.strokeStyle=ok?"rgba(99,230,190,0.55)":"rgba(255,107,107,0.45)";
      ctx.fillStyle=ok?"rgba(99,230,190,0.10)":"rgba(255,107,107,0.08)";
      roundRect(ctx,hc.x+2,hc.y+2,hc.w-4,hc.h-4,12); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }

  function drawPath() {
    const base=state.board.path;
    let px=base.x, py=base.y;
    if (state.pathShiftAnim) {
      const t=clamp(state.pathShiftAnim.t/state.pathShiftAnim.dur,0,1);
      const ease=t*t*(3-2*t);
      px=lerp(state.pathShiftAnim.from.x,state.pathShiftAnim.to.x,ease);
      py=lerp(state.pathShiftAnim.from.y,state.pathShiftAnim.to.y,ease);
    }
    const p={x:px,y:py,w:base.w,h:base.h};

    // ✅ 웨이브 타입별 경로 색상
    const wt = state.roundPhase==="RUN" ? state.currentWaveType : state.nextWaveType;
    const wtInfo = WAVE_TYPE_INFO[wt];
    let pathColor = "rgba(0, 207, 255, 0.22)";
    let pathGlowColor = "rgba(0, 207, 255, 0.34)";
    if (wtInfo && wt !== WAVE_TYPE.NORMAL) {
      const hex = wtInfo.color;
      pathColor = `${hex}38`;
      pathGlowColor = `${hex}55`;
    }

    ctx.save();
    ctx.lineWidth=9; ctx.strokeStyle=pathColor; ctx.shadowColor=pathGlowColor; ctx.shadowBlur=12;
    roundRect(ctx,p.x,p.y,p.w,p.h,26); ctx.stroke();
    ctx.lineWidth=3; ctx.shadowBlur=0; ctx.strokeStyle="rgba(255,255,255,0.16)";
    roundRect(ctx,p.x,p.y,p.w,p.h,26); ctx.stroke(); ctx.restore();
  }

  function drawCore() {
    const c=state.board.core;
    ctx.save();
    const pulse=0.5+0.5*Math.sin(perfNow()/240);
    const glow=lerp(10,18,pulse);
    ctx.shadowColor="rgba(255, 107, 107, 0.65)"; ctx.shadowBlur=glow;
    const grad=ctx.createRadialGradient(c.x-c.r*0.3,c.y-c.r*0.3,c.r*0.2,c.x,c.y,c.r*1.2);
    grad.addColorStop(0,"rgba(255,255,255,0.95)"); grad.addColorStop(0.25,"rgba(255,107,107,0.95)"); grad.addColorStop(1,"rgba(255,107,107,0.22)");
    ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(c.x,c.y,c.r*1.25,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0; ctx.lineWidth=2; ctx.strokeStyle="rgba(255,255,255,0.22)"; ctx.beginPath(); ctx.arc(c.x,c.y,c.r*1.25,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle="rgba(255,255,255,0.92)"; ctx.font="700 18px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(String(state.coreHp),c.x,c.y+1); ctx.restore();
  }

  function drawUnits() {
    for (const [key, u] of state.units) drawUnit(u, key===state.selectedKey);
    if (state.drag&&state.drag.active&&state.drag.unit) drawUnitGhost(state.drag.unit,state.drag.x,state.drag.y);
  }

  function drawUnit(u, selected) {
    const col=rarityColor(u.itemRarity); const cell=state.board.cell; const platformR=cell*0.20;
    const key=cellKey(u.r,u.c); const hk=hotKindForKey(key); const hotMul=hotMulForKey(key);
    ctx.save(); ctx.translate(snap(u.x),snap(u.y));
    const kick=u.kick||0; const kickScale=1+kick*0.25;
    if (selected) {
      const auraRangeMul=u.auraOn?(u.auraRangeMul??1.0):1.0;
      const rangePx=(u.rangeCells||0)*state.board.pxPerCell*auraRangeMul;
      if (rangePx>4) {
        ctx.save(); ctx.globalAlpha=1; ctx.beginPath(); ctx.arc(0,0,rangePx,0,Math.PI*2);
        ctx.fillStyle="rgba(99, 230, 190, 0.12)"; ctx.fill();
        ctx.lineWidth=2; ctx.strokeStyle="rgba(99, 230, 190, 0.26)"; ctx.stroke(); ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0,0,platformR*2.6,0,Math.PI*2); ctx.strokeStyle="rgba(255,255,255,0.16)"; ctx.lineWidth=2; ctx.stroke();
    }
    if (kickScale!==1) ctx.scale(kickScale,kickScale);
    ctx.shadowColor=col; ctx.shadowBlur=selected?14:10;
    ctx.fillStyle="rgba(0,0,0,0.20)"; ctx.beginPath(); ctx.arc(0,platformR*0.25,platformR*1.26,0,Math.PI*2); ctx.fill();
    if (hk) {
      const pulse=0.55+0.45*Math.sin(perfNow()/210+(u.r*3+u.c));
      ctx.shadowBlur=0; ctx.globalAlpha=0.9;
      ctx.fillStyle=hk==="ASPD"?`rgba(116,192,252,${0.45+0.25*pulse})`:`rgba(255,212,59,${0.45+0.25*pulse})`;
      ctx.fillRect(-platformR*0.95,platformR*0.65,platformR*0.34,platformR*0.34);
      if (hotMul>1) { ctx.fillStyle="rgba(255,255,255,0.55)"; ctx.fillRect(-platformR*0.52,platformR*0.65,platformR*0.34,platformR*0.34); }
    }
    ctx.globalAlpha=1; ctx.shadowBlur=0; ctx.lineWidth=2; ctx.strokeStyle="rgba(255,255,255,0.22)";
    ctx.beginPath(); ctx.arc(0,platformR*0.25,platformR*1.26,0,Math.PI*2); ctx.stroke();
    if (u.auraOn) {
      ctx.save(); ctx.shadowColor="rgba(99,230,190,0.20)"; ctx.shadowBlur=12; ctx.globalAlpha=1;
      ctx.strokeStyle="rgba(99,230,190,0.32)"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(0,platformR*0.25,platformR*1.52,0,Math.PI*2); ctx.stroke(); ctx.restore();
    }
    drawTurret(u,col);
    const barW=cell*0.60, barH=5, bx=-barW/2, by=-cell*0.34;
    if (u.reloadT>0&&u.reloadTime>0) {
      const p=clamp(1-u.reloadT/u.reloadTime,0,1);
      ctx.save(); ctx.globalAlpha=0.95;
      ctx.fillStyle="rgba(0,0,0,0.55)"; roundRect(ctx,bx,by,barW,barH,2); ctx.fill();
      ctx.fillStyle="rgba(99,230,190,0.75)"; roundRect(ctx,bx,by,barW*p,barH,2); ctx.fill(); ctx.restore();
    } else if (u.overheatT>0&&u.overheatCool>0) {
      const p=clamp(1-u.overheatT/u.overheatCool,0,1);
      ctx.save(); ctx.globalAlpha=0.95;
      ctx.fillStyle="rgba(0,0,0,0.55)"; roundRect(ctx,bx,by,barW,barH,2); ctx.fill();
      ctx.fillStyle="rgba(255, 170, 120, 0.70)"; roundRect(ctx,bx,by,barW*p,barH,2); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }

  function drawUnitGhost(u,x,y) {
    const col=rarityColor(u.itemRarity); const cell=state.board.cell; const platformR=cell*0.20;
    ctx.save(); ctx.globalAlpha=0.55; ctx.translate(snap(x),snap(y));
    const rangePx=(u.rangeCells||0)*state.board.pxPerCell;
    if (rangePx>4) {
      ctx.beginPath(); ctx.arc(0,0,rangePx,0,Math.PI*2);
      ctx.fillStyle="rgba(99, 230, 190, 0.10)"; ctx.fill();
      ctx.lineWidth=2; ctx.strokeStyle="rgba(99, 230, 190, 0.22)"; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0,0,platformR*2.6,0,Math.PI*2); ctx.strokeStyle="rgba(255,255,255,0.22)"; ctx.lineWidth=2; ctx.stroke();
    ctx.shadowColor=col; ctx.shadowBlur=10; ctx.fillStyle="rgba(0,0,0,0.18)";
    ctx.beginPath(); ctx.arc(0,platformR*0.25,platformR*1.26,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0; ctx.lineWidth=2; ctx.strokeStyle="rgba(255,255,255,0.18)";
    ctx.beginPath(); ctx.arc(0,platformR*0.25,platformR*1.26,0,Math.PI*2); ctx.stroke();
    drawTurret(u,col); ctx.restore();
  }

  function drawTurret(u, accent) {
    const cell=state.board.cell;
    const gunmetal="rgba(26, 31, 38, 0.92)", gunmetal2="rgba(18, 22, 28, 0.92)";
    const olive="rgba(56, 72, 56, 0.90)", olive2="rgba(44, 58, 44, 0.90)";
    const outline="rgba(255,255,255,0.16)";
    const baseR=cell*0.34, plateR=cell*0.24;
    const led=(() => {
      switch (u.type) {
        case UNIT_TYPES.FROST: case UNIT_TYPES.TESLA: case UNIT_TYPES.SNIPER: return "rgba(99, 230, 190, 0.92)";
        case UNIT_TYPES.BARRAGE: case UNIT_TYPES.CANNON: case UNIT_TYPES.MORTAR: case UNIT_TYPES.GIANTSLAYER: return "rgba(255, 160, 66, 0.92)";
        case UNIT_TYPES.SHOTGUN: case UNIT_TYPES.BERSERKER: return "rgba(255, 107, 107, 0.92)";
        default: return "rgba(116, 192, 252, 0.90)";
      }
    })();
    function hexPath(r,rot=0){ctx.beginPath();for(let i=0;i<6;i++){const a=rot+Math.PI/6+i*(Math.PI/3);const x=Math.cos(a)*r,y=Math.sin(a)*r;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.closePath();}
    ctx.save(); ctx.translate(0,-cell*0.05);
    ctx.fillStyle="rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.ellipse(0,baseR*0.62,baseR*1.05,baseR*0.62,0,0,Math.PI*2); ctx.fill();
    hexPath(baseR); ctx.fillStyle=gunmetal; ctx.strokeStyle=outline; ctx.lineWidth=2; ctx.fill(); ctx.stroke();
    ctx.fillStyle=gunmetal2;
    roundRect(ctx,-baseR*1.05,-baseR*0.38,baseR*0.38,baseR*0.96,baseR*0.16); ctx.fill();
    roundRect(ctx,baseR*0.67,-baseR*0.38,baseR*0.38,baseR*0.96,baseR*0.16); ctx.fill();
    hexPath(plateR); ctx.fillStyle=olive; ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,0.08)"; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(-plateR*0.65,0); ctx.lineTo(plateR*0.65,0); ctx.moveTo(0,-plateR*0.65); ctx.lineTo(0,plateR*0.65); ctx.stroke();
    ctx.fillStyle=olive2; ctx.beginPath(); ctx.arc(0,0,plateR*0.58,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,0.14)"; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle="rgba(255,255,255,0.10)";
    for (let i=0;i<6;i++){const a=Math.PI/6+i*(Math.PI/3);const bx=Math.cos(a)*plateR*0.95,by=Math.sin(a)*plateR*0.95;ctx.beginPath();ctx.arc(bx,by,1.4,0,Math.PI*2);ctx.fill();}
    ctx.save(); ctx.rotate(u.aimAngle||0);
    const headR=plateR*0.54;
    ctx.fillStyle=gunmetal2; ctx.beginPath(); ctx.arc(0,0,headR,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,0.14)"; ctx.lineWidth=1.5; ctx.stroke();
    ctx.save(); ctx.globalAlpha=0.22; ctx.strokeStyle=accent; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,headR*1.05,0,Math.PI*2); ctx.stroke(); ctx.restore();
    function barrelCore(len,w){
      ctx.fillStyle=gunmetal; roundRect(ctx,headR*0.10,-w*0.60,headR*0.55,w*1.20,w*0.35); ctx.fill();
      ctx.fillStyle=gunmetal2; ctx.beginPath(); ctx.moveTo(headR*0.55,-w*0.50); ctx.lineTo(headR*0.55+len*0.86,-w*0.50); ctx.lineTo(headR*0.55+len,0); ctx.lineTo(headR*0.55+len*0.86,w*0.50); ctx.lineTo(headR*0.55,w*0.50); ctx.closePath(); ctx.fill();
      ctx.strokeStyle="rgba(255,255,255,0.10)"; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(headR*0.65,-w*0.28); ctx.lineTo(headR*0.55+len*0.82,-w*0.28); ctx.stroke();
      ctx.save(); ctx.shadowColor=accent; ctx.shadowBlur=7; ctx.fillStyle=accent; ctx.beginPath(); ctx.arc(headR*0.55+len*0.90,0,w*0.26,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    switch (u.type) {
      case UNIT_TYPES.SNIPER: barrelCore(cell*0.60,cell*0.07); ctx.fillStyle=olive2; roundRect(ctx,headR*0.45,-cell*0.17,cell*0.24,cell*0.10,cell*0.04); ctx.fill(); break;
      case UNIT_TYPES.GATLING: for(let i=-1;i<=1;i++){ctx.save();ctx.translate(0,i*cell*0.07*1.05);barrelCore(cell*0.36,cell*0.07);ctx.restore();} break;
      case UNIT_TYPES.SHOTGUN: ctx.save();ctx.translate(0,-cell*0.10*0.42);barrelCore(cell*0.30,cell*0.10*0.75);ctx.restore();ctx.save();ctx.translate(0,cell*0.10*0.42);barrelCore(cell*0.30,cell*0.10*0.75);ctx.restore(); break;
      case UNIT_TYPES.MORTAR: barrelCore(cell*0.28,cell*0.14); ctx.save();ctx.globalAlpha=0.35;ctx.fillStyle="rgba(0,0,0,0.55)";ctx.beginPath();ctx.arc(headR*0.55+cell*0.28*0.86,0,cell*0.14*0.38,0,Math.PI*2);ctx.fill();ctx.restore(); break;
      case UNIT_TYPES.TESLA: barrelCore(cell*0.26,cell*0.10); ctx.strokeStyle=led;ctx.lineWidth=2;ctx.globalAlpha=0.55;ctx.beginPath();ctx.moveTo(headR*0.55+cell*0.26*0.62,-cell*0.10*0.55);ctx.lineTo(headR*0.55+cell*0.26*0.86,-cell*0.10*0.95);ctx.moveTo(headR*0.55+cell*0.26*0.62,cell*0.10*0.55);ctx.lineTo(headR*0.55+cell*0.26*0.86,cell*0.10*0.95);ctx.stroke();ctx.globalAlpha=1; break;
      case UNIT_TYPES.FROST: barrelCore(cell*0.34,cell*0.10); ctx.strokeStyle="rgba(99,230,190,0.40)";ctx.lineWidth=1.5;ctx.beginPath();for(let i=-2;i<=2;i++){ctx.moveTo(headR*0.55+cell*0.34*0.25,i*cell*0.10*0.22);ctx.lineTo(headR*0.55+cell*0.34*0.58,i*cell*0.10*0.22);}ctx.stroke(); break;
      case UNIT_TYPES.RADAR:
        ctx.fillStyle=gunmetal2; ctx.beginPath(); ctx.arc(headR*0.55,0,headR*0.42,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle="rgba(255,255,255,0.14)"; ctx.lineWidth=1.4; ctx.beginPath(); ctx.arc(headR*0.55,0,headR*0.42,0,Math.PI*2); ctx.stroke();
        ctx.strokeStyle="rgba(255,255,255,0.10)"; ctx.lineWidth=1.0;
        for (let a=-0.85;a<=0.85;a+=0.42){ctx.beginPath();ctx.moveTo(headR*0.55-headR*0.34,a*headR*0.32);ctx.lineTo(headR*0.55+headR*0.34,a*headR*0.32);ctx.stroke();}
        ctx.strokeStyle="rgba(255,255,255,0.18)";ctx.lineWidth=2.0;ctx.beginPath();ctx.moveTo(-headR*0.10,-headR*0.40);ctx.lineTo(-headR*0.10,-headR*0.60);ctx.stroke();
        ctx.save();ctx.shadowColor=accent;ctx.shadowBlur=8;ctx.fillStyle=accent;ctx.beginPath();ctx.arc(-headR*0.10,-headR*0.62,2.4,0,Math.PI*2);ctx.fill();ctx.restore();
        break;
      default: barrelCore(cell*0.42,cell*0.10); break;
    }
    ctx.restore(); ctx.restore();
  }

  function drawEnemies() { for (const en of state.enemies) drawEnemy(en); }

  function drawEnemy(en) {
    const flash=en.hitFlash; const isElite=en.type===ENEMY_TYPES.ELITE; const isBoss=en.isBoss;
    const px=Math.max(2,Math.round(en.radius/3));
    const pattern = isBoss
      ? ["0011100","0111110","1111111","1111111","0111110","0011100","0001000"]
      : isElite ? ["10001","11111","11111","01110","00100"]
      : ["0110","1111","1111","0110"];
    const w=pattern[0].length, h=pattern.length;
    const ox=-Math.floor(w/2)*px, oy=-Math.floor(h/2)*px;
    ctx.save(); ctx.translate(snap(en.x),snap(en.y));
    ctx.shadowColor=en.color; ctx.shadowBlur=isBoss?10:7;
    ctx.fillStyle=en.color;
    for (let y=0;y<h;y++) for(let x=0;x<w;x++) if(pattern[y][x]==="1") ctx.fillRect(ox+x*px,oy+y*px,px,px);
    ctx.shadowBlur=0; ctx.fillStyle="rgba(0,0,0,0.35)";
    if (!isBoss) { ctx.fillRect(-px*1.2,-px*0.6,px,px); ctx.fillRect(px*0.2,-px*0.6,px,px); }
    else { ctx.fillRect(-px*1.6,-px*0.6,px,px); ctx.fillRect(px*0.6,-px*0.6,px,px); }
    if (isBoss) { ctx.fillStyle="rgba(255,212,59,0.95)"; ctx.fillRect(-px*2.0,-px*3.3,px,px); ctx.fillRect(0,-px*3.6,px,px); ctx.fillRect(px*2.0,-px*3.3,px,px); }
    if (flash>0&&state.vfxEnabled) {
      ctx.globalAlpha=clamp(flash*1.2,0,0.32)*VFX_INTENSITY_BASE; ctx.fillStyle="rgba(255,255,255,0.85)";
      for (let y=0;y<h;y++) for(let x=0;x<w;x++) if(pattern[y][x]==="1") ctx.fillRect(ox+x*px,oy+y*px,px,px);
      ctx.globalAlpha=1;
    }
    ctx.restore();
    drawEnemyHp(en);
  }

  function drawEnemyHp(en) {
    const w=en.isBoss?64:42; const h=6;
    const x=en.x-w/2; const y=en.y-en.radius-14;
    ctx.save();
    ctx.fillStyle="rgba(0,0,0,0.35)"; roundRect(ctx,x,y,w,h,6); ctx.fill();
    const t=clamp(en.hp/en.maxHp,0,1);
    ctx.fillStyle=en.isBoss?"rgba(177,151,252,0.95)":"rgba(255,255,255,0.85)";
    roundRect(ctx,x,y,w*t,h,6); ctx.fill();
    ctx.restore();
  }

  function drawEffects() {
    const vfx=state.vfxEnabled?VFX_INTENSITY_BASE:0;
    if (vfx>0) {
      for (const b of state.beams) {
        const a=clamp(b.t/0.10,0,1);
        ctx.save(); ctx.globalAlpha=a*vfx; ctx.strokeStyle=b.color; ctx.lineWidth=2;
        ctx.shadowColor=b.color; ctx.shadowBlur=10*vfx;
        ctx.beginPath(); ctx.moveTo(b.x1,b.y1); ctx.lineTo(b.x2,b.y2); ctx.stroke(); ctx.restore();
      }
      for (const r of state.rings) {
        const a=clamp(r.t/(r.crit?0.42:0.30),0,1);
        ctx.save(); ctx.globalAlpha=a*vfx; ctx.strokeStyle=r.color; ctx.lineWidth=r.crit?3:2;
        ctx.shadowColor=r.color; ctx.shadowBlur=(r.crit?16:10)*vfx;
        ctx.beginPath(); ctx.arc(r.x,r.y,r.r,0,Math.PI*2); ctx.stroke(); ctx.restore();
      }
      for (const p of state.puffs) {
        const a=clamp(p.t/(p.life||0.65),0,1);
        ctx.save(); ctx.globalAlpha=a*a*0.85*vfx; ctx.fillStyle=p.color;
        ctx.shadowColor=p.color; ctx.shadowBlur=6*vfx;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); ctx.restore();
      }
    }
    const nowS=perfNow()/1000;
    for (const f of state.floaters) {
      const life=f.life||0.85; const a=clamp(f.t/life,0,1); const p=clamp((life-f.t)/life,0,1);
      const popDur=0.12; const popT=clamp((life-f.t)/popDur,0,1); const popScale=1+(1-popT)*(f.crit?0.55:0.25);
      let dx=0,dy=0;
      if (f.shake) { const j=(1-p)*3.0; dx=Math.sin(nowS*45+(f.seed||0))*j; dy=Math.cos(nowS*38+(f.seed||0)*1.7)*j; }
      ctx.save(); ctx.globalAlpha=a*DMG_FLOATERS_INTENSITY; ctx.translate(f.x+dx,f.y+dy); ctx.scale(popScale,popScale);
      ctx.font=`${f.crit?900:800} ${f.size}px ui-sans-serif, system-ui`; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.lineWidth=f.crit?3:2; ctx.strokeStyle="rgba(0,0,0,0.55)"; ctx.strokeText(f.text,0,0);
      ctx.fillStyle=f.color; ctx.shadowColor="rgba(0,0,0,0.55)"; ctx.shadowBlur=(f.crit?12:8)*DMG_FLOATERS_INTENSITY; ctx.fillText(f.text,0,0); ctx.restore();
    }
  }

  function drawHUD() {
    ctx.save();
    const wt = state.roundPhase==="RUN" ? state.currentWaveType : state.nextWaveType;
    const wtInfo = WAVE_TYPE_INFO[wt];

    ctx.fillStyle="rgba(255,255,255,0.80)"; ctx.font="700 14px ui-sans-serif, system-ui";
    ctx.textAlign="left"; ctx.textBaseline="top";
    const y0=14, x0=14;
    let hotA=0, hotC=0;
    for (const v of state.hotZones.values()) { if(v==="ASPD") hotA++; else if(v==="CRIT") hotC++; }
    const shiftText=`SHIFT ${dirArrow(state.shiftDir)}`;
    const ha=state.hotAspdBonus??HOTZONE_ASPD_BONUS_BASE, hc=state.hotCritBonus??HOTZONE_CRIT_BONUS_BASE;
    const hotText=`HOT: 공속+${Math.round(ha*100)}%(${hotA}) / 치명+${Math.round(hc*100)}%p(${hotC})`;

    // ✅ 웨이브 타입 라벨 HUD에 표시
    const waveLabel = (wt!==WAVE_TYPE.NORMAL&&wtInfo) ? ` ·  ${getWaveTypeIcon(wt)} ${wtInfo.name}` : "";

    if (state.gameOver) {
      ctx.fillText(`GAME OVER  (Stage ${state.stage})`,x0,y0);
    } else if (state.roundPhase==="PREP") {
      ctx.fillText(`준비 중... ${Math.ceil(state.prepTimer)}s`,x0,y0);
      ctx.fillText(`다음: ${isBossRound(state.stage)?"보스전":"일반 라운드"}${waveLabel}`,x0,y0+18);
      ctx.fillText(`${shiftText} · ${hotText}`,x0,y0+36);
    } else if (state.wave) {
      const ww=state.wave;
      const pageText=ww.page<ww.pages?`${ww.page+1}/${ww.pages}`:`${ww.pages}/${ww.pages}`;
      if (wt!==WAVE_TYPE.NORMAL&&wtInfo) {
        ctx.fillStyle=wtInfo.color;
        ctx.fillText(`${getWaveTypeIcon(wt)} ${wtInfo.name} Wave (${pageText})  Alive ${state.enemies.length}`,x0,y0);
        ctx.fillStyle="rgba(255,255,255,0.80)";
      } else {
        ctx.fillText(`Wave: ${pageText}  (Alive ${state.enemies.length})`,x0,y0);
      }
      if (ww.boss) ctx.fillText(`BOSS: ${ww.bossSpawned?"등장":"대기"}`,x0,y0+18);
      ctx.fillText(`${shiftText} · ${hotText}`,x0,y0+(ww.boss?36:18));
    }

    if (!state.gameOver&&state.selectedKey) {
      const streak=state.rerollStreak.key===state.selectedKey?state.rerollStreak.count:0;
      const hk=hotKindForKey(state.selectedKey); const y=logical.h-44;
      ctx.save(); ctx.font="800 14px ui-sans-serif, system-ui"; ctx.textAlign="left"; ctx.textBaseline="top"; ctx.fillStyle="rgba(255,255,255,0.80)";
      const s=(streak>=REROLL_STREAK_NEED)?"SPECIAL READY":(streak>=1?`REROLL ${streak}/${REROLL_STREAK_NEED} (BONUS)`:`REROLL ${streak}/${REROLL_STREAK_NEED}`);
      if (hk) ctx.fillText(`선택: HOT(${hk==="ASPD"?`공속+${Math.round(ha*100)}%`:`치명+${Math.round(hc*100)}%p`}) · ${s}`,x0,y);
      else ctx.fillText(`선택: ${s}`,x0,y);
      ctx.restore();
    }

    if (state.msg.t>0) {
      const a=clamp(state.msg.t/1.2,0,1);
      ctx.globalAlpha=a; ctx.font="900 34px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillStyle="rgba(255,255,255,0.90)"; ctx.shadowColor="rgba(0,0,0,0.55)"; ctx.shadowBlur=18;
      ctx.fillText(state.msg.text,logical.w/2,60);
    }

    if (!state.gameOver&&state.userPause) {
      ctx.save(); ctx.globalAlpha=0.92; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.shadowColor="rgba(0,0,0,0.65)"; ctx.shadowBlur=18;
      ctx.font="950 42px ui-sans-serif, system-ui"; ctx.fillStyle="rgba(255,255,255,0.86)"; ctx.fillText("PAUSED",logical.w/2,logical.h/2);
      ctx.shadowBlur=0; ctx.font="700 14px ui-sans-serif, system-ui"; ctx.fillStyle="rgba(255,255,255,0.70)"; ctx.fillText("⏸ 버튼으로 재개",logical.w/2,logical.h/2+36);
      ctx.restore();
    }

    ctx.restore();
  }

  function render() {
    resizeCanvasToDisplay(); setLogicalTransform();
    ctx.clearRect(0,0,logical.w,logical.h);
    drawBackground(); drawGrid(); drawPath(); drawCore(); drawUnits(); drawEnemies(); drawEffects(); drawHUD();
  }

  // ---------------- Help ----------------

  function buildHelpHTML() {
    const rarities=[ITEM_RARITY.NORMAL,ITEM_RARITY.MAGIC,ITEM_RARITY.RARE,ITEM_RARITY.LEGENDARY,ITEM_RARITY.UNIQUE,ITEM_RARITY.MYTHIC];
    const towerList=Object.entries(UNIT_DEFS).map(([type,def])=>`<li><b>${safeText(def.name)}</b> - ${safeText(def.desc)}</li>`).join("");
    const optionList=Object.values(OPTION_KIND).map((k)=>`<li><b>${safeText(optionKindName(k))}</b> - ${safeText(optionDescription(k))}</li>`).join("");
    const waveTypeList=Object.values(WAVE_TYPE).filter(t=>t!==WAVE_TYPE.NORMAL).map((t)=>{
      const info=WAVE_TYPE_INFO[t]; return `<li><b style="color:${info.color}">${getWaveTypeIcon(t)} ${info.name}</b>: ${info.desc}</li>`;
    }).join("");
    return `
      <h3>게임 하는 법</h3>
      <ul>
        <li><b>빈 칸 클릭</b> → 타워 뽑기 (일반 티켓)</li>
        <li><b>타워 클릭</b> → 개조/각성/리롤/전설리롤</li>
        <li><b>매 스테이지 PREP</b>: 레일이 1칸 SHIFT됩니다.</li>
        <li><b>HOT ZONE</b>: 파랑=공속, 골드=치명 (이번 스테이지)</li>
        <li><b>같은 타워 연속 리롤</b> → ${REROLL_STREAK_NEED}회 후 SPECIAL PICK!</li>
        <li><b>10라운드마다 보스전</b> - 전설 티켓 획득</li>
      </ul>
      <hr />
      <h3>🌊 웨이브 타입 (5라운드 이후 등장)</h3>
      <ul>${waveTypeList}</ul>
      <hr />
      <h3>티켓</h3>
      <ul>
        <li><b class="r-normal">일반</b>: 타워 뽑기/리롤</li>
        <li><b class="r-magic">레어</b>: 개조 (옵션 재추첨)</li>
        <li><b class="r-legend">전설</b>: 각성 (등급 상승) / 전설리롤</li>
      </ul>
      <hr />
      <h3>타워 ${Object.keys(UNIT_DEFS).length}종</h3><ul>${towerList}</ul>
      <hr />
      <h3>옵션</h3><ul>${optionList}</ul>
    `;
  }

  // ---------------- Input ----------------

  function canvasToLogical(ev) {
    const rect=canvas.getBoundingClientRect();
    return { x:((ev.clientX-rect.left)/rect.width)*logical.w, y:((ev.clientY-rect.top)/rect.height)*logical.h };
  }

  function getCellByKey(key) { return state.board.cells.find((cc)=>cellKey(cc.r,cc.c)===key)||null; }

  function updateDragHover(lx,ly) {
    if (!state.drag||!state.drag.active||!state.drag.unit) return;
    const cell=getCellAt(state.board,lx,ly);
    if (!cell||(cell.r===2&&cell.c===2)) { state.drag.hoverCell=null; state.drag.hoverValid=false; return; }
    const k=cellKey(cell.r,cell.c); const occupied=state.units.get(k);
    let ok=!occupied||(occupied.type===state.drag.unit.type&&occupied.itemRarity===state.drag.unit.itemRarity&&occupied.itemRarity!==ITEM_RARITY.MYTHIC);
    state.drag.hoverCell=cell; state.drag.hoverValid=ok;
  }

  function cancelDrag() {
    const d=state.drag; if (!d||!d.active||!d.unit) return;
    const backCell=d.fromCell||getCellByKey(d.fromKey);
    if (backCell) { d.unit.r=backCell.r;d.unit.c=backCell.c;d.unit.x=backCell.x+backCell.w/2;d.unit.y=backCell.y+backCell.h/2; }
    if (d.fromKey) state.units.set(d.fromKey,d.unit);
    state.selectedKey=d.fromKey;
    state.drag={active:false,unit:null,fromKey:null,fromCell:null,x:0,y:0,hoverCell:null,hoverValid:false};
  }

  function finishDrag(lx,ly) {
    const d=state.drag; if (!d||!d.active||!d.unit) return;
    const cell=getCellAt(state.board,lx,ly);
    if (!cell||(cell.r===2&&cell.c===2)) { cancelDrag(); return; }
    const dropKey=cellKey(cell.r,cell.c); const target=state.units.get(dropKey);
    if (!target) {
      d.unit.r=cell.r;d.unit.c=cell.c;d.unit.x=cell.x+cell.w/2;d.unit.y=cell.y+cell.h/2;
      state.units.set(dropKey,d.unit); state.selectedKey=dropKey;
      state.drag={active:false,unit:null,fromKey:null,fromCell:null,x:0,y:0,hoverCell:null,hoverValid:false}; return;
    }
    const canMerge=target.type===d.unit.type&&target.itemRarity===d.unit.itemRarity;
    if (canMerge) {
      if (target.itemRarity===ITEM_RARITY.MYTHIC) { state.msg={text:"신화는 합성 불가",t:0.9}; cancelDrag(); return; }
      const nr=nextRarity(target.itemRarity); const optCap=applyRarityBoost(nr,optionBoostForUnit(target));
      const opts=rollOptions(target.type,optCap); rebuildUnitAtKey(dropKey,target.type,nr,opts);
      const u2=state.units.get(dropKey);
      if (u2) { addFloater(u2.x,u2.y-22,"MERGE!","rgba(99,230,190,0.95)",true); addHitRing(u2.x,u2.y,"rgba(99,230,190,0.55)",true); }
      triggerScreenShake(0.28,0.20,14); state.msg={text:`합성! → ${rarityName(nr)}`,t:0.9}; state.selectedKey=dropKey;
      state.drag={active:false,unit:null,fromKey:null,fromCell:null,x:0,y:0,hoverCell:null,hoverValid:false};
      syncTopUI(); buildTooltip(state.units.get(dropKey)); return;
    }
    state.msg={text:"같은 타입/등급만 합성 가능",t:0.9}; cancelDrag();
  }

  canvas.addEventListener("pointerdown",(ev)=>{
    if (!helpOverlay.classList.contains("hidden")) return;
    if (isSpecialOpen()) return;
    const {x,y}=canvasToLogical(ev); const cell=getCellAt(state.board,x,y);
    if (!cell) { hideMenus(); return; }
    if (cell.r===2&&cell.c===2) { hideMenus(); return; }
    const key=cellKey(cell.r,cell.c);
    if (state.units.has(key)) {
      state.selectedKey=key; buyMenu.classList.add("hidden"); tooltip.classList.add("hidden"); state.buyCell=null;
      state.dragCandidate={pointerId:ev.pointerId,key,startX:x,startY:y,t0:perfNow()};
      try{canvas.setPointerCapture(ev.pointerId);}catch(e){} return;
    }
    state.dragCandidate=null; showBuyMenu(ev.clientX,ev.clientY,cell);
  });

  canvas.addEventListener("pointermove",(ev)=>{
    if (state.drag&&state.drag.active) { const {x,y}=canvasToLogical(ev); state.drag.x=x;state.drag.y=y; updateDragHover(x,y); return; }
    const dc=state.dragCandidate; if (!dc||dc.pointerId!==ev.pointerId) return;
    const {x,y}=canvasToLogical(ev); const dx=x-dc.startX,dy=y-dc.startY;
    const dist=Math.hypot(dx,dy); const held=(perfNow()-dc.t0)/1000;
    if (dist>8||held>0.12) {
      const u=state.units.get(dc.key); if (!u){state.dragCandidate=null;return;}
      const fromCell=getCellByKey(dc.key); state.units.delete(dc.key);
      state.drag={active:true,unit:u,fromKey:dc.key,fromCell,x,y,hoverCell:null,hoverValid:false};
      state.dragCandidate=null; state.selectedKey=null; hideMenus(); updateDragHover(x,y);
    }
  });

  canvas.addEventListener("pointerup",(ev)=>{
    if (state.drag&&state.drag.active) { const {x,y}=canvasToLogical(ev); finishDrag(x,y); try{canvas.releasePointerCapture(ev.pointerId);}catch(e){} return; }
    const dc=state.dragCandidate; if (!dc||dc.pointerId!==ev.pointerId) return;
    const key=dc.key; if (state.units.has(key)) showTooltip(ev.clientX,ev.clientY,key);
    state.dragCandidate=null; try{canvas.releasePointerCapture(ev.pointerId);}catch(e){};
  });

  canvas.addEventListener("pointercancel",(ev)=>{ if(state.drag&&state.drag.active) cancelDrag(); state.dragCandidate=null; try{canvas.releasePointerCapture(ev.pointerId);}catch(e){}; });

  document.addEventListener("pointerdown",(ev)=>{
    const t=ev.target;
    const inMenu=buyMenu.contains(t)||tooltip.contains(t)||t===canvas||helpOverlay.contains(t)||(specialOverlay&&specialOverlay.contains(t))||(gameoverOverlay&&gameoverOverlay.contains(t))||(skillOverlay&&skillOverlay.contains(t))||(shopPanel&&shopPanel.contains(t));
    if (!inMenu) { buyMenu.classList.add("hidden");tooltip.classList.add("hidden");state.buyCell=null;state.selectedKey=null; }
  });

  buyDrawBtn.addEventListener("click",()=>{ if(!state.buyCell) return; drawUnitAtCell(state.buyCell); buyMenu.classList.add("hidden"); state.buyCell=null; });
  buyCancelBtn.addEventListener("click",()=>{ buyMenu.classList.add("hidden"); state.buyCell=null; });
  modBtn.addEventListener("click",()=>modSelectedUnit());
  awakenBtn.addEventListener("click",()=>awakenSelectedUnit());
  rerollBtn.addEventListener("click",()=>rerollSelectedUnit());
  legendRerollBtn.addEventListener("click",()=>legendRerollSelectedUnit());
  helpBtn.addEventListener("click",()=>openHelp());
  helpClose.addEventListener("click",()=>closeHelp());
  helpOverlay.addEventListener("pointerdown",(ev)=>{ if(ev.target===helpOverlay) closeHelp(); });

  if (shopPanel) shopPanel.addEventListener("click",(ev)=>{ const btn=ev.target.closest("button[data-shopid]"); if(!btn) return; handleShopPurchase(btn.dataset.shopid,btn.dataset.cur); if(state.selectedKey&&state.units.has(state.selectedKey)) buildTooltip(state.units.get(state.selectedKey)); });

  if (skillBtn) skillBtn.addEventListener("click",()=>openSkillTree());
  if (xpBadge) xpBadge.addEventListener("click",()=>openSkillTree());
  if (gameoverSkillBtn) gameoverSkillBtn.addEventListener("click",()=>openSkillTree());
  if (skillCloseBtn) skillCloseBtn.addEventListener("click",()=>closeSkillTree());
  if (skillOverlay) skillOverlay.addEventListener("pointerdown",(ev)=>{ if(ev.target===skillOverlay) closeSkillTree(); });
  window.addEventListener("resize",()=>{ if(skillOverlay&&!skillOverlay.classList.contains("hidden")) requestAnimationFrame(drawSkillLines); });

  speedBtn.addEventListener("click",()=>{ const speeds=[1,2,4,8]; const idx=speeds.indexOf(state.timeScale); state.timeScale=speeds[(idx>=0?idx+1:1)%speeds.length]; syncTopUI(); });

  if (vfxBtn) vfxBtn.addEventListener("click",()=>{ state.vfxEnabled=!state.vfxEnabled; saveBoolLS(LS_KEY_VFX,!!state.vfxEnabled); if(!state.vfxEnabled){state.beams.length=0;state.rings.length=0;state.puffs.length=0;} syncTopUI(); });

  if (pauseBtn) pauseBtn.addEventListener("click",()=>{ if(state.gameOver) return; state.userPause=!state.userPause; syncTopUI(); });

  if (restartBtn) restartBtn.addEventListener("click",()=>window.location.reload());

  applyShiftForUpcomingStage();
  syncTopUI();

  let last=performance.now();

  function frame(now) {
    const rawDt=Math.min(0.12,(now-last)/1000);
    last=now;
    let dt=rawDt*state.timeScale;
    const maxStep=0.02;
    while (dt>0) { const step=Math.min(maxStep,dt); update(step); dt-=step; }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function roundRect(ctx2,x,y,w,h,r) {
    const rr=Math.min(r,w/2,h/2);
    ctx2.beginPath(); ctx2.moveTo(x+rr,y); ctx2.arcTo(x+w,y,x+w,y+h,rr); ctx2.arcTo(x+w,y+h,x,y+h,rr); ctx2.arcTo(x,y+h,x,y,rr); ctx2.arcTo(x,y,x+w,y,rr); ctx2.closePath();
  }

  function perfNow() { return performance.now(); }
}
