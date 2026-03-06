export function buildShopItems(state) {
  const common = state.econ.tickets.common ?? 0;
  const rare   = state.econ.tickets.rare   ?? 0;
  const legend = state.econ.tickets.legend ?? 0;
  const isPrep = state.roundPhase === "PREP";
  const hasSel = !!state.selectedKey && state.units.has(state.selectedKey);
  const furyActive     = !!(state.stageFury && state.stageFury.stage === state.stage);
  const critActive     = (state.stageCritBonus ?? 0) > 0;
  const shieldActive   = !!state.coreShield;
  const invincActive   = state.coreInvincible === state.stage;

  return {
    commonItems: [
      // ── 기존 ──
      { id:"C_CORE_PATCH",      icon:"❤️",  title:"코어 수리 +1",        desc:"PREP에서만. 코어 최대치까지.",          cost:3, enabled:common>=3&&isPrep&&state.coreHp<(state.coreHpMax??20), currency:"common" },
      { id:"C_STREAK_PLUS",     icon:"🔥",  title:"연속 리롤 +1스택",     desc:"선택 타워의 리롤 스택 +1.",            cost:2, enabled:common>=2&&hasSel, currency:"common" },
      // ── 신규 ──
      { id:"C_RELOAD_CLEAR",    icon:"⚡",  title:"재장전 해제",           desc:"선택 타워 재장전·과열 즉시 0.",        cost:2, enabled:common>=2&&hasSel, currency:"common" },
      { id:"C_LUCKY_PACK",      icon:"🎁",  title:"행운 꾸러미",           desc:"일반 티켓 즉시 +3.",                   cost:1, enabled:common>=1, currency:"common" },
      { id:"C_TICKET_EXCHANGE", icon:"🔼",  title:"등급 교환",             desc:"일반 5 → 레어 1.",                    cost:5, enabled:common>=5, currency:"common" },
      { id:"C_ASPD_SHARD",      icon:"⚔️", title:"공속 파편",             desc:"선택 타워 공격속도 +12% (영구).",      cost:3, enabled:common>=3&&hasSel, currency:"common" },
      { id:"C_POWER_SHARD",     icon:"💥",  title:"공격 파편",             desc:"선택 타워 공격력 +10% (영구).",        cost:3, enabled:common>=3&&hasSel, currency:"common" },
    ],
    rareItems: [
      // ── 기존 ──
      { id:"R_COMMON_PACK",     icon:"📦",  title:"일반 티켓 +6",          desc:"도박 연료 보충.",                      cost:1, enabled:rare>=1, currency:"rare" },
      { id:"R_HOT_REROLL",      icon:"🔀",  title:"HOT ZONE 재배치",       desc:"이번 스테이지 HOT ZONE 재굴림. (PREP)", cost:1, enabled:rare>=1&&isPrep, currency:"rare" },
      { id:"R_SPECIAL_CHARGE",  icon:"✴️", title:"SPECIAL 충전",          desc:"다음 리롤을 SPECIAL PICK으로.",        cost:2, enabled:rare>=2&&hasSel, currency:"rare" },
      // ── 신규 ──
      { id:"R_EXCHANGE_LEGEND", icon:"👑",  title:"전설 교환",             desc:"레어 3 → 전설 1.",                    cost:3, enabled:rare>=3, currency:"rare" },
      { id:"R_ALL_RELOAD",      icon:"🔄",  title:"전 부대 재정비",         desc:"모든 타워 재장전·과열 즉시 해제.",      cost:1, enabled:rare>=1, currency:"rare" },
      { id:"R_CORE_SHIELD",     icon:"🛡️", title:"코어 방어막",           desc:"다음 코어 피격 1회 무효.",              cost:2, enabled:rare>=2&&!shieldActive, currency:"rare" },
      { id:"R_STAGE_CRIT",      icon:"🎯",  title:"치명파",                desc:"이번 스테이지 전체 치명타율 +10%.",     cost:2, enabled:rare>=2&&!critActive, currency:"rare" },
      { id:"R_POWER_FORGE",     icon:"🔨",  title:"단련",                  desc:"선택 타워 공격력 +15% (영구).",        cost:2, enabled:rare>=2&&hasSel, currency:"rare" },
    ],
    legendItems: [
      // ── 기존 ──
      { id:"L_HOT_OVERDRIVE",   icon:"🌋",  title:"HOT ZONE 오버드라이브", desc:"HOT ZONE 배율 x2. (PREP)",            cost:1, enabled:legend>=1&&isPrep, currency:"legend" },
      { id:"L_STAGE_FURY",      icon:"⚡",  title:"스테이지 광폭",         desc:"공격력 +20%, 공속 +10%.",              cost:1, enabled:legend>=1&&!furyActive, currency:"legend" },
      // ── 신규 ──
      { id:"L_LEGEND_CRACK",    icon:"🔮",  title:"전설 분해",             desc:"전설 1 → 레어 4.",                    cost:1, enabled:legend>=1, currency:"legend" },
      { id:"L_CORE_INVINCIBLE", icon:"💎",  title:"무적 코어",             desc:"이번 스테이지 코어 피격 완전 무효.",    cost:2, enabled:legend>=2&&!invincActive, currency:"legend" },
      { id:"L_FURY_MAX",        icon:"🌟",  title:"초광폭",                desc:"공격력 +40%, 공속 +20% (강화판).",     cost:2, enabled:legend>=2&&!furyActive, currency:"legend" },
      { id:"L_MASS_POWER",      icon:"⚡",  title:"전군 각성",             desc:"모든 타워 공격력 +10% 즉시 영구 적용.", cost:2, enabled:legend>=2, currency:"legend" },
      { id:"L_TIME_FREEZE",     icon:"❄️", title:"시간 정지",             desc:"모든 적 4초간 이동 완전 정지.",         cost:2, enabled:legend>=2, currency:"legend" },
    ],
  };
}
