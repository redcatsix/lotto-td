// Lotto TD - Persistent Passive Node System (PoE-inspired)

export const META_STORAGE_KEY = "lotto_td_meta_v2";
export const META_VERSION = 2;

export const SKILL_TIER_MAX = 8;
export const SKILL_MAX_LEVEL = 5;

export const SKILL_BRANCHES = [
  { id: "OFF", name: "파괴", col: 0 },
  { id: "CTL", name: "제어", col: 1 },
  { id: "GMB", name: "행운", col: 2 },
];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function clampInt(v, a, b) { v = Math.floor(Number(v) || 0); return Math.max(a, Math.min(b, v)); }

function makeNode({ id, name, desc, group, ring, angle, effect, notable = false, keystone = false, start = false }) {
  const radius = [0, 90, 150, 210, 270, 330][ring] ?? 0;
  return {
    id,
    name,
    desc,
    effect,
    group,
    ring,
    angle,
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    parents: [],
    notable,
    keystone,
    start,
  };
}

function buildPassiveNodes() {
  const nodes = [];
  nodes.push(makeNode({ id: "core_start", name: "중심 의지", desc: "패시브 트리 시작점", group: "CORE", ring: 0, angle: 0, effect: { kind: "DMG_PCT", perLevel: 0.004 }, start: true }));

  const groups = [
    { key: "OFF", name: "파괴", base: 0, effects: ["DMG_PCT", "BOSS_DMG_PCT", "CRIT_CHANCE_ADD", "CRIT_MULT_ADD", "ELITE_DMG_PCT", "EXECUTE_DMG_PCT"] },
    { key: "CTL", name: "제어", base: Math.PI * 2 / 3, effects: ["CD_REDUCE_PCT", "SLOW_POWER", "PEN_ADD", "HOT_ASPD_ADD", "HOT_CRIT_ADD", "CORE_DMG_MUL"] },
    { key: "GMB", name: "행운", base: Math.PI * 4 / 3, effects: ["RARITY_UP_CHANCE", "REROLL_REFUND_CHANCE", "EXTRA_COMMON_CHANCE", "EXTRA_RARE_CHANCE", "START_COMMON_ADD", "START_RARE_ADD"] },
  ];

  let idx = 0;
  for (const g of groups) {
    for (let ring = 1; ring <= 5; ring++) {
      const count = ring <= 2 ? 4 : ring <= 4 ? 5 : 6;
      for (let i = 0; i < count; i++) {
        const t = (i / count - 0.5) * 0.9;
        const angle = g.base + t;
        const effectKind = g.effects[(ring + i) % g.effects.length];
        const notable = ring >= 3 && i === Math.floor(count / 2);
        const keystone = ring === 5 && i === count - 1;

        const perLevel = {
          DMG_PCT: 0.008,
          BOSS_DMG_PCT: 0.010,
          CRIT_CHANCE_ADD: 0.0025,
          CRIT_MULT_ADD: 0.025,
          ELITE_DMG_PCT: 0.010,
          EXECUTE_DMG_PCT: 0.012,
          CD_REDUCE_PCT: 0.006,
          SLOW_POWER: 0.008,
          PEN_ADD: 0.10,
          HOT_ASPD_ADD: 0.004,
          HOT_CRIT_ADD: 0.0018,
          CORE_DMG_MUL: 0.008,
          RARITY_UP_CHANCE: 0.004,
          REROLL_REFUND_CHANCE: 0.004,
          EXTRA_COMMON_CHANCE: 0.016,
          EXTRA_RARE_CHANCE: 0.012,
          START_COMMON_ADD: 0.35,
          START_RARE_ADD: 0.12,
        }[effectKind] ?? 0.004;

        nodes.push(makeNode({
          id: `p_${g.key.toLowerCase()}_${ring}_${i}`,
          name: `${g.name} 노드 ${ring}-${i + 1}`,
          desc: `${g.name} 계열 능력치를 강화합니다.`,
          group: g.key,
          ring,
          angle,
          effect: { kind: effectKind, perLevel },
          notable,
          keystone,
        }));
        idx++;
      }
    }
  }

  const byGroup = new Map();
  for (const n of nodes) {
    if (!byGroup.has(n.group)) byGroup.set(n.group, []);
    byGroup.get(n.group).push(n);
  }

  for (const [group, arr] of byGroup.entries()) {
    if (group === "CORE") continue;
    const byRing = new Map();
    for (const n of arr) {
      if (!byRing.has(n.ring)) byRing.set(n.ring, []);
      byRing.get(n.ring).push(n);
    }
    for (const list of byRing.values()) list.sort((a, b) => a.angle - b.angle);

    for (let ring = 1; ring <= 5; ring++) {
      const list = byRing.get(ring) || [];
      const prev = byRing.get(ring - 1) || [];
      for (let i = 0; i < list.length; i++) {
        const cur = list[i];
        const left = list[(i - 1 + list.length) % list.length];
        const right = list[(i + 1) % list.length];
        if (left?.id && left.id !== cur.id) cur.parents.push(left.id);
        if (right?.id && right.id !== cur.id) cur.parents.push(right.id);
        if (ring === 1) {
          cur.parents.push("core_start");
        } else if (prev.length > 0) {
          const j = Math.floor((i / list.length) * prev.length);
          cur.parents.push(prev[j].id);
        }
      }
    }
  }

  for (const n of nodes) n.parents = [...new Set(n.parents)];
  return nodes;
}

export const SKILL_NODES = buildPassiveNodes();
const NODE_MAP = new Map(SKILL_NODES.map((n) => [n.id, n]));

export function defaultMetaState() {
  const skills = {};
  for (const n of SKILL_NODES) skills[n.id] = 0;
  skills.core_start = 1;
  return { v: META_VERSION, xp: 0, skills };
}

export function loadMetaState() {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return defaultMetaState();
    const obj = JSON.parse(raw);
    const out = defaultMetaState();
    out.xp = Math.max(0, Math.floor(obj?.xp ?? 0));
    if (obj?.skills && typeof obj.skills === "object") {
      for (const n of SKILL_NODES) out.skills[n.id] = clampInt(obj.skills[n.id] ?? out.skills[n.id], 0, SKILL_MAX_LEVEL);
    }
    out.skills.core_start = Math.max(1, out.skills.core_start ?? 1);
    return out;
  } catch {
    return defaultMetaState();
  }
}

export function saveMetaState(meta) {
  try { localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta)); } catch {}
}

export function getSkillLevel(meta, id) { return clampInt(meta?.skills?.[id] ?? 0, 0, SKILL_MAX_LEVEL); }

export function tierSpent(meta, tier) {
  let s = 0;
  for (const n of SKILL_NODES) if (n.ring === tier) s += getSkillLevel(meta, n.id);
  return s;
}

export function totalSpent(meta) {
  let s = 0;
  for (const n of SKILL_NODES) s += getSkillLevel(meta, n.id);
  return s;
}

export function isTierUnlocked() { return true; }

export function areParentsSatisfied(meta, node) {
  if (node.start) return true;
  const ps = node.parents || [];
  for (const pid of ps) if (getSkillLevel(meta, pid) >= 1) return true;
  return false;
}

export function skillUpgradeCost(node, curLevel) {
  const ring = clampInt(node?.ring ?? 1, 0, 6);
  const lvl = clampInt(curLevel ?? 0, 0, SKILL_MAX_LEVEL);
  const mult = node?.notable ? 1.35 : node?.keystone ? 1.75 : 1;
  return Math.max(1, Math.round((18 + ring * 16 + lvl * 12) * mult));
}

export function canUpgradeSkill(meta, node) {
  const cur = getSkillLevel(meta, node.id);
  if (cur >= SKILL_MAX_LEVEL) return { ok: false, reason: "MAX" };
  if (!areParentsSatisfied(meta, node)) return { ok: false, reason: "PARENT_LOCK" };
  const cost = skillUpgradeCost(node, cur);
  if ((meta?.xp ?? 0) < cost) return { ok: false, reason: "NO_XP" };
  return { ok: true, cost };
}

export function computeSkillMods(meta) {
  const mods = {
    dmgPct: 0, bossDmgPct: 0, eliteDmgPct: 0, pressureDmgPct: 0, executeDmgPct: 0,
    critChanceAdd: 0, critMultAdd: 0, cdReducePct: 0, hotAspdAdd: 0, hotCritAdd: 0, hotCountAdd: 0,
    slowPower: 0, prepReduceSec: 0, penAdd: 0, coreHpAdd: 0, coreDmgMul: 1, enemyHpMul: 1,
    startCommonAdd: 0, startRareAdd: 0, startLegendAdd: 0, rarityUpChance: 0, rerollRefundChance: 0,
    streakBestOfBonus: 0, extraCommonChance: 0, extraRareChance: 0, bossExtraLegendChance: 0,
    legendRerollDiscount: 0, specialRefundChance: 0, mythicJackpotChance: 0,
  };

  for (const node of SKILL_NODES) {
    const lv = getSkillLevel(meta, node.id);
    if (lv <= 0 || !node.effect) continue;
    const v = (node.effect.perLevel ?? 0) * lv;
    switch (node.effect.kind) {
      case "DMG_PCT": mods.dmgPct += v; break;
      case "BOSS_DMG_PCT": mods.bossDmgPct += v; break;
      case "ELITE_DMG_PCT": mods.eliteDmgPct += v; break;
      case "PRESSURE_DMG_PCT": mods.pressureDmgPct += v; break;
      case "EXECUTE_DMG_PCT": mods.executeDmgPct += v; break;
      case "CRIT_CHANCE_ADD": mods.critChanceAdd += v; break;
      case "CRIT_MULT_ADD": mods.critMultAdd += v; break;
      case "CD_REDUCE_PCT": mods.cdReducePct += v; break;
      case "HOT_ASPD_ADD": mods.hotAspdAdd += v; break;
      case "HOT_CRIT_ADD": mods.hotCritAdd += v; break;
      case "SLOW_POWER": mods.slowPower += v; break;
      case "PREP_REDUCE": mods.prepReduceSec += v; break;
      case "PEN_ADD": mods.penAdd += v; break;
      case "CORE_HP_ADD": mods.coreHpAdd += v; break;
      case "CORE_DMG_MUL": mods.coreDmgMul *= clamp(1 - v, 0.65, 1.0); break;
      case "ENEMY_HP_MUL": mods.enemyHpMul *= clamp(1 - v, 0.80, 1.0); break;
      case "START_COMMON_ADD": mods.startCommonAdd += v; break;
      case "START_RARE_ADD": mods.startRareAdd += v; break;
      case "START_LEGEND_ADD": mods.startLegendAdd += v; break;
      case "RARITY_UP_CHANCE": mods.rarityUpChance += v; break;
      case "REROLL_REFUND_CHANCE": mods.rerollRefundChance += v; break;
      case "EXTRA_COMMON_CHANCE": mods.extraCommonChance += v; break;
      case "EXTRA_RARE_CHANCE": mods.extraRareChance += v; break;
      case "BOSS_EXTRA_LEGEND_CHANCE": mods.bossExtraLegendChance += v; break;
      case "LEGEND_REROLL_DISCOUNT": mods.legendRerollDiscount += Math.floor(lv / 3); break;
      case "SPECIAL_REFUND_CHANCE": mods.specialRefundChance += v; break;
      case "MYTHIC_JACKPOT_CHANCE": mods.mythicJackpotChance += v; break;
      default: break;
    }
  }

  mods.cdReducePct = clamp(mods.cdReducePct, 0, 0.45);
  mods.critChanceAdd = clamp(mods.critChanceAdd, 0, 0.30);
  mods.rarityUpChance = clamp(mods.rarityUpChance, 0, 0.20);
  mods.rerollRefundChance = clamp(mods.rerollRefundChance, 0, 0.25);
  mods.extraCommonChance = clamp(mods.extraCommonChance, 0, 0.80);
  mods.extraRareChance = clamp(mods.extraRareChance, 0, 0.60);
  mods.bossExtraLegendChance = clamp(mods.bossExtraLegendChance, 0, 0.80);
  mods.specialRefundChance = clamp(mods.specialRefundChance, 0, 0.50);
  mods.mythicJackpotChance = clamp(mods.mythicJackpotChance, 0, 0.70);
  mods.slowPower = clamp(mods.slowPower, 0, 0.35);
  mods.prepReduceSec = clamp(mods.prepReduceSec, 0, 0.6);

  return mods;
}
