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
  // 절약형(배율 < 1)은 내림, 표준/확대형(배율 >= 1)은 올림으로 계산해야
  // '반절 배급'이 실제로 소모를 줄여주는 효과가 남는다.
  const roundConsumption = ration.consumeMultiplier < 1 ? Math.floor : Math.ceil;
  const foodNeeded = ration.alwaysInsufficient ? 0 : roundConsumption(people.length * ration.consumeMultiplier);
  const waterNeeded = ration.alwaysInsufficient ? 0 : roundConsumption(people.length * ration.consumeMultiplier);

  // 정수기를 갖고 있으면 매일 물이 소량 자동으로 생성된다.
  if (window.GameState.hasItem(state, 'water_purifier', 1)) {
    state.resources.water += 1;
  }

  const hadFood = !ration.alwaysInsufficient && state.resources.food >= foodNeeded;
  const hadWater = !ration.alwaysInsufficient && state.resources.water >= waterNeeded;

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
    // '전혀 안 먹음'은 자원 유무와 무관하게 항상 심리적 페널티 적용
    if (ration.sanityDelta && (ration.alwaysInsufficient || (hadFood && hadWater))) {
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
