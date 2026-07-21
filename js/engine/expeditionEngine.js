// ============================================================
// expeditionEngine.js — expeditions.js 데이터를 해석/적용하는 엔진
// 이 파일은 원정지 추가할 때 건드릴 필요 없음
// ============================================================

// 대피소원을 원정 보낼 수 있는지 체크
function canSendExpedition(state, characterId) {
  const c = window.GameState.getCharacter(state, characterId);
  return !!c && c.location === 'shelter' && c.health !== 'dead';
}

// 원정 시작 (UI에서 캐릭터 + 원정지 선택 후 호출)
function sendExpedition(state, characterId, expeditionId) {
  const character = window.GameState.getCharacter(state, characterId);
  const expedition = window.EXPEDITIONS.find((e) => e.id === expeditionId);
  if (!character || !expedition || !canSendExpedition(state, characterId)) return null;

  character.location = 'scavenging';
  character.expedition = {
    id: expedition.id,
    returnDay: state.day + expedition.duration,
  };
  window.GameState.addLog(state, `${character.name}이(가) '${expedition.name}'(으)로 원정을 떠났다.`);
  return character;
}

// 하루가 지날 때마다 호출: 오늘 돌아올 원정대의 결과를 처리
function processReturns(state) {
  const returning = state.characters.filter(
    (c) => c.location === 'scavenging' && c.expedition && c.expedition.returnDay <= state.day
  );

  const results = [];
  returning.forEach((c) => {
    const expedition = window.EXPEDITIONS.find((e) => e.id === c.expedition.id);
    if (!expedition) {
      c.location = 'shelter';
      c.expedition = null;
      return;
    }
    const outcome = window.EventEngine.pickWeightedOutcome(expedition.outcomes);
    applyExpeditionOutcome(state, c, expedition, outcome);
    results.push({ characterId: c.id, expeditionId: expedition.id, outcome });
    c.expedition = null;
  });
  return results;
}

function applyExpeditionOutcome(state, character, expedition, outcome) {
  switch (outcome.type) {
    case 'success':
    case 'injured':
    case 'empty': {
      character.location = 'shelter';
      if (outcome.type === 'injured') character.health = 'injured';
      (outcome.loot || []).forEach((loot) => {
        const amount = Math.floor(Math.random() * (loot.max - loot.min + 1)) + loot.min;
        if (amount <= 0) return;
        if (loot.key) {
          state.resources[loot.key] = (state.resources[loot.key] || 0) + amount;
        } else if (loot.itemId) {
          window.GameState.addItem(state, loot.itemId, amount);
        }
      });
      window.GameState.addLog(
        state,
        `[Day ${state.day}] ${character.name}의 '${expedition.name}' 원정 결과: ${outcome.resultText}`
      );
      break;
    }
    case 'missing': {
      character.location = 'missing';
      state.flags[`_lost_${character.id}`] = true;
      window.GameState.addLog(
        state,
        `[Day ${state.day}] ${character.name}의 '${expedition.name}' 원정 결과: ${outcome.resultText}`
      );
      break;
    }
    case 'dead': {
      character.health = 'dead';
      character.location = 'dead';
      window.GameState.addLog(
        state,
        `[Day ${state.day}] ${character.name}의 '${expedition.name}' 원정 결과: ${outcome.resultText}`
      );
      break;
    }
    default:
      console.warn('알 수 없는 원정 결과 타입:', outcome.type);
  }
}

window.ExpeditionEngine = { canSendExpedition, sendExpedition, processReturns };
