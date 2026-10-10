// ============================================================
// state.js — 게임 전역 상태
// ============================================================
// 캐릭터 상태값: 'healthy' | 'injured' | 'sick' | 'dead'
// 캐릭터 위치값: 'shelter' | 'scavenging' | 'missing' | 'dead'
//   - 'missing': 짐싸기에서 못 찾았거나, 원정 나갔다가 안 돌아온 경우 (영구 실종)

function createCharacter({ id, name, age, isChild = false, startLocation = 'shelter' }) {
  return {
    id,
    name,
    age,
    isChild,
    health: 'healthy',
    location: startLocation,
    waterDays: 0,  // 물을 못 마신 연속 일수 (원작처럼 단계적 상태이상으로 이어짐)
    foodDays: 0,   // 식량을 못 먹은 연속 일수
    injuredDays: 0, // 부상을 치료받지 못한 연속 일수 (부상은 자연치유 안 됨, 방치하면 악화)
    sickDays: 0, // 병약 상태가 지속된 연속 일수 (오래 방치하면 사망/가출)
    sickFeedStreak: 0, // 병약 상태에서 연속으로 밥을 챙겨 먹은 일수 (3일 이상이면 자연회복 가능)
    exhausted: false, // 탈진 상태 (원정 불가, 며칠 지나면 랜덤하게 자연 치유, 카드/체커로 즉시 치유)
    fedFoodToday: false,   // 오늘 이미 밥을 줬는지 (배급 패널에서 1인당 1회, 1/4씩)
    fedWaterToday: false,  // 오늘 이미 물을 줬는지
    sanity: 100,   // 정신력, 이벤트/일수 경과로 감소
    expedition: null, // 원정 나간 경우 { id, returnDay }
  };
}

function createInitialState() {
  return {
    day: 1,
    phase: 'title', // 'title' | 'scavenge' | 'shelter' | 'gameover' | 'ending'
    resources: {
      food: 0,
      water: 0,
    },
    inventory: {}, // { itemId: count }
    characters: [
      // 아빠(플레이어 시점 인물)만 처음부터 대피소에 있음. 나머지는 짐싸기에서 "찾아야" 함.
      createCharacter({ id: 'dad', name: '테드', age: 42, startLocation: 'shelter' }),
      createCharacter({ id: 'mom', name: '돌로레스', age: 40, startLocation: 'missing' }),
      createCharacter({ id: 'son', name: '티미', age: 14, isChild: true, startLocation: 'missing' }),
      createCharacter({ id: 'daughter', name: '메리 제인', age: 10, isChild: true, startLocation: 'missing' }),
    ],
    log: [],       // 이벤트/선택 히스토리 { day, text }
    flags: {},     // 이벤트 조건용 임의 플래그 저장소 { flagName: true/값 }
    gameOverReason: null,
    endingResult: null, // 엔딩 판정 결과 { id, title, description }
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

// 식량/물이 아닌 아이템은 개수가 아니라 '있다/없다'로만 관리한다 (최대 1개).
function isUniqueItem(itemId) {
  const item = window.ItemsAPI && window.ItemsAPI.getItem(itemId);
  return !!item && item.category !== 'food' && item.category !== 'water';
}

function addItem(state, itemId, count = 1) {
  const next = itemCount(state, itemId) + count;
  state.inventory[itemId] = isUniqueItem(itemId) ? Math.min(1, next) : next;
}

function removeItem(state, itemId, count = 1) {
  const next = itemCount(state, itemId) - count;
  state.inventory[itemId] = Math.max(0, next);
}

// 이미 갖고 있는가? (대피소 인벤토리 + 지금 원정에 들고 나간 장비까지 포함)
function ownsItem(state, itemId) {
  if (itemCount(state, itemId) > 0) return true;
  return state.characters.some(
    (c) => c.expedition && c.expedition.equippedItems && c.expedition.equippedItems.includes(itemId)
  );
}

// 새로 얻을 수 있는가? 식량/물은 항상 가능, 그 외 물자는 아직 없을 때만 가능(무조건 1개만 존재).
function canGainItem(state, itemId) {
  return !isUniqueItem(itemId) || !ownsItem(state, itemId);
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
  ownsItem,
  canGainItem,
  serializeState,
  deserializeState,
};
