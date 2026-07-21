// ============================================================
// items.js — 탈출 파트에서 주울 수 있는 아이템 목록
// ============================================================
// category: 'food' | 'water' | 'weapon' | 'tool' | 'medicine' | 'special' | 'junk'
// tags: 이벤트 선택지 조건에서 참조하는 태그 (예: 'canPurify', 'canDefend')

window.ITEMS = [
  { id: 'canned_food', name: '통조림', icon: '🥫', category: 'food', tags: [] },
  { id: 'water_bottle', name: '생수병', icon: '💧', category: 'water', tags: [] },
  { id: 'first_aid', name: '구급상자', icon: '🩹', category: 'medicine', tags: ['canHeal'] },
  { id: 'rifle', name: '엽총', icon: '🔫', category: 'weapon', tags: ['canDefend'] },
  { id: 'radio', name: '라디오', icon: '📻', category: 'tool', tags: ['canReceiveNews'] },
  { id: 'flashlight', name: '손전등', icon: '🔦', category: 'tool', tags: ['canLight'] },
  { id: 'board_game', name: '보드게임', icon: '🎲', category: 'special', tags: ['boostSanity'] },
  { id: 'water_purifier', name: '정수기', icon: '🧪', category: 'tool', tags: ['canPurify'] },
  { id: 'playing_cards', name: '카드', icon: '🃏', category: 'special', tags: ['boostSanity'] },
  { id: 'family_photo', name: '가족사진', icon: '🖼️', category: 'special', tags: ['boostSanity'] },
  { id: 'baseball_bat', name: '야구 배트', icon: '🏏', category: 'weapon', tags: ['canDefend'] },
  { id: 'whiskey', name: '위스키', icon: '🥃', category: 'special', tags: ['boostSanity', 'canTrade'] },
  { id: 'gas_mask', name: '방독면', icon: '😷', category: 'tool', tags: ['canFilterAir'] },
  { id: 'toolbox', name: '공구함', icon: '🧰', category: 'tool', tags: ['canRepair'] },
  { id: 'guitar', name: '기타', icon: '🎸', category: 'special', tags: ['boostSanity'] },
  { id: 'dog_food', name: '개 사료', icon: '🦴', category: 'special', tags: ['canFeedDog'] },
];

function getItem(itemId) {
  return window.ITEMS.find((i) => i.id === itemId);
}

function itemsWithTag(tag) {
  return window.ITEMS.filter((i) => i.tags.includes(tag));
}

window.ItemsAPI = { getItem, itemsWithTag };
