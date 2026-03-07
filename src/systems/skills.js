// Lotto TD - POE-style Passive Skill Tree (v3)
// 완전 개편: 방사형 15 키스톤 + 65 노드

export const META_STORAGE_KEY = "lotto_td_meta_v3";
export const META_VERSION = 3;

export const NODE_TYPE = {
  START:    "start",
  REGULAR:  "regular",
  NOTABLE:  "notable",
  KEYSTONE: "keystone",
};

export const NODE_REGION = {
  CENTER: "CENTER",
  ATK:    "ATK",   // 빨강: 공격/속도
  LUCK:   "LUCK",  // 금색: 행운/도박
  DEF:    "DEF",   // 파랑: 방어/제어
  HUNT:   "HUNT",  // 보라: 사냥/관통
};

export const NODE_COST = {
  start:    0,
  regular:  25,
  notable:  65,
  keystone: 175,
};

export const TREE_W = 1800;
export const TREE_H = 1800;

export const REGION_COLOR = {
  CENTER: "#ffffff",
  ATK:    "#ff6b6b",
  LUCK:   "#ffd43b",
  DEF:    "#74c0fc",
  HUNT:   "#cc5de8",
};

const CX = 900, CY = 900;

function bp(angleDeg, r) {
  // angle 0 = top, clockwise
  const rad = angleDeg * Math.PI / 180;
  return { x: Math.round(CX + r * Math.sin(rad)), y: Math.round(CY - r * Math.cos(rad)) };
}

function getRegionGlyph(region) {
  switch (region) {
    case NODE_REGION.ATK:  return "◈";
    case NODE_REGION.LUCK: return "◇";
    case NODE_REGION.DEF:  return "◫";
    case NODE_REGION.HUNT: return "◆";
    default: return "·";
  }
}

function buildNodes() {
  const nodes = [];
  function add(id, pos, type, name, desc, effect, conns, region, glyph) {
    nodes.push({ id, x: pos.x, y: pos.y, type, name, desc, effect,
      connections: conns, region, glyph: glyph || "·" });
  }

  const N = 15;
  const R_GATE  = 215;
  const R_NOT   = 390;
  const R_PREKS = 515;
  const R_KS    = 635;

  // ── START ────────────────────────────────────────────────────────────────
  const allGates = Array.from({ length: N }, (_, i) => `g${i}`);
  add("start", { x: CX, y: CY }, NODE_TYPE.START,
    "시작점", "패시브 트리의 중심.\n모든 경로의 시작점입니다.",
    null, allGates, NODE_REGION.CENTER, "◉");

  // ── BRANCH DEFINITIONS ───────────────────────────────────────────────────
  // Each branch: angle, key, region, ks, not, preks, gate
  const branchDefs = [
    // 0: 0° (top) ─ 공격력
    { angle:   0, key:"dmg",   region: NODE_REGION.ATK,
      ks:    { name:"파괴의 망치",     desc:"공격력 +35%\n부작용: HOT 공속 -10%",       effect:{ kind:"KS_HEAVYBLADE", dmg:0.35, aspdPenalty:0.10 }, glyph:"⚔" },
      not:   { name:"화력 집중",       desc:"공격력 +6% · 보스 피해 +3%",               effect:{ kind:"DMG_BOSS",       dmg:0.06, boss:0.03 },        glyph:"⚔" },
      preks: { name:"폭발적 화력",     desc:"공격력 +2.5%",                             effect:{ kind:"DMG_PCT",        value:0.025 } },
      gate:  { name:"화력 기초",       desc:"공격력 +2%",                               effect:{ kind:"DMG_PCT",        value:0.02  } } },

    // 1: 24° ─ 크리티컬
    { angle:  24, key:"crit",  region: NODE_REGION.ATK,
      ks:    { name:"크리티컬 폭발",   desc:"치명 배율 +0.50\n부작용: 치명 확률 -12%",  effect:{ kind:"KS_CRIT",        mult:0.50, chancePenalty:0.12 }, glyph:"✦" },
      not:   { name:"치명 마스터",     desc:"치명 확률 +2% · 배율 +0.10",              effect:{ kind:"CRIT_COMBO",     chance:0.02, mult:0.10 },        glyph:"✦" },
      preks: { name:"치명 집중",       desc:"치명 배율 +0.06",                          effect:{ kind:"CRIT_MULT_ADD",  value:0.06 } },
      gate:  { name:"급소 타격",       desc:"치명타 확률 +1%",                          effect:{ kind:"CRIT_CHANCE_ADD",value:0.01 } } },

    // 2: 48° ─ 다중연사
    { angle:  48, key:"multi", region: NODE_REGION.ATK,
      ks:    { name:"다중 연사",       desc:"다중공격 확률 +35%\n부작용: 공격력 -15%",   effect:{ kind:"KS_MULTISHOT",   multi:0.35, dmgPenalty:0.15 }, glyph:"⁂" },
      not:   { name:"연속 사격",       desc:"다중공격 확률 +10% · 공격력 +2%",          effect:{ kind:"MULTI_DMG",      multi:0.10, dmg:0.02 },         glyph:"⁂" },
      preks: { name:"사격 집중",       desc:"다중공격 확률 +6%",                        effect:{ kind:"MULTI_HIT_CHANCE",value:0.06 } },
      gate:  { name:"연속 준비",       desc:"다중공격 확률 +4%",                        effect:{ kind:"MULTI_HIT_CHANCE",value:0.04 } } },

    // 3: 72° ─ 공속
    { angle:  72, key:"aspd",  region: NODE_REGION.ATK,
      ks:    { name:"공속의 폭풍",     desc:"HOT 공속 +30%\n부작용: 기본 피해 -15%",    effect:{ kind:"KS_ASPD",        aspd:0.30, dmgPenalty:0.15 }, glyph:"≫" },
      not:   { name:"속공 마스터",     desc:"HOT 공속 +8% · HOT 치명 +3%",             effect:{ kind:"HOT_MASTER",     aspd:0.08, crit:0.03 },        glyph:"≫" },
      preks: { name:"HOT 과부하",      desc:"HOT 공속 +5%",                             effect:{ kind:"HOT_ASPD_ADD",   value:0.05 } },
      gate:  { name:"HOT 안정화",      desc:"HOT 공속 +3%",                             effect:{ kind:"HOT_ASPD_ADD",   value:0.03 } } },

    // 4: 96° ─ 광폭화
    { angle:  96, key:"bsrk",  region: NODE_REGION.ATK,
      ks:    { name:"광폭화",          desc:"공격력 +20% · HOT 공속 +15%\n부작용: 코어 HP -3", effect:{ kind:"KS_BERSERK", dmg:0.20, aspd:0.15, corePenalty:3 }, glyph:"▲" },
      not:   { name:"전투 광기",       desc:"공격력 +4% · HOT 공속 +5%",               effect:{ kind:"DMG_ASPD",       dmg:0.04, aspd:0.05 },           glyph:"▲" },
      preks: { name:"야성 해방",       desc:"공격력 +2% · HOT 공속 +3%",               effect:{ kind:"DMG_ASPD",       dmg:0.02, aspd:0.03 } },
      gate:  { name:"야성의 힘",       desc:"공격력 +1.5%",                             effect:{ kind:"DMG_PCT",        value:0.015 } } },

    // 5: 120° ─ 인생역전
    { angle: 120, key:"rev",   region: NODE_REGION.LUCK,
      ks:    { name:"인생역전",        desc:"등급업 +18%\n부작용: 쿨다운 효율 -8%",     effect:{ kind:"KS_REVERSAL",    rarity:0.18, cdPenalty:0.08 },  glyph:"✧" },
      not:   { name:"도박사의 감각",   desc:"등급업 +5% · 환급 확률 +3%",              effect:{ kind:"GAMBLER",        rarity:0.05, refund:0.03 },      glyph:"✧" },
      preks: { name:"고위험 베팅",     desc:"등급업 +3%",                              effect:{ kind:"RARITY_UP_ADD",  value:0.03 } },
      gate:  { name:"행운 체인",       desc:"등급업 +2%",                              effect:{ kind:"RARITY_UP_ADD",  value:0.02 } } },

    // 6: 144° ─ 백만장자
    { angle: 144, key:"gold",  region: NODE_REGION.LUCK,
      ks:    { name:"백만장자",        desc:"레어 티켓 +3\n부작용: 일반 티켓 -5",       effect:{ kind:"KS_MILLIONAIRE", rare:3, commonPenalty:5 },        glyph:"◆" },
      not:   { name:"황금 손길",       desc:"레어 티켓 +1 · 등급업 +2%",               effect:{ kind:"GOLD_RARE",      rare:1, rarity:0.02 },            glyph:"◆" },
      preks: { name:"금고 열쇠",       desc:"레어 티켓 +1",                             effect:{ kind:"START_RARE_ADD", value:1 } },
      gate:  { name:"재투자",          desc:"일반 티켓 +1",                             effect:{ kind:"START_COMMON_ADD",value:1 } } },

    // 7: 168° ─ 연쇄반응
    { angle: 168, key:"chain", region: NODE_REGION.LUCK,
      ks:    { name:"연쇄 반응",       desc:"보스 전설 +20% · 신화 잭팟 +10%",          effect:{ kind:"KS_CHAIN",       bossLeg:0.20, mythic:0.10 },    glyph:"∞" },
      not:   { name:"연금술사",        desc:"보스 전설 +6% · 신화 잭팟 +5%",           effect:{ kind:"CHAIN_MASTER",   bossLeg:0.06, mythic:0.05 },    glyph:"∞" },
      preks: { name:"황금 계획",       desc:"보스 전설 +4%",                            effect:{ kind:"BOSS_EXTRA_LEGEND_CHANCE", value:0.04 } },
      gate:  { name:"행운 배가",       desc:"보스 전설 +3%",                            effect:{ kind:"BOSS_EXTRA_LEGEND_CHANCE", value:0.03 } } },

    // 8: 192° ─ 빙결의 군주
    { angle: 192, key:"frost", region: NODE_REGION.DEF,
      ks:    { name:"빙결의 군주",     desc:"둔화 +40%\n부작용: 공격력 -12%",           effect:{ kind:"KS_FROST",       slow:0.40, dmgPenalty:0.12 },   glyph:"❄" },
      not:   { name:"서리 마스터",     desc:"둔화 +10% · 관통 +0.2",                   effect:{ kind:"SLOW_PEN",       slow:0.10, pen:0.2 },            glyph:"❄" },
      preks: { name:"빙결 강화",       desc:"둔화 +8%",                                 effect:{ kind:"SLOW_POWER",     value:0.08 } },
      gate:  { name:"냉기 기초",       desc:"둔화 +5%",                                 effect:{ kind:"SLOW_POWER",     value:0.05 } } },

    // 9: 216° ─ 불굴의 요새
    { angle: 216, key:"fort",  region: NODE_REGION.DEF,
      ks:    { name:"불굴의 요새",     desc:"코어 HP +15\n부작용: 공격력 -20%",         effect:{ kind:"KS_FORTRESS",    hp:15, dmgPenalty:0.20 },        glyph:"⬡" },
      not:   { name:"철옹성",          desc:"코어 HP +3 · 코어 피해 -8%",               effect:{ kind:"CORE_FORTRESS",  hp:3,  dmgReduce:0.08 },          glyph:"⬡" },
      preks: { name:"요새 심화",       desc:"코어 HP +2",                               effect:{ kind:"CORE_HP_ADD",    value:2 } },
      gate:  { name:"코어 보강",       desc:"코어 HP +1",                               effect:{ kind:"CORE_HP_ADD",    value:1 } } },

    // 10: 240° ─ 찰나의 사수
    { angle: 240, key:"cd",    region: NODE_REGION.DEF,
      ks:    { name:"찰나의 사수",     desc:"쿨다운 -25%\n부작용: 공격력 -15%",         effect:{ kind:"KS_FLASH",       cd:0.25, dmgPenalty:0.15 },     glyph:"⟳" },
      not:   { name:"서보 오버클럭",   desc:"쿨다운 -4% · HOT 공속 +4%",               effect:{ kind:"CDR_HOT",        cd:0.04, aspd:0.04 },            glyph:"⟳" },
      preks: { name:"극한 냉각",       desc:"쿨다운 -2.5%",                             effect:{ kind:"CD_REDUCE_PCT",  value:0.025 } },
      gate:  { name:"자동 서보",       desc:"쿨다운 -2%",                               effect:{ kind:"CD_REDUCE_PCT",  value:0.02 } } },

    // 11: 264° ─ 관통의 화살
    { angle: 264, key:"pen",   region: NODE_REGION.HUNT,
      ks:    { name:"관통의 화살",     desc:"관통 +1.5\n부작용: 공격력 -12%",           effect:{ kind:"KS_PEN",         pen:1.5, dmgPenalty:0.12 },     glyph:"↣" },
      not:   { name:"장갑 파쇄",       desc:"관통 +0.5 · 압박 피해 +5%",               effect:{ kind:"PEN_PRESSURE",   pen:0.5, pressure:0.05 },        glyph:"↣" },
      preks: { name:"관통 심화",       desc:"관통 +0.3",                                effect:{ kind:"PEN_ADD",        value:0.3 } },
      gate:  { name:"관통 훈련",       desc:"관통 +0.2",                                effect:{ kind:"PEN_ADD",        value:0.2 } } },

    // 12: 288° ─ 처형자의 검
    { angle: 288, key:"exec",  region: NODE_REGION.HUNT,
      ks:    { name:"처형자의 검",     desc:"처형 피해 +30%\n부작용: 기본 공격력 -10%", effect:{ kind:"KS_EXECUTE",     execute:0.30, dmgPenalty:0.10 }, glyph:"†" },
      not:   { name:"냉혹한 사냥꾼",   desc:"처형 피해 +8% · 보스 피해 +3%",           effect:{ kind:"EXEC_BOSS",      execute:0.08, boss:0.03 },      glyph:"†" },
      preks: { name:"처형 강화",       desc:"처형 피해 +5%",                            effect:{ kind:"EXECUTE_DMG_PCT",value:0.05 } },
      gate:  { name:"처형 훈련",       desc:"처형 피해 +4%",                            effect:{ kind:"EXECUTE_DMG_PCT",value:0.04 } } },

    // 13: 312° ─ 엘리트 분쇄기
    { angle: 312, key:"elit",  region: NODE_REGION.HUNT,
      ks:    { name:"엘리트 분쇄기",   desc:"엘리트 피해 +25%\n부작용: 보스 피해 -8%", effect:{ kind:"KS_ELITE",       elite:0.25, bossPenalty:0.08 },  glyph:"★" },
      not:   { name:"정밀 사격",       desc:"엘리트 피해 +6% · 보스 피해 +2%",         effect:{ kind:"BOSS_ELITE",     elite:0.06, boss:0.02 },          glyph:"★" },
      preks: { name:"엘리트 분석",     desc:"엘리트 피해 +4%",                          effect:{ kind:"ELITE_DMG_PCT",  value:0.04 } },
      gate:  { name:"엘리트 추적",     desc:"엘리트 피해 +2.5%",                        effect:{ kind:"ELITE_DMG_PCT",  value:0.025 } } },

    // 14: 336° ─ 보스 학살자
    { angle: 336, key:"boss",  region: NODE_REGION.HUNT,
      ks:    { name:"보스 학살자",     desc:"보스 피해 +25%\n부작용: 엘리트 피해 -8%",  effect:{ kind:"KS_BOSS",        boss:0.25, elitePenalty:0.08 },  glyph:"♔" },
      not:   { name:"강습 공격",       desc:"보스 피해 +6% · 공격력 +2%",              effect:{ kind:"BOSS_DMG_DMG",   boss:0.06, dmg:0.02 },           glyph:"♔" },
      preks: { name:"보스 분쇄",       desc:"보스 피해 +4%",                            effect:{ kind:"BOSS_DMG_PCT",   value:0.04 } },
      gate:  { name:"보스 사냥",       desc:"보스 피해 +2%",                            effect:{ kind:"BOSS_DMG_PCT",   value:0.02 } } },
  ];

  // ── Generate branch nodes ────────────────────────────────────────────────
  for (let i = 0; i < branchDefs.length; i++) {
    const b  = branchDefs[i];
    const pv = (i + N - 1) % N;
    const nx = (i + 1) % N;

    const gateId  = `g${i}`;
    const notId   = `n${i}`;
    const preksId = `pk${i}`;
    const ksId    = `ks_${b.key}`;

    const gatePos  = bp(b.angle, R_GATE);
    const notPos   = bp(b.angle, R_NOT);
    const preksPos = bp(b.angle, R_PREKS);
    const ksPos    = bp(b.angle, R_KS);

    add(gateId,  gatePos,  NODE_TYPE.REGULAR,
      b.gate.name, b.gate.desc, b.gate.effect,
      ["start", `g${pv}`, `g${nx}`, notId],
      b.region, getRegionGlyph(b.region));

    add(notId,   notPos,   NODE_TYPE.NOTABLE,
      b.not.name, b.not.desc, b.not.effect,
      [gateId, preksId],
      b.region, b.not.glyph);

    add(preksId, preksPos, NODE_TYPE.REGULAR,
      b.preks.name, b.preks.desc, b.preks.effect,
      [notId, ksId],
      b.region, getRegionGlyph(b.region));

    add(ksId,    ksPos,    NODE_TYPE.KEYSTONE,
      b.ks.name, b.ks.desc, b.ks.effect,
      [preksId],
      b.region, b.ks.glyph);
  }

  // ── Bridge nodes between regions ────────────────────────────────────────
  // ATK↔LUCK (between i=4/96° and i=5/120° → 108°)
  add("bridge_atk_luck", bp(108, 310), NODE_TYPE.REGULAR,
    "행운의 전사",  "공격력 +2% · 등급업 +2%",
    { kind:"DMG_RARITY", dmg:0.02, rarity:0.02 },
    ["g4", "g5"], NODE_REGION.LUCK, "⚡");

  // LUCK↔DEF (between i=7/168° and i=8/192° → 180°)
  add("bridge_luck_def", bp(180, 310), NODE_TYPE.REGULAR,
    "방어 계략",   "쿨다운 -1.5% · 등급업 +1%",
    { kind:"CD_LUCK", cd:0.015, rarity:0.01 },
    ["g7", "g8"], NODE_REGION.DEF, "⬟");

  // DEF↔HUNT (between i=10/240° and i=11/264° → 252°)
  add("bridge_def_hunt", bp(252, 310), NODE_TYPE.REGULAR,
    "수호의 창",   "관통 +0.2 · 쿨다운 -1.5%",
    { kind:"PEN_CD", pen:0.2, cd:0.015 },
    ["g10", "g11"], NODE_REGION.HUNT, "⬟");

  // HUNT↔ATK (between i=14/336° and i=0/0° → 348°)
  add("bridge_hunt_atk", bp(348, 310), NODE_TYPE.REGULAR,
    "공략 마스터", "공격력 +2% · 보스 피해 +2%",
    { kind:"DMG_BOSS_COMBO", dmg:0.02, boss:0.02 },
    ["g14", "g0"], NODE_REGION.ATK, "⬟");

  return nodes;
}

export const PASSIVE_NODES    = buildNodes();
export const PASSIVE_NODE_MAP = new Map(PASSIVE_NODES.map(n => [n.id, n]));

// ─── State management ────────────────────────────────────────────────────────

export function defaultMetaState() {
  return { v: META_VERSION, xp: 0, allocated: [] };
}

export function loadMetaState() {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && obj.v === META_VERSION) {
        const out = defaultMetaState();
        out.xp        = Math.max(0, Math.floor(obj.xp ?? 0));
        out.allocated = Array.isArray(obj.allocated)
          ? obj.allocated.filter(id => PASSIVE_NODE_MAP.has(id))
          : [];
        return out;
      }
    }
    // Migrate from any older version: preserve XP, reset nodes
    const keys = ["lotto_td_meta_v2", "lotto_td_meta_v1"];
    for (const k of keys) {
      const legacy = localStorage.getItem(k);
      if (legacy) {
        const obj = JSON.parse(legacy);
        const xp  = Math.max(0, Math.floor(obj?.xp ?? 0));
        return { v: META_VERSION, xp, allocated: [] };
      }
    }
  } catch { /* ignore */ }
  return defaultMetaState();
}

export function saveMetaState(meta) {
  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify({
      v:         META_VERSION,
      xp:        meta.xp ?? 0,
      allocated: meta.allocated ?? [],
    }));
  } catch { /* ignore */ }
}

export function isAllocated(meta, id) {
  return (meta.allocated ?? []).includes(id);
}

export function canAllocate(meta, nodeId) {
  const node = PASSIVE_NODE_MAP.get(nodeId);
  if (!node) return { ok: false, reason: "NOT_FOUND" };
  if (node.type === NODE_TYPE.START) return { ok: false, reason: "START" };
  if (isAllocated(meta, nodeId)) return { ok: false, reason: "ALREADY" };

  const cost = NODE_COST[node.type] ?? 25;
  if ((meta.xp ?? 0) < cost) return { ok: false, reason: "NO_XP", cost };

  const allocSet = new Set(meta.allocated ?? []);
  allocSet.add("start");
  const connected = node.connections.some(id => allocSet.has(id));
  if (!connected) return { ok: false, reason: "NOT_CONNECTED", cost };

  return { ok: true, cost };
}

export function allocateNode(meta, nodeId) {
  const chk = canAllocate(meta, nodeId);
  if (!chk.ok) return false;
  meta.xp = Math.max(0, (meta.xp ?? 0) - chk.cost);
  if (!Array.isArray(meta.allocated)) meta.allocated = [];
  if (!meta.allocated.includes(nodeId)) meta.allocated.push(nodeId);
  return true;
}

/** 환불 가능 여부: 제거해도 나머지 노드가 여전히 start에 연결되어야 함 */
export function canDeallocate(meta, nodeId) {
  if (!isAllocated(meta, nodeId)) return { ok: false, reason: "NOT_ALLOCATED" };
  if (nodeId === "start") return { ok: false, reason: "START" };

  const remaining    = (meta.allocated ?? []).filter(id => id !== nodeId);
  const remainingSet = new Set(remaining);
  remainingSet.add("start");

  // BFS from start through remaining allocated nodes
  const visited = new Set(["start"]);
  const queue   = ["start"];
  while (queue.length > 0) {
    const cur  = queue.shift();
    const node = PASSIVE_NODE_MAP.get(cur);
    if (!node) continue;
    for (const connId of (node.connections || [])) {
      if (!visited.has(connId) && remainingSet.has(connId)) {
        visited.add(connId);
        queue.push(connId);
      }
    }
  }

  for (const id of remaining) {
    if (!visited.has(id)) return { ok: false, reason: "WOULD_DISCONNECT" };
  }

  const cost = NODE_COST[PASSIVE_NODE_MAP.get(nodeId)?.type ?? "regular"];
  return { ok: true, cost };
}

export function deallocateNode(meta, nodeId) {
  const chk = canDeallocate(meta, nodeId);
  if (!chk.ok) return false;
  meta.allocated = (meta.allocated ?? []).filter(id => id !== nodeId);
  meta.xp        = (meta.xp ?? 0) + chk.cost; // 전액 환불
  return true;
}

export function canAllocateAny(meta) {
  for (const node of PASSIVE_NODES) {
    if (node.type === NODE_TYPE.START) continue;
    if (canAllocate(meta, node.id).ok) return true;
  }
  return false;
}

// ─── Modifier computation ────────────────────────────────────────────────────

export function computeSkillMods(meta) {
  const allocSet = new Set(meta.allocated ?? []);
  allocSet.add("start");

  const mods = {
    dmgPct:                0,
    bossDmgPct:            0,
    eliteDmgPct:           0,
    pressureDmgPct:        0,
    executeDmgPct:         0,

    critChanceAdd:         0,
    critMultAdd:           0,

    cdReducePct:           0,

    hotAspdAdd:            0,
    hotCritAdd:            0,

    multiHitChance:        0,

    slowPower:             0,
    penAdd:                0,

    coreHpAdd:             0,
    coreDmgMul:            1,

    startCommonAdd:        0,
    startRareAdd:          0,

    rarityUpChance:        0,
    rerollRefundChance:    0,
    specialRefundChance:   0,
    mythicJackpotChance:   0,
    bossExtraLegendChance: 0,
    extraRareChance:       0,
  };

  for (const node of PASSIVE_NODES) {
    if (!allocSet.has(node.id) || !node.effect) continue;
    const e = node.effect;

    switch (e.kind) {
      // ── Simple ──────────────────────────────────────────────────────────
      case "DMG_PCT":                  mods.dmgPct               += e.value; break;
      case "BOSS_DMG_PCT":             mods.bossDmgPct           += e.value; break;
      case "ELITE_DMG_PCT":            mods.eliteDmgPct          += e.value; break;
      case "PRESSURE_DMG_PCT":         mods.pressureDmgPct       += e.value; break;
      case "EXECUTE_DMG_PCT":          mods.executeDmgPct        += e.value; break;
      case "CRIT_CHANCE_ADD":          mods.critChanceAdd        += e.value; break;
      case "CRIT_MULT_ADD":            mods.critMultAdd          += e.value; break;
      case "HOT_ASPD_ADD":             mods.hotAspdAdd           += e.value; break;
      case "HOT_CRIT_ADD":             mods.hotCritAdd           += e.value; break;
      case "SLOW_POWER":               mods.slowPower            += e.value; break;
      case "PEN_ADD":                  mods.penAdd               += e.value; break;
      case "CORE_HP_ADD":              mods.coreHpAdd            += e.value; break;
      case "CORE_DMG_MUL":             mods.coreDmgMul           *= (1 - e.value); break;
      case "START_COMMON_ADD":         mods.startCommonAdd       += e.value; break;
      case "START_RARE_ADD":           mods.startRareAdd         += e.value; break;
      case "REROLL_REFUND_CHANCE":     mods.rerollRefundChance   += e.value; break;
      case "SPECIAL_REFUND_CHANCE":    mods.specialRefundChance  += e.value; break;
      case "MYTHIC_JACKPOT_CHANCE":    mods.mythicJackpotChance  += e.value; break;
      case "BOSS_EXTRA_LEGEND_CHANCE": mods.bossExtraLegendChance+= e.value; break;
      case "EXTRA_RARE_CHANCE":        mods.extraRareChance      += e.value; break;
      case "RARITY_UP_ADD":            mods.rarityUpChance       += e.value; break;
      case "MULTI_HIT_CHANCE":         mods.multiHitChance       += e.value; break;

      // ── Compound ────────────────────────────────────────────────────────
      case "HOT_MASTER":
        mods.hotAspdAdd  += e.aspd; mods.hotCritAdd    += e.crit; break;
      case "CRIT_COMBO":
        mods.critChanceAdd += e.chance; mods.critMultAdd += e.mult; break;
      case "DMG_BOSS":
        mods.dmgPct      += e.dmg;  mods.bossDmgPct    += e.boss; break;
      case "DMG_ASPD":
        mods.dmgPct      += e.dmg;  mods.hotAspdAdd    += e.aspd; break;
      case "MULTI_DMG":
        mods.multiHitChance += e.multi; mods.dmgPct    += e.dmg;  break;
      case "GAMBLER":
        mods.rarityUpChance += e.rarity; mods.rerollRefundChance += e.refund; break;
      case "GOLD_RARE":
        mods.startRareAdd+= e.rare; mods.rarityUpChance+= e.rarity; break;
      case "CHAIN_MASTER":
        mods.bossExtraLegendChance += e.bossLeg; mods.mythicJackpotChance += e.mythic; break;
      case "SLOW_PEN":
        mods.slowPower   += e.slow; mods.penAdd        += e.pen;  break;
      case "CORE_FORTRESS":
        mods.coreHpAdd   += e.hp;   mods.coreDmgMul   *= (1 - e.dmgReduce); break;
      case "CDR_HOT":
        mods.cdReducePct += e.cd;   mods.hotAspdAdd    += e.aspd; break;
      case "PEN_PRESSURE":
        mods.penAdd      += e.pen;  mods.pressureDmgPct+= e.pressure; break;
      case "EXEC_BOSS":
        mods.executeDmgPct += e.execute; mods.bossDmgPct += e.boss; break;
      case "BOSS_ELITE":
        mods.bossDmgPct  += e.boss; mods.eliteDmgPct   += e.elite; break;
      case "BOSS_DMG_DMG":
        mods.bossDmgPct  += e.boss; mods.dmgPct        += e.dmg;  break;
      case "DMG_RARITY":
        mods.dmgPct      += e.dmg;  mods.rarityUpChance+= e.rarity; break;
      case "CD_LUCK":
        mods.cdReducePct += e.cd;   mods.rarityUpChance+= e.rarity; break;
      case "PEN_CD":
        mods.penAdd      += e.pen;  mods.cdReducePct   += e.cd;   break;
      case "DMG_BOSS_COMBO":
        mods.dmgPct      += e.dmg;  mods.bossDmgPct    += e.boss; break;

      // ── Keystones ───────────────────────────────────────────────────────
      case "KS_HEAVYBLADE":
        mods.dmgPct      += e.dmg;  mods.hotAspdAdd    -= e.aspdPenalty; break;
      case "KS_CRIT":
        mods.critMultAdd += e.mult; mods.critChanceAdd -= e.chancePenalty; break;
      case "KS_MULTISHOT":
        mods.multiHitChance += e.multi; mods.dmgPct    -= e.dmgPenalty; break;
      case "KS_ASPD":
        mods.hotAspdAdd  += e.aspd; mods.dmgPct        -= e.dmgPenalty; break;
      case "KS_BERSERK":
        mods.dmgPct      += e.dmg;  mods.hotAspdAdd    += e.aspd;
        mods.coreHpAdd   -= e.corePenalty; break;
      case "KS_REVERSAL":
        mods.rarityUpChance += e.rarity; mods.cdReducePct -= e.cdPenalty; break;
      case "KS_MILLIONAIRE":
        mods.startRareAdd+= e.rare; mods.startCommonAdd-= e.commonPenalty; break;
      case "KS_CHAIN":
        mods.bossExtraLegendChance += e.bossLeg; mods.mythicJackpotChance += e.mythic; break;
      case "KS_FROST":
        mods.slowPower   += e.slow; mods.dmgPct        -= e.dmgPenalty; break;
      case "KS_FORTRESS":
        mods.coreHpAdd   += e.hp;   mods.dmgPct        -= e.dmgPenalty; break;
      case "KS_FLASH":
        mods.cdReducePct += e.cd;   mods.dmgPct        -= e.dmgPenalty; break;
      case "KS_PEN":
        mods.penAdd      += e.pen;  mods.dmgPct        -= e.dmgPenalty; break;
      case "KS_EXECUTE":
        mods.executeDmgPct += e.execute; mods.dmgPct  -= e.dmgPenalty; break;
      case "KS_ELITE":
        mods.eliteDmgPct += e.elite; mods.bossDmgPct  -= e.bossPenalty; break;
      case "KS_BOSS":
        mods.bossDmgPct  += e.boss; mods.eliteDmgPct   -= e.elitePenalty; break;

      default: break;
    }
  }

  // 상한/하한
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  mods.cdReducePct           = clamp(mods.cdReducePct,           -0.15, 0.45);
  mods.critChanceAdd         = clamp(mods.critChanceAdd,         -0.15, 0.30);
  mods.rarityUpChance        = clamp(mods.rarityUpChance,         0,    0.30);
  mods.rerollRefundChance    = clamp(mods.rerollRefundChance,     0,    0.30);
  mods.specialRefundChance   = clamp(mods.specialRefundChance,    0,    0.50);
  mods.mythicJackpotChance   = clamp(mods.mythicJackpotChance,    0,    0.70);
  mods.bossExtraLegendChance = clamp(mods.bossExtraLegendChance,  0,    0.80);
  mods.slowPower             = clamp(mods.slowPower,              0,    0.45);
  mods.coreDmgMul            = clamp(mods.coreDmgMul,             0.50, 1.0);
  mods.multiHitChance        = clamp(mods.multiHitChance,         0,    0.60);

  return mods;
}
