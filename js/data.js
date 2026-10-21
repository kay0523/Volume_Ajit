// Static content: default characters, look options, status presets.
window.NG = window.NG || {};

NG.CHARS = [
  { id: 0, name: '볼륨이', hairStyle: 'bob', hair: '#ff8fb3', skin: '#ffe0c8', top: '#9fc4ff', pants: '#5b6b9a', coat: true, acc: 'glasses', hat: 'none', hatColor: '#ff7a59' },
  { id: 1, name: '복셀이', hairStyle: 'short', hair: '#3b3f5c', skin: '#f6d2b4', top: '#7cc6ff', pants: '#3a3f55', coat: false, acc: 'none', hat: 'cap', hatColor: '#ff7a59' },
  { id: 2, name: '렌더리', hairStyle: 'bun', hair: '#c98a4b', skin: '#ffe6d0', top: '#8fe3c2', pants: '#4f8a7a', coat: false, acc: 'none', hat: 'none', hatColor: '#ff7a59' },
];

// Character customizer choices.
NG.LOOK = {
  hairStyle: [['bob', '단발'], ['short', '숏컷'], ['long', '긴 머리'], ['bun', '똥머리'], ['twin', '양갈래'], ['spiky', '삐죽']],
  hat: [['none', '없음'], ['cap', '캡모자'], ['beanie', '비니'], ['ribbon', '리본'], ['headphones', '헤드폰'], ['surgical', '수술모']],
  acc: [['none', '없음'], ['glasses', '안경'], ['sunglasses', '선글라스'], ['mask', '마스크']],
  hair: ['#2b2233', '#3b3f5c', '#6b4a3a', '#c98a4b', '#f2d27a', '#ff8fb3', '#b48cff', '#7cc6ff', '#7ad6a8', '#e9e9f2'],
  skin: ['#ffe6d0', '#ffe0c8', '#f6d2b4', '#e8b991', '#c98e64', '#8d5a3b'],
  top: ['#ffffff', '#9fc4ff', '#7cc6ff', '#8fe3c2', '#b8f5a6', '#fff27a', '#ffb3c7', '#ff7a59', '#b48cff', '#3a3f55'],
  pants: ['#5b6b9a', '#3a3f55', '#4f8a7a', '#2b2233', '#8a6a4a', '#c9c3e6', '#7a8fb8'],
  hatColor: ['#ff7a59', '#3a6ee0', '#2fa05a', '#2b2233', '#ff8fb3', '#fff27a', '#6fbfb0'],
};
NG.sanitizeLook = function (l, base) {
  const out = { ...base };
  if (!l || typeof l !== 'object') return out;
  const color = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  const pick = (k, list) => { if (list.some(([v]) => v === l[k])) out[k] = l[k]; };
  pick('hairStyle', NG.LOOK.hairStyle); pick('hat', NG.LOOK.hat); pick('acc', NG.LOOK.acc);
  for (const k of ['hair', 'skin', 'top', 'pants', 'hatColor']) if (color(l[k])) out[k] = l[k];
  if (typeof l.coat === 'boolean') out.coat = l.coat;
  return out;
};

NG.STATUS_PRESETS = [
  { e: '☕', t: '카페인이 필요함' },
  { e: '😴', t: '졸림' },
  { e: '🤭', t: '웃참중' },
  { e: '🔥', t: '집중모드' },
  { e: '🎧', t: '노캔 중 (말 걸지 마)' },
  { e: '🍱', t: '배고픔' },
  { e: '🫠', t: '녹는 중' },
  { e: '🖥️', t: '렌더링 기다리는 중' },
  { e: '🧠', t: '뇌 과부하' },
  { e: '🏃', t: '퇴근 각' },
  { e: '🤔', t: '고민 중' },
  { e: '🎉', t: '신남' },
];

// Jazz bar menu: coffee : non-coffee : alcohol = 2 : 3 : 5.  cup = glass shape drawn in the character's hand.
NG.DRINKS = [
  ['americano', '아메리카노', '☕', 'coffee', 'mug', '#4a3024', '진하고 깔끔한 기본 한 잔'],
  ['latte', '카페라테', '☕', 'coffee', 'mug', '#c8a07a', '우유 거품이 몽글몽글'],
  ['espresso', '에스프레소', '☕', 'coffee', 'demi', '#3a2418', '한 입에 털어 넣는 진한 샷'],
  ['cappuccino', '카푸치노', '☕', 'coffee', 'mug', '#d8b890', '시나몬 가루 톡톡'],
  ['handdrip', '핸드드립', '☕', 'coffee', 'mug', '#5a3a28', '오늘의 원두로 천천히 내린 한 잔'],
  ['coldbrew', '콜드브루', '🧊', 'coffee', 'tall', '#3a2418', '얼음 동동, 차갑게 우려낸 커피'],
  ['greentea', '녹차 라테', '🍵', 'soft', 'mug', '#9ab86a', '쌉싸름하고 고소한 말차'],
  ['hotchoco', '핫초코', '🍫', 'soft', 'mug', '#6a4030', '마시멜로 하나 퐁당'],
  ['lemonade', '레몬에이드', '🍋', 'soft', 'tall', '#f2e27a', '톡 쏘는 상큼함'],
  ['grapefruit', '자몽 허니 블랙티', '🍊', 'soft', 'tall', '#e8906a', '달콤 쌉싸름한 자몽 홍차'],
  ['milktea', '밀크티', '🧋', 'soft', 'tall', '#c8a888', '쫀득한 펄 추가'],
  ['chamomile', '캐모마일 티', '🌼', 'soft', 'cup', '#e8d48a', '마음이 차분해지는 꽃차'],
  ['strawberry', '딸기 스무디', '🍓', 'soft', 'tall', '#e8788a', '생딸기를 듬뿍 갈아 넣은'],
  ['sikhye', '식혜', '🍚', 'soft', 'cup', '#eee0c0', '살얼음 동동 전통 음료'],
  ['yuja', '유자차', '🍯', 'soft', 'cup', '#f0c040', '따끈한 유자 한 잔'],
  ['beer', '생맥주', '🍺', 'alcohol', 'beer', '#e8b040', '거품 가득 시원한 한 잔'],
  ['highball', '하이볼', '🥃', 'alcohol', 'tall', '#e8c878', '위스키에 탄산수, 레몬 한 조각'],
  ['soju', '소주', '🍶', 'alcohol', 'shot', '#e8f0f0', '초록 병에서 한 잔 따라'],
  ['makgeolli', '막걸리', '🍶', 'alcohol', 'cup', '#f0ead8', '흔들어 마시는 우리 술'],
  ['redwine', '레드 와인', '🍷', 'alcohol', 'wine', '#8a2a3a', '진한 과일 향'],
  ['whitewine', '화이트 와인', '🥂', 'alcohol', 'wine', '#f0e0a0', '산뜻하고 가벼운'],
  ['whisky', '위스키 온더록', '🥃', 'alcohol', 'rock', '#c88838', '큰 얼음 하나 위로 천천히'],
  ['gintonic', '진토닉', '🍸', 'alcohol', 'tall', '#d8ecf0', '라임 향이 상쾌한 클래식'],
  ['mojito', '모히토', '🌿', 'alcohol', 'tall', '#c8e8a8', '민트 잎 가득'],
  ['martini', '마티니', '🍸', 'alcohol', 'cocktail', '#e8ecd8', '올리브 하나 콕'],
  ['oldfashioned', '올드 패션드', '🥃', 'alcohol', 'rock', '#b8702a', '오렌지 껍질 향의 위스키 칵테일'],
  ['negroni', '네그로니', '🍹', 'alcohol', 'rock', '#c8402a', '쌉싸름한 붉은 칵테일'],
  ['margarita', '마르가리타', '🍹', 'alcohol', 'cocktail', '#e8f0a0', '잔 테두리에 소금'],
  ['sake', '사케', '🍶', 'alcohol', 'shot', '#f4f0e4', '작은 잔에 따뜻하게'],
  ['champagne', '샴페인', '🍾', 'alcohol', 'flute', '#f0e0a0', '축하할 일이 있나요?'],
].map(([id, n, e, k, cup, color, d]) => ({ id, n, e, k, cup, color, d }));
