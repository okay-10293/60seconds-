// ============================================================
// eventEngine.js — events.js 데이터를 실제로 해석/적용하는 엔진
// 이 파일은 이벤트 추가할 때 건드릴 필요 없음
// ============================================================

function checkItemRequirements(state, items) {
  if (!items) return true;
  return items.every((req) => window.GameState.hasItem(state, req.id, req.count));
}

function checkFlagRequirements(state, flags) {
  if (!flags) return true;
  return Object.entries(flags).every(([key, val]) => state.flags[key] === val);
}

function isEventEligible(state, event) {
  if (event.once && state.flags[`_seen_${event.id}`]) return false;
  if (event.minDay != null && state.day < event.minDay) return false;
  if (event.maxDay != null && state.day > event.maxDay) return false;

  const cond = event.conditions;
  if (cond) {
    if (!checkItemRequirements(state, cond.requiredItems)) return false;
    if (!checkFlagRequirements(state, cond.requiredFlags)) return false;
    if (cond.minCharacters != null && window.GameState.shelterCharacters(state).length < cond.minCharacters) {
      return false;
    }
  }
  return true;
}

function isChoiceEligible(state, choice) {
  if (!choice.requires) return true;
  return (
    checkItemRequirements(state, choice.requires.items) &&
    checkFlagRequirements(state, choice.requires.flags)
  );
}

// 오늘의 이벤트 후보 중 하나를 랜덤 선택 (없으면 null)
function pickEventForToday(state) {
  const eligible = window.EVENTS.filter((e) => isEventEligible(state, e));
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

function pickWeightedOutcome(outcomes) {
  const total = outcomes.reduce((sum, o) => sum + o.weight, 0);
  let roll = Math.random() * total;
  for (const outcome of outcomes) {
    if (roll < outcome.weight) return outcome;
    roll -= outcome.weight;
  }
  return outcomes[outcomes.length - 1];
}

function applyEffect(state, effect) {
  switch (effect.type) {
    case 'resource': {
      state.resources[effect.key] = Math.max(0, (state.resources[effect.key] || 0) + effect.delta);
      break;
    }
    case 'item': {
      if (effect.delta < 0) {
        window.GameState.removeItem(state, effect.itemId, -effect.delta);
      } else {
        window.GameState.addItem(state, effect.itemId, effect.delta);
      }
      break;
    }
    case 'character': {
      let targets = [];
      if (effect.target === 'all') targets = window.GameState.livingCharacters(state);
      else if (effect.target === 'random') {
        const pool = window.GameState.livingCharacters(state);
        if (pool.length > 0) targets = [pool[Math.floor(Math.random() * pool.length)]];
      } else {
        const c = window.GameState.getCharacter(state, effect.target);
        if (c) targets = [c];
      }
      targets.forEach((c) => {
        if (effect.value !== undefined) c[effect.field] = effect.value;
        else if (effect.delta !== undefined) {
          c[effect.field] = (c[effect.field] || 0) + effect.delta;
        }
      });
      break;
    }
    case 'flag': {
      state.flags[effect.key] = effect.value;
      break;
    }
    case 'log': {
      window.GameState.addLog(state, effect.text);
      break;
    }
    default:
      console.warn('알 수 없는 effect 타입:', effect.type);
  }
}

// 선택지 실행 -> 결과 텍스트 반환
function resolveChoice(state, event, choiceIndex) {
  const choice = event.choices[choiceIndex];
  if (!choice || !isChoiceEligible(state, choice)) {
    return { resultText: '선택할 수 없는 항목입니다.', effects: [] };
  }
  const outcome = pickWeightedOutcome(choice.outcomes);
  outcome.effects.forEach((effect) => applyEffect(state, effect));

  state.flags[`_seen_${event.id}`] = true;
  window.GameState.addLog(state, `[Day ${state.day}] ${event.title} → ${choice.text} → ${outcome.resultText}`);

  return outcome;
}

window.EventEngine = {
  isEventEligible,
  isChoiceEligible,
  pickEventForToday,
  pickWeightedOutcome,
  resolveChoice,
};
