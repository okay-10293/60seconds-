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

function checkAnyItems(state, items) {
  if (!items) return true;
  return items.some((id) => window.GameState.hasItem(state, id, 1));
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
    if (!checkAnyItems(state, cond.anyItems)) return false;
    const res = state.resources;
    if (cond.minFood != null && (res.food || 0) < cond.minFood) return false;
    if (cond.maxFood != null && (res.food || 0) > cond.maxFood) return false;
    if (cond.minWater != null && (res.water || 0) < cond.minWater) return false;
    if (cond.maxWater != null && (res.water || 0) > cond.maxWater) return false;
    if (cond.needInjured && !window.GameState.shelterCharacters(state).some((c) => c.health === 'injured')) return false;
    if (cond.needCharacter) {
      const c = window.GameState.getCharacter(state, cond.needCharacter);
      if (!c || c.health === 'dead' || c.location !== 'shelter') return false;
    }
  }
  return true;
}

function isChoiceEligible(state, choice) {
  if (!choice.requires) return true;
  const r = choice.requires;
  const res = state.resources;
  return (
    checkItemRequirements(state, r.items) &&
    checkAnyItems(state, r.anyItems) &&
    (!r.character || window.GameState.shelterCharacters(state).some((c) => c.id === r.character)) &&
    checkFlagRequirements(state, r.flags) &&
    (r.minFood == null || (res.food || 0) >= r.minFood) &&
    (r.minWater == null || (res.water || 0) >= r.minWater)
  );
}

// event.descriptions(배열)가 있으면 그중 하나를 랜덤으로 골라 description으로
// 써준다. 같은 이벤트라도 매번 다른 상황 지문(문구)으로 보이지만, 선택지/결과는
// 동일하다 — 원본 이벤트 객체는 건드리지 않고 얕은 복사본을 돌려준다.
function resolveEventDescription(event) {
  if (Array.isArray(event.descriptions) && event.descriptions.length > 0) {
    const picked = event.descriptions[Math.floor(Math.random() * event.descriptions.length)];
    return { ...event, description: picked };
  }
  return event;
}

// 오늘의 이벤트 후보 중 하나를 랜덤 선택 (없으면 null)
// 우선순위: 노크(엔딩 조건 충족 시) > 일반 이벤트 + 엔딩 분기 단계 이벤트(가중치 event.weight, 기본 1)
function pickEventForToday(state) {
  if (window.EndingQuest) {
    const knock = window.EndingQuest.pickKnock(state);
    if (knock) return knock;
  }
  const pool = window.EVENTS.filter((e) => isEventEligible(state, e));
  if (window.EndingQuest) pool.push(...window.EndingQuest.stepCandidates(state));
  if (pool.length === 0) return null;
  const total = pool.reduce((sum, e) => sum + (e.weight || 1), 0);
  let roll = Math.random() * total;
  let chosen = pool[pool.length - 1];
  for (const e of pool) {
    if (roll < (e.weight || 1)) { chosen = e; break; }
    roll -= e.weight || 1;
  }
  return resolveEventDescription(chosen);
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

// 대피소에 있는 생존자 중 대상 고르기 ('all' | 'random' | 'randomN' | 캐릭터 id | 'allExceptSon')
function pickTargets(state, effect) {
  const pool = window.GameState.shelterCharacters(state);
  const t = effect.target || 'all';
  if (t === 'all') return pool;
  if (t === 'allExceptSon') return pool.filter((c) => c.id !== 'son');
  if (t === 'random') return pool.length ? [pool[Math.floor(Math.random() * pool.length)]] : [];
  if (t === 'randomN') {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, effect.count || 1);
  }
  return pool.filter((c) => c.id === t);
}

// 반환값: 효과가 실제로 발동했는지 (확률 판정 실패면 false) — appendText 표시에 쓴다.
function applyEffect(state, effect) {
  // 부상/미침: 대상마다 독립적으로 effect.chance 판정
  if (effect.type === 'injure' || effect.type === 'madden' || effect.type === 'cure') {
    let fired = false;
    pickTargets(state, effect).forEach((c) => {
      if (effect.chance != null && Math.random() >= effect.chance) return;
      if (effect.type === 'injure') {
        if (c.health === 'healthy') {
          c.health = 'injured';
          c.injuredDays = 0;
          fired = true;
        }
      } else if (effect.type === 'madden') {
        c.sanity = Math.max(0, c.sanity - 40);
        fired = true;
      } else if (c.health === 'injured') {
        c.health = 'healthy';
        c.injuredDays = 0;
        fired = true;
      }
    });
    return fired;
  }
  if (effect.chance != null && Math.random() >= effect.chance) return false;
  switch (effect.type) {
    case 'resource': {
      state.resources[effect.key] = Math.max(0, (state.resources[effect.key] || 0) + effect.delta);
      break;
    }
    case 'item': {
      if (effect.delta < 0) {
        window.GameState.removeItem(state, effect.itemId, -effect.delta);
      } else if (window.GameState.canGainItem(state, effect.itemId)) {
        // 식량/물 외 물자는 이미 갖고 있으면 또 얻을 수 없다 (무조건 1개만 존재)
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
        if (effect.field === 'sanity') {
          c.sanity = Math.max(0, Math.min(100, c.sanity));
        }
      });
      break;
    }
    case 'advance': {
      // 엔딩 분기 진행도 +1 (resolveChoice 가 event.quest.code 를 넘겨준다)
      if (effect._code) window.EndingQuest.advance(state, effect._code);
      break;
    }
    case 'variant': {
      window.EndingQuest.setVariant(state, effect.key, effect.value);
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
    case 'destroyCategory': {
      // 해당 카테고리에 속한 인벤토리 아이템을 전부 잃는다 (재해로 파괴됨)
      Object.keys(state.inventory).forEach((itemId) => {
        const item = window.ItemsAPI.getItem(itemId);
        if (item && item.category === effect.category && state.inventory[itemId] > 0) {
          window.GameState.removeItem(state, itemId, state.inventory[itemId]);
        }
      });
      break;
    }
    default:
      console.warn('알 수 없는 effect 타입:', effect.type);
  }
  return true;
}

// 선택지 실행 -> 결과 텍스트 반환
function resolveChoice(state, event, choiceIndex) {
  const choice = event.choices[choiceIndex];
  if (!choice || !isChoiceEligible(state, choice)) {
    return { resultText: '선택할 수 없는 항목입니다.', effects: [] };
  }
  // 동적 이벤트(노크/강도): 선택지가 직접 판정하고 {resultText, nextEvent?, nextLabel?} 를 돌려준다
  if (choice.resolve) {
    const out = choice.resolve(state, event);
    window.GameState.addLog(state, `[Day ${state.day}] ${event.title} → ${choice.text} → ${out.resultText}`);
    return out;
  }
  const outcome = pickWeightedOutcome(choice.outcomes);
  let resultText = outcome.resultText;
  let advanced = false;
  outcome.effects.forEach((effect) => {
    const eff = effect.type === 'advance' ? { ...effect, _code: event.quest && event.quest.code } : effect;
    const fired = applyEffect(state, eff);
    if (effect.type === 'advance') advanced = true;
    if (fired && effect.appendText) resultText += ` ${effect.appendText}`;
  });
  if (event.quest && !advanced) window.EndingQuest.cooldown(state, event.quest);

  state.flags[`_seen_${event.id}`] = true;
  window.GameState.addLog(state, `[Day ${state.day}] ${event.title} → ${choice.text} → ${resultText}`);

  return { ...outcome, resultText };
}

window.EventEngine = {
  isEventEligible,
  isChoiceEligible,
  applyEffect,
  pickEventForToday,
  pickWeightedOutcome,
  resolveChoice,
};
