// economy.js
// - 골드 시스템 제거
// - 티켓 기반 진행 (일반=뽑기/리롤, 레어=개조, 전설=각성)

export function createEconomyState() {
  return {
    tickets: {
      common: 4, // 시작 뽑기 (하드코어: 초반 과다 뽑기 방지)
      rare: 0,
      legend: 0,
    },
  };
}
