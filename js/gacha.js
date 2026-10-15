// Gacha shop: three capsule machines of chibi pixel figures (fan-made collectibles, drawn generically, not likenesses).
(function () {
  const hash = (s) => { let h = 7; for (const ch of s) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };
  const pick = (arr, s, salt = 0) => arr[(hash(s) + salt) % arr.length];
  const HAIR = ['#2b2233', '#3b3f5c', '#6b4a3a', '#c98a4b', '#f2d27a', '#e9e9f2', '#b48cff', '#ff8fb3', '#7cc6ff'];
  const SKIN = ['#ffe6d0', '#ffe0c8', '#f6d2b4', '#e8b991'];
  const look = (o) => ({ hairStyle: 'short', hair: '#2b2233', skin: '#f6d2b4', top: '#3a3f55', pants: '#2b2233', coat: false, acc: 'none', hat: 'none', hatColor: '#2b2233', ...o });

  // ---- 1. famous bands (one figure per band) ----
  const BANDS = [
    ['beatles', 'The Beatles', '1960년 리버풀 결성 · 대표곡 "Hey Jude"', 3, 'guitar', { hairStyle: 'bob', hair: '#3b2a22', top: '#3a3f55' }],
    ['queen', 'Queen', '1970년 런던 결성 · 대표곡 "Bohemian Rhapsody"', 3, 'mic', { hairStyle: 'short', hair: '#2b2233', top: '#f2f2ee', pants: '#f2f2ee' }],
    ['ledzep', 'Led Zeppelin', '1968년 런던 결성 · 대표곡 "Stairway to Heaven"', 3, 'guitar', { hairStyle: 'long', hair: '#6b4a3a', top: '#8a5a3a' }],
    ['floyd', 'Pink Floyd', '1965년 런던 결성 · 대표곡 "Another Brick in the Wall"', 3, 'keys', { hairStyle: 'long', hair: '#3b2a22', top: '#2b2233' }],
    ['stones', 'The Rolling Stones', '1962년 런던 결성 · 대표곡 "(I Can\'t Get No) Satisfaction"', 2, 'mic', { hairStyle: 'spiky', hair: '#3b2a22', top: '#c0403a' }],
    ['nirvana', 'Nirvana', '1987년 워싱턴주 애버딘 결성 · 대표곡 "Smells Like Teen Spirit"', 2, 'guitar', { hairStyle: 'long', hair: '#f2d27a', top: '#5f7e85', pants: '#4f6a86' }],
    ['radiohead', 'Radiohead', '1985년 애빙던 결성 · 대표곡 "Creep"', 2, 'guitar', { hairStyle: 'short', hair: '#c98a4b', top: '#4a4a4a' }],
    ['oasis', 'Oasis', '1991년 맨체스터 결성 · 대표곡 "Wonderwall"', 2, 'guitar', { hairStyle: 'bob', hair: '#3b2a22', top: '#2f4a6a', acc: 'sunglasses' }],
    ['metallica', 'Metallica', '1981년 LA 결성 · 대표곡 "Master of Puppets"', 2, 'guitar', { hairStyle: 'long', hair: '#2b2233', top: '#1d1d22' }],
    ['rhcp', 'Red Hot Chili Peppers', '1983년 LA 결성 · 대표곡 "Californication"', 1, 'bass', { hairStyle: 'spiky', hair: '#3b2a22', top: '#c0403a', hat: 'beanie', hatColor: '#c0403a' }],
    ['coldplay', 'Coldplay', '1997년 런던 결성 · 대표곡 "Yellow"', 1, 'keys', { hairStyle: 'short', hair: '#6b4a3a', top: '#f2d27a' }],
    ['arctic', 'Arctic Monkeys', '2002년 셰필드 결성 · 대표곡 "Do I Wanna Know?"', 1, 'guitar', { hairStyle: 'short', hair: '#2b2233', top: '#1d1d22', acc: 'sunglasses' }],
    ['sanullim', '산울림', '1977년 데뷔 · 대표곡 "아니 벌써"', 3, 'guitar', { hairStyle: 'bob', hair: '#2b2233', top: '#8a6a4a' }],
    ['deulgukhwa', '들국화', '1985년 1집 발표 · 대표곡 "행진"', 2, 'mic', { hairStyle: 'long', hair: '#2b2233', top: '#5f7e85' }],
    ['nell', '넬', '1999년 결성 · 대표곡 "기억을 걷는 시간"', 1, 'guitar', { hairStyle: 'short', hair: '#2b2233', top: '#3a3f55' }],
    ['guckkasten', '국카스텐', '2008년 정규 1집 · 대표곡 "거울"', 1, 'mic', { hairStyle: 'spiky', hair: '#2b2233', top: '#7a2f2a' }],
    ['kiha', '장기하와 얼굴들', '2008년 데뷔 · 대표곡 "싸구려 커피"', 2, 'mic', { hairStyle: 'short', hair: '#2b2233', top: '#e9e1cf', acc: 'glasses' }],
    ['hyukoh', '혁오', '2014년 데뷔 · 대표곡 "위잉위잉"', 1, 'guitar', { hairStyle: 'bob', hair: '#2b2233', top: '#6f8a62' }],
    ['jannabi', '잔나비', '2014년 데뷔 · 대표곡 "주저하는 연인들을 위해"', 1, 'mic', { hairStyle: 'bob', hair: '#3b2a22', top: '#c09a4e' }],
    ['day6', 'DAY6', '2015년 데뷔 · 대표곡 "한 페이지가 될 수 있게"', 1, 'bass', { hairStyle: 'short', hair: '#3b3f5c', top: '#7cc6ff' }],
    ['silicagel', '실리카겔', '2015년 데뷔 · 대표곡 "NO PAIN"', 1, 'guitar', { hairStyle: 'spiky', hair: '#b48cff', top: '#2b2233' }],
  ].map(([id, n, f, r, prop, l]) => ({ id: 'b-' + id, n, g: '밴드', f, r, prop, look: look(l) }));

  // ---- 2. 침착맨 variants ----
  const CHIM_BASE = { hairStyle: 'short', hair: '#2b2233', skin: '#f6d2b4' };
  const CHIM = [
    ['basic', '침착맨', '웹툰 작가 출신 스트리머. 오늘도 침착하게.', 1, null, { top: '#3a3f55' }],
    ['malnyeon', '이말년 (작가 버전)', "'이말년씨리즈'를 그리던 시절 버전. 펜 들고 마감 중.", 2, 'pen', { top: '#e9e1cf', acc: 'glasses' }],
    ['samguk', '침착맨 (삼국지 썰)', '삼국지 이야기를 시작하면 시간 순삭 주의.', 2, 'book', { top: '#7a2f2a' }],
    ['game', '침착맨 (게임 방송)', '패드를 잡으면 침착함 게이지가 흔들린다.', 1, 'pad', { top: '#5f7e85', hat: 'headphones', hatColor: '#2b2233' }],
    ['food', '침착맨 (야식 타임)', '야식 앞에서는 잠시 침착함을 내려놓음.', 1, 'chicken', { top: '#c09a4e' }],
    ['pajama', '침착맨 (잠옷)', '방송 끝. 이제 진짜 잘 시간.', 1, 'pillow', { top: '#a8c8e0', pants: '#a8c8e0', hat: 'beanie', hatColor: '#7cc6ff' }],
    ['suit', '침착맨 (정장)', '중요한 날 버전. 넥타이가 어색하다.', 2, null, { top: '#2b2233', pants: '#2b2233' }],
    ['coffee', '침착맨 (아지트 바)', '볼륨팀 아지트에서 핸드드립 한 잔.', 1, 'coffee', { top: '#8a6a4a', coat: false }],
    ['walk', '침착맨 (산책)', '생각 정리하러 동네 한 바퀴.', 1, null, { top: '#6f8a62', hat: 'cap', hatColor: '#3a3f55' }],
    ['gold', '황금 침착맨', '전설의 황금 에디션. 뽑으면 자랑 필수.', 3, 'crown', { top: '#d8b24a', pants: '#b8923a', hair: '#8a6a2a' }],
  ].map(([id, n, f, r, prop, l]) => ({ id: 'c-' + id, n, g: '침착맨', f, r, prop, look: look({ ...CHIM_BASE, ...l }) }));

  // ---- 3. girl groups, 4th & 5th generation (members) ----
  const GROUPS = [
    ['aespa', '4세대', '#9aa0b8', ['카리나', '윈터', '지젤', '닝닝']],
    ['IVE', '4세대', '#c0403a', ['안유진', '가을', '레이', '장원영', '리즈', '이서']],
    ['NewJeans', '4세대', '#7cc6ff', ['민지', '하니', '다니엘', '해린', '혜인']],
    ['LE SSERAFIM', '4세대', '#3a3f55', ['김채원', '사쿠라', '허윤진', '카즈하', '홍은채']],
    ['ITZY', '4세대', '#ff8fb3', ['예지', '리아', '류진', '채령', '유나']],
    ['ILLIT', '5세대', '#f2c4d8', ['윤아', '민주', '모카', '원희', '이로하']],
    ['BABYMONSTER', '5세대', '#2b2233', ['루카', '파리타', '아사', '아현', '라미', '로라', '치키타']],
  ];
  const IDOL = [];
  for (const [g, gen, color, members] of GROUPS) {
    for (const m of members) {
      const key = g + m;
      IDOL.push({
        id: 'i-' + key.replace(/\s/g, ''), n: m, g, f: `${g} 멤버 · ${gen} 걸그룹`, r: 1, prop: 'mic',
        look: look({ hairStyle: pick(['long', 'long', 'bob', 'twin', 'bun'], key), hair: pick(HAIR, key, 3), skin: pick(SKIN, key, 1),
          top: color, pants: pick(['#2b2233', '#e9e9f2', '#3a3f55', color], key, 2), acc: 'none',
          hat: pick(['none', 'none', 'none', 'ribbon'], key, 5), hatColor: pick(['#ff8fb3', '#e9e9f2', '#c0403a'], key) }),
      });
    }
  }

  NG.GACHA = {
    band: { key: 'band', n: '밴드 가챠', e: '🎸', color: '#9c4a3f', cost: 30, items: BANDS, desc: '국내외 전설의 밴드 피규어' },
    chim: { key: 'chim', n: '침착맨 가챠', e: '🍗', color: '#c09a4e', cost: 30, items: CHIM, desc: '여러 버전의 침착맨 피규어' },
    idol: { key: 'idol', n: '아이돌 가챠', e: '🎤', color: '#c77a96', cost: 30, items: IDOL, desc: '4·5세대 걸그룹 멤버 피규어 · 홀로그램 에디션 8%' },
  };
  NG.GACHA_RARITY = { 1: { n: '일반', c: '#8f9a7f', w: 70 }, 2: { n: '레어', c: '#5f7e9c', w: 24 }, 3: { n: '레전드', c: '#c0703a', w: 6 } };
  NG.HOLO_RATE = 0.08;
})();
