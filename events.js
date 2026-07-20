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
];
