// Lotto TD - Meta Skill Tree (persistent)
// v1: 12 tiers, 3 branches, each skill 0~10 level.

export const META_STORAGE_KEY = "lotto_td_meta_v1";
export const META_VERSION = 1;

export const SKILL_TIER_MAX = 12;
export const SKILL_MAX_LEVEL = 10;

export const SKILL_BRANCHES = [
  { id: "OFF", name: "파괴", col: 0 },
  { id: "CTL", name: "제어", col: 1 },
  { id: "GMB", name: "도박", col: 2 },
];

// Effect kinds used by computeSkillMods()
// - Values are designed to be readable and safe; balance can be tuned later.

function pct(v) {
  return v; // already in 0~1
}

export const SKILL_NODES = (() => {
  const nodes = [];

  // OFFENSE
  nodes.push({ id: "off_1", tier: 1, col: 0, name: "화력 예열", desc: "모든 타워 공격력 +0.8%/레벨", effect: { kind: "DMG_PCT", perLevel: pct(0.008) }, parents: [] });
  nodes.push({ id: "off_2", tier: 2, col: 0, name: "보스 사냥꾼", desc: "보스에게 주는 피해 +1.0%/레벨", effect: { kind: "BOSS_DMG_PCT", perLevel: pct(0.010) }, parents: ["off_1"] });
  nodes.push({ id: "off_3", tier: 3, col: 0, name: "치명 훈련", desc: "치명타 확률 +0.35%p/레벨", effect: { kind: "CRIT_CHANCE_ADD", perLevel: 0.0035 }, parents: ["off_2"] });
  nodes.push({ id: "off_4", tier: 4, col: 0, name: "치명 강화", desc: "치명타 배율 +0.03/레벨", effect: { kind: "CRIT_MULT_ADD", perLevel: 0.03 }, parents: ["off_3"] });
  nodes.push({ id: "off_5", tier: 5, col: 0, name: "화력 과급", desc: "모든 타워 공격력 +1.0%/레벨", effect: { kind: "DMG_PCT", perLevel: pct(0.010) }, parents: ["off_4"] });
  nodes.push({ id: "off_6", tier: 6, col: 0, name: "엘리트 분쇄", desc: "엘리트에게 주는 피해 +1.0%/레벨", effect: { kind: "ELITE_DMG_PCT", perLevel: pct(0.010) }, parents: ["off_5"] });
  nodes.push({ id: "off_7", tier: 7, col: 0, name: "압박 폭주", desc: "적 진행도에 비례해 주는 피해(최대치) +1.0%/레벨", effect: { kind: "PRESSURE_DMG_PCT", perLevel: pct(0.010) }, parents: ["off_6"] });
  nodes.push({ id: "off_8", tier: 8, col: 0, name: "처형 전문가", desc: "적 체력이 35% 이하일 때 주는 피해 +1.5%/레벨", effect: { kind: "EXECUTE_DMG_PCT", perLevel: pct(0.015) }, parents: ["off_7"] });
  nodes.push({ id: "off_9", tier: 9, col: 0, name: "초과 화력", desc: "모든 타워 공격력 +1.2%/레벨", effect: { kind: "DMG_PCT", perLevel: pct(0.012) }, parents: ["off_8"] });
  nodes.push({ id: "off_10", tier: 10, col: 0, name: "보스 분쇄", desc: "보스에게 주는 피해 +1.5%/레벨", effect: { kind: "BOSS_DMG_PCT", perLevel: pct(0.015) }, parents: ["off_9"] });
  nodes.push({ id: "off_11", tier: 11, col: 0, name: "치명 감각", desc: "치명타 확률 +0.40%p/레벨", effect: { kind: "CRIT_CHANCE_ADD", perLevel: 0.0040 }, parents: ["off_10"] });
  nodes.push({ id: "off_12", tier: 12, col: 0, name: "치명 폭발", desc: "치명타 배율 +0.04/레벨", effect: { kind: "CRIT_MULT_ADD", perLevel: 0.04 }, parents: ["off_11"] });

  // CONTROL
  nodes.push({ id: "ctl_1", tier: 1, col: 1, name: "오토 서보", desc: "모든 타워 쿨다운 -0.6%/레벨", effect: { kind: "CD_REDUCE_PCT", perLevel: pct(0.006) }, parents: [] });
  // no-range: replace "사거리" with a light universal cooldown improvement
  nodes.push({ id: "ctl_2", tier: 2, col: 1, name: "표적 시스템", desc: "모든 타워 쿨다운 -0.3%/레벨", effect: { kind: "CD_REDUCE_PCT", perLevel: pct(0.003) }, parents: ["ctl_1"] });
  nodes.push({ id: "ctl_3", tier: 3, col: 1, name: "HOT 가속", desc: "HOT(공속) 보너스 +0.4%p/레벨", effect: { kind: "HOT_ASPD_ADD", perLevel: pct(0.004) }, parents: ["ctl_2"] });
  nodes.push({ id: "ctl_4", tier: 4, col: 1, name: "HOT 치명", desc: "HOT(치명) 보너스 +0.2%p/레벨", effect: { kind: "HOT_CRIT_ADD", perLevel: 0.002 }, parents: ["ctl_3"] });
  nodes.push({ id: "ctl_5", tier: 5, col: 1, name: "둔화 증폭", desc: "슬로우 효과 +1.0%/레벨", effect: { kind: "SLOW_POWER", perLevel: pct(0.010) }, parents: ["ctl_4"] });
  nodes.push({ id: "ctl_6", tier: 6, col: 1, name: "코어 강화", desc: "코어 HP +0.6/레벨 (합산 후 반올림 적용)", effect: { kind: "CORE_HP_ADD", perLevel: 0.6 }, parents: ["ctl_5"] });
  nodes.push({ id: "ctl_7", tier: 7, col: 1, name: "준비 단축", desc: "준비시간 -0.05초/레벨", effect: { kind: "PREP_REDUCE", perLevel: 0.05 }, parents: ["ctl_6"] });
  // Armor/Penetration system (vFX03): global penetration helps vs high-armor elites/bosses.
  nodes.push({ id: "ctl_8", tier: 8, col: 1, name: "장갑 관통", desc: "모든 타워 관통력 +0.18/레벨", effect: { kind: "PEN_ADD", perLevel: 0.18 }, parents: ["ctl_7"] });
  nodes.push({ id: "ctl_9", tier: 9, col: 1, name: "서보 과급", desc: "모든 타워 쿨다운 -0.8%/레벨", effect: { kind: "CD_REDUCE_PCT", perLevel: pct(0.008) }, parents: ["ctl_8"] });
  nodes.push({ id: "ctl_10", tier: 10, col: 1, name: "서보 오버클럭", desc: "모든 타워 쿨다운 -0.25%/레벨", effect: { kind: "CD_REDUCE_PCT", perLevel: pct(0.0025) }, parents: ["ctl_9"] });
  nodes.push({ id: "ctl_11", tier: 11, col: 1, name: "HOT 확장", desc: "HOT 칸 +1 (레벨 10에서)", effect: { kind: "HOT_COUNT_ADD", perLevel: 0.1 }, parents: ["ctl_10"] });
  nodes.push({ id: "ctl_12", tier: 12, col: 1, name: "코어 방벽", desc: "코어 피해 -1%/레벨 (최대 -30%)", effect: { kind: "CORE_DMG_MUL", perLevel: pct(0.010) }, parents: ["ctl_11"] });

  // GAMBLE
  nodes.push({ id: "gmb_1", tier: 1, col: 2, name: "시드머니", desc: "시작 일반 티켓 +0.5/레벨 (합산 후 반올림 적용)", effect: { kind: "START_COMMON_ADD", perLevel: 0.5 }, parents: [] });
  nodes.push({ id: "gmb_2", tier: 2, col: 2, name: "등급 승급", desc: "뽑기/리롤 등급이 1단계 오를 확률 +0.6%/레벨", effect: { kind: "RARITY_UP_CHANCE", perLevel: pct(0.006) }, parents: ["gmb_1"] });
  nodes.push({ id: "gmb_3", tier: 3, col: 2, name: "리롤 환급", desc: "리롤 시 일반 티켓 환급 확률 +0.4%/레벨", effect: { kind: "REROLL_REFUND_CHANCE", perLevel: pct(0.004) }, parents: ["gmb_2"] });
  nodes.push({ id: "gmb_4", tier: 4, col: 2, name: "BONUS 과급", desc: "연속 리롤 BONUS 베스트오브 +1 (레벨 5/10에서)", effect: { kind: "STREAK_BESTOF_BONUS", perLevel: 0.2 }, parents: ["gmb_3"] });
  nodes.push({ id: "gmb_5", tier: 5, col: 2, name: "추가 수익", desc: "스테이지 보상(일반) +1 확률 +3%/레벨", effect: { kind: "EXTRA_COMMON_CHANCE", perLevel: pct(0.03) }, parents: ["gmb_4"] });
  nodes.push({ id: "gmb_6", tier: 6, col: 2, name: "레어 수익", desc: "스테이지 보상(레어) +1 확률 +2%/레벨", effect: { kind: "EXTRA_RARE_CHANCE", perLevel: pct(0.02) }, parents: ["gmb_5"] });
  nodes.push({ id: "gmb_7", tier: 7, col: 2, name: "보스 배당", desc: "보스 처치 시 전설 +1 확률 +3%/레벨", effect: { kind: "BOSS_EXTRA_LEGEND_CHANCE", perLevel: pct(0.03) }, parents: ["gmb_6"] });
  nodes.push({ id: "gmb_8", tier: 8, col: 2, name: "전설리롤 할인", desc: "전설리롤 일반 티켓 비용 -1 (레벨 3/6/9에서)", effect: { kind: "LEGEND_REROLL_DISCOUNT", perLevel: 0.34 }, parents: ["gmb_7"] });
  nodes.push({ id: "gmb_9", tier: 9, col: 2, name: "스타팅 레어", desc: "시작 레어 티켓 +0.15/레벨 (합산 후 반올림 적용)", effect: { kind: "START_RARE_ADD", perLevel: 0.15 }, parents: ["gmb_8"] });
  nodes.push({ id: "gmb_10", tier: 10, col: 2, name: "스타팅 전설", desc: "시작 전설 티켓 +0.08/레벨 (합산 후 반올림 적용)", effect: { kind: "START_LEGEND_ADD", perLevel: 0.08 }, parents: ["gmb_9"] });
  nodes.push({ id: "gmb_11", tier: 11, col: 2, name: "스페셜 환급", desc: "SPECIAL PICK 후 일반 티켓 +1 확률 +5%/레벨 (최대 50%)", effect: { kind: "SPECIAL_REFUND_CHANCE", perLevel: pct(0.05) }, parents: ["gmb_10"] });
  nodes.push({ id: "gmb_12", tier: 12, col: 2, name: "잭팟", desc: "신화 획득 시 전설 티켓 +1 확률 +6%/레벨 (최대 70%)", effect: { kind: "MYTHIC_JACKPOT_CHANCE", perLevel: pct(0.06) }, parents: ["gmb_11"] });

  return nodes;
})();

export function defaultMetaState() {
  return {
    v: META_VERSION,
    xp: 0,
    skills: {},
  };
}

export function loadMetaState() {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return defaultMetaState();
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return defaultMetaState();
    const out = defaultMetaState();
    out.v = META_VERSION;
    out.xp = Math.max(0, Math.floor(obj.xp ?? 0));
    out.skills = (obj.skills && typeof obj.skills === "object") ? obj.skills : {};

    // normalize levels
    for (const n of SKILL_NODES) {
      const lv = out.skills[n.id] ?? 0;
      out.skills[n.id] = clampInt(lv, 0, SKILL_MAX_LEVEL);
    }

    return out;
  } catch {
    return defaultMetaState();
  }
}

export function saveMetaState(meta) {
  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

export function getSkillLevel(meta, id) {
  return clampInt(meta?.skills?.[id] ?? 0, 0, SKILL_MAX_LEVEL);
}

export function tierSpent(meta, tier) {
  if (!meta?.skills) return 0;
  let s = 0;
  for (const n of SKILL_NODES) {
    if (n.tier !== tier) continue;
    s += clampInt(meta.skills[n.id] ?? 0, 0, SKILL_MAX_LEVEL);
  }
  return s;
}

export function totalSpent(meta) {
  if (!meta?.skills) return 0;
  let s = 0;
  for (const n of SKILL_NODES) s += clampInt(meta.skills[n.id] ?? 0, 0, SKILL_MAX_LEVEL);
  return s;
}

// Maple-ish gating: to access tier T, you must have at least 1 level somewhere in tier T-1
export function isTierUnlocked(meta, tier) {
  if (tier <= 1) return true;
  return tierSpent(meta, tier - 1) >= 1;
}

export function areParentsSatisfied(meta, node) {
  const ps = node.parents || [];
  if (ps.length === 0) return true;
  for (const pid of ps) {
    if (getSkillLevel(meta, pid) < 1) return false;
  }
  return true;
}

export function canUpgradeSkill(meta, node) {
  const cur = getSkillLevel(meta, node.id);
  if (cur >= SKILL_MAX_LEVEL) return { ok: false, reason: "MAX" };
  if (!isTierUnlocked(meta, node.tier)) return { ok: false, reason: "TIER_LOCK" };
  if (!areParentsSatisfied(meta, node)) return { ok: false, reason: "PARENT_LOCK" };
  const cost = skillUpgradeCost(node, cur);
  if ((meta?.xp ?? 0) < cost) return { ok: false, reason: "NO_XP" };
  return { ok: true, cost };
}

// XP cost grows by tier and by level.
export function skillUpgradeCost(node, curLevel) {
  const tier = clampInt(node.tier ?? 1, 1, SKILL_TIER_MAX);
  const lvl = clampInt(curLevel ?? 0, 0, SKILL_MAX_LEVEL);

  // base cost (tier-based)
  const base = 18 + tier * 12 + Math.floor(Math.pow(tier, 1.22) * 6);
  // level scaling
  const scale = 1 + lvl * 0.14;
  return Math.max(1, Math.round(base * scale));
}

export function computeSkillMods(meta) {
  const skills = meta?.skills || {};

  const mods = {
    dmgPct: 0,
    bossDmgPct: 0,
    eliteDmgPct: 0,
    pressureDmgPct: 0,
    executeDmgPct: 0,

    critChanceAdd: 0,
    critMultAdd: 0,

    cdReducePct: 0,

    hotAspdAdd: 0,
    hotCritAdd: 0,
    hotCountAdd: 0,

    slowPower: 0,
    prepReduceSec: 0,

    // armor/penetration
    penAdd: 0,

    coreHpAdd: 0,
    coreDmgMul: 1,

    enemyHpMul: 1,

    startCommonAdd: 0,
    startRareAdd: 0,
    startLegendAdd: 0,

    rarityUpChance: 0,
    rerollRefundChance: 0,

    streakBestOfBonus: 0,

    extraCommonChance: 0,
    extraRareChance: 0,
    bossExtraLegendChance: 0,

    legendRerollDiscount: 0,

    specialRefundChance: 0,
    mythicJackpotChance: 0,
  };

  for (const node of SKILL_NODES) {
    const lv = clampInt(skills[node.id] ?? 0, 0, SKILL_MAX_LEVEL);
    if (lv <= 0) continue;

    const e = node.effect;
    if (!e) continue;

    const v = (e.perLevel ?? 0) * lv;
    switch (e.kind) {
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
      case "HOT_COUNT_ADD": mods.hotCountAdd += (lv >= 10 ? 1 : 0); break;

      case "SLOW_POWER": mods.slowPower += v; break;
      case "PREP_REDUCE": mods.prepReduceSec += v; break;

      case "PEN_ADD": mods.penAdd += v; break;

      case "CORE_HP_ADD": mods.coreHpAdd += v; break;
      case "CORE_DMG_MUL": mods.coreDmgMul *= clamp(1 - v, 0.70, 1.0); break;

      case "ENEMY_HP_MUL": mods.enemyHpMul *= clamp(1 - v, 0.80, 1.0); break;

      case "START_COMMON_ADD": mods.startCommonAdd += v; break;
      case "START_RARE_ADD": mods.startRareAdd += v; break;
      case "START_LEGEND_ADD": mods.startLegendAdd += v; break;

      case "RARITY_UP_CHANCE": mods.rarityUpChance += v; break;
      case "REROLL_REFUND_CHANCE": mods.rerollRefundChance += v; break;

      case "STREAK_BESTOF_BONUS": mods.streakBestOfBonus += (lv >= 10 ? 2 : (lv >= 5 ? 1 : 0)); break;

      case "EXTRA_COMMON_CHANCE": mods.extraCommonChance += v; break;
      case "EXTRA_RARE_CHANCE": mods.extraRareChance += v; break;
      case "BOSS_EXTRA_LEGEND_CHANCE": mods.bossExtraLegendChance += v; break;

      case "LEGEND_REROLL_DISCOUNT": mods.legendRerollDiscount += Math.floor(lv / 3); break;

      case "SPECIAL_REFUND_CHANCE": mods.specialRefundChance += v; break;
      case "MYTHIC_JACKPOT_CHANCE": mods.mythicJackpotChance += v; break;
      default: break;
    }
  }

  // caps
  mods.cdReducePct = clamp(mods.cdReducePct, 0, 0.45);
  mods.critChanceAdd = clamp(mods.critChanceAdd, 0, 0.25);
  mods.rarityUpChance = clamp(mods.rarityUpChance, 0, 0.18);
  mods.rerollRefundChance = clamp(mods.rerollRefundChance, 0, 0.20);
  mods.extraCommonChance = clamp(mods.extraCommonChance, 0, 0.80);
  mods.extraRareChance = clamp(mods.extraRareChance, 0, 0.60);
  mods.bossExtraLegendChance = clamp(mods.bossExtraLegendChance, 0, 0.80);
  mods.specialRefundChance = clamp(mods.specialRefundChance, 0, 0.50);
  mods.mythicJackpotChance = clamp(mods.mythicJackpotChance, 0, 0.70);

  mods.pressureDmgPct = clamp(mods.pressureDmgPct, 0, 0.35);

  mods.slowPower = clamp(mods.slowPower, 0, 0.35);
  mods.prepReduceSec = clamp(mods.prepReduceSec, 0, 0.60);

  return mods;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function clampInt(v, a, b) {
  v = Math.floor(Number(v) || 0);
  return Math.max(a, Math.min(b, v));
}
