/* art.js — original line-art symbols for the cards (drawn in code, no external assets).
 * Exposes window.CardArt.major(number, color) -> SVG markup for the centre of a Major Arcana card.
 * Coordinates are local to the card centre: x and y run roughly -52..52 around (0,0).
 * Minor Arcana artwork is still drawn by app.js (suit pips) until a minor set is added here.
 */
(function (global) {
  'use strict';

  var COL = '#e6c36a';

  function f(n) { return (Math.round(n * 10) / 10).toString(); }
  function path(d, fill) { return '<path d="' + d + '"' + (fill ? ' fill="' + COL + '" fill-opacity=".2"' : '') + '/>'; }
  function line(x1, y1, x2, y2) { return '<line x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2) + '"/>'; }
  function circle(x, y, r, fill) { return '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r) + '"' + (fill === 'solid' ? ' fill="' + COL + '" stroke="none"' : fill ? ' fill="' + COL + '" fill-opacity=".2"' : '') + '/>'; }
  function poly(pts, fill) {
    return '<polygon points="' + pts.map(function (p) { return f(p[0]) + ',' + f(p[1]); }).join(' ') + '"' + (fill ? ' fill="' + COL + '" fill-opacity=".2"' : '') + '/>';
  }
  function starPts(n, r1, r2, cx, cy, rot) {
    var pts = [];
    for (var i = 0; i < n * 2; i++) {
      var a = rot + i * Math.PI / n, r = i % 2 === 0 ? r1 : r2;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  }
  function rays(cx, cy, r1, r2, count, rot) {
    var s = '';
    for (var i = 0; i < count; i++) {
      var a = (rot || 0) + i * 2 * Math.PI / count;
      s += line(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a), cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
    }
    return s;
  }
  // Crescent opening to the right: outer circle R at (cx,cy) minus an inner circle r shifted by dx.
  function crescent(cx, cy, R, r, dx) {
    var x = (R * R - r * r + dx * dx) / (2 * dx);
    var y = Math.sqrt(R * R - x * x);
    return 'M' + f(cx + x) + ' ' + f(cy - y) + ' A' + R + ' ' + R + ' 0 1 0 ' + f(cx + x) + ' ' + f(cy + y) +
      ' A' + r + ' ' + r + ' 0 1 1 ' + f(cx + x) + ' ' + f(cy - y) + ' Z';
  }
  function leaf(cx, cy, len, ang) {
    var dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
    var nx = -Math.sin(ang) * len * 0.35, ny = Math.cos(ang) * len * 0.35;
    return path('M' + f(cx) + ' ' + f(cy) + ' Q' + f(cx + dx / 2 + nx) + ' ' + f(cy + dy / 2 + ny) + ' ' + f(cx + dx) + ' ' + f(cy + dy) +
      ' Q' + f(cx + dx / 2 - nx) + ' ' + f(cy + dy / 2 - ny) + ' ' + f(cx) + ' ' + f(cy) + 'Z', true);
  }

  var ART = {
    // 0 The Fool — a step off a ledge into open sky, a rising sun
    0: function () {
      return path('M-50 30 H-8 V46 M-50 30 V46') + line(-30, 30, -30, 17) + circle(-30, 14, 3.5) +
        circle(8, 22, 4) + circle(24, 11, 4) + circle(40, 0, 4) +
        circle(16, -26, 11, true) + rays(16, -26, 16, 23, 10, 0.3);
    },
    // 1 The Magician — lemniscate over a wand, four tiny suit marks
    1: function () {
      return path('M0 -30C10 -43 30 -43 30 -30C30 -17 10 -17 0 -30C-10 -43 -30 -43 -30 -30C-30 -17 -10 -17 0 -30Z') +
        line(0, -14, 0, 28) + line(-6, -14, 6, -14) + line(-5, 28, 5, 28) +
        circle(-27, 42, 4) + poly([[-14, 46], [-9, 38], [-4, 46]]) +
        '<rect x="5" y="38" width="8" height="8"/>' + poly([[27, 36], [32, 42], [27, 48], [22, 42]]);
    },
    // 2 The High Priestess — crescent between two pillars
    2: function () {
      return path('M-44 -40V40M-30 -40V40M-47 -40H-27M-47 40H-27') + path('M44 -40V40M30 -40V40M47 -40H27M47 40H27') +
        path('M-30 -40Q0 -58 30 -40') + path(crescent(-4, 0, 22, 18, 9), true) + circle(14, -6, 3, 'solid');
    },
    // 3 The Empress — Venus sign framed by wheat
    3: function () {
      return circle(0, -10, 16) + line(0, 6, 0, 38) + line(-11, 24, 11, 24) +
        path('M-42 44C-50 14-44-14-32-34') + path('M42 44C50 14 44-14 32-34') +
        leaf(-44, 24, 14, -0.6) + leaf(-47, 6, 14, -0.8) + leaf(-45, -12, 14, -1) +
        leaf(44, 24, 14, Math.PI + 0.6) + leaf(47, 6, 14, Math.PI + 0.8) + leaf(45, -12, 14, Math.PI + 1) +
        poly(starPts(5, 5, 2, 0, -10, -Math.PI / 2), true);
    },
    // 4 The Emperor — ram horns over a square block
    4: function () {
      return '<rect x="-22" y="-8" width="44" height="42"/>' + line(-22, 8, 22, 8) + line(0, 8, 0, 34) +
        path('M-14 -10C-40 -10-44-42-22-42C-8-42-8-26-20-26') + path('M14 -10C40 -10 44-42 22-42C8-42 8-26 20-26') +
        line(-34, 42, 34, 42);
    },
    // 5 The Hierophant — triple-barred staff between two pillars, two kneeling dots
    5: function () {
      return line(0, -44, 0, 30) + line(-8, -34, 8, -34) + line(-14, -22, 14, -22) + line(-20, -10, 20, -10) +
        path('M-46 -34V34M-46 -34H-36M-46 34H-36') + path('M46 -34V34M46 -34H36M46 34H36') +
        circle(-18, 26, 4) + path('M-24 40Q-18 30-12 40') + circle(18, 26, 4) + path('M12 40Q18 30 24 40');
    },
    // 6 The Lovers — two overlapping circles under a four-point star
    6: function () {
      return circle(-13, 10, 24) + circle(13, 10, 24) +
        path('M0 -48L4 -38L14 -34L4 -30L0 -20L-4 -30L-14 -34L-4 -38Z', true) + circle(0, 10, 3, 'solid');
    },
    // 7 The Chariot — wheel under a star canopy
    7: function () {
      return circle(0, 16, 24) + circle(0, 16, 5) + rays(0, 16, 5, 24, 8, 0.2) +
        path('M-38 -14Q0 -46 38 -14') + line(-38, -14, -30, 4) + line(38, -14, 30, 4) +
        poly(starPts(5, 5, 2, -16, -26, -Math.PI / 2), true) + poly(starPts(5, 5, 2, 16, -26, -Math.PI / 2), true) +
        poly(starPts(5, 5, 2, 0, -34, -Math.PI / 2), true);
    },
    // 8 Strength — a lion's mane around a face, lemniscate above
    8: function () {
      var d = '', n = 14;
      for (var i = 0; i < n * 2; i++) {
        var a = i * Math.PI / n, r = i % 2 === 0 ? 34 : 24;
        d += (i ? 'L' : 'M') + f(r * Math.cos(a)) + ' ' + f(12 + r * Math.sin(a) * 0.9);
      }
      return path(d + 'Z', true) + circle(0, 12, 15) + circle(-5, 8, 2, 'solid') + circle(5, 8, 2, 'solid') +
        path('M-6 17Q0 22 6 17') + path('M0 12V16') +
        path('M0 -34C6 -42 20 -42 20 -34C20 -26 6 -26 0 -34C-6 -42 -20 -42 -20 -34C-20 -26 -6 -26 0 -34Z');
    },
    // 9 The Hermit — hanging lantern with a six-point star, peaks below
    9: function () {
      return path('M0 -46A5 5 0 1 1 0 -36') + line(0, -36, 0, -30) +
        path('M-14 -30H14L18 14H-18Z') + poly(starPts(3, 10, 10, 0, -8, -Math.PI / 2)) + poly(starPts(3, 10, 10, 0, -8, Math.PI / 2)) +
        line(-8, 24, -12, 32) + line(0, 24, 0, 33) + line(8, 24, 12, 32) +
        path('M-50 46L-24 20L-8 36L10 14L50 46');
    },
    // 10 Wheel of Fortune — double rim, eight spokes, four markers
    10: function () {
      return circle(0, 0, 36) + circle(0, 0, 29) + circle(0, 0, 7) + rays(0, 0, 7, 29, 8, 0) +
        poly([[0, -50], [4, -44], [0, -38], [-4, -44]], true) + poly([[0, 50], [4, 44], [0, 38], [-4, 44]], true) +
        poly([[-50, 0], [-44, 4], [-38, 0], [-44, -4]], true) + poly([[50, 0], [44, 4], [38, 0], [44, -4]], true);
    },
    // 11 Justice — scales on a vertical sword
    11: function () {
      return path('M0 -44L4 -34V20H-4V-34Z', true) + line(-12, 20, 12, 20) + line(0, 20, 0, 40) +
        line(-38, -24, 38, -24) +
        line(-38, -24, -46, 6) + line(-38, -24, -30, 6) + path('M-50 6Q-38 22-26 6Z', true) +
        line(38, -24, 30, 6) + line(38, -24, 46, 6) + path('M26 6Q38 22 50 6Z', true);
    },
    // 12 The Hanged Man — suspended figure with a halo
    12: function () {
      return line(-40, -40, 40, -40) + line(0, -40, 0, -24) + path('M0 -24L-8 -14M0 -24L8 -14') +
        line(0, -24, 0, 12) + path('M0 -4L-16 8M0 -4L16 8') + circle(0, 24, 8) + circle(0, 24, 14) +
        path('M-40 -40Q-44 -32-38 -28');
    },
    // 13 Death — a rose rising over the horizon
    13: function () {
      return path('M-30 38A30 30 0 0 1 30 38') + rays(0, 38, 36, 46, 7, Math.PI) +
        path('M0 -8C7 -10 11 -4 7 2C3 8-8 6-8-2C-8-12 4-16 12-10C20-4 16 12 4 16C-10 20-22 8-18-6C-14-18-2-26 10-22', true) +
        line(0, 18, 0, 38) + leaf(0, 30, 16, -0.5) + leaf(0, 26, 16, Math.PI + 0.5);
    },
    // 14 Temperance — two cups joined by an arc of water
    14: function () {
      return path('M-42 20H-18L-22 40H-38Z', true) + path('M18 20H42L38 40H22Z', true) +
        path('M-26 16C-20-34 20-34 26 16') + path('M-6 -6C-3-12 3-12 6-6') +
        circle(-30, 4, 2, 'solid') + circle(30, 4, 2, 'solid') + circle(0, -34, 5, true) + rays(0, -34, 8, 12, 8, 0.2);
    },
    // 15 The Devil — inverted pentagram under horns, two chain links
    15: function () {
      var pts = [];
      for (var k = 0; k < 5; k++) {
        var ang = Math.PI / 2 + ((k * 2) % 5) * 2 * Math.PI / 5;
        pts.push([28 * Math.cos(ang), -4 + 28 * Math.sin(ang)]);
      }
      return circle(0, -4, 28) + poly(pts) +
        path('M-20 -26C-30-46-12-52-12-36') + path('M20 -26C30-46 12-52 12-36') +
        '<rect x="-12" y="36" width="10" height="14" rx="5"/>' + '<rect x="2" y="36" width="10" height="14" rx="5"/>';
    },
    // 16 The Tower — brick tower struck by lightning
    16: function () {
      return path('M-18 -30V46M18 -30V46M-24 -30H24M-24 -30V-38H-14V-30M-6 -38V-30M6 -30V-38H14V-30M24 -38V-30') +
        line(-18, -12, 18, -12) + line(-18, 8, 18, 8) + line(-18, 28, 18, 28) +
        line(0, -30, 0, -12) + line(-9, -12, -9, 8) + line(9, 8, 9, 28) +
        path('M46 -50L26 -20L36 -20L16 14L-2 -2', true) + circle(40, 20, 2.5, 'solid') + circle(30, 34, 2, 'solid') + circle(-34, 14, 2.5, 'solid');
    },
    // 17 The Star — eight-point star with seven small stars
    17: function () {
      var dots = '';
      for (var i = 0; i < 7; i++) {
        var a = Math.PI + (i + 0.5) * Math.PI / 7;
        dots += circle(46 * Math.cos(a), 6 + 46 * Math.sin(a) * 0.9, 2.6, 'solid');
      }
      return poly(starPts(8, 30, 10, 0, 6, -Math.PI / 2), true) + circle(0, 6, 4) + dots +
        path('M-30 46Q-15 38 0 46T30 46');
    },
    // 18 The Moon — full moon with craters over a winding path
    18: function () {
      return circle(0, -14, 24, true) + circle(-8, -20, 5) + circle(8, -8, 4) + circle(6, -24, 2.5) + rays(0, -14, 29, 35, 16, 0.1) +
        path('M-6 46C-30 36 22 28-2 18C-12 14-4 10 0 12');
    },
    // 19 The Sun — disc with alternating rays
    19: function () {
      var s = circle(0, 0, 18, true), n = 12;
      for (var i = 0; i < n; i++) {
        var a = i * 2 * Math.PI / n, a2 = a + Math.PI / n;
        s += poly([[26 * Math.cos(a - 0.14), 26 * Math.sin(a - 0.14)], [46 * Math.cos(a), 46 * Math.sin(a)], [26 * Math.cos(a + 0.14), 26 * Math.sin(a + 0.14)]]);
        s += line(24 * Math.cos(a2), 24 * Math.sin(a2), 34 * Math.cos(a2), 34 * Math.sin(a2));
      }
      return s + circle(0, 0, 8);
    },
    // 20 Judgement — a horn calling three raised hands
    20: function () {
      return path('M-44 -34L-6 -22V-6L-44 -18Z', true) + path('M-6 -30L22 -44V-2L-6 -14Z', true) +
        path('M30 -34Q38 -23 30 -12') + path('M36 -40Q50 -23 36 -6') +
        line(-26, 46, -26, 24) + path('M-34 20L-26 28L-18 20') +
        line(0, 46, 0, 22) + path('M-8 18L0 26L8 18') +
        line(26, 46, 26, 24) + path('M18 20L26 28L34 20');
    },
    // 21 The World — laurel wreath around a star, crossed ribbon
    21: function () {
      var rx = 30, ry = 40, cy = -4, out = '', i;
      function pt(deg) { var t = deg * Math.PI / 180; return [rx * Math.cos(t), cy + ry * Math.sin(t)]; }
      var a = pt(100), b = pt(260), c = pt(80), d = pt(-80);
      out += path('M' + f(a[0]) + ' ' + f(a[1]) + ' A' + rx + ' ' + ry + ' 0 0 1 ' + f(b[0]) + ' ' + f(b[1]));
      out += path('M' + f(c[0]) + ' ' + f(c[1]) + ' A' + rx + ' ' + ry + ' 0 0 0 ' + f(d[0]) + ' ' + f(d[1]));
      for (i = 0; i < 6; i++) {
        var deg = 118 + i * 25, p = pt(deg), t = deg * Math.PI / 180;
        var tan = Math.atan2(ry * Math.cos(t), -rx * Math.sin(t));
        out += leaf(p[0], p[1], 13, tan - 0.9);
        var q = pt(180 - deg), tq = Math.atan2(ry * Math.cos((180 - deg) * Math.PI / 180), -rx * Math.sin((180 - deg) * Math.PI / 180));
        out += leaf(-p[0], p[1], 13, Math.PI - tan + 0.9);
      }
      return out + poly(starPts(5, 13, 5.5, 0, cy, -Math.PI / 2), true) +
        path('M-3 44L-14 54M3 44L14 54M-3 44L10 56M3 44L-10 56');
    }
  };

  function major(number, color) {
    COL = color || '#e6c36a';
    var fn = ART[number];
    if (!fn) return '';
    return '<g transform="translate(100 172)" fill="none" stroke="' + COL + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + fn() + '</g>';
  }

  global.CardArt = { major: major };
})(typeof window !== 'undefined' ? window : globalThis);
