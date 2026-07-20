// ============================================================
// shelterEngine.js — 대피소 하루 루프
// ============================================================

const HUNGER_THIRST_MAX = 3;

// 하루 경과: 자원 소모 → 배고픔/목마름 갱신 → 사망 체크 → 오늘의 이벤트 뽑기
function advanceDay(state) {
  if (state.phase === 'gameover') return { event: null };

  const people = window.GameState.shelterCharacters(state);
  const foodNeeded = people.length;
  const waterNeeded = people.length;

  const hadFood = state.resources.food >= foodNeeded;
  const hadWater = state.resources.water >= waterNeeded;

  state.resources.food = Math.max(0, state.resources.food - foodNeeded);
  state.resources.water = Math.max(0, state.resources.water - waterNeeded);

  people.forEach((c) => {
    c.hunger = hadFood ? Math.max(0, c.hunger - 1) : Math.min(HUNGER_THIRST_MAX, c.hunger + 1);
    c.thirst = hadWater ? Math.max(0, c.thirst - 1) : Math.min(HUNGER_THIRST_MAX, c.thirst + 1);

    if (c.hunger >= HUNGER_THIRST_MAX || c.thirst >= HUNGER_THIRST_MAX) {
      c.health = 'dead';
      c.location = 'dead';
      window.GameState.addLog(state, `[Day ${state.day}] ${c.name}이(가) ${c.thirst >= HUNGER_THIRST_MAX ? '갈증' : '굶주림'}으로 사망했다.`);
    }
  });

  checkGameOver(state);
  if (state.phase === 'gameover') return { event: null };

  state.day += 1;
  const event = window.EventEngine.pickEventForToday(state);
  return { event };
}

function checkGameOver(state) {
  const alive = window.GameState.livingCharacters(state);
  if (alive.length === 0) {
    state.phase = 'gameover';
    state.gameOverReason = 'all_dead';
    window.GameState.addLog(state, `[Day ${state.day}] 모든 가족이 사망했다. GAME OVER.`);
  }
  // 생존일수 목표(예: 45일) 달성 등 승리 조건은 나중에 여기에 추가
}

window.ShelterEngine = { advanceDay, checkGameOver, HUNGER_THIRST_MAX };
