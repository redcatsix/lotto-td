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

export function buildKeyboardShortcutHelpHTML() {
  return `
    <h3>⌨️ 단축키</h3>
    <ul>
      <li><b>Space</b>: 일시정지 / 재개</li>
      <li><b>Tab</b>: 배속 변경 (1x→2x→4x→8x)</li>
      <li><b>F</b>: 이펙트 ON/OFF</li>
      <li><b>H</b>: 도움말 열기/닫기</li>
      <li><b>K</b>: 스킬트리 열기/닫기</li>
      <li><b>Esc</b>: 열린 메뉴 닫기</li>
    </ul>
  `;
}
