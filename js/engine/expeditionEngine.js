// ============================================================
// expeditionEngine.js — expeditions.js 데이터를 해석/적용하는 엔진
// 이 파일은 원정지 추가할 때 건드릴 필요 없음
// ============================================================

// 대피소원을 원정 보낼 수 있는지 체크
function canSendExpedition(state, characterId) {
  const c = window.GameState.getCharacter(state, characterId);
  return !!c && c.location === 'shelter' && c.health !== 'dead' && !c.exhausted;
}

// 원정 시 지참 가능한 장비 카테고리 (무기/도구/의약품 — 위스키·카드 같은 기호품은 제외)
const EQUIPPABLE_CATEGORIES = ['weapon', 'tool', 'medicine'];

function getEquippableItems(state) {
  return Object.entries(state.inventory)
    .filter(([, count]) => count > 0)
    .map(([itemId]) => window.ItemsAPI.getItem(itemId))
    .filter((item) => item && EQUIPPABLE_CATEGORIES.includes(item.category));
}

// 원정 시작 (UI에서 캐릭터 + 원정지 + (선택) 지참 아이템 선택 후 호출)
function sendExpedition(state, characterId, expeditionId, equippedItemId) {
  const character = window.GameState.getCharacter(state, characterId);
  const expedition = window.EXPEDITIONS.find((e) => e.id === expeditionId);
  if (!character || !expedition || !canSendExpedition(state, characterId)) return null;

  let equippedItem = null;
  if (equippedItemId && window.GameState.hasItem(state, equippedItemId, 1)) {
    window.GameState.removeItem(state, equippedItemId, 1);
    equippedItem = equippedItemId;
  }

  character.location = 'scavenging';
  character.expedition = {
    id: expedition.id,
    returnDay: state.day + expedition.duration,
    equippedItem,
  };
  const itemName = equippedItem ? window.ItemsAPI.getItem(equippedItem).name : null;
  window.GameState.addLog(
    state,
    `${character.name}이(가) '${expedition.name}'(으)로 원정을 떠났다.${itemName ? ` (${itemName} 지참)` : ''}`
  );
  return character;
}

// 지참한 장비가 있으면 생존/성공 쪽 가중치를 올리고 실종/사망 쪽은 낮춘다.
function applyEquipmentBonus(outcomes, hasEquipment) {
  if (!hasEquipment) return outcomes;
  return outcomes.map((o) => {
    let weight = o.weight;
    if (o.type === 'dead' || o.type === 'missing') weight *= 0.5;
    if (o.type === 'success') weight *= 1.3;
    return Object.assign({}, o, { weight });
  });
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
    const equippedItem = c.expedition.equippedItem;
    const outcomes = applyEquipmentBonus(expedition.outcomes, !!equippedItem);
    const outcome = window.EventEngine.pickWeightedOutcome(outcomes);
    applyExpeditionOutcome(state, c, expedition, outcome, equippedItem);
    results.push({ characterId: c.id, expeditionId: expedition.id, outcome });
    c.expedition = null;
  });
  return results;
}

function applyExpeditionOutcome(state, character, expedition, outcome, equippedItem) {
  switch (outcome.type) {
    case 'success':
    case 'injured':
    case 'empty': {
      character.location = 'shelter';
      if (outcome.type === 'injured') character.health = 'injured';
      if (equippedItem) window.GameState.addItem(state, equippedItem, 1); // 무사 귀환 시 장비 회수
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
      // 지참한 장비도 함께 실종 (돌아오지 못했으니 회수 불가)
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

window.ExpeditionEngine = { canSendExpedition, sendExpedition, processReturns, getEquippableItems };
