// ============================================================
// expeditions.js — 원정 보내기 미션 목록
// ============================================================
// ★ 새 원정지는 이 배열에 객체만 추가하면 됨 (엔진 코드 안 건드림) ★
//
// Expedition 스키마:
// {
//   id: string (유니크),
//   name: string,
//   description: string,
//   duration: number,       // 원정 나간 뒤 며칠 후 돌아오는지
//   outcomes: [
//     {
//       weight: number,      // 상대 가중치
//       type: 'success' | 'injured' | 'empty' | 'missing' | 'dead',
//       resultText: string,
//       loot: [ { key:'food'|'water', min, max } | { itemId, min, max } ],  // optional
//     }
//   ]
// }
//
// type 처리 방식:
//   success/injured/empty -> 캐릭터가 대피소로 복귀 (injured는 health가 'injured'로 바뀜)
//   missing               -> 캐릭터가 영구 실종 (location: 'missing')
//   dead                  -> 캐릭터 사망 처리

window.EXPEDITIONS = [
  {
    id: 'nearby_store',
    name: '근처 편의점',
    description: '가까운 거리, 비교적 안전하지만 보상은 적다.',
    duration: 1,
    outcomes: [
      {
        weight: 55,
        type: 'success',
        resultText: '무사히 물자를 구해왔다.',
        loot: [
          { key: 'food', min: 1, max: 3 },
          { key: 'water', min: 1, max: 2 },
        ],
      },
      {
        weight: 25,
        type: 'injured',
        resultText: '다쳤지만 물자를 조금 챙겨 살아 돌아왔다.',
        loot: [{ key: 'food', min: 0, max: 1 }],
      },
      {
        weight: 15,
        type: 'empty',
        resultText: '이미 다른 사람들이 다 털어간 뒤였다. 빈손으로 돌아왔다.',
        loot: [],
      },
      {
        weight: 5,
        type: 'missing',
        resultText: '돌아오지 않았다... 무슨 일이 생긴 것 같다.',
        loot: [],
      },
    ],
  },
  {
    id: 'pharmacy',
    name: '약국',
    description: '의약품 위주. 중간 정도의 위험.',
    duration: 1,
    outcomes: [
      {
        weight: 45,
        type: 'success',
        resultText: '구급상자를 여러 개 찾아냈다.',
        loot: [{ itemId: 'first_aid', min: 1, max: 2 }],
      },
      {
        weight: 30,
        type: 'injured',
        resultText: '약탈자와 마주쳐 다쳤지만 도망쳐 나왔다.',
        loot: [{ itemId: 'first_aid', min: 0, max: 1 }],
      },
      {
        weight: 15,
        type: 'empty',
        resultText: '텅 비어 있었다.',
        loot: [],
      },
      {
        weight: 10,
        type: 'missing',
        resultText: '끝내 돌아오지 않았다.',
        loot: [],
      },
    ],
  },
  {
    id: 'downtown',
    name: '시내',
    description: '먼 거리, 큰 보상. 하지만 매우 위험하다.',
    duration: 2,
    outcomes: [
      {
        weight: 35,
        type: 'success',
        resultText: '큰 수확을 거뒀다!',
        loot: [
          { key: 'food', min: 3, max: 6 },
          { key: 'water', min: 2, max: 5 },
          { itemId: 'first_aid', min: 0, max: 1 },
        ],
      },
      {
        weight: 25,
        type: 'injured',
        resultText: '습격을 당해 크게 다쳤지만, 짐은 챙겨왔다.',
        loot: [
          { key: 'food', min: 1, max: 2 },
          { key: 'water', min: 1, max: 2 },
        ],
      },
      {
        weight: 25,
        type: 'missing',
        resultText: '실종되었다. 돌아오지 않는다...',
        loot: [],
      },
      {
        weight: 15,
        type: 'dead',
        resultText: '끝내 소식이 끊겼다. 사망한 것으로 보인다.',
        loot: [],
      },
    ],
  },
];
