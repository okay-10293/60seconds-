// ============================================================
// main.js — 화면 렌더링 + 게임 루프 연결
// ============================================================

let state = window.GameState.createInitialState();
let scavengeState = null;
let scavengeTimerId = null;

const app = document.getElementById('app');

function render() {
  if (state.phase === 'scavenge') renderScavenge();
  else if (state.phase === 'shelter') renderShelter();
  else if (state.phase === 'gameover') renderGameOver();
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
      </div>
    </div>`
    )
    .join('');

  app.innerHTML = `
    <div class="topbar">
      <h1>탈출: 60초 안에 챙겨라</h1>
      <div class="timer">⏱ ${scavengeState.timeLeft}s</div>
    </div>
    <div class="rooms-grid">${roomsHtml}</div>
    <div class="collected">챙긴 아이템: ${scavengeState.collected.length}개</div>
    <button id="finishBtn">지금 대피소로 (${scavengeState.collected.length}개 들고)</button>
  `;

  scavengeState.takenKeys = scavengeState.takenKeys || new Set();

  app.querySelectorAll('.item-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const itemId = btn.dataset.item;
      scavengeState.takenKeys.add(key);
      window.ScavengeEngine.collectItem(scavengeState, itemId);
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
  const people = window.GameState.shelterCharacters(state);
  const peopleHtml = people
    .map(
      (c) => `
    <div class="char-card ${c.health}">
      <div class="char-name">${c.name} ${c.isChild ? '(아이)' : ''}</div>
      <div>건강: ${c.health}</div>
      <div>배고픔: ${'🍽️'.repeat(c.hunger)}${'　'.repeat(3 - c.hunger)}</div>
      <div>목마름: ${'💧'.repeat(c.thirst)}${'　'.repeat(3 - c.thirst)}</div>
      <div>정신력: ${c.sanity}</div>
    </div>`
    )
    .join('');

  const inventoryHtml = Object.entries(state.inventory)
    .filter(([, count]) => count > 0)
    .map(([itemId, count]) => {
      const item = window.ItemsAPI.getItem(itemId);
      return `<span class="inv-chip">${item.icon} ${item.name} x${count}</span>`;
    })
    .join('');

  app.innerHTML = `
    <div class="topbar">
      <h1>대피소 — Day ${state.day}</h1>
      <div class="resources">🥫 ${state.resources.food} &nbsp; 💧 ${state.resources.water}</div>
    </div>
    <div class="characters-row">${peopleHtml}</div>
    <div class="inventory-row">${inventoryHtml || '(인벤토리 없음)'}</div>
    <div id="eventArea"></div>
    <button id="nextDayBtn">다음 날로</button>
    <div class="log-box">${state.log.slice(-6).map((l) => `<div>${l.text}</div>`).join('')}</div>
  `;

  document.getElementById('nextDayBtn').addEventListener('click', onNextDay);

  if (eventOverride) showEvent(eventOverride);
}

function onNextDay() {
  const { event } = window.ShelterEngine.advanceDay(state);
  if (state.phase === 'gameover') {
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

render();
