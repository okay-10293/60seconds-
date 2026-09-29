// ============================================================
// scavengeEngine.js — 탈출(짐싸기) 파트
// ============================================================
// 가운데 세로 복도를 중심으로 위쪽 방 1개 + 양옆 방 4개가 붙어 있고, 맨 아래가
// 방공호(대피소 입구)인 집 구조. 어느 방이 어느 자리에 오는지는 판마다 랜덤.
//
// 조작: 조이스틱으로 이동 → 가까이 가서 '챙기기' 버튼으로 원하는 물자를 가방에 담는다.
// 가방은 원작처럼 4칸이고 물자마다 차지하는 칸 수가 다르다(items.js의 slots).
// 방공호 안에서 같은 버튼('넣기')을 눌러야 가방을 비우고 확정된다.
// 가족도 '구하기'로 업어서(칸 차지) 방공호까지 데려가야 구조가 확정된다.
// 벽이 있어서 문(door)으로만 복도와 방을 오갈 수 있다.

const SCAVENGE_TIME_LIMIT = 60; // 초

const WORLD_W = 720;
const WORLD_H = 900;
const PICKUP_RADIUS = 62; // 이 거리 안이면 '챙기기' 버튼으로 집을 수 있다
const PLAYER_RADIUS = 14; // 벽 충돌 반경
const BAG_CAPACITY = 4; // 원작 기준 가방 칸 수
// 가족도 원작처럼 업고 가야 해서 칸을 차지한다 (돌로레스 2, 티미 2, 메리 제인 3)
const FAMILY_SLOTS = { mom: 2, son: 2, daughter: 3 };

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
    carrying: [], // 가방에 든 것 [{ key, itemId } | { key, characterId }] — 칸 수 합이 BAG_CAPACITY 이하
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

function slotsOf(itemId) {
  const item = window.ItemsAPI.getItem(itemId);
  return (item && item.slots) || 1;
}

// 가방 항목 하나(물자 또는 가족)가 차지하는 칸 수
function entrySlots(entry) {
  return entry.characterId ? FAMILY_SLOTS[entry.characterId] || 2 : slotsOf(entry.itemId);
}

function usedSlots(scavengeState) {
  return scavengeState.carrying.reduce((sum, c) => sum + entrySlots(c), 0);
}

function inShelter(scavengeState) {
  return inRect(scavengeState.player.x, scavengeState.player.y, scavengeState.dropzone);
}

// 지금 '챙기기'를 누르면 잡힐 대상: 범위 안에서 가장 가까운 것
// 물건은 가방 칸이 모자라도 대상으로 잡히지만 fits=false (버튼이 비활성화됨)
function findTarget(scavengeState) {
  const p = scavengeState.player;
  const used = usedSlots(scavengeState);
  let best = null;
  let bestD = PICKUP_RADIUS;
  scavengeState.items.forEach((it) => {
    if (it.taken) return;
    const d = dist(p.x, p.y, it.x, it.y);
    if (d <= bestD) {
      bestD = d;
      best = { kind: 'item', key: it.key, fits: used + slotsOf(it.itemId) <= BAG_CAPACITY };
    }
  });
  scavengeState.family.forEach((fam) => {
    if (fam.taken || scavengeState.foundFamily.includes(fam.characterId)) return;
    const d = dist(p.x, p.y, fam.x, fam.y);
    if (d <= bestD) {
      bestD = d;
      best = { kind: 'family', key: fam.key, fits: used + (FAMILY_SLOTS[fam.characterId] || 2) <= BAG_CAPACITY };
    }
  });
  return best;
}

// '챙기기' 버튼: 방공호 안이면 가방 비우기(넣기), 아니면 가까운 대상 담기/구하기
function actionScavenge(scavengeState) {
  if (inShelter(scavengeState)) {
    if (scavengeState.carrying.length > 0) {
      scavengeState.carrying.forEach((c) => {
        if (c.characterId) scavengeState.foundFamily.push(c.characterId); // 가족은 방공호에 들어가야 구조 확정
        else scavengeState.collected.push(c.itemId);
      });
      scavengeState.carrying = [];
    }
  } else {
    const t = findTarget(scavengeState);
    if (t && t.kind === 'item' && t.fits) {
      const it = scavengeState.items.find((i) => i.key === t.key);
      scavengeState.carrying.push({ key: it.key, itemId: it.itemId });
      it.taken = true;
    } else if (t && t.kind === 'family' && t.fits) {
      const fam = scavengeState.family.find((f) => f.key === t.key);
      scavengeState.carrying.push({ key: fam.key, characterId: fam.characterId });
      fam.taken = true;
    }
  }
  scavengeState.target = findTarget(scavengeState);
}

// 매 프레임: 지금 잡힐 대상 갱신 (납품은 자동이 아니라 버튼으로만)
function updateScavenge(scavengeState) {
  scavengeState.target = findTarget(scavengeState);
}

// 타이머 종료 -> 주운 아이템들을 실제 게임 상태 인벤토리/자원으로 반영
// + 60초가 다 됐을 때 방공호 안에 없는 캐릭터는 전부 사망 처리
// (가방에 든 채 못 넣은 물자는 사라지고, 업기만 하고 방공호까지 못 데려온 가족도
//  방공호 밖이므로 함께 사망 처리된다)
// 반환값 { diedNames } — 화면에 폭발 연출/사망 문구를 띄우기 위해 main.js에 넘겨준다.
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

  scavengeState.foundFamily.forEach((characterId) => {
    const c = state.characters.find((ch) => ch.id === characterId);
    if (c) {
      c.location = 'shelter';
      window.GameState.addLog(state, `${c.name}을(를) 찾아서 함께 대피소로 향했다.`);
    }
  });

  const diedNames = [];

  // 조작 중이던 플레이어(테드)가 시간 끝날 때 방공호 밖(방/복도)에 남아있으면
  // 그도 함께 사망 처리한다. (이게 빠져있어서 폭발 이펙트가 안 뜨던 원인)
  if (!inShelter(scavengeState)) {
    const player = state.characters.find((c) => c.id === 'dad' && c.location !== 'dead');
    if (player) {
      player.health = 'dead';
      player.location = 'dead';
      diedNames.push(player.name);
      window.GameState.addLog(state, `${player.name}이(가) 방공호 밖에 남겨진 채 시간이 끝나 사망했다.`);
    }
  }

  state.characters
    .filter((c) => c.location === 'missing')
    .forEach((c) => {
      c.health = 'dead';
      c.location = 'dead';
      diedNames.push(c.name);
      window.GameState.addLog(state, `${c.name}이(가) 방공호 밖에 남겨진 채 시간이 끝나 사망했다.`);
    });

  window.GameState.addLog(state, `탈출하며 ${scavengeState.collected.length}개의 아이템을 챙겼다.`);
  state.phase = 'shelter';

  return { diedNames };
}

window.ScavengeEngine = {
  SCAVENGE_TIME_LIMIT,
  WORLD_W,
  WORLD_H,
  PICKUP_RADIUS,
  BAG_CAPACITY,
  slotsOf,
  entrySlots,
  usedSlots,
  inShelter,
  startScavenge,
  movePlayer,
  actionScavenge,
  updateScavenge,
  finishScavenge,
};
