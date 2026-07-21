// ============================================================
// state.js — 게임 전역 상태
// ============================================================
// 캐릭터 상태값: 'healthy' | 'injured' | 'sick' | 'dead'
// 캐릭터 위치값: 'shelter' | 'scavenging' | 'missing' | 'dead'
//   - 'missing': 짐싸기에서 못 찾았거나, 원정 나갔다가 안 돌아온 경우 (영구 실종)

// 게임 전체 설정값
window.GAME_CONFIG = {
  goalDay: 45, // 이 날짜를 넘기면(생존) 엔딩 판정
};

function createCharacter({ id, name, age, isChild = false, startLocation = 'shelter' }) {
  return {
    id,
    name,
    age,
    isChild,
    health: 'healthy',
    location: startLocation,
    hunger: 0,     // 0~3, 높을수록 배고픔 (3이면 굶어죽기 직전)
    thirst: 0,     // 0~3
    sanity: 100,   // 정신력, 이벤트/일수 경과로 감소
    expedition: null, // 원정 나간 경우 { id, returnDay }
  };
}

function createInitialState() {
  return {
    day: 1,
    phase: 'scavenge', // 'scavenge' | 'shelter' | 'gameover' | 'ending'
    rationLevel: 'normal', // 'half' | 'normal' | 'double'
    resources: {
      food: 0,
      water: 0,
    },
    inventory: {}, // { itemId: count }
    characters: [
      // 아빠(플레이어 시점 인물)만 처음부터 대피소에 있음. 나머지는 짐싸기에서 "찾아야" 함.
      createCharacter({ id: 'dad', name: '아빠', age: 42, startLocation: 'shelter' }),
      createCharacter({ id: 'mom', name: '엄마', age: 40, startLocation: 'missing' }),
      createCharacter({ id: 'son', name: '아들', age: 14, isChild: true, startLocation: 'missing' }),
      createCharacter({ id: 'daughter', name: '딸', age: 10, isChild: true, startLocation: 'missing' }),
    ],
    log: [],       // 이벤트/선택 히스토리 { day, text }
    flags: {},     // 이벤트 조건용 임의 플래그 저장소 { flagName: true/값 }
    gameOverReason: null,
    endingResult: null, // 목표 생존일수 달성 시 { id, title, description }
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
