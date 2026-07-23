// ============================================================
// shelterEngine.js — 대피소 하루 루프
// ============================================================

// 원작 60 Seconds! 위키 기준 상태이상 단계 (물을 못 마신/식량을 못 먹은 연속 일수 기준)
//   물: 1~3일째 '목마름' → 4~5일째 '탈수' → 6일째 성인 사망 / 아이 가출
//   식량: 물보다 훨씬 여유가 있어 1~6일째 '배고픔' → 7~8일째 '굶주림' → 9일째 성인 사망 / 아이 가출
const WATER_STAGE = { THIRSTY: 1, DEHYDRATED: 4, FATAL: 6 };
const FOOD_STAGE = { HUNGRY: 1, STARVING: 7, FATAL: 9 };

function getWaterStatus(days) {
  if (days >= WATER_STAGE.DEHYDRATED) return 'dehydrated';
  if (days >= WATER_STAGE.THIRSTY) return 'thirsty';
  return 'normal';
}

function getFoodStatus(days) {
  if (days >= FOOD_STAGE.STARVING) return 'starving';
  if (days >= FOOD_STAGE.HUNGRY) return 'hungry';
  return 'normal';
}

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

  const hadFood = !ration.alwaysInsufficient && state.resources.food >= foodNeeded;
  const hadWater = !ration.alwaysInsufficient && state.resources.water >= waterNeeded;

  state.resources.food = Math.max(0, state.resources.food - foodNeeded);
  state.resources.water = Math.max(0, state.resources.water - waterNeeded);

  people.forEach((c) => {
    // 배급 단계의 delta가 음수(회복 효과)이고 실제로 자원도 충분했을 때만
    // '제대로 먹었다'고 보고 연속일수를 리셋한다. (반절/무배급은 항상 카운트 증가)
    if (hadFood && ration.hungerDelta < 0) {
      c.foodDays = 0;
    } else {
      c.foodDays += 1;
    }
    if (hadWater && ration.thirstDelta < 0) {
      c.waterDays = 0;
    } else {
      c.waterDays += 1;
    }
    // '전혀 안 먹음'은 자원 유무와 무관하게 항상 심리적 페널티 적용
    if (ration.sanityDelta && (ration.alwaysInsufficient || (hadFood && hadWater))) {
      c.sanity = Math.max(0, Math.min(100, c.sanity + ration.sanityDelta));
    }

    // 원작처럼: 물/식량을 끝까지 못 챙기면 아이는 가출, 어른은 사망
    if (c.waterDays >= WATER_STAGE.FATAL || c.foodDays >= FOOD_STAGE.FATAL) {
      const cause = c.waterDays >= WATER_STAGE.FATAL ? '탈수' : '아사';
      if (c.isChild) {
        c.location = 'missing';
        window.GameState.addLog(state, `[Day ${state.day}] ${c.name}이(가) ${cause} 끝에 결국 대피소를 뛰쳐나갔다.`);
      } else {
        c.health = 'dead';
        c.location = 'dead';
        window.GameState.addLog(state, `[Day ${state.day}] ${c.name}이(가) ${cause}(으)로 사망했다.`);
      }
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

window.ShelterEngine = {
  advanceDay,
  checkGameOver,
  setRation,
  getWaterStatus,
  getFoodStatus,
  WATER_STAGE,
  FOOD_STAGE,
};
