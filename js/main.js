// ============================================================
// main.js — 화면 렌더링 + 게임 루프 연결
// ============================================================

let state = window.GameState.createInitialState();
let scavengeState = null;
let scavengeTimerId = null;

function faceFeatures(health) {
  if (health === 'dead') {
    return {
      eyes: `<path d="M25,35 L33,43 M33,35 L25,43" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round"/>
             <path d="M47,35 L55,43 M55,35 L47,43" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round"/>`,
      mouth: `<path d="M28,58 Q40,54 52,58" stroke="var(--ink)" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
      tint: `<circle cx="40" cy="42" r="30" fill="#6f6f6f" opacity="0.32"/>`,
      extra: '',
    };
  }
  if (health === 'sick') {
    return {
      eyes: `<ellipse cx="29" cy="38" rx="3" ry="4" fill="var(--ink)"/><ellipse cx="51" cy="38" rx="3" ry="4" fill="var(--ink)"/>`,
      mouth: `<path d="M28,58 Q34,62 40,58 Q46,62 52,58" stroke="var(--ink)" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
      tint: `<circle cx="40" cy="42" r="30" fill="var(--ok)" opacity="0.25"/>`,
      extra: `<path d="M57,28 Q60,32 57,36 Q54,32 57,28 Z" fill="#7fc4e0"/>`,
    };
  }
  if (health === 'injured') {
    return {
      eyes: `<ellipse cx="29" cy="38" rx="3.2" ry="3.2" fill="var(--ink)"/><ellipse cx="51" cy="38" rx="3.2" ry="3.2" fill="var(--ink)"/>`,
      mouth: `<path d="M30,59 Q40,55 50,59" stroke="var(--ink)" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
      tint: '',
      extra: `<rect x="18" y="27" width="32" height="8" rx="3" fill="var(--paper)" stroke="var(--ink-soft)" stroke-width="1" transform="rotate(-10 34 31)"/>
              <circle cx="47" cy="26" r="2.2" fill="var(--danger)"/>`,
    };
  }
  return {
    eyes: `<ellipse cx="29" cy="38" rx="3.2" ry="3.2" fill="var(--ink)"/><ellipse cx="51" cy="38" rx="3.2" ry="3.2" fill="var(--ink)"/>`,
    mouth: `<path d="M28,56 Q40,64 52,56" stroke="var(--ink)" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    tint: '',
    extra: '',
  };
}

function hairAccessory(characterId) {
  switch (characterId) {
    case 'dad':
      return `
        <path d="M13,32 Q15,6 40,6 Q65,6 67,32 Q67,19 40,17 Q13,19 13,32 Z" fill="var(--ink-soft)"/>
        <rect x="30" y="50" width="20" height="4.5" rx="2.2" fill="var(--ink-soft)"/>`;
    case 'mom':
      return `
        <path d="M12,34 Q9,8 40,6 Q71,8 68,34 Q68,45 61,47 Q66,29 40,26 Q14,29 19,47 Q12,45 12,34 Z" fill="#5a3a24"/>
        <circle cx="16" cy="43" r="2.4" fill="var(--warn)"/>
        <circle cx="64" cy="43" r="2.4" fill="var(--warn)"/>`;
    case 'son':
      return `
        <path d="M10,25 Q40,3 70,25 L70,19 Q40,-3 10,19 Z" fill="var(--metal)"/>
        <path d="M14,29 Q40,20 66,29 L66,23 Q40,16 14,23 Z" fill="var(--ink-soft)"/>`;
    case 'daughter':
      return `
        <path d="M13,32 Q11,8 40,7 Q69,8 67,32 Q67,21 40,19 Q13,21 13,32 Z" fill="#6b3f22"/>
        <circle cx="9" cy="41" r="6.5" fill="#6b3f22"/>
        <circle cx="71" cy="41" r="6.5" fill="#6b3f22"/>
        <circle cx="9" cy="34" r="2.2" fill="var(--danger)"/>
        <circle cx="71" cy="34" r="2.2" fill="var(--danger)"/>`;
    default:
      return '';
  }
}

function portraitSVG(characterId, health) {
  const f = faceFeatures(health);
  return `
    <svg viewBox="0 0 80 80" class="portrait-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="40" cy="40" r="38" fill="var(--bg-panel-2)" stroke="var(--line)" stroke-width="1.5" />
      <ellipse cx="40" cy="45" rx="22" ry="24" fill="#d9a066" />
      ${hairAccessory(characterId)}
      ${f.eyes}
      ${f.mouth}
      ${f.extra}
      ${f.tint}
    </svg>`;
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

function render() {
  if (state.phase === 'scavenge') renderScavenge();
  else if (state.phase === 'shelter') renderShelter();
  else if (state.phase === 'gameover') renderGameOver();
  else if (state.phase === 'ending') renderEnding();
}

// ---------------- 탈출 파트 ----------------

function renderScavenge() {
  if (!scavengeState) {
    scavengeState = window.ScavengeEngine.startScavenge(state);
    startScavengeTimer();
  }

  const roomsHtml = scavengeState.rooms
    .map(
      (room) => `
    <div class="room">
      <h3>${room.name}</h3>
      <div class="room-items">
        ${room.spawns
          .map((itemId, idx) => {
            const item = window.ItemsAPI.getItem(itemId);
            const key = `${room.id}_${idx}`;
            const taken = scavengeState.takenKeys && scavengeState.takenKeys.has(key);
            return `<button class="item-btn" ${taken ? 'disabled' : ''} data-key="${key}" data-item="${itemId}">
              ${item.icon} ${item.name}
            </button>`;
          })
          .join('')}
        ${(room.familySpawns || [])
          .map((characterId) => {
            const c = window.GameState.getCharacter(state, characterId);
            if (!c || c.location !== 'missing') return ''; // 이미 찾았거나 대상 아님
            const key = `family_${characterId}`;
            const found = scavengeState.foundFamily.includes(characterId);
            return `<button class="item-btn family-btn" ${found ? 'disabled' : ''} data-key="${key}" data-character="${characterId}">
              🧍 ${c.name} 찾기!
            </button>`;
          })
          .join('')}
      </div>
    </div>`
    )
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
        <div class="timer ${scavengeState.timeLeft <= 10 ? 'critical' : ''}">${scavengeState.timeLeft}</div>
      </div>
    </div>
    <div class="rooms-grid">${roomsHtml}</div>
    <div class="collected">
      <span>📦 챙긴 아이템 ${scavengeState.collected.length}개</span>
      <span>🧍 찾은 가족 ${scavengeState.foundFamily.length}명</span>
    </div>
    <button id="finishBtn">지금 대피소로 (${scavengeState.collected.length}개 들고) →</button>
  `;

  scavengeState.takenKeys = scavengeState.takenKeys || new Set();

  app.querySelectorAll('.item-btn:not(.family-btn)').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const itemId = btn.dataset.item;
      scavengeState.takenKeys.add(key);
      window.ScavengeEngine.collectItem(scavengeState, itemId);
      renderScavenge();
    });
  });

  app.querySelectorAll('.family-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const characterId = btn.dataset.character;
      window.ScavengeEngine.collectFamily(scavengeState, characterId);
      renderScavenge();
    });
  });

  document.getElementById('finishBtn').addEventListener('click', endScavenge);
}

function startScavengeTimer() {
  clearInterval(scavengeTimerId);
  scavengeTimerId = setInterval(() => {
    scavengeState.timeLeft -= 1;
    if (scavengeState.timeLeft <= 0) {
      endScavenge();
    } else {
      renderScavenge();
    }
  }, 1000);
}

function endScavenge() {
  clearInterval(scavengeTimerId);
  window.ScavengeEngine.finishScavenge(state, scavengeState);
  scavengeState = null;
  render();
}

// ---------------- 대피소 파트 ----------------

function renderShelter(eventOverride) {
  const healthLabel = { healthy: '건강함', injured: '부상', sick: '병약', dead: '사망' };
  const people = window.GameState.shelterCharacters(state);
  const peopleHtml = people
    .map((c) => {
      const hungerPct = Math.round((c.hunger / 3) * 100);
      const thirstPct = Math.round((c.thirst / 3) * 100);
      return `
    <div class="char-card ${c.health}">
      <div class="char-tag">${c.isChild ? '아이' : '성인'}</div>
      <div class="char-top">
        <div class="portrait-frame">${portraitSVG(c.id, c.health)}</div>
        <div class="char-id">
          <div class="char-name">${c.name}</div>
          <div class="char-status">${healthLabel[c.health] || c.health}</div>
        </div>
      </div>
      <div class="stat-row">
        <span class="stat-label">배고픔</span>
        <div class="gauge"><div class="gauge-fill hunger" style="width:${hungerPct}%"></div></div>
      </div>
      <div class="stat-row">
        <span class="stat-label">목마름</span>
        <div class="gauge"><div class="gauge-fill thirst" style="width:${thirstPct}%"></div></div>
      </div>
      <div class="stat-row">
        <span class="stat-label">정신력</span>
        <div class="gauge"><div class="gauge-fill sanity" style="width:${c.sanity}%"></div></div>
      </div>
    </div>`;
    })
    .join('');

  const inventoryHtml = Object.entries(state.inventory)
    .filter(([, count]) => count > 0)
    .map(([itemId, count]) => {
      const item = window.ItemsAPI.getItem(itemId);
      return `<span class="inv-chip">${item.icon} ${item.name} x${count}</span>`;
    })
    .join('');

  const rationHtml = window.RATION_LEVELS
    .map(
      (r) => `<button class="ration-btn ${r.id === state.rationLevel ? 'active' : ''}" data-ration="${r.id}" title="${r.description}">
        ${r.icon} ${r.name}
      </button>`
    )
    .join('');

  const expeditionCandidates = people.filter((c) => window.ExpeditionEngine.canSendExpedition(state, c.id));
  const outOnExpedition = state.characters.filter((c) => c.location === 'scavenging');
  const expeditionOptionsHtml = window.EXPEDITIONS
    .map((e) => `<option value="${e.id}">${e.name} (${e.duration}일 소요) — ${e.description}</option>`)
    .join('');
  const expeditionCharOptionsHtml = expeditionCandidates
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join('');
  const outOnExpeditionHtml = outOnExpedition
    .map((c) => `<span class="inv-chip">🚶 ${c.name} (Day ${c.expedition ? c.expedition.returnDay : '?'} 복귀 예정)</span>`)
    .join('');

  const dayPct = Math.min(100, Math.round((state.day / window.GAME_CONFIG.goalDay) * 100));

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
        <span class="res-chip food">🥫 ${state.resources.food}</span>
        <span class="res-chip water">💧 ${state.resources.water}</span>
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

    <div class="ration-panel">
      <h3>배급 통제</h3>
      <div class="ration-buttons">${rationHtml}</div>
    </div>

    <div class="expedition-panel">
      <h3>원정 파견</h3>
      ${
        expeditionCandidates.length > 0
          ? `<select id="expeditionCharSelect">${expeditionCharOptionsHtml}</select>
             <select id="expeditionSelect">${expeditionOptionsHtml}</select>
             <button id="sendExpeditionBtn">원정 출발</button>`
          : `<div>보낼 수 있는 인원이 없다.</div>`
      }
      <div class="inventory-row">${outOnExpeditionHtml}</div>
    </div>

    <div id="eventArea"></div>
    <button id="nextDayBtn">다음 날로 →</button>
    <div class="log-box">
      <div class="section-label" style="margin-bottom:6px;">무전 기록</div>
      ${state.log.slice(-6).map((l) => `<div>Day ${l.day} — ${l.text}</div>`).join('') || '<div>(기록 없음)</div>'}
    </div>
  `;

  document.getElementById('nextDayBtn').addEventListener('click', onNextDay);

  app.querySelectorAll('.ration-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.ShelterEngine.setRation(state, btn.dataset.ration);
      renderShelter(eventOverride);
    });
  });

  const sendBtn = document.getElementById('sendExpeditionBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const characterId = document.getElementById('expeditionCharSelect').value;
      const expeditionId = document.getElementById('expeditionSelect').value;
      window.ExpeditionEngine.sendExpedition(state, characterId, expeditionId);
      renderShelter(eventOverride);
    });
  }

  if (eventOverride) showEvent(eventOverride);
}

function onNextDay() {
  const { event } = window.ShelterEngine.advanceDay(state);
  if (state.phase === 'gameover' || state.phase === 'ending') {
    render();
    return;
  }
  renderShelter(event);
}

function showEvent(event) {
  if (!event) return;
  const area = document.getElementById('eventArea');
  const choicesHtml = event.choices
    .map((choice, idx) => {
      const eligible = window.EventEngine.isChoiceEligible(state, choice);
      return `<button class="choice-btn" ${eligible ? '' : 'disabled'} data-idx="${idx}">${choice.text}</button>`;
    })
    .join('');

  area.innerHTML = `
    <div class="event-box">
      <h2>${event.title}</h2>
      <p>${event.description}</p>
      <div class="choices">${choicesHtml}</div>
      <div id="outcomeText"></div>
    </div>
  `;

  area.querySelectorAll('.choice-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      const outcome = window.EventEngine.resolveChoice(state, event, idx);
      document.getElementById('outcomeText').textContent = outcome.resultText;
      area.querySelectorAll('.choice-btn').forEach((b) => (b.disabled = true));
      setTimeout(() => renderShelter(), 1200);
    });
  });
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
    render();
  });
}

render();
