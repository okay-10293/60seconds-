// ============================================================
// state.js — 게임 전역 상태
// ============================================================
// 캐릭터 상태값: 'healthy' | 'injured' | 'sick' | 'dead'
// 캐릭터 위치값: 'shelter' | 'scavenging' | 'missing' | 'dead'

function createCharacter({ id, name, age, isChild = false }) {
  return {
    id,
    name,
    age,
    isChild,
    health: 'healthy',
    location: 'shelter',
    hunger: 0,     // 0~3, 높을수록 배고픔 (3이면 굶어죽기 직전)
    thirst: 0,     // 0~3
    sanity: 100,   // 정신력, 이벤트/일수 경과로 감소
  };
}

function createInitialState() {
  return {
    day: 1,
    phase: 'scavenge', // 'scavenge' | 'shelter' | 'gameover'
    resources: {
      food: 0,
      water: 0,
    },
    inventory: {}, // { itemId: count }
    characters: [
      createCharacter({ id: 'dad', name: '아빠', age: 42 }),
      createCharacter({ id: 'mom', name: '엄마', age: 40 }),
      createCharacter({ id: 'son', name: '아들', age: 14, isChild: true }),
      createCharacter({ id: 'daughter', name: '딸', age: 10, isChild: true }),
    ],
    log: [],       // 이벤트/선택 히스토리 { day, text }
    flags: {},     // 이벤트 조건용 임의 플래그 저장소 { flagName: true/값 }
    gameOverReason: null,
  };
}

function addLog(state, text) {
  state.log.push({ day: state.day, text });
}

function getCharacter(state, id) {
  return state.characters.find((c) => c.id === id);
}

function livingCharacters(state) {
  return state.characters.filter((c) => c.health !== 'dead');
}

function shelterCharacters(state) {
  return state.characters.filter((c) => c.location === 'shelter' && c.health !== 'dead');
}

function itemCount(state, itemId) {
  return state.inventory[itemId] || 0;
}

function addItem(state, itemId, count = 1) {
  state.inventory[itemId] = itemCount(state, itemId) + count;
}

function removeItem(state, itemId, count = 1) {
  const next = itemCount(state, itemId) - count;
  state.inventory[itemId] = Math.max(0, next);
}

function hasItem(state, itemId, count = 1) {
  return itemCount(state, itemId) >= count;
}

// 저장/불러오기 (localStorage 대신 export/import 형태로, 나중에 Supabase 연동 가능)
function serializeState(state) {
  return JSON.stringify(state);
}

function deserializeState(json) {
  return JSON.parse(json);
}

window.GameState = {
  createInitialState,
  createCharacter,
  addLog,
  getCharacter,
  livingCharacters,
  shelterCharacters,
  itemCount,
  addItem,
  removeItem,
  hasItem,
  serializeState,
  deserializeState,
};
