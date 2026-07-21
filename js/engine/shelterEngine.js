// ============================================================
// shelterEngine.js — 대피소 하루 루프
// ============================================================

const HUNGER_THIRST_MAX = 3;

// 배급량 단계 설정 (UI에서 호출)
function setRation(state, rationId) {
  const level = window.RationsAPI.getRationLevel(rationId);
  state.rationLevel = level.id;
  window.GameState.addLog(state, `배급량을 '${level.name}'(으)로 조절했다.`);
}

// 하루 경과: 배급 소모 → 배고픔/목마름/정신력 갱신 → 사망 체크
//          → 원정 복귀 처리 → 목표일수 도달 시 엔딩 → 아니면 오늘의 이벤트 뽑기
function advanceDay(state) {
  if (state.phase !== 'shelter') return { event: null };

  const ration = window.RationsAPI.getRationLevel(state.rationLevel);
  const people = window.GameState.shelterCharacters(state);
  const foodNeeded = Math.ceil(people.length * ration.consumeMultiplier);
  const waterNeeded = Math.ceil(people.length * ration.consumeMultiplier);

  const hadFood = state.resources.food >= foodNeeded;
  const hadWater = state.resources.water >= waterNeeded;

  state.resources.food = Math.max(0, state.resources.food - foodNeeded);
  state.resources.water = Math.max(0, state.resources.water - waterNeeded);

  people.forEach((c) => {
    if (hadFood) {
      c.hunger = Math.max(0, Math.min(HUNGER_THIRST_MAX, c.hunger + ration.hungerDelta));
    } else {
      c.hunger = Math.min(HUNGER_THIRST_MAX, c.hunger + 1);
    }
    if (hadWater) {
      c.thirst = Math.max(0, Math.min(HUNGER_THIRST_MAX, c.thirst + ration.thirstDelta));
    } else {
      c.thirst = Math.min(HUNGER_THIRST_MAX, c.thirst + 1);
    }
    if (hadFood && hadWater && ration.sanityDelta) {
      c.sanity = Math.max(0, Math.min(100, c.sanity + ration.sanityDelta));
    }

    if (c.hunger >= HUNGER_THIRST_MAX || c.thirst >= HUNGER_THIRST_MAX) {
      c.health = 'dead';
      c.location = 'dead';
      window.GameState.addLog(state, `[Day ${state.day}] ${c.name}이(가) ${c.thirst >= HUNGER_THIRST_MAX ? '갈증' : '굶주림'}으로 사망했다.`);
    }
  });

  checkGameOver(state);
  if (state.phase === 'gameover') return { event: null };

  state.day += 1;

  const expeditionResults = window.ExpeditionEngine.processReturns(state);

  if (state.day > window.GAME_CONFIG.goalDay) {
    state.phase = 'ending';
    state.endingResult = window.EndingEngine.determineEnding(state);
    window.GameState.addLog(
      state,
      `[Day ${state.day}] 목표 생존일수 ${window.GAME_CONFIG.goalDay}일을 달성했다.`
    );
    return { event: null, expeditionResults, ended: true };
  }

  const event = window.EventEngine.pickEventForToday(state);
  return { event, expeditionResults };
}

function checkGameOver(state) {
  const alive = window.GameState.livingCharacters(state);
  if (alive.length === 0) {
    state.phase = 'gameover';
    state.gameOverReason = 'all_dead';
    window.GameState.addLog(state, `[Day ${state.day}] 모든 가족이 사망했다. GAME OVER.`);
  }
}

window.ShelterEngine = { advanceDay, checkGameOver, setRation, HUNGER_THIRST_MAX };
