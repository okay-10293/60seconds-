// ============================================================
// scavengeEngine.js — 탈출(짐싸기) 파트
// ============================================================
// 원작처럼 집 안 여러 방에 아이템을 랜덤 배치하고, 타이머 안에
// 클릭한 아이템만 인벤토리로 들어가는 방식. 방 배치는 스폰 테이블로 관리.
//
// ★ 가족 구조 시스템 ★
// 각 방의 familySpawns 배열에 캐릭터 id를 넣으면, 그 방에서 해당 가족을
// "찾아서" 데려올 수 있음. 시간 안에 클릭해서 못 찾으면 그 가족은
// 영구적으로 실종(location: 'missing') 처리됨.

const SCAVENGE_TIME_LIMIT = 60; // 초

// 방에 놓일 아이템 & 가족 스폰 테이블 (나중에 방 추가하려면 여기에 배열만 추가)
window.SCAVENGE_ROOMS = [
  {
    id: 'kitchen',
    name: '주방',
    spawns: ['canned_food', 'canned_food', 'canned_food', 'water_bottle', 'water_bottle', 'water_bottle', 'first_aid'],
    familySpawns: [],
  },
  {
    id: 'living_room',
    name: '거실',
    spawns: ['radio', 'board_game', 'playing_cards', 'family_photo', 'canned_food'],
    familySpawns: ['mom'],
  },
  {
    id: 'bedroom',
    name: '침실',
    spawns: ['flashlight', 'first_aid', 'family_photo', 'water_bottle'],
    familySpawns: ['son', 'daughter'],
  },
  {
    id: 'garage',
    name: '차고',
    spawns: ['rifle', 'water_purifier', 'flashlight', 'canned_food'],
    familySpawns: [],
  },
];

function startScavenge(state) {
  return {
    timeLeft: SCAVENGE_TIME_LIMIT,
    collected: [], // itemId 배열 (이번 판에서 주운 것)
    foundFamily: [], // characterId 배열 (이번 판에서 찾은 가족)
    rooms: window.SCAVENGE_ROOMS,
  };
}

// 아이템 하나 줍기 (UI 클릭 핸들러에서 호출)
function collectItem(scavengeState, itemId) {
  scavengeState.collected.push(itemId);
}

// 가족 한 명 찾기 (UI 클릭 핸들러에서 호출)
function collectFamily(scavengeState, characterId) {
  if (!scavengeState.foundFamily.includes(characterId)) {
    scavengeState.foundFamily.push(characterId);
  }
}

// 타이머 종료 -> 주운 아이템들을 실제 게임 상태 인벤토리/자원으로 반영
// + 찾은/못 찾은 가족을 shelter/missing으로 확정
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

  const stillMissing = state.characters.filter((c) => c.location === 'missing');
  stillMissing.forEach((c) => {
    if (scavengeState.foundFamily.includes(c.id)) {
      c.location = 'shelter';
      window.GameState.addLog(state, `${c.name}을(를) 찾아서 함께 대피소로 향했다.`);
    } else {
      state.flags[`_lost_${c.id}`] = true;
      window.GameState.addLog(state, `${c.name}을(를) 끝내 찾지 못했다... 실종되었다.`);
    }
  });

  window.GameState.addLog(state, `탈출하며 ${scavengeState.collected.length}개의 아이템을 챙겼다.`);
  state.phase = 'shelter';
}

window.ScavengeEngine = { SCAVENGE_TIME_LIMIT, startScavenge, collectItem, collectFamily, finishScavenge };
