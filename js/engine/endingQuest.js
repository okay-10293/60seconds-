// ============================================================
// endingQuest.js — 엔딩 분기 진행도 / 노크 / 위장 강도 / 엔딩 판정
// ============================================================
// 데이터: js/data/endingQuests.js (ENDING_STEPS, ENDING_QUEST)
// 상태: state.flags.q = {
//   progress:{M:0..}, nextDay:{M:day}, ready:[코드...](조건 충족 순서), knockDay:{M:day},
//   refusals:{M:n}, harm:n(하모니카 방어 사용 횟수), variants:{C3, C5}
// }
// 규칙 요약(문서 기준): 진행도를 다 채운 엔딩은 5~10일 뒤 노크 → 문 열기(진짜 80% / 위장 강도 20%).
// 여러 엔딩이 동시에 충족되면 먼저 충족한 엔딩이 먼저 노크하고 나머지는 보류(문서 제안).

(function () {
  const D = () => window.ENDING_QUEST;
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const CODES = ['M', 'T', 'C', 'B', 'D'];

  function getQ(state) {
    if (!state.flags.q) {
      state.flags.q = { progress: {}, nextDay: {}, ready: [], knockDay: {}, refusals: {}, harm: 0, variants: {}, lastKnock: -99 };
    }
    return state.flags.q;
  }

  function advance(state, code) {
    const q = getQ(state);
    q.progress[code] = (q.progress[code] || 0) + 1;
    if (q.progress[code] >= D().steps[code] && !q.ready.includes(code)) {
      q.ready.push(code);
      q.knockDay[code] = state.day + rand(5, 10);
    }
  }

  function setVariant(state, key, value) {
    getQ(state).variants[key] = value;
  }

  function cooldown(state, quest) {
    getQ(state).nextDay[quest.code] = state.day + (quest.retry || 3);
  }

  // ---------- 단계 이벤트 후보 ----------
  function stepCandidates(state) {
    const q = getQ(state);
    const EE = window.EventEngine;
    return (window.ENDING_STEPS || []).filter((ev) => {
      const { code, step, gate } = ev.quest;
      if (q.ready.includes(code)) return false;
      if ((q.progress[code] || 0) !== step - 1) return false;
      if (state.day < (q.nextDay[code] || 0)) return false;
      if (!EE.isEventEligible(state, ev)) return false;
      if (gate && !gate(state)) return false;
      return true;
    });
  }

  // ---------- 노크 ----------
  function pickKnock(state) {
    const q = getQ(state);
    if (q.ready.length > 0) {
      const code = q.ready[0];
      if (state.day >= (q.knockDay[code] || 0)) return buildKnock(state, { code });
      return null;
    }
    if (state.day >= 2 && state.day - q.lastKnock >= 3 && Math.random() < 0.05) {
      return buildKnock(state, { code: null });
    }
    return null;
  }

  function buildKnock(state, { code }) {
    const q = getQ(state);
    q.lastKnock = state.day;
    let truth;
    if (code) truth = Math.random() < 0.8 ? 'real' : 'robber';
    else {
      const r = Math.random();
      truth = r < 0.35 ? 'robber' : r < 0.55 ? 'supply' : r < 0.85 ? 'prank' : 'gift';
    }
    const disguise = code || pick(CODES);
    let desc = pick(code === 'C' ? D().knockBaseC : D().knockBase);
    if (truth === 'real' && Math.random() < 0.5) desc += ` ${D().clue[code]}`;
    else if (truth === 'robber' && Math.random() < 0.3) desc += ` ${D().fakeClue[disguise]}`;
    if (code && (q.refusals[code] || 0) >= 2) desc += ` ${D().thirdRefusal}`;
    return makeKnockEvent(state, { code, truth, disguise, desc, peeked: false });
  }

  function makeKnockEvent(state, p) {
    const choices = [{ text: '문을 연다', resolve: (s) => openDoor(s, p) }];
    if (!p.peeked) choices.push({ text: '문틈으로 살펴본다', resolve: (s) => peek(s, p) });
    choices.push({ text: '열지 않는다', resolve: (s) => refuse(s, p) });
    return { id: 'KNOCK', title: '노크', description: p.desc, choices };
  }

  function peek(state, p) {
    const flash = window.GameState.hasItem(state, 'flashlight', 1) ? 0.15 : 0;
    const r = Math.random();
    let text;
    if (p.truth === 'real') {
      text = r < 0.55 + flash ? D().clue[p.code] : D().peek.ambiguous;
    } else if (p.truth === 'robber') {
      const exact = 0.35 + flash;
      const mis = 0.25;
      text = r < exact ? D().peek.robberExact : r < exact + mis ? D().peek.misjudge : D().peek.ambiguous;
    } else {
      text = D().peek.ambiguous; // 보급/벨튀/선물 방문자는 문서에 규정이 없어 항상 모호하게 처리
    }
    const next = makeKnockEvent(state, { ...p, desc: `${p.desc} ${text}`, peeked: true });
    return { resultText: text, nextEvent: next, nextLabel: '계속 →' };
  }

  function setEnding(state, id, title, text) {
    state.phase = 'ending';
    state.endingResult = { id, title, description: text };
    window.GameState.addLog(state, `[Day ${state.day}] 엔딩: ${title}`);
  }

  function endingText(state, code) {
    const e = D().endings[code];
    let text = e.text;
    if (code === 'C') {
      const v = getQ(state).variants;
      if (v.C3) text += ` ${D().cVariant[v.C3]}`;
      if (v.C5) text += ` ${D().cVariant[v.C5]}`;
    }
    return { title: e.title, text };
  }

  function openDoor(state, p) {
    const q = getQ(state);
    const EE = window.EventEngine;
    const intro = D().openIntro;
    if (p.code) q.refusals[p.code] = 0;
    if (p.truth === 'real') {
      const e = endingText(state, p.code);
      setEnding(state, `ending_${p.code}`, e.title, e.text);
      return { resultText: intro };
    }
    if (p.truth === 'robber') {
      return {
        resultText: `${intro} ${D().disguise[p.disguise]}`,
        nextEvent: buildRobber(state, p),
        nextLabel: '계속 →',
      };
    }
    if (p.truth === 'supply') {
      EE.applyEffect(state, { type: 'resource', key: 'food', delta: 1 });
      EE.applyEffect(state, { type: 'resource', key: 'water', delta: 1 });
      return { resultText: `${intro} ${D().supply}` };
    }
    if (p.truth === 'prank') return { resultText: `${intro} ${D().prank}` };
    EE.applyEffect(state, { type: 'resource', key: Math.random() < 0.5 ? 'food' : 'water', delta: 1 });
    return { resultText: `${intro} ${D().gift}` };
  }

  function refuse(state, p) {
    const q = getQ(state);
    const EE = window.EventEngine;
    let ended = false;
    if (p.code) {
      q.knockDay[p.code] = state.day + 10;
      if (p.truth === 'real') {
        q.refusals[p.code] = (q.refusals[p.code] || 0) + 1;
        if (q.refusals[p.code] >= 3) {
          const x = D().badEndings.X2;
          setEnding(state, 'ending_X2', x.title, x.text);
          ended = true;
        }
      }
    }
    if (p.truth === 'robber' && !ended && Math.random() >= 0.4) {
      EE.applyEffect(state, { type: 'madden', target: 'all', chance: 0.03 });
    }
    return { resultText: D().refuse };
  }

  // ---------- 위장 강도 (R-01) ----------
  function buildRobber(state, p) {
    const has = (id) => window.GameState.hasItem(state, id, 1);
    const choices = [];
    if (has('harmonica')) choices.push({ text: '하모니카를 분다', resolve: (s) => defend(s, p, 'harmonica') });
    if (has('lock')) choices.push({ text: '자물쇠를 건다', resolve: (s) => defend(s, p, 'lock') });
    if (has('axe')) choices.push({ text: '도끼를 든다', resolve: (s) => defend(s, p, 'axe') });
    if (has('rifle')) choices.push({ text: '소총을 겨눈다', resolve: (s) => defend(s, p, 'rifle') });
    choices.push({ text: '아무것도 하지 않는다', resolve: (s) => defend(s, p, 'none') });
    return { id: 'ROBBER', title: '위장 강도', description: D().reversal, choices };
  }

  function defend(state, p, how) {
    const q = getQ(state);
    const EE = window.EventEngine;
    const T = D().defense;
    let ok = false;
    let text = T.nothing;
    let extra = '';
    if (how === 'harmonica') {
      q.harm += 1;
      ok = q.harm === 1 ? true : Math.random() < 0.7;
      text = ok ? T.harmonicaOk : T.harmonicaFail;
    } else if (how === 'lock') {
      ok = Math.random() < 0.9;
      window.GameState.removeItem(state, 'lock', 1);
      text = ok ? T.lockOk : T.lockFail;
    } else if (how === 'axe') {
      ok = Math.random() < 0.8;
      text = ok ? T.axeOk : T.axeFail;
      if (Math.random() < 0.5) {
        window.GameState.removeItem(state, 'axe', 1);
        extra = ` ${T.axeBreak}`;
      }
    } else if (how === 'rifle') {
      if (window.GameState.hasItem(state, 'ammo', 1)) {
        ok = Math.random() < 0.9;
        window.GameState.removeItem(state, 'ammo', 1);
      } else {
        ok = Math.random() < 0.7;
        if (Math.random() < 0.5) window.GameState.removeItem(state, 'rifle', 1);
      }
      text = ok ? T.rifleOk : T.rifleFail;
    }

    if (p.code) q.knockDay[p.code] = state.day + rand(5, 10);

    if (ok) {
      if (p.disguise === 'D') extra += ` ${D().dogRescue}`;
      return { resultText: `${text}${extra}` };
    }

    // 방어 실패 → 피해 판정 (식량2·물2 45 / 부상 30 / 떠남 10 / 대부분 약탈 12 / 점령 3)
    const r = Math.random() * 100;
    const dm = D().damage;
    let dmg;
    if (r < 45) {
      EE.applyEffect(state, { type: 'resource', key: 'food', delta: -2 });
      EE.applyEffect(state, { type: 'resource', key: 'water', delta: -2 });
      dmg = dm.loot;
    } else if (r < 75) {
      EE.applyEffect(state, { type: 'injure', target: 'random', chance: 1 });
      dmg = dm.hurt;
    } else if (r < 85) {
      dmg = dm.leave;
    } else if (r < 97) {
      state.resources.food = 0;
      state.resources.water = 0;
      dmg = dm.loot;
    } else {
      const x = D().badEndings.X1;
      setEnding(state, 'ending_X1', x.title, x.text);
      return { resultText: `${text}${extra}` };
    }
    return { resultText: `${text}${extra} ${dmg}` };
  }

  window.EndingQuest = { getQ, advance, setVariant, cooldown, stepCandidates, pickKnock };
})();
