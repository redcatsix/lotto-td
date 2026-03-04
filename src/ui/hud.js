export function hideContextMenus({ buyMenu, tooltip, state }) {
  buyMenu.classList.add("hidden");
  tooltip.classList.add("hidden");
  state.buyCell = null;
  state.selectedKey = null;
}

export function cycleSpeed(state, syncTopUI) {
  const speeds = [1, 2, 4, 8];
  const idx = speeds.indexOf(state.timeScale);
  state.timeScale = speeds[(idx >= 0 ? idx + 1 : 1) % speeds.length];
  syncTopUI();
}

export function toggleVfx(state, saveBoolLS, LS_KEY_VFX, syncTopUI) {
  state.vfxEnabled = !state.vfxEnabled;
  saveBoolLS(LS_KEY_VFX, !!state.vfxEnabled);
  if (!state.vfxEnabled) {
    state.beams.length = 0;
    state.rings.length = 0;
    state.puffs.length = 0;
  }
  syncTopUI();
}

export function togglePause(state, syncTopUI) {
  if (state.gameOver) return;
  state.userPause = !state.userPause;
  syncTopUI();
}
