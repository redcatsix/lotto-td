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


// 초반 운 나쁨 완충: 최소 일반 티켓 보장
export function topUpCommonTickets(econ, minCommon) {
  if (!econ || !econ.tickets) return 0;
  const cur = Math.max(0, Number(econ.tickets.common || 0));
  const goal = Math.max(0, Number(minCommon || 0));
  if (cur >= goal) return 0;
  const add = goal - cur;
  econ.tickets.common = cur + add;
  return add;
}

// 위험 웨이브 직전이며 자원이 부족하면 PREP 보조 지급
export function prepAidCommonForWave(econ, nextWaveType, stage) {
  if (!econ || !econ.tickets) return 0;
  const danger = nextWaveType === "RUSH" || nextWaveType === "PHANTOM" || nextWaveType === "SIEGE";
  if (!danger) return 0;
  // 중반 이전에만 완충 (스테이지가 오르면 플레이어 선택 책임을 유지)
  if ((stage || 0) > 18) return 0;
  return topUpCommonTickets(econ, 2);
}
