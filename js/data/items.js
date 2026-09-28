// ============================================================
// items.js — 탈출 파트에서 주울 수 있는 아이템 목록
// ============================================================
// category: 'food' | 'water' | 'weapon' | 'tool' | 'medicine' | 'special' | 'junk'
// tags: 이벤트 선택지 조건에서 참조하는 태그 (예: 'canPurify', 'canDefend')
// slots: 탈출할 때 가방(4칸)에서 차지하는 칸 수 — 원작(60 Seconds!) 기준.
//   수프/물/지도/라디오/방독면/손전등/책/살충제/탄약/카드/체커/자물쇠 = 1칸,
//   도끼/소총/구급상자 = 2칸, 여행가방 = 3칸. (하모니카는 원작 자료에서 칸 수를 못 찾아 1칸으로 가정)

window.ITEMS = [
  { id: 'canned_food', name: '수프 통조림', icon: '🥫', category: 'food', slots: 1, tags: [] },
  { id: 'water_bottle', name: '물', icon: '💧', category: 'water', slots: 1, tags: [] },
  { id: 'map', name: '지도', icon: '🗺️', category: 'tool', slots: 1, tags: ['canLocate'] },
  { id: 'radio', name: '라디오', icon: '📻', category: 'tool', slots: 1, tags: ['canReceiveNews'] },
  { id: 'gas_mask', name: '방독면', icon: '😷', category: 'tool', slots: 1, tags: ['canFilterAir'] },
  { id: 'axe', name: '도끼', icon: '🪓', category: 'weapon', slots: 2, tags: ['canDefend'] },
  { id: 'rifle', name: '소총', icon: '🔫', category: 'weapon', slots: 2, tags: ['canDefend'] },
  { id: 'ammo', name: '탄약', icon: '🧨', category: 'weapon', slots: 1, tags: ['boostDefend'] },
  { id: 'flashlight', name: '손전등', icon: '🔦', category: 'tool', slots: 1, tags: ['canLight'] },
  { id: 'survival_book', name: '생존 안내서', icon: '📗', category: 'tool', slots: 1, tags: ['canRepair'] },
  { id: 'first_aid', name: '구급상자', icon: '🩹', category: 'medicine', slots: 2, tags: ['canHeal'] },
  { id: 'pesticide', name: '살충제', icon: '🧴', category: 'medicine', slots: 1, tags: ['canExterminate'] },
  { id: 'board_game', name: '체커', icon: '🎲', category: 'special', slots: 1, tags: ['boostSanity'] },
  { id: 'playing_cards', name: '카드', icon: '🃏', category: 'special', slots: 1, tags: ['boostSanity'] },
  { id: 'suitcase', name: '여행가방', icon: '🧳', category: 'special', slots: 3, tags: ['extraSlot'] },
  { id: 'lock', name: '자물쇠', icon: '🔒', category: 'special', slots: 1, tags: ['canTrade'] },
  { id: 'harmonica', name: '하모니카', icon: '🎵', category: 'special', slots: 1, tags: ['canDefend', 'boostSanity'] },
];

function getItem(itemId) {
  return window.ITEMS.find((i) => i.id === itemId);
}

function itemsWithTag(tag) {
  return window.ITEMS.filter((i) => i.tags.includes(tag));
}

window.ItemsAPI = { getItem, itemsWithTag };
