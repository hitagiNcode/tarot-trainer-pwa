/* app.js — UI state, SVG card renderer, quiz logic, spreads, journal and JSON backup.
 * Data lives in data/*.js and coaching logic in engine.js; this file only renders and stores.
 */
(function () {
  'use strict';

  var D = window.TarotData;
  var SP = window.TarotSpreads;
  var Coach = window.CoachEngine;
  var CARDS = D.cards;

  var KEYS = {
    quiz: 'arcana.quiz.v1',
    journal: 'arcana.journal.v1',
    session: 'arcana.session.v1',
    tab: 'arcana.tab.v1'
  };

  /* ---------- storage ---------- */
  function load(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { toast('Could not save: storage is full or blocked.'); return false; }
  }

  var quiz = load(KEYS.quiz, null) || { stats: {}, streak: 0, best: 0 };
  var journal = load(KEYS.journal, []);
  var session = load(KEYS.session, null) || {
    spreadId: 'three', category: 'romance', prompt: '', custom: '', reversals: true, dealt: null, text: '', feedback: null
  };

  /* ---------- helpers ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? '' : v);
      });
    }
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rnd(n) {
    var a = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return a[0] % n;
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function stars(n) { return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function cardLabel(card, reversed) { return card.name + (reversed ? ' (reversed)' : ''); }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
    catch (e) { return iso; }
  }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- bottom sheet ---------- */
  var sheet = document.getElementById('sheet');
  var sheetBody = document.getElementById('sheetBody');
  var lastFocus = null;
  function openSheet(title, node) {
    lastFocus = document.activeElement;
    document.getElementById('sheetTitle').textContent = title;
    sheetBody.replaceChildren(node);
    sheet.hidden = false;
    document.body.classList.add('no-scroll');
    sheetBody.scrollTop = 0;
    sheet.querySelector('.icon-btn').focus();
  }
  function closeSheet() {
    sheet.hidden = true;
    document.body.classList.remove('no-scroll');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  sheet.addEventListener('click', function (e) { if (e.target.hasAttribute('data-close')) closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });

  /* ---------- SVG card renderer ---------- */
  var COLORS = { wands: '#f08a4b', cups: '#5bb4f0', swords: '#c3cfe6', pentacles: '#7cc67a', major: '#e6c36a' };
  var PIPS = {
    1: [[100, 172]],
    2: [[100, 105], [100, 239]],
    3: [[100, 98], [100, 172], [100, 246]],
    4: [[68, 112], [132, 112], [68, 232], [132, 232]],
    5: [[68, 112], [132, 112], [100, 172], [68, 232], [132, 232]],
    6: [[68, 100], [132, 100], [68, 172], [132, 172], [68, 244], [132, 244]],
    7: [[68, 100], [132, 100], [100, 136], [68, 172], [132, 172], [68, 244], [132, 244]],
    8: [[68, 100], [132, 100], [100, 136], [68, 172], [132, 172], [100, 208], [68, 244], [132, 244]],
    9: [[68, 95], [132, 95], [68, 145], [132, 145], [100, 172], [68, 199], [132, 199], [68, 249], [132, 249]],
    10: [[68, 92], [132, 92], [100, 120], [68, 148], [132, 148], [68, 200], [132, 200], [100, 224], [68, 252], [132, 252]]
  };
  var CROWNS = {
    11: 'M100 84 L118 104 L100 124 L82 104 Z',
    12: 'M66 112 L100 88 L134 112 M66 128 L100 104 L134 128',
    13: 'M70 124 L76 90 L100 112 L124 90 L130 124 Z',
    14: 'M62 126 L66 88 L84 108 L100 82 L116 108 L134 88 L138 126 Z'
  };

  function cardSVG(card, reversed) {
    var major = card.arcana === 'major';
    var col = COLORS[major ? 'major' : card.suit];
    var top = major ? card.numeral : (card.number === 1 ? 'ACE' : card.number <= 10 ? String(card.number) : card.rankName.toUpperCase());
    var name = card.name.toUpperCase();
    var s = '<svg class="card-svg' + (reversed ? ' reversed' : '') + '" viewBox="0 0 200 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(cardLabel(card, reversed)) + '">';
    s += '<rect x="3" y="3" width="194" height="334" rx="14" fill="#1b1538" stroke="' + col + '" stroke-width="3"/>';
    s += '<rect x="11" y="11" width="178" height="318" rx="9" fill="none" stroke="' + col + '" stroke-opacity=".45" stroke-width="1"/>';
    // faint stars
    for (var i = 0; i < 14; i++) {
      var sx = 20 + ((i * 53) % 160), sy = 50 + ((i * 97) % 240);
      s += '<circle cx="' + sx + '" cy="' + sy + '" r="' + (i % 3 === 0 ? 1.6 : 1) + '" fill="' + col + '" fill-opacity=".25"/>';
    }
    s += '<text x="100" y="44" text-anchor="middle" font-size="22" font-weight="700" fill="' + col + '" font-family="Georgia,serif" letter-spacing="2">' + esc(top) + '</text>';
    s += '<line x1="40" y1="54" x2="160" y2="54" stroke="' + col + '" stroke-opacity=".5"/>';

    if (major) {
      s += '<circle cx="100" cy="172" r="66" fill="none" stroke="' + col + '" stroke-width="2"/>';
      s += '<circle cx="100" cy="172" r="56" fill="none" stroke="' + col + '" stroke-opacity=".6" stroke-dasharray="3 5"/>';
      for (var k = 0; k < 12; k++) {
        var a = k * Math.PI / 6;
        s += '<line x1="' + (100 + 66 * Math.cos(a)).toFixed(1) + '" y1="' + (172 + 66 * Math.sin(a)).toFixed(1) + '" x2="' + (100 + 78 * Math.cos(a)).toFixed(1) + '" y2="' + (172 + 78 * Math.sin(a)).toFixed(1) + '" stroke="' + col + '" stroke-opacity=".7"/>';
      }
      s += '<text x="100" y="196" text-anchor="middle" font-size="64" fill="' + col + '" font-family="Georgia,\'Segoe UI Symbol\',\'Apple Symbols\',serif">' + esc(card.glyph) + '\uFE0E</text>';
    } else {
      var pips = card.number <= 10 ? PIPS[card.number] : [[100, 212]];
      var size = card.number === 1 ? 74 : card.number > 10 ? 88 : 30;
      if (card.number > 10) {
        s += '<path d="' + CROWNS[card.number] + '" fill="' + (card.number >= 13 ? col : 'none') + '" fill-opacity=".85" stroke="' + col + '" stroke-width="3" stroke-linejoin="round"/>';
      }
      pips.forEach(function (p) {
        s += '<use href="#pip-' + card.suit + '" x="' + (p[0] - size / 2) + '" y="' + (p[1] - size / 2) + '" width="' + size + '" height="' + size + '" style="color:' + col + '"/>';
      });
    }
    s += '<line x1="40" y1="286" x2="160" y2="286" stroke="' + col + '" stroke-opacity=".5"/>';
    s += '<text x="100" y="312" text-anchor="middle" font-size="' + (name.length > 17 ? 12 : 14) + '" font-weight="600" fill="#efeaff" font-family="Georgia,serif" letter-spacing="1">' + esc(name) + '</text>';
    s += '</svg>';
    return s;
  }
  function cardNode(card, reversed) {
    var d = document.createElement('div');
    d.innerHTML = cardSVG(card, reversed); // generated from local data only
    return d.firstChild;
  }

  /* ---------- card detail sheet ---------- */
  function kwList(list, rev) {
    return el('div', { class: 'kw' + (rev ? ' rev' : '') }, list.map(function (k) { return el('span', { text: k }); }));
  }
  function showCardDetail(card, opts) {
    opts = opts || {};
    var reversed = !!opts.reversed;
    var body = el('div');
    if (opts.position) {
      body.appendChild(el('div', { class: 'card-panel' }, [
        el('span', { class: 'tag', text: opts.position.label }),
        el('p', { class: 'small muted', text: opts.position.hint })
      ]));
    }
    var top = el('div', { class: 'detail-top' }, [
      el('div', {}, [cardNode(card, reversed)]),
      el('div', {}, [
        el('span', { class: 'tag', text: (card.arcana === 'major' ? 'Major Arcana' : D.suits[card.suit].name) + ' · ' + card.element }),
        el('h3', { text: cardLabel(card, reversed) })
      ])
    ]);
    var info = top.lastChild;
    if (opts.compact) {
      info.appendChild(el('div', { class: 'tag', text: reversed ? 'Reversed' : 'Upright' }));
      info.appendChild(kwList(reversed ? card.revKeywords : card.upKeywords, reversed));
      info.appendChild(el('p', { text: reversed ? card.rev : card.up }));
      body.appendChild(top);
    } else {
      info.appendChild(el('p', { class: 'small muted', text: card.symbolism }));
      body.appendChild(top);
      body.appendChild(el('h3', { text: 'Upright' }));
      body.appendChild(kwList(card.upKeywords, false));
      body.appendChild(el('p', { text: card.up }));
      body.appendChild(el('h3', { text: 'Reversed' }));
      body.appendChild(kwList(card.revKeywords, true));
      body.appendChild(el('p', { text: card.rev }));
    }
    openSheet(card.name, body);
  }

  /* ---------- views ---------- */
  var view = document.getElementById('view');
  var tabs = ['guide', 'quiz', 'expand', 'journal'];
  var currentTab = load(KEYS.tab, 'guide');
  if (tabs.indexOf(currentTab) < 0) currentTab = 'guide';

  function go(tab) {
    currentTab = tab;
    save(KEYS.tab, tab);
    document.querySelectorAll('.tab').forEach(function (b) {
      if (b.getAttribute('data-tab') === tab) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    render();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { go(b.getAttribute('data-tab')); });
  });

  function render() {
    view.replaceChildren();
    if (currentTab === 'guide') renderGuide(view);
    else if (currentTab === 'quiz') renderQuiz(view);
    else if (currentTab === 'expand') renderExpand(view);
    else renderJournal(view);
  }

  /* ===== Guide ===== */
  var guide = { filter: 'all', q: '' };
  var FILTERS = [['all', 'All 78'], ['major', 'Major'], ['wands', 'Wands'], ['cups', 'Cups'], ['swords', 'Swords'], ['pentacles', 'Pentacles'], ['basics', 'Basics']];

  function renderGuide(root) {
    var list = el('div');
    var chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Filter cards' });
    var search = el('input', {
      type: 'search', placeholder: 'Search name, keyword or meaning…', 'aria-label': 'Search cards', value: guide.q,
      oninput: function (e) { guide.q = e.target.value; fillList(); }
    });
    search.value = guide.q;
    var searchWrap = el('div', { class: 'card-panel' }, [search]);

    function drawChips() {
      chips.replaceChildren();
      FILTERS.forEach(function (f) {
        chips.appendChild(el('button', {
          type: 'button', class: 'chip', 'aria-pressed': String(guide.filter === f[0]), text: f[1],
          onclick: function () { guide.filter = f[0]; drawChips(); fillList(); }
        }));
      });
    }
    function fillList() {
      list.replaceChildren();
      searchWrap.classList.toggle('hidden', guide.filter === 'basics');
      if (guide.filter === 'basics') { list.appendChild(primer()); return; }
      var q = guide.q.trim().toLowerCase();
      var items = CARDS.filter(function (c) {
        if (guide.filter === 'major' && c.arcana !== 'major') return false;
        if (['wands', 'cups', 'swords', 'pentacles'].indexOf(guide.filter) >= 0 && c.suit !== guide.filter) return false;
        if (!q) return true;
        var hay = [c.name, c.element, c.up, c.rev, c.upKeywords.join(' '), c.revKeywords.join(' ')].join(' ').toLowerCase();
        return hay.indexOf(q) >= 0;
      });
      if (!items.length) { list.appendChild(el('p', { class: 'muted', text: 'No cards match that search.' })); return; }
      var grid = el('div', { class: 'grid' });
      items.forEach(function (c) {
        grid.appendChild(el('button', {
          type: 'button', class: 'grid-item', 'aria-label': c.name,
          onclick: function () { showCardDetail(c, {}); }
        }, [cardNode(c, false), el('span', { class: 'name', text: c.short })]));
      });
      list.appendChild(grid);
    }
    root.appendChild(el('h2', { text: 'Card Guide' }));
    root.appendChild(chips);
    root.appendChild(searchWrap);
    root.appendChild(list);
    drawChips();
    fillList();
  }

  function primer() {
    function block(title, paras) {
      return el('div', { class: 'card-panel' }, [el('h3', { text: title })].concat(paras.map(function (p) { return el('p', { text: p }); })));
    }
    return el('div', {}, [
      block('The structure of the deck', [
        'A tarot deck has 78 cards in two groups. The 22 Major Arcana (The Fool to The World) show big life themes and turning points. The 56 Minor Arcana describe everyday events, split into four suits of 14 cards each.',
        'Each suit runs Ace to Ten (the story of a situation from seed to completion), then Page, Knight, Queen and King (people, personalities or ways of acting).'
      ]),
      block('Suits and elements', [
        'Wands (Fire): passion, ambition, action and creativity.',
        'Cups (Water): emotions, relationships, intuition and imagination.',
        'Swords (Air): thoughts, communication, truth and conflict.',
        'Pentacles (Earth): work, money, health and the physical world.'
      ]),
      block('Numbers', [
        'Aces start things. Twos balance or choose. Threes grow. Fours stabilize. Fives disrupt. Sixes harmonize. Sevens test. Eights move or master. Nines near completion. Tens complete, sometimes with a burden.'
      ]),
      block('Reading reversals', [
        'A reversed card is often read as the same energy blocked, delayed, internalized or overdone. Some readers also treat it as the opposite meaning. Pick one approach and use it consistently. This app lists a separate reversed meaning for each card.'
      ]),
      block('Reading tips', [
        'Read the position first, then the card. Look at the whole spread before the individual cards: which suit dominates, how many Majors appear, how many are reversed and which numbers repeat. Finish with a clear answer to the question.'
      ])
    ]);
  }

  /* ===== Quiz ===== */
  var qState = null;
  var lastQuizId = null;

  function pickQuizCard() {
    var total = 0;
    var weights = CARDS.map(function (c) {
      if (c.id === lastQuizId) return 0;
      var st = quiz.stats[c.id];
      var w = (!st || !st.seen) ? 3 : 1 + 4 * ((st.seen - st.correct) / st.seen);
      total += w;
      return w;
    });
    var r = Math.random() * total;
    for (var i = 0; i < CARDS.length; i++) {
      r -= weights[i];
      if (r <= 0 && weights[i] > 0) return CARDS[i];
    }
    return CARDS[0];
  }
  function newQuestion() {
    var card = pickQuizCard();
    lastQuizId = card.id;
    var reversed = rnd(2) === 1;
    var pool = CARDS.filter(function (c) { return c.id !== card.id && c.arcana === card.arcana; });
    if (pool.length < 3) pool = CARDS.filter(function (c) { return c.id !== card.id; });
    var decoys = shuffle(pool).slice(0, 3);
    var options = shuffle([card].concat(decoys)).map(function (c) {
      return { id: c.id, text: reversed ? c.rev : c.up };
    });
    qState = { cardId: card.id, reversed: reversed, options: options, picked: null };
  }
  function answerQuiz(optId) {
    if (qState.picked) return;
    qState.picked = optId;
    var ok = optId === qState.cardId;
    var st = quiz.stats[qState.cardId] || { seen: 0, correct: 0 };
    st.seen += 1; if (ok) st.correct += 1;
    quiz.stats[qState.cardId] = st;
    quiz.streak = ok ? quiz.streak + 1 : 0;
    quiz.best = Math.max(quiz.best, quiz.streak);
    save(KEYS.quiz, quiz);
    render();
  }
  function quizTotals() {
    var seen = 0, correct = 0, tracked = 0;
    Object.keys(quiz.stats).forEach(function (id) {
      var s = quiz.stats[id]; seen += s.seen; correct += s.correct; if (s.seen) tracked++;
    });
    return { seen: seen, correct: correct, tracked: tracked };
  }

  function renderQuiz(root) {
    if (!qState) newQuestion();
    var card = D.byId[qState.cardId];
    var t = quizTotals();
    root.appendChild(el('h2', { text: 'Recall Quiz' }));
    root.appendChild(el('div', { class: 'card-panel stat-row' }, [
      el('div', { class: 'stat' }, [el('b', { text: t.seen ? Math.round(100 * t.correct / t.seen) + '%' : '–' }), el('span', { class: 'small muted', text: 'accuracy' })]),
      el('div', { class: 'stat' }, [el('b', { text: String(quiz.streak) }), el('span', { class: 'small muted', text: 'streak (best ' + quiz.best + ')' })]),
      el('div', { class: 'stat' }, [el('b', { text: t.tracked + '/78' }), el('span', { class: 'small muted', text: 'cards tried' })])
    ]));

    var panel = el('div', { class: 'card-panel' });
    var wrap = el('div', { class: 'quiz-card' }, [cardNode(card, qState.reversed)]);
    panel.appendChild(wrap);
    panel.appendChild(el('p', {
      class: 'small', style: 'text-align:center',
      text: 'Which meaning fits this card ' + (qState.reversed ? 'REVERSED (upside-down)' : 'UPRIGHT') + '?'
    }));
    var opts = el('div', { class: 'options' });
    qState.options.forEach(function (o) {
      var cls = 'option';
      if (qState.picked) {
        if (o.id === qState.cardId) cls += ' correct';
        else if (o.id === qState.picked) cls += ' wrong';
      }
      opts.appendChild(el('button', {
        type: 'button', class: cls, disabled: !!qState.picked, text: o.text,
        onclick: function () { answerQuiz(o.id); }
      }));
    });
    panel.appendChild(opts);

    if (qState.picked) {
      var ok = qState.picked === qState.cardId;
      panel.appendChild(el('div', { class: 'verdict ' + (ok ? 'ok' : 'ng'), 'aria-label': ok ? 'Correct' : 'Incorrect', text: ok ? '○' : '×' }));
      panel.appendChild(el('p', { style: 'text-align:center' }, [
        el('b', { text: cardLabel(card, qState.reversed) }),
        el('br'),
        el('span', { class: 'small muted', text: (qState.reversed ? card.revKeywords : card.upKeywords).join(' · ') })
      ]));
      panel.appendChild(el('div', { class: 'row' }, [
        el('button', { type: 'button', class: 'btn block', text: 'Next card', onclick: function () { newQuestion(); render(); window.scrollTo(0, 0); } })
      ]));
    }
    root.appendChild(panel);

    // review list
    var weak = Object.keys(quiz.stats).map(function (id) {
      var s = quiz.stats[id]; return { id: id, miss: s.seen - s.correct, seen: s.seen };
    }).filter(function (x) { return x.miss > 0; }).sort(function (a, b) { return b.miss - a.miss; }).slice(0, 5);
    if (weak.length) {
      var wp = el('div', { class: 'card-panel' }, [el('h3', { text: 'Cards to review' })]);
      weak.forEach(function (w) {
        var c = D.byId[w.id];
        wp.appendChild(el('button', {
          type: 'button', class: 'chip', style: 'margin:0 8px 8px 0', text: c.short + ' · missed ' + w.miss + '/' + w.seen,
          onclick: function () { showCardDetail(c, {}); }
        }));
      });
      root.appendChild(wp);
    }
    root.appendChild(el('button', {
      type: 'button', class: 'btn ghost btn-small', text: 'Reset quiz progress',
      onclick: function () {
        if (confirm('Reset all quiz progress on this device?')) {
          quiz = { stats: {}, streak: 0, best: 0 }; save(KEYS.quiz, quiz); qState = null; render();
        }
      }
    }));
  }

  /* ===== Expand (spreads + coach) ===== */
  function saveSession() { save(KEYS.session, session); }
  function pickPrompt() {
    var list = SP.prompts[session.category] || [];
    if (!list.length) return '';
    var next;
    do { next = list[rnd(list.length)]; } while (list.length > 1 && next === session.prompt);
    return next;
  }
  function currentQuestion() { return (session.custom || '').trim() || session.prompt; }

  function dealSpread() {
    var spread = SP.spreadById[session.spreadId];
    if (session.dealt && (session.text || '').trim() &&
      !confirm('Dealing new cards will clear your current reading draft. Continue?')) return;
    var deck = shuffle(CARDS.map(function (c) { return c.id; }));
    session.dealt = {
      spreadId: spread.id,
      question: currentQuestion(),
      cards: spread.positions.map(function (p, i) { return { id: deck[i], reversed: session.reversals ? rnd(2) === 1 : false }; })
    };
    session.text = '';
    session.feedback = null;
    saveSession();
    render();
  }

  function renderExpand(root) {
    if (!session.prompt) { session.prompt = pickPrompt(); saveSession(); }
    var spread = SP.spreadById[session.spreadId];
    root.appendChild(el('h2', { text: 'Practice a Spread' }));

    // Setup
    var setup = el('div', { class: 'card-panel stack' });
    setup.appendChild(el('div', { class: 'tag', text: '1 · Spread' }));
    var sc = el('div', { class: 'chips', role: 'group', 'aria-label': 'Spread' });
    SP.spreads.forEach(function (s) {
      sc.appendChild(el('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(s.id === session.spreadId), text: s.name + ' (' + s.positions.length + ')',
        onclick: function () { session.spreadId = s.id; saveSession(); render(); }
      }));
    });
    setup.appendChild(sc);
    setup.appendChild(el('p', { class: 'small muted', text: spread.subtitle }));

    setup.appendChild(el('div', { class: 'tag', text: '2 · Consultation' }));
    var cc = el('div', { class: 'chips', role: 'group', 'aria-label': 'Prompt category' });
    SP.categories.forEach(function (c) {
      cc.appendChild(el('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(c.id === session.category), text: c.label,
        onclick: function () { session.category = c.id; session.prompt = pickPrompt(); saveSession(); render(); }
      }));
    });
    setup.appendChild(cc);
    setup.appendChild(el('p', { text: '“' + session.prompt + '”' }));
    setup.appendChild(el('button', {
      type: 'button', class: 'btn ghost btn-small', text: '↻ Another prompt',
      onclick: function () { session.prompt = pickPrompt(); saveSession(); render(); }
    }));
    var custom = el('input', {
      type: 'text', placeholder: 'Or type your own question (optional)', 'aria-label': 'Your own question', maxlength: '200',
      oninput: function (e) { session.custom = e.target.value; saveSession(); }
    });
    custom.value = session.custom || '';
    setup.appendChild(custom);
    var rv = el('input', { type: 'checkbox', id: 'rv', onchange: function (e) { session.reversals = e.target.checked; saveSession(); } });
    rv.checked = !!session.reversals;
    setup.appendChild(el('label', { class: 'check', for: 'rv' }, [rv, el('span', { text: 'Include reversed cards' })]));
    setup.appendChild(el('button', { type: 'button', class: 'btn gold block', text: session.dealt ? '🔀 Shuffle & deal again' : '🔀 Shuffle & deal', onclick: dealSpread }));
    root.appendChild(setup);

    if (!session.dealt) {
      root.appendChild(el('p', { class: 'muted small', text: 'Deal a spread, write your own interpretation, then ask the coach for structured feedback. Everything runs on your device.' }));
      return;
    }

    var d = session.dealt;
    var dSpread = SP.spreadById[d.spreadId];
    var panel = el('div', { class: 'card-panel' });
    panel.appendChild(el('span', { class: 'tag', text: dSpread.name }));
    panel.appendChild(el('p', { text: d.question ? '“' + d.question + '”' : '(no question set)' }));
    panel.appendChild(spreadGrid(dSpread, d.cards));
    panel.appendChild(el('p', { class: 'small muted', text: 'Tap a card to peek at its keywords.' }));
    var legend = el('ol', { class: 'legend' });
    dSpread.positions.forEach(function (p, i) {
      var c = D.byId[d.cards[i].id];
      legend.appendChild(el('li', {}, [
        el('b', { text: p.label + ': ' }), cardLabel(c, d.cards[i].reversed),
        el('div', { class: 'small muted', text: p.hint })
      ]));
    });
    panel.appendChild(legend);
    root.appendChild(panel);

    // Reading
    var rp = el('div', { class: 'card-panel stack' });
    rp.appendChild(el('h3', { text: 'Your reading' }));
    var ta = el('textarea', {
      placeholder: 'Write your interpretation: mention each card and what its position means, connect them into one answer to the question, and finish with advice.',
      'aria-label': 'Your reading',
      oninput: function (e) { session.text = e.target.value; saveSession(); }
    });
    ta.value = session.text || '';
    rp.appendChild(ta);
    rp.appendChild(el('div', { class: 'row' }, [
      el('button', { type: 'button', class: 'btn', text: '🧠 Get coach feedback', onclick: runCoach }),
      el('button', { type: 'button', class: 'btn ghost', text: 'Save to journal', onclick: saveToJournal })
    ]));
    root.appendChild(rp);

    if (session.feedback) root.appendChild(feedbackPanel(session.feedback));
  }

  function spreadGrid(spread, cards) {
    var grid = el('div', { class: 'spread', style: 'grid-template-columns: repeat(' + spread.cols + ', 1fr)' });
    var celtic = spread.id === 'celtic';
    spread.positions.forEach(function (p, i) {
      var c = D.byId[cards[i].id];
      var cell = el('div', {
        class: 'spread-cell' + (p.rotate ? ' crossing' : ''),
        style: 'grid-column:' + p.col + ';grid-row:' + p.row + (p.rotate ? ';z-index:2' : '')
      });
      var btn = el('button', {
        type: 'button', class: 'spread-card', 'aria-label': p.label + ': ' + cardLabel(c, cards[i].reversed),
        onclick: function () { showCardDetail(c, { reversed: cards[i].reversed, position: p, compact: true }); }
      }, [cardNode(c, cards[i].reversed), el('span', { class: 'badge', text: String(i + 1) })]);
      cell.appendChild(btn);
      if (!celtic) cell.appendChild(el('span', { class: 'cell-label', text: p.label }));
      grid.appendChild(cell);
    });
    return grid;
  }

  function runCoach() {
    var d = session.dealt;
    if (!d) return;
    var result = Coach.evaluateReading({
      spread: SP.spreadById[d.spreadId], cards: d.cards, question: d.question, text: session.text || ''
    });
    session.feedback = result;
    saveSession();
    render();
    var fb = view.querySelector('[data-feedback]');
    if (fb) fb.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function feedbackPanel(fb) {
    var p = el('div', { class: 'card-panel', 'data-feedback': '1' });
    p.appendChild(el('h3', { text: 'Coach feedback' }));
    if (fb.tooShort) {
      p.appendChild(el('p', { text: 'Write a little more first: a sentence or two per card gives the coach something to work with.' }));
    } else {
      p.appendChild(el('div', { class: 'row between' }, [
        el('span', { class: 'stars', text: stars(fb.overall.stars), 'aria-label': fb.overall.stars + ' out of 5 overall' }),
        el('span', { class: 'muted small', text: 'Overall ' + fb.overall.score + '/100' })
      ]));
      fb.criteria.forEach(function (c, i) {
        var box = el('div', { class: 'crit' }, [
          el('div', { class: 'row between' }, [el('b', { text: (i + 1) + '. ' + c.title }), el('span', { class: 'stars', text: stars(c.stars) })]),
          el('div', { class: 'meter' }, [el('i', { style: 'width:' + c.score + '%' })]),
          el('p', { class: 'small muted', text: c.summary })
        ]);
        var ul = el('ul');
        c.points.forEach(function (pt) { ul.appendChild(el('li', { class: pt.type, text: pt.text })); });
        box.appendChild(ul);
        p.appendChild(box);
      });
    }
    if (fb.patterns && fb.patterns.length && fb.tooShort) {
      p.appendChild(el('p', { class: 'small muted', text: 'Hint: this spread has patterns worth noticing: ' + fb.patterns.map(function (x) { return x.title; }).join('; ') + '.' }));
    }
    p.appendChild(el('p', { class: 'small muted', text: 'Rule-based coach (' + fb.engine + ') running offline on your device. Treat it as a study aid, not an oracle.' }));
    return p;
  }

  function saveToJournal() {
    var d = session.dealt;
    if (!d) return;
    if (!(session.text || '').trim()) { toast('Write your reading first.'); return; }
    journal.unshift({
      id: Date.now().toString(36) + rnd(1e6).toString(36),
      date: new Date().toISOString(),
      spreadId: d.spreadId,
      question: d.question,
      cards: d.cards,
      text: session.text,
      feedback: session.feedback
    });
    if (save(KEYS.journal, journal)) toast('Saved to your journal.');
  }

  /* ===== Journal & backup ===== */
  function renderJournal(root) {
    root.appendChild(el('h2', { text: 'Reading Journal' }));
    if (!journal.length) {
      root.appendChild(el('p', { class: 'muted', text: 'No saved readings yet. Deal a spread in Expand, write your reading and tap “Save to journal”.' }));
    }
    journal.forEach(function (e) {
      var spread = SP.spreadById[e.spreadId] || { name: e.spreadId, positions: [] };
      var det = el('details', { class: 'entry' });
      det.appendChild(el('summary', {}, [
        el('b', { text: spread.name }), el('span', { class: 'small muted', text: ' · ' + fmtDate(e.date) }),
        el('div', { class: 'small', text: e.question || '(no question)' })
      ]));
      var body = el('div', { class: 'body stack' });
      var mini = el('div', { class: 'mini-cards' });
      e.cards.forEach(function (c, i) {
        var card = D.byId[c.id]; if (!card) return;
        var pos = spread.positions[i];
        mini.appendChild(el('div', {}, [cardNode(card, c.reversed), el('div', { text: pos ? pos.label.replace(/^\d+\s*·\s*/, '') : '' })]));
      });
      body.appendChild(mini);
      body.appendChild(el('div', { class: 'reading-text', text: e.text }));
      if (e.feedback && e.feedback.criteria && e.feedback.criteria.length) {
        body.appendChild(el('div', { class: 'small' }, [
          el('span', { class: 'stars', text: stars(e.feedback.overall.stars) }),
          ' ' + e.feedback.criteria.map(function (c) { return c.title.replace(' Perspective', '').replace('Professional Reader’s', 'Pro') + ' ' + stars(c.stars); }).join(' · ')
        ]));
      }
      body.appendChild(el('button', {
        type: 'button', class: 'btn danger btn-small', text: 'Delete entry',
        onclick: function () {
          if (!confirm('Delete this journal entry?')) return;
          journal = journal.filter(function (x) { return x.id !== e.id; }); save(KEYS.journal, journal); render();
        }
      }));
      det.appendChild(body);
      root.appendChild(det);
    });

    var bk = el('div', { class: 'card-panel stack' }, [
      el('h3', { text: 'Backup & transfer' }),
      el('p', { class: 'small muted', text: 'Your quiz progress and journal live only on this device. Export a .json file to move them to another device or keep a copy.' }),
      el('button', { type: 'button', class: 'btn block', text: '⬇ Export Backup (.json)', onclick: exportBackup }),
      el('button', { type: 'button', class: 'btn ghost block', text: '⬆ Import Backup (.json)', onclick: function () { document.getElementById('importFile').click(); } })
    ]);
    root.appendChild(bk);
  }

  var importInput = el('input', { type: 'file', id: 'importFile', accept: '.json,application/json', class: 'hidden' });
  document.body.appendChild(importInput);
  importInput.addEventListener('change', function () {
    var f = importInput.files && importInput.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () { importBackup(String(r.result)); importInput.value = ''; };
    r.onerror = function () { toast('Could not read that file.'); };
    r.readAsText(f);
  });

  function exportBackup() {
    var data = { app: 'arcana-coach', version: 1, exportedAt: new Date().toISOString(), quiz: quiz, journal: journal };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var d = new Date();
    a.href = url;
    a.download = 'arcana-coach-backup-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('Backup exported.');
  }

  function importBackup(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { toast('That file is not valid JSON.'); return; }
    if (!data || data.app !== 'arcana-coach' || typeof data.quiz !== 'object' || !Array.isArray(data.journal)) {
      toast('That does not look like an Arcana Coach backup.'); return;
    }
    // merge quiz stats (keep the entry with more attempts)
    var stats = data.quiz && data.quiz.stats ? data.quiz.stats : {};
    Object.keys(stats).forEach(function (id) {
      if (!D.byId[id]) return;
      var s = stats[id];
      if (!s || typeof s.seen !== 'number' || typeof s.correct !== 'number') return;
      var mine = quiz.stats[id];
      if (!mine || s.seen > mine.seen) quiz.stats[id] = { seen: s.seen, correct: Math.min(s.correct, s.seen) };
    });
    quiz.best = Math.max(quiz.best || 0, (data.quiz && data.quiz.best) || 0);
    // merge journal by id
    var have = {};
    journal.forEach(function (e) { have[e.id] = true; });
    var added = 0;
    data.journal.forEach(function (e) {
      if (!e || typeof e.id !== 'string' || have[e.id] || !Array.isArray(e.cards) || typeof e.text !== 'string') return;
      if (!e.cards.every(function (c) { return c && D.byId[c.id]; })) return;
      journal.push(e); have[e.id] = true; added++;
    });
    journal.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    save(KEYS.quiz, quiz); save(KEYS.journal, journal);
    toast('Imported ' + added + ' journal entr' + (added === 1 ? 'y' : 'ies') + ' and quiz progress.');
    render();
  }

  /* ---------- install prompt ---------- */
  var installBtn = document.getElementById('installBtn');
  var deferredPrompt = null;
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (!isStandalone) {
    if (isIOS) installBtn.hidden = false;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); deferredPrompt = e; installBtn.hidden = false;
    });
  }
  window.addEventListener('appinstalled', function () { installBtn.hidden = true; deferredPrompt = null; toast('Installed. Open it from your home screen.'); });
  installBtn.addEventListener('click', function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () { deferredPrompt = null; installBtn.hidden = true; });
      return;
    }
    var body = el('div', { class: 'stack' }, [
      el('h3', { text: 'iPhone / iPad (Safari)' }),
      el('ol', {}, [
        el('li', { text: 'Open this page in Safari.' }),
        el('li', { text: 'Tap the Share button in the toolbar.' }),
        el('li', { text: 'Scroll down and tap “Add to Home Screen”, then tap Add.' })
      ]),
      el('h3', { text: 'Android (Chrome)' }),
      el('ol', {}, [
        el('li', { text: 'Tap the ⋮ menu.' }),
        el('li', { text: 'Choose “Install app” or “Add to Home screen”.' })
      ]),
      el('p', { class: 'small muted', text: 'Once installed it opens full-screen and works offline.' })
    ]);
    openSheet('Install Arcana Coach', body);
  });

  /* ---------- service worker ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline features unavailable */ });
    });
  }

  go(currentTab);
})();
