// ============================================================
// shelterEngine.js — 대피소 하루 루프
// ============================================================

// 원작 60 Seconds! 위키 기준 상태이상 단계 (물을 못 마신/식량을 못 먹은 연속 일수 기준)
//   물: 1~3일째 '목마름' → 4~5일째 '탈수' → 6일째 성인 사망 / 아이 가출
//   식량: 물보다 훨씬 여유가 있어 1~6일째 '배고픔' → 7~8일째 '굶주림' → 9일째 성인 사망 / 아이 가출
const WATER_STAGE = { THIRSTY: 1, DEHYDRATED: 4, FATAL: 6 };
const FOOD_STAGE = { HUNGRY: 1, STARVING: 7, FATAL: 9 };
// 부상은 자연치유되지 않는다. 방치가 길어지면 병까지 겹치고, 더 길어지면 사망한다.
const INJURY_SICKEN_DAY = 3;
const INJURY_FATAL_DAY = 7;

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

const QUARTER = 0.25;

// 밥/물은 원작처럼 1인당 1/4씩 개별로 준다 (하루에 한 사람당 한 번씩)
function giveFood(state, characterId) {
  const c = window.GameState.getCharacter(state, characterId);
  if (!c || c.location !== 'shelter') return { ok: false, reason: 'not_in_shelter' };
  if (c.fedFoodToday) return { ok: false, reason: 'already_fed' };
  if (state.resources.food < QUARTER) return { ok: false, reason: 'insufficient' };
  state.resources.food = Math.round((state.resources.food - QUARTER) * 100) / 100;
  c.foodDays = 0;
  c.fedFoodToday = true;
  return { ok: true };
}

function giveWater(state, characterId) {
  const c = window.GameState.getCharacter(state, characterId);
  if (!c || c.location !== 'shelter') return { ok: false, reason: 'not_in_shelter' };
  if (c.fedWaterToday) return { ok: false, reason: 'already_fed' };
  if (state.resources.water < QUARTER) return { ok: false, reason: 'insufficient' };
  state.resources.water = Math.round((state.resources.water - QUARTER) * 100) / 100;
  c.waterDays = 0;
  c.fedWaterToday = true;
  return { ok: true };
}

// 구급상자: 부상/병약 상태를 즉시 회복시킨다 (1개 소모)
function useFirstAid(state, characterId) {
  const c = window.GameState.getCharacter(state, characterId);
  if (!c || c.location !== 'shelter') return { ok: false, reason: 'not_in_shelter' };
  if (c.health !== 'injured' && c.health !== 'sick') return { ok: false, reason: 'not_needed' };
  if (!window.GameState.hasItem(state, 'first_aid', 1)) return { ok: false, reason: 'no_item' };
  const before = c.health;
  window.GameState.removeItem(state, 'first_aid', 1);
  c.health = 'healthy';
  window.GameState.addLog(
    state,
    `[Day ${state.day}] ${c.name}에게 구급상자를 사용했다. (${before === 'injured' ? '부상' : '병약'} → 회복)`
  );
  return { ok: true };
}

// 하루 경과: 배급 결과 반영 → 배고픔/목마름/정신력 갱신 → 사망 체크
//          → 원정 복귀 처리 → 목표일수 도달 시 엔딩 → 아니면 오늘의 이벤트 뽑기
function advanceDay(state) {
  if (state.phase !== 'shelter') return { event: null };

  const people = window.GameState.shelterCharacters(state);

  people.forEach((c) => {
    if (c.fedFoodToday) {
      c.foodDays = 0;
    } else {
      c.foodDays += 1;
    }
    if (c.fedWaterToday) {
      c.waterDays = 0;
    } else {
      c.waterDays += 1;
    }
    c.fedFoodToday = false;
    c.fedWaterToday = false;

    // 원작처럼: 부상은 자연치유되지 않는다. 방치가 길어지면 병까지 겹치고, 더 길어지면 사망한다.
    if (c.health === 'injured') {
      c.injuredDays += 1;
      if (c.injuredDays >= INJURY_FATAL_DAY) {
        c.health = 'dead';
        c.location = 'dead';
        window.GameState.addLog(state, `[Day ${state.day}] 방치된 부상이 악화되어 ${c.name}이(가) 결국 사망했다.`);
        return; // 사망 처리했으니 이후 로직은 건너뜀
      }
      if (c.injuredDays >= INJURY_SICKEN_DAY && Math.random() < 0.15) {
        c.health = 'sick';
        window.GameState.addLog(state, `[Day ${state.day}] 방치된 상처가 곪아 ${c.name}이(가) 병까지 얻었다.`);
      }
    } else {
      c.injuredDays = 0;
    }

    // 목마르거나 배고픈 상태가 지속되면 정신력도 함께 깎인다.
    if (getWaterStatus(c.waterDays) !== 'normal') c.sanity = Math.max(0, c.sanity - 2);
    if (getFoodStatus(c.foodDays) !== 'normal') c.sanity = Math.max(0, c.sanity - 2);

    // 원작처럼: 굶주림 상태면 별다른 이벤트 없이도 확률적으로 병에 걸린다.
    if (getFoodStatus(c.foodDays) === 'starving' && c.health === 'healthy' && Math.random() < 0.12) {
      c.health = 'sick';
      window.GameState.addLog(state, `[Day ${state.day}] 굶주린 ${c.name}이(가) 결국 병을 얻었다.`);
    }

    // 원작처럼: 탈진 상태는 며칠 지나면 랜덤하게 자연 치유된다.
    if (c.exhausted && Math.random() < 0.4) {
      c.exhausted = false;
      window.GameState.addLog(state, `[Day ${state.day}] ${c.name}의 탈진 상태가 풀렸다.`);
    }

    // 원작처럼: 가족을 다 잃고 혼자 남으면 하루 만에 정신이 무너진다.
    if (people.length === 1) c.sanity = Math.min(c.sanity, 10);

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
  if (state.phase === 'gameover' || state.phase === 'ending') return { event: null };

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

// 원작 규칙: 생존 판정(라이프)은 부모(성인) 두 명만 따진다.
// 아이/개/고양이가 남아있어도 부모가 (사망이든 원정 등으로 부재중이든) 대피소에
// 둘 다 없으면 그 순간 생존 실패 엔딩으로 끝난다.
function checkGameOver(state) {
  const shelterPeople = window.GameState.shelterCharacters(state);
  const parentsInShelter = shelterPeople.some((c) => !c.isChild);
  if (!parentsInShelter) {
    state.phase = 'ending';
    state.endingResult = window.EndingEngine.determineEnding(state);
    window.GameState.addLog(state, `[Day ${state.day}] 부모가 대피소에 남아있지 않다. 생존 실패.`);
    return;
  }

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
  giveFood,
  giveWater,
  useFirstAid,
  getWaterStatus,
  getFoodStatus,
  WATER_STAGE,
  FOOD_STAGE,
};
