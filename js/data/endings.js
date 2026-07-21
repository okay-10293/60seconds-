// ============================================================
// endings.js — 목표 생존일수(GAME_CONFIG.goalDay) 달성 시 엔딩 목록
// ============================================================
// ★ 새 엔딩은 이 배열에 객체만 추가하면 됨 (엔진 코드 안 건드림) ★
// 배열 위에서부터 순서대로 condition을 검사해 처음 true가 나오는 엔딩이 채택됨.
// 따라서 더 특수한(구체적인) 엔딩을 위쪽에, 마지막에 항상 참인 기본 엔딩을 둔다.
//
// Ending 스키마:
// {
//   id: string,
//   title: string,
//   description: string,
//   condition: (ctx) => boolean,
// }
//
// ctx 필드:
//   state                       - 게임 전역 상태
//   shelterCount                - 현재 대피소에 남아있는 인원 수
//   lostOrDeadCount              - (원가족 중) 실종되거나 사망한 인원 수
//   originalFamilyAllInShelter  - 아빠/엄마/아들/딸 전원이 대피소에 생존해 있는지
//   avgSanity                    - 대피소 인원 평균 정신력

window.ENDINGS = [
  {
    id: 'perfect_with_dog',
    title: '완벽한 생존 (+개 한 마리)',
    description:
      '가족 모두가, 그리고 그날 문을 두드렸던 개까지 함께 살아남았다. 더 바랄 게 없는 결말이다.',
    condition: (ctx) => ctx.originalFamilyAllInShelter && ctx.avgSanity >= 60 && !!ctx.state.flags.dogJoined,
  },
  {
    id: 'perfect',
    title: '완벽한 생존',
    description:
      '가족 모두가 무사히 살아남았다. 힘든 나날이었지만, 함께였기에 견딜 수 있었다.',
    condition: (ctx) => ctx.originalFamilyAllInShelter && ctx.avgSanity >= 60,
  },
  {
    id: 'empty_shelter',
    title: '텅 빈 승리',
    description:
      '목표한 날짜는 채웠다. 하지만 대피소 문을 열어도 반겨줄 사람이 아무도 없다.',
    condition: (ctx) => ctx.shelterCount === 0,
  },
  {
    id: 'sole_survivor',
    title: '홀로 남은 사람',
    description:
      '결국 혼자가 되었다. 살아남았다는 사실이 위안이 되어야 할 텐데, 마음은 텅 비어있다.',
    condition: (ctx) => ctx.shelterCount === 1,
  },
  {
    id: 'reunited_with_stranger',
    title: '새로운 가족',
    description:
      '피로 이어지진 않았지만, 함께 버텨낸 사람들이 있었다. 그것으로 충분했다.',
    condition: (ctx) => !!ctx.state.flags.strangerJoined && ctx.lostOrDeadCount > 0 && ctx.shelterCount >= 2,
  },
  {
    id: 'bittersweet',
    title: '씁쓸한 생존',
    description:
      '목표한 날짜까지 버텨냈다. 하지만 그 과정에서 잃은 것들은 돌아오지 않는다.',
    condition: (ctx) => ctx.shelterCount >= 1 && ctx.lostOrDeadCount > 0,
  },
  {
    id: 'default',
    title: '생존',
    description: '큰 사건 없이 목표한 날짜까지 버텨냈다.',
    condition: () => true, // 항상 참 — 반드시 배열 맨 마지막에 위치해야 함 (fallback)
  },
];
