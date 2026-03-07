// Lotto TD – Skill Tree v4
// 4개 트리 (공격력/공격속도/크리티컬/연쇄), 레어리티 등급, 레벨 1-20

export const META_STORAGE_KEY = "lotto_td_meta_v4";
export const META_VERSION     = 4;

export const TREE_KEYS  = ["ATK", "ASPD", "CRIT", "CHAIN"];
export const TREE_NAMES = { ATK:"공격력", ASPD:"공격속도", CRIT:"크리티컬", CHAIN:"연쇄" };
export const TREE_ICONS = { ATK:"⚔",    ASPD:"≫",       CRIT:"✦",       CHAIN:"∞"    };
export const TREE_COLORS= { ATK:"#ff6b6b", ASPD:"#74c0fc", CRIT:"#e040fb", CHAIN:"#ffd43b" };

export const NODE_RARITY = {
  COMMON:"common", UNCOMMON:"uncommon", RARE:"rare", EPIC:"epic", LEGENDARY:"legendary",
};
export const RARITY_COLOR = {
  common:"#9e9e9e", uncommon:"#4caf50", rare:"#2979ff", epic:"#d500f9", legendary:"#ffd43b",
};
export const RARITY_BASE_COST = {
  common:8, uncommon:18, rare:40, epic:85, legendary:170,
};

/** XP cost to advance a node from (lv-1) → lv */
export function levelCost(rarity, lv) {
  const base = RARITY_BASE_COST[rarity] ?? 8;
  return Math.round(base * lv * Math.pow(1.15, lv - 1));
}

// ─── Node definitions ────────────────────────────────────────────────────────

function n(id, tree, parent, name, rarity, eff, glyph) {
  return { id, tree, parent, name, rarity, eff, glyph: glyph||"·", maxLevel:20 };
}
function ev(kind, value) { return { kind, value }; }
function multi(...effects) { return { kind:"MULTI", effects }; }

// ── ATK Tree (공격력) ─────────────────────────────────────────────────────────
function buildATK() {
  const T = "ATK";
  return [
    n("atk_r",  T,null,     "공격의 시작",   "common",    ev("DMG_PCT",0.005),                                                           "⚔"),
    // Branch A – raw damage
    n("atk_a1", T,"atk_r",  "기초 훈련",     "common",    ev("DMG_PCT",0.007),                                                           "⚔"),
    n("atk_a2", T,"atk_a1", "화력 강화",     "uncommon",  ev("DMG_PCT",0.010),                                                           "⚔"),
    n("atk_a3", T,"atk_a2", "집중 화력",     "uncommon",  ev("DMG_PCT",0.013),                                                           "⚔"),
    n("atk_a4", T,"atk_a3", "화염의 의지",   "rare",      ev("DMG_PCT",0.018),                                                           "🔥"),
    n("atk_a5", T,"atk_a4", "파괴자의 길",   "epic",      ev("DMG_PCT",0.026),                                                           "💥"),
    n("atk_a6", T,"atk_a5", "파괴의 망치",   "legendary", ev("DMG_PCT",0.040),                                                           "⚔"),
    n("atk_a7", T,"atk_a2", "연속 타격",     "uncommon",  multi(ev("DMG_PCT",0.008),ev("BOSS_DMG_PCT",0.003)),                            "⚔"),
    n("atk_a8", T,"atk_a7", "집중 포화",     "rare",      multi(ev("DMG_PCT",0.012),ev("BOSS_DMG_PCT",0.005)),                            "💥"),
    n("atk_a9", T,"atk_a8", "화염 폭풍",     "epic",      multi(ev("DMG_PCT",0.020),ev("BOSS_DMG_PCT",0.010)),                            "🔥"),
    n("atk_a10",T,"atk_a3", "전쟁의 기운",   "rare",      multi(ev("DMG_PCT",0.015),ev("PRESSURE_DMG_PCT",0.008)),                        "⚔"),
    n("atk_a11",T,"atk_a4", "불굴의 화력",   "epic",      multi(ev("DMG_PCT",0.022),ev("PRESSURE_DMG_PCT",0.010),ev("BOSS_DMG_PCT",0.005)),"💥"),
    // Branch B – boss / elite
    n("atk_b1", T,"atk_r",  "보스 추적",     "common",    ev("BOSS_DMG_PCT",0.005),                                                      "👑"),
    n("atk_b2", T,"atk_b1", "보스 감지",     "uncommon",  ev("BOSS_DMG_PCT",0.008),                                                      "👑"),
    n("atk_b3", T,"atk_b2", "보스 연구",     "uncommon",  ev("BOSS_DMG_PCT",0.012),                                                      "👑"),
    n("atk_b4", T,"atk_b3", "보스 압박",     "rare",      ev("BOSS_DMG_PCT",0.018),                                                      "👑"),
    n("atk_b5", T,"atk_b4", "보스 파괴자",   "epic",      ev("BOSS_DMG_PCT",0.026),                                                      "👑"),
    n("atk_b6", T,"atk_b5", "보스 학살자",   "legendary", ev("BOSS_DMG_PCT",0.040),                                                      "♔"),
    n("atk_b7", T,"atk_b2", "엘리트 추적",   "uncommon",  ev("ELITE_DMG_PCT",0.008),                                                     "★"),
    n("atk_b8", T,"atk_b7", "엘리트 분쇄",   "rare",      ev("ELITE_DMG_PCT",0.015),                                                     "★"),
    n("atk_b9", T,"atk_b8", "엘리트 파괴자", "epic",      ev("ELITE_DMG_PCT",0.025),                                                     "★"),
    n("atk_b10",T,"atk_b9", "엘리트 분쇄기", "legendary", ev("ELITE_DMG_PCT",0.040),                                                     "★"),
    n("atk_b11",T,"atk_b3", "정밀 사격",     "rare",      multi(ev("BOSS_DMG_PCT",0.012),ev("ELITE_DMG_PCT",0.006)),                      "👑"),
    // Branch C – execute
    n("atk_c1", T,"atk_r",  "처형 준비",     "common",    ev("EXECUTE_DMG_PCT",0.005),                                                   "†"),
    n("atk_c2", T,"atk_c1", "처형 기술",     "uncommon",  ev("EXECUTE_DMG_PCT",0.008),                                                   "†"),
    n("atk_c3", T,"atk_c2", "처형 전문가",   "rare",      ev("EXECUTE_DMG_PCT",0.015),                                                   "†"),
    n("atk_c4", T,"atk_c3", "처형 마스터",   "epic",      ev("EXECUTE_DMG_PCT",0.025),                                                   "†"),
    n("atk_c5", T,"atk_c4", "처형자의 검",   "legendary", ev("EXECUTE_DMG_PCT",0.040),                                                   "†"),
    n("atk_c6", T,"atk_c2", "냉혹한 판단",   "uncommon",  multi(ev("EXECUTE_DMG_PCT",0.006),ev("DMG_PCT",0.003)),                         "†"),
    n("atk_c7", T,"atk_c6", "냉혹한 사냥꾼", "rare",      multi(ev("EXECUTE_DMG_PCT",0.010),ev("BOSS_DMG_PCT",0.005)),                    "†"),
    // Branch D – pressure / area
    n("atk_d1", T,"atk_r",  "압박 훈련",     "common",    ev("PRESSURE_DMG_PCT",0.005),                                                  "◈"),
    n("atk_d2", T,"atk_d1", "압박 강화",     "uncommon",  ev("PRESSURE_DMG_PCT",0.008),                                                  "◈"),
    n("atk_d3", T,"atk_d2", "압박 마스터",   "rare",      ev("PRESSURE_DMG_PCT",0.015),                                                  "◈"),
    n("atk_d4", T,"atk_d3", "극한 압박",     "epic",      multi(ev("PRESSURE_DMG_PCT",0.022),ev("DMG_PCT",0.006)),                        "◈"),
    n("atk_d5", T,"atk_d4", "전장의 왕",     "legendary", multi(ev("PRESSURE_DMG_PCT",0.033),ev("DMG_PCT",0.010),ev("ELITE_DMG_PCT",0.008)),"♛"),
    n("atk_d6", T,"atk_d2", "전장 통제",     "uncommon",  multi(ev("PRESSURE_DMG_PCT",0.007),ev("ELITE_DMG_PCT",0.004)),                  "◈"),
    n("atk_d7", T,"atk_d6", "전장 지배",     "rare",      multi(ev("PRESSURE_DMG_PCT",0.012),ev("ELITE_DMG_PCT",0.008)),                  "◈"),
  ];
}

// ── ASPD Tree (공격속도) ──────────────────────────────────────────────────────
function buildASPD() {
  const T = "ASPD";
  return [
    n("aspd_r",  T,null,      "속도의 각성",   "common",    ev("HOT_ASPD_ADD",0.005),                                            "≫"),
    // Branch A – HOT aspd
    n("aspd_a1", T,"aspd_r",  "반응 향상",     "common",    ev("HOT_ASPD_ADD",0.007),                                            "≫"),
    n("aspd_a2", T,"aspd_a1", "빠른 준비",     "uncommon",  ev("HOT_ASPD_ADD",0.010),                                            "≫"),
    n("aspd_a3", T,"aspd_a2", "고속 연사",     "uncommon",  ev("HOT_ASPD_ADD",0.013),                                            "≫"),
    n("aspd_a4", T,"aspd_a3", "속공 마스터",   "rare",      ev("HOT_ASPD_ADD",0.018),                                            "⚡"),
    n("aspd_a5", T,"aspd_a4", "폭풍 연사",     "epic",      ev("HOT_ASPD_ADD",0.026),                                            "⚡"),
    n("aspd_a6", T,"aspd_a5", "공속의 폭풍",   "legendary", ev("HOT_ASPD_ADD",0.040),                                            "≫"),
    n("aspd_a7", T,"aspd_a2", "HOT 안정화",    "uncommon",  multi(ev("HOT_ASPD_ADD",0.008),ev("HOT_CRIT_ADD",0.002)),            "≫"),
    n("aspd_a8", T,"aspd_a7", "HOT 과부하",    "rare",      multi(ev("HOT_ASPD_ADD",0.012),ev("HOT_CRIT_ADD",0.003)),            "⚡"),
    n("aspd_a9", T,"aspd_a8", "HOT 마스터",    "epic",      multi(ev("HOT_ASPD_ADD",0.020),ev("HOT_CRIT_ADD",0.005)),            "⚡"),
    n("aspd_a10",T,"aspd_a3", "HOT 극한",      "rare",      ev("HOT_ASPD_ADD",0.016),                                            "⚡"),
    n("aspd_a11",T,"aspd_a4", "폭발 속도",     "epic",      multi(ev("HOT_ASPD_ADD",0.022),ev("CD_REDUCE_PCT",0.005)),           "⚡"),
    // Branch B – cooldown
    n("aspd_b1", T,"aspd_r",  "자동 서보",     "common",    ev("CD_REDUCE_PCT",0.003),                                           "⟳"),
    n("aspd_b2", T,"aspd_b1", "향상 서보",     "uncommon",  ev("CD_REDUCE_PCT",0.005),                                           "⟳"),
    n("aspd_b3", T,"aspd_b2", "냉각 장치",     "uncommon",  ev("CD_REDUCE_PCT",0.007),                                           "⟳"),
    n("aspd_b4", T,"aspd_b3", "서보 오버클럭", "rare",      ev("CD_REDUCE_PCT",0.010),                                           "⟳"),
    n("aspd_b5", T,"aspd_b4", "극한 냉각",     "epic",      ev("CD_REDUCE_PCT",0.015),                                           "⟳"),
    n("aspd_b6", T,"aspd_b5", "찰나의 사수",   "legendary", ev("CD_REDUCE_PCT",0.022),                                           "⟳"),
    n("aspd_b7", T,"aspd_b2", "준비 단축",     "uncommon",  multi(ev("CD_REDUCE_PCT",0.004),ev("HOT_ASPD_ADD",0.003)),           "⟳"),
    n("aspd_b8", T,"aspd_b7", "빠른 재장전",   "rare",      multi(ev("CD_REDUCE_PCT",0.007),ev("HOT_ASPD_ADD",0.005)),           "⟳"),
    n("aspd_b9", T,"aspd_b8", "즉시 재장전",   "epic",      multi(ev("CD_REDUCE_PCT",0.011),ev("HOT_ASPD_ADD",0.009)),           "⟳"),
    n("aspd_b10",T,"aspd_b3", "서보 강화",     "rare",      ev("CD_REDUCE_PCT",0.009),                                           "⟳"),
    // Branch C – speed+damage synergy
    n("aspd_c1", T,"aspd_r",  "전투 동조",     "common",    multi(ev("HOT_ASPD_ADD",0.004),ev("DMG_PCT",0.002)),                  "≫"),
    n("aspd_c2", T,"aspd_c1", "전투 리듬",     "uncommon",  multi(ev("HOT_ASPD_ADD",0.006),ev("DMG_PCT",0.003)),                  "≫"),
    n("aspd_c3", T,"aspd_c2", "완벽한 리듬",   "rare",      multi(ev("HOT_ASPD_ADD",0.010),ev("DMG_PCT",0.005)),                  "⚡"),
    n("aspd_c4", T,"aspd_c3", "전투의 신",     "epic",      multi(ev("HOT_ASPD_ADD",0.016),ev("CD_REDUCE_PCT",0.007),ev("DMG_PCT",0.006)),"⚡"),
    n("aspd_c5", T,"aspd_c4", "광속의 사수",   "legendary", multi(ev("HOT_ASPD_ADD",0.025),ev("CD_REDUCE_PCT",0.011),ev("DMG_PCT",0.009)),"≫"),
    n("aspd_c6", T,"aspd_c2", "속사 준비",     "uncommon",  multi(ev("HOT_ASPD_ADD",0.005),ev("CD_REDUCE_PCT",0.003)),            "≫"),
    n("aspd_c7", T,"aspd_c6", "속사 마스터",   "rare",      multi(ev("HOT_ASPD_ADD",0.009),ev("CD_REDUCE_PCT",0.005)),            "⚡"),
    n("aspd_c8", T,"aspd_c7", "속사 폭풍",     "epic",      multi(ev("HOT_ASPD_ADD",0.015),ev("CD_REDUCE_PCT",0.009)),            "⚡"),
    n("aspd_c9", T,"aspd_c2", "리듬 가속",     "uncommon",  ev("HOT_ASPD_ADD",0.006),                                            "≫"),
    n("aspd_c10",T,"aspd_c9", "연속 전투",     "rare",      multi(ev("HOT_ASPD_ADD",0.010),ev("HOT_CRIT_ADD",0.002)),            "⚡"),
  ];
}

// ── CRIT Tree (크리티컬) ──────────────────────────────────────────────────────
function buildCRIT() {
  const T = "CRIT";
  return [
    n("crit_r",  T,null,      "급소 감각",     "common",    ev("CRIT_CHANCE_ADD",0.002),                                                    "✦"),
    // Branch A – crit chance
    n("crit_a1", T,"crit_r",  "급소 훈련",     "common",    ev("CRIT_CHANCE_ADD",0.003),                                                    "✦"),
    n("crit_a2", T,"crit_a1", "정밀 타격",     "uncommon",  ev("CRIT_CHANCE_ADD",0.004),                                                    "✦"),
    n("crit_a3", T,"crit_a2", "치명적 정밀",   "uncommon",  ev("CRIT_CHANCE_ADD",0.005),                                                    "✦"),
    n("crit_a4", T,"crit_a3", "급소 마스터",   "rare",      ev("CRIT_CHANCE_ADD",0.007),                                                    "💥"),
    n("crit_a5", T,"crit_a4", "치명적 감각",   "epic",      ev("CRIT_CHANCE_ADD",0.010),                                                    "💥"),
    n("crit_a6", T,"crit_a5", "크리티컬 신",   "legendary", ev("CRIT_CHANCE_ADD",0.015),                                                    "✦"),
    n("crit_a7", T,"crit_a2", "집중된 시선",   "uncommon",  multi(ev("CRIT_CHANCE_ADD",0.003),ev("CRIT_MULT_ADD",0.015)),                   "✦"),
    n("crit_a8", T,"crit_a7", "날카로운 직관", "rare",      multi(ev("CRIT_CHANCE_ADD",0.005),ev("CRIT_MULT_ADD",0.025)),                   "💥"),
    n("crit_a9", T,"crit_a8", "본능적 급소",   "epic",      multi(ev("CRIT_CHANCE_ADD",0.008),ev("CRIT_MULT_ADD",0.040)),                   "💥"),
    n("crit_a10",T,"crit_a3", "연속 급소",     "rare",      ev("CRIT_CHANCE_ADD",0.006),                                                    "✦"),
    n("crit_a11",T,"crit_a4", "급소 특화",     "epic",      multi(ev("CRIT_CHANCE_ADD",0.009),ev("BOSS_DMG_PCT",0.004)),                    "💥"),
    // Branch B – crit mult
    n("crit_b1", T,"crit_r",  "배율 훈련",     "common",    ev("CRIT_MULT_ADD",0.015),                                                      "◈"),
    n("crit_b2", T,"crit_b1", "배율 강화",     "uncommon",  ev("CRIT_MULT_ADD",0.022),                                                      "◈"),
    n("crit_b3", T,"crit_b2", "치명 배율",     "uncommon",  ev("CRIT_MULT_ADD",0.030),                                                      "◈"),
    n("crit_b4", T,"crit_b3", "강력한 일격",   "rare",      ev("CRIT_MULT_ADD",0.045),                                                      "💥"),
    n("crit_b5", T,"crit_b4", "파괴적 일격",   "epic",      ev("CRIT_MULT_ADD",0.065),                                                      "💥"),
    n("crit_b6", T,"crit_b5", "크리티컬 폭발", "legendary", ev("CRIT_MULT_ADD",0.100),                                                      "✦"),
    n("crit_b7", T,"crit_b2", "조준 강화",     "uncommon",  multi(ev("CRIT_MULT_ADD",0.018),ev("CRIT_CHANCE_ADD",0.002)),                   "◈"),
    n("crit_b8", T,"crit_b7", "완벽한 조준",   "rare",      multi(ev("CRIT_MULT_ADD",0.032),ev("CRIT_CHANCE_ADD",0.003)),                   "💥"),
    n("crit_b9", T,"crit_b8", "신의 조준",     "epic",      multi(ev("CRIT_MULT_ADD",0.055),ev("CRIT_CHANCE_ADD",0.005)),                   "💥"),
    n("crit_b10",T,"crit_b3", "배율 특화",     "rare",      ev("CRIT_MULT_ADD",0.040),                                                      "◈"),
    // Branch C – HOT crit
    n("crit_c1", T,"crit_r",  "HOT 치명",      "common",    ev("HOT_CRIT_ADD",0.003),                                                       "⚡"),
    n("crit_c2", T,"crit_c1", "HOT 치명 강화", "uncommon",  ev("HOT_CRIT_ADD",0.005),                                                       "⚡"),
    n("crit_c3", T,"crit_c2", "HOT 치명 마스터","rare",     ev("HOT_CRIT_ADD",0.008),                                                       "⚡"),
    n("crit_c4", T,"crit_c3", "HOT 치명 폭발", "epic",      ev("HOT_CRIT_ADD",0.012),                                                       "⚡"),
    n("crit_c5", T,"crit_c4", "HOT 치명 신화", "legendary", ev("HOT_CRIT_ADD",0.018),                                                       "⚡"),
    n("crit_c6", T,"crit_c2", "HOT 시너지",    "uncommon",  multi(ev("HOT_CRIT_ADD",0.004),ev("CRIT_CHANCE_ADD",0.002)),                    "⚡"),
    n("crit_c7", T,"crit_c6", "HOT 공명",      "rare",      multi(ev("HOT_CRIT_ADD",0.007),ev("CRIT_CHANCE_ADD",0.003),ev("CRIT_MULT_ADD",0.015)),"⚡"),
    // Branch D – boss/elite crit
    n("crit_d1", T,"crit_r",  "보스 급소",     "common",    multi(ev("CRIT_CHANCE_ADD",0.002),ev("BOSS_DMG_PCT",0.003)),                    "👑"),
    n("crit_d2", T,"crit_d1", "보스 치명",     "uncommon",  multi(ev("CRIT_CHANCE_ADD",0.003),ev("BOSS_DMG_PCT",0.004)),                    "👑"),
    n("crit_d3", T,"crit_d2", "보스 약점 공략","rare",      multi(ev("CRIT_CHANCE_ADD",0.004),ev("BOSS_DMG_PCT",0.007),ev("CRIT_MULT_ADD",0.018)),"👑"),
    n("crit_d4", T,"crit_d3", "처형 급소",     "epic",      multi(ev("CRIT_CHANCE_ADD",0.006),ev("BOSS_DMG_PCT",0.010),ev("CRIT_MULT_ADD",0.035)),"👑"),
    n("crit_d5", T,"crit_d4", "절대 급소",     "legendary", multi(ev("CRIT_CHANCE_ADD",0.012),ev("CRIT_MULT_ADD",0.060),ev("BOSS_DMG_PCT",0.012)),"✦"),
    n("crit_d6", T,"crit_d2", "엘리트 급소",   "uncommon",  multi(ev("CRIT_CHANCE_ADD",0.002),ev("ELITE_DMG_PCT",0.003)),                   "★"),
    n("crit_d7", T,"crit_d6", "엘리트 치명",   "rare",      multi(ev("CRIT_CHANCE_ADD",0.003),ev("ELITE_DMG_PCT",0.006),ev("CRIT_MULT_ADD",0.018)),"★"),
  ];
}

// ── CHAIN Tree (연쇄) ─────────────────────────────────────────────────────────
function buildCHAIN() {
  const T = "CHAIN";
  return [
    n("chn_r",   T,null,      "연쇄의 본능",   "common",    ev("MULTI_HIT_CHANCE",0.005),                                                     "∞"),
    // Branch A – multi-hit
    n("chn_a1",  T,"chn_r",   "연속 타격",     "common",    ev("MULTI_HIT_CHANCE",0.007),                                                     "∞"),
    n("chn_a2",  T,"chn_a1",  "연속 사격",     "uncommon",  ev("MULTI_HIT_CHANCE",0.010),                                                     "∞"),
    n("chn_a3",  T,"chn_a2",  "다중 연사",     "uncommon",  ev("MULTI_HIT_CHANCE",0.014),                                                     "∞"),
    n("chn_a4",  T,"chn_a3",  "연사 마스터",   "rare",      ev("MULTI_HIT_CHANCE",0.020),                                                     "⚡"),
    n("chn_a5",  T,"chn_a4",  "폭풍 연사",     "epic",      ev("MULTI_HIT_CHANCE",0.030),                                                     "⚡"),
    n("chn_a6",  T,"chn_a5",  "다중 폭발",     "legendary", ev("MULTI_HIT_CHANCE",0.048),                                                     "∞"),
    n("chn_a7",  T,"chn_a2",  "연속 준비",     "uncommon",  multi(ev("MULTI_HIT_CHANCE",0.008),ev("PEN_ADD",0.010)),                          "∞"),
    n("chn_a8",  T,"chn_a7",  "연속 강화",     "rare",      multi(ev("MULTI_HIT_CHANCE",0.014),ev("PEN_ADD",0.018)),                          "⚡"),
    n("chn_a9",  T,"chn_a8",  "연속 극한",     "epic",      multi(ev("MULTI_HIT_CHANCE",0.022),ev("PEN_ADD",0.028)),                          "⚡"),
    n("chn_a10", T,"chn_a3",  "연쇄 폭격",     "rare",      ev("MULTI_HIT_CHANCE",0.018),                                                     "∞"),
    n("chn_a11", T,"chn_a4",  "무한 연쇄",     "epic",      multi(ev("MULTI_HIT_CHANCE",0.026),ev("BOSS_EXTRA_LEGEND_CHANCE",0.004)),          "⚡"),
    // Branch B – penetration
    n("chn_b1",  T,"chn_r",   "관통 훈련",     "common",    ev("PEN_ADD",0.015),                                                              "↣"),
    n("chn_b2",  T,"chn_b1",  "관통 강화",     "uncommon",  ev("PEN_ADD",0.022),                                                              "↣"),
    n("chn_b3",  T,"chn_b2",  "장갑 파쇄",     "uncommon",  ev("PEN_ADD",0.030),                                                              "↣"),
    n("chn_b4",  T,"chn_b3",  "장갑 관통",     "rare",      ev("PEN_ADD",0.045),                                                              "↣"),
    n("chn_b5",  T,"chn_b4",  "관통의 화살",   "epic",      ev("PEN_ADD",0.065),                                                              "↣"),
    n("chn_b6",  T,"chn_b5",  "관통의 신화",   "legendary", ev("PEN_ADD",0.100),                                                              "↣"),
    n("chn_b7",  T,"chn_b2",  "연쇄 관통",     "uncommon",  multi(ev("PEN_ADD",0.020),ev("MULTI_HIT_CHANCE",0.005)),                          "↣"),
    n("chn_b8",  T,"chn_b7",  "연쇄 파쇄",     "rare",      multi(ev("PEN_ADD",0.035),ev("MULTI_HIT_CHANCE",0.008)),                          "↣"),
    n("chn_b9",  T,"chn_b3",  "관통 집중",     "rare",      ev("PEN_ADD",0.038),                                                              "↣"),
    // Branch C – luck / rarity
    n("chn_c1",  T,"chn_r",   "도박사의 감각", "common",    ev("RARITY_UP_ADD",0.003),                                                        "◆"),
    n("chn_c2",  T,"chn_c1",  "행운의 감각",   "uncommon",  ev("RARITY_UP_ADD",0.005),                                                        "◆"),
    n("chn_c3",  T,"chn_c2",  "도박의 신",     "rare",      ev("RARITY_UP_ADD",0.008),                                                        "◆"),
    n("chn_c4",  T,"chn_c3",  "황금 손길",     "epic",      ev("RARITY_UP_ADD",0.012),                                                        "◆"),
    n("chn_c5",  T,"chn_c4",  "인생역전",      "legendary", ev("RARITY_UP_ADD",0.020),                                                        "◆"),
    n("chn_c6",  T,"chn_c2",  "재투자",        "uncommon",  ev("START_COMMON_ADD",0.3),                                                       "◇"),
    n("chn_c7",  T,"chn_c6",  "황금 투자",     "rare",      multi(ev("START_COMMON_ADD",0.5),ev("START_RARE_ADD",0.2)),                       "◇"),
    n("chn_c8",  T,"chn_c7",  "백만장자",      "epic",      multi(ev("START_RARE_ADD",0.5),ev("BOSS_EXTRA_LEGEND_CHANCE",0.005)),              "◆"),
    n("chn_c9",  T,"chn_c3",  "환급의 여신",   "rare",      ev("REROLL_REFUND_CHANCE",0.008),                                                 "◇"),
    // Branch D – boss legend / jackpot
    n("chn_d1",  T,"chn_r",   "보스 전설",     "common",    ev("BOSS_EXTRA_LEGEND_CHANCE",0.003),                                             "♔"),
    n("chn_d2",  T,"chn_d1",  "전설 사냥",     "uncommon",  ev("BOSS_EXTRA_LEGEND_CHANCE",0.005),                                             "♔"),
    n("chn_d3",  T,"chn_d2",  "황금 사냥",     "rare",      ev("BOSS_EXTRA_LEGEND_CHANCE",0.008),                                             "♔"),
    n("chn_d4",  T,"chn_d3",  "연쇄 반응",     "epic",      multi(ev("BOSS_EXTRA_LEGEND_CHANCE",0.012),ev("MYTHIC_JACKPOT_CHANCE",0.005)),     "∞"),
    n("chn_d5",  T,"chn_d4",  "연쇄 폭발",     "legendary", multi(ev("BOSS_EXTRA_LEGEND_CHANCE",0.020),ev("MYTHIC_JACKPOT_CHANCE",0.010)),     "∞"),
    n("chn_d6",  T,"chn_d2",  "행운 배가",     "uncommon",  multi(ev("BOSS_EXTRA_LEGEND_CHANCE",0.004),ev("RARITY_UP_ADD",0.003)),             "♔"),
    n("chn_d7",  T,"chn_d6",  "연금술사",      "rare",      multi(ev("BOSS_EXTRA_LEGEND_CHANCE",0.007),ev("RARITY_UP_ADD",0.005),ev("MYTHIC_JACKPOT_CHANCE",0.003)),"♔"),
  ];
}

// ─── Flatten all nodes & build map ──────────────────────────────────────────

export const PASSIVE_NODES = [
  ...buildATK(), ...buildASPD(), ...buildCRIT(), ...buildCHAIN(),
];
export const PASSIVE_NODE_MAP = new Map(PASSIVE_NODES.map(nd => [nd.id, nd]));

export function getTreeNodes(treeKey) {
  return PASSIVE_NODES.filter(nd => nd.tree === treeKey);
}

// ─── Layout computation ──────────────────────────────────────────────────────

const L_SX = 115;  // px per subtree-width unit
const L_SY = 130;  // px per depth level
const L_MG = 70;   // margin

function computeLayout(nodes) {
  const childrenOf = new Map(nodes.map(nd => [nd.id, []]));
  const nodeById   = new Map(nodes.map(nd => [nd.id, nd]));
  let root = null;

  for (const nd of nodes) {
    if (!nd.parent) { root = nd; continue; }
    const list = childrenOf.get(nd.parent);
    if (list) list.push(nd.id);
  }
  if (!root) return new Map();

  const widths = new Map();
  function calcW(id) {
    const ch = childrenOf.get(id) ?? [];
    if (!ch.length) { widths.set(id, 1); return 1; }
    const w = ch.reduce((s, c) => s + calcW(c), 0);
    widths.set(id, w);
    return w;
  }
  calcW(root.id);

  const pos = new Map();
  function place(id, depth, left) {
    const w = widths.get(id) ?? 1;
    pos.set(id, { x: Math.round(L_MG + (left + w / 2) * L_SX),
                  y: Math.round(L_MG + depth * L_SY) });
    const ch = childrenOf.get(id) ?? [];
    let cx = left;
    for (const c of ch) {
      place(c, depth + 1, cx);
      cx += widths.get(c) ?? 1;
    }
  }
  place(root.id, 0, 0);
  return pos;
}

// Precomputed positions for all trees
export const NODE_POSITIONS = new Map();
export const TREE_BOUNDS    = new Map();

for (const tk of TREE_KEYS) {
  const tNodes  = getTreeNodes(tk);
  const layout  = computeLayout(tNodes);
  let maxX = 0, maxY = 0;
  for (const [id, p] of layout) {
    NODE_POSITIONS.set(id, p);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  TREE_BOUNDS.set(tk, { w: maxX + L_MG, h: maxY + L_MG });
}

// ─── State management ────────────────────────────────────────────────────────

export function defaultMetaState() {
  return { v: META_VERSION, xp: 0, levels: {} };
}

export function loadMetaState() {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj?.v === META_VERSION) {
        const out = defaultMetaState();
        out.xp     = Math.max(0, Math.floor(obj.xp ?? 0));
        out.levels = (typeof obj.levels === "object" && obj.levels) ? obj.levels : {};
        return out;
      }
    }
    // Migrate: preserve XP, reset nodes
    for (const k of ["lotto_td_meta_v3","lotto_td_meta_v2","lotto_td_meta_v1"]) {
      const leg = localStorage.getItem(k);
      if (leg) {
        const obj = JSON.parse(leg);
        return { v: META_VERSION, xp: Math.max(0, Math.floor(obj?.xp ?? 0)), levels: {} };
      }
    }
  } catch { /**/ }
  return defaultMetaState();
}

export function saveMetaState(meta) {
  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify({
      v: META_VERSION, xp: meta.xp ?? 0, levels: meta.levels ?? {},
    }));
  } catch { /**/ }
}

export function getLevel(meta, id)   { return (meta.levels ?? {})[id] ?? 0; }
export function isUnlocked(meta, id) { return getLevel(meta, id) > 0; }

/** Can level up from current level to current+1 */
export function canLevelUp(meta, nodeId) {
  const nd = PASSIVE_NODE_MAP.get(nodeId);
  if (!nd) return { ok:false, reason:"NOT_FOUND" };
  const lv = getLevel(meta, nodeId);
  if (lv >= nd.maxLevel) return { ok:false, reason:"MAX_LEVEL", lv };

  // Parent must be unlocked (roots have no parent)
  if (nd.parent && !isUnlocked(meta, nd.parent))
    return { ok:false, reason:"PARENT_LOCKED" };

  const cost = levelCost(nd.rarity, lv + 1);
  if ((meta.xp ?? 0) < cost) return { ok:false, reason:"NO_XP", cost };
  return { ok:true, cost, lv };
}

/** Can level down (decrease by 1). Level → 0 requires no children be unlocked. */
export function canLevelDown(meta, nodeId) {
  const nd = PASSIVE_NODE_MAP.get(nodeId);
  if (!nd) return { ok:false, reason:"NOT_FOUND" };
  const lv = getLevel(meta, nodeId);
  if (lv <= 0) return { ok:false, reason:"NOT_PURCHASED" };

  if (lv === 1) {
    // Check no child is unlocked
    const children = PASSIVE_NODES.filter(n => n.parent === nodeId);
    if (children.some(c => isUnlocked(meta, c.id)))
      return { ok:false, reason:"HAS_CHILDREN" };
  }
  const refund = levelCost(nd.rarity, lv);
  return { ok:true, refund, lv };
}

export function levelUpNode(meta, nodeId) {
  const chk = canLevelUp(meta, nodeId);
  if (!chk.ok) return false;
  if (!meta.levels) meta.levels = {};
  meta.levels[nodeId] = (meta.levels[nodeId] ?? 0) + 1;
  meta.xp = Math.max(0, (meta.xp ?? 0) - chk.cost);
  return true;
}

export function levelDownNode(meta, nodeId) {
  const chk = canLevelDown(meta, nodeId);
  if (!chk.ok) return false;
  meta.levels[nodeId] = chk.lv - 1;
  if (meta.levels[nodeId] === 0) delete meta.levels[nodeId];
  meta.xp = (meta.xp ?? 0) + chk.refund;
  return true;
}

/** For badge: true if any node can be leveled up */
export function canAllocateAny(meta) {
  for (const nd of PASSIVE_NODES) {
    if (canLevelUp(meta, nd.id).ok) return true;
  }
  return false;
}

// ─── Modifier computation ────────────────────────────────────────────────────

function applyEff(mods, eff, lv) {
  if (!eff || lv <= 0) return;
  if (eff.kind === "MULTI") { for (const sub of eff.effects) applyEff(mods, sub, lv); return; }
  const val = eff.value * lv;
  switch (eff.kind) {
    case "DMG_PCT":                  mods.dmgPct               += val; break;
    case "BOSS_DMG_PCT":             mods.bossDmgPct           += val; break;
    case "ELITE_DMG_PCT":            mods.eliteDmgPct          += val; break;
    case "PRESSURE_DMG_PCT":         mods.pressureDmgPct       += val; break;
    case "EXECUTE_DMG_PCT":          mods.executeDmgPct        += val; break;
    case "CRIT_CHANCE_ADD":          mods.critChanceAdd        += val; break;
    case "CRIT_MULT_ADD":            mods.critMultAdd          += val; break;
    case "HOT_ASPD_ADD":             mods.hotAspdAdd           += val; break;
    case "HOT_CRIT_ADD":             mods.hotCritAdd           += val; break;
    case "CD_REDUCE_PCT":            mods.cdReducePct          += val; break;
    case "MULTI_HIT_CHANCE":         mods.multiHitChance       += val; break;
    case "PEN_ADD":                  mods.penAdd               += val; break;
    case "CORE_HP_ADD":              mods.coreHpAdd            += val; break;
    case "START_COMMON_ADD":         mods.startCommonAdd       += val; break;
    case "START_RARE_ADD":           mods.startRareAdd         += val; break;
    case "RARITY_UP_ADD":            mods.rarityUpChance       += val; break;
    case "REROLL_REFUND_CHANCE":     mods.rerollRefundChance   += val; break;
    case "BOSS_EXTRA_LEGEND_CHANCE": mods.bossExtraLegendChance+= val; break;
    case "MYTHIC_JACKPOT_CHANCE":    mods.mythicJackpotChance  += val; break;
    default: break;
  }
}

export function computeSkillMods(meta) {
  const mods = {
    dmgPct:0, bossDmgPct:0, eliteDmgPct:0, pressureDmgPct:0, executeDmgPct:0,
    critChanceAdd:0, critMultAdd:0,
    hotAspdAdd:0, hotCritAdd:0,
    cdReducePct:0,
    multiHitChance:0,
    slowPower:0, penAdd:0,
    coreHpAdd:0, coreDmgMul:1,
    startCommonAdd:0, startRareAdd:0,
    rarityUpChance:0, rerollRefundChance:0, specialRefundChance:0,
    mythicJackpotChance:0, bossExtraLegendChance:0, extraRareChance:0,
  };
  const levels = meta.levels ?? {};
  for (const nd of PASSIVE_NODES) {
    const lv = levels[nd.id] ?? 0;
    if (lv > 0) applyEff(mods, nd.eff, lv);
  }
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  mods.cdReducePct           = clamp(mods.cdReducePct,          -0.15, 0.50);
  mods.critChanceAdd         = clamp(mods.critChanceAdd,         0,    0.50);
  mods.rarityUpChance        = clamp(mods.rarityUpChance,        0,    0.35);
  mods.multiHitChance        = clamp(mods.multiHitChance,        0,    0.80);
  mods.bossExtraLegendChance = clamp(mods.bossExtraLegendChance, 0,    0.80);
  mods.mythicJackpotChance   = clamp(mods.mythicJackpotChance,   0,    0.70);
  return mods;
}
