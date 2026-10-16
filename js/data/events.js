// ============================================================
// events.js — 대피소 이벤트 풀
// ============================================================
// ★ 새 이벤트/선택지는 이 배열에 객체만 추가하면 됨 (엔진 코드 안 건드림) ★
//
// Event 스키마:
// {
//   id: string (유니크),
//   title: string,
//   description: string,        // 둘 중 하나만 쓰면 됨
//   descriptions: [string],      // 여러 개면 매번 그중 하나를 랜덤으로 보여줌
//                                 (선택지/결과는 어느 문구가 나오든 동일함)
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
//
// ------------------------------------------------------------
// 현재 이벤트는 모두 비워둔 상태입니다 (EVENTS = []).
// 이전에 들어 있던 'Send Someone' 이벤트 13개(번역본)는 git 태그
// `events-backup-before-clear` 에 그대로 남아 있습니다:
//   git checkout events-backup-before-clear -- js/data/events.js
// 이벤트가 하나도 없으면 매일 '특별한 일 없이 하루가 지나갔다'로 처리됩니다.
// ------------------------------------------------------------

window.EVENTS = [];
