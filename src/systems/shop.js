export function buildShopItems(state) {
  const common = state.econ.tickets.common ?? 0;
  const rare   = state.econ.tickets.rare   ?? 0;
  const legend = state.econ.tickets.legend ?? 0;
  const isPrep = state.roundPhase === "PREP";
  const hasSel = !!state.selectedKey && state.units.has(state.selectedKey);
  const u = hasSel ? state.units.get(state.selectedKey) : null;
  const shieldActive = !!state.coreShield;

  return {
    commonItems: [
      { id:"C_CORE_PATCH",      icon:"❤️",  title:"코어 수리 +1",
        desc:"PREP에서만. 코어 최대치까지.",
        cost:3, enabled:common>=3 && isPrep && state.coreHp<(state.coreHpMax??20), currency:"common" },

      { id:"C_STREAK_PLUS",     icon:"🔥",  title:"연속 리롤 +1스택",
        desc:"선택 타워의 리롤 스택 +1.",
        cost:2, enabled:common>=2 && hasSel, currency:"common" },

      { id:"C_TICKET_EXCHANGE", icon:"🔼",  title:"등급 교환",
        desc:"일반 5 → 레어 1.",
        cost:5, enabled:common>=5, currency:"common" },

      { id:"C_ASPD_SHARD",      icon:"⚔️", title:`공속 파편 (${u?._aspdBuyCount??0}/3)`,
        desc:"선택 타워 공격속도 +12% 영구. 타워당 최대 3회.",
        cost:3, enabled:common>=3 && hasSel && (u?._aspdBuyCount??0)<3, currency:"common" },

      { id:"C_POWER_SHARD",     icon:"💥",  title:`공격 파편 (${u?._powerBuyCount??0}/3)`,
        desc:"선택 타워 공격력 +10% 영구. 타워당 최대 3회.",
        cost:3, enabled:common>=3 && hasSel && (u?._powerBuyCount??0)<3, currency:"common" },

      { id:"C_RARE_GAMBLE",     icon:"🎲",  title:"레어 도박",
        desc:"일반 3 소모. 30% 확률로 레어 1 획득.",
        cost:3, enabled:common>=3, currency:"common" },
    ],
    rareItems: [
      { id:"R_COMMON_PACK",     icon:"📦",  title:"일반 티켓 +6",
        desc:"도박 연료 보충.",
        cost:1, enabled:rare>=1, currency:"rare" },

      { id:"R_HOT_REROLL",      icon:"🔀",  title:"HOT ZONE 재배치",
        desc:"이번 스테이지 HOT ZONE 재굴림. (PREP)",
        cost:1, enabled:rare>=1 && isPrep, currency:"rare" },

      { id:"R_SPECIAL_CHARGE",  icon:"✴️", title:"SPECIAL 충전",
        desc:"다음 리롤을 SPECIAL PICK으로.",
        cost:2, enabled:rare>=2 && hasSel, currency:"rare" },

      { id:"R_EXCHANGE_LEGEND", icon:"👑",  title:"전설 교환",
        desc:"레어 3 → 전설 1.",
        cost:3, enabled:rare>=3, currency:"rare" },

      { id:"R_CORE_SHIELD",     icon:"🛡️", title:"코어 방어막",
        desc:"다음 코어 피격 1회 무효.",
        cost:2, enabled:rare>=2 && !shieldActive, currency:"rare" },

      { id:"R_POWER_FORGE",     icon:"🔨",  title:`단련 (${u?._forgeBuyCount??0}/2)`,
        desc:"선택 타워 공격력 +15% 영구. 타워당 최대 2회.",
        cost:2, enabled:rare>=2 && hasSel && (u?._forgeBuyCount??0)<2, currency:"rare" },
    ],
    legendItems: [
      { id:"L_HOT_OVERDRIVE",   icon:"🌋",  title:"HOT ZONE 오버드라이브",
        desc:"HOT ZONE 배율 x2. (PREP)",
        cost:1, enabled:legend>=1 && isPrep, currency:"legend" },

      { id:"L_LEGEND_CRACK",    icon:"🔮",  title:"전설 분해",
        desc:"전설 1 → 레어 4.",
        cost:1, enabled:legend>=1, currency:"legend" },

      { id:"L_MASS_POWER",      icon:"⚡",  title:"전군 각성",
        desc:"모든 타워 공격력 +10% 영구. 런당 1회.",
        cost:2, enabled:legend>=2 && !state.massPowerUsed, currency:"legend" },

      { id:"L_CRIT_AMP",        icon:"🗡️", title:`치명타 증폭 (${u?._critAmpCount??0}/2)`,
        desc:"선택 타워 치명타 배율 +0.40 영구. 타워당 최대 2회.",
        cost:1, enabled:legend>=1 && hasSel && (u?._critAmpCount??0)<2, currency:"legend" },

      { id:"L_POWER_AWAKEN",    icon:"🌠",  title:"전설 각성",
        desc:"선택 타워 공격력 +25% + 치명타율 +6% 영구. 타워당 1회.",
        cost:2, enabled:legend>=2 && hasSel && !u?._legendAwaken, currency:"legend" },
    ],
  };
}
