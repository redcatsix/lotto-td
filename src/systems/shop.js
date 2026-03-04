export function buildShopItems(state) {
  const common = state.econ.tickets.common ?? 0;
  const rare = state.econ.tickets.rare ?? 0;
  const legend = state.econ.tickets.legend ?? 0;
  const isPrep = state.roundPhase === "PREP";
  const hasSel = !!state.selectedKey && state.units.has(state.selectedKey);
  const furyActive = !!(state.stageFury && state.stageFury.stage === state.stage);

  return {
    commonItems: [
      { id: "C_CORE_PATCH", title: "코어 수리 +1", desc: "PREP에서만. 코어 최대치까지.", cost: 3, enabled: common >= 3 && isPrep && state.coreHp < (state.coreHpMax ?? 20), currency: "common" },
      { id: "C_STREAK_PLUS", title: "연속 리롤 +1스택", desc: "선택한 타워의 리롤 스택 +1", cost: 2, enabled: common >= 2 && hasSel, currency: "common" },
    ],
    rareItems: [
      { id: "R_COMMON_PACK", title: "일반 티켓 +6", desc: "도박 연료 보충.", cost: 1, enabled: rare >= 1, currency: "rare" },
      { id: "R_HOT_REROLL", title: "HOT ZONE 재배치", desc: "이번 스테이지 HOT ZONE 재굴림. (PREP)", cost: 1, enabled: rare >= 1 && isPrep, currency: "rare" },
      { id: "R_SPECIAL_CHARGE", title: "SPECIAL 충전", desc: "다음 리롤을 SPECIAL PICK으로.", cost: 2, enabled: rare >= 2 && hasSel, currency: "rare" },
    ],
    legendItems: [
      { id: "L_HOT_OVERDRIVE", title: "HOT ZONE 오버드라이브", desc: "HOT ZONE 배율 x2. (PREP)", cost: 1, enabled: legend >= 1 && isPrep, currency: "legend" },
      { id: "L_STAGE_FURY", title: "스테이지 광폭", desc: "이번 스테이지 공격력 +20%, 공속 +10%.", cost: 1, enabled: legend >= 1 && !furyActive, currency: "legend" },
    ],
  };
}
