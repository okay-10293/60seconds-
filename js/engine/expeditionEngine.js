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
// 단, 도끼(axe)는 원작에서 원정에 가져가도 아무 효과가 없는 방공호 방어 전용 아이템이라 제외한다.
// 여행가방(suitcase)·자물쇠(lock)는 카테고리는 'special'이지만 원정에서 특수 효과가 있어 별도로 포함한다.
const EQUIPPABLE_CATEGORIES = ['weapon', 'tool', 'medicine'];
const EXPEDITION_USELESS_ITEMS = ['axe'];
const EXPEDITION_SPECIAL_ITEMS = ['suitcase', 'lock'];

function getEquippableItems(state) {
  return Object.entries(state.inventory)
    .filter(([, count]) => count > 0)
    .map(([itemId]) => window.ItemsAPI.getItem(itemId))
    .filter(
      (item) =>
        item &&
        !EXPEDITION_USELESS_ITEMS.includes(item.id) &&
        (EQUIPPABLE_CATEGORIES.includes(item.category) || EXPEDITION_SPECIAL_ITEMS.includes(item.id))
    );
}

// 원정 시작 (UI에서 캐릭터 + (선택) 지참 아이템들만 선택하면 목적지는 원작처럼 랜덤으로 정해진다)
// equippedItemIds: 지참할 아이템 id 배열. 여행가방(suitcase)이 포함되면 최대 4개(가방 포함)까지,
//                  그렇지 않으면 최대 1개까지만 가져갈 수 있다.
function sendExpedition(state, characterId, equippedItemIds) {
  const character = window.GameState.getCharacter(state, characterId);
  if (!character || !canSendExpedition(state, characterId)) return null;

  // 원작처럼: 누구를 보내든 목적지는 랜덤으로 결정된다. 플레이어는 고를 수 없다.
  const expedition = window.EXPEDITIONS[Math.floor(Math.random() * window.EXPEDITIONS.length)];

  const requested = (equippedItemIds || []).filter(Boolean);
  const maxSlots = requested.includes('suitcase') ? 4 : 1;
  const equippedItems = [];
  requested.slice(0, maxSlots).forEach((itemId) => {
    if (window.GameState.hasItem(state, itemId, 1)) {
      window.GameState.removeItem(state, itemId, 1);
      equippedItems.push(itemId);
    }
  });

  // 원작 확인: 잘 먹여둔(방금 급식/급수를 받은) 캐릭터가 원정에서 더 잘 돌아온다.
  const wellFed = character.foodDays === 0 && character.waterDays === 0;

  character.location = 'scavenging';
  character.expedition = {
    id: expedition.id,
    returnDay: state.day + expedition.duration,
    equippedItems,
    wellFed,
  };
  const itemNames = equippedItems.map((id) => window.ItemsAPI.getItem(id).name);
  window.GameState.addLog(
    state,
    `${character.name}이(가) 원정을 떠났다. 어디로 향했는지는 돌아와야 알 수 있다.${itemNames.length ? ` (${itemNames.join(', ')} 지참)` : ''}`
  );
  return character;
}

// 지참 장비가 있으면, 그리고 잘 먹여둔 상태였으면 각각 생존/성공 쪽 가중치를 올리고 실종/사망 쪽은 낮춘다.
// 방독면을 지참했다면 방사능으로 인한 '병' 결과를 크게 줄인다 (원작 확인).
function applyOutcomeBonuses(outcomes, hasEquipment, wellFed, hasGasMask) {
  return outcomes.map((o) => {
    let weight = o.weight;
    if (hasEquipment) {
      if (o.type === 'dead' || o.type === 'missing') weight *= 0.5;
      if (o.type === 'success') weight *= 1.3;
    }
    if (wellFed) {
      if (o.type === 'dead' || o.type === 'missing') weight *= 0.7;
      if (o.type === 'success') weight *= 1.15;
    }
    if (hasGasMask && o.type === 'sick') weight *= 0.1;
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
    const equippedItems = c.expedition.equippedItems || [];
    const hasGasMask = equippedItems.includes('gas_mask');
    const outcomes = applyOutcomeBonuses(expedition.outcomes, equippedItems.length > 0, c.expedition.wellFed, hasGasMask);
    const outcome = window.EventEngine.pickWeightedOutcome(outcomes);
    applyExpeditionOutcome(state, c, expedition, outcome, equippedItems);
    results.push({ characterId: c.id, expeditionId: expedition.id, outcome });
    c.expedition = null;
  });
  return results;
}

function applyExpeditionOutcome(state, character, expedition, outcome, equippedItems) {
  switch (outcome.type) {
    case 'success':
    case 'injured':
    case 'sick':
    case 'empty': {
      character.location = 'shelter';
      if (outcome.type === 'injured') character.health = 'injured';
      if (outcome.type === 'sick') character.health = 'sick';
      equippedItems.forEach((id) => {
        // 원작 확인: 방독면은 원정 중 일정 확률로 파손되어 돌아오지 못할 수 있다.
        if (id === 'gas_mask' && Math.random() < 0.2) {
          window.GameState.addLog(state, `[Day ${state.day}] 방독면이 원정 중 파손되었다.`);
          return;
        }
        window.GameState.addItem(state, id, 1);
      });
      if (equippedItems.includes('lock')) {
        // 원작 확인: 자물쇠를 지참하면 원정 후 물 2병을 추가로 얻는다.
        state.resources.water = (state.resources.water || 0) + 2;
      }
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
