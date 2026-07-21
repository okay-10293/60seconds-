// ============================================================
// rations.js — 배급량 조절 옵션
// ============================================================
// ★ 배급 단계를 추가/조정하려면 이 배열만 건드리면 됨 (엔진 코드 안 건드림) ★
//
// consumeMultiplier: 인원수 대비 소모량 배율 (하루 소모량 = ceil(인원 * 배율))
// hungerDelta / thirstDelta: 배급이 충분했을 때 적용되는 증감량 (음수 = 회복)
//   - 배급이 부족했을 때는 항상 hunger/thirst +1 (기존 로직과 동일)
// sanityDelta: 배급이 충분했을 때 정신력 증감 (풍족함/궁핍함에 대한 심리적 영향)

window.RATION_LEVELS = [
  {
    id: 'none',
    name: '전혀 안 먹음',
    icon: '🚫',
    description: '자원을 전혀 소모하지 않지만, 배고픔과 갈증이 항상 심해진다. 오래 버티면 위험하다.',
    consumeMultiplier: 0,
    hungerDelta: 0,
    thirstDelta: 0,
    sanityDelta: -3,
    alwaysInsufficient: true, // 자원 보유량과 무관하게 항상 '못 먹은 것'으로 처리
  },
  {
    id: 'half',
    name: '반절 배급',
    icon: '🍽️½',
    description: '자원을 절약하지만 허기와 갈증이 나아지지 않는다.',
    consumeMultiplier: 0.5,
    hungerDelta: 0,
    thirstDelta: 0,
    sanityDelta: -1,
  },
  {
    id: 'normal',
    name: '정량 배급',
    icon: '🍽️',
    description: '표준적인 배급. 정상적으로 회복한다.',
    consumeMultiplier: 1,
    hungerDelta: -1,
    thirstDelta: -1,
    sanityDelta: 0,
  },
  {
    id: 'double',
    name: '두배 배급',
    icon: '🍽️×2',
    description: '자원을 두 배로 소모하지만 빠르게 회복하고 사기가 오른다.',
    consumeMultiplier: 2,
    hungerDelta: -2,
    thirstDelta: -2,
    sanityDelta: 2,
  },
];

function getRationLevel(id) {
  return window.RATION_LEVELS.find((r) => r.id === id) || window.RATION_LEVELS.find((r) => r.id === 'normal');
}

window.RationsAPI = { getRationLevel };
