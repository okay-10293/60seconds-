// ============================================================
// main.js — 화면 렌더링 + 게임 루프 연결
// ============================================================

let state = window.GameState.createInitialState();
let scavengeState = null;
let scavengeRafId = null;
let scavengeJoystick = null;
// 화면 어디를 두 번 눌러도 확대가 아예 안 되게 막는다 (버튼 여부와 무관하게 전체 페이지).
// 1) 사파리(특히 iPad)의 확대/축소 제스처 자체를 원천 차단 — 공식적인 방법.
['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
});
// 2) 그래도 남는 구형/타 브라우저 대비: 짧은 시간 안에 연속으로 탭이 끝나면(더블탭) 막는다.
//    (passive:false로 등록해야 preventDefault가 실제로 먹는다)
let lastTouchEndAt = 0;
document.addEventListener(
  'touchend',
  (e) => {
    const now = Date.now();
    // 브라우저 자체의 더블탭 인식 간격이 350ms보다 넓은 경우가 있어서
    // (기기/버전마다 다름) 여유 있게 500ms까지 잡는다.
    if (now - lastTouchEndAt <= 500) {
      e.preventDefault();
    }
    lastTouchEndAt = now;
  },
  { passive: false }
);
// 3) 더블탭이 dblclick으로 합성되어 확대를 유발하는 경우까지 대비.
document.addEventListener('dblclick', (e) => e.preventDefault());

let scavengeLastTs = null;
let scavengeKeyHandler = null;
let scavengeDom = null; // 프레임마다 갱신할 DOM 참조 캐시

// 대피소 화면: 원작처럼 순서 강제 없이 탭을 자유롭게 오갈 수 있다.
//   'diary'(벙커 안) · 'rations'(보급품) · 'expedition'(지상으로)
let shelterView = 'diary';
let dayOutcomeText = null; // 어제 있었던 이벤트의 결과 텍스트 (벙커 안 화면에 표시)
let pendingEvent = null;   // advanceDay로 뽑힌 오늘의 이벤트 (모달로 띄운다)
let pendingEventOutcome = null; // 이벤트 선택 후 결과 텍스트 (모달에 표시)

function itemIcon(itemId) {
  const attrs = `viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"`;
  const icons = {
    canned_food: `<rect x="6" y="6" width="12" height="14" rx="1"/><ellipse cx="12" cy="6" rx="6" ry="1.8"/><ellipse cx="12" cy="20" rx="6" ry="1.8"/><line x1="6" y1="12" x2="18" y2="12"/>`,
    water_bottle: `<path d="M10 3h4v3l1.5 2v13a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V8L10 6z"/><line x1="9" y1="12" x2="15" y2="12"/>`,
    first_aid: `<rect x="3" y="6" width="18" height="14" rx="2"/><line x1="12" y1="9" x2="12" y2="17"/><line x1="8" y1="13" x2="16" y2="13"/>`,
    rifle: `<path d="M2 18 L16 6 M12 10 l3 3 M16 6 l3 1 -1 3 M4 18 h4"/>`,
    radio: `<rect x="3" y="9" width="18" height="11" rx="1.5"/><circle cx="8" cy="14.5" r="2.2"/><line x1="13" y1="12.5" x2="18" y2="12.5"/><line x1="13" y1="16" x2="18" y2="16"/><path d="M8 9 L6 3 M14 9 L17 4"/>`,
    flashlight: `<rect x="9" y="9" width="6" height="12" rx="1"/><path d="M9 9 L7 5 h10 l-2 4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="7" y1="3" x2="8.5" y2="4.5"/><line x1="17" y1="3" x2="15.5" y2="4.5"/>`,
    board_game: `<rect x="3" y="3" width="18" height="18" rx="1.5"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>`,
    playing_cards: `<rect x="3" y="5" width="12" height="16" rx="1.5" transform="rotate(-8 9 13)"/><rect x="8" y="4" width="12" height="16" rx="1.5"/><circle cx="14" cy="10" r="1.4"/>`,
    gas_mask: `<circle cx="12" cy="11" r="7"/><circle cx="9" cy="10" r="1.6"/><circle cx="15" cy="10" r="1.6"/><rect x="10" y="15" width="4" height="3" rx="1"/><rect x="10.5" y="18" width="3" height="4" rx="1"/>`,
    map: `<path d="M4 5 L9 3 L15 5 L20 3 V19 L15 21 L9 19 L4 21 Z"/><line x1="9" y1="3" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="21"/>`,
    axe: `<path d="M13 21 L4 12" /><path d="M12 3 a5 5 0 0 1 5 5 a5 5 0 0 1-5 3 z"/>`,
    ammo: `<rect x="9" y="3" width="6" height="8" rx="2.5"/><path d="M9 11 h6 v10 h-6 z"/><line x1="9" y1="15" x2="15" y2="15"/>`,
    survival_book: `<path d="M4 4 h13 a2 2 0 0 1 2 2 v14 a2 2 0 0 0-2-2 H4 z"/><line x1="4" y1="4" x2="4" y2="18"/><line x1="8" y1="8" x2="15" y2="8"/><line x1="8" y1="12" x2="15" y2="12"/>`,
    pesticide: `<rect x="9" y="9" width="6" height="12" rx="1.5"/><path d="M11 9 V5 h2 v4"/><line x1="9.5" y1="4" x2="9.5" y2="6"/><path d="M16 11 q3 1 3 4"/>`,
    suitcase: `<rect x="3" y="8" width="18" height="12" rx="1.5"/><path d="M9 8 V6 a2 2 0 0 1 2-2 h2 a2 2 0 0 1 2 2 v2"/><line x1="3" y1="13" x2="21" y2="13"/>`,
    lock: `<rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11 V7 a4 4 0 0 1 8 0 v4"/><circle cx="12" cy="16" r="1.6"/>`,
    harmonica: `<rect x="3" y="9" width="18" height="6" rx="1"/><line x1="6" y1="9" x2="6" y2="15"/><line x1="9" y1="9" x2="9" y2="15"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="15" y1="9" x2="15" y2="15"/><line x1="18" y1="9" x2="18" y2="15"/>`,
  };
  return `<svg ${attrs}>${icons[itemId] || '<circle cx="12" cy="12" r="8"/>'}</svg>`;
}

function roomIcon(roomId) {
  const attrs = `viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="var(--warn)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"`;
  const icons = {
    kitchen: `<rect x="5" y="14" width="22" height="12" rx="1"/><circle cx="11" cy="10" r="2.2"/><circle cx="17" cy="10" r="2.2"/><circle cx="23" cy="10" r="2.2"/><line x1="5" y1="20" x2="27" y2="20"/>`,
    living_room: `<path d="M6 18 v-4 a3 3 0 0 1 3-3 h14 a3 3 0 0 1 3 3 v4"/><rect x="4" y="18" width="24" height="7" rx="1.5"/><line x1="6" y1="25" x2="6" y2="27"/><line x1="26" y1="25" x2="26" y2="27"/>`,
    bedroom: `<rect x="4" y="16" width="24" height="9" rx="1.5"/><path d="M4 16 v-4 h9 v4"/><line x1="4" y1="25" x2="4" y2="27"/><line x1="28" y1="25" x2="28" y2="27"/>`,
    garage: `<path d="M4 26 V14 L16 6 L28 14 V26"/><line x1="4" y1="18" x2="28" y2="18"/><line x1="4" y1="22" x2="28" y2="22"/>`,
    basement: `<path d="M6 6 h20 v20 h-20 z"/><path d="M6 10 h14 M6 15 h14 M6 20 h14"/><path d="M20 10 l6 -4 M20 15 l6 -4 M20 20 l6 -4 M20 25 l6-4"/>`,
    bathroom: `<path d="M5 16 h22 v4 a6 6 0 0 1-6 6 h-10 a6 6 0 0 1-6-6 z"/><path d="M9 16 v-6 a3 3 0 0 1 5-2.2"/>`,
  };
  return `<svg ${attrs}>${icons[roomId] || '<rect x="6" y="6" width="20" height="20"/>'}</svg>`;
}

function personSearchIcon() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="7" r="3.2"/><path d="M5 21 v-2 a7 7 0 0 1 14 0 v2"/></svg>`;
}

const app = document.getElementById('app');

// ---------------- 공용 장식 요소 ----------------

function cdBadge() {
  return `
    <div class="cd-badge" aria-hidden="true">
      <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="17" fill="none" stroke="var(--warn)" stroke-width="2" />
        <polygon points="20,7 33,30 7,30" fill="none" stroke="var(--warn)" stroke-width="2" />
        <polygon points="20,15 26.5,27 13.5,27" fill="var(--warn)" />
      </svg>
    </div>`;
}

function tallyMarks(day) {
  const n = Math.max(0, day - 1);
  if (n <= 0) return '<span class="tally-label">생존 일수 기록 없음</span>';
  const groups = [];
  let remaining = n;
  while (remaining > 0) {
    const size = Math.min(5, remaining);
    const bars = Array.from({ length: size }, () => '<span></span>').join('');
    groups.push(`<div class="tally-group ${size === 5 ? 'full' : ''}">${bars}</div>`);
    remaining -= size;
  }
  return `<span class="tally-label">생존 ${n}일째 (벙커 벽 기록)</span>${groups.join('')}`;
}

function diaryStatusLine(c) {
  const waterStatus = window.ShelterEngine.getWaterStatus(c.waterDays);
  const foodStatus = window.ShelterEngine.getFoodStatus(c.foodDays);
  if (waterStatus === 'dehydrated') return `${c.name}: 입술이 다 갈라졌다. "물... 물 좀 줘..." 심각한 탈수 상태다.`;
  if (foodStatus === 'starving') return `${c.name}: 며칠째 아무것도 못 먹어 정신이 혼미하다고 한다.`;
  if (waterStatus === 'thirsty') return `${c.name}: "목말라 죽겠어..." 라며 계속 투덜거린다.`;
  if (foodStatus === 'hungry') return `${c.name}: 배가 고파 죽겠다고 칭얼댄다.`;
  if (c.health === 'injured') return `${c.name}: 다친 곳이 욱신거리는지 얼굴을 찌푸리고 있다.`;
  if (c.health === 'sick') return `${c.name}: 열이 나는지 식은땀을 흘리고 있다.`;
  if (c.sanity < 30) return `${c.name}: 초점 없는 눈으로 벽만 바라보고 있다.`;
  if (c.sanity < 60) return `${c.name}: 표정이 어둡다. 슬슬 지쳐가는 것 같다.`;
  return `${c.name}: 별다른 이상 없이 지내고 있다.`;
}

function resetShelterUi() {
  shelterView = 'diary';
  dayOutcomeText = null;
  pendingEvent = null;
  pendingEventOutcome = null;
  document.body.classList.remove('modal-open');
}

function render() {
  if (state.phase !== 'shelter') document.body.classList.remove('modal-open');
  if (state.phase === 'title') renderTitle();
  else if (state.phase === 'scavenge') renderScavenge();
  else if (state.phase === 'shelter') renderShelter();
  else if (state.phase === 'gameover') renderGameOver();
  else if (state.phase === 'ending') renderEnding();
}

// ---------------- 타이틀(시작) 화면 ----------------

function renderTitle() {
  app.innerHTML = `
    <div class="title-screen">
      <div class="title-screen-badge">${cdBadge()}</div>
      <span class="eyebrow">EVACUATION PROTOCOL</span>
      <h1 class="title-screen-logo">60초 생존</h1>
      <p class="title-screen-tagline">
        경보가 울렸다.<br>
        60초 안에 챙길 수 있는 건 전부 챙겨서<br>
        가족과 함께 대피소로 들어가라.
      </p>
      <button id="titleStartBtn" class="go-btn">시작하기</button>
      <p class="title-screen-hint">
        조이스틱(또는 방향키)으로 움직여 '챙기기'로 물건을, '구하기'로 가족을 가방(4칸)에 담고, 방공호에서 '넣기'로 비워라.
      </p>
    </div>
  `;

  document.getElementById('titleStartBtn').addEventListener('click', () => {
    state.phase = 'scavenge';
    render();
  });
}

// ---------------- 탈출 파트 (조이스틱 2D) ----------------

const SCAVENGE_SPEED = 240; // 월드 좌표 단위 / 초

function pct(v, total) {
  return `${(v / total) * 100}%`;
}

function rectStyle(rect, W, H) {
  return `left:${pct(rect.x, W)};top:${pct(rect.y, H)};width:${pct(rect.w, W)};height:${pct(rect.h, H)};`;
}

function renderScavenge() {
  // 이미 진행 중이면 다시 그리지 않는다 (프레임 루프가 DOM을 직접 갱신함)
  if (scavengeState) return;

  scavengeState = window.ScavengeEngine.startScavenge(state);

  const W = window.ScavengeEngine.WORLD_W;
  const H = window.ScavengeEngine.WORLD_H;
  const S = scavengeState;

  // 벽(배경) 위에 복도 → 방 → 문 순서로 바닥을 깐다 (문이 벽 틈을 이어줌)
  const roomsHtml = S.rooms
    .map(
      (room) => `
    <div class="scavenge-room" style="${rectStyle(room.rect, W, H)}">
      <span class="scavenge-room-label"><span class="room-icon">${roomIcon(room.id)}</span>${room.name}</span>
    </div>`
    )
    .join('');
  const doorsHtml = S.doors.map((d) => `<div class="scavenge-door" style="${rectStyle(d, W, H)}"></div>`).join('');

  const itemsHtml = S.items
    .map(
      (it) => `
    <div class="scavenge-item" data-key="${it.key}" style="left:${pct(it.x, W)};top:${pct(it.y, H)};" title="${window.ItemsAPI.getItem(it.itemId).name}">
      ${itemIcon(it.itemId)}
      ${window.ScavengeEngine.slotsOf(it.itemId) > 1 ? `<span class="scavenge-slot-badge">${window.ScavengeEngine.slotsOf(it.itemId)}</span>` : ''}
      <span class="scavenge-item-name">${window.ItemsAPI.getItem(it.itemId).name}</span>
    </div>`
    )
    .join('');

  const familyHtml = S.family
    .map((fam) => {
      const c = window.GameState.getCharacter(state, fam.characterId);
      return `
    <div class="scavenge-family" data-key="${fam.key}" style="left:${pct(fam.x, W)};top:${pct(fam.y, H)};">
      ${personSearchIcon()}
      <span class="scavenge-slot-badge">${window.ScavengeEngine.entrySlots(fam)}</span>
      <span class="scavenge-item-name family">${c ? c.name : '?'}</span>
    </div>`;
    })
    .join('');

  app.innerHTML = `
    <div class="topbar scavenge-bar">
      <div class="topbar-title">
        ${cdBadge()}
        <div class="title-text">
          <span class="eyebrow">EVACUATION PROTOCOL</span>
          <h1>탈출: 60초 안에 챙겨라</h1>
        </div>
      </div>
      <div class="timer-unit">
        <span class="timer-label">남은 시간</span>
        <div class="timer" id="scavengeTimer">${S.timeLeft}</div>
      </div>
    </div>

    <div class="scavenge-play-area">
    <div class="scavenge-side scavenge-side-left">
      <div class="joystick-base" id="joystickBase"><div class="joystick-knob" id="joystickKnob"></div></div>
    </div>
    <div class="scavenge-stage-wrap">
      <div class="scavenge-stage" id="scavengeStage">
        <div class="scavenge-corridor" style="${rectStyle(S.corridor, W, H)}"><span class="scavenge-corridor-label">복도</span></div>
        ${roomsHtml}
        <div class="scavenge-dropzone" style="${rectStyle(S.dropzone, W, H)}">방공호 — 안에서 '넣기'를 눌러 가방을 비워라!</div>
        ${doorsHtml}
        ${itemsHtml}
        ${familyHtml}
        <div class="scavenge-player" id="scavengePlayer"></div>
      </div>
    </div>
    <div class="scavenge-side scavenge-side-right">
      <button id="actionBtn" class="scavenge-action-btn" disabled>챙기기</button>
    </div>
    </div>

    <div class="scavenge-bag">
      <div class="scavenge-bag-title"><b>가방</b> <i id="scavengeBagCount">0</i>/${window.ScavengeEngine.BAG_CAPACITY}칸</div>
      <div class="scavenge-inventory" id="scavengeInventory"></div>
    </div>

    <div class="collected">
      <span><b>챙긴 물건</b><i id="scavengeCollectedCount">0</i>개</span>
      <span><b>찾은 가족</b><i id="scavengeFoundCount">0</i>명</span>
    </div>

    <button id="finishBtn">지금 대피소로 (탈출 종료) →</button>
  `;

  // 프레임마다 쓸 DOM 참조를 한 번만 캐시
  const itemEls = {};
  app.querySelectorAll('.scavenge-item').forEach((el) => (itemEls[el.dataset.key] = el));
  const familyEls = {};
  app.querySelectorAll('.scavenge-family').forEach((el) => (familyEls[el.dataset.key] = el));

  scavengeDom = {
    player: document.getElementById('scavengePlayer'),
    inventory: document.getElementById('scavengeInventory'),
    bagCount: document.getElementById('scavengeBagCount'),
    timer: document.getElementById('scavengeTimer'),
    collected: document.getElementById('scavengeCollectedCount'),
    found: document.getElementById('scavengeFoundCount'),
    actionBtn: document.getElementById('actionBtn'),
    itemEls,
    familyEls,
    lastBagKey: null,
    lastTargetKey: null,
    lastActionLabel: null,
  };

  scavengeJoystick = window.Joystick.create(
    document.getElementById('joystickBase'),
    document.getElementById('joystickKnob')
  );

  // 챙기기 버튼 (터치는 pointerdown으로 즉각 반응) + 키보드 Space/E
  const doAction = (e) => {
    if (!scavengeState) return;
    e.preventDefault();
    window.ScavengeEngine.actionScavenge(scavengeState);
    scavengeDrawFrame();
  };
  scavengeDom.actionBtn.addEventListener('pointerdown', doAction);
  scavengeKeyHandler = (e) => {
    if (e.code === 'Space' || e.key === 'e' || e.key === 'E') doAction(e);
  };
  window.addEventListener('keydown', scavengeKeyHandler);

  document.getElementById('finishBtn').addEventListener('click', endScavenge);

  scavengeLastTs = null;
  window.ScavengeEngine.updateScavenge(scavengeState);
  scavengeDrawFrame();
  scavengeRafId = requestAnimationFrame(scavengeTick);
}

function scavengeTick(ts) {
  if (!scavengeState) return;
  if (scavengeLastTs == null) scavengeLastTs = ts;
  // 탭이 백그라운드였다가 돌아왔을 때 한 번에 순간이동하지 않도록 dt 상한
  const dt = Math.min(0.05, (ts - scavengeLastTs) / 1000);
  scavengeLastTs = ts;

  const vec = scavengeJoystick.vector;
  window.ScavengeEngine.movePlayer(scavengeState, vec.x * SCAVENGE_SPEED * dt, vec.y * SCAVENGE_SPEED * dt);
  window.ScavengeEngine.updateScavenge(scavengeState);

  scavengeState.timeLeft -= dt;
  if (scavengeState.timeLeft <= 0) {
    scavengeState.timeLeft = 0;
    scavengeDrawFrame();
    endScavenge();
    return;
  }

  scavengeDrawFrame();
  scavengeRafId = requestAnimationFrame(scavengeTick);
}

function scavengeDrawFrame() {
  const W = window.ScavengeEngine.WORLD_W;
  const H = window.ScavengeEngine.WORLD_H;
  const d = scavengeDom;
  const s = scavengeState;

  d.player.style.left = pct(s.player.x, W);
  d.player.style.top = pct(s.player.y, H);

  s.items.forEach((it) => {
    const el = d.itemEls[it.key];
    el.classList.toggle('hidden', it.taken);
  });
  s.family.forEach((fam) =>
    d.familyEls[fam.key].classList.toggle('hidden', fam.taken || s.foundFamily.includes(fam.characterId))
  );

  // 지금 '챙기기'로 잡히는 대상 강조 + 버튼 문구
  const targetKey = s.target ? s.target.key : null;
  if (targetKey !== d.lastTargetKey) {
    if (d.lastTargetKey) {
      const prev = d.itemEls[d.lastTargetKey] || d.familyEls[d.lastTargetKey];
      if (prev) prev.classList.remove('scavenge-target');
    }
    if (targetKey) {
      const cur = d.itemEls[targetKey] || d.familyEls[targetKey];
      if (cur) cur.classList.add('scavenge-target');
    }
    d.lastTargetKey = targetKey;
  }

  const E = window.ScavengeEngine;
  let label = '챙기기';
  let enabled = false;
  if (E.inShelter(s) && s.carrying.length > 0) {
    label = `방공호에 넣기 (${s.carrying.length}개)`;
    enabled = true;
  } else if (s.target && s.target.kind === 'family') {
    const fam = s.family.find((f) => f.key === s.target.key);
    const c = window.GameState.getCharacter(state, fam.characterId);
    label = s.target.fits ? `구하기 · ${c.name}` : `칸 부족 · ${c.name}`;
    enabled = s.target.fits;
  } else if (s.target) {
    const it = s.items.find((i) => i.key === s.target.key);
    const name = window.ItemsAPI.getItem(it.itemId).name;
    label = s.target.fits ? `챙기기 · ${name}` : `칸 부족 · ${name}`;
    enabled = s.target.fits;
  }
  if (label !== d.lastActionLabel) {
    d.lastActionLabel = label;
    d.actionBtn.textContent = label;
  }
  d.actionBtn.disabled = !enabled;

  // 가방 4칸 표시: 물자마다 차지하는 칸 수만큼 넓게
  const bagKey = s.carrying.map((c) => c.key).join(',');
  if (bagKey !== d.lastBagKey) {
    d.lastBagKey = bagKey;
    const used = E.usedSlots(s);
    d.inventory.innerHTML =
      s.carrying
        .map((c) => {
          if (c.characterId) {
            const ch = window.GameState.getCharacter(state, c.characterId);
            return `<div class="inv-slot filled family" style="flex:${E.entrySlots(c)}">${personSearchIcon()}<span>${ch.name}</span></div>`;
          }
          const item = window.ItemsAPI.getItem(c.itemId);
          return `<div class="inv-slot filled" style="flex:${E.slotsOf(c.itemId)}">${itemIcon(c.itemId)}<span>${item.name}</span></div>`;
        })
        .join('') + '<div class="inv-slot"></div>'.repeat(E.BAG_CAPACITY - used);
    d.bagCount.textContent = used;
  }

  const secs = Math.ceil(s.timeLeft);
  d.timer.textContent = secs;
  d.timer.classList.toggle('critical', secs <= 10);
  d.collected.textContent = s.collected.length;
  d.found.textContent = s.foundFamily.length;
}

function endScavenge() {
  cancelAnimationFrame(scavengeRafId);
  if (scavengeJoystick) scavengeJoystick.destroy();
  if (scavengeKeyHandler) window.removeEventListener('keydown', scavengeKeyHandler);
  scavengeJoystick = null;
  scavengeKeyHandler = null;
  scavengeDom = null;

  const { diedNames } = window.ScavengeEngine.finishScavenge(state, scavengeState);
  scavengeState = null;

  if (diedNames.length > 0) {
    showDeathEffect(diedNames, render);
  } else {
    render();
  }
}

// 60초가 끝났을 때 방공호 밖에 남겨진 사람이 있으면 폭발 연출과 함께 사망을 알린다.
function showDeathEffect(names, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'death-effect-overlay';
  overlay.innerHTML = `
    <div class="death-effect-boom"></div>
    <div class="death-effect-text">
      ${names.map((n) => `<p class="death-effect-name">${n}</p>`).join('')}
      <h2 class="death-effect-title">사망했습니다</h2>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.remove();
    onDone();
  }, 2400);
}

// ---------------- 대피소 파트 ----------------

function renderShelter() {
  const healthLabel = { healthy: '건강함', injured: '부상', sick: '병약', dead: '사망' };
  const WATER_LABEL = { normal: null, thirsty: '목마름', dehydrated: '탈수' };
  const FOOD_LABEL = { normal: null, hungry: '배고픔', starving: '굶주림' };
  const people = window.GameState.shelterCharacters(state);

  const peopleHtml = people
    .map((c) => {
      const waterStatus = window.ShelterEngine.getWaterStatus(c.waterDays);
      const foodStatus = window.ShelterEngine.getFoodStatus(c.foodDays);
      const waterLabel = WATER_LABEL[waterStatus];
      const foodLabel = FOOD_LABEL[foodStatus];
      const sanityLabel = c.sanity >= 70 ? null : c.sanity >= 40 ? '불안' : c.sanity >= 15 ? '불안정' : '정신 붕괴 직전';
      const badges = [
        waterLabel ? `<span class="ailment-badge ${waterStatus}">${waterLabel}</span>` : '',
        foodLabel ? `<span class="ailment-badge ${foodStatus}">${foodLabel}</span>` : '',
        sanityLabel ? `<span class="ailment-badge sanity-${c.sanity < 15 ? 'critical' : 'low'}">${sanityLabel}</span>` : '',
        c.exhausted ? `<span class="ailment-badge dehydrated">탈진 (원정 불가)</span>` : '',
      ]
        .filter(Boolean)
        .join('');
      return `
    <div class="char-card ${c.health}">
      <div class="char-tag">${c.isChild ? '아이' : '성인'}</div>
      <div class="char-top">
        <div class="char-id">
          <div class="char-name">${c.name}</div>
          <div class="char-status">${healthLabel[c.health] || c.health}</div>
        </div>
      </div>
      <div class="ailment-row">${badges || '<span class="ailment-badge normal">정상</span>'}</div>
    </div>`;
    })
    .join('');

  const inventoryHtml = Object.entries(state.inventory)
    .filter(([, count]) => count > 0)
    .map(([itemId, count]) => {
      const item = window.ItemsAPI.getItem(itemId);
      return `<span class="inv-chip"><span class="item-icon small">${itemIcon(item.id)}</span>${item.name}</span>`;
    })
    .join('');

  const dayPct = Math.min(100, Math.round((state.day / window.GAME_CONFIG.goalDay) * 100));

  const views = [
    { id: 'diary', label: '벙커 안', icon: viewIcon('diary') },
    { id: 'rations', label: '보급품', icon: viewIcon('rations') },
    { id: 'expedition', label: '지상으로', icon: viewIcon('expedition') },
  ];
  const viewTabsHtml = views
    .map(
      (v) => `<button class="view-tab ${v.id === shelterView ? 'active' : ''}" data-view="${v.id}">
        <span class="view-tab-icon">${v.icon}</span><span class="view-tab-label">${v.label}</span>
      </button>`
    )
    .join('');

  app.innerHTML = `
    <div class="topbar">
      <div class="topbar-title">
        ${cdBadge()}
        <div class="title-text">
          <span class="eyebrow">대피소 로그</span>
          <h1>Day ${state.day} <span class="goal">/ 목표 ${window.GAME_CONFIG.goalDay}일</span></h1>
        </div>
      </div>
      <div class="resources">
        <span class="res-chip food"><i>식량</i>${state.resources.food}</span>
        <span class="res-chip water"><i>식수</i>${state.resources.water}</span>
      </div>
    </div>
    <div class="day-progress"><div class="day-progress-fill" style="width:${dayPct}%"></div></div>
    <div class="tally-wall">${tallyMarks(state.day)}</div>

    <div class="panel-section">
      <h2 class="section-label">생존자</h2>
      <div class="characters-row">${peopleHtml}</div>
    </div>

    <div class="panel-section">
      <h2 class="section-label">보급품</h2>
      <div class="inventory-row">${inventoryHtml || '(인벤토리 없음)'}</div>
    </div>

    <div class="view-tabs">${viewTabsHtml}</div>
    <div id="stepArea"></div>

    <div class="day-footer">
      <span class="day-footer-hint">둘러볼 만큼 둘러봤으면 잠자리에 든다.</span>
      <button class="step-next-btn advance-day" id="advanceDayBtn">다음 날로 진행 →</button>
    </div>

    <div class="log-box">
      <div class="section-label" style="margin-bottom:6px;">무전 기록</div>
      ${state.log.slice(-6).map((l) => `<div>Day ${l.day} — ${l.text}</div>`).join('') || '<div>(기록 없음)</div>'}
    </div>
    <div id="eventLayer"></div>
  `;

  app.querySelectorAll('.view-tab').forEach((btn) => {
    btn.addEventListener('click', () => goToView(btn.dataset.view));
  });
  document.getElementById('advanceDayBtn').addEventListener('click', handleAdvanceDay);

  renderStepArea(people);
  renderEventModal();
}

// 원작처럼 오늘의 사건은 화면 위에 카드로 덮어씌운다. 선택하기 전까지는 다른 조작이 막힌다.
function renderEventModal() {
  const layer = document.getElementById('eventLayer');
  if (!layer) return;
  if (!pendingEvent) {
    layer.innerHTML = '';
    document.body.classList.remove('modal-open');
    return;
  }
  document.body.classList.add('modal-open');

  const body = pendingEventOutcome
    ? `<p class="event-outcome-text">${pendingEventOutcome}</p>
       <button class="step-next-btn" id="closeEventBtn">벙커로 돌아가기 →</button>`
    : `<div class="choices">${pendingEvent.choices
        .map((choice, idx) => {
          const eligible = window.EventEngine.isChoiceEligible(state, choice);
          return `<button class="choice-btn" ${eligible ? '' : 'disabled'} data-idx="${idx}">${choice.text}</button>`;
        })
        .join('')}</div>`;

  layer.innerHTML = `
    <div class="event-backdrop">
      <div class="event-modal">
        ${cdBadge()}
        <h2>${pendingEvent.title}</h2>
        <p class="event-desc">${pendingEvent.description}</p>
        ${body}
      </div>
    </div>`;

  layer.querySelectorAll('.choice-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const outcome = window.EventEngine.resolveChoice(state, pendingEvent, Number(btn.dataset.idx));
      pendingEventOutcome = outcome.resultText;
      dayOutcomeText = outcome.resultText;
      renderShelter();
    });
  });
  const closeBtn = document.getElementById('closeEventBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      pendingEvent = null;
      pendingEventOutcome = null;
      renderShelter();
    });
  }
}

function viewIcon(id) {
  const attrs = `viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"`;
  const icons = {
    diary: `<path d="M4 4 h13 a2 2 0 0 1 2 2 v14 a2 2 0 0 0-2-2 H4 z"/><line x1="8" y1="9" x2="15" y2="9"/><line x1="8" y1="13" x2="15" y2="13"/>`,
    rations: `<rect x="6" y="6" width="12" height="14" rx="1"/><ellipse cx="12" cy="6" rx="6" ry="1.8"/><line x1="6" y1="12" x2="18" y2="12"/>`,
    expedition: `<path d="M4 5 L9 3 L15 5 L20 3 V19 L15 21 L9 19 L4 21 Z"/><line x1="9" y1="3" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="21"/>`,
  };
  return `<svg ${attrs}>${icons[id] || ''}</svg>`;
}

// 현재 선택된 탭에 맞는 패널을 그려넣는다 (순서 강제 없음).
function renderStepArea(people) {
  const area = document.getElementById('stepArea');

  if (shelterView === 'diary') {
    area.innerHTML = `
      <div class="panel-section diary-panel">
        <h2 class="section-label">Day ${state.day}</h2>
        <p class="diary-outcome">${dayOutcomeText || '특별한 일 없이 하루를 시작한다.'}</p>
        <div class="diary-status-list">
          ${people.map((c) => `<div class="diary-line">${diaryStatusLine(c)}</div>`).join('') || '<div class="diary-line">대피소에 아무도 없다.</div>'}
        </div>
      </div>`;
    return;
  }

  if (shelterView === 'rations') {
    const canRationAll = people.some((c) => window.ShelterEngine.canRation(state, c.id, 'food').ok || window.ShelterEngine.canRation(state, c.id, 'water').ok);
    const rows = people
      .map((c) => {
        const foodCheck = window.ShelterEngine.canRation(state, c.id, 'food');
        const waterCheck = window.ShelterEngine.canRation(state, c.id, 'water');
        const needsAid = c.health === 'injured' || c.health === 'sick';
        const hasAidItem = window.GameState.hasItem(state, 'first_aid', 1);
        const foodLabel = c.fedFoodToday ? '배급 완료' : foodCheck.reason === 'insufficient' ? '식량 없음' : '식량 배급';
        const waterLabel = c.fedWaterToday ? '배급 완료' : waterCheck.reason === 'insufficient' ? '식수 없음' : '식수 배급';
        return `
        <div class="ration-row">
          <div class="ration-name">${c.name}</div>
          <button class="ration-give-btn ${c.fedFoodToday ? 'given' : ''}" data-give="food" data-character="${c.id}" ${foodCheck.ok ? '' : 'disabled'}>
            ${itemIcon('canned_food')} <span>${foodLabel}</span>
          </button>
          <button class="ration-give-btn ${c.fedWaterToday ? 'given' : ''}" data-give="water" data-character="${c.id}" ${waterCheck.ok ? '' : 'disabled'}>
            ${itemIcon('water_bottle')} <span>${waterLabel}</span>
          </button>
          ${
            needsAid
              ? `<button class="aid-btn" data-aid="${c.id}" ${hasAidItem ? '' : 'disabled'}>
                  ${itemIcon('first_aid')} <span>${hasAidItem ? '구급상자 사용' : '구급상자 없음'}</span>
                </button>`
              : ''
          }
        </div>`;
      })
      .join('');

    area.innerHTML = `
      <div class="panel-section rations-panel">
        <h2 class="section-label">보급품</h2>
        <p class="panel-hint">배급은 하루에 한 사람당 한 번. 통조림과 물통은 알아서 나눠 쓴다. 부상·병약 상태는 구급상자로 즉시 치료할 수 있다.</p>
        <div class="ration-list">${rows || '<div class="diary-line">대피소에 아무도 없다.</div>'}</div>
        <button class="ration-all-btn" id="rationAllBtn" ${canRationAll ? '' : 'disabled'}>전원에게 배급</button>
      </div>`;

    area.querySelectorAll('[data-give]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const characterId = btn.dataset.character;
        if (btn.dataset.give === 'food') window.ShelterEngine.rationFood(state, characterId);
        else window.ShelterEngine.rationWater(state, characterId);
        renderShelter();
      });
    });
    area.querySelectorAll('[data-aid]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.ShelterEngine.useFirstAid(state, btn.dataset.aid);
        renderShelter();
      });
    });
    const allBtn = document.getElementById('rationAllBtn');
    if (allBtn) {
      allBtn.addEventListener('click', () => {
        window.ShelterEngine.rationAll(state);
        renderShelter();
      });
    }
    return;
  }

  if (shelterView === 'expedition') {
    const expeditionCandidates = people.filter((c) => window.ExpeditionEngine.canSendExpedition(state, c.id));
    const outOnExpedition = state.characters.filter((c) => c.location === 'scavenging');
    const equippableItems = window.ExpeditionEngine.getEquippableItems(state);
    const expeditionCharOptionsHtml = expeditionCandidates.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
    const equipOptionsHtml =
      `<option value="">없음</option>` +
      equippableItems.map((item) => `<option value="${item.id}">${item.name}</option>`).join('');
    const outOnExpeditionHtml = outOnExpedition
      .map((c) => {
        const equippedNames = (c.expedition && c.expedition.equippedItems ? c.expedition.equippedItems : [])
          .map((id) => window.ItemsAPI.getItem(id).name)
          .join(', ');
        return `<span class="inv-chip">[원정 중] ${c.name} (Day ${c.expedition ? c.expedition.returnDay : '?'} 복귀 예정, 목적지 미상)${equippedNames ? ` · ${equippedNames} 지참` : ''}</span>`;
      })
      .join('');

    area.innerHTML = `
      <div class="panel-section expedition-panel">
        <h2 class="section-label">원정 파견</h2>
        ${
          expeditionCandidates.length > 0
            ? `<select id="expeditionCharSelect">${expeditionCharOptionsHtml}</select>
               <select id="expeditionEquipSelect0" title="장비를 지참하면 생존·성공 확률이 올라간다 (실종/사망 시 함께 유실)">${equipOptionsHtml}</select>
               <select id="expeditionEquipSelect1" disabled>${equipOptionsHtml}</select>
               <select id="expeditionEquipSelect2" disabled>${equipOptionsHtml}</select>
               <select id="expeditionEquipSelect3" disabled>${equipOptionsHtml}</select>
               <button id="sendExpeditionBtn">원정 출발</button>
               <p class="panel-hint">어디로 가게 될지는 보내봐야 안다. 장비를 지참하면 생존·성공 확률이 오르지만, 실종·사망 시 장비도 함께 잃는다. 여행가방을 챙기면 추가로 3개까지 더 지참할 수 있다. 잘 먹여둔 사람일수록 원정에서 더 잘 돌아온다.</p>`
            : `<div class="panel-hint">보낼 수 있는 인원이 없다.</div>`
        }
        <div class="inventory-row">${outOnExpeditionHtml}</div>
      </div>`;

    const slot0 = document.getElementById('expeditionEquipSelect0');
    if (slot0) {
      slot0.addEventListener('change', () => {
        const isSuitcase = slot0.value === 'suitcase';
        [1, 2, 3].forEach((i) => {
          const el = document.getElementById(`expeditionEquipSelect${i}`);
          el.disabled = !isSuitcase;
          if (!isSuitcase) el.value = '';
        });
      });
    }

    const sendBtn = document.getElementById('sendExpeditionBtn');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        const characterId = document.getElementById('expeditionCharSelect').value;
        const equipItemIds = [0, 1, 2, 3]
          .map((i) => document.getElementById(`expeditionEquipSelect${i}`).value)
          .filter(Boolean);
        window.ExpeditionEngine.sendExpedition(state, characterId, equipItemIds);
        renderShelter();
      });
    }
    return;
  }
}

function goToView(view) {
  if (pendingEvent) return; // 사건을 처리하기 전에는 다른 화면으로 못 넘어간다
  shelterView = view;
  renderShelter();
}

function handleAdvanceDay() {
  if (pendingEvent) return;
  const result = window.ShelterEngine.advanceDay(state);
  if (state.phase === 'gameover' || state.phase === 'ending') {
    render();
    return;
  }
  pendingEventOutcome = null;
  if (result.event) {
    pendingEvent = result.event;
  } else {
    pendingEvent = null;
    dayOutcomeText = '오늘은 특별한 일 없이 하루가 지나갔다.';
  }
  shelterView = 'diary';
  renderShelter();
}

// ---------------- 게임오버 ----------------


function renderGameOver() {
  app.innerHTML = `
    <div class="gameover">
      <div class="gameover-badge">${cdBadge()}</div>
      <h1>GAME OVER</h1>
      <p>사유: ${state.gameOverReason}</p>
      <p>생존 일수: Day ${state.day}</p>
      <button id="restartBtn">다시 시작</button>
    </div>
  `;
  document.getElementById('restartBtn').addEventListener('click', () => {
    state = window.GameState.createInitialState();
    scavengeState = null;
    resetShelterUi();
    render();
  });
}

// ---------------- 엔딩 ----------------

function renderEnding() {
  const ending = state.endingResult || { title: '생존', description: '목표 일수를 달성했다.' };
  const survivorsHtml = window.GameState.shelterCharacters(state)
    .map((c) => `<span class="inv-chip">${c.name}</span>`)
    .join('') || '(없음)';

  app.innerHTML = `
    <div class="gameover ending">
      <div class="gameover-badge">${cdBadge()}</div>
      <h1>ENDING: ${ending.title}</h1>
      <p>${ending.description}</p>
      <p>생존 일수: Day ${state.day - 1} (목표 ${window.GAME_CONFIG.goalDay}일 달성)</p>
      <div class="characters-row">
        <div>대피소에 남은 사람: ${survivorsHtml}</div>
      </div>
      <button id="restartBtn">다시 시작</button>
    </div>
  `;
  document.getElementById('restartBtn').addEventListener('click', () => {
    state = window.GameState.createInitialState();
    scavengeState = null;
    resetShelterUi();
    render();
  });
}

render();
