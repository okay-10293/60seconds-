// ============================================================
// endingEngine.js — endings.js 데이터를 실제로 해석/적용하는 엔진
// 이 파일은 엔딩 추가할 때 건드릴 필요 없음
// ============================================================

const ORIGINAL_FAMILY_IDS = ['dad', 'mom', 'son', 'daughter'];

function buildEndingContext(state) {
  const shelterChars = window.GameState.shelterCharacters(state);

  const lostOrDead = state.characters.filter(
    (c) => ORIGINAL_FAMILY_IDS.includes(c.id) && (c.health === 'dead' || c.location === 'missing')
  );

  const originalFamilyAllInShelter = ORIGINAL_FAMILY_IDS.every((id) => {
    const c = window.GameState.getCharacter(state, id);
    return !!c && c.location === 'shelter' && c.health !== 'dead';
  });

  const avgSanity = shelterChars.length
    ? shelterChars.reduce((sum, c) => sum + c.sanity, 0) / shelterChars.length
    : 0;

  const minSanity = shelterChars.length ? Math.min(...shelterChars.map((c) => c.sanity)) : 0;

  return {
    state,
    shelterCount: shelterChars.length,
    lostOrDeadCount: lostOrDead.length,
    originalFamilyAllInShelter,
    avgSanity,
    minSanity,
    militaryRescueConfirmed: !!state.flags.militaryRescueConfirmed,
  };
}

function determineEnding(state) {
  const ctx = buildEndingContext(state);
  const ending = window.ENDINGS.find((e) => e.condition(ctx)) || window.ENDINGS[window.ENDINGS.length - 1];
  return { id: ending.id, title: ending.title, description: ending.description };
}

window.EndingEngine = { buildEndingContext, determineEnding };
