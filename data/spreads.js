/* data/spreads.js — spread layouts and consultation prompt bank.
 * Exposes window.TarotSpreads = { spreads, spreadById, prompts, categories }.
 * Each position: { key, label, hint, col, row, rotate?, z? } on a CSS grid of `cols` x `rows`.
 */
(function (global) {
  'use strict';

  var spreads = [
    {
      id: 'three',
      name: 'Three-Card',
      subtitle: 'Past / Present / Future',
      cols: 3,
      rows: 1,
      positions: [
        { key: 'past', label: 'Past', hint: 'What has led up to this situation', col: 1, row: 1 },
        { key: 'present', label: 'Present', hint: 'Where things stand right now', col: 2, row: 1 },
        { key: 'future', label: 'Future', hint: 'Where things are heading if nothing changes', col: 3, row: 1 }
      ]
    },
    {
      id: 'sonar',
      name: 'Heart Sonar',
      subtitle: '5-card romance spread',
      cols: 3,
      rows: 3,
      positions: [
        { key: 'you', label: 'Your Heart', hint: 'What you are feeling and bringing to the bond', col: 1, row: 2 },
        { key: 'them', label: 'Their Heart', hint: 'What the other person is feeling and bringing', col: 3, row: 2 },
        { key: 'echo', label: 'The Echo', hint: 'What passes between the two of you', col: 2, row: 2 },
        { key: 'depth', label: 'Hidden Depth', hint: 'What lies beneath the surface or is not being said', col: 2, row: 3 },
        { key: 'heading', label: 'Where It Heads', hint: 'The direction this connection is moving', col: 2, row: 1 }
      ]
    },
    {
      id: 'celtic',
      name: 'Celtic Cross',
      subtitle: '10-card classic layout',
      cols: 4,
      rows: 4,
      positions: [
        { key: 'present', label: '1 · Present', hint: 'The heart of the matter', col: 2, row: 2 },
        { key: 'challenge', label: '2 · Challenge', hint: 'What crosses or complicates it', col: 2, row: 2, rotate: 90, z: 2 },
        { key: 'foundation', label: '3 · Foundation', hint: 'The root or basis beneath the situation', col: 2, row: 3 },
        { key: 'past', label: '4 · Recent Past', hint: 'What is passing away', col: 1, row: 2 },
        { key: 'crown', label: '5 · Crown', hint: 'Your goal or best possible outcome', col: 2, row: 1 },
        { key: 'future', label: '6 · Near Future', hint: 'What is coming next', col: 3, row: 2 },
        { key: 'self', label: '7 · Self', hint: 'Your attitude and approach', col: 4, row: 4 },
        { key: 'environment', label: '8 · Environment', hint: 'Outside influences and other people', col: 4, row: 3 },
        { key: 'hopes', label: '9 · Hopes & Fears', hint: 'What you hope for and dread', col: 4, row: 2 },
        { key: 'outcome', label: '10 · Outcome', hint: 'Where the path leads', col: 4, row: 1 }
      ]
    }
  ];

  var spreadById = {};
  spreads.forEach(function (s) { spreadById[s.id] = s; });

  var categories = [
    { id: 'romance', label: 'Romance' },
    { id: 'career', label: 'Career' },
    { id: 'growth', label: 'Personal Growth' }
  ];

  var prompts = {
    romance: [
      'My client is unsure whether the person they are dating is serious about them. What should they know?',
      'A couple keeps arguing about the same issue. What is really going on between them?',
      'My client recently ended a relationship. How can they heal and what is next for their love life?',
      'Should my client tell a close friend that they have feelings for them?',
      'What does my client need to understand about what they want in a partner?'
    ],
    career: [
      'My client has a job offer in a new city. Should they take it?',
      'A client feels stuck in their current role. What is blocking their progress?',
      'My client is thinking of starting their own business. What should they consider?',
      'How can my client improve a tense relationship with their manager?',
      'What is the best way for my client to approach their next year of work?'
    ],
    growth: [
      'My client feels uninspired and does not know why. What do they need to see?',
      'What habit or belief is holding my client back right now?',
      'How can my client rebuild their confidence after a setback?',
      'My client is entering a big life transition. How can they prepare?',
      'What lesson is my client being asked to learn in this season of their life?'
    ]
  };

  // Japanese text, keyed by spread id / position key / category id. Layout stays in the base data above.
  var ja = {
    spreads: {
      three: {
        name: 'スリーカード', subtitle: '過去 / 現在 / 未来',
        positions: {
          past: ['過去', '今の状況に至るまでの流れ'],
          present: ['現在', '今、物事がどこにあるか'],
          future: ['未来', '何も変えなければ、どこへ向かうか']
        }
      },
      sonar: {
        name: 'ハートソナー', subtitle: '5枚の恋愛スプレッド',
        positions: {
          you: ['あなたの心', 'あなたが感じていること、関係に持ち込んでいるもの'],
          them: ['相手の心', '相手が感じていること、関係に持ち込んでいるもの'],
          echo: ['響き', 'ふたりの間で行き交うもの'],
          depth: ['隠れた深層', '表面の下にあるもの、言葉にされていないこと'],
          heading: ['行方', 'このつながりが向かう方向']
        }
      },
      celtic: {
        name: 'ケルト十字', subtitle: '10枚の定番スプレッド',
        positions: {
          present: ['1 · 現在', '問題の核心'],
          challenge: ['2 · 障害', '状況を横切り、複雑にするもの'],
          foundation: ['3 · 土台', '状況の根っこにあるもの'],
          past: ['4 · 近い過去', '過ぎ去りつつあるもの'],
          crown: ['5 · 目標', 'あなたの目指すもの、最善の結末'],
          future: ['6 · 近い未来', 'これから起こること'],
          self: ['7 · 自分', 'あなたの姿勢とアプローチ'],
          environment: ['8 · 周囲', '外からの影響や周りの人'],
          hopes: ['9 · 希望と恐れ', '望んでいること、恐れていること'],
          outcome: ['10 · 結果', '道の行き着く先']
        }
      }
    },
    categories: { romance: '恋愛', career: '仕事', growth: '自己成長' },
    prompts: {
      romance: [
        'クライアントは、付き合っている相手が自分に本気かどうか分からずにいます。何を知っておくべきでしょうか？',
        'あるカップルが同じことで何度も口論しています。ふたりの間で本当は何が起きているのでしょうか？',
        'クライアントは最近、恋人と別れました。どう癒やし、恋愛面は次にどう進むでしょうか？',
        'クライアントは親しい友人への好意を、伝えるべきでしょうか？',
        'クライアントがパートナーに求めるものについて、理解しておくべきことは何でしょうか？'
      ],
      career: [
        'クライアントは別の街での仕事の誘いを受けています。受けるべきでしょうか？',
        'クライアントは今の役割で行き詰まりを感じています。何が進歩を妨げているのでしょうか？',
        'クライアントは独立を考えています。何を考慮すべきでしょうか？',
        'クライアントは上司との張りつめた関係をどう改善できるでしょうか？',
        'クライアントは今後一年の仕事にどう向き合うのがよいでしょうか？'
      ],
      growth: [
        'クライアントは理由もなく意欲がわきません。何に気づく必要があるでしょうか？',
        '今、クライアントの足を引っ張っている習慣や思い込みは何でしょうか？',
        'つまずきのあと、クライアントはどう自信を取り戻せるでしょうか？',
        'クライアントは人生の大きな転機を迎えます。どう備えればよいでしょうか？',
        '今の人生の季節に、クライアントが学ぶよう求められている教訓は何でしょうか？'
      ]
    }
  };

  global.TarotSpreads = { spreads: spreads, spreadById: spreadById, prompts: prompts, categories: categories, ja: ja };
})(typeof window !== 'undefined' ? window : globalThis);
