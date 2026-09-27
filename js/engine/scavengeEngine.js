// ============================================================
// scavengeEngine.js — 탈출(짐싸기) 파트
// ============================================================
// 가운데 세로 복도를 중심으로 위쪽 방 1개 + 양옆 방 4개가 붙어 있고, 맨 아래가
// 방공호(대피소 입구)인 집 구조. 어느 방이 어느 자리에 오는지는 판마다 랜덤.
//
// 조작: 조이스틱으로 이동 → 가까이 가서 '챙기기' 버튼으로 원하는 물자를 집어든다
// (한 번에 하나만). 방공호 안으로 들고 들어가면 확정. 가족도 '구조하기' 버튼.
// 벽이 있어서 문(door)으로만 복도와 방을 오갈 수 있다.

const SCAVENGE_TIME_LIMIT = 60; // 초

const WORLD_W = 720;
const WORLD_H = 900;
const PICKUP_RADIUS = 62; // 이 거리 안이면 '챙기기' 버튼으로 집을 수 있다
const PLAYER_RADIUS = 14; // 벽 충돌 반경

// 방에 놓일 아이템 & 가족 스폰 테이블 (방이 5개 = 자리 5곳: 위 1 + 양옆 4)
// 식량(canned_food)/물(water_bottle)만 여러 개, 나머지 물자는 집 전체에 딱 하나씩
window.SCAVENGE_ROOMS = [
  {
    id: 'kitchen',
    name: '주방',
    spawns: ['canned_food', 'canned_food', 'canned_food', 'water_bottle', 'water_bottle', 'first_aid', 'pesticide'],
    familySpawns: [],
  },
  {
    id: 'living_room',
    name: '거실',
    spawns: ['radio', 'board_game', 'playing_cards', 'map', 'harmonica', 'canned_food', 'water_bottle'],
    familySpawns: ['mom'],
  },
  {
    id: 'bedroom',
    name: '침실',
    spawns: ['flashlight', 'survival_book', 'axe', 'water_bottle', 'canned_food'],
    familySpawns: ['son', 'daughter'],
  },
  {
    id: 'garage',
    name: '차고',
    spawns: ['rifle', 'ammo', 'gas_mask', 'canned_food', 'water_bottle'],
    familySpawns: [],
  },
  {
    id: 'basement',
    name: '지하실',
    spawns: ['suitcase', 'lock', 'canned_food', 'water_bottle', 'water_bottle'],
    familySpawns: [],
  },
];

// ---------------- 집 구조 (고정 뼈대) ----------------
// 벽은 '방/복도 사각형 사이의 빈틈'으로 표현하고, 문(door)이 그 빈틈을 이어준다.
const CORRIDOR = { x: 290, y: 228, w: 140, h: 452 };
const SHELTER = { x: 170, y: 698, w: 380, h: 192 }; // 맨 아래 방공호
const DOORS = [
  { x: 320, y: 196, w: 80, h: 44 }, // 위쪽 방 <-> 복도
  { x: 320, y: 666, w: 80, h: 48 }, // 복도 <-> 방공호
  { x: 262, y: 302, w: 40, h: 80 }, // 왼쪽 위
  { x: 262, y: 532, w: 40, h: 80 }, // 왼쪽 아래
  { x: 418, y: 302, w: 40, h: 80 }, // 오른쪽 위
  { x: 418, y: 532, w: 40, h: 80 }, // 오른쪽 아래
];

// 방이 들어갈 수 있는 자리 5곳 (판마다 어떤 방이 어디에 올지 섞는다)
const ROOM_SLOTS = [
  { slot: 'top', rect: { x: 170, y: 10, w: 380, h: 200 } },
  { slot: 'left_top', rect: { x: 10, y: 236, w: 262, h: 210 } },
  { slot: 'left_bottom', rect: { x: 10, y: 466, w: 262, h: 210 } },
  { slot: 'right_top', rect: { x: 448, y: 236, w: 262, h: 210 } },
  { slot: 'right_bottom', rect: { x: 448, y: 466, w: 262, h: 210 } },
];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
    points.push({
      x: rect.x + padding + (cols === 1 ? usableW / 2 : (usableW * col) / (cols - 1)),
      y: rect.y + padding + (rows === 1 ? usableH / 2 : (usableH * row) / (rows - 1)),
    });
  }
  return points;
}

// 방을 랜덤 자리에 배치하고, 방마다 아이템/가족 좌표를 만든다.
function buildLayout() {
  const slots = shuffle(ROOM_SLOTS);
  const rooms = window.SCAVENGE_ROOMS.map((room, idx) => ({
    ...room,
    slot: slots[idx].slot,
    rect: slots[idx].rect,
  }));

  const items = [];
  const family = [];

  rooms.forEach((room) => {
    // 아이템과 가족이 겹치지 않게 한 격자에 같이 배치하고, 자리는 섞는다
    const entities = [
      ...room.spawns.map((itemId, i) => ({ type: 'item', itemId, i })),
      ...room.familySpawns.map((characterId, i) => ({ type: 'family', characterId, i })),
    ];
    const points = shuffle(gridPoints(room.rect, entities.length));
    entities.forEach((e, idx) => {
      if (e.type === 'item') {
        items.push({ key: `${room.id}_item_${e.i}`, itemId: e.itemId, roomId: room.id, x: points[idx].x, y: points[idx].y, taken: false });
      } else {
        family.push({ key: `${room.id}_family_${e.i}`, characterId: e.characterId, roomId: room.id, x: points[idx].x, y: points[idx].y });
      }
    });
  });

  const walkable = [SHELTER, CORRIDOR, ...DOORS, ...rooms.map((r) => r.rect)];
  return { rooms, items, family, walkable };
}

function startScavenge(state) {
  const layout = buildLayout();
  return {
    timeLeft: SCAVENGE_TIME_LIMIT,
    collected: [], // itemId 배열 (방공호까지 날라 확정된 것)
    foundFamily: [], // characterId 배열 (이번 판에서 구한 가족)
    rooms: layout.rooms,
    corridor: CORRIDOR,
    doors: DOORS,
    dropzone: SHELTER, // 방공호
    walkable: layout.walkable,
    items: layout.items, // { key, itemId, roomId, x, y, taken }
    // 이미 대피소에 있거나 죽은 가족은 구할 대상이 아니므로 '실종(missing)' 상태만 배치
    family: layout.family.filter((f) => {
      const c = state.characters.find((ch) => ch.id === f.characterId);
      return c && c.location === 'missing';
    }),
    player: { x: SHELTER.x + SHELTER.w / 2, y: SHELTER.y + SHELTER.h / 2 },
    carrying: null, // { key, itemId } | null — 한 번에 하나만 들 수 있음
    target: null, // 지금 '챙기기'를 누르면 잡히는 대상 { kind:'item'|'family', key }
  };
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function inRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

const SAMPLE_ANGLES = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);

// (x, y)에 플레이어 원이 통째로 걸어 다닐 수 있는 곳(방/복도/문 합집합) 안에 있는가
function canStand(walkable, x, y) {
  const pts = [[x, y], ...SAMPLE_ANGLES.map((a) => [x + Math.cos(a) * PLAYER_RADIUS, y + Math.sin(a) * PLAYER_RADIUS])];
  return pts.every(([px, py]) => walkable.some((r) => inRect(px, py, r)));
}

// 벽에 막히되 벽을 따라 미끄러지도록 축을 나눠서 이동
function movePlayer(scavengeState, dx, dy) {
  const p = scavengeState.player;
  if (canStand(scavengeState.walkable, p.x + dx, p.y)) p.x += dx;
  if (canStand(scavengeState.walkable, p.x, p.y + dy)) p.y += dy;
}

// 지금 '챙기기'를 누르면 잡힐 대상: 범위 안에서 가장 가까운 것
// (물건은 손이 비어 있을 때만, 가족은 언제든)
function findTarget(scavengeState) {
  const p = scavengeState.player;
  let best = null;
  let bestD = PICKUP_RADIUS;
  if (!scavengeState.carrying) {
    scavengeState.items.forEach((it) => {
      if (it.taken) return;
      const d = dist(p.x, p.y, it.x, it.y);
      if (d <= bestD) { bestD = d; best = { kind: 'item', key: it.key }; }
    });
  }
  scavengeState.family.forEach((fam) => {
    if (scavengeState.foundFamily.includes(fam.characterId)) return;
    const d = dist(p.x, p.y, fam.x, fam.y);
    if (d <= bestD) { bestD = d; best = { kind: 'family', key: fam.key }; }
  });
  return best;
}

// '챙기기' 버튼: 대상이 있으면 집어들기/구하기, 없는데 뭔가 들고 있으면 그 자리에 내려놓기
function actionScavenge(scavengeState) {
  const t = findTarget(scavengeState);
  if (t && t.kind === 'item') {
    const it = scavengeState.items.find((i) => i.key === t.key);
    scavengeState.carrying = { key: it.key, itemId: it.itemId };
    it.taken = true;
  } else if (t && t.kind === 'family') {
    const fam = scavengeState.family.find((f) => f.key === t.key);
    scavengeState.foundFamily.push(fam.characterId);
  } else if (scavengeState.carrying) {
    const it = scavengeState.items.find((i) => i.key === scavengeState.carrying.key);
    it.x = scavengeState.player.x;
    it.y = scavengeState.player.y;
    it.taken = false;
    scavengeState.carrying = null;
  }
  scavengeState.target = findTarget(scavengeState);
}

// 매 프레임: 방공호 안에 들고 들어오면 납품, 그리고 지금 잡힐 대상 갱신
function updateScavenge(scavengeState) {
  const p = scavengeState.player;
  if (scavengeState.carrying && inRect(p.x, p.y, scavengeState.dropzone)) {
    scavengeState.collected.push(scavengeState.carrying.itemId);
    scavengeState.carrying = null;
  }
  scavengeState.target = findTarget(scavengeState);
}

// 타이머 종료 -> 주운 아이템들을 실제 게임 상태 인벤토리/자원으로 반영
// + 찾은/못 찾은 가족을 shelter/missing으로 확정
// (시간 종료 시 손에 들고 있던 것(carrying)은 납품 전이라 사라짐)
function finishScavenge(state, scavengeState) {
  scavengeState.collected.forEach((itemId) => {
    const item = window.ItemsAPI.getItem(itemId);
    if (item && item.category === 'food') {
      state.resources.food += 1;
    } else if (item && item.category === 'water') {
      state.resources.water += 1;
    } else {
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
  movePlayer,
  actionScavenge,
  updateScavenge,
  finishScavenge,
};
