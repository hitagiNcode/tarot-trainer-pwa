/* engine.js — in-browser Reading Coach (Phase 1: deterministic rule & pattern engine).
 *
 * Public API (the only thing the UI depends on):
 *   CoachEngine.evaluateReading({ spread, cards, question, text }) -> result
 *     spread  : an entry from TarotSpreads.spreads
 *     cards   : [{ id, reversed }] aligned by index with spread.positions
 *     question: string
 *     text    : the learner's written interpretation
 *   result = { engine, overall:{score,stars}, criteria:[{id,title,score,stars,summary,points:[{type,text}]}],
 *              patterns:[{id,title,detail,addressed}], perCard:[...] }
 *
 * Phase 2 (client-side semantic embeddings, e.g. Transformers.js) can replace the body of
 * evaluateReading() — or wrap this one — without touching the UI as long as the result shape stays.
 */
(function (global) {
  'use strict';

  var STOP = {};
  ('about above after again against also always among and another any are because been before being below ' +
    'between both but can could did does doing down during each even every few for from further had has have ' +
    'having her here hers herself him himself his how into its itself just more most much must myself not now ' +
    'off once only other our ours ourselves out over own same she should some such than that the their theirs ' +
    'them themselves then there these they this those through too under until upon very was were what when ' +
    'where which while who whom why will with would you your yours yourself yourselves').split(' ')
    .forEach(function (w) { STOP[w] = 1; });

  var RULES = [/ingly$/, /edly$/, /ations?$/, /ments?$/, /ness$/, /ful$/, /ings?$/, /ied$/, /ies$/, /ed$/, /es$/, /ly$/, /s$/, /ion$/, /ive$/, /er$/];

  function stem(word) {
    var w = String(word).toLowerCase().replace(/[^a-z]/g, '');
    if (w.length < 3 || STOP[w]) return '';
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].test(w)) {
        var s = w.replace(RULES[i], '');
        if (s.length >= 3) { w = s; break; }
      }
    }
    if (w.length >= 4) w = w.replace(/e$/, '');
    return w.slice(0, 6);
  }

  function stems(text) {
    var out = {};
    String(text).split(/[^A-Za-z]+/).forEach(function (t) {
      var s = stem(t);
      if (s) out[s] = 1;
    });
    return out;
  }

  // ---- concept sets per card & orientation (cached) ----
  var conceptCache = {};
  function conceptMap(card, orientation) {
    var key = card.id + ':' + orientation;
    if (conceptCache[key]) return conceptCache[key];
    var map = {};
    var kws = orientation === 'rev' ? card.revKeywords : card.upKeywords;
    var gist = orientation === 'rev' ? card.rev : card.up;
    kws.forEach(function (k) {
      k.split(/[^A-Za-z]+/).forEach(function (t) {
        var s = stem(t);
        if (s) map[s] = 2;
      });
    });
    gist.split(/[^A-Za-z]+/).forEach(function (t) {
      if (t.length < 5) return;
      var s = stem(t);
      if (s && !map[s]) map[s] = 1;
    });
    conceptCache[key] = map;
    return map;
  }

  function splitSentences(text) {
    return String(text).split(/[.!?\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function cardMentionRegexes(card) {
    var names = [card.name.toLowerCase()];
    if (card.arcana === 'major') {
      names.push(card.name.toLowerCase().replace(/^the /, ''));
    } else {
      names.push(String(card.number <= 10 ? card.number : '') + ' of ' + card.suit);
      names.push(card.rankName.toLowerCase() + ' of ' + card.suit);
    }
    return names.filter(function (n) { return n && n !== ' of ' + card.suit; })
      .map(function (n) { return new RegExp('\\b' + escapeRe(n) + '\\b'); });
  }

  var POSITION_ALIASES = {
    you: ['your heart', 'you are', 'the querent'], them: ['their heart', 'the other person', 'they are'],
    echo: ['echo', 'between you'], depth: ['hidden', 'depth', 'beneath', 'unspoken'],
    heading: ['where it heads', 'heading', 'direction'], past: ['past'], present: ['present', 'right now'],
    future: ['future', 'ahead'], challenge: ['challenge', 'crosses', 'obstacle'], foundation: ['foundation', 'root'],
    crown: ['crown', 'goal'], environment: ['environment', 'surroundings', 'outside influence'],
    hopes: ['hopes', 'fears'], outcome: ['outcome', 'result'], self: ['self', 'attitude']
  };

  function positionPhrases(pos) {
    var label = pos.label.toLowerCase().replace(/^\d+\s*·\s*/, '');
    var list = [label];
    (POSITION_ALIASES[pos.key] || []).forEach(function (a) { list.push(a); });
    return list;
  }

  function includesAny(sentence, phrases) {
    for (var i = 0; i < phrases.length; i++) {
      if (new RegExp('\\b' + escapeRe(phrases[i]) + '\\b').test(sentence)) return true;
    }
    return false;
  }

  // ---- Criterion 1: Card & Position Alignment ----
  function evalAlignment(input, byId) {
    var sentences = splitSentences(input.text.toLowerCase());
    var perCard = [];
    var points = [];
    var total = 0;

    input.cards.forEach(function (c, i) {
      var card = byId[c.id];
      var pos = input.spread.positions[i];
      var orient = c.reversed ? 'rev' : 'up';
      var opposite = c.reversed ? 'up' : 'rev';
      var expMap = conceptMap(card, orient);
      var oppMap = conceptMap(card, opposite);
      var nameRes = cardMentionRegexes(card);
      var posPhrases = positionPhrases(pos);

      var seg = [];
      var namedCard = false;
      var namedPosition = false;
      sentences.forEach(function (s) {
        var hitName = nameRes.some(function (re) { return re.test(s); });
        var hitPos = includesAny(s, posPhrases);
        if (hitName) namedCard = true;
        if (hitPos) namedPosition = true;
        if (hitName || hitPos) seg.push(s);
      });
      var scope = seg.length ? seg.join(' ') : sentences.join(' ');
      var segStems = stems(scope);

      var exp = 0, opp = 0, shared = 0;
      Object.keys(segStems).forEach(function (s) {
        var e = expMap[s], o = oppMap[s];
        if (e && o) shared += 1;
        else if (e) exp += e;
        else if (o) opp += o;
      });

      var level, score;
      if (opp >= 2 && opp > exp) { level = 'flipped'; score = 0.25; }
      else if (exp >= 3) { level = 'strong'; score = 1; }
      else if (exp >= 1) { level = 'some'; score = 0.6; }
      else if (shared > 0) { level = 'some'; score = 0.4; }
      else if (namedCard || namedPosition) { level = 'thin'; score = 0.2; }
      else { level = 'missing'; score = 0; }

      if (namedPosition || namedCard) score = Math.min(1, score + 0.05);
      total += score;

      perCard.push({
        id: card.id, name: card.name, reversed: !!c.reversed, position: pos.label,
        level: level, namedCard: namedCard, namedPosition: namedPosition
      });

      var orientLabel = c.reversed ? 'reversed' : 'upright';
      var kw = (c.reversed ? card.revKeywords : card.upKeywords).slice(0, 4).join(', ');
      var head = card.name + ' (' + pos.label.replace(/^\d+\s*·\s*/, '') + ', ' + orientLabel + ')';
      if (level === 'strong') {
        points.push({ type: 'good', text: head + ': your wording fits this card’s ' + orientLabel + ' meaning.' });
      } else if (level === 'some') {
        points.push({ type: 'tip', text: head + ': partly there. Lean further into ' + kw + '.' });
      } else if (level === 'flipped') {
        points.push({
          type: 'tip',
          text: head + ': your wording sounds like the ' + (c.reversed ? 'upright' : 'reversed') +
            ' meaning. For ' + orientLabel + ', think ' + kw + '.'
        });
      } else if (level === 'thin') {
        points.push({ type: 'tip', text: head + ': you mention it, but not what it means. Try ' + kw + '.' });
      } else {
        points.push({ type: 'tip', text: head + ': not covered in your reading. Key ideas: ' + kw + '.' });
      }
      if (!namedPosition && level !== 'missing') {
        points.push({ type: 'tip', text: 'Tie ' + card.short + ' to its slot, “' + pos.label.replace(/^\d+\s*·\s*/, '') + '”: ' + pos.hint.toLowerCase() + '.' });
      }
    });

    var score = Math.round(100 * total / input.cards.length);
    return {
      criterion: {
        id: 'alignment', title: 'Card & Position Alignment', score: score, stars: toStars(score),
        summary: score >= 62 ? 'Your reading is grounded in the cards and where they landed.' :
          'Anchor each card’s upright/reversed meaning to its position in the spread.',
        points: points
      },
      perCard: perCard
    };
  }

  // ---- Criterion 2: Narrative Cohesion ----
  var CONNECTORS = ['because', 'therefore', 'however', 'but', 'while', 'whereas', 'so', 'as a result', 'meanwhile',
    'together', 'ultimately', 'in contrast', 'on the other hand', 'this suggests', 'which', 'then', 'since',
    'despite', 'yet', 'overall', 'in the end', 'leads to', 'leading to', 'builds on', 'although', 'and so', 'before', 'after'];
  var ADVICE_RE = /\b(should|could|advise|advice|recommend|suggest|consider|try to|next step|overall|in summary|ultimately|bottom line|my reading|i would|they can|you can)\b/;

  function evalCohesion(input, perCard, byId) {
    var text = input.text.toLowerCase();
    var words = (text.match(/[a-z']+/g) || []).length;
    var n = input.cards.length;
    var sentences = splitSentences(text).length;

    var used = CONNECTORS.filter(function (c) { return new RegExp('\\b' + escapeRe(c) + '\\b').test(text); });
    var mentioned = perCard.filter(function (p) { return p.namedCard || p.namedPosition; }).length;

    var qStems = Object.keys(stems(input.question || ''));
    var tStems = stems(text);
    var qHit = qStems.filter(function (s) { return tStems[s]; }).length;
    var qRatio = qStems.length ? Math.min(1, qHit / Math.min(3, qStems.length)) : 0.6;

    var lengthPts = Math.round(20 * Math.min(1, words / (n * 14)));
    var connPts = Math.round(25 * Math.min(1, used.length / Math.max(2, n - 1)));
    var mentionPts = Math.round(20 * mentioned / n);
    var questionPts = Math.round(15 * qRatio);
    var concl = ADVICE_RE.test(text);
    var conclPts = concl ? 20 : 0;
    var score = Math.min(100, lengthPts + connPts + mentionPts + questionPts + conclPts);

    var points = [];
    if (words >= n * 14) points.push({ type: 'good', text: 'You wrote enough (' + words + ' words) to say something about every card.' });
    else points.push({ type: 'tip', text: 'Your reading is short (' + words + ' words). Aim for a sentence or two per card, plus a conclusion.' });

    if (used.length >= Math.max(2, n - 1)) points.push({ type: 'good', text: 'Good use of linking words (' + used.slice(0, 3).join(', ') + ') to connect cards.' });
    else points.push({ type: 'tip', text: 'Link the cards with words like “because”, “however” or “which leads to” so it reads as one story, not a list.' });

    if (mentioned === n) points.push({ type: 'good', text: 'Every card or position is referenced.' });
    else points.push({ type: 'tip', text: 'Only ' + mentioned + ' of ' + n + ' cards or positions are referenced by name.' });

    if (qStems.length && qRatio >= 0.7) points.push({ type: 'good', text: 'You stay close to the question that was asked.' });
    else if (qStems.length) points.push({ type: 'tip', text: 'Echo the question’s own words so your reading answers it directly.' });

    if (concl) points.push({ type: 'good', text: 'You end with advice or a clear takeaway.' });
    else points.push({ type: 'tip', text: 'Finish with a direct answer or piece of advice (e.g. “Overall, I would suggest…”).' });

    return {
      id: 'cohesion', title: 'Narrative Cohesion', score: score, stars: toStars(score),
      summary: score >= 62 ? 'Your cards read like one connected answer.' :
        'Weave the cards into a single story that answers the question.',
      points: points,
      stats: { words: words, sentences: sentences, connectors: used.length }
    };
  }

  // ---- Criterion 3: Professional Reader's Perspective ----
  var NUMBER_MEANING = {
    1: 'new beginnings', 2: 'choices and balance', 3: 'growth and collaboration', 4: 'stability and structure',
    5: 'conflict and change', 6: 'harmony and transition', 7: 'assessment and challenge', 8: 'movement and mastery',
    9: 'near-completion', 10: 'completion or overload'
  };
  var RANK_WORD = { 11: 'Page', 12: 'Knight', 13: 'Queen', 14: 'King' };
  var NUM_WORDS = '(two|three|four|five|six|seven|eight|nine|ten|ace|twice|repeat|repeated|number|numerolog|multiple|both|pair)';

  function analyzePatterns(cardsIn, byId) {
    var list = cardsIn.map(function (c) { return { card: byId[c.id], reversed: !!c.reversed }; });
    var total = list.length;
    var patterns = [];
    var minors = list.filter(function (x) { return x.card.arcana === 'minor'; });
    var majors = list.filter(function (x) { return x.card.arcana === 'major'; });
    var suits = global.TarotData.suits;

    // Suit dominance
    var suitCount = {};
    minors.forEach(function (x) { suitCount[x.card.suit] = (suitCount[x.card.suit] || 0) + 1; });
    Object.keys(suitCount).forEach(function (s) {
      if (suitCount[s] >= 3 && suitCount[s] >= minors.length / 2) {
        patterns.push({
          id: 'suit-' + s, title: suits[s].name + ' dominate (' + suitCount[s] + ' of ' + minors.length + ' minors)',
          detail: 'A strong ' + suits[s].element + ' presence points to a situation centred on ' + suits[s].theme + '.',
          re: new RegExp('\\b(' + s + '|' + suits[s].element.toLowerCase() + '|suit|' + suits[s].theme.split(/, | and /).join('|') + ')\\b')
        });
      }
    });

    // Major Arcana density
    if (total >= 3 && majors.length / total >= 0.4 && majors.length >= 2) {
      patterns.push({
        id: 'majors', title: 'Heavy on Major Arcana (' + majors.length + ' of ' + total + ')',
        detail: 'Many Major cards suggest big, fated or life-shaping themes rather than everyday details.',
        re: /\b(major|arcana|big|fated|destiny|karmic|life lesson|archetyp|significant)\b/
      });
    } else if (total >= 5 && majors.length === 0) {
      patterns.push({
        id: 'no-majors', title: 'No Major Arcana',
        detail: 'With only Minor cards, the matter is practical and within the querent’s influence.',
        re: /\b(minor|everyday|day-to-day|practical|control|within)\b/
      });
    }

    // Reversal ratio
    var rev = list.filter(function (x) { return x.reversed; }).length;
    if (total >= 3 && rev / total >= 0.5) {
      patterns.push({
        id: 'reversals', title: 'Many reversals (' + rev + ' of ' + total + ')',
        detail: 'A high share of reversed cards often signals blocked, internal or delayed energy.',
        re: /\b(revers\w*|upside|blocked|internal\w*|inward|delay\w*)\b/
      });
    } else if (total >= 5 && rev === 0) {
      patterns.push({
        id: 'upright', title: 'All cards upright',
        detail: 'No reversals: the energy is flowing outward and is largely unobstructed.',
        re: /\b(upright|flowing|unobstructed|no revers\w*|all upright|open)\b/
      });
    }

    // Repeated numbers (minors 1-10)
    var rankCount = {};
    minors.forEach(function (x) { if (x.card.number <= 10) rankCount[x.card.number] = (rankCount[x.card.number] || 0) + 1; });
    Object.keys(rankCount).forEach(function (r) {
      if (rankCount[r] >= 2) {
        patterns.push({
          id: 'num-' + r, title: 'Repeated number ' + r + ' (×' + rankCount[r] + ')',
          detail: 'The number ' + r + ' echoes themes of ' + NUMBER_MEANING[r] + '.',
          re: new RegExp('\\b(' + r + 's?|' + NUM_WORDS + ')\\b')
        });
      }
    });

    // Court cards
    var courts = minors.filter(function (x) { return x.card.number >= 11; });
    if (total >= 5 && courts.length >= 3) {
      patterns.push({
        id: 'courts', title: 'Many court cards (' + courts.length + ')',
        detail: 'Several court cards suggest the situation involves many people or personalities.',
        re: /\b(court|people|personalit\w*|figures?|persons?|page|knight|queen|king)\b/
      });
    } else {
      var courtRank = {};
      courts.forEach(function (x) { courtRank[x.card.number] = (courtRank[x.card.number] || 0) + 1; });
      Object.keys(courtRank).forEach(function (r) {
        if (courtRank[r] >= 2) {
          patterns.push({
            id: 'court-' + r, title: 'Two ' + RANK_WORD[r] + 's',
            detail: 'Repeated ' + RANK_WORD[r] + 's can point to the same energy appearing in different areas or people.',
            re: new RegExp('\\b(' + RANK_WORD[r].toLowerCase() + 's?|court|people|twice|both)\\b')
          });
        }
      });
    }
    return patterns;
  }

  var RELATION_RE = /\b(together|pattern|both|also|contrast|echo\w*|mirror\w*|combin\w*|alongside|reinforc\w*|balanc\w*|between)\b/g;

  function evalPro(input, byId) {
    var text = input.text.toLowerCase();
    var patterns = analyzePatterns(input.cards, byId);
    var points = [];
    var score;
    patterns.forEach(function (p) {
      p.addressed = p.re.test(text);
      points.push({
        type: p.addressed ? 'good' : 'tip',
        text: (p.addressed ? 'You picked up on: ' : 'Worth noting: ') + p.title + '. ' + p.detail
      });
    });
    var rel = (text.match(RELATION_RE) || []).length;
    if (patterns.length) {
      var addressed = patterns.filter(function (p) { return p.addressed; }).length;
      score = Math.round(20 + 60 * addressed / patterns.length + (rel >= 2 ? 20 : rel === 1 ? 10 : 0));
    } else {
      score = rel >= 3 ? 85 : rel === 2 ? 70 : rel === 1 ? 50 : 30;
      points.push({
        type: 'tip',
        text: 'No standout pattern in this spread (suits, Majors, reversals and numbers are evenly spread). Compare cards directly: which two reinforce or contradict each other?'
      });
    }
    score = Math.min(100, score);
    if (rel >= 2) points.push({ type: 'good', text: 'You compare cards with each other, which is what separates a reading from a list of meanings.' });
    else points.push({ type: 'tip', text: 'Show how at least two cards relate (reinforce, contrast or explain each other).' });

    return {
      criterion: {
        id: 'pro', title: 'Professional Reader’s Perspective', score: score, stars: toStars(score),
        summary: score >= 62 ? 'You are reading across the spread, not just card by card.' :
          'Look at the whole spread: suits, Majors, reversals, repeated numbers and how cards relate.',
        points: points
      },
      patterns: patterns.map(function (p) { return { id: p.id, title: p.title, detail: p.detail, addressed: p.addressed }; })
    };
  }

  function toStars(score) {
    return score >= 80 ? 5 : score >= 62 ? 4 : score >= 45 ? 3 : score >= 28 ? 2 : 1;
  }

  function evaluateReading(input) {
    var byId = global.TarotData.byId;
    var text = String(input.text || '').trim();
    var wordCount = (text.match(/[A-Za-z']+/g) || []).length;
    if (wordCount < 8) {
      return { engine: 'rules-v1', tooShort: true, overall: { score: 0, stars: 0 }, criteria: [], patterns: analyzePatterns(input.cards, byId).map(function (p) { return { id: p.id, title: p.title, detail: p.detail, addressed: false }; }), perCard: [] };
    }
    var data = { spread: input.spread, cards: input.cards, question: input.question || '', text: text };
    var a = evalAlignment(data, byId);
    var c = evalCohesion(data, a.perCard, byId);
    var p = evalPro(data, byId);
    var overall = Math.round((a.criterion.score + c.score + p.criterion.score) / 3);
    return {
      engine: 'rules-v1',
      overall: { score: overall, stars: toStars(overall) },
      criteria: [a.criterion, c, p.criterion],
      patterns: p.patterns,
      perCard: a.perCard
    };
  }

  global.CoachEngine = { evaluateReading: evaluateReading, analyzePatterns: analyzePatterns, version: 'rules-v1' };
})(typeof window !== 'undefined' ? window : globalThis);
