// ============================================================
// scavengeEngine.js — 탈출(짐싸기) 파트
// ============================================================
// 원작처럼 집 안 여러 방에 아이템을 랜덤 배치하고, 타이머 안에
// 클릭한 아이템만 인벤토리로 들어가는 방식. 방 배치는 스폰 테이블로 관리.

const SCAVENGE_TIME_LIMIT = 60; // 초

// 방에 놓일 아이템 스폰 테이블 (나중에 방 추가하려면 여기에 배열만 추가)
window.SCAVENGE_ROOMS = [
  {
    id: 'kitchen',
    name: '주방',
    spawns: ['canned_food', 'canned_food', 'water_bottle', 'water_bottle', 'first_aid'],
  },
  {
    id: 'living_room',
    name: '거실',
    spawns: ['radio', 'board_game', 'playing_cards', 'family_photo'],
  },
  {
    id: 'bedroom',
    name: '침실',
    spawns: ['flashlight', 'first_aid', 'family_photo'],
  },
  {
    id: 'garage',
    name: '차고',
    spawns: ['rifle', 'water_purifier', 'flashlight'],
  },
];

function startScavenge(state) {
  return {
    timeLeft: SCAVENGE_TIME_LIMIT,
    collected: [], // itemId 배열 (이번 판에서 주운 것)
    rooms: window.SCAVENGE_ROOMS,
  };
}

// 아이템 하나 줍기 (UI 클릭 핸들러에서 호출)
function collectItem(scavengeState, itemId) {
  scavengeState.collected.push(itemId);
}

// 타이머 종료 -> 주운 아이템들을 실제 게임 상태 인벤토리/자원으로 반영
function finishScavenge(state, scavengeState) {
  scavengeState.collected.forEach((itemId) => {
    const item = window.ItemsAPI.getItem(itemId);
    // 식량/물 카테고리는 매일 소비되는 resources 풀로 적립
    if (item && item.category === 'food') {
      state.resources.food += 1;
    } else if (item && item.category === 'water') {
      state.resources.water += 1;
    } else {
      // 나머지(도구/무기/특수 아이템 등)는 인벤토리에 개별 보관
      window.GameState.addItem(state, itemId, 1);
    }
  });
  window.GameState.addLog(state, `탈출하며 ${scavengeState.collected.length}개의 아이템을 챙겼다.`);
  state.phase = 'shelter';
}

window.ScavengeEngine = { SCAVENGE_TIME_LIMIT, startScavenge, collectItem, finishScavenge };
