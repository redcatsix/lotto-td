export function rollItemRarityBestOf(n, rollFn, rankFn) {
  let best = rollFn();
  for (let i = 1; i < n; i++) {
    const r = rollFn();
    if (rankFn(r) > rankFn(best)) best = r;
  }
  return best;
}

export function scoreOptionSet(options, rarityRank, OPTION_KIND) {
  let s = 0;
  for (const o of options) {
    const rr = rarityRank(o.rarity);
    s += (rr + 1) * 1000;
    const v = Number(o.value) || 0;
    switch (o.kind) {
      case OPTION_KIND.MULTISHOT: s += v * 320; break;
      case OPTION_KIND.RICOCHET: s += v * 280; break;
      case OPTION_KIND.RICOCHET_POWER: s += v * 8000; break;
      case OPTION_KIND.CRIT_CHANCE: s += v * 22000; break;
      case OPTION_KIND.CRIT_MULT: s += v * 1500; break;
      case OPTION_KIND.DMG_PCT: s += v * 9000; break;
      case OPTION_KIND.ASPD_PCT: s += v * 8200; break;
      case OPTION_KIND.TARGET_PRIORITY: {
        const pv = String(o.value || "");
        if (pv === "BOSS") s += 5200;
        else if (pv === "ELITE") s += 3800;
        else if (pv === "HIGH_HP") s += 2400;
        else if (pv === "LOW_HP") s += 2200;
        else s += 1400;
        break;
      }
      case OPTION_KIND.SPLASH_MUL: s += v * 8200; break;
      case OPTION_KIND.BLAST_RADIUS: s += v * 2200; break;
      case OPTION_KIND.SLOW_DURATION: s += v * 900; break;
      case OPTION_KIND.SLOW_POWER: s += v * 12000; break;
      case OPTION_KIND.EXECUTE_PCT: s += v * 8500; break;
      case OPTION_KIND.PRESSURE_DMG: s += v * 9000; break;
      case OPTION_KIND.MAXHP_PCT_DMG: s += v * 250000; break;
      default: s += v * 500; break;
    }
  }
  return s;
}

export function rollOptionsBestOf(n, rollOptionsFn, unitType, itemRarity, rarityRank, OPTION_KIND) {
  let best = rollOptionsFn(unitType, itemRarity);
  let bestScore = scoreOptionSet(best, rarityRank, OPTION_KIND);
  for (let i = 1; i < n; i++) {
    const cand = rollOptionsFn(unitType, itemRarity);
    const sc = scoreOptionSet(cand, rarityRank, OPTION_KIND);
    if (sc > bestScore) {
      best = cand;
      bestScore = sc;
    }
  }
  return best;
}
