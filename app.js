/* app.js — UI state, SVG card renderer, quiz logic, spreads, journal and JSON backup.
 * Data lives in data/*.js, language handling in i18n.js and coaching logic in engine.js;
 * this file only renders and stores.
 */
(function () {
  'use strict';

  var D = window.TarotData;
  var SP = window.TarotSpreads;
  var Coach = window.CoachEngine;
  var I = window.I18n;
  var T = I.t;
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
    catch (e) { toast(T('storage.fail')); return false; }
  }

  var quiz = load(KEYS.quiz, null) || { stats: {}, streak: 0, best: 0 };
  var journal = load(KEYS.journal, []);
  var session = load(KEYS.session, null) || {};
  (function normalizeSession() {
    var d = { spreadId: 'three', category: 'romance', promptIdx: -1, custom: '', reversals: true, dealt: null, text: '', feedback: null };
    Object.keys(d).forEach(function (k) { if (session[k] === undefined) session[k] = d[k]; });
    delete session.prompt; // older versions stored the prompt text; we now store an index so it follows the language
    if (!SP.spreadById[session.spreadId]) session.spreadId = 'three';
  })();

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
  function ct(card) { return I.cardText(card); }
  function cardLabel(card, reversed) { return ct(card).name + (reversed ? T('card.rev') : ''); }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString(T('fmt.date'), { dateStyle: 'medium', timeStyle: 'short' }); }
    catch (e) { return iso; }
  }
  function sepJoin(list) { return list.join(I.lang() === 'ja' ? '・' : ' · '); }
  function stripNo(label) { return label.replace(/^\d+\s*·\s*/, ''); }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- static text & language ---------- */
  function applyStatic() {
    document.querySelectorAll('[data-i18n]').forEach(function (n) { n.textContent = T(n.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (n) { n.setAttribute('aria-label', T(n.getAttribute('data-i18n-aria'))); });
    document.title = T('doc.title');
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', T('doc.desc'));
    var cur = I.langs.filter(function (l) { return l.code === I.lang(); })[0];
    document.getElementById('langLabel').textContent = cur ? cur.label : I.lang();
  }

  function openLanguageSheet() {
    var body = el('div', { class: 'stack', role: 'radiogroup', 'aria-label': T('lang.title') });
    I.langs.forEach(function (l) {
      var on = l.code === I.lang();
      body.appendChild(el('button', {
        type: 'button', class: 'option' + (on ? ' correct' : ''), role: 'radio', 'aria-checked': String(on),
        text: (on ? '✓ ' : '') + l.label,
        onclick: function () { I.setLang(l.code); closeSheet(); }
      }));
    });
    openSheet(T('lang.title'), body);
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
  var SERIF = "Georgia,'Hiragino Mincho ProN','Yu Mincho','Noto Serif CJK JP','Noto Serif JP',serif";

  function cardSVG(card, reversed) {
    var major = card.arcana === 'major';
    var col = COLORS[major ? 'major' : card.suit];
    var ja = I.lang() === 'ja';
    var top = I.rankLabel(card);
    var name = ja ? ct(card).name : ct(card).name.toUpperCase();
    var nameSize = ja ? (name.length > 8 ? 14 : 16) : (name.length > 17 ? 12 : 14);
    var s = '<svg class="card-svg' + (reversed ? ' reversed' : '') + '" viewBox="0 0 200 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(cardLabel(card, reversed)) + '">';
    s += '<rect x="3" y="3" width="194" height="334" rx="14" fill="#1b1538" stroke="' + col + '" stroke-width="3"/>';
    s += '<rect x="11" y="11" width="178" height="318" rx="9" fill="none" stroke="' + col + '" stroke-opacity=".45" stroke-width="1"/>';
    for (var i = 0; i < 14; i++) {
      var sx = 20 + ((i * 53) % 160), sy = 50 + ((i * 97) % 240);
      s += '<circle cx="' + sx + '" cy="' + sy + '" r="' + (i % 3 === 0 ? 1.6 : 1) + '" fill="' + col + '" fill-opacity=".25"/>';
    }
    s += '<text x="100" y="44" text-anchor="middle" font-size="' + (ja && top.length > 3 ? 18 : 22) + '" font-weight="700" fill="' + col + '" font-family="' + SERIF + '" letter-spacing="2">' + esc(top) + '</text>';
    s += '<line x1="40" y1="54" x2="160" y2="54" stroke="' + col + '" stroke-opacity=".5"/>';

    if (major) {
      s += '<circle cx="100" cy="172" r="66" fill="none" stroke="' + col + '" stroke-width="2"/>';
      s += '<circle cx="100" cy="172" r="56" fill="none" stroke="' + col + '" stroke-opacity=".6" stroke-dasharray="3 5"/>';
      for (var k = 0; k < 12; k++) {
        var a = k * Math.PI / 6;
        s += '<line x1="' + (100 + 66 * Math.cos(a)).toFixed(1) + '" y1="' + (172 + 66 * Math.sin(a)).toFixed(1) + '" x2="' + (100 + 78 * Math.cos(a)).toFixed(1) + '" y2="' + (172 + 78 * Math.sin(a)).toFixed(1) + '" stroke="' + col + '" stroke-opacity=".7"/>';
      }
      s += '<text x="100" y="196" text-anchor="middle" font-size="64" fill="' + col + '" font-family="Georgia,\'Segoe UI Symbol\',\'Apple Symbols\',serif">' + esc(card.glyph) + '︎</text>';
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
    s += '<text x="100" y="312" text-anchor="middle" font-size="' + nameSize + '" font-weight="600" fill="#efeaff" font-family="' + SERIF + '" letter-spacing="1">' + esc(name) + '</text>';
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
    var tx = ct(card);
    var body = el('div');
    if (opts.position) {
      body.appendChild(el('div', { class: 'card-panel' }, [
        el('span', { class: 'tag', text: opts.position.label }),
        el('p', { class: 'small muted', text: opts.position.hint })
      ]));
    }
    var group = card.arcana === 'major' ? T('card.major') : I.suitName(card.suit);
    var top = el('div', { class: 'detail-top' }, [
      el('div', {}, [cardNode(card, reversed)]),
      el('div', {}, [
        el('span', { class: 'tag', text: group + ' · ' + I.elementName(card) }),
        el('h3', { text: cardLabel(card, reversed) })
      ])
    ]);
    var info = top.lastChild;
    if (opts.compact) {
      info.appendChild(el('div', { class: 'tag', text: reversed ? T('card.reversed') : T('card.upright') }));
      info.appendChild(kwList(reversed ? tx.revKeywords : tx.upKeywords, reversed));
      info.appendChild(el('p', { text: reversed ? tx.rev : tx.up }));
      body.appendChild(top);
    } else {
      info.appendChild(el('p', { class: 'small muted', text: tx.symbolism }));
      body.appendChild(top);
      body.appendChild(el('h3', { text: T('card.upright') }));
      body.appendChild(kwList(tx.upKeywords, false));
      body.appendChild(el('p', { text: tx.up }));
      body.appendChild(el('h3', { text: T('card.reversed') }));
      body.appendChild(kwList(tx.revKeywords, true));
      body.appendChild(el('p', { text: tx.rev }));
    }
    openSheet(tx.name, body);
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
  function filterDefs() {
    return [['all', T('guide.all')], ['major', T('guide.major')],
      ['wands', I.suitName('wands')], ['cups', I.suitName('cups')], ['swords', I.suitName('swords')], ['pentacles', I.suitName('pentacles')],
      ['basics', T('guide.basics')]];
  }

  function renderGuide(root) {
    var list = el('div');
    var chips = el('div', { class: 'chips', role: 'group', 'aria-label': T('guide.filterAria') });
    var search = el('input', {
      type: 'search', placeholder: T('guide.search'), 'aria-label': T('guide.searchAria'),
      oninput: function (e) { guide.q = e.target.value; fillList(); }
    });
    search.value = guide.q;
    var searchWrap = el('div', { class: 'card-panel' }, [search]);

    function drawChips() {
      chips.replaceChildren();
      filterDefs().forEach(function (f) {
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
        var x = ct(c);
        var hay = [x.name, I.elementName(c), x.up, x.rev, x.upKeywords.join(' '), x.revKeywords.join(' ')].join(' ').toLowerCase();
        return hay.indexOf(q) >= 0;
      });
      if (!items.length) { list.appendChild(el('p', { class: 'muted', text: T('guide.none') })); return; }
      var grid = el('div', { class: 'grid' });
      items.forEach(function (c) {
        grid.appendChild(el('button', {
          type: 'button', class: 'grid-item', 'aria-label': ct(c).name,
          onclick: function () { showCardDetail(c, {}); }
        }, [cardNode(c, false), el('span', { class: 'name', text: ct(c).short })]));
      });
      list.appendChild(grid);
    }
    root.appendChild(el('h2', { text: T('guide.title') }));
    root.appendChild(chips);
    root.appendChild(searchWrap);
    root.appendChild(list);
    drawChips();
    fillList();
  }

  function primer() {
    return el('div', {}, I.primer().map(function (b) {
      return el('div', { class: 'card-panel' }, [el('h3', { text: b.title })].concat(b.paras.map(function (p) { return el('p', { text: p }); })));
    }));
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
    // only ids are stored; option text is derived at render time so it follows the language
    qState = { cardId: card.id, reversed: reversed, options: shuffle([card].concat(decoys)).map(function (c) { return c.id; }), picked: null };
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
    root.appendChild(el('h2', { text: T('quiz.title') }));
    root.appendChild(el('div', { class: 'card-panel stat-row' }, [
      el('div', { class: 'stat' }, [el('b', { text: t.seen ? Math.round(100 * t.correct / t.seen) + '%' : '–' }), el('span', { class: 'small muted', text: T('quiz.accuracy') })]),
      el('div', { class: 'stat' }, [el('b', { text: String(quiz.streak) }), el('span', { class: 'small muted', text: T('quiz.streak', { best: quiz.best }) })]),
      el('div', { class: 'stat' }, [el('b', { text: t.tracked + '/78' }), el('span', { class: 'small muted', text: T('quiz.tried') })])
    ]));

    var panel = el('div', { class: 'card-panel' });
    panel.appendChild(el('div', { class: 'quiz-card' }, [cardNode(card, qState.reversed)]));
    panel.appendChild(el('p', { class: 'small', style: 'text-align:center', text: T(qState.reversed ? 'quiz.askRev' : 'quiz.askUp') }));
    var opts = el('div', { class: 'options' });
    qState.options.forEach(function (id) {
      var c = D.byId[id];
      var cls = 'option';
      if (qState.picked) {
        if (id === qState.cardId) cls += ' correct';
        else if (id === qState.picked) cls += ' wrong';
      }
      opts.appendChild(el('button', {
        type: 'button', class: cls, disabled: !!qState.picked, text: qState.reversed ? ct(c).rev : ct(c).up,
        onclick: function () { answerQuiz(id); }
      }));
    });
    panel.appendChild(opts);

    if (qState.picked) {
      var ok = qState.picked === qState.cardId;
      var tx = ct(card);
      panel.appendChild(el('div', { class: 'verdict ' + (ok ? 'ok' : 'ng'), 'aria-label': T(ok ? 'quiz.correct' : 'quiz.incorrect'), text: ok ? '○' : '×' }));
      panel.appendChild(el('p', { style: 'text-align:center' }, [
        el('b', { text: cardLabel(card, qState.reversed) }),
        el('br'),
        el('span', { class: 'small muted', text: sepJoin(qState.reversed ? tx.revKeywords : tx.upKeywords) })
      ]));
      panel.appendChild(el('div', { class: 'row' }, [
        el('button', { type: 'button', class: 'btn block', text: T('quiz.next'), onclick: function () { newQuestion(); render(); window.scrollTo(0, 0); } })
      ]));
    }
    root.appendChild(panel);

    var weak = Object.keys(quiz.stats).map(function (id) {
      var s = quiz.stats[id]; return { id: id, miss: s.seen - s.correct, seen: s.seen };
    }).filter(function (x) { return x.miss > 0 && D.byId[x.id]; }).sort(function (a, b) { return b.miss - a.miss; }).slice(0, 5);
    if (weak.length) {
      var wp = el('div', { class: 'card-panel' }, [el('h3', { text: T('quiz.review') })]);
      weak.forEach(function (w) {
        var c = D.byId[w.id];
        wp.appendChild(el('button', {
          type: 'button', class: 'chip', style: 'margin:0 8px 8px 0', text: T('quiz.missed', { name: ct(c).short, miss: w.miss, seen: w.seen }),
          onclick: function () { showCardDetail(c, {}); }
        }));
      });
      root.appendChild(wp);
    }
    root.appendChild(el('button', {
      type: 'button', class: 'btn ghost btn-small', text: T('quiz.reset'),
      onclick: function () {
        if (confirm(T('quiz.resetConfirm'))) {
          quiz = { stats: {}, streak: 0, best: 0 }; save(KEYS.quiz, quiz); qState = null; render();
        }
      }
    }));
  }

  /* ===== Expand (spreads + coach) ===== */
  function saveSession() { save(KEYS.session, session); }
  function pickPromptIdx() {
    var list = I.prompts(session.category);
    if (!list.length) return -1;
    var next;
    do { next = rnd(list.length); } while (list.length > 1 && next === session.promptIdx);
    return next;
  }
  function promptText() {
    var list = I.prompts(session.category);
    return list[session.promptIdx] || '';
  }
  function currentQuestion() { return (session.custom || '').trim() || promptText(); }

  function dealSpread() {
    var spread = I.spread(session.spreadId);
    if (session.dealt && (session.text || '').trim() && !confirm(T('exp.dealConfirm'))) return;
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
    if (session.promptIdx < 0 || !promptText()) { session.promptIdx = pickPromptIdx(); saveSession(); }
    var spread = I.spread(session.spreadId);
    root.appendChild(el('h2', { text: T('exp.title') }));

    var setup = el('div', { class: 'card-panel stack' });
    setup.appendChild(el('div', { class: 'tag', text: T('exp.step1') }));
    var sc = el('div', { class: 'chips', role: 'group', 'aria-label': T('exp.spreadAria') });
    I.spreads().forEach(function (s) {
      sc.appendChild(el('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(s.id === session.spreadId), text: s.name + ' (' + s.positions.length + ')',
        onclick: function () { session.spreadId = s.id; saveSession(); render(); }
      }));
    });
    setup.appendChild(sc);
    setup.appendChild(el('p', { class: 'small muted', text: spread.subtitle }));

    setup.appendChild(el('div', { class: 'tag', text: T('exp.step2') }));
    var cc = el('div', { class: 'chips', role: 'group', 'aria-label': T('exp.catAria') });
    I.categories().forEach(function (c) {
      cc.appendChild(el('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(c.id === session.category), text: c.label,
        onclick: function () { session.category = c.id; session.promptIdx = pickPromptIdx(); saveSession(); render(); }
      }));
    });
    setup.appendChild(cc);
    setup.appendChild(el('p', { text: '“' + promptText() + '”' }));
    setup.appendChild(el('button', {
      type: 'button', class: 'btn ghost btn-small', text: T('exp.another'),
      onclick: function () { session.promptIdx = pickPromptIdx(); saveSession(); render(); }
    }));
    var custom = el('input', {
      type: 'text', placeholder: T('exp.custom'), 'aria-label': T('exp.customAria'), maxlength: '200',
      oninput: function (e) { session.custom = e.target.value; saveSession(); }
    });
    custom.value = session.custom || '';
    setup.appendChild(custom);
    var rv = el('input', { type: 'checkbox', id: 'rv', onchange: function (e) { session.reversals = e.target.checked; saveSession(); } });
    rv.checked = !!session.reversals;
    setup.appendChild(el('label', { class: 'check', for: 'rv' }, [rv, el('span', { text: T('exp.reversals') })]));
    setup.appendChild(el('button', { type: 'button', class: 'btn gold block', text: T(session.dealt ? 'exp.dealAgain' : 'exp.deal'), onclick: dealSpread }));
    root.appendChild(setup);

    if (!session.dealt) {
      root.appendChild(el('p', { class: 'muted small', text: T('exp.intro') }));
      return;
    }

    var d = session.dealt;
    var dSpread = I.spread(d.spreadId);
    var panel = el('div', { class: 'card-panel' });
    panel.appendChild(el('span', { class: 'tag', text: dSpread.name }));
    panel.appendChild(el('p', { text: d.question ? '“' + d.question + '”' : T('exp.noQuestion') }));
    panel.appendChild(spreadGrid(dSpread, d.cards));
    panel.appendChild(el('p', { class: 'small muted', text: T('exp.tapHint') }));
    var legend = el('ol', { class: 'legend' });
    dSpread.positions.forEach(function (p, i) {
      var c = D.byId[d.cards[i].id];
      legend.appendChild(el('li', {}, [
        el('b', { text: p.label + (I.lang() === 'ja' ? '：' : ': ') }), cardLabel(c, d.cards[i].reversed),
        el('div', { class: 'small muted', text: p.hint })
      ]));
    });
    panel.appendChild(legend);
    root.appendChild(panel);

    var rp = el('div', { class: 'card-panel stack' });
    rp.appendChild(el('h3', { text: T('exp.yourReading') }));
    var ta = el('textarea', {
      placeholder: T('exp.placeholder'), 'aria-label': T('exp.readingAria'),
      oninput: function (e) { session.text = e.target.value; saveSession(); }
    });
    ta.value = session.text || '';
    rp.appendChild(ta);
    rp.appendChild(el('div', { class: 'row' }, [
      el('button', { type: 'button', class: 'btn', text: T('exp.coach'), onclick: runCoach }),
      el('button', { type: 'button', class: 'btn ghost', text: T('exp.save'), onclick: saveToJournal })
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

  function evaluateSession() {
    var d = session.dealt;
    return Coach.evaluateReading({
      spread: I.spread(d.spreadId), cards: d.cards, question: d.question, text: session.text || '', lang: I.lang()
    });
  }
  function runCoach() {
    if (!session.dealt) return;
    session.feedback = evaluateSession();
    saveSession();
    render();
    var fb = view.querySelector('[data-feedback]');
    if (fb) fb.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function feedbackPanel(fb) {
    var p = el('div', { class: 'card-panel', 'data-feedback': '1' });
    p.appendChild(el('h3', { text: T('fb.title') }));
    if (fb.tooShort) {
      p.appendChild(el('p', { text: T('fb.tooShort') }));
      if (fb.patterns && fb.patterns.length) {
        p.appendChild(el('p', { class: 'small muted', text: T('fb.hint', { patterns: fb.patterns.map(function (x) { return x.title; }).join(I.lang() === 'ja' ? '、' : '; ') }) }));
      }
    } else {
      p.appendChild(el('div', { class: 'row between' }, [
        el('span', { class: 'stars', text: stars(fb.overall.stars), 'aria-label': T('fb.overallAria', { n: fb.overall.stars }) }),
        el('span', { class: 'muted small', text: T('fb.overall', { n: fb.overall.score }) })
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
    p.appendChild(el('p', { class: 'small muted', text: T('fb.footer', { engine: fb.engine }) }));
    return p;
  }

  function saveToJournal() {
    var d = session.dealt;
    if (!d) return;
    if (!(session.text || '').trim()) { toast(T('exp.writeFirst')); return; }
    journal.unshift({
      id: Date.now().toString(36) + rnd(1e6).toString(36),
      date: new Date().toISOString(),
      spreadId: d.spreadId,
      question: d.question,
      cards: d.cards,
      text: session.text,
      feedback: session.feedback
    });
    if (save(KEYS.journal, journal)) toast(T('exp.saved'));
  }

  /* ===== Journal & backup ===== */
  function renderJournal(root) {
    root.appendChild(el('h2', { text: T('j.title') }));
    if (!journal.length) root.appendChild(el('p', { class: 'muted', text: T('j.empty') }));
    journal.forEach(function (e) {
      var spread = I.spread(e.spreadId) || { name: e.spreadId, positions: [] };
      var det = el('details', { class: 'entry' });
      det.appendChild(el('summary', {}, [
        el('b', { text: spread.name }), el('span', { class: 'small muted', text: ' · ' + fmtDate(e.date) }),
        el('div', { class: 'small', text: e.question || T('j.noQuestion') })
      ]));
      var body = el('div', { class: 'body stack' });
      var mini = el('div', { class: 'mini-cards' });
      e.cards.forEach(function (c, i) {
        var card = D.byId[c.id]; if (!card) return;
        var pos = spread.positions[i];
        mini.appendChild(el('div', {}, [cardNode(card, c.reversed), el('div', { text: pos ? stripNo(pos.label) : '' })]));
      });
      body.appendChild(mini);
      body.appendChild(el('div', { class: 'reading-text', text: e.text }));
      if (e.feedback && e.feedback.criteria && e.feedback.criteria.length) {
        body.appendChild(el('div', { class: 'small' }, [
          el('span', { class: 'stars', text: stars(e.feedback.overall.stars) }),
          ' ' + e.feedback.criteria.map(function (c) { return (c.short || c.title) + ' ' + stars(c.stars); }).join(' · ')
        ]));
      }
      body.appendChild(el('button', {
        type: 'button', class: 'btn danger btn-small', text: T('j.delete'),
        onclick: function () {
          if (!confirm(T('j.deleteConfirm'))) return;
          journal = journal.filter(function (x) { return x.id !== e.id; }); save(KEYS.journal, journal); render();
        }
      }));
      det.appendChild(body);
      root.appendChild(det);
    });

    root.appendChild(el('div', { class: 'card-panel stack' }, [
      el('h3', { text: T('j.backup') }),
      el('p', { class: 'small muted', text: T('j.backupText') }),
      el('button', { type: 'button', class: 'btn block', text: T('j.export'), onclick: exportBackup }),
      el('button', { type: 'button', class: 'btn ghost block', text: T('j.import'), onclick: function () { document.getElementById('importFile').click(); } })
    ]));
  }

  var importInput = el('input', { type: 'file', id: 'importFile', accept: '.json,application/json', class: 'hidden' });
  document.body.appendChild(importInput);
  importInput.addEventListener('change', function () {
    var f = importInput.files && importInput.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () { importBackup(String(r.result)); importInput.value = ''; };
    r.onerror = function () { toast(T('j.readFail')); };
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
    toast(T('j.exported'));
  }

  function importBackup(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { toast(T('j.badJson')); return; }
    if (!data || data.app !== 'arcana-coach' || typeof data.quiz !== 'object' || !Array.isArray(data.journal)) {
      toast(T('j.badBackup')); return;
    }
    var stats = data.quiz && data.quiz.stats ? data.quiz.stats : {};
    Object.keys(stats).forEach(function (id) {
      if (!D.byId[id]) return;
      var s = stats[id];
      if (!s || typeof s.seen !== 'number' || typeof s.correct !== 'number') return;
      var mine = quiz.stats[id];
      if (!mine || s.seen > mine.seen) quiz.stats[id] = { seen: s.seen, correct: Math.min(s.correct, s.seen) };
    });
    quiz.best = Math.max(quiz.best || 0, (data.quiz && data.quiz.best) || 0);
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
    toast(T('j.imported', { n: added }));
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
  window.addEventListener('appinstalled', function () { installBtn.hidden = true; deferredPrompt = null; toast(T('install.done')); });
  installBtn.addEventListener('click', function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () { deferredPrompt = null; installBtn.hidden = true; });
      return;
    }
    var body = el('div', { class: 'stack' }, [
      el('h3', { text: T('install.ios') }),
      el('ol', {}, [el('li', { text: T('install.ios1') }), el('li', { text: T('install.ios2') }), el('li', { text: T('install.ios3') })]),
      el('h3', { text: T('install.android') }),
      el('ol', {}, [el('li', { text: T('install.android1') }), el('li', { text: T('install.android2') })]),
      el('p', { class: 'small muted', text: T('install.note') })
    ]);
    openSheet(T('install.title'), body);
  });

  /* ---------- language switching ---------- */
  document.getElementById('langBtn').addEventListener('click', openLanguageSheet);
  I.onChange(function () {
    applyStatic();
    // Re-run the coach in the new language so the visible feedback matches the UI.
    if (session.dealt && session.feedback) session.feedback = evaluateSession();
    saveSession();
    render();
  });

  /* ---------- service worker ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline features unavailable */ });
    });
  }

  applyStatic();
  go(currentTab);
})();
