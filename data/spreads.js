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

  global.TarotSpreads = { spreads: spreads, spreadById: spreadById, prompts: prompts, categories: categories };
})(typeof window !== 'undefined' ? window : globalThis);
