// units.js
// - 타워 12종
// - 타워 등급: 일반/마법/희귀/전설/고유/신화
// - 확률 요소는 '치명타'만
// - 관통/장갑: 적 armor(장갑), 타워 penetration(관통)
// - ✅ 사거리 시스템: Cells 기반 사거리 + UI 미리보기
// - 타워 타입별 기본 "우선순위"와 옵션 "우선순위"로 플레이 감각을 강화
// - 옵션도 동일한 레어리티(일반~신화)를 가지며, 레어리티가 높을수록 수치 폭이 커짐

export const UNIT_TYPES = {
  SNIPER: "SNIPER",
  GATLING: "GATLING",
  BARRAGE: "BARRAGE",
  SHOTGUN: "SHOTGUN",

  CANNON: "CANNON",
  MORTAR: "MORTAR",

  TESLA: "TESLA",
  PINBALL: "PINBALL",

  FROST: "FROST",
  EXECUTIONER: "EXECUTIONER",
  GIANTSLAYER: "GIANTSLAYER",
  BERSERKER: "BERSERKER",

  // Support
  RADAR: "RADAR",
};

export const ITEM_RARITY = {
  NORMAL: "NORMAL",
  MAGIC: "MAGIC",
  RARE: "RARE",
  LEGENDARY: "LEGENDARY",
  UNIQUE: "UNIQUE",
  MYTHIC: "MYTHIC",
};

export const UNIT_DEFS = {
  [UNIT_TYPES.SNIPER]: {
    name: "저격",
    desc: "치명타 특화. 단일 대상 삭제기.",
    baseDamage: 52,
    baseCooldown: 1.45,
    baseRangeCells: 6.2,
    basePenetration: 6.2,
    baseCritChance: 0.10,
    baseCritMult: 1.90,
    cooldownFloor: 0.30,
  },

  [UNIT_TYPES.GATLING]: {
    name: "개틀링",
    desc: "초고속 연사(공속 고정 컨셉).",
    baseDamage: 7,
    baseCooldown: 0.16,
    baseRangeCells: 3.3,
    basePenetration: 0.6,
    baseCritChance: 0.04,
    baseCritMult: 1.30,
    cooldownFloor: 0.08,
  },

  [UNIT_TYPES.BARRAGE]: {
    name: "탄막",
    desc: "기본 멀티샷으로 여러 타겟을 긁어줌.",
    baseDamage: 11,
    baseCooldown: 0.32,
    baseRangeCells: 3.6,
    basePenetration: 1.2,
    baseCritChance: 0.03,
    baseCritMult: 1.35,
    baseMultiShots: 1,
    cooldownFloor: 0.14,
  },

  [UNIT_TYPES.SHOTGUN]: {
    name: "산탄",
    desc: "근거리 멀티샷. 붙으면 녹임.",
    baseDamage: 16,
    baseCooldown: 0.72,
    baseRangeCells: 2.8,
    basePenetration: 1.4,
    baseCritChance: 0.04,
    baseCritMult: 1.40,
    baseMultiShots: 3,
    cooldownFloor: 0.22,
  },

  [UNIT_TYPES.CANNON]: {
    name: "캐논",
    desc: "기본 폭발(스플래시 고정).",
    baseDamage: 30,
    baseCooldown: 1.05,
    baseRangeCells: 3.4,
    basePenetration: 4.6,
    baseCritChance: 0.00,
    baseCritMult: 1.00,
    baseBlastRadiusCells: 1.2,
    baseSplashMul: 0.65,
    cooldownFloor: 0.35,
  },

  [UNIT_TYPES.MORTAR]: {
    name: "박격포",
    desc: "초장거리 + 대폭발. 느리지만 시원함.",
    baseDamage: 26,
    baseCooldown: 1.35,
    baseRangeCells: 6.6,
    basePenetration: 3.8,
    baseCritChance: 0.00,
    baseCritMult: 1.00,
    baseBlastRadiusCells: 1.9,
    baseSplashMul: 0.58,
    cooldownFloor: 0.40,
  },

  [UNIT_TYPES.TESLA]: {
    name: "테슬라",
    desc: "연쇄로 다수 처리.",
    baseDamage: 16,
    baseCooldown: 0.62,
    baseRangeCells: 4.6,
    basePenetration: 2.2,
    baseCritChance: 0.03,
    baseCritMult: 1.35,
    baseRicochet: 3,
    baseRicochetFactor: 0.78,
    cooldownFloor: 0.22,
  },

  [UNIT_TYPES.PINBALL]: {
    name: "핀볼",
    desc: "튕김 위력(감쇠 약함).",
    baseDamage: 24,
    baseCooldown: 0.82,
    baseRangeCells: 4.2,
    basePenetration: 1.7,
    baseCritChance: 0.04,
    baseCritMult: 1.45,
    baseRicochet: 2,
    baseRicochetFactor: 0.88,
    cooldownFloor: 0.26,
  },

  [UNIT_TYPES.FROST]: {
    name: "빙결",
    desc: "둔화 전문(둔화 고정). 범위 내 모든 적을 늦춤.",
    baseDamage: 14,
    baseCooldown: 0.48,
    baseRangeCells: 4.4,
    basePenetration: 1.5,
    baseCritChance: 0.03,
    baseCritMult: 1.30,
    baseSlowDuration: 2.4,
    baseSlowFactor: 0.55,
    cooldownFloor: 0.18,
  },

  [UNIT_TYPES.EXECUTIONER]: {
    name: "처형자",
    desc: "체력 낮은 적에게 추가 피해(처형 고정).",
    baseDamage: 34,
    baseCooldown: 1.15,
    baseRangeCells: 4.8,
    basePenetration: 2.8,
    baseCritChance: 0.04,
    baseCritMult: 1.45,
    baseExecuteBonus: 0.65,
    cooldownFloor: 0.32,
  },

  [UNIT_TYPES.GIANTSLAYER]: {
    name: "거인사냥",
    desc: "최대체력 비례 피해로 탱커를 잡음.",
    baseDamage: 22,
    baseCooldown: 0.90,
    baseRangeCells: 5.4,
    basePenetration: 5.4,
    baseCritChance: 0.03,
    baseCritMult: 1.35,
    baseMaxHpPctDmg: 0.011,
    cooldownFloor: 0.28,
  },

  [UNIT_TYPES.BERSERKER]: {
    name: "광전사",
    desc: "엘리트/보스 우선 공격 + 진행도 비례 추가 피해(압박).",
    baseDamage: 16,
    baseCooldown: 0.60,
    baseRangeCells: 4.1,
    basePenetration: 2.0,
    baseCritChance: 0.03,
    baseCritMult: 1.35,
    basePressureDmg: 0.30,
    cooldownFloor: 0.22,
  },

  // -----------------
  // Support tower
  // -----------------
  [UNIT_TYPES.RADAR]: {
    name: "레이더",
    desc: "주변 8칸 타워에 사거리/치명 보너스를 부여하는 지원 포탑.",
    baseDamage: 0,
    baseCooldown: 99,
    baseRangeCells: 0,
    basePenetration: 0,
    baseCritChance: 0.0,
    baseCritMult: 1.0,
    cooldownFloor: 99,

    isSupport: true,
    auraRangeMul: 1.20,
    auraCritChanceMul: 1.20,
    auraCells: 1,
  },
};

// ----------------------------
// Rarity helpers
// ----------------------------

export function rarityRank(r) {
  switch (r) {
    case ITEM_RARITY.NORMAL: return 0;
    case ITEM_RARITY.MAGIC: return 1;
    case ITEM_RARITY.RARE: return 2;
    case ITEM_RARITY.LEGENDARY: return 3;
    case ITEM_RARITY.UNIQUE: return 4;
    case ITEM_RARITY.MYTHIC: return 5;
    default: return 0;
  }
}

export function nextRarity(r) {
  switch (r) {
    case ITEM_RARITY.NORMAL: return ITEM_RARITY.MAGIC;
    case ITEM_RARITY.MAGIC: return ITEM_RARITY.RARE;
    case ITEM_RARITY.RARE: return ITEM_RARITY.LEGENDARY;
    case ITEM_RARITY.LEGENDARY: return ITEM_RARITY.UNIQUE;
    case ITEM_RARITY.UNIQUE: return ITEM_RARITY.MYTHIC;
    case ITEM_RARITY.MYTHIC: return ITEM_RARITY.MYTHIC;
    default: return ITEM_RARITY.NORMAL;
  }
}

export function rarityName(r) {
  switch (r) {
    case ITEM_RARITY.NORMAL: return "일반";
    case ITEM_RARITY.MAGIC: return "마법";
    case ITEM_RARITY.RARE: return "희귀";
    case ITEM_RARITY.LEGENDARY: return "전설";
    case ITEM_RARITY.UNIQUE: return "고유";
    case ITEM_RARITY.MYTHIC: return "신화";
    default: return "알 수 없음";
  }
}

export function rarityColor(r) {
  switch (r) {
    case ITEM_RARITY.NORMAL: return "#adb5bd";
    case ITEM_RARITY.MAGIC: return "#74c0fc";
    case ITEM_RARITY.RARE: return "#ffd43b";
    case ITEM_RARITY.LEGENDARY: return "#ff6b6b";
    case ITEM_RARITY.UNIQUE: return "#ff922b";
    case ITEM_RARITY.MYTHIC: return "#b197fc";
    default: return "#ffffff";
  }
}

const ITEM_POWER = {
  [ITEM_RARITY.NORMAL]: 1.00,
  [ITEM_RARITY.MAGIC]: 1.35,
  [ITEM_RARITY.RARE]: 1.80,
  [ITEM_RARITY.LEGENDARY]: 2.50,
  [ITEM_RARITY.UNIQUE]: 3.60,
  [ITEM_RARITY.MYTHIC]: 6.50,
};

export function rollUnitType() {
  const types = Object.values(UNIT_TYPES);
  return types[Math.floor(Math.random() * types.length)];
}

export function rollItemRarityForDraw() {
  // 일반 75.45%, 마법 20%, 희귀 3%, 전설 1%, 고유 0.5%, 신화 0.05%
  const r = Math.random();
  if (r < 0.7545) return ITEM_RARITY.NORMAL;
  if (r < 0.9545) return ITEM_RARITY.MAGIC;
  if (r < 0.9845) return ITEM_RARITY.RARE;
  if (r < 0.9945) return ITEM_RARITY.LEGENDARY;
  if (r < 0.9995) return ITEM_RARITY.UNIQUE;
  return ITEM_RARITY.MYTHIC;
}

// ----------------------------
// Option system
// ----------------------------

export const OPTION_KIND = {
  DMG_PCT: "DMG_PCT",
  ASPD_PCT: "ASPD_PCT",

  TARGET_PRIORITY: "TARGET_PRIORITY",

  CRIT_CHANCE: "CRIT_CHANCE",
  CRIT_MULT: "CRIT_MULT",

  MULTISHOT: "MULTISHOT",

  RICOCHET: "RICOCHET",
  RICOCHET_POWER: "RICOCHET_POWER",

  BLAST_RADIUS: "BLAST_RADIUS",
  SPLASH_MUL: "SPLASH_MUL",

  SLOW_DURATION: "SLOW_DURATION",
  SLOW_POWER: "SLOW_POWER",

  EXECUTE_PCT: "EXECUTE_PCT",
  PRESSURE_DMG: "PRESSURE_DMG",
  MAXHP_PCT_DMG: "MAXHP_PCT_DMG",

  // D2 스타일 신규 옵션
  IGNITE: "IGNITE",           // 점화: 화염 지속피해
  CURSE: "CURSE",             // 저주: 받는 피해 증폭
  DOUBLE_STRIKE: "DOUBLE_STRIKE", // 연격: 추가 공격 기회
  PIERCE: "PIERCE",           // 관통: 같은 방향 다중 타격
};

// Target priority modes (option value)
export const TARGET_PRIORITY = {
  FRONT: "FRONT", // progress high
  BACK: "BACK",   // progress low
  NEAR: "NEAR",
  FAR: "FAR",
  LOW_HP: "LOW_HP",
  HIGH_HP: "HIGH_HP",
  ELITE: "ELITE",
  BOSS: "BOSS",
};

export function targetPriorityName(v) {
  switch (v) {
    case "BERSERKER": return "보스/엘리트 우선";
    case TARGET_PRIORITY.BOSS: return "보스 우선";
    case TARGET_PRIORITY.ELITE: return "엘리트 우선";
    case TARGET_PRIORITY.LOW_HP: return "저체력 우선";
    case TARGET_PRIORITY.HIGH_HP: return "고체력 우선";
    case TARGET_PRIORITY.NEAR: return "가까운 적 우선";
    case TARGET_PRIORITY.FAR: return "먼 적 우선";
    case TARGET_PRIORITY.BACK: return "후열 우선";
    case TARGET_PRIORITY.FRONT: return "전열 우선";
    default: return "전열 우선";
  }
}

export function optionKindName(kind) {
  switch (kind) {
    case OPTION_KIND.DMG_PCT: return "공격력";
    case OPTION_KIND.ASPD_PCT: return "공격속도";

    case OPTION_KIND.TARGET_PRIORITY: return "우선순위";

    case OPTION_KIND.CRIT_CHANCE: return "치명타 확률";
    case OPTION_KIND.CRIT_MULT: return "치명타 배율";

    case OPTION_KIND.MULTISHOT: return "멀티샷";

    case OPTION_KIND.RICOCHET: return "연쇄";
    case OPTION_KIND.RICOCHET_POWER: return "연쇄 위력";

    case OPTION_KIND.BLAST_RADIUS: return "폭발 반경";
    case OPTION_KIND.SPLASH_MUL: return "스플래시 피해";

    case OPTION_KIND.SLOW_DURATION: return "둔화 지속";
    case OPTION_KIND.SLOW_POWER: return "둔화 강도";

    case OPTION_KIND.EXECUTE_PCT: return "처형";
    case OPTION_KIND.PRESSURE_DMG: return "압박 추가피해";
    case OPTION_KIND.MAXHP_PCT_DMG: return "최대체력 비례";

    case OPTION_KIND.IGNITE: return "점화";
    case OPTION_KIND.CURSE: return "저주";
    case OPTION_KIND.DOUBLE_STRIKE: return "연격";
    case OPTION_KIND.PIERCE: return "관통";

    default: return "옵션";
  }
}

export function optionDescription(kind) {
  switch (kind) {
    case OPTION_KIND.DMG_PCT: return "기본 공격력이 증가합니다.";
    case OPTION_KIND.ASPD_PCT: return "공격 쿨다운이 감소합니다.";

    case OPTION_KIND.TARGET_PRIORITY: return "공격할 타겟의 우선순위를 변경합니다.";

    case OPTION_KIND.CRIT_CHANCE: return "치명타 확률이 증가합니다. (확률 요소는 치명타만)";
    case OPTION_KIND.CRIT_MULT: return "치명타 피해 배율이 증가합니다.";

    case OPTION_KIND.MULTISHOT: return "추가 타겟을 동시에 공격합니다.";

    case OPTION_KIND.RICOCHET: return "공격이 주변 적에게 연쇄됩니다.";
    case OPTION_KIND.RICOCHET_POWER: return "연쇄 피해 감쇠가 줄어듭니다.(더 아픔)";

    case OPTION_KIND.BLAST_RADIUS: return "폭발 반경(칸)이 증가합니다.";
    case OPTION_KIND.SPLASH_MUL: return "스플래시 피해 비율이 증가합니다.";

    case OPTION_KIND.SLOW_DURATION: return "둔화 지속시간이 증가합니다.";
    case OPTION_KIND.SLOW_POWER: return "둔화 강도가 증가합니다.(더 느려짐)";

    case OPTION_KIND.EXECUTE_PCT: return "체력 낮은 적에게 추가 피해를 줍니다.";
    case OPTION_KIND.PRESSURE_DMG: return "적이 경로를 더 진행할수록 추가 피해(최대치).";
    case OPTION_KIND.MAXHP_PCT_DMG: return "적 최대체력 비례 추가 피해.";

    case OPTION_KIND.IGNITE: return "적중 시 확률로 화염을 점화. 0.5초마다 추가 피해(타워 공격력 비례).";
    case OPTION_KIND.CURSE: return "적중 시 확률로 저주 부여. 저주 상태의 적은 모든 피해를 더 받음.";
    case OPTION_KIND.DOUBLE_STRIKE: return "매 공격마다 확률로 75% 위력의 즉시 추가 공격 발동.";
    case OPTION_KIND.PIERCE: return "같은 방향(±30°)의 추가 적을 완전 피해로 관통 타격.";

    default: return "";
  }
}

const OPTION_SLOTS = {
  [ITEM_RARITY.NORMAL]: 3,
  [ITEM_RARITY.MAGIC]: 4,
  [ITEM_RARITY.RARE]: 5,
  [ITEM_RARITY.LEGENDARY]: 6,
  [ITEM_RARITY.UNIQUE]: 6,
  [ITEM_RARITY.MYTHIC]: 7,
};

function optionSlotsByRarity(itemRarity) {
  return OPTION_SLOTS[itemRarity] ?? 3;
}

// 타워 컨셉에 맞는 옵션 풀(중복 X)
const POOL_BY_TYPE = {
  [UNIT_TYPES.SNIPER]: [
    OPTION_KIND.DMG_PCT, OPTION_KIND.ASPD_PCT, OPTION_KIND.TARGET_PRIORITY,
    OPTION_KIND.CRIT_CHANCE, OPTION_KIND.CRIT_MULT,
    OPTION_KIND.EXECUTE_PCT, OPTION_KIND.DOUBLE_STRIKE, OPTION_KIND.CURSE, OPTION_KIND.PIERCE,
  ],

  [UNIT_TYPES.GATLING]: [
    OPTION_KIND.DMG_PCT, OPTION_KIND.ASPD_PCT, OPTION_KIND.TARGET_PRIORITY,
    OPTION_KIND.CRIT_CHANCE, OPTION_KIND.CRIT_MULT,
    OPTION_KIND.MULTISHOT, OPTION_KIND.PRESSURE_DMG, OPTION_KIND.IGNITE,
  ],

  [UNIT_TYPES.BARRAGE]: [
    OPTION_KIND.DMG_PCT, OPTION_KIND.ASPD_PCT, OPTION_KIND.TARGET_PRIORITY,
    OPTION_KIND.CRIT_CHANCE, OPTION_KIND.CRIT_MULT,
    OPTION_KIND.MULTISHOT, OPTION_KIND.RICOCHET, OPTION_KIND.PIERCE,
  ],

  [UNIT_TYPES.SHOTGUN]: [
    OPTION_KIND.DMG_PCT, OPTION_KIND.ASPD_PCT, OPTION_KIND.TARGET_PRIORITY,
    OPTION_KIND.CRIT_CHANCE, OPTION_KIND.CRIT_MULT,
    OPTION_KIND.MULTISHOT, OPTION_KIND.EXECUTE_PCT, OPTION_KIND.DOUBLE_STRIKE,
  ],

  [UNIT_TYPES.CANNON]: [
    OPTION_KIND.DMG_PCT, OPTION_KIND.ASPD_PCT, OPTION_KIND.TARGET_PRIORITY,
    OPTION_KIND.BLAST_RADIUS, OPTION_KIND.SPLASH_MUL,
    OPTION_KIND.CRIT_CHANCE, OPTION_KIND.IGNITE,
  ],

  [UNIT_TYPES.MORTAR]: [
    OPTION_KIND.DMG_PCT, OPTION_KIND.ASPD_PCT, OPTION_KIND.TARGET_PRIORITY,
    OPTION_KIND.BLAST_RADIUS, OPTION_KIND.SPLASH_MUL,
    OPTION_KIND.CRIT_CHANCE, OPTION_KIND.PIERCE, OPTION_KIND.IGNITE,
  ],

  [UNIT_TYPES.TESLA]: [
    OPTION_KIND.DMG_PCT, OPTION_KIND.ASPD_PCT, OPTION_KIND.TARGET_PRIORITY,
    OPTION_KIND.CRIT_CHANCE, OPTION_KIND.CRIT_MULT,
    OPTION_KIND.RICOCHET, OPTION_KIND.RICOCHET_POWER, OPTION_KIND.PIERCE,
  ],

  [UNIT_TYPES.PINBALL]: [
    OPTION_KIND.DMG_PCT, OPTION_KIND.ASPD_PCT, OPTION_KIND.TARGET_PRIORITY,
    OPTION_KIND.CRIT_CHANCE, OPTION_KIND.CRIT_MULT,
    OPTION_KIND.RICOCHET, OPTION_KIND.RICOCHET_POWER,
  ],

  [UNIT_TYPES.FROST]: [
    OPTION_KIND.DMG_PCT, OPTION_KIND.ASPD_PCT, OPTION_KIND.TARGET_PRIORITY,
    OPTION_KIND.SLOW_DURATION, OPTION_KIND.SLOW_POWER,
    OPTION_KIND.RICOCHET, OPTION_KIND.PRESSURE_DMG, OPTION_KIND.CURSE,
  ],

  [UNIT_TYPES.EXECUTIONER]: [
    OPTION_KIND.DMG_PCT, OPTION_KIND.ASPD_PCT, OPTION_KIND.TARGET_PRIORITY,
    OPTION_KIND.CRIT_CHANCE, OPTION_KIND.CRIT_MULT,
    OPTION_KIND.EXECUTE_PCT, OPTION_KIND.PRESSURE_DMG, OPTION_KIND.DOUBLE_STRIKE, OPTION_KIND.CURSE,
  ],

  [UNIT_TYPES.GIANTSLAYER]: [
    OPTION_KIND.DMG_PCT, OPTION_KIND.ASPD_PCT, OPTION_KIND.TARGET_PRIORITY,
    OPTION_KIND.CRIT_CHANCE, OPTION_KIND.CRIT_MULT,
    OPTION_KIND.MAXHP_PCT_DMG, OPTION_KIND.EXECUTE_PCT, OPTION_KIND.CURSE, OPTION_KIND.DOUBLE_STRIKE,
  ],

  [UNIT_TYPES.BERSERKER]: [
    OPTION_KIND.DMG_PCT, OPTION_KIND.ASPD_PCT, OPTION_KIND.TARGET_PRIORITY,
    OPTION_KIND.CRIT_CHANCE, OPTION_KIND.CRIT_MULT,
    OPTION_KIND.PRESSURE_DMG, OPTION_KIND.EXECUTE_PCT, OPTION_KIND.IGNITE,
  ],
};

const SAFE_GENERIC_POOL = [
  OPTION_KIND.DMG_PCT,
  OPTION_KIND.ASPD_PCT,
  OPTION_KIND.TARGET_PRIORITY,
  OPTION_KIND.CRIT_CHANCE,
  OPTION_KIND.CRIT_MULT,
  OPTION_KIND.MULTISHOT,
  OPTION_KIND.RICOCHET,
  OPTION_KIND.EXECUTE_PCT,
  OPTION_KIND.PRESSURE_DMG,
  OPTION_KIND.MAXHP_PCT_DMG,
];

function optionRarityWeightsByItemRarity(itemRarity) {
  // 옵션 레어리티는 타워 레어리티에 종속 (상위로 갈수록 고레어 옵션 확률 증가)
  switch (itemRarity) {
    case ITEM_RARITY.NORMAL:
      return [0.80, 0.18, 0.02, 0.0, 0.0, 0.0];
    case ITEM_RARITY.MAGIC:
      return [0.55, 0.35, 0.09, 0.01, 0.0, 0.0];
    case ITEM_RARITY.RARE:
      return [0.35, 0.35, 0.22, 0.08, 0.0, 0.0];
    case ITEM_RARITY.LEGENDARY:
      return [0.18, 0.25, 0.28, 0.22, 0.07, 0.0];
    case ITEM_RARITY.UNIQUE:
      return [0.05, 0.12, 0.23, 0.25, 0.23, 0.12];
    case ITEM_RARITY.MYTHIC:
      // 신화는 '진짜 잭팟' 체감: 저등급 옵션 제거 + 상위 옵션 확률 증가
      return [0.0, 0.0, 0.08, 0.22, 0.35, 0.35];
    default:
      return [0.60, 0.30, 0.08, 0.02, 0.0, 0.0];
  }
}

function rollOptionRarity(maxItemRarity) {
  const w = optionRarityWeightsByItemRarity(maxItemRarity);
  const r = Math.random();
  const keys = [
    ITEM_RARITY.NORMAL,
    ITEM_RARITY.MAGIC,
    ITEM_RARITY.RARE,
    ITEM_RARITY.LEGENDARY,
    ITEM_RARITY.UNIQUE,
    ITEM_RARITY.MYTHIC,
  ];

  let acc = 0;
  for (let i = 0; i < w.length; i++) {
    acc += w[i];
    if (r <= acc) {
      // 안전: 옵션 레어리티는 타워 레어리티 초과 금지
      return rarityRank(keys[i]) <= rarityRank(maxItemRarity) ? keys[i] : maxItemRarity;
    }
  }
  return ITEM_RARITY.NORMAL;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function valueByRarity(kind, r) {
  // 레어리티가 올라갈수록 폭이 커지게
  // (요청 예시: 신화 크리 60%, 멀티샷 10 등)

  const R = ITEM_RARITY;

  const pick = (table, isInt = false) => {
    const [a, b] = table[r] ?? table[R.NORMAL];
    return isInt ? randInt(a, b) : rand(a, b);
  };

  switch (kind) {
    case OPTION_KIND.DMG_PCT:
      return pick({
        [R.NORMAL]: [0.06, 0.15],
        [R.MAGIC]: [0.10, 0.22],
        [R.RARE]: [0.18, 0.35],
        [R.LEGENDARY]: [0.28, 0.55],
        [R.UNIQUE]: [0.40, 0.75],
        [R.MYTHIC]: [0.70, 1.20],
      });

    case OPTION_KIND.ASPD_PCT:
      return pick({
        [R.NORMAL]: [0.04, 0.10],
        [R.MAGIC]: [0.08, 0.16],
        [R.RARE]: [0.12, 0.22],
        [R.LEGENDARY]: [0.18, 0.30],
        [R.UNIQUE]: [0.24, 0.40],
        [R.MYTHIC]: [0.35, 0.55],
      });

    case OPTION_KIND.TARGET_PRIORITY: {
      // "사거리 옵션" 대신: 타겟 우선순위.
      // 낮은 레어리티는 전투 체감이 큰 기본 우선순위 위주,
      // 높은 레어리티는 보스/엘리트 같은 강한 컨트롤 옵션 비중 증가.
      const table = {
        [R.NORMAL]: [TARGET_PRIORITY.LOW_HP, TARGET_PRIORITY.NEAR, TARGET_PRIORITY.BACK],
        [R.MAGIC]: [TARGET_PRIORITY.LOW_HP, TARGET_PRIORITY.NEAR, TARGET_PRIORITY.HIGH_HP, TARGET_PRIORITY.FAR],
        [R.RARE]: [TARGET_PRIORITY.ELITE, TARGET_PRIORITY.LOW_HP, TARGET_PRIORITY.HIGH_HP, TARGET_PRIORITY.NEAR],
        [R.LEGENDARY]: [TARGET_PRIORITY.BOSS, TARGET_PRIORITY.ELITE, TARGET_PRIORITY.LOW_HP, TARGET_PRIORITY.HIGH_HP],
        [R.UNIQUE]: [TARGET_PRIORITY.BOSS, TARGET_PRIORITY.ELITE, TARGET_PRIORITY.HIGH_HP, TARGET_PRIORITY.LOW_HP],
        [R.MYTHIC]: [TARGET_PRIORITY.BOSS, TARGET_PRIORITY.BOSS, TARGET_PRIORITY.ELITE, TARGET_PRIORITY.HIGH_HP],
      };
      const pool = table[r] ?? table[R.NORMAL];
      return pool[Math.floor(Math.random() * pool.length)];
    }

    case OPTION_KIND.CRIT_CHANCE:
      return pick({
        [R.NORMAL]: [0.02, 0.07],
        [R.MAGIC]: [0.04, 0.12],
        [R.RARE]: [0.08, 0.18],
        [R.LEGENDARY]: [0.14, 0.28],
        [R.UNIQUE]: [0.22, 0.42],
        [R.MYTHIC]: [0.38, 0.70],
      });

    case OPTION_KIND.CRIT_MULT:
      return pick({
        [R.NORMAL]: [0.10, 0.30],
        [R.MAGIC]: [0.20, 0.50],
        [R.RARE]: [0.35, 0.70],
        [R.LEGENDARY]: [0.55, 1.10],
        [R.UNIQUE]: [0.85, 1.50],
        [R.MYTHIC]: [1.30, 2.50],
      });

    case OPTION_KIND.MULTISHOT:
      return pick({
        [R.NORMAL]: [1, 1],
        [R.MAGIC]: [1, 2],
        [R.RARE]: [2, 3],
        [R.LEGENDARY]: [3, 4],
        [R.UNIQUE]: [4, 6],
        [R.MYTHIC]: [7, 12],
      }, true);

    case OPTION_KIND.RICOCHET:
      return pick({
        [R.NORMAL]: [1, 1],
        [R.MAGIC]: [1, 2],
        [R.RARE]: [2, 3],
        [R.LEGENDARY]: [3, 4],
        [R.UNIQUE]: [4, 6],
        [R.MYTHIC]: [6, 12],
      }, true);

    case OPTION_KIND.RICOCHET_POWER:
      // factor +0.03~0.20 (최종 clamp)
      return pick({
        [R.NORMAL]: [0.03, 0.05],
        [R.MAGIC]: [0.06, 0.08],
        [R.RARE]: [0.09, 0.12],
        [R.LEGENDARY]: [0.13, 0.16],
        [R.UNIQUE]: [0.17, 0.20],
        [R.MYTHIC]: [0.20, 0.28],
      });

    case OPTION_KIND.BLAST_RADIUS:
      return pick({
        [R.NORMAL]: [0.3, 0.5],
        [R.MAGIC]: [0.6, 0.9],
        [R.RARE]: [1.0, 1.3],
        [R.LEGENDARY]: [1.4, 1.8],
        [R.UNIQUE]: [1.9, 2.4],
        [R.MYTHIC]: [2.5, 3.5],
      });

    case OPTION_KIND.SPLASH_MUL:
      return pick({
        [R.NORMAL]: [0.08, 0.12],
        [R.MAGIC]: [0.13, 0.20],
        [R.RARE]: [0.21, 0.30],
        [R.LEGENDARY]: [0.31, 0.45],
        [R.UNIQUE]: [0.46, 0.65],
        [R.MYTHIC]: [0.66, 1.00],
      });

    case OPTION_KIND.SLOW_DURATION:
      return pick({
        [R.NORMAL]: [0.6, 1.0],
        [R.MAGIC]: [1.1, 1.8],
        [R.RARE]: [1.9, 2.8],
        [R.LEGENDARY]: [2.9, 4.0],
        [R.UNIQUE]: [4.1, 5.4],
        [R.MYTHIC]: [5.5, 7.5],
      });

    case OPTION_KIND.SLOW_POWER:
      // slowFactor를 더 낮추는 delta
      return pick({
        [R.NORMAL]: [0.03, 0.06],
        [R.MAGIC]: [0.07, 0.10],
        [R.RARE]: [0.11, 0.14],
        [R.LEGENDARY]: [0.15, 0.20],
        [R.UNIQUE]: [0.21, 0.28],
        [R.MYTHIC]: [0.29, 0.40],
      });

    case OPTION_KIND.EXECUTE_PCT:
      return pick({
        [R.NORMAL]: [0.08, 0.18],
        [R.MAGIC]: [0.14, 0.28],
        [R.RARE]: [0.22, 0.40],
        [R.LEGENDARY]: [0.34, 0.60],
        [R.UNIQUE]: [0.50, 0.85],
        [R.MYTHIC]: [0.80, 1.50],
      });

    case OPTION_KIND.PRESSURE_DMG:
      // 진행도 비례 추가피해 (최대치). 실제 적용은 엔진에서 progress(0~1)에 비례.
      return pick({
        [R.NORMAL]: [0.05, 0.12],
        [R.MAGIC]: [0.10, 0.18],
        [R.RARE]: [0.14, 0.26],
        [R.LEGENDARY]: [0.22, 0.38],
        [R.UNIQUE]: [0.32, 0.52],
        [R.MYTHIC]: [0.50, 0.80],
      });

    case OPTION_KIND.MAXHP_PCT_DMG:
      return pick({
        [R.NORMAL]: [0.003, 0.007],
        [R.MAGIC]: [0.006, 0.012],
        [R.RARE]: [0.010, 0.018],
        [R.LEGENDARY]: [0.016, 0.028],
        [R.UNIQUE]: [0.025, 0.045],
        [R.MYTHIC]: [0.040, 0.090],
      });

    // ── 신규 D2 스타일 옵션 ─────────────────────────────────

    case OPTION_KIND.IGNITE: {
      // value = [chance, dmgRatio] — 배열로 저장
      const tbl = {
        [R.NORMAL]:    { c:[0.05,0.08], d:[0.02,0.04] },
        [R.MAGIC]:     { c:[0.09,0.13], d:[0.05,0.08] },
        [R.RARE]:      { c:[0.14,0.20], d:[0.09,0.14] },
        [R.LEGENDARY]: { c:[0.21,0.30], d:[0.15,0.22] },
        [R.UNIQUE]:    { c:[0.31,0.45], d:[0.23,0.35] },
        [R.MYTHIC]:    { c:[0.46,0.70], d:[0.36,0.55] },
      };
      const t = tbl[r] ?? tbl[R.NORMAL];
      return [rand(t.c[0], t.c[1]), rand(t.d[0], t.d[1])];
    }

    case OPTION_KIND.CURSE: {
      // value = [chance, ampMul] — 배열
      const tbl = {
        [R.NORMAL]:    { c:[0.05,0.08], a:[0.10,0.15] },
        [R.MAGIC]:     { c:[0.09,0.14], a:[0.16,0.22] },
        [R.RARE]:      { c:[0.15,0.22], a:[0.23,0.32] },
        [R.LEGENDARY]: { c:[0.23,0.33], a:[0.33,0.45] },
        [R.UNIQUE]:    { c:[0.34,0.48], a:[0.46,0.65] },
        [R.MYTHIC]:    { c:[0.49,0.70], a:[0.66,1.00] },
      };
      const t = tbl[r] ?? tbl[R.NORMAL];
      return [rand(t.c[0], t.c[1]), rand(t.a[0], t.a[1])];
    }

    case OPTION_KIND.DOUBLE_STRIKE:
      return pick({
        [R.NORMAL]:    [0.05, 0.08],
        [R.MAGIC]:     [0.09, 0.14],
        [R.RARE]:      [0.15, 0.22],
        [R.LEGENDARY]: [0.23, 0.33],
        [R.UNIQUE]:    [0.34, 0.48],
        [R.MYTHIC]:    [0.49, 0.70],
      });

    case OPTION_KIND.PIERCE:
      return pick({
        [R.NORMAL]:    [1, 1],
        [R.MAGIC]:     [1, 2],
        [R.RARE]:      [2, 2],
        [R.LEGENDARY]: [2, 3],
        [R.UNIQUE]:    [3, 4],
        [R.MYTHIC]:    [4, 5],
      }, true);

    default:
      return 0;
  }
}

export function rollOptions(unitType, itemRarity) {
  const slots = optionSlotsByRarity(itemRarity);

  // 타입별 옵션 풀을 사용합니다.
// ✅ 부족한 경우에도 '안전한 범용 풀'에서만 보충해서
// 폭발/둔화/연쇄 위력 같은 '의미 없는 조합'이 섞이는 문제를 방지합니다.
const basePool = POOL_BY_TYPE[unitType] ?? SAFE_GENERIC_POOL;

let remain = [...basePool];
if (remain.length < slots) {
  const extra = SAFE_GENERIC_POOL.filter((k) => !remain.includes(k));

  // shuffle extra
  for (let i = extra.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [extra[i], extra[j]] = [extra[j], extra[i]];
  }

  remain = remain.concat(extra);
}

  const options = [];

  // 잭팟 체감: 고레어리티는 최소 1~2줄은 상위 옵션으로 보장
  const guaranteedRarities = [];
  if (itemRarity === ITEM_RARITY.MYTHIC) {
    guaranteedRarities.push(ITEM_RARITY.MYTHIC);
    guaranteedRarities.push(ITEM_RARITY.UNIQUE);
  } else if (itemRarity === ITEM_RARITY.UNIQUE) {
    guaranteedRarities.push(ITEM_RARITY.UNIQUE);
  }

  while (options.length < slots && remain.length > 0) {
    const idx = Math.floor(Math.random() * remain.length);
    const kind = remain.splice(idx, 1)[0];

    const r = guaranteedRarities.length > 0 ? guaranteedRarities.shift() : rollOptionRarity(itemRarity);
    const value = valueByRarity(kind, r);

    options.push({ kind, rarity: r, value });
  }

  // 마지막 안전장치(이론상 거의 안 탐): 그래도 모자라면 중복 허용으로 채움
  // (여기까지 오면 풀 자체가 잘못 구성된 것)
  const all = SAFE_GENERIC_POOL;
  while (options.length < slots) {
    const kind = all[Math.floor(Math.random() * all.length)];
    const r = guaranteedRarities.length > 0 ? guaranteedRarities.shift() : rollOptionRarity(itemRarity);
    const value = valueByRarity(kind, r);
    options.push({ kind, rarity: r, value });
  }

  return options;
}

// D2 스타일 등급 접두사 — rarityName 대신 사용
const OPTION_AFFIX_PREFIX = {
  [ITEM_RARITY.NORMAL]:    "날카로운",
  [ITEM_RARITY.MAGIC]:     "강화된",
  [ITEM_RARITY.RARE]:      "잔혹한",
  [ITEM_RARITY.LEGENDARY]: "파멸의",
  [ITEM_RARITY.UNIQUE]:    "신성한",
  [ITEM_RARITY.MYTHIC]:    "절대자의",
};

export function formatOption(opt) {
  const prefix = OPTION_AFFIX_PREFIX[opt.rarity] ?? rarityName(opt.rarity);
  const k = opt.kind;
  const v = opt.value;

  // int
  if (k === OPTION_KIND.MULTISHOT || k === OPTION_KIND.RICOCHET || k === OPTION_KIND.PIERCE) {
    return `${prefix} ${optionKindName(k)} +${v}`;
  }

  // sec
  if (k === OPTION_KIND.SLOW_DURATION) {
    return `${prefix} ${optionKindName(k)} +${v.toFixed(1)}초`;
  }

  // target priority
  if (k === OPTION_KIND.TARGET_PRIORITY) {
    return `${prefix} ${optionKindName(k)}: ${targetPriorityName(v)}`;
  }

  // cells
  if (k === OPTION_KIND.BLAST_RADIUS) {
    return `${prefix} ${optionKindName(k)} +${v.toFixed(1)}칸`;
  }

  // ricochet power / slow power
  if (k === OPTION_KIND.RICOCHET_POWER || k === OPTION_KIND.SLOW_POWER) {
    return `${prefix} ${optionKindName(k)} +${Math.round(v * 100)}%`;
  }

  // pressure dmg (max)
  if (k === OPTION_KIND.PRESSURE_DMG) {
    return `${prefix} ${optionKindName(k)} 최대 +${Math.round(v * 100)}%`;
  }

  // IGNITE: value[0]=확률, value[1]=틱당비율
  if (k === OPTION_KIND.IGNITE) {
    const chance = Math.round(v[0] * 100);
    const dps = Math.round(v[1] * 100);
    return `${prefix} ${optionKindName(k)} ${chance}% (틱당 ${dps}%)`;
  }

  // CURSE: value[0]=확률, value[1]=피해증폭
  if (k === OPTION_KIND.CURSE) {
    const chance = Math.round(v[0] * 100);
    const amp = Math.round(v[1] * 100);
    return `${prefix} ${optionKindName(k)} ${chance}% (+${amp}% 피해증폭)`;
  }

  // DOUBLE_STRIKE
  if (k === OPTION_KIND.DOUBLE_STRIKE) {
    return `${prefix} ${optionKindName(k)} ${Math.round(v * 100)}%`;
  }

  // %
  if (
    k === OPTION_KIND.DMG_PCT ||
    k === OPTION_KIND.ASPD_PCT ||
    k === OPTION_KIND.CRIT_CHANCE ||
    k === OPTION_KIND.SPLASH_MUL ||
    k === OPTION_KIND.EXECUTE_PCT ||
    k === OPTION_KIND.MAXHP_PCT_DMG
  ) {
    return `${prefix} ${optionKindName(k)} +${Math.round(v * 100)}%`;
  }

  // crit mult
  if (k === OPTION_KIND.CRIT_MULT) {
    return `${prefix} ${optionKindName(k)} +${v.toFixed(2)}배`;
  }

  return `${prefix} ${optionKindName(k)}`;
}

export function createUnit(unitType, itemRarity, options, cell, pxPerCell) {
  const def = UNIT_DEFS[unitType];

  const isSupport = !!def.isSupport;

  const cx = cell.x + cell.w / 2;
  const cy = cell.y + cell.h / 2;

  const power = ITEM_POWER[itemRarity] ?? 1.0;

  // base
  let damage = def.baseDamage * power;
  let cooldown = def.baseCooldown;

  // armor/penetration system
  let penetration = def.basePenetration ?? 0;

  // ✅ no-range: target priority becomes the core identity
  let targetPriority = (() => {
    switch (unitType) {
      case UNIT_TYPES.SNIPER: return TARGET_PRIORITY.BOSS;
      case UNIT_TYPES.GATLING: return TARGET_PRIORITY.NEAR;
      case UNIT_TYPES.BARRAGE: return TARGET_PRIORITY.BACK;
      case UNIT_TYPES.SHOTGUN: return TARGET_PRIORITY.NEAR;

      case UNIT_TYPES.CANNON: return TARGET_PRIORITY.FRONT;
      case UNIT_TYPES.MORTAR: return TARGET_PRIORITY.BACK;

      case UNIT_TYPES.TESLA: return TARGET_PRIORITY.FRONT;
      case UNIT_TYPES.PINBALL: return TARGET_PRIORITY.ELITE;

      case UNIT_TYPES.FROST: return TARGET_PRIORITY.FRONT;
      case UNIT_TYPES.EXECUTIONER: return TARGET_PRIORITY.LOW_HP;
      case UNIT_TYPES.GIANTSLAYER: return TARGET_PRIORITY.HIGH_HP;
      case UNIT_TYPES.BERSERKER: return "BERSERKER";
      case UNIT_TYPES.RADAR: return TARGET_PRIORITY.FRONT;
      default: return TARGET_PRIORITY.FRONT;
    }
  })();

  let critChance = def.baseCritChance;
  let critMult = def.baseCritMult;

  let multiShots = def.baseMultiShots ?? 0;
  let ricochet = def.baseRicochet ?? 0;
  let ricochetFactor = def.baseRicochetFactor ?? 0.72;

  let blastRadiusCells = def.baseBlastRadiusCells ?? 0;
  let splashMul = def.baseSplashMul ?? 0;

  let slowDuration = def.baseSlowDuration ?? 0;
  let slowFactor = def.baseSlowFactor ?? 0.70;

  let executeBonus = def.baseExecuteBonus ?? 0;
  let pressureDmg = def.basePressureDmg ?? 0;
  let maxHpPctDmg = def.baseMaxHpPctDmg ?? 0;

  // 신규 D2 스타일 옵션 스탯
  let igniteChance = 0;
  let igniteDmgRatio = 0;
  let curseChance = 0;
  let curseDmgMul = 0;
  let doubleStrikeChance = 0;
  let pierce = 0;

  // apply options
  for (const opt of options) {
    switch (opt.kind) {
      case OPTION_KIND.DMG_PCT:
        damage *= 1 + opt.value;
        break;
      case OPTION_KIND.ASPD_PCT:
        cooldown *= 1 - opt.value;
        break;

      case OPTION_KIND.TARGET_PRIORITY:
        targetPriority = opt.value;
        break;

      case OPTION_KIND.CRIT_CHANCE:
        critChance += opt.value;
        break;
      case OPTION_KIND.CRIT_MULT:
        critMult += opt.value;
        break;

      case OPTION_KIND.MULTISHOT:
        multiShots += opt.value;
        break;

      case OPTION_KIND.RICOCHET:
        ricochet += opt.value;
        break;
      case OPTION_KIND.RICOCHET_POWER:
        ricochetFactor += opt.value;
        break;

      case OPTION_KIND.BLAST_RADIUS:
        blastRadiusCells += opt.value;
        break;
      case OPTION_KIND.SPLASH_MUL:
        splashMul += opt.value;
        break;

      case OPTION_KIND.SLOW_DURATION:
        slowDuration += opt.value;
        break;
      case OPTION_KIND.SLOW_POWER:
        slowFactor -= opt.value;
        break;

      case OPTION_KIND.EXECUTE_PCT:
        executeBonus += opt.value;
        break;
      case OPTION_KIND.PRESSURE_DMG:
        pressureDmg += opt.value;
        break;
      case OPTION_KIND.MAXHP_PCT_DMG:
        maxHpPctDmg += opt.value;
        break;

      // 신규 D2 스타일 옵션
      case OPTION_KIND.IGNITE:
        // value = [chance, dmgRatio]
        igniteChance = Math.max(igniteChance, opt.value[0]);
        igniteDmgRatio = Math.max(igniteDmgRatio, opt.value[1]);
        break;
      case OPTION_KIND.CURSE:
        // value = [chance, ampMul]
        curseChance = Math.max(curseChance, opt.value[0]);
        curseDmgMul = Math.max(curseDmgMul, opt.value[1]);
        break;
      case OPTION_KIND.DOUBLE_STRIKE:
        doubleStrikeChance += opt.value;
        break;
      case OPTION_KIND.PIERCE:
        pierce += opt.value;
        break;

      default:
        break;
    }
  }

  // clamps
  const floor = def.cooldownFloor ?? 0.20;
  cooldown = clamp(cooldown, floor, 9.99);

  damage = Math.round(damage);

  // Attack range (cells -> pixels)
  // 사거리 기반 배치/최적화를 위해 다시 사용합니다.
  // Support tower는 공격하지 않음(range=0)
  const rangeCells = isSupport ? 0 : clamp(def.baseRangeCells ?? 4.0, 1.6, 9.5);
  const rangePx = rangeCells * pxPerCell;

  critChance = clamp(critChance, 0, 0.95);
  critMult = Math.max(1.0, critMult);

  multiShots = clampInt(multiShots, 0, 10);
  ricochet = clampInt(ricochet, 0, 10);
  ricochetFactor = clamp(ricochetFactor, 0.55, 0.98);

  blastRadiusCells = clamp(blastRadiusCells, 0, 4.2);
  splashMul = clamp(splashMul, 0, 1.50);

  slowDuration = clamp(slowDuration, 0, 9.0);
  slowFactor = clamp(slowFactor, 0.20, 0.95);

  executeBonus = clamp(executeBonus, 0, 3.0);
  pressureDmg = clamp(pressureDmg, 0, 2.0);
  maxHpPctDmg = clamp(maxHpPctDmg, 0, 0.25);

  igniteChance = clamp(igniteChance, 0, 0.80);
  igniteDmgRatio = clamp(igniteDmgRatio, 0, 1.0);
  curseChance = clamp(curseChance, 0, 0.80);
  curseDmgMul = clamp(curseDmgMul, 0, 1.50);
  doubleStrikeChance = clamp(doubleStrikeChance, 0, 0.80);
  pierce = clampInt(pierce, 0, 10);

  // -----------------
  // High-tier fire gap: Magazine / Overheat
  // -----------------
  let magSize = 0;
  let magAmmo = 0;
  let reloadTime = 0;
  let reloadT = 0;
  let burstCdMul = 1.0;

  let overheatMax = 0;
  let overheatShots = 0;
  let overheatCool = 0;
  let overheatT = 0;

  if (!isSupport) {
    const rr = rarityRank(itemRarity);
    const rrLegend = rarityRank(ITEM_RARITY.LEGENDARY);
    const rrUnique = rarityRank(ITEM_RARITY.UNIQUE);
    const rrMythic = rarityRank(ITEM_RARITY.MYTHIC);

    // Magazine: artillery class
    if (unitType === UNIT_TYPES.MORTAR || unitType === UNIT_TYPES.CANNON) {
      if (rr >= rrLegend) {
        const tier = rr >= rrMythic ? 2 : rr >= rrUnique ? 1 : 0;
        magSize = [3, 4, 5][tier];
        magAmmo = magSize;
        reloadTime = [2.6, 3.2, 4.0][tier];
        burstCdMul = [0.55, 0.48, 0.42][tier];
      }
    }

    // Overheat: gatling class
    if (unitType === UNIT_TYPES.GATLING) {
      if (rr >= rrLegend) {
        const tier = rr >= rrMythic ? 2 : rr >= rrUnique ? 1 : 0;
        overheatMax = [45, 55, 65][tier];
        overheatCool = [2.5, 2.6, 2.7][tier];
      }
    }
  }

  return {
    id: Math.random().toString(16).slice(2) + Date.now().toString(16),

    type: unitType,
    itemRarity,
    options,
    name: def.name,

    r: cell.r,
    c: cell.c,
    x: cx,
    y: cy,

    damage,
    cooldown,
    cd: 0,

    penetration,

    range: rangePx,
    rangeCells,
    targetPriority,

    // support / aura
    isSupport,
    // (provider) support tower's aura spec
    auraProvideRangeMul: def.auraRangeMul ?? 1.0,
    auraProvideCritChanceMul: def.auraCritChanceMul ?? 1.0,
    auraProvideCells: def.auraCells ?? 0,
    // (receiver) recalculated each frame by engine
    auraOn: false,
    auraRangeMul: 1.0,
    auraCritChanceMul: 1.0,

    critChance,
    critMult,

    multiShots,

    ricochet,
    ricochetFactor,

    blastRadiusCells,
    splashMul,

    slowDuration,
    slowFactor,

    executeBonus,
    pressureDmg,
    maxHpPctDmg,

    // 신규 D2 스타일 옵션
    igniteChance,
    igniteDmgRatio,
    curseChance,
    curseDmgMul,
    doubleStrikeChance,
    pierce,

    // magazine / overheat
    magSize,
    magAmmo,
    reloadTime,
    reloadT,
    burstCdMul,

    overheatMax,
    overheatShots,
    overheatCool,
    overheatT,
    // DPS meter
    totalDamage: 0,
    dpsMeter: 0,
  };
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function clampInt(v, a, b) {
  const n = Math.round(v);
  return Math.max(a, Math.min(b, n));
}
