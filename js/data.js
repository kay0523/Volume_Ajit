// Static content: characters, status presets, anatomy figures, quiz.
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

// rarity: 1 common, 2 rare, 3 epic
NG.FIGURES = [
  { id: 'skull', e: '💀', n: '두개골', r: 1, f: '성인의 두개골은 22개의 뼈로 이루어져 있고, 아래턱뼈만 움직여요.' },
  { id: 'bone', e: '🦴', n: '넙다리뼈', r: 1, f: '넙다리뼈(대퇴골)는 몸에서 가장 길고 튼튼한 뼈예요. 키의 약 1/4!' },
  { id: 'tooth', e: '🦷', n: '어금니', r: 1, f: '치아 법랑질은 몸에서 가장 단단한 조직이에요.' },
  { id: 'eye', e: '👁️', n: '안구', r: 1, f: '안구 지름은 약 24mm. 태어날 때부터 크기가 거의 그대로예요.' },
  { id: 'ear', e: '👂', n: '귓바퀴', r: 1, f: '가장 작은 뼈인 등자뼈는 가운데귀에 있어요. 쌀알만 해요.' },
  { id: 'nose', e: '👃', n: '코', r: 1, f: '코는 약 1조 가지 냄새를 구별할 수 있다는 연구가 있어요.' },
  { id: 'tongue', e: '👅', n: '혀', r: 1, f: '혀는 8개의 근육으로 이루어져 있어요. 뼈에 붙지 않은 쪽도 있죠.' },
  { id: 'hand', e: '🖐️', n: '손뼈', r: 1, f: '한 손에 뼈가 27개! 양손 양발을 합치면 전신 뼈의 절반이 넘어요.' },
  { id: 'foot', e: '🦶', n: '발뼈', r: 1, f: '발 하나에 뼈 26개, 관절 33개가 있어요.' },
  { id: 'muscle', e: '💪', n: '위팔두갈래근', r: 1, f: '이두근은 이름처럼 머리(갈래)가 두 개인 근육이에요.' },
  { id: 'heart', e: '🫀', n: '심장', r: 2, f: '심장은 하루에 약 10만 번 뛰고, 7,000L 넘는 피를 내보내요.' },
  { id: 'lung', e: '🫁', n: '허파', r: 2, f: '왼쪽 허파는 심장 자리 때문에 오른쪽보다 작아요 (2엽 vs 3엽).' },
  { id: 'brain', e: '🧠', n: '뇌', r: 2, f: '뇌는 체중의 2%지만 몸 에너지의 약 20%를 써요.' },
  { id: 'blood', e: '🩸', n: '적혈구', r: 2, f: '적혈구는 약 120일 살고, 1초에 200만 개 넘게 새로 만들어져요.' },
  { id: 'microbe', e: '🦠', n: '장내 미생물', r: 2, f: '장 속 미생물 무게를 합치면 약 1~2kg이나 돼요.' },
  { id: 'dna', e: '🧬', n: 'DNA 이중나선', r: 3, f: '세포 하나의 DNA를 쭉 펴면 약 2m. 몸 전체로는 태양까지 왕복 수십 번!' },
  { id: 'xray', e: '🩻', n: 'X-ray 필름', r: 3, f: 'CT는 수많은 X선 투영을 모아 3D 볼륨을 재구성해요. 볼륨팀의 시작!' },
  { id: 'cube', e: '🧊', n: '골든 복셀', r: 3, f: '복셀(voxel) = volume + pixel. 3D 볼륨 데이터의 가장 작은 단위예요.' },
];

NG.RARITY = { 1: { n: '일반', c: '#9aa7b8', w: 70 }, 2: { n: '레어', c: '#58a6ff', w: 25 }, 3: { n: '에픽', c: '#c77dff', w: 5 } };

NG.QUIZ = [
  { q: '사람 몸에서 가장 긴 뼈는?', a: ['넙다리뼈', '정강뼈', '위팔뼈', '척추'], c: 0 },
  { q: '성인의 뼈는 대략 몇 개?', a: ['206개', '186개', '256개', '300개'], c: 0 },
  { q: '가장 작은 뼈가 있는 곳은?', a: ['가운데귀', '손가락', '코', '발가락'], c: 0 },
  { q: '심장의 방은 몇 개?', a: ['4개', '2개', '3개', '6개'], c: 0 },
  { q: '오른쪽 허파의 엽(lobe) 수는?', a: ['3개', '2개', '4개', '5개'], c: 0 },
  { q: '인슐린을 분비하는 장기는?', a: ['이자(췌장)', '간', '콩팥', '지라'], c: 0 },
  { q: '몸에서 가장 큰 장기는?', a: ['피부', '간', '허파', '뇌'], c: 0 },
  { q: '무릎뼈의 다른 이름은?', a: ['슬개골', '견갑골', '흉골', '천골'], c: 0 },
  { q: '목뼈(경추)는 몇 개?', a: ['7개', '5개', '12개', '9개'], c: 0 },
  { q: '등뼈(흉추)는 몇 개?', a: ['12개', '7개', '5개', '10개'], c: 0 },
  { q: 'CT의 밝기 단위는?', a: ['HU (하운스필드)', 'dB', 'Tesla', 'lux'], c: 0 },
  { q: 'CT에서 물의 HU 값은?', a: ['0', '-1000', '1000', '100'], c: 0 },
  { q: 'CT에서 공기의 HU 값은 대략?', a: ['-1000', '0', '+400', '-100'], c: 0 },
  { q: 'MRI가 주로 이용하는 원자핵은?', a: ['수소', '탄소', '산소', '철'], c: 0 },
  { q: '몸을 좌우로 나누는 단면은?', a: ['시상면', '관상면', '횡단면', '사선면'], c: 0 },
  { q: '몸을 앞뒤로 나누는 단면은?', a: ['관상면', '시상면', '횡단면', '수평면'], c: 0 },
  { q: '피를 온몸으로 보내는 심장의 방은?', a: ['좌심실', '우심실', '좌심방', '우심방'], c: 0 },
  { q: '해독 작용을 주로 하는 장기는?', a: ['간', '위', '지라', '쓸개'], c: 0 },
  { q: '복셀(voxel)은 무엇의 합성어?', a: ['volume + pixel', 'vox + cell', 'vector + element', 'voice + cell'], c: 0 },
  { q: '볼륨 렌더링에서 값→색/투명도 매핑을 뭐라고 할까?', a: ['전달 함수', '노멀 맵', '밉맵', '셰이더 캐시'], c: 0 },
  { q: '척수를 보호하는 뼈 구조는?', a: ['척주', '갈비뼈', '골반', '빗장뼈'], c: 0 },
  { q: '빗장뼈의 다른 이름은?', a: ['쇄골', '흉골', '견갑골', '요골'], c: 0 },
  { q: '눈에서 빛을 받아들이는 막은?', a: ['망막', '각막', '홍채', '수정체'], c: 0 },
  { q: '사람이 가진 근육 수는 대략?', a: ['600개 이상', '200개', '100개', '1,500개'], c: 0 },
];
