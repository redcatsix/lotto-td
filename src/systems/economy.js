// economy.js
// - 골드 시스템 제거
// - 티켓 기반 진행 (일반=뽑기/리롤, 레어=개조, 전설=각성)

export function createEconomyState() {
  return {
    tickets: {
      common: 6, // 시작 뽑기 (여유로운 초반 빌드업)
      rare: 1,   // 초반 개조 1회 가능
      legend: 0,
    },
  };
}
