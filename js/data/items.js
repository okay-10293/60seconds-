// ============================================================
// items.js — 탈출 파트에서 주울 수 있는 아이템 목록
// ============================================================
// category: 'food' | 'water' | 'weapon' | 'tool' | 'medicine' | 'special' | 'junk'
// tags: 이벤트 선택지 조건에서 참조하는 태그 (예: 'canPurify', 'canDefend')

window.ITEMS = [
  { id: 'canned_food', name: '수프 통조림', icon: '🥫', category: 'food', tags: [] },
  { id: 'water_bottle', name: '물', icon: '💧', category: 'water', tags: [] },
  { id: 'map', name: '지도', icon: '🗺️', category: 'tool', tags: ['canLocate'] },
  { id: 'radio', name: '라디오', icon: '📻', category: 'tool', tags: ['canReceiveNews'] },
  { id: 'gas_mask', name: '방독면', icon: '😷', category: 'tool', tags: ['canFilterAir'] },
  { id: 'axe', name: '도끼', icon: '🪓', category: 'weapon', tags: ['canDefend'] },
  { id: 'rifle', name: '소총', icon: '🔫', category: 'weapon', tags: ['canDefend'] },
  { id: 'ammo', name: '탄약', icon: '🧨', category: 'weapon', tags: ['boostDefend'] },
  { id: 'flashlight', name: '손전등', icon: '🔦', category: 'tool', tags: ['canLight'] },
  { id: 'survival_book', name: '생존 안내서', icon: '📗', category: 'tool', tags: ['canRepair'] },
  { id: 'first_aid', name: '구급상자', icon: '🩹', category: 'medicine', tags: ['canHeal'] },
  { id: 'pesticide', name: '살충제', icon: '🧴', category: 'medicine', tags: ['canExterminate'] },
  { id: 'board_game', name: '체커', icon: '🎲', category: 'special', tags: ['boostSanity'] },
  { id: 'playing_cards', name: '카드', icon: '🃏', category: 'special', tags: ['boostSanity'] },
  { id: 'suitcase', name: '여행가방', icon: '🧳', category: 'special', tags: ['extraSlot'] },
  { id: 'lock', name: '자물쇠', icon: '🔒', category: 'special', tags: ['canTrade'] },
  { id: 'harmonica', name: '하모니카', icon: '🎵', category: 'special', tags: ['canDefend', 'boostSanity'] },
];

function getItem(itemId) {
  return window.ITEMS.find((i) => i.id === itemId);
}

function itemsWithTag(tag) {
  return window.ITEMS.filter((i) => i.tags.includes(tag));
}

window.ItemsAPI = { getItem, itemsWithTag };
