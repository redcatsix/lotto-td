// enemies.js
// - 라운드 기반 적 생성
// - 이동속도는 라운드에 따라 변하지 않음(고정)
// - 둔화는 가장 강한 둔화 1개만 적용(엔진에서 min factor로 계산)
// - ✅ 웨이브 타입 시스템 추가: 매 스테이지 다양한 적 조합/특수 웨이브

export const ENEMY_TYPES = {
  MINION: "MINION",
  ELITE: "ELITE",
  BOSS: "BOSS",
};

// =====================
// 웨이브 타입 정의
// =====================
export const WAVE_TYPE = {
  NORMAL:    "NORMAL",     // 기본 (혼합)
  SWARM:     "SWARM",      // 대군 - 미니언 대량 + 빠름
  ARMORED:   "ARMORED",    // 장갑 - 엘리트 위주 + 높은 장갑
  RUSH:      "RUSH",       // 돌격 - 빠른 속도 + 랩 감소
  SIEGE:     "SIEGE",      // 공성 - 느리지만 HP 폭증
  ELITE_VANGUARD: "ELITE_VANGUARD", // 엘리트 선봉 - 엘리트가 앞장
  SPLIT:     "SPLIT",      // 분리 - 두 그룹으로 나뉜 파도
  PHANTOM:   "PHANTOM",    // 유령 - 낮은 HP지만 초고속
};

export const WAVE_TYPE_INFO = {
  [WAVE_TYPE.NORMAL]:         { name: "일반",       color: "#adb5bd", desc: "기본 적 조합" },
  [WAVE_TYPE.SWARM]:          { name: "대군",        color: "#ff6b6b", desc: "수많은 미니언이 몰려온다!" },
  [WAVE_TYPE.ARMORED]:        { name: "중장갑",      color: "#ffd43b", desc: "두꺼운 장갑의 적들" },
  [WAVE_TYPE.RUSH]:           { name: "돌격",        color: "#ff922b", desc: "빠르게 돌진하는 적들" },
  [WAVE_TYPE.SIEGE]:          { name: "공성",        color: "#b197fc", desc: "느리지만 극강의 체력" },
  [WAVE_TYPE.ELITE_VANGUARD]: { name: "엘리트 선봉", color: "#74c0fc", desc: "엘리트가 선두에!" },
  [WAVE_TYPE.SPLIT]:          { name: "분리파도",    color: "#63e6be", desc: "두 그룹이 동시에 진격" },
  [WAVE_TYPE.PHANTOM]:        { name: "유령",        color: "#e599f7", desc: "빠르지만 허약한 적들" },
};

// 웨이브 타입별 스폰 가중치 테이블
// [MINION_WEIGHT, ELITE_WEIGHT]
const WAVE_SPAWN_WEIGHTS = {
  [WAVE_TYPE.NORMAL]:         [0.75, 0.25],
  [WAVE_TYPE.SWARM]:          [0.95, 0.05],
  [WAVE_TYPE.ARMORED]:        [0.30, 0.70],
  [WAVE_TYPE.RUSH]:           [0.80, 0.20],
  [WAVE_TYPE.SIEGE]:          [0.60, 0.40],
  [WAVE_TYPE.ELITE_VANGUARD]: [0.50, 0.50],
  [WAVE_TYPE.SPLIT]:          [0.70, 0.30],
  [WAVE_TYPE.PHANTOM]:        [1.00, 0.00],
};

// 웨이브 타입별 스탯 수정자
const WAVE_STAT_MOD = {
  [WAVE_TYPE.NORMAL]:         { hpMul: 1.0,  speedMul: 1.0,  armorMul: 1.0,  lapReduce: 0 },
  [WAVE_TYPE.SWARM]:          { hpMul: 0.65, speedMul: 1.15, armorMul: 0.7,  lapReduce: 0 },
  [WAVE_TYPE.ARMORED]:        { hpMul: 1.2,  speedMul: 0.90, armorMul: 2.2,  lapReduce: 0 },
  [WAVE_TYPE.RUSH]:           { hpMul: 0.85, speedMul: 1.35, armorMul: 0.8,  lapReduce: 1 },
  [WAVE_TYPE.SIEGE]:          { hpMul: 2.2,  speedMul: 0.70, armorMul: 1.3,  lapReduce: 0 },
  [WAVE_TYPE.ELITE_VANGUARD]: { hpMul: 1.1,  speedMul: 1.0,  armorMul: 1.3,  lapReduce: 0 },
  [WAVE_TYPE.SPLIT]:          { hpMul: 0.90, speedMul: 1.1,  armorMul: 1.0,  lapReduce: 0 },
  [WAVE_TYPE.PHANTOM]:        { hpMul: 0.40, speedMul: 1.60, armorMul: 0.4,  lapReduce: 1 },
};

/**
 * 스테이지에 맞는 웨이브 타입을 롤합니다.
 * - 초반(1~4): NORMAL만
 * - 5라운드 이후 특수 웨이브 등장
 * - 보스 라운드는 특수 제외(BOSS 전용)
 */
export function rollWaveType(stage, isBoss) {
  if (isBoss) return WAVE_TYPE.NORMAL;
  if (stage <= 4) return WAVE_TYPE.NORMAL;

  // 스테이지가 높을수록 더 다양한/강한 웨이브 등장
  const allTypes = [
    WAVE_TYPE.NORMAL,
    WAVE_TYPE.SWARM,
    WAVE_TYPE.ARMORED,
    WAVE_TYPE.RUSH,
    WAVE_TYPE.SIEGE,
    WAVE_TYPE.ELITE_VANGUARD,
    WAVE_TYPE.SPLIT,
    WAVE_TYPE.PHANTOM,
  ];

  // 각 웨이브 타입의 등장 최소 스테이지
  const minStage = {
    [WAVE_TYPE.NORMAL]:         1,
    [WAVE_TYPE.SWARM]:          5,
    [WAVE_TYPE.ARMORED]:        7,
    [WAVE_TYPE.RUSH]:           5,
    [WAVE_TYPE.SIEGE]:          10,
    [WAVE_TYPE.ELITE_VANGUARD]: 8,
    [WAVE_TYPE.SPLIT]:          12,
    [WAVE_TYPE.PHANTOM]:        15,
  };

  // 가중치 (후반일수록 특수 웨이브 확률 증가)
  const progress = Math.min(1, (stage - 5) / 25); // 0~1
  const specialWeight = 0.25 + progress * 0.45;   // 25%~70%

  const pool = allTypes.filter(t => stage >= (minStage[t] || 1));
  const weights = pool.map(t => t === WAVE_TYPE.NORMAL ? (1 - specialWeight) : (specialWeight / (pool.length - 1)));

  return pickWeighted(pool, weights);
}

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

function id() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function hpScale(round) {
  const r = Math.max(1, round);
  return Math.pow(1.13, r - 1);
}

function armorScale(round) {
  const r = Math.max(1, round);
  return Math.floor((r - 1) / 6);
}

export function makeEnemy(type, path, round, extra = {}, waveType = WAVE_TYPE.NORMAL) {
  const mul = hpScale(round);
  const aStep = armorScale(round);
  const wmod = WAVE_STAT_MOD[waveType] || WAVE_STAT_MOD[WAVE_TYPE.NORMAL];

  let maxHp = 90;
  let speed = 145;
  let coreDmg = 1;
  let radius = 12;
  let color = "#ff6b6b";
  let maxLaps = 4;
  let isBoss = false;
  let armor = 0;

  if (type === ENEMY_TYPES.ELITE) {
    maxHp = 140;
    speed = 135;
    coreDmg = 2;
    radius = 14;
    color = "#ffd43b";
    maxLaps = 3;
    armor = 1.2 + aStep * 0.55;
  }

  if (type === ENEMY_TYPES.BOSS) {
    isBoss = true;
    maxHp = 1200;
    speed = 110;
    coreDmg = 8;
    radius = 22;
    color = "#b197fc";
    maxLaps = 3;
    armor = 3.5 + aStep * 0.85;
  }

  if (type === ENEMY_TYPES.MINION) {
    armor = 0.0 + aStep * 0.35;
  }

  if (extra.armor != null) armor = Number(extra.armor) || 0;
  armor = Math.round(Math.max(0, armor * wmod.armorMul) * 10) / 10;

  const bossMul = isBoss ? 1.55 : type === ENEMY_TYPES.ELITE ? 1.20 : 1.0;
  maxHp = Math.round(maxHp * mul * bossMul * (isBoss ? 1.0 : wmod.hpMul));

  // 속도 수정 (보스는 웨이브 속도 영향 적게)
  speed = Math.round(speed * (isBoss ? 1.0 : wmod.speedMul));

  // 랩 감소 (RUSH/PHANTOM 타입: 빨리 코어로 도달)
  if (!isBoss && wmod.lapReduce > 0) {
    maxLaps = Math.max(1, maxLaps - wmod.lapReduce);
  }

  // 웨이브 타입별 색상 힌트 (엘리트/미니언에 살짝 색조 적용)
  if (!isBoss) {
    if (waveType === WAVE_TYPE.ARMORED || waveType === WAVE_TYPE.SIEGE) {
      color = type === ENEMY_TYPES.ELITE ? "#b8c0cc" : "#8d99ae";
    } else if (waveType === WAVE_TYPE.RUSH || waveType === WAVE_TYPE.PHANTOM) {
      color = type === ENEMY_TYPES.ELITE ? "#f8961e" : "#f4a261";
    } else if (waveType === WAVE_TYPE.SWARM) {
      color = type === ENEMY_TYPES.ELITE ? "#e76f51" : "#e63946";
    }
  }

  const en = {
    id: id(),
    type,
    isBoss,
    waveType,

    x: path.x,
    y: path.y,

    dist: 0,
    laps: 0,
    maxLaps,
    rushing: false,

    hp: maxHp,
    maxHp,
    speed,
    coreDmg,
    radius,
    color,

    armor,

    slows: [],

    hitFlash: 0,
    ricochetPopupCd: 0,
  };

  return Object.assign(en, extra);
}

/**
 * ELITE_VANGUARD 웨이브: 첫 페이지는 엘리트만 스폰
 */
export function pickEnemyTypeForWave(waveType, stage, pageIndex, spawnIndexInPage) {
  const weights = WAVE_SPAWN_WEIGHTS[waveType] || WAVE_SPAWN_WEIGHTS[WAVE_TYPE.NORMAL];

  // 엘리트 등장 최소 스테이지 체크
  const eliteMinStage = 6;
  if (stage < eliteMinStage) {
    return ENEMY_TYPES.MINION;
  }

  // ELITE_VANGUARD: 첫 페이지는 엘리트 전용
  if (waveType === WAVE_TYPE.ELITE_VANGUARD && pageIndex === 0) {
    return ENEMY_TYPES.ELITE;
  }

  // SPLIT: 홀수/짝수 인덱스별로 다른 타입
  if (waveType === WAVE_TYPE.SPLIT) {
    return spawnIndexInPage % 2 === 0 ? ENEMY_TYPES.ELITE : ENEMY_TYPES.MINION;
  }

  // 일반 가중치 추첨
  const r = Math.random();
  return r < weights[0] ? ENEMY_TYPES.MINION : ENEMY_TYPES.ELITE;
}
