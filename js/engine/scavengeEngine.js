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

// 방마다 이동을 가로막는 가구/오브젝트 (벽 하나에 붙여서 배치).
// surfaceFor에 적힌 물자가 이 방에 스폰되면, 방 안 아무 데나 흩어지지 않고
// 이 오브젝트 위(표면)에 나란히 올라간 것처럼 배치된다 (예: 지하실 선반 위 통조림).
const ROOM_OBSTACLES = {
  kitchen: { label: '조리대', icon: 'counter', wall: 'top', sizeFrac: { w: 0.6, h: 0.2 } },
  living_room: { label: '소파', icon: 'sofa', wall: 'bottom', sizeFrac: { w: 0.56, h: 0.24 } },
  bedroom: { label: '침대', icon: 'bed', wall: 'bottom', sizeFrac: { w: 0.6, h: 0.32 } },
  garage: { label: '작업대', icon: 'bench', wall: 'left', sizeFrac: { w: 0.22, h: 0.56 } },
  basement: { label: '선반', icon: 'shelf', wall: 'top', sizeFrac: { w: 0.58, h: 0.18 }, surfaceFor: ['canned_food'] },
};
const OBSTACLE_WALL_PADDING = 14;

// 방 사각형 + 벽 지정으로 실제 오브젝트 사각형을 계산 (방이 어느 슬롯에 배정되든
// 비율 기반이라 항상 방 크기에 맞게 들어간다)
function computeObstacleRect(roomRect, def) {
  const w = roomRect.w * def.sizeFrac.w;
  const h = roomRect.h * def.sizeFrac.h;
  let x;
  let y;
  switch (def.wall) {
    case 'bottom':
      x = roomRect.x + (roomRect.w - w) / 2;
      y = roomRect.y + roomRect.h - h - OBSTACLE_WALL_PADDING;
      break;
    case 'left':
      x = roomRect.x + OBSTACLE_WALL_PADDING;
      y = roomRect.y + (roomRect.h - h) / 2;
      break;
    case 'right':
      x = roomRect.x + roomRect.w - w - OBSTACLE_WALL_PADDING;
      y = roomRect.y + (roomRect.h - h) / 2;
      break;
    case 'top':
    default:
      x = roomRect.x + (roomRect.w - w) / 2;
      y = roomRect.y + OBSTACLE_WALL_PADDING;
      break;
  }
  return { x, y, w, h };
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 방 사각형 안에 n개의 점을 서로 겹치지 않게 자유롭게(랜덤) 배치한다.
// 기존엔 줄맞춰진 격자에 놓았는데, 방 안에 흩어진 느낌을 주기 위해 거부 샘플링으로
// 최소 간격(minDist) 이상 떨어진 위치를 무작위로 고른다. 자리가 너무 부족해서
// (방이 작거나 아이템이 몰릴 때) 정해진 시도 안에 못 찾으면, 겹치지 않는 것만은
// 보장하도록 격자로 대체 배치한다. minDist/padding은 화면에 보이는 아이템 아이콘
// 크기(CSS 기준)보다 넉넉히 크게 잡아야 서로 안 겹친다. avoidRects를 주면 그
// 영역(가구 등) 안에는 놓지 않는다 (margin만큼 여유를 둬서 가구 가장자리에
// 바짝 붙지 않게 한다).
function scatterPoints(rect, n, padding = 34, minDist = 46, avoidRects = [], avoidMargin = 16) {
  if (n <= 0) return [];
  const usableW = Math.max(0, rect.w - padding * 2);
  const usableH = Math.max(0, rect.h - padding * 2);
  const expandedAvoid = avoidRects.map((r) => ({
    x: r.x - avoidMargin, y: r.y - avoidMargin,
    w: r.w + avoidMargin * 2, h: r.h + avoidMargin * 2,
  }));
  const points = [];
  const MAX_ATTEMPTS = 200;

  for (let i = 0; i < n; i++) {
    let placed = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const x = rect.x + padding + Math.random() * usableW;
      const y = rect.y + padding + Math.random() * usableH;
      if (expandedAvoid.some((r) => inRect(x, y, r))) continue;
      if (points.every((p) => dist(p.x, p.y, x, y) >= minDist)) {
        points.push({ x, y });
        placed = true;
        break;
      }
    }
    if (!placed) {
      // 폴백: 격자 좌표로 채워서 최소한 겹치지 않게는 보장한다 (가구 회피는 생략).
      const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
      const rows = Math.ceil(n / cols);
      const col = i % cols;
      const row = Math.floor(i / cols);
      points.push({
        x: rect.x + padding + (cols === 1 ? usableW / 2 : (usableW * col) / (cols - 1)),
        y: rect.y + padding + (rows === 1 ? usableH / 2 : (usableH * row) / (rows - 1)),
      });
    }
  }
  return points;
}

// 오브젝트(가구) 표면 위에 물자를 나란히 한 줄로 올려놓는다 (예: 선반 위 통조림).
// 무작위가 아니라 일부러 가지런히 배치해서 "위에 올려져 있다"는 느낌을 준다.
function surfacePoints(obstacleRect, n) {
  if (n <= 0) return [];
  const marginX = obstacleRect.w * 0.14;
  const usableW = obstacleRect.w - marginX * 2;
  const y = obstacleRect.y + obstacleRect.h * 0.32;
  const points = [];
  for (let i = 0; i < n; i++) {
    const x = obstacleRect.x + marginX + (n === 1 ? usableW / 2 : (usableW * i) / (n - 1));
    points.push({ x, y });
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
  const obstacles = [];

  rooms.forEach((room) => {
    const obDef = ROOM_OBSTACLES[room.id];
    const obstacleRect = obDef ? computeObstacleRect(room.rect, obDef) : null;
    if (obstacleRect) {
      obstacles.push({ roomId: room.id, label: obDef.label, icon: obDef.icon, rect: obstacleRect });
    }

    // 아이템과 가족을 한 번에 배치하되, 가구 위에 올려도 자연스러운 물자
    // (surfaceFor)는 가구 표면에 가지런히, 나머지는 방 안에 자유롭게 흩어놓는다.
    const surfaceItemIds = (obDef && obDef.surfaceFor) || [];
    const allEntities = [
      ...room.spawns.map((itemId, i) => ({ type: 'item', itemId, i })),
      ...room.familySpawns.map((characterId, i) => ({ type: 'family', characterId, i })),
    ];
    const onSurface = obstacleRect
      ? allEntities.filter((e) => e.type === 'item' && surfaceItemIds.includes(e.itemId))
      : [];
    const scattered = allEntities.filter((e) => !onSurface.includes(e));

    const surfacePts = surfacePoints(obstacleRect, onSurface.length);
    const scatteredPts = scatterPoints(room.rect, scattered.length, undefined, undefined, obstacleRect ? [obstacleRect] : []);

    const place = (e, pt) => {
      if (e.type === 'item') {
        items.push({ key: `${room.id}_item_${e.i}`, itemId: e.itemId, roomId: room.id, x: pt.x, y: pt.y, taken: false });
      } else {
        family.push({ key: `${room.id}_family_${e.i}`, characterId: e.characterId, roomId: room.id, x: pt.x, y: pt.y });
      }
    };
    onSurface.forEach((e, idx) => place(e, surfacePts[idx]));
    scattered.forEach((e, idx) => place(e, scatteredPts[idx]));
  });

  const walkable = [SHELTER, CORRIDOR, ...DOORS, ...rooms.map((r) => r.rect)];
  return { rooms, items, family, walkable, obstacles };
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
    obstacles: layout.obstacles, // 이동을 막는 가구 (침대/선반 등)
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

// (x, y)에 플레이어 원이 통째로 걸어 다닐 수 있는 곳(방/복도/문 합집합) 안에 있고,
// 가구(오브젝트) 위는 아닌가
function canStand(walkable, obstacles, x, y) {
  const pts = [[x, y], ...SAMPLE_ANGLES.map((a) => [x + Math.cos(a) * PLAYER_RADIUS, y + Math.sin(a) * PLAYER_RADIUS])];
  return pts.every(
    ([px, py]) => walkable.some((r) => inRect(px, py, r)) && !obstacles.some((r) => inRect(px, py, r.rect || r))
  );
}

// 벽에 막히되 벽을 따라 미끄러지도록 축을 나눠서 이동
function movePlayer(scavengeState, dx, dy) {
  const p = scavengeState.player;
  const obstacles = scavengeState.obstacles || [];
  if (canStand(scavengeState.walkable, obstacles, p.x + dx, p.y)) p.x += dx;
  if (canStand(scavengeState.walkable, obstacles, p.x, p.y + dy)) p.y += dy;
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
