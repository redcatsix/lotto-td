// engine.js
// Lotto TD - round-based auto play
// ✅ 웨이브 타입 시스템: 매 스테이지 다양한 적 조합/특수 웨이브

import { createEconomyState } from "../systems/economy.js";
import { ENEMY_TYPES, WAVE_TYPE, WAVE_TYPE_INFO, rollWaveType, makeEnemy, pickEnemyTypeForWave } from "../entities/enemies.js";
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
} from "../entities/units.js";

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
} from "../systems/skills.js";

import { clamp, lerp, dist2, distToRectPerimeter, rollItemRarityBestOf, rollOptionsBestOf } from "./combat.js";
import { hideContextMenus, cycleSpeed, togglePause, toggleVfx, buildKeyboardShortcutHelpHTML } from "../ui/hud.js";
import { buildShopItems } from "../systems/shop.js";

// --------------------
// Helpers
// --------------------

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

const VFX_INTENSITY_BASE = 0.55;   // 0.30 → 0.55 (VFX 전반 강화)
const DMG_FLOATERS_INTENSITY = 0.80; // 0.60 → 0.80 (데미지 숫자 더 선명하게)
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
    bgParticles: [],
    beams: [],
    rings: [],
    puffs: [],
    slashes: [],   // 타격 순간 ×자 임팩트 마크
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

  // 배경 파티클 초기화
  (function initBgParticles() {
    const count = 55;
    for (let i = 0; i < count; i++) {
      state.bgParticles.push({
        x: Math.random() * logical.w,
        y: Math.random() * logical.h,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.5) * 14,
        r: 0.8 + Math.random() * 1.6,
        a: 0.10 + Math.random() * 0.22,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.5 + Math.random() * 1.2,
        color: Math.random() < 0.55 ? "#74c0fc" : Math.random() < 0.5 ? "#b197fc" : "#63e6be",
      });
    }
  })();

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

  const elCoreHpBar = document.getElementById("core-hp-bar");

  function syncTopUI() {
    elStage.textContent = String(state.stage);
    elCore.textContent = String(state.coreHp);
    elTCommon.textContent = String(state.econ.tickets.common);
    elTRare.textContent = String(state.econ.tickets.rare);
    elTLegend.textContent = String(state.econ.tickets.legend);
    if (elShopCommon) elShopCommon.textContent = String(state.econ.tickets.common);
    if (elShopRare) elShopRare.textContent = String(state.econ.tickets.rare);
    if (elShopLegend) elShopLegend.textContent = String(state.econ.tickets.legend);
    // ✅ 코어 HP 바 업데이트
    if (elCoreHpBar) {
      const pct = clamp(state.coreHp / (state.coreHpMax || 20), 0, 1);
      elCoreHpBar.style.width = `${Math.round(pct * 100)}%`;
      elCoreHpBar.classList.toggle("danger", pct < 0.30);
      elCoreHpBar.classList.toggle("warning", pct >= 0.30 && pct < 0.60);
    }
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
    const { commonItems, rareItems, legendItems } = buildShopItems(state);

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
      // ✅ 전체 런 통계 계산
      let totalDmg=0, totalKills=0, towerCount=0, bestDpsTower="—", bestDpsVal=0;
      for (const [, u] of state.units) {
        if (u.isSupport) continue;
        towerCount++;
        totalDmg += u.totalDamage||0;
        if ((u.totalDamage||0)>bestDpsVal) { bestDpsVal=u.totalDamage||0; bestDpsTower=`${rarityName(u.itemRarity)} ${u.name}`; }
      }
      gameoverBody.innerHTML = `
        <div style="margin-bottom:12px;font-size:16px;"><b>Stage ${st}</b> 에서 코어가 파괴되었습니다.</div>
        <div class="gameover-stats">
          <div class="gameover-stat"><div class="stat-label">도달 스테이지</div><div class="stat-value stage">${st}</div></div>
          <div class="gameover-stat"><div class="stat-label">획득 XP</div><div class="stat-value xp">+${state.lastXpGain||0}</div></div>
          <div class="gameover-stat"><div class="stat-label">보유 XP</div><div class="stat-value">${meta.xp??0}</div></div>
          <div class="gameover-stat"><div class="stat-label">타워 수</div><div class="stat-value">${towerCount}</div></div>
          <div class="gameover-stat"><div class="stat-label">총 피해량</div><div class="stat-value">${shortNum(totalDmg)}</div></div>
          <div class="gameover-stat"><div class="stat-label">MVP 타워</div><div class="stat-value" style="font-size:13px;">${safeText(bestDpsTower)}</div></div>
          <div class="gameover-stat"><div class="stat-label">SPECIAL 횟수</div><div class="stat-value">${sp}</div></div>
          <div class="gameover-stat"><div class="stat-label">최고 뽑기</div><div class="stat-value" style="font-size:13px;">${safeText(bestText)}</div></div>
        </div>
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
    // 2스테이지마다 일반 +1 추가 (자원 여유)
    if (stage % 2 === 0) { state.econ.tickets.common += 1; gain.common += 1; }
    if (stage % 3 === 0) { state.econ.tickets.rare += 1; gain.rare += 1; }
    // 5스테이지마다 중간보상: 레어+1, 일반+2
    if (stage % 5 === 0 && !isBossRound(stage)) {
      state.econ.tickets.rare += 1; state.econ.tickets.common += 2;
      gain.rare += 1; gain.common += 2;
    }
    if (isBossRound(stage)) {
      state.econ.tickets.legend += 1; state.econ.tickets.rare += 2; state.econ.tickets.common += 2;
      gain.legend += 1; gain.rare += 2; gain.common += 2;
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

  function addBeam(x1, y1, x2, y2, color, thick=2, type=null) {
    if (!state.vfxEnabled) return;
    const dur = (type==="MORTAR"||type==="CANNON") ? 0.26 : (type==="SNIPER") ? 0.14 : 0.18;
    const beam = { x1, y1, x2, y2, t: dur, dur, prog: 0, color, thick, type };
    if (type === "TESLA") {
      beam.zigzag = Array.from({length: 6}, () => (Math.random()-0.5) * 14);
    }
    state.beams.push(beam);
    // 머즐 플래시 퍼프
    const dx=x2-x1, dy=y2-y1, len=Math.hypot(dx,dy);
    if (len>20) {
      const nx=dx/len, ny=dy/len;
      for (let i=0; i<3; i++) {
        state.puffs.push({ x:x1+nx*8,y:y1+ny*8,vx:nx*(30+Math.random()*30)+(Math.random()-0.5)*14,vy:ny*(30+Math.random()*30)+(Math.random()-0.5)*14,t:0.14+Math.random()*0.08,life:0.22,g:0,fric:0.82,r:1.8+Math.random()*1.4,color });
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

  function addHitRing(x, y, color, crit=false, towerType=null) {
    if (!state.vfxEnabled) return;
    // 기본 임팩트 링 (조금 더 짧게 — 슬래시+스파크가 메인 표현)
    state.rings.push({ x,y,t:crit?0.32:0.22,r:crit?5:3,grow:crit?200:140,color,crit });

    // ── 중세 타격 스파크 (타입별 색상/형태) ──
    const isFrost  = towerType === "FROST";
    const isTesla  = towerType === "TESLA";
    const isCannon = towerType === "MORTAR" || towerType === "CANNON";
    const sparkN   = crit ? 9 : 6;
    const sparkCol = isFrost ? "#c5f6fa" : isTesla ? "#ffe066" : color;

    for (let i = 0; i < sparkN; i++) {
      const baseAng = (i / sparkN) * Math.PI * 2;
      const ang = baseAng + (Math.random() - 0.5) * 0.55;
      const spd = crit
        ? 85 + Math.random() * 75
        : 55 + Math.random() * 50;
      const life = 0.18 + Math.random() * 0.14;
      // 프로스트: 얼음 파편(천천히), 캐논: 무거운 파편(짧게), 테슬라: 전기 호(빠르게)
      const grav  = isFrost ? 20 : isCannon ? 80 : 30;
      const fric  = isFrost ? 0.88 : isCannon ? 0.78 : 0.82;
      state.puffs.push({
        x, y,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        t: life, life, g: grav, fric,
        r: crit ? 2.2 : 1.4,
        color: sparkCol, spark: true
      });
    }

    // ── 캐논/모타르: 추가 연기 잔해 파편 ──
    if (isCannon) {
      for (let i = 0; i < (crit ? 5 : 3); i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 30 + Math.random() * 40;
        state.puffs.push({
          x, y,
          vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd - 25,
          t: 0.30 + Math.random()*0.20, life: 0.50,
          g: 110, fric: 0.86,
          r: 2.5 + Math.random()*1.8,
          color: "rgba(140,110,80,0.72)", spark: false
        });
      }
    }

    // ── ×자 임팩트 슬래시 마크 ──
    if (crit || isCannon) {
      state.slashes.push({
        x, y,
        t: 0.26, life: 0.26,
        size: crit ? 16 : 10,
        color,
        rot: Math.random() * Math.PI * 0.5   // 0~90° 랜덤 회전
      });
    }
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
    const floaterCol=isCrit?"rgba(255,215,0,0.98)":(ric?"rgba(210,210,210,0.92)":"rgba(255,255,255,0.92)");
    addFloater(hitX,hitY,`${baseDmg}`,floaterCol,isCrit);
    addHitRing(hitX,hitY,ringCol,isCrit,u.type);
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
      const power=en.isBoss?3.0:(en.type===ENEMY_TYPES.ELITE?1.8:1.0);
      addPuff(en.x,en.y,c,power); addHitRing(en.x,en.y,c,en.isBoss||en.type===ENEMY_TYPES.ELITE);
      if (en.isBoss) {
        // 보스 킬: 추가 골드 파티클 버스트
        addPuff(en.x,en.y,"rgba(255,212,59,0.90)",1.8);
        addHitRing(en.x,en.y,"rgba(255,212,59,0.70)",true);
        state.msg={text:"BOSS DOWN!",t:1.1}; triggerScreenShake(0.75,0.30,22);
      } else if (en.type===ENEMY_TYPES.ELITE) {
        triggerScreenShake(0.20,0.12,8);
      }
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
        const beamThick = [1.5,2,2.5,3,3.5,4.5][rarityRank(u.itemRarity)] ?? 2;
        addBeam(u.x,u.y,en.x,en.y,rarityColor(u.itemRarity),hit.isCrit?beamThick*1.6:beamThick,u.type);
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
    // 배경 파티클 업데이트
    for (const p of state.bgParticles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.pulse += p.pulseSpeed * dt;
      if (p.x < -10) p.x = logical.w + 10;
      if (p.x > logical.w + 10) p.x = -10;
      if (p.y < -10) p.y = logical.h + 10;
      if (p.y > logical.h + 10) p.y = -10;
    }
    if (state.pathShiftAnim) { state.pathShiftAnim.t+=dt; if(state.pathShiftAnim.t>=state.pathShiftAnim.dur) state.pathShiftAnim=null; }
    for (const b of state.beams) { b.t-=dt; b.prog=clamp(1-(b.t/(b.dur||0.18)),0,1); }
    state.beams=state.beams.filter((b)=>b.t>0);
    for (const r of state.rings) { r.t-=dt; r.r+=r.grow*dt; }
    state.rings=state.rings.filter((r)=>r.t>0);
    for (const p of state.puffs) { p.t-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=(p.fric??0.90); p.vy=p.vy*(p.fric??0.90)+(p.g??90)*dt; }
    state.puffs=state.puffs.filter((p)=>p.t>0);
    for (const f of state.floaters) { f.t-=dt; f.y+=f.vy*dt; f.vy+=90*dt; }
    state.floaters=state.floaters.filter((f)=>f.t>0);
    for (const s of state.slashes) { s.t-=dt; }
    state.slashes=state.slashes.filter((s)=>s.t>0);
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

    // 배경 오버레이 (보라-파랑 그라데이션, Random Dice 게임보드 분위기)
    const g = ctx.createLinearGradient(0, 0, logical.w, logical.h);
    g.addColorStop(0, "rgba(30,10,70,0.07)");
    g.addColorStop(0.5, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(10,30,70,0.07)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, logical.w, logical.h);

    // 게임보드 격자 (보라빛 톤, 더 게임다운 느낌)
    const step = 40;
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = "rgba(180,150,255,0.65)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= logical.w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, logical.h); ctx.stroke();
    }
    for (let y = 0; y <= logical.h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(logical.w, y); ctx.stroke();
    }
    // 교차점 다이아몬드 도트
    ctx.globalAlpha = 0.11;
    ctx.fillStyle = "rgba(180,150,255,0.85)";
    for (let x = 0; x <= logical.w; x += step) {
      for (let y = 0; y <= logical.h; y += step) {
        ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fill();
      }
    }

    // 앰비언트 파티클
    const now = perfNow() / 1000;
    for (const p of state.bgParticles) {
      const pulse = 0.5 + 0.5 * Math.sin(p.pulse + now * p.pulseSpeed);
      ctx.globalAlpha = p.a * (0.5 + 0.5 * pulse);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 5 * pulse;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.7 + 0.3 * pulse), 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;

    // 비넷 (테두리 어둡게)
    ctx.globalAlpha = 1;
    const vgn = ctx.createRadialGradient(logical.w/2, logical.h/2, logical.w*0.25, logical.w/2, logical.h/2, logical.w*0.72);
    vgn.addColorStop(0, "rgba(0,0,0,0)");
    vgn.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = vgn; ctx.fillRect(0, 0, logical.w, logical.h);

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
      const isCore = cell.r === 2 && cell.c === 2;
      const key = cellKey(cell.r, cell.c);
      const hk = hotKindForKey(key);
      ctx.save();

      // 기본 타일 (좌상단 미묘한 밝기 + 둥근 사각형)
      const tileFill = isCore ? "rgba(255,107,107,0.10)" : "rgba(255,255,255,0.045)";
      ctx.fillStyle = tileFill;
      roundRect(ctx, cell.x, cell.y, cell.w, cell.h, 14); ctx.fill();
      // 타일 좌상단 하이라이트 (Random Dice 타일 질감)
      const tileSheen = ctx.createLinearGradient(cell.x, cell.y, cell.x + cell.w * 0.5, cell.y + cell.h * 0.5);
      tileSheen.addColorStop(0, isCore ? "rgba(255,150,150,0.07)" : "rgba(255,255,255,0.07)");
      tileSheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = tileSheen;
      roundRect(ctx, cell.x, cell.y, cell.w, cell.h, 14); ctx.fill();

      if (hk) {
        const pulse = 0.55 + 0.45 * Math.sin(perfNow() / 220 + (cell.r * 7 + cell.c));
        const isAspd = hk === "ASPD";
        const hotRgb = isAspd ? "116,192,252" : "255,212,59";
        const a = 0.12 + 0.09 * pulse;

        // HOT ZONE 배경 글로우
        ctx.fillStyle = `rgba(${hotRgb},${a})`;
        roundRect(ctx, cell.x + 2, cell.y + 2, cell.w - 4, cell.h - 4, 12); ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(${hotRgb},${0.28 + 0.18 * pulse})`;
        ctx.shadowColor = `rgba(${hotRgb},0.55)`;
        ctx.shadowBlur = 8 * pulse;
        roundRect(ctx, cell.x + 2, cell.y + 2, cell.w - 4, cell.h - 4, 12); ctx.stroke();
        ctx.shadowBlur = 0;

        // 아이콘 + 보너스 텍스트
        ctx.save(); ctx.globalAlpha = 0.92;
        ctx.textAlign = "left"; ctx.textBaseline = "top";
        // 아이콘 (공속: ⚡, 치명: ✦)
        ctx.fillStyle = `rgba(${hotRgb},0.98)`;
        ctx.font = "900 13px ui-sans-serif, system-ui";
        ctx.fillText(isAspd ? "⚡" : "✦", cell.x + 7, cell.y + 5);
        // 보너스 수치
        ctx.font = "800 10px ui-sans-serif, system-ui";
        const ha = state.hotAspdBonus ?? HOTZONE_ASPD_BONUS_BASE;
        const hc = state.hotCritBonus ?? HOTZONE_CRIT_BONUS_BASE;
        ctx.fillText(isAspd ? `+${Math.round(ha * 100)}%` : `+${Math.round(hc * 100)}%p`, cell.x + 7, cell.y + 21);
        ctx.restore();
      }

      ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 1; ctx.stroke();
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
    ctx.lineWidth=9; ctx.strokeStyle=pathColor; ctx.shadowColor=pathGlowColor; ctx.shadowBlur=16;
    roundRect(ctx,p.x,p.y,p.w,p.h,26); ctx.stroke();
    ctx.lineWidth=2; ctx.shadowBlur=0; ctx.strokeStyle="rgba(255,255,255,0.18)";
    roundRect(ctx,p.x,p.y,p.w,p.h,26); ctx.stroke();

    // 경로 방향 화살표 (흐르는 애니메이션)
    const now2 = perfNow() / 1000;
    const arrowColor = (wtInfo && wt !== WAVE_TYPE.NORMAL) ? `${wtInfo.color}70` : "rgba(255,255,255,0.22)";
    ctx.strokeStyle = arrowColor; ctx.lineWidth = 2;
    ctx.shadowColor = arrowColor; ctx.shadowBlur = 5;
    const pathPerim = 2 * (p.w + p.h);
    const arrowSpacing = 70;
    const flowOffset = (now2 * 45) % arrowSpacing;
    for (let d = flowOffset; d < pathPerim; d += arrowSpacing) {
      const pt = pointOnRect(p, d);
      // 진행 방향 계산
      const pt2 = pointOnRect(p, d + 5);
      const angle = Math.atan2(pt2.y - pt.y, pt2.x - pt.x);
      ctx.save();
      ctx.translate(pt.x, pt.y); ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(-5, -4); ctx.lineTo(0, 0); ctx.lineTo(-5, 4);
      ctx.stroke();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawCore() {
    const c = state.board.core;
    const now = perfNow() / 1000;
    const hpPct = clamp(state.coreHp / (state.coreHpMax || 20), 0, 1);
    const pulse = 0.5 + 0.5 * Math.sin(now * (hpPct < 0.30 ? 6.5 : 2.6));
    const coreColor = hpPct < 0.30 ? "#ff6b6b" : hpPct < 0.60 ? "#ffd43b" : "#63e6be";
    const coreColorRgb = hpPct < 0.30 ? "255,107,107" : hpPct < 0.60 ? "255,212,59" : "99,230,190";

    ctx.save();

    // 외곽 맥동 링들
    const ringCount = 3;
    for (let i = 0; i < ringCount; i++) {
      const tOff = (i / ringCount);
      const ringPulse = (pulse + tOff) % 1.0;
      const ringR = c.r * (1.5 + ringPulse * 1.8);
      ctx.globalAlpha = (1 - ringPulse) * 0.18 * (hpPct < 0.30 ? 2.0 : 1.0);
      ctx.strokeStyle = coreColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(c.x, c.y, ringR, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 외곽 글로우
    const glowR = lerp(14, 26, pulse);
    ctx.shadowColor = `rgba(${coreColorRgb},0.70)`;
    ctx.shadowBlur = glowR;

    // 본체 그라데이션
    const grad = ctx.createRadialGradient(c.x - c.r * 0.28, c.y - c.r * 0.28, c.r * 0.10, c.x, c.y, c.r * 1.38);
    grad.addColorStop(0, "rgba(255,255,255,0.98)");
    grad.addColorStop(0.18, coreColor);
    grad.addColorStop(0.65, coreColor);
    grad.addColorStop(1, `rgba(${coreColorRgb},0.12)`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 1.28, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // 테두리
    ctx.strokeStyle = "rgba(255,255,255,0.30)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 1.28, 0, Math.PI * 2); ctx.stroke();

    // HP 숫자
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "800 18px ui-sans-serif, system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(state.coreHp), c.x, c.y + 1);

    ctx.restore();
  }

  function drawUnits() {
    for (const [key, u] of state.units) drawUnit(u, key===state.selectedKey);
    if (state.drag&&state.drag.active&&state.drag.unit) drawUnitGhost(state.drag.unit,state.drag.x,state.drag.y);
  }

  function drawUnit(u, selected) {
    const col    = rarityColor(u.itemRarity);
    const cell   = state.board.cell;
    const baseR  = cell * 0.36;  // drawTurret 기지 반지름
    const topOff = cell * 0.05;  // drawTurret translate(0, -topOff)
    const key    = cellKey(u.r, u.c);
    const hk     = hotKindForKey(key);
    const hotMul = hotMulForKey(key);

    ctx.save(); ctx.translate(snap(u.x), snap(u.y));
    const kick = u.kick || 0;
    const kickScale = 1 + kick * 0.22;

    // 선택: 사거리 원 + 원형 선택 링 (kick 전)
    if (selected) {
      const auraRangeMul = u.auraOn ? (u.auraRangeMul ?? 1.0) : 1.0;
      const rangePx = (u.rangeCells || 0) * state.board.pxPerCell * auraRangeMul;
      if (rangePx > 4) {
        ctx.save(); ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(0, 0, rangePx, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99,230,190,0.12)"; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = "rgba(99,230,190,0.26)"; ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.70)";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "rgba(255,255,255,0.85)";
      ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(0, -topOff, baseR * 1.38, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    if (kickScale !== 1) ctx.scale(kickScale, kickScale);

    // 오라 링 (지원 타워)
    if (u.auraOn) {
      ctx.save();
      ctx.shadowColor = "rgba(99,230,190,0.20)"; ctx.shadowBlur = 12;
      ctx.strokeStyle = "rgba(99,230,190,0.32)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, baseR * 1.65, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // HOT ZONE 배지 (좌하단 소형 박스)
    if (hk) {
      const pulse = 0.55 + 0.45 * Math.sin(perfNow() / 210 + (u.r * 3 + u.c));
      ctx.save(); ctx.globalAlpha = 0.90;
      ctx.fillStyle = hk === "ASPD" ? `rgba(116,192,252,${0.50+0.30*pulse})` : `rgba(255,212,59,${0.50+0.30*pulse})`;
      ctx.fillRect(-baseR * 1.02, baseR * 0.62, baseR * 0.38, baseR * 0.38);
      if (hotMul > 1) { ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillRect(-baseR * 0.56, baseR * 0.62, baseR * 0.38, baseR * 0.38); }
      ctx.restore();
    }

    // ✦ 포탑 본체
    drawTurret(u, col);

    // 리로드/과열 바 (포탑 위)
    const barW = cell * 0.62, barH = 5, bx = -barW / 2, by = -baseR - topOff - 10;
    if (u.reloadT > 0 && u.reloadTime > 0) {
      const p = clamp(1 - u.reloadT / u.reloadTime, 0, 1);
      ctx.save(); ctx.globalAlpha = 0.95;
      ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(ctx, bx, by, barW, barH, 2); ctx.fill();
      ctx.fillStyle = "rgba(99,230,190,0.75)"; roundRect(ctx, bx, by, barW * p, barH, 2); ctx.fill(); ctx.restore();
    } else if (u.overheatT > 0 && u.overheatCool > 0) {
      const p = clamp(1 - u.overheatT / u.overheatCool, 0, 1);
      ctx.save(); ctx.globalAlpha = 0.95;
      ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(ctx, bx, by, barW, barH, 2); ctx.fill();
      ctx.fillStyle = "rgba(255,170,120,0.70)"; roundRect(ctx, bx, by, barW * p, barH, 2); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }

  function drawUnitGhost(u, x, y) {
    const col = rarityColor(u.itemRarity);
    const rangePx = (u.rangeCells || 0) * state.board.pxPerCell;
    ctx.save();
    ctx.globalAlpha = 0.52;
    ctx.translate(snap(x), snap(y));
    if (rangePx > 4) {
      ctx.beginPath(); ctx.arc(0, 0, rangePx, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(99,230,190,0.10)"; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "rgba(99,230,190,0.22)"; ctx.stroke();
    }
    drawTurret(u, col);
    ctx.restore();
  }

  // ── 중세 판타지 타워 (워크래프트3 휴먼 스타일) ──────────────
  // hex 밝기 조절 헬퍼
  function hexAdj(hex, amt) {
    const n = parseInt(hex.replace("#",""), 16);
    const r = clamp(((n>>16)&0xff)+amt, 0, 255);
    const g = clamp(((n>>8)&0xff)+amt, 0, 255);
    const b = clamp((n&0xff)+amt, 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  function drawTurret(u, accent) {
    const cell = state.board.cell;
    const rrank = rarityRank(u.itemRarity);
    const sizeBoost = [1.0, 1.06, 1.12, 1.18, 1.24, 1.30][rrank] ?? 1.0;
    const R = cell * 0.22 * sizeBoost;  // 타워 외곽 반지름
    const now = perfNow() / 1000;

    // 타입별: 돌 기조색, 액센트 컬러, 상단 장식 종류
    const TCFG = {
      SNIPER:      { stone: "#364428", acc: "#74b816", cap: "arrow"   },
      SHOTGUN:     { stone: "#442828", acc: "#f03e3e", cap: "scatter" },
      FROST:       { stone: "#1e2e4c", acc: "#74c0fc", cap: "ice"     },
      TESLA:       { stone: "#2e2c00", acc: "#f59f00", cap: "bolt"    },
      MORTAR:      { stone: "#2c1244", acc: "#cc5de8", cap: "bowl"    },
      BARRAGE:     { stone: "#3c2c00", acc: "#ffa94d", cap: "volley"  },
      CANNON:      { stone: "#3a2000", acc: "#fd7e14", cap: "cannon"  },
      GATLING:     { stone: "#3a2200", acc: "#ff9240", cap: "spin"    },
      BERSERKER:   { stone: "#3a0000", acc: "#ff4444", cap: "blades"  },
      EXECUTIONER: { stone: "#280808", acc: "#c92a2a", cap: "scythe"  },
      GIANTSLAYER: { stone: "#301c00", acc: "#ffd43b", cap: "hammer"  },
      PINBALL:     { stone: "#002c38", acc: "#22b8cf", cap: "orb"     },
      RADAR:       { stone: "#180038", acc: "#b197fc", cap: "eye"     },
    };
    const cfg = TCFG[u.type] ?? { stone: "#2a3040", acc: accent, cap: "orb" };

    ctx.save();

    // ① 지면 그림자
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(R*0.10, R*0.65, R*1.20, R*0.36, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // ① 바닥 마법진 (레어리티 구분 — 타워 아래에 그려짐)
    // mc = 셀 절반 - 여백 → 마법진이 절대로 인접 칸에 침범하지 않음
    if (rrank >= 1) {
      const rc = rarityColor(u.itemRarity);
      const mc = cell * 0.44; // 최대 허용 반지름 (셀 절반=48px 보다 작음)
      ctx.save();
      ctx.shadowColor = rc;

      // 공통: 기본 링 (베이스)
      const basePulse = 0.55 + 0.45 * Math.sin(now * 1.8);
      const r0 = mc * 0.62; // 기본 링 반지름
      ctx.strokeStyle = rc; ctx.lineWidth = 2.0;
      ctx.globalAlpha = ([0,0.40,0.52,0.60,0.66,0.74][rrank] ?? 0.40) * (rrank === 1 ? basePulse : 1);
      ctx.shadowBlur = [0,10,13,15,17,20][rrank] ?? 10;
      ctx.beginPath(); ctx.arc(0, 0, r0, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;

      if (rrank >= 2) {
        // RARE: 회전 틱마크 16개 + 외부 점선 링
        const r1 = mc * 0.80;
        const tickRot = now * 0.55;
        ctx.save(); ctx.rotate(tickRot);
        ctx.strokeStyle = rc; ctx.lineWidth = 1.4;
        ctx.shadowColor = rc; ctx.shadowBlur = 7;
        ctx.globalAlpha = 0.48;
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const ri = r0 * (i % 2 === 0 ? 1.0 : 1.06);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a)*ri, Math.sin(a)*ri);
          ctx.lineTo(Math.cos(a)*(ri + mc*0.09), Math.sin(a)*(ri + mc*0.09));
          ctx.stroke();
        }
        ctx.restore();
        ctx.globalAlpha = 0.36;
        ctx.lineWidth = 1.1; ctx.shadowBlur = 5;
        ctx.setLineDash([4, 5]);
        ctx.beginPath(); ctx.arc(0, 0, r1, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }

      if (rrank >= 3) {
        // LEGENDARY: 6각 별 (헥사그램)
        const r2 = mc * 0.78;
        const starRot = now * 0.42;
        ctx.save(); ctx.rotate(starRot);
        ctx.strokeStyle = rc; ctx.lineWidth = 1.6;
        ctx.shadowColor = rc; ctx.shadowBlur = 12;
        ctx.globalAlpha = 0.62;
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const rad = i % 2 === 0 ? r2 : r2 * 0.52;
          i === 0 ? ctx.moveTo(Math.cos(a)*rad, Math.sin(a)*rad)
                  : ctx.lineTo(Math.cos(a)*rad, Math.sin(a)*rad);
        }
        ctx.closePath(); ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }

      if (rrank >= 4) {
        // UNIQUE: 역방향 팔각형 + 보조 링
        const r3 = mc * 0.92;
        const octRot = -now * 0.60;
        ctx.save(); ctx.rotate(octRot);
        ctx.strokeStyle = rc; ctx.lineWidth = 1.4;
        ctx.shadowColor = rc; ctx.shadowBlur = 14;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          i === 0 ? ctx.moveTo(Math.cos(a)*r3, Math.sin(a)*r3)
                  : ctx.lineTo(Math.cos(a)*r3, Math.sin(a)*r3);
        }
        ctx.closePath(); ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = rc; ctx.lineWidth = 1.6;
        ctx.globalAlpha = 0.40; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(0, 0, r3, 0, Math.PI*2); ctx.stroke();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }

      if (rrank >= 5) {
        // MYTHIC: 12각 별 + 펄싱 최외곽 오라 (셀 경계 내)
        const mythPulse = 0.55 + 0.45 * Math.sin(now * 2.8);
        const r4 = mc * 0.78;
        const mRot = now * 0.80;
        ctx.save(); ctx.rotate(mRot);
        ctx.strokeStyle = rc; ctx.lineWidth = 1.8;
        ctx.shadowColor = rc; ctx.shadowBlur = 16;
        ctx.globalAlpha = 0.70;
        ctx.beginPath();
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const rad = i % 2 === 0 ? r4 : r4 * 0.60;
          i === 0 ? ctx.moveTo(Math.cos(a)*rad, Math.sin(a)*rad)
                  : ctx.lineTo(Math.cos(a)*rad, Math.sin(a)*rad);
        }
        ctx.closePath(); ctx.stroke();
        ctx.restore();
        // 펄싱 오라 (mc가 최대치 — 셀 딱 맞음)
        ctx.strokeStyle = rc;
        ctx.globalAlpha = 0.28 + 0.26 * mythPulse;
        ctx.lineWidth = 3.0; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.arc(0, 0, mc, 0, Math.PI*2); ctx.stroke();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }

      ctx.restore();
    }

    // ② 외벽 베이스 (어두운 외곽)
    ctx.fillStyle = hexAdj(cfg.stone, -45);
    ctx.shadowColor = cfg.acc; ctx.shadowBlur = 11;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    // 돌 표면 셀-쉐이드
    const sg = ctx.createRadialGradient(-R*0.28, -R*0.30, 0, R*0.10, R*0.10, R*1.85);
    sg.addColorStop(0,    hexAdj(cfg.stone,  60));
    sg.addColorStop(0.45, cfg.stone);
    sg.addColorStop(1,    hexAdj(cfg.stone, -55));
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI*2); ctx.fill();

    // 돌 줄눈 (원형 라인)
    ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, R*0.70, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(0, 0, R*0.42, 0, Math.PI*2); ctx.stroke();

    // ③ 외벽 컬러 테두리
    ctx.strokeStyle = cfg.acc; ctx.lineWidth = 2.4;
    ctx.shadowColor = cfg.acc; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0;

    // ④ 성가퀴 (crenellations — 8개 흉벽 돌출)
    const cN = 8;
    const cW = R * 0.19, cH = R * 0.18;
    for (let i = 0; i < cN; i++) {
      const ang = (i / cN) * Math.PI * 2 - Math.PI / 8;
      ctx.save();
      ctx.rotate(ang);
      // 흉벽 블록
      ctx.fillStyle = hexAdj(cfg.stone, 30);
      ctx.shadowColor = cfg.acc; ctx.shadowBlur = 3;
      roundRect(ctx, R - cH * 0.5, -cW * 0.5, cH, cW, cW * 0.25); ctx.fill();
      // 흉벽 윗면 하이라이트
      ctx.fillStyle = hexAdj(cfg.stone, 65);
      ctx.shadowBlur = 0;
      roundRect(ctx, R - cH * 0.5, -cW * 0.5, cH * 0.28, cW, cW * 0.22); ctx.fill();
      // 흉벽 테두리
      ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 0.8;
      roundRect(ctx, R - cH * 0.5, -cW * 0.5, cH, cW, cW * 0.25); ctx.stroke();
      ctx.restore();
    }
    ctx.shadowBlur = 0;

    // ⑤ 내부 바닥 (타워 내부 — 어두운 원)
    const iR = R * 0.55;
    const ig = ctx.createRadialGradient(-iR*0.15, -iR*0.18, 0, 0, 0, iR);
    ig.addColorStop(0, hexAdj(cfg.stone, -20));
    ig.addColorStop(1, hexAdj(cfg.stone, -60));
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.arc(0, 0, iR, 0, Math.PI*2); ctx.fill();
    // 내부 링 장식
    ctx.strokeStyle = "rgba(255,255,255,0.09)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, iR*0.65, 0, Math.PI*2); ctx.stroke();

    // ⑦ 상단 장식 (타입별, aimAngle 회전)
    ctx.save();
    ctx.rotate(u.aimAngle || 0);
    drawTowerCap(cfg.cap, cfg.acc, iR, now);
    ctx.restore();

    ctx.restore();
  }

  // 타워 상단 타입별 장식 렌더링
  function drawTowerCap(type, color, r, now) {
    ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = "round"; ctx.lineJoin = "round";

    switch (type) {
      case "arrow": {
        // 저격탑: 조준 화살표
        ctx.lineWidth = r * 0.20;
        ctx.beginPath(); ctx.moveTo(-r*0.28, 0); ctx.lineTo(r*0.46, 0); ctx.stroke();
        ctx.lineWidth = r * 0.18;
        ctx.beginPath(); ctx.moveTo(r*0.46, 0); ctx.lineTo(r*0.16, -r*0.30); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r*0.46, 0); ctx.lineTo(r*0.16, r*0.30); ctx.stroke();
        // 화살 꽁지 깃
        ctx.lineWidth = r * 0.10;
        ctx.beginPath(); ctx.moveTo(-r*0.20, 0); ctx.lineTo(-r*0.38, -r*0.18); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r*0.20, 0); ctx.lineTo(-r*0.38, r*0.18); ctx.stroke();
        break;
      }
      case "scatter": {
        // 산탄탑: 3개 방사 화살
        for (const ang of [-0.40, 0, 0.40]) {
          ctx.save(); ctx.rotate(ang);
          ctx.lineWidth = r * 0.16;
          ctx.beginPath(); ctx.moveTo(r*0.04, 0); ctx.lineTo(r*0.52, 0); ctx.stroke();
          ctx.lineWidth = r * 0.12;
          ctx.beginPath(); ctx.moveTo(r*0.52, 0); ctx.lineTo(r*0.30, -r*0.22); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(r*0.52, 0); ctx.lineTo(r*0.30, r*0.22); ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case "ice": {
        // 프로스트탑: 6각 눈송이
        for (let i = 0; i < 6; i++) {
          ctx.save(); ctx.rotate((i / 6) * Math.PI * 2);
          ctx.lineWidth = r * 0.15;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r*0.50, 0); ctx.stroke();
          ctx.lineWidth = r * 0.10;
          ctx.beginPath(); ctx.moveTo(r*0.26, 0); ctx.lineTo(r*0.42, -r*0.18); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(r*0.26, 0); ctx.lineTo(r*0.42, r*0.18); ctx.stroke();
          ctx.restore();
        }
        // 중심 보석
        ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(0, 0, r*0.18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.80)";
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(-r*0.05, -r*0.05, r*0.07, 0, Math.PI*2); ctx.fill();
        break;
      }
      case "bolt": {
        // 테슬라탑: 번개 볼트
        ctx.lineWidth = r * 0.16;
        ctx.beginPath();
        ctx.moveTo(-r*0.08, -r*0.46);
        ctx.lineTo(r*0.18,  -r*0.04);
        ctx.lineTo(-r*0.02, -r*0.04);
        ctx.lineTo(r*0.10,   r*0.46);
        ctx.lineTo(-r*0.20,  r*0.02);
        ctx.lineTo(r*0.00,   r*0.02);
        ctx.closePath();
        ctx.stroke();
        ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1;
        break;
      }
      case "bowl": {
        // 모르타르탑: 박격포 그릇
        ctx.lineWidth = r * 0.22; ctx.lineCap = "butt";
        ctx.beginPath(); ctx.arc(0, r*0.08, r*0.34, Math.PI, 0, false); ctx.stroke();
        ctx.lineWidth = r * 0.18; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-r*0.38, r*0.08); ctx.lineTo(r*0.38, r*0.08); ctx.stroke();
        // 포탄
        ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(0, -r*0.26, r*0.16, 0, Math.PI*2); ctx.fill();
        break;
      }
      case "volley": {
        // 바라지탑: 4방향 화살 (일제사격)
        for (let i = 0; i < 4; i++) {
          const a = -0.60 + i * 0.42;
          ctx.save(); ctx.rotate(a - Math.PI/2);
          ctx.lineWidth = r * 0.13;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r*0.50, 0); ctx.stroke();
          ctx.lineWidth = r * 0.10;
          ctx.beginPath(); ctx.moveTo(r*0.50, 0); ctx.lineTo(r*0.30, -r*0.20); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(r*0.50, 0); ctx.lineTo(r*0.30, r*0.20); ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case "cannon": {
        // 캐논탑: 두꺼운 포신
        ctx.lineWidth = r * 0.40; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-r*0.16, 0); ctx.lineTo(r*0.44, 0); ctx.stroke();
        // 포구 링 (밝은)
        ctx.lineWidth = r * 0.13; ctx.strokeStyle = hexAdj(color.startsWith("rgb") ? "#fd7e14" : color, 60);
        ctx.lineCap = "butt";
        ctx.beginPath(); ctx.arc(r*0.44, 0, r*0.22, 0, Math.PI*2); ctx.stroke();
        // 밴드 장식
        ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.lineWidth = r*0.10;
        for (const t of [0.08, 0.28, 0.52]) {
          const xx = -r*0.16 + (r*0.60)*t;
          ctx.beginPath(); ctx.moveTo(xx, -r*0.20); ctx.lineTo(xx, r*0.20); ctx.stroke();
        }
        break;
      }
      case "spin": {
        // 개틀링탑: 회전 3포신 + 중심 허브
        const spinAng = now * 5.0;
        for (let i = 0; i < 3; i++) {
          ctx.save(); ctx.rotate(spinAng + (i / 3) * Math.PI * 2);
          ctx.lineWidth = r * 0.18;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r*0.50, 0); ctx.stroke();
          ctx.restore();
        }
        ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(0, 0, r*0.18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.80)";
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(0, 0, r*0.07, 0, Math.PI*2); ctx.fill();
        break;
      }
      case "blades": {
        // 광전사탑: 교차 검 X
        for (const a of [-Math.PI/4, Math.PI/4]) {
          ctx.save(); ctx.rotate(a);
          ctx.lineWidth = r * 0.18;
          ctx.beginPath(); ctx.moveTo(-r*0.48, 0); ctx.lineTo(r*0.48, 0); ctx.stroke();
          // 검날 끝 뾰족
          ctx.beginPath();
          ctx.moveTo(r*0.48, 0); ctx.lineTo(r*0.38, -r*0.14); ctx.lineTo(r*0.60, 0); ctx.lineTo(r*0.38, r*0.14);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        break;
      }
      case "scythe": {
        // 처형자탑: 낫 (큰 곡선)
        ctx.lineWidth = r * 0.16;
        ctx.beginPath(); ctx.moveTo(-r*0.10, r*0.44); ctx.lineTo(-r*0.10, -r*0.38); ctx.stroke(); // 자루
        ctx.lineWidth = r * 0.20;
        ctx.beginPath(); ctx.arc(-r*0.10, -r*0.08, r*0.36, -Math.PI*0.85, -Math.PI*0.10); ctx.stroke(); // 날
        // 날 끝
        ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(r*0.25, -r*0.38, r*0.10, 0, Math.PI*2); ctx.fill();
        break;
      }
      case "hammer": {
        // 자이언트슬레이어탑: 전쟁 해머
        ctx.lineWidth = r * 0.18;
        ctx.beginPath(); ctx.moveTo(-r*0.08, r*0.38); ctx.lineTo(r*0.08, -r*0.28); ctx.stroke(); // 자루
        // 해머 헤드
        ctx.shadowBlur = 16;
        roundRect(ctx, r*0.00, -r*0.50, r*0.40, r*0.24, r*0.06); ctx.fill();
        // 헤드 하이라이트
        ctx.fillStyle = "rgba(255,255,255,0.30)";
        ctx.shadowBlur = 0;
        roundRect(ctx, r*0.00, -r*0.50, r*0.40, r*0.08, r*0.04); ctx.fill();
        break;
      }
      case "orb": {
        // 핀볼탑: 빛나는 마법 구체
        const pulse = 0.80 + 0.20 * Math.sin(now * 3.0);
        const og = ctx.createRadialGradient(-r*0.12, -r*0.14, 0, 0, 0, r*0.42*pulse);
        og.addColorStop(0, "rgba(255,255,255,0.95)");
        og.addColorStop(0.38, color);
        og.addColorStop(1, "rgba(0,0,0,0.05)");
        ctx.fillStyle = og;
        ctx.shadowBlur = 16 * pulse;
        ctx.beginPath(); ctx.arc(0, 0, r*0.42*pulse, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(-r*0.11, -r*0.13, r*0.10, 0, Math.PI*2); ctx.fill();
        break;
      }
      case "eye": {
        // 레이더탑: 수정구슬 + 감지 파장
        // 외곽 링
        ctx.lineWidth = r * 0.15;
        ctx.beginPath(); ctx.arc(0, 0, r*0.38, 0, Math.PI*2); ctx.stroke();
        // 구슬
        const eg = ctx.createRadialGradient(-r*0.10, -r*0.10, 0, 0, 0, r*0.24);
        eg.addColorStop(0, "rgba(255,255,255,0.90)");
        eg.addColorStop(0.5, color);
        eg.addColorStop(1, "rgba(0,0,0,0.20)");
        ctx.fillStyle = eg; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(0, 0, r*0.24, 0, Math.PI*2); ctx.fill();
        // 회전 스캔선 3개
        ctx.strokeStyle = color; ctx.lineWidth = r*0.08; ctx.globalAlpha = 0.60;
        ctx.shadowBlur = 6;
        for (let i = 0; i < 3; i++) {
          const a = now * 2.0 + (i / 3) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(r*0.30*Math.cos(a), r*0.30*Math.sin(a));
          ctx.lineTo(r*0.58*Math.cos(a), r*0.58*Math.sin(a));
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      default: {
        ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(0, 0, r*0.36, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
    ctx.lineCap = "butt";
  }

  function drawEnemies() { for (const en of state.enemies) drawEnemy(en); }

  function drawEnemy(en) {
    const flash = en.hitFlash;
    const isElite = en.type === ENEMY_TYPES.ELITE;
    const isBoss = en.isBoss;
    const r = en.radius;
    const now = perfNow() / 1000;
    const animSeed = en.animSeed ?? 0;

    ctx.save();
    ctx.translate(snap(en.x), snap(en.y));

    // ── 보스: 외곽 회전 장식 링 ──
    if (isBoss) {
      const angle = now * 0.9 + animSeed;
      ctx.save();
      ctx.rotate(angle);
      ctx.strokeStyle = "rgba(255,212,59,0.40)";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "rgba(255,212,59,0.60)";
      ctx.shadowBlur = 10;
      ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.68, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      // 역방향 링
      ctx.save();
      ctx.rotate(-angle * 0.55);
      ctx.strokeStyle = "rgba(177,151,252,0.28)";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 0;
      ctx.setLineDash([4, 10]);
      ctx.beginPath(); ctx.arc(0, 0, r * 2.05, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── 엘리트: 장갑 방패 링 ──
    if (isElite && !isBoss && en.armor > 0) {
      const armorAlpha = clamp(0.22 + en.armor * 0.05, 0.22, 0.60);
      ctx.save();
      ctx.strokeStyle = `rgba(180,190,200,${armorAlpha})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = "rgba(180,190,200,0.40)";
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // ── 본체 그라데이션 원 ──
    const bodyR = r * (isBoss ? 1.0 : 0.92);
    const pulse = isBoss ? 0.85 + 0.15 * Math.sin(now * 3.5 + animSeed) : 1.0;
    const grad = ctx.createRadialGradient(-bodyR * 0.28, -bodyR * 0.28, bodyR * 0.05, 0, 0, bodyR * pulse);
    const baseCol = en.color;
    grad.addColorStop(0, "rgba(255,255,255,0.80)");
    grad.addColorStop(0.25, baseCol);
    grad.addColorStop(0.72, baseCol);
    grad.addColorStop(1, "rgba(0,0,0,0.50)");

    ctx.shadowColor = baseCol;
    ctx.shadowBlur = isBoss ? 22 : isElite ? 14 : 9;
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, bodyR * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // ── 눈 (미니언/엘리트) ──
    if (!isBoss) {
      const eyeOff = r * 0.22;
      const eyeR = r * (isElite ? 0.18 : 0.15);
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.beginPath(); ctx.arc(-eyeOff, -r * 0.10, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(eyeOff, -r * 0.10, eyeR, 0, Math.PI * 2); ctx.fill();
      // 눈 하이라이트
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.beginPath(); ctx.arc(-eyeOff - eyeR * 0.28, -r * 0.10 - eyeR * 0.28, eyeR * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(eyeOff - eyeR * 0.28, -r * 0.10 - eyeR * 0.28, eyeR * 0.32, 0, Math.PI * 2); ctx.fill();
    } else {
      // 보스 눈 (3개)
      const bEyeR = r * 0.14;
      ctx.fillStyle = "rgba(255,212,59,0.92)";
      ctx.shadowColor = "rgba(255,212,59,0.70)"; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(-r * 0.26, -r * 0.08, bEyeR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.26, -r * 0.08, bEyeR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -r * 0.26, bEyeR * 0.72, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // 보스 크라운 (삼각형 3개)
      ctx.fillStyle = "rgba(255,212,59,0.88)";
      ctx.strokeStyle = "rgba(255,180,0,0.60)"; ctx.lineWidth = 1.2;
      ctx.shadowColor = "rgba(255,212,59,0.60)"; ctx.shadowBlur = 8;
      for (let i = -1; i <= 1; i++) {
        const cx2 = i * r * 0.44, baseY = -bodyR * 0.92;
        const tipY = baseY - r * (i === 0 ? 0.52 : 0.38);
        ctx.beginPath();
        ctx.moveTo(cx2 - r * 0.14, baseY);
        ctx.lineTo(cx2 + r * 0.14, baseY);
        ctx.lineTo(cx2, tipY);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    // ── 본체 테두리 ──
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = isBoss ? 2.5 : isElite ? 2 : 1.5;
    ctx.beginPath(); ctx.arc(0, 0, bodyR * pulse, 0, Math.PI * 2); ctx.stroke();

    // ── 피격 플래시 ──
    if (flash > 0 && state.vfxEnabled) {
      ctx.globalAlpha = clamp(flash * 2.2, 0, 0.55);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath(); ctx.arc(0, 0, bodyR * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    drawEnemyHp(en);
  }

  function drawEnemyHp(en) {
    const barW = en.isBoss ? 70 : en.type === ENEMY_TYPES.ELITE ? 48 : 38;
    const barH = en.isBoss ? 8 : 6;
    const x = en.x - barW / 2;
    const y = en.y - en.radius - (en.isBoss ? 20 : 16);
    const hpPct = clamp(en.hp / en.maxHp, 0, 1);

    ctx.save();
    // 배경
    ctx.fillStyle = "rgba(0,0,0,0.50)";
    roundRect(ctx, x - 1, y - 1, barW + 2, barH + 2, 5); ctx.fill();
    // HP 그라데이션 (체력에 따라 색 변화)
    const hpColor = hpPct > 0.55 ? (en.isBoss ? "#b197fc" : "#63e6be")
                  : hpPct > 0.28 ? "#ffd43b" : "#ff6b6b";
    if (hpPct < 0.28) { ctx.shadowColor = "#ff6b6b"; ctx.shadowBlur = 6; }
    ctx.fillStyle = hpColor;
    roundRect(ctx, x, y, barW * hpPct, barH, 4); ctx.fill();
    ctx.shadowBlur = 0;
    // 테두리
    ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 0.8;
    roundRect(ctx, x, y, barW, barH, 4); ctx.stroke();
    // 보스 장갑 표시
    if (en.isBoss && en.armor > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = "700 9px ui-sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText(`🛡️${en.armor.toFixed(1)}`, en.x, y - 2);
    } else if (en.type === ENEMY_TYPES.ELITE && en.armor > 0) {
      ctx.fillStyle = "rgba(180,190,200,0.75)"; ctx.font = "700 8px ui-sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText(`🛡️${en.armor.toFixed(1)}`, en.x, y - 2);
    }
    ctx.restore();
  }

  function drawEffects() {
    const vfx=state.vfxEnabled?VFX_INTENSITY_BASE:0;
    if (vfx>0) {
      for (const b of state.beams) {
        const prog = b.prog ?? 0;
        const fade = clamp(b.t / (b.dur * 0.35 || 0.07), 0, 1);
        const px = b.x1 + (b.x2 - b.x1) * prog;
        const py = b.y1 + (b.y2 - b.y1) * prog;
        const thick = b.thick ?? 3;
        ctx.save(); ctx.globalAlpha = fade * vfx;

        if (b.type === "TESLA") {
          // 테슬라: 지그재그 라이트닝 (x1,y1 → 현재 위치)
          const zz = b.zigzag || [];
          const segCount = zz.length;
          const dx = px - b.x1, dy = py - b.y1;
          const len = Math.hypot(dx, dy);
          const nx = len > 0 ? -dy / len : 0, ny = len > 0 ? dx / len : 0;
          ctx.strokeStyle = b.color; ctx.lineWidth = thick * 1.2;
          ctx.shadowColor = b.color; ctx.shadowBlur = 16 * vfx;
          ctx.lineCap = "round"; ctx.lineJoin = "round";
          ctx.beginPath(); ctx.moveTo(b.x1, b.y1);
          for (let i = 0; i < segCount; i++) {
            const t = (i + 1) / (segCount + 1);
            ctx.lineTo(b.x1 + dx * t + nx * zz[i], b.y1 + dy * t + ny * zz[i]);
          }
          ctx.lineTo(px, py); ctx.stroke();
          ctx.strokeStyle = "rgba(255,255,180,0.70)"; ctx.lineWidth = 1.2; ctx.shadowBlur = 0;
          ctx.beginPath(); ctx.moveTo(b.x1, b.y1);
          for (let i = 0; i < segCount; i++) {
            const t = (i + 1) / (segCount + 1);
            ctx.lineTo(b.x1 + dx * t + nx * zz[i], b.y1 + dy * t + ny * zz[i]);
          }
          ctx.lineTo(px, py); ctx.stroke();
          // 전기 점
          ctx.fillStyle = "#fff"; ctx.shadowColor = b.color; ctx.shadowBlur = 14 * vfx;
          ctx.beginPath(); ctx.arc(px, py, thick * 1.1, 0, Math.PI * 2); ctx.fill();
        } else if (b.type === "MORTAR" || b.type === "CANNON") {
          // 포탄: 포물선 궤적 + 탄두 점
          const mx = (b.x1 + b.x2) / 2;
          const my = (b.y1 + b.y2) / 2 - Math.hypot(b.x2 - b.x1, b.y2 - b.y1) * 0.38;
          // 궤적 잔상 (이미 지나간 구간)
          const trailEnd = Math.max(0, prog - 0.18);
          if (trailEnd > 0) {
            ctx.strokeStyle = b.color; ctx.lineWidth = thick * 0.7;
            ctx.shadowColor = b.color; ctx.shadowBlur = 8 * vfx;
            ctx.globalAlpha = fade * 0.45 * vfx;
            ctx.beginPath();
            const steps = 10;
            for (let i = 0; i <= steps; i++) {
              const t = trailEnd * i / steps;
              const bx = (1-t)*(1-t)*b.x1 + 2*(1-t)*t*mx + t*t*b.x2;
              const by = (1-t)*(1-t)*b.y1 + 2*(1-t)*t*my + t*t*b.y2;
              i === 0 ? ctx.moveTo(bx, by) : ctx.lineTo(bx, by);
            }
            ctx.stroke();
            ctx.globalAlpha = fade * vfx;
          }
          // 탄두 원
          ctx.fillStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = 14 * vfx;
          ctx.beginPath(); ctx.arc(px, py, thick * 1.4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.80)";
          ctx.shadowBlur = 0;
          ctx.beginPath(); ctx.arc(px - thick * 0.35, py - thick * 0.35, thick * 0.55, 0, Math.PI * 2); ctx.fill();
        } else if (b.type === "FROST") {
          // 프로스트: 그라디언트 얼음 빔 + 크리스탈 점
          const trailLen = Math.max(0.05, prog);
          const tx = b.x1 + (b.x2 - b.x1) * Math.max(0, prog - 0.30);
          const ty = b.y1 + (b.y2 - b.y1) * Math.max(0, prog - 0.30);
          const grad = ctx.createLinearGradient(tx, ty, px, py);
          grad.addColorStop(0, "rgba(116,192,252,0)");
          grad.addColorStop(1, b.color);
          ctx.strokeStyle = grad; ctx.lineWidth = thick;
          ctx.shadowColor = b.color; ctx.shadowBlur = 12 * vfx;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke();
          // 크리스탈 끝점
          ctx.save(); ctx.translate(px, py);
          const ang = Math.atan2(b.y2 - b.y1, b.x2 - b.x1);
          ctx.rotate(ang);
          ctx.fillStyle = "#c5f6fa"; ctx.shadowColor = "#74c0fc"; ctx.shadowBlur = 16 * vfx;
          ctx.beginPath();
          ctx.moveTo(thick * 1.6, 0); ctx.lineTo(0, -thick * 0.9); ctx.lineTo(-thick * 0.5, 0); ctx.lineTo(0, thick * 0.9);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        } else {
          // 기본: 그라디언트 궤적 + 빛나는 탄두
          const tx = b.x1 + (b.x2 - b.x1) * Math.max(0, prog - 0.25);
          const ty = b.y1 + (b.y2 - b.y1) * Math.max(0, prog - 0.25);
          const grad = ctx.createLinearGradient(tx, ty, px, py);
          grad.addColorStop(0, "rgba(0,0,0,0)");
          grad.addColorStop(1, b.color);
          ctx.strokeStyle = grad; ctx.lineWidth = thick;
          ctx.shadowColor = b.color; ctx.shadowBlur = 12 * vfx;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke();
          // 탄두 점
          ctx.fillStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = 18 * vfx;
          ctx.beginPath(); ctx.arc(px, py, thick * 1.2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.90)"; ctx.shadowBlur = 0;
          ctx.beginPath(); ctx.arc(px, py, thick * 0.52, 0, Math.PI * 2); ctx.fill();
        }

        // 착탄 플래시 (prog > 0.82)
        if (prog > 0.82) {
          const flashA = (prog - 0.82) / 0.18;
          ctx.globalAlpha = flashA * 0.75 * vfx;
          ctx.fillStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = 24 * vfx;
          ctx.beginPath(); ctx.arc(b.x2, b.y2, thick * (2.8 + flashA * 2.2), 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        }

        ctx.restore();
      }
      // ── 임팩트 링 (중세 문장(紋章) 스타일 틱마크 포함) ──
      for (const r of state.rings) {
        const lifeT = r.crit ? 0.32 : 0.22;
        const a = clamp(r.t / lifeT, 0, 1);
        ctx.save();
        ctx.globalAlpha = a * vfx;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.crit ? 2.8 : 1.8;
        ctx.shadowColor = r.color;
        ctx.shadowBlur = (r.crit ? 18 : 10) * vfx;
        // 메인 링
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
        // 방사형 틱마크 (중세 방패/문장 느낌)
        const tickN = r.crit ? 8 : 6;
        ctx.lineWidth = r.crit ? 1.8 : 1.2;
        ctx.shadowBlur = 0;
        ctx.globalAlpha = a * 0.70 * vfx;
        for (let i = 0; i < tickN; i++) {
          const ang = (i / tickN) * Math.PI * 2;
          const rIn = r.r * 1.10, rOut = r.r * (r.crit ? 1.30 : 1.24);
          ctx.beginPath();
          ctx.moveTo(r.x + Math.cos(ang) * rIn, r.y + Math.sin(ang) * rIn);
          ctx.lineTo(r.x + Math.cos(ang) * rOut, r.y + Math.sin(ang) * rOut);
          ctx.stroke();
        }
        ctx.restore();
      }

      // ── 퍼프 파티클: spark=true → 속도 방향 늘어난 불꽃 선 ──
      for (const p of state.puffs) {
        const a = clamp(p.t / (p.life || 0.65), 0, 1);
        ctx.save();
        ctx.globalAlpha = a * a * 0.95 * vfx;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8 * vfx;
        if (p.spark) {
          // 속도 방향으로 늘어난 금속 스파크 선
          const spd = Math.hypot(p.vx, p.vy);
          const len = Math.max(4, spd * 0.055);
          ctx.lineWidth = p.r * 0.85;
          ctx.lineCap = "round";
          ctx.beginPath();
          const nx = spd > 0 ? p.vx / spd : 0, ny = spd > 0 ? p.vy / spd : 0;
          ctx.moveTo(p.x - nx * len, p.y - ny * len);
          ctx.lineTo(p.x + nx * len * 0.4, p.y + ny * len * 0.4);
          ctx.stroke();
          // 스파크 선두 밝은 점
          ctx.globalAlpha = a * 0.90 * vfx;
          ctx.shadowBlur = 14 * vfx;
          ctx.fillStyle = "rgba(255,255,200,0.90)";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.55, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      // ── ×자 임팩트 슬래시 마크 (크릿 / 캐논 타격) ──
      for (const s of state.slashes) {
        const a = clamp(s.t / s.life, 0, 1);
        const sz = s.size * (0.40 + 0.60 * a); // 등장→빠르게 수축
        ctx.save();
        ctx.globalAlpha = a * vfx;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2.2 + a * 1.2;
        ctx.lineCap = "round";
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 14 * vfx;
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        // × 두 획
        ctx.beginPath(); ctx.moveTo(-sz, -sz); ctx.lineTo(sz, sz); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sz, -sz); ctx.lineTo(-sz, sz); ctx.stroke();
        // 흰색 중심 하이라이트
        ctx.strokeStyle = "rgba(255,255,255,0.60)";
        ctx.lineWidth = 1.0;
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(-sz*0.35,-sz*0.35); ctx.lineTo(sz*0.35,sz*0.35); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sz*0.35,-sz*0.35); ctx.lineTo(-sz*0.35,sz*0.35); ctx.stroke();
        ctx.restore();
      }
    }
    const nowS=perfNow()/1000;
    for (const f of state.floaters) {
      const life=f.life||0.85; const a=clamp(f.t/life,0,1); const p=clamp((life-f.t)/life,0,1);
      const popDur=0.12; const popT=clamp((life-f.t)/popDur,0,1); const popScale=1+(1-popT)*(f.crit?0.60:0.25);
      let dx=0,dy=0;
      if (f.shake) { const j=(1-p)*3.5; dx=Math.sin(nowS*45+(f.seed||0))*j; dy=Math.cos(nowS*38+(f.seed||0)*1.7)*j; }
      ctx.save(); ctx.globalAlpha=a*DMG_FLOATERS_INTENSITY; ctx.translate(f.x+dx,f.y+dy); ctx.scale(popScale,popScale);
      ctx.font=`${f.crit?900:800} ${f.size}px ui-sans-serif, system-ui`; ctx.textAlign="center"; ctx.textBaseline="middle";
      // 크릿: 황금색 + 두꺼운 검정 아웃라인
      const outlineW = f.crit ? 4 : 2;
      ctx.lineWidth=outlineW; ctx.strokeStyle="rgba(0,0,0,0.72)"; ctx.strokeText(f.text,0,0);
      ctx.fillStyle=f.color;
      ctx.shadowColor= f.crit ? "rgba(200,150,0,0.80)" : "rgba(0,0,0,0.55)";
      ctx.shadowBlur=(f.crit?16:8)*DMG_FLOATERS_INTENSITY; ctx.fillText(f.text,0,0);
      // 크릿: 황금 글로우 두 번째 패스 (더 밝게)
      if (f.crit) {
        ctx.globalAlpha = a * 0.45 * DMG_FLOATERS_INTENSITY;
        ctx.fillStyle = "rgba(255,240,100,0.90)";
        ctx.shadowColor = "rgba(255,220,0,0.90)";
        ctx.shadowBlur = 22 * DMG_FLOATERS_INTENSITY;
        ctx.fillText(f.text,0,0);
      }
      ctx.restore();
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

    // HUD 배경 패널 (좌상단)
    if (!state.gameOver) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      roundRect(ctx, x0 - 6, y0 - 5, 380, 60, 10); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    if (state.gameOver) {
      ctx.fillText(`GAME OVER  (Stage ${state.stage})`,x0,y0);
    } else if (state.roundPhase==="PREP") {
      ctx.fillText(`준비 중... ${Math.ceil(state.prepTimer)}s`,x0,y0);
      ctx.fillText(`다음: ${isBossRound(state.stage)?"보스전":"일반 라운드"}${waveLabel}`,x0,y0+18);
      ctx.fillStyle="rgba(255,255,255,0.60)"; ctx.font="600 12px ui-sans-serif, system-ui";
      ctx.fillText(`${shiftText} · ${hotText}`,x0,y0+38);

      // ✅ 준비 카운트다운 원형 게이지
      drawPrepCountdown();
    } else if (state.wave) {
      const ww=state.wave;
      const pageText=ww.page<ww.pages?`${ww.page+1}/${ww.pages}`:`${ww.pages}/${ww.pages}`;
      if (wt!==WAVE_TYPE.NORMAL&&wtInfo) {
        ctx.fillStyle=wtInfo.color;
        ctx.shadowColor=wtInfo.color; ctx.shadowBlur=10;
        ctx.fillText(`${getWaveTypeIcon(wt)} ${wtInfo.name} Wave (${pageText})  Alive ${state.enemies.length}`,x0,y0);
        ctx.shadowBlur=0; ctx.fillStyle="rgba(255,255,255,0.80)";
      } else {
        ctx.fillText(`Wave: ${pageText}  (Alive ${state.enemies.length})`,x0,y0);
      }
      if (ww.boss) { ctx.fillStyle="rgba(255,107,107,0.90)"; ctx.fillText(`BOSS: ${ww.bossSpawned?"등장":"대기"}`,x0,y0+18); ctx.fillStyle="rgba(255,255,255,0.80)"; }
      ctx.fillStyle="rgba(255,255,255,0.60)"; ctx.font="600 12px ui-sans-serif, system-ui";
      ctx.fillText(`${shiftText} · ${hotText}`,x0,y0+(ww.boss?38:18));

      // ✅ 웨이브 진행률 바
      drawWaveProgressBar(ww, wt, wtInfo);
    }

    // ✅ 코어 HP 바 (하단)
    drawCoreHpBar();

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

  // ✅ 웨이브 진행률 바 (화면 하단)
  function drawWaveProgressBar(ww, wt, wtInfo) {
    const barW=logical.w*0.50, barH=8, barX=(logical.w-barW)/2, barY=logical.h-18;
    const spawned=ww.totalSpawned||0, total=ww.totalToSpawn||1;
    const killed=Math.max(0, spawned-state.enemies.length);
    const progress=clamp(killed/total, 0, 1);
    const spawnProgress=clamp(spawned/total, 0, 1);

    ctx.save();
    // 배경
    ctx.fillStyle="rgba(0,0,0,0.40)";
    roundRect(ctx, barX, barY, barW, barH, 4); ctx.fill();
    // 스폰 진행 (연한)
    const spawnColor = (wt!==WAVE_TYPE.NORMAL&&wtInfo) ? `${wtInfo.color}30` : "rgba(255,255,255,0.10)";
    ctx.fillStyle=spawnColor;
    roundRect(ctx, barX, barY, barW*spawnProgress, barH, 4); ctx.fill();
    // 처치 진행 (밝은)
    const killColor = (wt!==WAVE_TYPE.NORMAL&&wtInfo) ? `${wtInfo.color}BB` : "rgba(99,230,190,0.80)";
    ctx.fillStyle=killColor;
    roundRect(ctx, barX, barY, barW*progress, barH, 4); ctx.fill();
    // 테두리
    ctx.strokeStyle="rgba(255,255,255,0.15)"; ctx.lineWidth=1;
    roundRect(ctx, barX, barY, barW, barH, 4); ctx.stroke();
    // 텍스트
    ctx.fillStyle="rgba(255,255,255,0.75)"; ctx.font="700 10px ui-sans-serif, system-ui";
    ctx.textAlign="center"; ctx.textBaseline="bottom";
    ctx.fillText(`${killed}/${total} 처치`, logical.w/2, barY-3);
    ctx.restore();
  }

  // ✅ 코어 HP 바 (우측 상단)
  function drawCoreHpBar() {
    if (state.gameOver) return;
    const barW=120, barH=10, barX=logical.w-barW-14, barY=14;
    const hpPct=clamp(state.coreHp/(state.coreHpMax||20), 0, 1);
    const low=hpPct<0.35;

    ctx.save();
    // 배경
    ctx.fillStyle="rgba(0,0,0,0.45)";
    roundRect(ctx, barX, barY, barW, barH, 5); ctx.fill();
    // HP 바 (위험하면 빨강, 안전하면 초록)
    const hpColor = low ? "rgba(255,107,107,0.90)" : hpPct<0.65 ? "rgba(255,212,59,0.85)" : "rgba(99,230,190,0.85)";
    if (low) { ctx.shadowColor="rgba(255,107,107,0.50)"; ctx.shadowBlur=8; }
    ctx.fillStyle=hpColor;
    roundRect(ctx, barX, barY, barW*hpPct, barH, 5); ctx.fill();
    ctx.shadowBlur=0;
    // 테두리
    ctx.strokeStyle="rgba(255,255,255,0.18)"; ctx.lineWidth=1;
    roundRect(ctx, barX, barY, barW, barH, 5); ctx.stroke();
    // 텍스트
    ctx.fillStyle="rgba(255,255,255,0.90)"; ctx.font="800 10px ui-sans-serif, system-ui";
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(`HP ${state.coreHp}/${state.coreHpMax}`, barX+barW/2, barY+barH/2+1);
    ctx.restore();
  }

  // ✅ 준비 카운트다운 원형 게이지
  function drawPrepCountdown() {
    const cx=logical.w/2, cy=logical.h/2;
    const r=40;
    const prepMax=state.prepBase||3.0;
    const progress=clamp(1-state.prepTimer/prepMax, 0, 1);

    ctx.save();
    ctx.globalAlpha=0.65;
    // 배경 원
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.fillStyle="rgba(0,0,0,0.30)"; ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,0.12)"; ctx.lineWidth=4; ctx.stroke();
    // 진행 아크
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2+progress*Math.PI*2);
    ctx.strokeStyle="rgba(99,230,190,0.85)"; ctx.lineWidth=4;
    ctx.shadowColor="rgba(99,230,190,0.45)"; ctx.shadowBlur=8;
    ctx.stroke();
    ctx.shadowBlur=0;
    // 카운트다운 숫자
    ctx.globalAlpha=0.88;
    ctx.fillStyle="rgba(255,255,255,0.92)"; ctx.font="900 28px ui-sans-serif, system-ui";
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(String(Math.ceil(state.prepTimer)), cx, cy+1);
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
${buildKeyboardShortcutHelpHTML()}
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
    if (!inMenu) hideContextMenus({ buyMenu, tooltip, state });
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.defaultPrevented || ev.repeat) return;
    const active = document.activeElement;
    const typing = !!active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
    if (typing) return;

    const key = String(ev.key || "").toLowerCase();
    if (key === "h") {
      if (helpOverlay.classList.contains("hidden")) openHelp(); else closeHelp();
      ev.preventDefault();
      return;
    }
    if (key === "k") {
      if (skillOverlay && skillOverlay.classList.contains("hidden")) openSkillTree(); else closeSkillTree();
      ev.preventDefault();
      return;
    }
    if (key === "f") {
      toggleVfx(state, saveBoolLS, LS_KEY_VFX, syncTopUI);
      ev.preventDefault();
      return;
    }
    if (key === "tab") {
      cycleSpeed(state, syncTopUI);
      ev.preventDefault();
      return;
    }
    if (key === " " || key === "spacebar") {
      togglePause(state, syncTopUI);
      ev.preventDefault();
      return;
    }
    if (key === "escape") {
      if (helpOverlay && !helpOverlay.classList.contains("hidden")) closeHelp();
      if (skillOverlay && !skillOverlay.classList.contains("hidden")) closeSkillTree();
      hideContextMenus({ buyMenu, tooltip, state });
    }
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

  speedBtn.addEventListener("click",()=>cycleSpeed(state, syncTopUI));

  if (vfxBtn) vfxBtn.addEventListener("click",()=>toggleVfx(state, saveBoolLS, LS_KEY_VFX, syncTopUI));

  if (pauseBtn) pauseBtn.addEventListener("click",()=>togglePause(state, syncTopUI));

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
