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
            resultText: '식량은 부족해졌지만, 개를 보자 다들 거짓말처럼 마음이 놓였다.',
            effects: [
              { type: 'resource', key: 'food', delta: -1 },
              { type: 'flag', key: 'dogJoined', value: true },
              { type: 'character', target: 'all', field: 'sanity', delta: 20 },
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
            resultText: '경계하던 고양이가 발치에 와서 몸을 비비자, 다들 거짓말처럼 마음이 놓였다.',
            effects: [
              { type: 'resource', key: 'water', delta: -1 },
              { type: 'flag', key: 'catJoined', value: true },
              { type: 'character', target: 'all', field: 'sanity', delta: 20 },
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
        text: '자물쇠로 문을 걸어 잠근다',
        requires: { items: [{ id: 'lock', count: 1 }] },
        outcomes: [
          {
            weight: 100,
            resultText: '단단히 잠긴 문 앞에서 약탈자들은 헛수고만 하다 돌아갔다.',
            effects: [{ type: 'item', itemId: 'lock', delta: -1 }],
          },
        ],
      },
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
    conditions: { requiredFlags: { distressSignalSent: true }, requiredItems: [{ id: 'radio', count: 1 }] },
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

  {
    id: 'strange_noise_vent',
    title: '환기구에서 나는 소리',
    description: '환기구 쪽에서 부스럭거리는 소리와 함께 뭔가 방공호 안으로 기어들어왔다. 대응해야 한다.',
    minDay: 3,
    once: false,
    choices: [
      {
        text: '총으로 제압한다',
        requires: { items: [{ id: 'rifle', count: 1 }] },
        outcomes: [
          {
            weight: 100,
            resultText: '한 방에 처리했다. 피해는 없었다.',
            effects: [],
          },
        ],
      },
      {
        text: '살충제를 뿌린다',
        requires: { items: [{ id: 'pesticide', count: 1 }] },
        outcomes: [
          {
            weight: 100,
            resultText: '독한 냄새와 함께 깔끔하게 처리했다.',
            effects: [{ type: 'item', itemId: 'pesticide', delta: -1 }],
          },
        ],
      },
      {
        text: '도끼로 제압한다',
        requires: { items: [{ id: 'axe', count: 1 }] },
        outcomes: [
          {
            weight: 100,
            resultText: '단번에 처리했다. 피해는 없었다.',
            effects: [],
          },
        ],
      },
      {
        text: '생존 안내서를 참고해 퇴치한다',
        requires: { items: [{ id: 'survival_book', count: 1 }] },
        outcomes: [
          {
            weight: 100,
            resultText: '책에서 본 대로 하니 손쉽게 쫓아낼 수 있었다.',
            effects: [],
          },
        ],
      },
      {
        text: '맨몸으로 쫓아낸다',
        outcomes: [
          {
            weight: 40,
            resultText: '어찌어찌 쫓아내는 데 성공했다.',
            effects: [],
          },
          {
            weight: 35,
            resultText: '정신없이 쫓아내다 다쳤다.',
            effects: [{ type: 'character', target: 'random', field: 'health', value: 'injured' }],
          },
          {
            weight: 25,
            resultText: '난리통에 식량과 물이 좀 상했다.',
            effects: [
              { type: 'resource', key: 'food', delta: -1 },
              { type: 'resource', key: 'water', delta: -1 },
            ],
          },
        ],
      },
      {
        text: '그냥 무시한다',
        outcomes: [
          {
            weight: 60,
            resultText: '악취와 소음을 참고 넘어갔다. 다들 신경이 곤두선 채로 하루를 보냈다.',
            effects: [{ type: 'character', target: 'all', field: 'sanity', delta: -6 }],
          },
          {
            weight: 40,
            resultText: '뒤척이다 뜬눈으로 밤을 보낸 사람이 생겼다. 완전히 탈진해버렸다.',
            effects: [{ type: 'character', target: 'random', field: 'exhausted', value: true }],
          },
        ],
      },
    ],
  },

  {
    id: 'triple_disaster',
    title: '동시다발 재해',
    description:
      '화재, 지진, 침수가 한꺼번에 대피소를 덮쳤다. 도저히 전부 지킬 수 없다 — 딱 한 종류의 물자만 지킬 수 있다.',
    minDay: 2,
    once: true,
    choices: [
      {
        text: '무기류를 지킨다',
        outcomes: [
          {
            weight: 100,
            resultText: '무기는 지켰지만, 나머지 물자는 무너진 잔해에 깔려버렸다.',
            effects: [
              { type: 'destroyCategory', category: 'tool' },
              { type: 'destroyCategory', category: 'medicine' },
            ],
          },
        ],
      },
      {
        text: '생존 도구를 지킨다',
        outcomes: [
          {
            weight: 100,
            resultText: '도구는 지켰지만, 나머지 물자는 무너진 잔해에 깔려버렸다.',
            effects: [
              { type: 'destroyCategory', category: 'weapon' },
              { type: 'destroyCategory', category: 'medicine' },
            ],
          },
        ],
      },
      {
        text: '의약품을 지킨다',
        outcomes: [
          {
            weight: 100,
            resultText: '의약품은 지켰지만, 나머지 물자는 무너진 잔해에 깔려버렸다.',
            effects: [
              { type: 'destroyCategory', category: 'weapon' },
              { type: 'destroyCategory', category: 'tool' },
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'boredom',
    title: '무료함',
    description: '좁은 방공호에서 하루하루가 똑같이 흘러간다. 다들 지루함에 몸이 근질거리는 눈치다.',
    minDay: 2,
    once: false,
    choices: [
      {
        text: '카드로 시간을 보낸다',
        requires: { items: [{ id: 'playing_cards', count: 1 }] },
        outcomes: [
          {
            weight: 100,
            resultText: '카드 게임 몇 판으로 다들 잠시나마 근심을 잊었다.',
            effects: [{ type: 'character', target: 'all', field: 'sanity', delta: 8 }],
          },
        ],
      },
      {
        text: '체커로 시간을 보낸다',
        requires: { items: [{ id: 'board_game', count: 1 }] },
        outcomes: [
          {
            weight: 75,
            resultText: '체커 몇 판으로 다들 잠시나마 근심을 잊었다.',
            effects: [{ type: 'character', target: 'all', field: 'sanity', delta: 8 }],
          },
          {
            weight: 25,
            resultText: '한 명은 체커랑 안 맞는지, 오히려 더 신경질적으로 변했다.',
            effects: [{ type: 'character', target: 'random', field: 'sanity', delta: -10 }],
          },
        ],
      },
      {
        text: '그냥 조용히 시간을 보낸다',
        outcomes: [
          {
            weight: 70,
            resultText: '아무 말 없이 하루를 흘려보냈다. 다들 조금씩 지쳐가는 게 느껴진다.',
            effects: [{ type: 'character', target: 'all', field: 'sanity', delta: -6 }],
          },
          {
            weight: 30,
            resultText: '적막을 견디지 못한 한 명이 결국 완전히 지쳐 나가떨어졌다.',
            effects: [
              { type: 'character', target: 'all', field: 'sanity', delta: -6 },
              { type: 'character', target: 'random', field: 'exhausted', value: true },
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'radio_static',
    title: '지지직거리는 라디오',
    description: '라디오에서 계속 잡음만 나온다. 채널을 잘 맞추면 뭔가 들을 수 있을지도 모른다.',
    minDay: 3,
    once: false,
    conditions: { requiredItems: [{ id: 'radio', count: 1 }] },
    choices: [
      {
        text: '가만히 채널을 맞춰 듣는다',
        outcomes: [
          {
            weight: 60,
            resultText: '오래된 음악 방송을 찾았다. 다들 잠시 귀 기울였다.',
            effects: [{ type: 'character', target: 'all', field: 'sanity', delta: 5 }],
          },
          {
            weight: 40,
            resultText: '들려오는 건 온통 안 좋은 소식뿐이었다. 다들 마음이 무거워졌다.',
            effects: [{ type: 'character', target: 'all', field: 'sanity', delta: -5 }],
          },
        ],
      },
      {
        text: '분해해서 만지작거려 본다',
        outcomes: [
          {
            weight: 55,
            resultText: '괜히 건드렸다가 라디오가 완전히 망가졌다.',
            effects: [{ type: 'item', itemId: 'radio', delta: -1 }],
          },
          {
            weight: 45,
            resultText: '수신 상태가 오히려 좋아졌다.',
            effects: [{ type: 'character', target: 'all', field: 'sanity', delta: 3 }],
          },
        ],
      },
      {
        text: '그냥 꺼둔다',
        outcomes: [{ weight: 100, resultText: '조용히 라디오를 껐다.', effects: [] }],
      },
    ],
  },
  /* ========================================================
     아래부터는 원작(60 Seconds!)의 이벤트 구조를 참고해 새로 추가한 이벤트들.
     원작의 매커니즘(선택 구조·조건·보상 형태)만 참고했고, 문구는 전부 새로 작성함.
  ======================================================== */

  {
    id: 'unknown_suitcase',
    title: '문 앞에 놓인 가방',
    description: '밤새 문 밖에서 인기척이 났다. 아침에 열어보니 낡은 가방 하나가 덩그러니 놓여 있다. 이름도, 쪽지도 없다.',
    minDay: 3,
    once: false,
    choices: [
      {
        text: '열어본다',
        outcomes: [
          { weight: 25, resultText: '통조림 몇 개가 들어 있었다. 누군지 몰라도 고맙다.', effects: [{ type: 'resource', key: 'food', delta: 2 }] },
          { weight: 20, resultText: '깨끗한 물이 들어 있었다. 정말 고마운 사람이다.', effects: [{ type: 'resource', key: 'water', delta: 2 }] },
          { weight: 15, resultText: '가방 자체가 꽤 튼튼하다. 원정 나갈 때 쓸 만하겠다.', effects: [{ type: 'item', itemId: 'suitcase', delta: 1 }] },
          { weight: 20, resultText: '통조림이 들어 있었지만 유통기한이 한참 지난 것이었다. 결국 탈이 났다.', effects: [{ type: 'character', target: 'random', field: 'health', value: 'sick' }] },
          { weight: 20, resultText: '열자마자 안에서 뭔가 터졌다. 누군가 일부러 놓아둔 함정이었다.', effects: [{ type: 'character', target: 'random', field: 'health', value: 'injured' }] },
        ],
      },
      {
        text: '건드리지 않는다',
        outcomes: [
          { weight: 100, resultText: '출처를 모르는 물건은 믿을 수 없다. 그대로 두자 다음 날 사라져 있었다.', effects: [] },
        ],
      },
    ],
  },

  {
    id: 'wall_mushrooms',
    title: '벽에 자란 버섯',
    description: '대피소 한쪽 벽에 버섯이 잔뜩 돋아났다. 먹을 수 있을 만큼 큼직하다. 식량은 늘 부족하고...',
    minDay: 4,
    once: false,
    choices: [
      {
        text: '따서 먹어본다',
        outcomes: [
          { weight: 55, resultText: '의외로 먹을 만했다. 어둠 속에서 은은하게 빛나는 게 좀 걸리지만, 배는 채웠다.', effects: [{ type: 'character', target: 'all', field: 'foodDays', value: 0 }] },
          { weight: 45, resultText: '한 입 먹자마자 속이 뒤집혔다. 역시 벽에 난 건 먹는 게 아니었다.', effects: [{ type: 'character', target: 'random', field: 'health', value: 'sick' }] },
        ],
      },
      {
        text: '아무리 배고파도 먹지 않는다',
        outcomes: [
          { weight: 100, resultText: '배는 고프지만, 먹지 말아야 할 것도 있는 법이다.', effects: [] },
        ],
      },
    ],
  },

  {
    id: 'wandering_trader',
    title: '떠돌이 상인',
    description: '덩치 큰 호위를 데리고 온 상인이 문을 두드린다. 가방을 열어 보이며 거래를 제안한다.',
    minDay: 5,
    once: true,
    choices: [
      {
        text: '통조림 2개를 주고 구급상자를 받는다',
        outcomes: [
          { weight: 100, resultText: '깔끔한 거래였다. 상인은 라디오 방송을 꼭 챙겨 들으라는 말을 남기고 떠났다.', effects: [
            { type: 'resource', key: 'food', delta: -2 },
            { type: 'item', itemId: 'first_aid', delta: 1 },
          ] },
        ],
      },
      {
        text: '물 2병을 주고 지도를 받는다',
        outcomes: [
          { weight: 100, resultText: '상인은 흔쾌히 지도를 내주고 길을 떠났다.', effects: [
            { type: 'resource', key: 'water', delta: -2 },
            { type: 'item', itemId: 'map', delta: 1 },
          ] },
        ],
      },
      {
        text: '거래하지 않는다',
        outcomes: [
          { weight: 100, resultText: '상인은 아쉬워하며 돌아섰다. 다음에 또 올지는 모르겠다.', effects: [] },
        ],
      },
    ],
  },

  {
    id: 'wall_stench',
    title: '벽 틈에서 나는 악취',
    description: '벽돌 하나가 헐거워지며 좁은 구멍이 드러났다. 그 안에서 참기 힘든 냄새가 올라온다.',
    minDay: 3,
    once: false,
    choices: [
      {
        text: '구멍 안을 살펴본다',
        outcomes: [
          { weight: 50, resultText: '통조림을 물고 죽어 있는 쥐 한 마리가 있었다. 통조림은 멀쩡했다.', effects: [{ type: 'resource', key: 'food', delta: 1 }] },
          { weight: 30, resultText: '안에서 뭔가가 튀어나와 대피소를 헤집고 다니다 라디오를 떨어뜨리고 사라졌다.', effects: [{ type: 'item', itemId: 'radio', delta: -1 }] },
          { weight: 20, resultText: '한참 들여다봤지만 아무것도 없었다. 냄새만 실컷 맡았다.', effects: [{ type: 'character', target: 'all', field: 'sanity', delta: -3 }] },
        ],
      },
      {
        text: '그냥 막아둔다',
        outcomes: [
          { weight: 100, resultText: '헝겊으로 대충 틀어막았다. 냄새는 며칠 더 갔다.', effects: [{ type: 'character', target: 'all', field: 'sanity', delta: -4 }] },
        ],
      },
    ],
  },

  {
    id: 'hidden_safe',
    title: '지도 뒤의 금고',
    description: '벽에 붙여둔 지도가 아침에 저절로 떨어졌다. 그 뒤에 작은 금고가 박혀 있다. 우리가 설치한 게 아니다.',
    minDay: 4,
    once: true,
    conditions: { requiredItems: [{ id: 'map', count: 1 }] },
    choices: [
      {
        text: '열어본다',
        outcomes: [
          { weight: 40, resultText: '안에 비상식량이 들어 있었다. 이 집 주인은 꽤 준비성이 좋았던 모양이다.', effects: [{ type: 'resource', key: 'food', delta: 2 }] },
          { weight: 30, resultText: '손전등이 하나 들어 있었다. 쓸모가 많겠다.', effects: [{ type: 'item', itemId: 'flashlight', delta: 1 }] },
          { weight: 30, resultText: '금고 문을 여는 순간 불이 나갔다. 다시 켜졌을 땐 식량이 조금 비어 있었다.', effects: [{ type: 'resource', key: 'food', delta: -1 }] },
        ],
      },
      {
        text: '괜히 건드리지 않는다',
        outcomes: [
          { weight: 100, resultText: '이미 문제는 충분히 많다. 금고는 그대로 두기로 했다.', effects: [] },
        ],
      },
    ],
  },

  {
    id: 'armed_teens',
    title: '무장한 무리',
    description: '"자유의 이름으로 문을 열어라!" 밖에서 누군가 외친다. 여러 명, 그리고 총기를 들고 있는 것 같다.',
    minDay: 6,
    once: true,
    choices: [
      {
        text: '문을 열어준다',
        outcomes: [
          { weight: 35, resultText: '무장한 고등학생 무리였다. 적군을 못 봤냐고 묻더니, 빈손인 우리에게 물을 나눠주고 떠났다.', effects: [{ type: 'resource', key: 'water', delta: 2 }] },
          { weight: 30, resultText: '겁먹은 우리를 보더니 여분의 도끼를 하나 건네주고는 씩씩하게 사라졌다.', effects: [{ type: 'item', itemId: 'axe', delta: 1 }] },
          { weight: 20, resultText: '무기가 없다는 말에 여분의 소총을 넘겨주고 떠났다. 어리지만 든든한 아이들이었다.', effects: [{ type: 'item', itemId: 'rifle', delta: 1 }] },
          { weight: 15, resultText: '문을 열자마자 총구가 들이닥쳤다. 물자를 조금 빼앗기고 나서야 물러갔다.', effects: [
            { type: 'resource', key: 'food', delta: -2 },
            { type: 'character', target: 'all', field: 'sanity', delta: -5 },
          ] },
        ],
      },
      {
        text: '숨죽이고 기다린다',
        outcomes: [
          { weight: 100, resultText: '한참 뒤 발소리가 멀어졌다. 현명한 판단이었길 바란다.', effects: [{ type: 'character', target: 'all', field: 'sanity', delta: -3 }] },
        ],
      },
    ],
  },

  {
    id: 'claustrophobia',
    title: '숨이 막힌다',
    description: '벽이 조여오는 것 같다는 사람이 나왔다. 문을 잠깐만 열어서 바람이라도 쐬자고 한다.',
    minDay: 4,
    once: false,
    choices: [
      {
        text: '잠깐만 문을 연다',
        outcomes: [
          { weight: 45, resultText: '잠깐 바깥 공기를 쐬자 한결 나아졌다. 물론 그 공기가 깨끗할 리는 없지만.', effects: [{ type: 'character', target: 'all', field: 'sanity', delta: 8 }] },
          { weight: 55, resultText: '오염된 공기가 밀려들어왔다. 답답함은 가셨지만 대신 속이 메스껍다.', effects: [
            { type: 'character', target: 'all', field: 'sanity', delta: 5 },
            { type: 'character', target: 'random', field: 'health', value: 'sick' },
          ] },
        ],
      },
      {
        text: '절대 열지 않는다',
        outcomes: [
          { weight: 100, resultText: '문을 닫아둔 건 옳은 판단이었다. 다만 그날 대피소 공기는 유난히 무거웠다.', effects: [{ type: 'character', target: 'all', field: 'sanity', delta: -7 }] },
        ],
      },
    ],
  },

  {
    id: 'kids_play_tag',
    title: '좁은 곳에서의 술래잡기',
    description: '아이들이 몸이 근질거리는지 대피소 안에서 뛰어놀고 싶어한다. 공간이 넉넉할 리가 없다.',
    minDay: 3,
    once: false,
    conditions: { minCharacters: 2 },
    choices: [
      {
        text: '놀게 둔다',
        outcomes: [
          { weight: 45, resultText: '한참을 뛰어다니며 웃었다. 구석에 굴러다니던 통조림까지 찾아냈다.', effects: [
            { type: 'character', target: 'all', field: 'sanity', delta: 8 },
            { type: 'resource', key: 'food', delta: 1 },
          ] },
          { weight: 30, resultText: '신나게 놀긴 했는데, 부딪히는 바람에 선반 위 물건이 죄다 쏟아졌다.', effects: [
            { type: 'character', target: 'all', field: 'sanity', delta: 6 },
            { type: 'resource', key: 'water', delta: -1 },
          ] },
          { weight: 25, resultText: '뛰다가 넘어져 한 명이 다쳤다. 그래도 표정은 한결 밝아졌다.', effects: [
            { type: 'character', target: 'all', field: 'sanity', delta: 5 },
            { type: 'character', target: 'random', field: 'health', value: 'injured' },
          ] },
        ],
      },
      {
        text: '안 된다고 한다',
        outcomes: [
          { weight: 100, resultText: '여기서 뛸 공간은 없다. 아이들은 시무룩해졌다.', effects: [{ type: 'character', target: 'all', field: 'sanity', delta: -6 }] },
        ],
      },
    ],
  },

  {
    id: 'dog_errand',
    title: '나가고 싶어하는 개',
    description: '개가 몇 시간째 문 앞에서 낑낑거린다. 잠깐 내보내주면 뭔가 물어올지도 모른다.',
    minDay: 4,
    once: false,
    conditions: { requiredFlags: { dogJoined: true } },
    choices: [
      {
        text: '잠깐 내보낸다',
        outcomes: [
          { weight: 30, resultText: '물병을 하나 물고 돌아왔다. 대체 어떻게 물고 온 건지 모르겠다.', effects: [{ type: 'resource', key: 'water', delta: 1 }] },
          { weight: 25, resultText: '통조림을 하나 물고 왔다. 기특하다.', effects: [{ type: 'resource', key: 'food', delta: 1 }] },
          { weight: 15, resultText: '어디서 구했는지 구급상자를 통째로 끌고 왔다.', effects: [{ type: 'item', itemId: 'first_aid', delta: 1 }] },
          { weight: 30, resultText: '빈손으로 돌아왔지만, 돌아왔다는 것만으로 다들 안도했다.', effects: [{ type: 'character', target: 'all', field: 'sanity', delta: 4 }] },
        ],
      },
      {
        text: '위험하니 그냥 둔다',
        outcomes: [
          { weight: 100, resultText: '한참 낑낑거리다 결국 발치에 엎드려 잠들었다.', effects: [] },
        ],
      },
    ],
  },

  {
    id: 'cat_and_checkers',
    title: '고양이와 체커판',
    description: '고양이가 체커 말을 하나씩 바닥으로 밀어 떨어뜨리는 데 재미를 붙였다. 하루 종일 딸깍거리는 소리에 다들 신경이 곤두선다.',
    minDay: 5,
    once: true,
    conditions: { requiredFlags: { catJoined: true }, requiredItems: [{ id: 'board_game', count: 1 }] },
    choices: [
      {
        text: '그냥 놀게 둔다',
        outcomes: [
          { weight: 60, resultText: '허락하자마자 흥미를 잃더니 체커판 위에 올라앉아 오후 내내 잠만 잤다.', effects: [] },
          { weight: 40, resultText: '실컷 가지고 놀더니 기어이 체커판을 두 동강 내놓았다. 어떻게 한 건지는 모르겠다.', effects: [{ type: 'item', itemId: 'board_game', delta: -1 }] },
        ],
      },
      {
        text: '체커판을 치운다',
        outcomes: [
          { weight: 100, resultText: '빼앗으려 하자 사납게 달려들었다. 결국 체커판을 포기하고 물러섰다.', effects: [
            { type: 'item', itemId: 'board_game', delta: -1 },
            { type: 'character', target: 'all', field: 'sanity', delta: -3 },
          ] },
        ],
      },
    ],
  },

  {
    id: 'dark_side_neighbor',
    title: '이웃의 대피소',
    description: '물자가 바닥을 보인다. 길 건너 이웃집 대피소의 잠금장치가 고장 나 있다는 걸 다들 알고 있다. 그 집 사람들이 무사히 들어갔는지는... 모른다.',
    minDay: 8,
    once: true,
    choices: [
      {
        text: '가서 가져온다',
        outcomes: [
          { weight: 55, resultText: '물자는 챙겼다. 하지만 아무도 그날 일을 입에 올리지 않았다.', effects: [
            { type: 'resource', key: 'food', delta: 4 },
            { type: 'resource', key: 'water', delta: 3 },
            { type: 'character', target: 'all', field: 'sanity', delta: -15 },
            { type: 'flag', key: 'bloodyHands', value: true },
          ] },
          { weight: 45, resultText: '문을 열자 총구가 우리를 맞이했다. 그 집 사람들은 멀쩡히 살아 있었다. 아무 말도 못 하고 돌아왔다.', effects: [
            { type: 'character', target: 'all', field: 'sanity', delta: -12 },
            { type: 'flag', key: 'bloodyHands', value: true },
          ] },
        ],
      },
      {
        text: '그럴 수는 없다',
        outcomes: [
          { weight: 100, resultText: '배가 고파도 넘지 말아야 할 선은 있다. 그렇게 정하고 나니 마음이 한결 가벼워졌다.', effects: [{ type: 'character', target: 'all', field: 'sanity', delta: 10 }] },
        ],
      },
    ],
  },

  {
    id: 'plant_seed',
    title: '주머니 속의 씨앗',
    description: '짐을 뒤지다 씨앗 한 알이 나왔다. 무슨 씨앗인지는 모르지만, 물 한 병만 쓰면 심어볼 수는 있다.',
    minDay: 3,
    once: true,
    choices: [
      {
        text: '물을 써서 심어본다',
        outcomes: [
          { weight: 100, resultText: '빈 깡통에 흙을 채우고 씨앗을 묻었다. 뭐라도 나오길 기다려보기로 했다.', effects: [
            { type: 'resource', key: 'water', delta: -1 },
            { type: 'flag', key: 'seedPlanted', value: true },
            { type: 'character', target: 'all', field: 'sanity', delta: 5 },
          ] },
        ],
      },
      {
        text: '물이 아깝다',
        outcomes: [
          { weight: 100, resultText: '물은 마시는 데 써야 한다. 씨앗은 그대로 주머니에 넣어뒀다.', effects: [{ type: 'character', target: 'all', field: 'sanity', delta: -4 }] },
        ],
      },
    ],
  },

  {
    id: 'plant_harvest',
    title: '자라난 것',
    description: '깡통에 심어둔 씨앗이 며칠 만에 사람 키만큼 자랐다. 가지에 뭔가 주렁주렁 달려 있는데, 어둠 속에서 희미하게 빛난다.',
    minDay: 6,
    once: true,
    conditions: { requiredFlags: { seedPlanted: true } },
    choices: [
      {
        text: '수확해서 먹는다',
        outcomes: [
          { weight: 70, resultText: '빛나는 게 좀 꺼림칙했지만, 통조림 네 개 분량은 충분히 나왔다.', effects: [{ type: 'resource', key: 'food', delta: 4 }] },
          { weight: 30, resultText: '먹자마자 속이 뒤집혔다. 역시 빛나는 건 먹는 게 아니었다.', effects: [
            { type: 'resource', key: 'food', delta: 2 },
            { type: 'character', target: 'random', field: 'health', value: 'sick' },
          ] },
        ],
      },
      {
        text: '좀 더 키워본다',
        outcomes: [
          { weight: 100, resultText: '욕심을 부렸더니 하룻밤 사이에 폭삭 삭아 재가 되어버렸다.', effects: [{ type: 'character', target: 'all', field: 'sanity', delta: -5 }] },
        ],
      },
    ],
  },
];
