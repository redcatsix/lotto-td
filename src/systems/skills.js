// Lotto TD - POE-style Passive Skill Tree (v2)
// 방대한 패시브 노드 그래프 시스템

export const META_STORAGE_KEY = "lotto_td_meta_v2";
export const META_VERSION = 2;

export const NODE_TYPE = {
  START:    "start",
  REGULAR:  "regular",
  NOTABLE:  "notable",
  KEYSTONE: "keystone",
};

export const NODE_REGION = {
  CENTER: "CENTER",
  CTL:    "CTL",
  OFF:    "OFF",
  GMB:    "GMB",
};

// XP cost per node type
export const NODE_COST = {
  start:    0,
  regular:  30,
  notable:  75,
  keystone: 200,
};

// Canvas rendering constants
export const TREE_W = 700;
export const TREE_H = 700;

// Region colors
export const REGION_COLOR = {
  CENTER: "#ffffff",
  CTL:    "#74c0fc",
  OFF:    "#ff6b6b",
  GMB:    "#ffd43b",
};

function p(x, y) { return { x: Math.round(x), y: Math.round(y) }; }

// ─── Node definitions ───────────────────────────────────────────────────────
// 좌표계: 700×700 캔버스, center = (350, 360)
// 연결(connections): 인접 노드 ID 목록. 할당된 이웃 노드가 있으면 활성화 가능.

function buildNodes() {
  const nodes = [];
  function add(id, pos, type, name, desc, effect, conns, region) {
    nodes.push({ id, x: pos.x, y: pos.y, type, name, desc, effect, connections: conns, region });
  }

  // ── CENTER ──────────────────────────────────────────────────────────────
  add("start",
    p(350, 360), NODE_TYPE.START,
    "시작점", "패시브 트리의 중심. 항상 활성화됩니다.",
    null,
    ["ctl_gate", "off_gate", "gmb_gate"],
    NODE_REGION.CENTER);

  add("ctl_gate",
    p(350, 272), NODE_TYPE.REGULAR,
    "제어의 문", "쿨다운 -1.5%",
    { kind: "CD_REDUCE_PCT", value: 0.015 },
    ["start", "ctl_t1", "ctl_l1", "ctl_r1", "ctl_x1", "ctl_x2"],
    NODE_REGION.CTL);

  add("off_gate",
    p(279, 422), NODE_TYPE.REGULAR,
    "파괴의 문", "공격력 +1.5%",
    { kind: "DMG_PCT", value: 0.015 },
    ["start", "off_t1", "off_l1", "off_r1", "off_x1", "off_x2"],
    NODE_REGION.OFF);

  add("gmb_gate",
    p(421, 422), NODE_TYPE.REGULAR,
    "도박의 문", "일반 티켓 +1",
    { kind: "START_COMMON_ADD", value: 1 },
    ["start", "gmb_t1", "gmb_l1", "gmb_r1", "gmb_x1", "gmb_x2"],
    NODE_REGION.GMB);

  // ── CONTROL REGION (상단, 파랑) ─────────────────────────────────────────
  // 중앙 HOT/쿨다운 주간선
  add("ctl_t1",
    p(350, 222), NODE_TYPE.REGULAR,
    "자동 서보", "쿨다운 -1.5%",
    { kind: "CD_REDUCE_PCT", value: 0.015 },
    ["ctl_gate", "ctl_t2", "ctl_x1", "ctl_x2"],
    NODE_REGION.CTL);

  add("ctl_t2",
    p(350, 176), NODE_TYPE.NOTABLE,
    "HOT 마스터", "HOT 공속 +4% · HOT 치명 +2%",
    { kind: "HOT_MASTER", aspd: 0.04, crit: 0.02 },
    ["ctl_t1", "ctl_t3", "ctl_x3", "ctl_x4"],
    NODE_REGION.CTL);

  add("ctl_t3",
    p(350, 126), NODE_TYPE.NOTABLE,
    "표적 시스템", "쿨다운 -3% · 둔화 +5%",
    { kind: "CDR_SLOW", cd: 0.03, slow: 0.05 },
    ["ctl_t2", "ctl_x5", "ctl_x6"],
    NODE_REGION.CTL);

  // 왼쪽 쿨다운 경로
  add("ctl_l1",
    p(296, 233), NODE_TYPE.REGULAR,
    "기초 서보", "쿨다운 -1%",
    { kind: "CD_REDUCE_PCT", value: 0.01 },
    ["ctl_gate", "ctl_l2", "ctl_x1"],
    NODE_REGION.CTL);

  add("ctl_l2",
    p(246, 196), NODE_TYPE.REGULAR,
    "향상 서보", "쿨다운 -1.5%",
    { kind: "CD_REDUCE_PCT", value: 0.015 },
    ["ctl_l1", "ctl_l3", "ctl_x3"],
    NODE_REGION.CTL);

  add("ctl_l3",
    p(196, 162), NODE_TYPE.NOTABLE,
    "서보 오버클럭", "쿨다운 -4% · 관통력 +0.2",
    { kind: "CDR_PEN", cd: 0.04, pen: 0.2 },
    ["ctl_l2", "ctl_l4", "ctl_x7"],
    NODE_REGION.CTL);

  add("ctl_l4",
    p(152, 132), NODE_TYPE.REGULAR,
    "극한 서보", "쿨다운 -2%",
    { kind: "CD_REDUCE_PCT", value: 0.02 },
    ["ctl_l3", "ctl_lk"],
    NODE_REGION.CTL);

  add("ctl_lk",
    p(108, 104), NODE_TYPE.KEYSTONE,
    "찰나의 사수", "쿨다운 -22% · 타워 피해 -15%",
    { kind: "KS_FLASH", cd: 0.22, dmgPenalty: 0.15 },
    ["ctl_l4"],
    NODE_REGION.CTL);

  // 오른쪽 코어/HOT 경로
  add("ctl_r1",
    p(404, 233), NODE_TYPE.REGULAR,
    "코어 보강", "코어 HP +1",
    { kind: "CORE_HP_ADD", value: 1 },
    ["ctl_gate", "ctl_r2", "ctl_x2"],
    NODE_REGION.CTL);

  add("ctl_r2",
    p(454, 196), NODE_TYPE.REGULAR,
    "코어 강화", "코어 HP +1 · 둔화 +3%",
    { kind: "CORE_SLOW", hp: 1, slow: 0.03 },
    ["ctl_r1", "ctl_r3", "ctl_x4"],
    NODE_REGION.CTL);

  add("ctl_r3",
    p(504, 162), NODE_TYPE.NOTABLE,
    "철옹성", "코어 HP +3 · 코어 피해 -7%",
    { kind: "CORE_FORTRESS", hp: 3, dmgReduce: 0.07 },
    ["ctl_r2", "ctl_r4", "ctl_x8"],
    NODE_REGION.CTL);

  add("ctl_r4",
    p(550, 132), NODE_TYPE.REGULAR,
    "코어 방벽", "코어 피해 -5%",
    { kind: "CORE_DMG_MUL", value: 0.05 },
    ["ctl_r3", "ctl_rk"],
    NODE_REGION.CTL);

  add("ctl_rk",
    p(592, 104), NODE_TYPE.KEYSTONE,
    "불굴의 요새", "코어 HP +12 · 타워 피해 -20%",
    { kind: "KS_FORTRESS", hp: 12, dmgPenalty: 0.20 },
    ["ctl_r4"],
    NODE_REGION.CTL);

  // CTL 보조 연결 노드
  add("ctl_x1",
    p(313, 200), NODE_TYPE.REGULAR,
    "반응 향상", "쿨다운 -1%",
    { kind: "CD_REDUCE_PCT", value: 0.01 },
    ["ctl_gate", "ctl_t1", "ctl_l1"],
    NODE_REGION.CTL);

  add("ctl_x2",
    p(387, 200), NODE_TYPE.REGULAR,
    "HOT 안정화", "HOT 공속 +2%",
    { kind: "HOT_ASPD_ADD", value: 0.02 },
    ["ctl_gate", "ctl_t1", "ctl_r1"],
    NODE_REGION.CTL);

  add("ctl_x3",
    p(272, 152), NODE_TYPE.REGULAR,
    "냉각 장치", "쿨다운 -1%",
    { kind: "CD_REDUCE_PCT", value: 0.01 },
    ["ctl_l2", "ctl_t2"],
    NODE_REGION.CTL);

  add("ctl_x4",
    p(428, 152), NODE_TYPE.REGULAR,
    "HOT 증폭기", "HOT 치명 +2%",
    { kind: "HOT_CRIT_ADD", value: 0.02 },
    ["ctl_r2", "ctl_t2"],
    NODE_REGION.CTL);

  add("ctl_x5",
    p(308, 108), NODE_TYPE.REGULAR,
    "준비 단축", "준비 시간 -0.1초",
    { kind: "PREP_REDUCE", value: 0.1 },
    ["ctl_t3", "ctl_x7"],
    NODE_REGION.CTL);

  add("ctl_x6",
    p(392, 108), NODE_TYPE.REGULAR,
    "장갑 관통", "관통력 +0.2",
    { kind: "PEN_ADD", value: 0.2 },
    ["ctl_t3", "ctl_x8"],
    NODE_REGION.CTL);

  add("ctl_x7",
    p(224, 118), NODE_TYPE.REGULAR,
    "서보 보조", "쿨다운 -1.5%",
    { kind: "CD_REDUCE_PCT", value: 0.015 },
    ["ctl_l3", "ctl_x5"],
    NODE_REGION.CTL);

  add("ctl_x8",
    p(476, 118), NODE_TYPE.REGULAR,
    "방어 계층", "코어 피해 -3%",
    { kind: "CORE_DMG_MUL", value: 0.03 },
    ["ctl_r3", "ctl_x6"],
    NODE_REGION.CTL);

  // ── OFFENSE REGION (좌하단, 빨강) ────────────────────────────────────────
  // 주간선 (좌하 방향)
  add("off_t1",
    p(245, 463), NODE_TYPE.REGULAR,
    "화력 기초", "공격력 +1.5%",
    { kind: "DMG_PCT", value: 0.015 },
    ["off_gate", "off_t2", "off_x1", "off_x3"],
    NODE_REGION.OFF);

  add("off_t2",
    p(213, 500), NODE_TYPE.NOTABLE,
    "화력 강화", "공격력 +4% · 치명타 확률 +1%",
    { kind: "DMG_CRIT", dmg: 0.04, crit: 0.01 },
    ["off_t1", "off_t3", "off_l2", "off_x4"],
    NODE_REGION.OFF);

  add("off_t3",
    p(182, 537), NODE_TYPE.NOTABLE,
    "분노의 포화", "공격력 +5% · 보스 피해 +3%",
    { kind: "DMG_BOSS", dmg: 0.05, boss: 0.03 },
    ["off_t2", "off_l3", "off_x5"],
    NODE_REGION.OFF);

  // 왼쪽 치명타 경로
  add("off_l1",
    p(262, 492), NODE_TYPE.REGULAR,
    "급소 타격", "치명타 확률 +0.8%",
    { kind: "CRIT_CHANCE_ADD", value: 0.008 },
    ["off_gate", "off_l2", "off_x3"],
    NODE_REGION.OFF);

  add("off_l2",
    p(233, 528), NODE_TYPE.REGULAR,
    "치명 훈련", "치명타 확률 +0.8% · 배율 +0.04",
    { kind: "CRIT_COMBO", chance: 0.008, mult: 0.04 },
    ["off_l1", "off_l3", "off_t2"],
    NODE_REGION.OFF);

  add("off_l3",
    p(200, 563), NODE_TYPE.NOTABLE,
    "치명 마스터", "치명 배율 +0.12 · 보스 피해 +3%",
    { kind: "CRIT_MASTER", mult: 0.12, boss: 0.03 },
    ["off_l2", "off_l4", "off_t3"],
    NODE_REGION.OFF);

  add("off_l4",
    p(168, 597), NODE_TYPE.REGULAR,
    "관통 사격", "치명 배율 +0.07",
    { kind: "CRIT_MULT_ADD", value: 0.07 },
    ["off_l3", "off_lk"],
    NODE_REGION.OFF);

  add("off_lk",
    p(138, 630), NODE_TYPE.KEYSTONE,
    "크리티컬 폭발", "치명 배율 +0.40 · 치명타 확률 -10%",
    { kind: "KS_CRIT", mult: 0.40, chancePenalty: 0.10 },
    ["off_l4"],
    NODE_REGION.OFF);

  // 오른쪽 보스/처형 경로
  add("off_r1",
    p(298, 458), NODE_TYPE.REGULAR,
    "보스 사냥", "보스 피해 +2%",
    { kind: "BOSS_DMG_PCT", value: 0.02 },
    ["off_gate", "off_r2", "off_x2"],
    NODE_REGION.OFF);

  add("off_r2",
    p(320, 490), NODE_TYPE.REGULAR,
    "엘리트 분쇄", "엘리트 피해 +2%",
    { kind: "ELITE_DMG_PCT", value: 0.02 },
    ["off_r1", "off_r3", "off_x4"],
    NODE_REGION.OFF);

  add("off_r3",
    p(335, 524), NODE_TYPE.NOTABLE,
    "정밀 사격", "보스 피해 +5% · 엘리트 피해 +4%",
    { kind: "BOSS_ELITE", boss: 0.05, elite: 0.04 },
    ["off_r2", "off_r4", "off_x5"],
    NODE_REGION.OFF);

  add("off_r4",
    p(325, 560), NODE_TYPE.REGULAR,
    "처형 훈련", "처형 피해 +4%",
    { kind: "EXECUTE_DMG_PCT", value: 0.04 },
    ["off_r3", "off_rk"],
    NODE_REGION.OFF);

  add("off_rk",
    p(313, 596), NODE_TYPE.KEYSTONE,
    "냉혹한 사냥꾼", "처형 피해 +20% · 공격력 -8%",
    { kind: "KS_EXECUTE", execute: 0.20, dmgPenalty: 0.08 },
    ["off_r4"],
    NODE_REGION.OFF);

  // OFF 보조 연결 노드
  add("off_x1",
    p(263, 454), NODE_TYPE.REGULAR,
    "압박 공격", "압박 피해 +3%",
    { kind: "PRESSURE_DMG_PCT", value: 0.03 },
    ["off_gate", "off_t1"],
    NODE_REGION.OFF);

  add("off_x2",
    p(298, 434), NODE_TYPE.REGULAR,
    "강타", "공격력 +1%",
    { kind: "DMG_PCT", value: 0.01 },
    ["off_gate", "off_r1"],
    NODE_REGION.OFF);

  add("off_x3",
    p(246, 484), NODE_TYPE.REGULAR,
    "집중 사격", "치명타 확률 +0.5%",
    { kind: "CRIT_CHANCE_ADD", value: 0.005 },
    ["off_t1", "off_l1"],
    NODE_REGION.OFF);

  add("off_x4",
    p(265, 510), NODE_TYPE.REGULAR,
    "연속 공격", "공격력 +1.5%",
    { kind: "DMG_PCT", value: 0.015 },
    ["off_t2", "off_r2"],
    NODE_REGION.OFF);

  add("off_x5",
    p(255, 548), NODE_TYPE.REGULAR,
    "파괴 의지", "공격력 +2%",
    { kind: "DMG_PCT", value: 0.02 },
    ["off_t3", "off_r3"],
    NODE_REGION.OFF);

  // ── GAMBLE REGION (우하단, 금색) ─────────────────────────────────────────
  // 주간선
  add("gmb_t1",
    p(455, 463), NODE_TYPE.REGULAR,
    "씨앗 자본", "일반 티켓 +1 · 등급업 +1%",
    { kind: "LUCK_START", common: 1, rarity: 0.01 },
    ["gmb_gate", "gmb_t2", "gmb_x1", "gmb_x3"],
    NODE_REGION.GMB);

  add("gmb_t2",
    p(487, 500), NODE_TYPE.NOTABLE,
    "도박사의 감각", "등급업 +3% · 환급 확률 +3%",
    { kind: "GAMBLER", rarity: 0.03, refund: 0.03 },
    ["gmb_t1", "gmb_t3", "gmb_r2", "gmb_x4"],
    NODE_REGION.GMB);

  add("gmb_t3",
    p(518, 537), NODE_TYPE.NOTABLE,
    "황금 손길", "보스 전설 +6% · 레어 수익 +4%",
    { kind: "GOLD_TOUCH", bossLeg: 0.06, rareInc: 0.04 },
    ["gmb_t2", "gmb_r3", "gmb_x5"],
    NODE_REGION.GMB);

  // 왼쪽 수입 경로
  add("gmb_l1",
    p(402, 458), NODE_TYPE.REGULAR,
    "재투자", "일반 티켓 +1",
    { kind: "START_COMMON_ADD", value: 1 },
    ["gmb_gate", "gmb_l2", "gmb_x2"],
    NODE_REGION.GMB);

  add("gmb_l2",
    p(380, 490), NODE_TYPE.REGULAR,
    "재원 확보", "일반 +1 · 레어 +0.5",
    { kind: "START_COMMON_RARE", common: 1, rare: 0.5 },
    ["gmb_l1", "gmb_l3", "gmb_x4"],
    NODE_REGION.GMB);

  add("gmb_l3",
    p(365, 524), NODE_TYPE.NOTABLE,
    "풍요의 주머니", "일반 +2 · 레어 +1",
    { kind: "START_BIG", common: 2, rare: 1 },
    ["gmb_l2", "gmb_l4", "gmb_x5"],
    NODE_REGION.GMB);

  add("gmb_l4",
    p(370, 560), NODE_TYPE.REGULAR,
    "부의 근원", "레어 티켓 +1",
    { kind: "START_RARE_ADD", value: 1 },
    ["gmb_l3", "gmb_lk"],
    NODE_REGION.GMB);

  add("gmb_lk",
    p(385, 596), NODE_TYPE.KEYSTONE,
    "백만장자", "레어 티켓 +3 · 일반 티켓 -4",
    { kind: "KS_MILLIONAIRE", rare: 3, commonPenalty: 4 },
    ["gmb_l4"],
    NODE_REGION.GMB);

  // 오른쪽 리롤/등급 경로
  add("gmb_r1",
    p(438, 492), NODE_TYPE.REGULAR,
    "리롤 준비금", "환급 확률 +3%",
    { kind: "REROLL_REFUND_CHANCE", value: 0.03 },
    ["gmb_gate", "gmb_r2", "gmb_x3"],
    NODE_REGION.GMB);

  add("gmb_r2",
    p(480, 528), NODE_TYPE.REGULAR,
    "행운 배가", "등급업 +2% · 환급 +2%",
    { kind: "RARITY_REFUND", rarity: 0.02, refund: 0.02 },
    ["gmb_r1", "gmb_r3", "gmb_t2"],
    NODE_REGION.GMB);

  add("gmb_r3",
    p(515, 563), NODE_TYPE.NOTABLE,
    "연금술사", "등급업 +5% · SPECIAL 환급 +10%",
    { kind: "ALCHEMIST", rarity: 0.05, special: 0.10 },
    ["gmb_r2", "gmb_r4", "gmb_t3"],
    NODE_REGION.GMB);

  add("gmb_r4",
    p(535, 597), NODE_TYPE.REGULAR,
    "잭팟 준비", "신화 잭팟 +6%",
    { kind: "MYTHIC_JACKPOT_CHANCE", value: 0.06 },
    ["gmb_r3", "gmb_rk"],
    NODE_REGION.GMB);

  add("gmb_rk",
    p(562, 630), NODE_TYPE.KEYSTONE,
    "인생역전", "등급업 +15% · 쿨다운 효율 -8%",
    { kind: "KS_REVERSAL", rarity: 0.15, cdPenalty: 0.08 },
    ["gmb_r4"],
    NODE_REGION.GMB);

  // GMB 보조 연결 노드
  add("gmb_x1",
    p(437, 454), NODE_TYPE.REGULAR,
    "행운 체인", "SPECIAL 환급 +5%",
    { kind: "SPECIAL_REFUND_CHANCE", value: 0.05 },
    ["gmb_gate", "gmb_t1"],
    NODE_REGION.GMB);

  add("gmb_x2",
    p(402, 434), NODE_TYPE.REGULAR,
    "초기 자금", "일반 티켓 +1",
    { kind: "START_COMMON_ADD", value: 1 },
    ["gmb_gate", "gmb_l1"],
    NODE_REGION.GMB);

  add("gmb_x3",
    p(454, 484), NODE_TYPE.REGULAR,
    "연속 배팅", "보스 전설 +3%",
    { kind: "BOSS_EXTRA_LEGEND_CHANCE", value: 0.03 },
    ["gmb_t1", "gmb_r1"],
    NODE_REGION.GMB);

  add("gmb_x4",
    p(435, 510), NODE_TYPE.REGULAR,
    "재확인", "환급 확률 +2%",
    { kind: "REROLL_REFUND_CHANCE", value: 0.02 },
    ["gmb_t2", "gmb_l2"],
    NODE_REGION.GMB);

  add("gmb_x5",
    p(445, 548), NODE_TYPE.REGULAR,
    "황금 계획", "레어 수익 +3%",
    { kind: "EXTRA_RARE_CHANCE", value: 0.03 },
    ["gmb_t3", "gmb_l3"],
    NODE_REGION.GMB);

  return nodes;
}

export const PASSIVE_NODES = buildNodes();
export const PASSIVE_NODE_MAP = new Map(PASSIVE_NODES.map(n => [n.id, n]));

// ─── State management ────────────────────────────────────────────────────────

export function defaultMetaState() {
  return { v: META_VERSION, xp: 0, allocated: [] };
}

export function loadMetaState() {
  try {
    // 새 v2 형식 먼저 시도
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && obj.v === META_VERSION) {
        const out = defaultMetaState();
        out.xp = Math.max(0, Math.floor(obj.xp ?? 0));
        out.allocated = Array.isArray(obj.allocated)
          ? obj.allocated.filter(id => PASSIVE_NODE_MAP.has(id))
          : [];
        return out;
      }
    }
    // v1 마이그레이션: XP 보존, 노드 초기화
    const rawV1 = localStorage.getItem("lotto_td_meta_v1");
    if (rawV1) {
      const objV1 = JSON.parse(rawV1);
      const xp = Math.max(0, Math.floor(objV1?.xp ?? 0));
      return { v: META_VERSION, xp, allocated: [] };
    }
  } catch { /* ignore */ }
  return defaultMetaState();
}

export function saveMetaState(meta) {
  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify({
      v: META_VERSION,
      xp: meta.xp ?? 0,
      allocated: meta.allocated ?? [],
    }));
  } catch { /* ignore */ }
}

export function isAllocated(meta, id) {
  return (meta.allocated ?? []).includes(id);
}

/** 노드 활성화 가능 여부 체크 */
export function canAllocate(meta, nodeId) {
  const node = PASSIVE_NODE_MAP.get(nodeId);
  if (!node) return { ok: false, reason: "NOT_FOUND" };
  if (node.type === NODE_TYPE.START) return { ok: false, reason: "START" };
  if (isAllocated(meta, nodeId)) return { ok: false, reason: "ALREADY" };

  const cost = NODE_COST[node.type] ?? 30;
  if ((meta.xp ?? 0) < cost) return { ok: false, reason: "NO_XP", cost };

  // 연결 체크: 인접 노드 중 하나라도 활성화된 것이 있어야 함
  const allocSet = new Set(meta.allocated ?? []);
  allocSet.add("start"); // start는 항상 활성
  const connected = node.connections.some(id => allocSet.has(id));
  if (!connected) return { ok: false, reason: "NOT_CONNECTED", cost };

  return { ok: true, cost };
}

/** 노드 활성화 실행. 성공 시 true 반환 */
export function allocateNode(meta, nodeId) {
  const chk = canAllocate(meta, nodeId);
  if (!chk.ok) return false;
  meta.xp = Math.max(0, (meta.xp ?? 0) - chk.cost);
  if (!Array.isArray(meta.allocated)) meta.allocated = [];
  if (!meta.allocated.includes(nodeId)) meta.allocated.push(nodeId);
  return true;
}

/** 하나라도 활성화 가능한 노드가 있으면 true */
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

  for (const node of PASSIVE_NODES) {
    if (!allocSet.has(node.id) || !node.effect) continue;
    const e = node.effect;

    switch (e.kind) {
      // 단순 수치
      case "CD_REDUCE_PCT":          mods.cdReducePct += e.value; break;
      case "DMG_PCT":                mods.dmgPct += e.value; break;
      case "BOSS_DMG_PCT":           mods.bossDmgPct += e.value; break;
      case "ELITE_DMG_PCT":          mods.eliteDmgPct += e.value; break;
      case "PRESSURE_DMG_PCT":       mods.pressureDmgPct += e.value; break;
      case "EXECUTE_DMG_PCT":        mods.executeDmgPct += e.value; break;
      case "CRIT_CHANCE_ADD":        mods.critChanceAdd += e.value; break;
      case "CRIT_MULT_ADD":          mods.critMultAdd += e.value; break;
      case "HOT_ASPD_ADD":           mods.hotAspdAdd += e.value; break;
      case "HOT_CRIT_ADD":           mods.hotCritAdd += e.value; break;
      case "SLOW_POWER":             mods.slowPower += e.value; break;
      case "PREP_REDUCE":            mods.prepReduceSec += e.value; break;
      case "PEN_ADD":                mods.penAdd += e.value; break;
      case "CORE_HP_ADD":            mods.coreHpAdd += e.value; break;
      case "CORE_DMG_MUL":           mods.coreDmgMul *= (1 - e.value); break;
      case "START_COMMON_ADD":       mods.startCommonAdd += e.value; break;
      case "START_RARE_ADD":         mods.startRareAdd += e.value; break;
      case "REROLL_REFUND_CHANCE":   mods.rerollRefundChance += e.value; break;
      case "SPECIAL_REFUND_CHANCE":  mods.specialRefundChance += e.value; break;
      case "MYTHIC_JACKPOT_CHANCE":  mods.mythicJackpotChance += e.value; break;
      case "BOSS_EXTRA_LEGEND_CHANCE": mods.bossExtraLegendChance += e.value; break;
      case "EXTRA_RARE_CHANCE":      mods.extraRareChance += e.value; break;
      case "STREAK_BESTOF_BONUS":    mods.streakBestOfBonus += e.value; break;

      // 복합 효과
      case "HOT_MASTER":
        mods.hotAspdAdd += e.aspd;
        mods.hotCritAdd += e.crit;
        break;
      case "CDR_SLOW":
        mods.cdReducePct += e.cd;
        mods.slowPower += e.slow;
        break;
      case "CDR_PEN":
        mods.cdReducePct += e.cd;
        mods.penAdd += e.pen;
        break;
      case "CORE_SLOW":
        mods.coreHpAdd += e.hp;
        mods.slowPower += e.slow;
        break;
      case "CORE_FORTRESS":
        mods.coreHpAdd += e.hp;
        mods.coreDmgMul *= (1 - e.dmgReduce);
        break;
      case "DMG_CRIT":
        mods.dmgPct += e.dmg;
        mods.critChanceAdd += e.crit;
        break;
      case "DMG_BOSS":
        mods.dmgPct += e.dmg;
        mods.bossDmgPct += e.boss;
        break;
      case "CRIT_COMBO":
        mods.critChanceAdd += e.chance;
        mods.critMultAdd += e.mult;
        break;
      case "CRIT_MASTER":
        mods.critMultAdd += e.mult;
        mods.bossDmgPct += e.boss;
        break;
      case "BOSS_ELITE":
        mods.bossDmgPct += e.boss;
        mods.eliteDmgPct += e.elite;
        break;
      case "LUCK_START":
        mods.startCommonAdd += e.common;
        mods.rarityUpChance += e.rarity;
        break;
      case "GAMBLER":
        mods.rarityUpChance += e.rarity;
        mods.rerollRefundChance += e.refund;
        break;
      case "GOLD_TOUCH":
        mods.bossExtraLegendChance += e.bossLeg;
        mods.extraRareChance += e.rareInc;
        break;
      case "START_COMMON_RARE":
        mods.startCommonAdd += e.common;
        mods.startRareAdd += e.rare;
        break;
      case "START_BIG":
        mods.startCommonAdd += e.common;
        mods.startRareAdd += e.rare;
        break;
      case "RARITY_REFUND":
        mods.rarityUpChance += e.rarity;
        mods.rerollRefundChance += e.refund;
        break;
      case "ALCHEMIST":
        mods.rarityUpChance += e.rarity;
        mods.specialRefundChance += e.special;
        break;

      // 키스톤 (강력하지만 부작용 있음)
      case "KS_FLASH":    // 찰나의 사수: CD -22%, DMG -15%
        mods.cdReducePct += e.cd;
        mods.dmgPct -= e.dmgPenalty;
        break;
      case "KS_FORTRESS": // 불굴의 요새: Core HP +12, DMG -20%
        mods.coreHpAdd += e.hp;
        mods.dmgPct -= e.dmgPenalty;
        break;
      case "KS_CRIT":     // 크리티컬 폭발: Crit Mult +0.40, Crit Chance -10%
        mods.critMultAdd += e.mult;
        mods.critChanceAdd -= e.chancePenalty;
        break;
      case "KS_EXECUTE":  // 냉혹한 사냥꾼: Execute +20%, DMG -8%
        mods.executeDmgPct += e.execute;
        mods.dmgPct -= e.dmgPenalty;
        break;
      case "KS_MILLIONAIRE": // 백만장자: Rare +3, Common -4
        mods.startRareAdd += e.rare;
        mods.startCommonAdd -= e.commonPenalty;
        break;
      case "KS_REVERSAL": // 인생역전: Rarity +15%, CD penalty -8%
        mods.rarityUpChance += e.rarity;
        mods.cdReducePct -= e.cdPenalty;
        break;

      default: break;
    }
  }

  // 수치 상한/하한 적용
  mods.cdReducePct          = clamp(mods.cdReducePct, -0.15, 0.45);
  mods.critChanceAdd        = clamp(mods.critChanceAdd, -0.15, 0.25);
  mods.rarityUpChance       = clamp(mods.rarityUpChance, 0, 0.25);
  mods.rerollRefundChance   = clamp(mods.rerollRefundChance, 0, 0.25);
  mods.specialRefundChance  = clamp(mods.specialRefundChance, 0, 0.50);
  mods.mythicJackpotChance  = clamp(mods.mythicJackpotChance, 0, 0.70);
  mods.bossExtraLegendChance= clamp(mods.bossExtraLegendChance, 0, 0.80);
  mods.extraRareChance      = clamp(mods.extraRareChance, 0, 0.60);
  mods.slowPower            = clamp(mods.slowPower, 0, 0.40);
  mods.coreDmgMul           = clamp(mods.coreDmgMul, 0.50, 1.0);
  mods.pressureDmgPct       = clamp(mods.pressureDmgPct, 0, 0.35);
  mods.prepReduceSec        = clamp(mods.prepReduceSec, 0, 0.60);

  return mods;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
