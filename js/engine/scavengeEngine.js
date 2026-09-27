// ============================================================
// scavengeEngine.js — 탈출(짐싸기) 파트
// ============================================================
// 조이스틱으로 캐릭터를 직접 움직여서, 집 안 여러 방에 놓인 아이템 위로
// 걸어가면 줍고(한 번에 한 개만 들 수 있음), 그걸 대피소 입구까지
// 날라야 진짜로 챙겨진다. 가족은 있는 곳까지 걸어가서 닿으면 바로 구조.
// 이 전부를 60초 안에 해야 함.
//
// ★ 방/아이템 배치 ★
// 방 목록(ROOM_DEFS)에 스폰 테이블만 추가하면 buildLayout()이 알아서
// 방 사각형 안에 격자로 아이템 좌표를 배치해줌.

const SCAVENGE_TIME_LIMIT = 60; // 초

const WORLD_W = 900;
const WORLD_H = 640;
const DROPZONE_H = 90; // 맨 아래 "대피소 입구" 통로 높이
const PICKUP_RADIUS = 30; // 이 거리 안으로 들어오면 자동으로 줍는다/찾는다

// 방에 놓일 아이템 & 가족 스폰 테이블 (나중에 방 추가하려면 여기에 배열만 추가)
window.SCAVENGE_ROOMS = [
  {
    id: 'kitchen',
    name: '주방',
    spawns: ['canned_food', 'canned_food', 'canned_food', 'water_bottle', 'water_bottle', 'water_bottle', 'first_aid', 'pesticide'],
    familySpawns: [],
  },
  {
    id: 'living_room',
    name: '거실',
    spawns: ['radio', 'board_game', 'playing_cards', 'map', 'canned_food', 'harmonica'],
    familySpawns: ['mom'],
  },
  {
    id: 'bedroom',
    name: '침실',
    spawns: ['flashlight', 'first_aid', 'survival_book', 'water_bottle', 'axe'],
    familySpawns: ['son', 'daughter'],
  },
  {
    id: 'garage',
    name: '차고',
    spawns: ['rifle', 'ammo', 'flashlight', 'canned_food', 'survival_book', 'gas_mask'],
    familySpawns: [],
  },
  {
    id: 'basement',
    name: '지하실',
    spawns: ['gas_mask', 'suitcase', 'canned_food', 'water_bottle', 'lock'],
    familySpawns: [],
  },
  {
    id: 'bathroom',
    name: '화장실',
    spawns: ['first_aid', 'water_bottle', 'flashlight', 'lock'],
    familySpawns: [],
  },
];

// 3열 x 2행 격자로 방을 배치 (위쪽 2행은 방, 맨 아래는 대피소 입구 통로)
const GRID_COLS = 3;
const GRID_ROWS = 2;
const ROOM_AREA_H = WORLD_H - DROPZONE_H;
const ROOM_W = WORLD_W / GRID_COLS;
const ROOM_H = ROOM_AREA_H / GRID_ROWS;

function roomRect(index) {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  return {
    x: col * ROOM_W,
    y: row * ROOM_H,
    w: ROOM_W,
    h: ROOM_H,
  };
}

// 방 사각형 안에 n개의 점을 격자로 고르게 배치 (벽에서 살짝 띄움)
function gridPoints(rect, n, padding = 46) {
  if (n <= 0) return [];
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const usableW = rect.w - padding * 2;
  const usableH = rect.h - padding * 2;
  const points = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = rect.x + padding + (cols === 1 ? usableW / 2 : (usableW * col) / (cols - 1));
    const cy = rect.y + padding + (rows === 1 ? usableH / 2 : (usableH * row) / (rows - 1));
    points.push({ x: cx, y: cy });
  }
  return points;
}

// 방 배치 + 아이템/가족 스폰 좌표를 포함한 "월드 레이아웃"을 만든다.
// (state.js의 게임 상태와는 별개로, 이번 판 탈출 화면 전용 데이터)
function buildLayout() {
  const rooms = window.SCAVENGE_ROOMS.map((room, idx) => ({
    ...room,
    rect: roomRect(idx),
  }));

  const items = [];
  const family = [];

  rooms.forEach((room) => {
    const itemPoints = gridPoints(room.rect, room.spawns.length);
    room.spawns.forEach((itemId, i) => {
      items.push({
        key: `${room.id}_item_${i}`,
        itemId,
        roomId: room.id,
        x: itemPoints[i].x,
        y: itemPoints[i].y,
        taken: false,
      });
    });

    const famPoints = gridPoints(room.rect, room.familySpawns.length, 60);
    room.familySpawns.forEach((characterId, i) => {
      family.push({
        key: `${room.id}_family_${i}`,
        characterId,
        roomId: room.id,
        x: famPoints[i].x,
        y: famPoints[i].y,
      });
    });
  });

  const dropzone = { x: 0, y: WORLD_H - DROPZONE_H, w: WORLD_W, h: DROPZONE_H };

  return { rooms, items, family, dropzone };
}

function startScavenge(state) {
  const layout = buildLayout();
  return {
    timeLeft: SCAVENGE_TIME_LIMIT,
    collected: [], // itemId 배열 (이번 판에서 대피소 입구까지 날라 확정된 것)
    foundFamily: [], // characterId 배열 (이번 판에서 찾은 가족)
    rooms: layout.rooms,
    items: layout.items, // { key, itemId, roomId, x, y, taken }
    // 이미 대피소에 있거나 죽은 가족은 찾을 대상이 아니므로 '실종(missing)' 상태만 배치
    family: layout.family.filter((f) => {
      const c = state.characters.find((ch) => ch.id === f.characterId);
      return c && c.location === 'missing';
    }), // { key, characterId, roomId, x, y }
    dropzone: layout.dropzone,
    player: { x: layout.dropzone.x + layout.dropzone.w / 2, y: layout.dropzone.y + layout.dropzone.h / 2 },
    carrying: null, // { key, itemId } | null — 한 번에 하나만 들 수 있음
  };
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function inRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// 매 프레임 호출: 플레이어 좌표 기준으로 줍기/구조하기/납품을 자동 처리한다.
// (실제 렌더링은 main.js가 담당, 여긴 순수 상태 갱신만)
function updateScavenge(scavengeState) {
  const p = scavengeState.player;

  // 안 들고 있으면 근처 아이템 자동 줍기
  if (!scavengeState.carrying) {
    const near = scavengeState.items.find(
      (it) => !it.taken && dist(p.x, p.y, it.x, it.y) <= PICKUP_RADIUS
    );
    if (near) {
      scavengeState.carrying = { key: near.key, itemId: near.itemId };
      near.taken = true; // 바닥에서는 사라짐 (들고 있는 중)
    }
  }

  // 대피소 입구 통로에 들어왔고 뭔가 들고 있으면 납품
  if (scavengeState.carrying && inRect(p.x, p.y, scavengeState.dropzone)) {
    scavengeState.collected.push(scavengeState.carrying.itemId);
    scavengeState.carrying = null;
  }

  // 가족은 닿기만 하면 바로 구조
  scavengeState.family.forEach((fam) => {
    if (scavengeState.foundFamily.includes(fam.characterId)) return;
    if (dist(p.x, p.y, fam.x, fam.y) <= PICKUP_RADIUS) {
      scavengeState.foundFamily.push(fam.characterId);
    }
  });
}

// 타이머 종료 -> 주운 아이템들을 실제 게임 상태 인벤토리/자원으로 반영
// + 찾은/못 찾은 가족을 shelter/missing으로 확정
// (시간 종료 시 손에 들고 있던 것(carrying)은 납품 전이라 사라짐 — 원작처럼
//  "들고 뛰다가 시간 끝나면 못 챙긴 것"으로 처리)
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

window.ScavengeEngine = {
  SCAVENGE_TIME_LIMIT,
  WORLD_W,
  WORLD_H,
  PICKUP_RADIUS,
  startScavenge,
  updateScavenge,
  finishScavenge,
};
