// ============================================================
// events.js — 대피소 이벤트 풀
// ============================================================
// ★ 새 이벤트/선택지는 이 배열에 객체만 추가하면 됨 (엔진 코드 안 건드림) ★
//
// Event 스키마:
// {
//   id: string (유니크),
//   title: string,
//   description: string,
//   minDay, maxDay: number (선택, 이 기간에만 등장),
//   once: boolean (한 번 등장하면 다시 안 나옴, 기본 true),
//   conditions: {                      // 전부 optional
//     requiredItems: [{ id, count }],  // 이 아이템이 있어야 이벤트 등장
//     requiredFlags: { flagName: value },
//     minCharacters: number,
//   },
//   choices: [
//     {
//       text: string,
//       requires: { items: [{id,count}], flags: {} },  // 선택지 자체가 요구하는 조건 (없으면 항상 가능)
//       outcomes: [
//         {
//           weight: number,           // 상대 가중치, 합 100 아니어도 됨
//           resultText: string,
//           effects: [ ...effect ]
//         }
//       ]
//     }
//   ]
// }
//
// Effect 종류:
//   { type:'resource', key:'food'|'water', delta:number }
//   { type:'item', itemId, delta:number }              // 음수면 소모
//   { type:'character', target:'random'|'all'|<characterId>,
//     field:'health'|'location'|'hunger'|'thirst'|'sanity',
//     value:any, delta:number }                         // value 지정시 대입, delta 지정시 증감
//   { type:'flag', key, value }
//   { type:'log', text }

window.EVENTS = [
  {
    id: 'stranger_knock',
    title: '누군가 문을 두드린다',
    description: '대피소 밖에서 낯선 목소리가 들린다. "저기요... 살려주세요..."',
    minDay: 2,
    once: true,
    choices: [
      {
        text: '문을 열어준다',
        outcomes: [
          {
            weight: 60,
            resultText: '지쳐 보이는 생존자였다. 가족이 되기로 했다.',
            effects: [
              { type: 'flag', key: 'strangerJoined', value: true },
              { type: 'log', text: '낯선 사람을 받아들였다.' },
            ],
          },
          {
            weight: 40,
            resultText: '함정이었다! 식량을 훔쳐 도망갔다.',
            effects: [
              { type: 'resource', key: 'food', delta: -2 },
              { type: 'log', text: '식량을 도둑맞았다.' },
            ],
          },
        ],
      },
      {
        text: '무시한다',
        outcomes: [
          {
            weight: 100,
            resultText: '발소리가 멀어졌다. 찜찜한 기분이 남는다.',
            effects: [
              { type: 'character', target: 'all', field: 'sanity', delta: -5 },
            ],
          },
        ],
      },
      {
        text: '총으로 위협해서 쫓아낸다',
        requires: { items: [{ id: 'rifle', count: 1 }] },
        outcomes: [
          {
            weight: 100,
            resultText: '겁을 먹고 도망갔다.',
            effects: [],
          },
        ],
      },
    ],
  },

  {
    id: 'radio_broadcast',
    title: '라디오 방송',
    description: '라디오에서 지지직거리는 소리와 함께 정부 방송이 흘러나온다.',
    conditions: {
      requiredItems: [{ id: 'radio', count: 1 }],
    },
    once: false, // 여러 번 등장 가능한 이벤트 예시
    choices: [
      {
        text: '계속 듣는다',
        outcomes: [
          {
            weight: 50,
            resultText: '구조대가 다가오고 있다는 소식이다. 희망이 생긴다.',
            effects: [{ type: 'character', target: 'all', field: 'sanity', delta: 10 }],
          },
          {
            weight: 50,
            resultText: '아무 정보도 없이 잡음만 계속된다.',
            effects: [],
          },
        ],
      },
    ],
  },

  {
    id: 'sick_child',
    title: '아이가 아프다',
    description: '아이 중 한 명이 열이 심하게 오른다.',
    minDay: 3,
    once: true,
    conditions: { minCharacters: 1 },
    choices: [
      {
        text: '구급상자로 치료한다',
        requires: { items: [{ id: 'first_aid', count: 1 }] },
        outcomes: [
          {
            weight: 100,
            resultText: '금방 나았다.',
            effects: [{ type: 'item', itemId: 'first_aid', delta: -1 }],
          },
        ],
      },
      {
        text: '그냥 지켜본다',
        outcomes: [
          {
            weight: 50,
            resultText: '다행히 스스로 회복했다.',
            effects: [],
          },
          {
            weight: 50,
            resultText: '상태가 악화되었다.',
            effects: [
              { type: 'character', target: 'random', field: 'health', value: 'sick' },
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'rat_infestation',
    title: '쥐가 들끓는다',
    description: '식량 창고에서 부스럭거리는 소리가 들린다. 쥐가 식량을 갉아먹고 있는 것 같다.',
    minDay: 2,
    once: false,
    choices: [
      {
        text: '도끼로 쫓아낸다',
        requires: { items: [{ id: 'axe', count: 1 }] },
        outcomes: [
          { weight: 100, resultText: '쥐들을 몰아냈다. 식량은 무사하다.', effects: [] },
        ],
      },
      {
        text: '직접 몸으로 막아본다',
        outcomes: [
          {
            weight: 50,
            resultText: '겨우 쫓아냈지만 일부는 이미 갉아먹혔다.',
            effects: [{ type: 'resource', key: 'food', delta: -1 }],
          },
          {
            weight: 50,
            resultText: '결국 식량 일부를 빼앗겼다.',
            effects: [{ type: 'resource', key: 'food', delta: -2 }],
          },
        ],
      },
    ],
  },

  {
    id: 'nightmare',
    title: '악몽',
    description: '가족 중 한 명이 식은땀을 흘리며 잠에서 깬다. 밖의 상황이 꿈에서도 떠나지 않는 모양이다.',
    minDay: 2,
    once: false,
    choices: [
      {
        text: '곁에서 위로해준다',
        outcomes: [
          {
            weight: 100,
            resultText: '한참을 이야기하다 다시 잠들었다.',
            effects: [{ type: 'character', target: 'random', field: 'sanity', delta: 8 }],
          },
        ],
      },
      {
        text: '그냥 다시 자게 둔다',
        outcomes: [
          {
            weight: 100,
            resultText: '혼자 뒤척이다 겨우 잠들었다.',
            effects: [{ type: 'character', target: 'random', field: 'sanity', delta: -5 }],
          },
        ],
      },
    ],
  },

  {
    id: 'trade_offer',
    title: '라디오로 들려온 거래 제안',
    description: '다른 생존자 무리가 라디오로 물물교환을 제안한다. "자물쇠 있으면 식량이랑 바꿔줄게요."',
    minDay: 4,
    once: true,
    conditions: { requiredItems: [{ id: 'radio', count: 1 }] },
    choices: [
      {
        text: '자물쇠를 넘기고 식량을 받는다',
        requires: { items: [{ id: 'lock', count: 1 }] },
        outcomes: [
          {
            weight: 80,
            resultText: '약속대로 식량을 보내왔다.',
            effects: [
              { type: 'item', itemId: 'lock', delta: -1 },
              { type: 'resource', key: 'food', delta: 3 },
            ],
          },
          {
            weight: 20,
            resultText: '사기였다. 자물쇠만 뺏겼다.',
            effects: [{ type: 'item', itemId: 'lock', delta: -1 }],
          },
        ],
      },
      {
        text: '거절한다',
        outcomes: [{ weight: 100, resultText: '별다른 일 없이 지나갔다.', effects: [] }],
      },
    ],
  },

  {
    id: 'gas_leak',
    title: '가스 냄새',
    description: '어디선가 희미하게 가스 냄새가 풍긴다. 배관이 손상된 것 같다.',
    minDay: 3,
    once: true,
    choices: [
      {
        text: '방독면을 쓰고 점검한다',
        requires: { items: [{ id: 'gas_mask', count: 1 }] },
        outcomes: [
          { weight: 100, resultText: '무사히 밸브를 잠갔다. 위험을 피했다.', effects: [] },
        ],
      },
      {
        text: '생존 안내서를 참고해 임시로 틀어막는다',
        requires: { items: [{ id: 'survival_book', count: 1 }] },
        outcomes: [
          {
            weight: 70,
            resultText: '임시로 막는 데 성공했다.',
            effects: [],
          },
          {
            weight: 30,
            resultText: '작업 중 냄새를 많이 들이마셨다.',
            effects: [{ type: 'character', target: 'random', field: 'health', value: 'sick' }],
          },
        ],
      },
      {
        text: '일단 환기만 시킨다',
        outcomes: [
          {
            weight: 50,
            resultText: '다행히 냄새가 옅어졌다.',
            effects: [{ type: 'character', target: 'all', field: 'sanity', delta: -3 }],
          },
          {
            weight: 50,
            resultText: '가스를 마셔 몸이 좋지 않다.',
            effects: [{ type: 'character', target: 'random', field: 'health', value: 'sick' }],
          },
        ],
      },
    ],
  },

  {
    id: 'family_argument',
    title: '가족 간의 다툼',
    description: '좁은 공간에 오래 갇혀있다 보니 사소한 일로 언성이 높아진다.',
    minDay: 5,
    once: false,
    conditions: { minCharacters: 2 },
    choices: [
      {
        text: '보드게임으로 분위기를 풀어본다',
        requires: { items: [{ id: 'board_game', count: 1 }] },
        outcomes: [
          {
            weight: 100,
            resultText: '게임을 하다 보니 다들 웃음을 되찾았다.',
            effects: [{ type: 'character', target: 'all', field: 'sanity', delta: 6 }],
          },
        ],
      },
      {
        text: '하모니카를 연주해준다',
        requires: { items: [{ id: 'harmonica', count: 1 }] },
        outcomes: [
          {
            weight: 100,
            resultText: '어색한 연주였지만 다들 진정했다.',
            effects: [{ type: 'character', target: 'all', field: 'sanity', delta: 5 }],
          },
        ],
      },
      {
        text: '그냥 각자 진정할 때까지 둔다',
        outcomes: [
          {
            weight: 100,
            resultText: '냉랭한 분위기가 며칠 갈 것 같다.',
            effects: [{ type: 'character', target: 'all', field: 'sanity', delta: -6 }],
          },
        ],
      },
    ],
  },

  {
    id: 'flu_outbreak',
    title: '독감 기운',
    description: '한 명이 콜록거리기 시작한다. 좁은 대피소에서 옮으면 큰일이다.',
    minDay: 6,
    once: false,
    choices: [
      {
        text: '구급상자로 즉시 치료한다',
        requires: { items: [{ id: 'first_aid', count: 1 }] },
        outcomes: [
          {
            weight: 100,
            resultText: '초기에 잡아서 퍼지지 않았다.',
            effects: [{ type: 'item', itemId: 'first_aid', delta: -1 }],
          },
        ],
      },
      {
        text: '격리시키고 지켜본다',
        outcomes: [
          {
            weight: 60,
            resultText: '다행히 다른 사람에게는 옮지 않았다.',
            effects: [{ type: 'character', target: 'random', field: 'health', value: 'sick' }],
          },
          {
            weight: 40,
            resultText: '결국 대피소 전체로 퍼졌다.',
            effects: [{ type: 'character', target: 'all', field: 'sanity', delta: -8 }],
          },
        ],
      },
    ],
  },

  {
    id: 'stray_dog',
    title: '문 밖의 개',
    description: '문 틈으로 마르고 지친 개 한 마리가 보인다. 낑낑거리며 안으로 들어오려 한다.',
    minDay: 3,
    once: true,
    choices: [
      {
        text: '먹을 게 없지만 일단 들인다',
        outcomes: [
          {
            weight: 100,
            resultText: '식량은 부족해졌지만, 다들 개를 보며 조금은 웃었다.',
            effects: [
              { type: 'resource', key: 'food', delta: -1 },
              { type: 'flag', key: 'dogJoined', value: true },
              { type: 'character', target: 'all', field: 'sanity', delta: 3 },
            ],
          },
        ],
      },
      {
        text: '문을 열어주지 않는다',
        outcomes: [
          {
            weight: 100,
            resultText: '낑낑거리는 소리가 한참 이어지다 조용해졌다.',
            effects: [{ type: 'character', target: 'all', field: 'sanity', delta: -4 }],
          },
        ],
      },
    ],
  },

  {
    id: 'stray_cat',
    title: '창고에 숨어든 고양이',
    description: '식량 창고 쪽에서 부스럭거리는 소리가 난다. 살펴보니 비쩍 마른 고양이 한 마리가 구석에 웅크리고 있다.',
    minDay: 5,
    once: true,
    choices: [
      {
        text: '조심스럽게 물을 나눠준다',
        outcomes: [
          {
            weight: 100,
            resultText: '경계하던 고양이가 어느새 발치에 와서 몸을 비볐다.',
            effects: [
              { type: 'resource', key: 'water', delta: -1 },
              { type: 'flag', key: 'catJoined', value: true },
              { type: 'character', target: 'all', field: 'sanity', delta: 3 },
            ],
          },
        ],
      },
      {
        text: '그냥 내버려 둔다',
        outcomes: [
          {
            weight: 50,
            resultText: '고양이는 알아서 어딘가로 사라졌다.',
            effects: [],
          },
          {
            weight: 50,
            resultText: '밤새 창고를 뒤지고 다녔는지 식량이 조금 상해 있었다.',
            effects: [{ type: 'resource', key: 'food', delta: -1 }],
          },
        ],
      },
    ],
  },

  {
    id: 'looters_at_the_door',
    title: '약탈자들',
    description: '무장한 무리가 대피소 물자를 노리고 접근하고 있다.',
    minDay: 7,
    once: false,
    choices: [
      {
        text: '엽총으로 맞선다',
        requires: { items: [{ id: 'rifle', count: 1 }] },
        outcomes: [
          { weight: 80, resultText: '위협적인 태세에 약탈자들이 물러났다.', effects: [] },
          {
            weight: 20,
            resultText: '충돌이 벌어져 한 명이 다쳤다.',
            effects: [{ type: 'character', target: 'random', field: 'health', value: 'injured' }],
          },
        ],
      },
      {
        text: '도끼로 맞선다',
        requires: { items: [{ id: 'axe', count: 1 }] },
        outcomes: [
          { weight: 50, resultText: '몸싸움 끝에 겨우 쫓아냈다.', effects: [] },
          {
            weight: 50,
            resultText: '싸우다 다쳤지만 물자는 지켰다.',
            effects: [{ type: 'character', target: 'random', field: 'health', value: 'injured' }],
          },
        ],
      },
      {
        text: '조용히 숨는다',
        outcomes: [
          {
            weight: 50,
            resultText: '들키지 않고 지나갔다.',
            effects: [{ type: 'character', target: 'all', field: 'sanity', delta: -5 }],
          },
          {
            weight: 50,
            resultText: '결국 발각되어 물자를 일부 빼앗겼다.',
            effects: [
              { type: 'resource', key: 'food', delta: -2 },
              { type: 'resource', key: 'water', delta: -2 },
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'distress_signal',
    title: '라디오 주파수 속 목소리',
    description: '라디오 잡음 사이로 희미하게 신호가 잡힌다. "...생존자가 있다면... 응답하라..." 군 통신인 것 같다.',
    minDay: 5,
    once: true,
    conditions: { requiredItems: [{ id: 'radio', count: 1 }] },
    choices: [
      {
        text: '구조 신호를 보낸다',
        outcomes: [
          {
            weight: 100,
            resultText: '위치와 상태를 알렸다. 응답이 올지는 알 수 없지만, 기다려보기로 했다.',
            effects: [
              { type: 'flag', key: 'distressSignalSent', value: true },
              { type: 'log', text: '군 통신에 구조 신호를 보냈다.' },
            ],
          },
        ],
      },
      {
        text: '섣불리 위치를 알리지 않는다',
        outcomes: [
          {
            weight: 100,
            resultText: '누군지 모를 상대에게 위치를 알리는 건 위험하다고 판단했다.',
            effects: [],
          },
        ],
      },
    ],
  },

  {
    id: 'rescue_convoy',
    title: '다가오는 엔진 소리',
    description: '멀리서 차량 엔진 소리가 점점 가까워진다. 며칠 전 보냈던 구조 신호에 대한 응답일지도 모른다.',
    minDay: 9,
    once: true,
    conditions: { requiredFlags: { distressSignalSent: true } },
    choices: [
      {
        text: '문을 열고 신호를 보낸다',
        outcomes: [
          {
            weight: 75,
            resultText: '군 구조대였다. 곧 데리러 오겠다는 약속을 받았다.',
            effects: [
              { type: 'flag', key: 'militaryRescueConfirmed', value: true },
              { type: 'log', text: '구조대와 접선에 성공했다.' },
            ],
          },
          {
            weight: 25,
            resultText: '아쉽게도 그냥 지나가는 차량이었다.',
            effects: [{ type: 'character', target: 'all', field: 'sanity', delta: -4 }],
          },
        ],
      },
      {
        text: '만약을 대비해 숨죽이고 지켜본다',
        outcomes: [
          {
            weight: 100,
            resultText: '차량은 별다른 반응 없이 지나갔다.',
            effects: [{ type: 'character', target: 'all', field: 'sanity', delta: -3 }],
          },
        ],
      },
    ],
  },
];
