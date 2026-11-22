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
  var INK = '#171717';
  var PINK = '#e889b4';
  var SERIF = "Georgia,'Hiragino Mincho ProN','Yu Mincho','Noto Serif CJK JP','Noto Serif JP',serif";
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

  /* Original hand-drawn line motifs for the Major Arcana.
   * The zodiac glyphs remain part of the card data for elemental references only;
   * the card faces use tarot-specific scenes instead.
   */
  var MAJOR_ART = {
    0: '<path d="M74 196 Q89 184 101 190 L117 211 M92 190 L86 161 L105 139 L117 147 L107 171 L124 187 M104 140 L111 126 L122 132 L117 147 M83 160 L71 149 M70 149 L61 157 M118 211 L124 231 M91 190 L82 216 L91 233 M123 188 L145 204 L151 218 M143 204 L151 218 L141 216"/><path d="M34 244 Q71 231 106 245 T169 243 M47 235 L42 224 M47 235 L55 225"/><path d="M53 210 Q61 197 72 207 L80 215 L72 226 L59 224 Z M59 224 L55 235 M72 225 L80 235"/><path d="M75 114 Q100 96 125 113 M100 103 L100 90 M91 108 L84 100 M109 108 L116 100"/>',
    1: '<path d="M100 93 C78 74 62 94 78 107 C91 117 110 117 123 105 C138 91 119 74 100 93 Z"/><path d="M100 132 L100 195 M94 140 L106 140 M89 195 L111 195 M72 205 L128 205 L139 222 L61 222 Z"/><path d="M75 222 L75 232 M125 222 L125 232 M81 236 L119 236"/><path d="M63 184 Q71 177 78 184 L84 193 M137 184 Q129 177 122 184 L116 193"/><circle cx="68" cy="174" r="6"/><path d="M132 167 L138 181 L126 181 Z"/>',
    2: '<path d="M58 92 L58 235 M50 92 L66 92 M51 235 L66 235 M142 92 L142 235 M134 92 L150 92 M134 235 L150 235"/><path d="M79 205 Q100 192 121 205 L121 224 Q100 235 79 224 Z"/><path d="M100 202 L100 228 M83 211 L95 216 M105 216 L117 211"/><path d="M88 82 Q106 60 125 81 Q110 79 103 93 Q94 91 88 82 Z"/><path d="M74 107 Q100 94 126 107 M78 119 Q100 111 122 119"/>',
    3: '<path d="M100 132 C73 108 52 136 66 157 C75 171 91 181 100 191 C109 181 125 171 134 157 C148 136 127 108 100 132 Z"/><path d="M100 190 L100 231 M100 211 Q77 207 74 190 M100 220 Q122 215 128 194"/><path d="M73 190 Q62 179 66 168 Q80 168 85 183 M128 194 Q141 182 137 169 Q123 169 117 185"/><path d="M84 120 Q100 106 116 120 M93 115 L100 103 L107 115"/>',
    4: '<path d="M65 125 L65 213 Q100 231 135 213 L135 125 L119 139 L100 117 L81 139 Z"/><path d="M78 213 L78 235 M122 213 L122 235 M69 235 L131 235"/><path d="M65 125 L57 113 L75 116 L82 99 L100 113 L118 99 L125 116 L143 113 L135 125"/><path d="M83 164 Q100 151 117 164 L117 191 Q100 203 83 191 Z"/><path d="M100 165 L100 190 M91 176 L109 176"/>',
    5: '<path d="M100 106 L100 184 M88 123 Q100 108 112 123 M82 145 Q100 131 118 145"/><path d="M78 185 L122 185 M84 185 L84 206 M116 185 L116 206"/><path d="M82 206 L100 222 L118 206"/><circle cx="100" cy="94" r="13"/><path d="M100 81 L100 70 M83 94 L72 94 M117 94 L128 94"/><path d="M67 229 L133 229 M75 238 L125 238"/>',
    6: '<path d="M100 135 C78 111 57 136 71 157 C81 171 93 180 100 186 C107 180 119 171 129 157 C143 136 122 111 100 135 Z"/><circle cx="72" cy="204" r="11"/><circle cx="128" cy="204" r="11"/><path d="M72 215 L67 241 L83 241 L78 216 M128 215 L122 241 L138 241 L133 216"/><path d="M72 193 L60 181 M128 193 L140 181 M100 100 L100 119 M91 110 L109 110"/>',
    7: '<path d="M58 162 L142 162 L151 194 L49 194 Z"/><path d="M66 162 L77 131 L123 131 L134 162 M83 132 L83 112 L117 112 L117 132"/><circle cx="71" cy="205" r="13"/><circle cx="129" cy="205" r="13"/><path d="M71 205 L71 192 M129 205 L129 192 M77 148 L51 137 M123 148 L149 137"/><path d="M100 112 L100 91 M94 96 L100 88 L106 96"/>',
    8: '<path d="M100 112 C83 96 62 113 66 137 C70 163 87 177 100 180 C113 177 130 163 134 137 C138 113 117 96 100 112 Z"/><path d="M68 126 L54 111 L75 115 M132 126 L146 111 L125 115 M79 111 L72 91 L93 106 M121 111 L128 91 L107 106"/><path d="M83 142 Q91 134 98 143 M102 143 Q109 134 117 142 M93 157 Q100 164 107 157"/><path d="M100 181 L100 220 M100 203 Q79 194 72 180 M100 203 Q121 194 128 180"/><path d="M83 91 Q100 73 117 91 Q100 84 83 91 Z"/>',
    9: '<path d="M83 110 Q100 91 117 110 L126 174 Q100 196 74 174 Z"/><path d="M84 112 L116 112 L111 148 L89 148 Z"/><path d="M100 117 L100 141 M94 145 L106 145"/><path d="M133 104 L151 239 M144 98 L156 106 M145 111 L157 119"/><path d="M76 176 L61 209 L73 229 M124 176 L139 209 L127 229"/>',
    10: '<circle cx="100" cy="166" r="58"/><circle cx="100" cy="166" r="45"/><path d="M100 108 L100 224 M42 166 L158 166 M59 125 L141 207 M141 125 L59 207"/><path d="M100 108 L108 122 L92 122 Z M158 166 L144 174 L144 158 Z"/><path d="M75 153 L100 137 L125 153 L125 182 L100 196 L75 182 Z"/><circle cx="100" cy="166" r="5"/>',
    11: '<path d="M100 105 L100 232 M78 232 L122 232 M82 225 L118 225 M100 105 L66 129 L134 129"/><path d="M66 129 L48 177 M66 129 L84 177 M48 177 Q66 189 84 177 Z"/><path d="M134 129 L116 177 M134 129 L152 177 M116 177 Q134 189 152 177 Z"/><path d="M88 103 L100 90 L112 103 M94 92 L106 92"/>',
    12: '<path d="M48 92 Q76 75 100 92 Q124 75 152 92 M63 92 L63 112 M137 92 L137 112"/><path d="M100 93 L100 146 M92 119 L108 119"/><circle cx="100" cy="154" r="12"/><path d="M88 153 L80 149 L83 161 M112 153 L120 149 L117 161"/><path d="M91 166 L82 195 L118 195 L109 166 Z M88 177 L73 188 M112 177 L127 188"/><path d="M89 195 L80 214 M111 195 L120 214"/>',
    13: '<path d="M56 106 L145 204 M136 190 L154 218 M145 204 L162 202"/><path d="M54 106 Q78 92 99 117 Q109 130 100 146 Q84 137 73 126 Q61 117 54 106 Z"/><path d="M58 106 L83 119 L103 143"/><path d="M120 216 Q127 198 145 205 Q158 215 150 232 Q135 246 120 232 Z"/><path d="M135 205 L136 195 M143 207 L152 198 M122 219 L112 213 M150 225 L163 229"/>',
    14: '<path d="M64 125 L89 125 Q89 153 77 158 Q64 153 64 125 Z M111 101 L136 101 Q136 129 124 134 Q111 129 111 101 Z"/><path d="M77 158 L77 181 M124 134 L124 157 M66 181 L88 181 M113 157 L135 157"/><path d="M89 133 Q104 145 111 111 M91 139 Q101 157 111 129"/><path d="M53 209 Q73 196 93 207 T143 207 M48 223 Q75 214 101 224 T151 224"/>',
    15: '<path d="M100 107 L79 78 L88 118 L63 112 L78 143 L100 157 L122 143 L137 112 L112 118 L121 78 Z"/><path d="M82 132 Q100 120 118 132 L116 166 Q100 180 84 166 Z"/><circle cx="91" cy="146" r="3" fill="#171717"/><circle cx="109" cy="146" r="3" fill="#171717"/><path d="M92 161 Q100 166 108 161 M75 184 L125 184 M75 184 L65 207 L83 207 M125 184 L135 207 L117 207"/><path d="M68 211 L88 225 L108 211 L128 225"/>',
    16: '<path d="M68 131 L132 131 L132 231 L68 231 Z M68 151 L132 151 M68 171 L132 171 M68 191 L132 191 M68 211 L132 211"/><path d="M68 151 L86 151 L86 171 L68 171 M105 171 L132 171 L132 191 L105 191 M68 191 L91 191 L91 211 L68 211"/><path d="M113 78 L93 125 L109 119 L91 159 L133 108 L115 114 L129 78 Z"/><path d="M82 231 L73 244 M118 231 L128 244 M56 245 L145 245"/>',
    17: '<path d="M100 79 L109 103 L135 105 L115 122 L121 148 L100 135 L79 148 L85 122 L65 105 L91 103 Z"/><path d="M58 174 Q76 156 93 175 L93 205 Q76 214 58 205 Z M107 180 Q124 165 142 180 L142 210 Q124 218 107 210 Z"/><path d="M72 207 L50 235 M80 210 L66 240 M125 214 L147 240 M133 212 L155 234"/><path d="M48 246 Q75 236 100 246 T152 246"/>',
    18: '<path d="M100 76 Q72 105 100 132 Q128 105 100 76 Z"/><path d="M100 76 Q88 95 100 109 Q112 95 100 76 Z"/><path d="M47 184 Q59 165 76 182 L87 201 L72 216 L52 210 Z M153 184 Q141 165 124 182 L113 201 L128 216 L148 210 Z"/><path d="M60 190 L74 190 M140 190 L126 190 M73 218 L64 239 M127 218 L136 239"/><path d="M47 248 Q74 234 100 248 T153 248"/><circle cx="100" cy="176" r="10"/>',
    19: '<circle cx="100" cy="139" r="30"/><path d="M100 94 L100 79 M100 184 L100 199 M55 139 L40 139 M145 139 L160 139 M68 107 L57 96 M132 107 L143 96 M68 171 L57 182 M132 171 L143 182"/><circle cx="89" cy="135" r="3" fill="#171717"/><circle cx="111" cy="135" r="3" fill="#171717"/><path d="M88 151 Q100 162 112 151"/><path d="M100 169 L100 233 M100 196 Q78 184 68 170 M100 206 Q122 188 134 172"/><path d="M71 172 Q54 160 58 145 Q74 146 81 160 M132 174 Q149 160 143 145 Q127 147 120 161"/>',
    20: '<path d="M56 107 L82 119 L78 139 L52 128 Z M82 119 L121 139"/><path d="M61 109 L73 91 L83 119 M70 114 L80 96"/><path d="M121 139 L138 132 M121 139 L135 149"/><circle cx="84" cy="196" r="11"/><circle cx="116" cy="196" r="11"/><path d="M84 207 L78 239 L91 239 L88 207 M116 207 L109 239 L122 239 L120 207"/><path d="M73 227 L62 241 M127 227 L138 241 M90 176 L100 164 L110 176"/>',
    21: '<path d="M100 77 C56 85 43 129 55 176 C67 222 133 222 145 176 C157 129 144 85 100 77 Z"/><path d="M100 91 C68 100 62 135 70 171 C79 204 121 204 130 171 C138 135 132 100 100 91 Z"/><path d="M100 111 L100 173 M89 135 L100 122 L111 135 M86 186 Q100 198 114 186"/><path d="M57 113 L42 104 M143 113 L158 104 M57 179 L41 188 M143 179 L159 188"/>'
  };

  function suitSymbol(suit, x, y, scale) {
    var art = '';
    if (suit === 'wands') {
      art = '<path d="M-3 20 Q0 0 2 -20 M-2 3 Q-13 -1 -14 -12 Q-2 -10 0 -2 M1 -6 Q12 -10 14 -21 Q2 -18 1 -6 M-1 11 Q-12 8 -17 1"/>';
    } else if (suit === 'cups') {
      art = '<path d="M-14 -17 Q0 -14 14 -17 Q12 2 0 4 Q-12 2 -14 -17 Z M0 4 L0 18 M-10 19 Q0 15 10 19"/><path d="M-8 -12 Q0 -9 8 -12"/>';
    } else if (suit === 'swords') {
      art = '<path d="M0 -23 Q-8 -6 -5 9 L0 14 L5 9 Q8 -6 0 -23 Z M-14 7 L14 7 M0 13 L0 22 M-6 22 L6 22"/>';
    } else {
      art = '<circle cx="0" cy="0" r="17"/><path d="M0 -13 L3 -4 L13 -4 L5 2 L8 12 L0 6 L-8 12 L-5 2 L-13 -4 L-3 -4 Z"/>';
    }
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + scale + ')" fill="none" stroke="' + INK + '" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">' + art + '</g>';
  }

  function courtArt(card) {
    var n = card.number;
    var s = '<g fill="none" stroke="' + INK + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">';
    if (n === 11) {
      s += '<path d="M73 130 Q100 111 127 130 L120 210 Q100 225 80 210 Z M82 130 L78 112 L92 119 L100 101 L108 119 L122 112 L118 130"/>';
      s += '<circle cx="100" cy="85" r="14"/><path d="M85 84 L89 67 L100 78 L111 67 L115 84 M100 100 L100 111 M73 149 L48 174 M127 149 L150 130"/>';
      s += '<path d="M86 214 L81 239 M114 214 L119 239 M80 239 L68 239 M120 239 L132 239"/>';
    } else if (n === 12) {
      s += '<path d="M52 208 Q81 189 103 204 Q129 188 150 209 Q136 234 107 229 L73 232 Z M73 202 L66 177 L82 160 L101 176 L116 201 M113 198 L131 177 L148 184 L153 203"/>';
      s += '<circle cx="97" cy="143" r="13"/><path d="M84 141 L82 124 L100 131 L114 121 L111 144 M86 156 L74 173 M108 156 L126 172"/>';
      s += '<path d="M80 231 L73 246 M127 230 L134 246"/>';
    } else if (n === 13) {
      s += '<path d="M73 140 Q100 114 127 140 L123 216 Q100 231 77 216 Z M76 140 L68 115 L86 127 L100 104 L114 127 L132 115 L124 140"/>';
      s += '<circle cx="100" cy="91" r="13"/><path d="M91 92 Q100 98 109 92 M84 214 L80 241 M116 214 L120 241"/>';
      s += '<path d="M73 166 L50 182 M127 166 L151 181 M51 182 L46 195 M151 181 L156 194"/>';
    } else {
      s += '<path d="M66 143 L134 143 L128 217 Q100 235 72 217 Z M69 143 L61 119 L79 127 L91 109 L100 122 L109 109 L121 127 L139 119 L131 143"/>';
      s += '<circle cx="100" cy="89" r="14"/><path d="M88 89 L92 81 L100 87 L108 81 L112 89 M100 103 L100 118 M66 163 L43 178 M134 163 L157 178"/>';
      s += '<path d="M78 218 L72 242 M122 218 L128 242 M72 242 L60 242 M128 242 L140 242"/>';
    }
    s += '</g>' + suitSymbol(card.suit, 139, 103, 0.72);
    return s;
  }

  function cardSVG(card, reversed) {
    var major = card.arcana === 'major';
    var ja = I.lang() === 'ja';
    var top = I.rankLabel(card);
    var name = ja ? ct(card).short : ct(card).short.toUpperCase();
    if (!name) name = ja ? ct(card).name : ct(card).name.toUpperCase();
    var nameSize = ja ? (name.length > 7 ? 9 : 11) : (name.length > 17 ? 8 : name.length > 12 ? 9 : 10);
    var s = '<svg class="card-svg' + (reversed ? ' reversed' : '') + '" viewBox="0 0 200 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(cardLabel(card, reversed)) + '">';
    s += '<rect x="3" y="3" width="194" height="334" rx="10" fill="#f5b0cc" stroke="' + PINK + '" stroke-width="2"/>';
    s += '<rect x="9" y="9" width="182" height="322" rx="6" fill="#ffffff" stroke="' + INK + '" stroke-width="1.4"/>';
    s += '<path d="M15 15 Q47 13 78 15 T139 15 T185 15 M15 325 Q50 327 83 325 T145 325 T185 325" fill="none" stroke="' + PINK + '" stroke-width="1.2"/>';
    s += '<text x="100" y="32" text-anchor="middle" font-size="' + (top.length > 4 ? 14 : 17) + '" font-weight="600" fill="' + INK + '" font-family="' + SERIF + '">' + esc(top) + '</text>';
    s += '<path d="M78 40 Q100 42 122 40" fill="none" stroke="' + INK + '" stroke-width="1" stroke-linecap="round"/>';
    if (major) {
      s += '<g fill="none" stroke="' + INK + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' + (MAJOR_ART[card.number] || '<circle cx="100" cy="166" r="48"/>') + '</g>';
    } else if (card.number > 10) {
      s += courtArt(card);
    } else {
      if (card.number === 1) {
        s += '<g fill="none" stroke="' + INK + '" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M48 146 Q55 130 72 137 Q84 126 93 141 M50 148 Q67 158 82 148"/><path d="M75 144 Q84 154 89 165"/></g>';
        s += suitSymbol(card.suit, 111, 166, 1.45);
      } else {
        var pips = PIPS[card.number] || [[100, 172]];
        var scale = card.number <= 4 ? 1.05 : card.number <= 7 ? 0.88 : 0.76;
        pips.forEach(function (p, i) {
          s += suitSymbol(card.suit, p[0], p[1], scale);
          if (card.number >= 7 && i % 2 === 0) {
            s += '<path d="M' + (p[0] - 15) + ' ' + (p[1] + 24) + ' q7 5 13 0" fill="none" stroke="' + PINK + '" stroke-width="1.2" stroke-linecap="round"/>';
          }
        });
      }
    }
    s += '<path d="M43 286 Q100 288 157 286" fill="none" stroke="' + PINK + '" stroke-width="1.3"/>';
    s += '<text x="100" y="309" text-anchor="middle" font-size="' + nameSize + '" font-weight="600" fill="' + INK + '" font-family="' + SERIF + '" letter-spacing=".4">' + esc(name) + '</text>';
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
