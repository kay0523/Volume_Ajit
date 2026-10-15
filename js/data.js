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
