/*
 * 祝日・休業日 計算ロジック（holidays.js）— グレーアウト表示専用（非権威）
 *
 * ■ 目的
 *   入力グリッドの平日セルを薄く色付けする「見た目のヒント」用に、
 *   その日が休業日らしいか（国民の祝日／年末年始／盆）を計算で返す。
 *   ★正しさには関与しない★。点検したか否かは常に dayHasMeasurement（データの有無）が唯一の真。
 *   入力はブロックしない。祝日シート（手動メンテ）は読まない。
 *
 * ■ 内容
 *   ・国民の祝日: 固定祝日＋ハッピーマンデー＋春分/秋分(計算)＋振替休日＋国民の休日（〜2099年程度）
 *   ・年末年始: 12/29〜1/3（毎年固定）
 *   ・盆:       8/13〜8/16（毎年固定）
 *   ・一度きりの特別祝日（五輪移動・即位日等）は計算外 → 下の SPECIAL_HOLIDAYS に手で追記。
 *
 * ■ 改元・天皇誕生日について
 *   天皇誕生日は令和(2020-)で2/23。過去の昭和/平成分は対象期間外のため未対応。
 */
(function (global) {
  'use strict';

  // 一度きりの特別祝日（必要時のみ手で追記）。例: '2020-07-23':'海の日(五輪)'
  var SPECIAL_HOLIDAYS = {
    // '2019-05-01': '即位の日',
    // '2019-10-22': '即位礼正殿の儀',
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function mkLocal(v) {
    if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate(), 12);
    var s = String(v).trim();
    var m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null;
  }

  // 春分の日（1900-2099 近似式）
  function vernalEquinox(y) {
    return Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
  }
  // 秋分の日（1900-2099 近似式）
  function autumnalEquinox(y) {
    return Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
  }
  // その年・月の第n月曜の日（ハッピーマンデー用）
  function nthMonday(y, m, n) {
    var first = new Date(y, m - 1, 1).getDay();      // 0=日..6=土
    return 1 + ((8 - first) % 7) + (n - 1) * 7;
  }

  var _cache = {}; // year -> { 'YYYY-MM-DD': name }

  // 国民の祝日（振替休日・国民の休日を含む）を年単位で計算。
  function nationalHolidays(year) {
    if (_cache[year]) return _cache[year];
    var base = {}; // 'YYYY-MM-DD' -> name（固定＋ハッピーマンデー＋春分秋分）
    function add(mm, dd, name) { base[year + '-' + pad(mm) + '-' + pad(dd)] = name; }
    add(1, 1, '元日');
    add(2, 11, '建国記念の日');
    add(2, 23, '天皇誕生日');
    add(4, 29, '昭和の日');
    add(5, 3, '憲法記念日');
    add(5, 4, 'みどりの日');
    add(5, 5, 'こどもの日');
    add(8, 11, '山の日');
    add(11, 3, '文化の日');
    add(11, 23, '勤労感謝の日');
    add(1, nthMonday(year, 1, 2), '成人の日');
    add(7, nthMonday(year, 7, 3), '海の日');
    add(9, nthMonday(year, 9, 3), '敬老の日');
    add(10, nthMonday(year, 10, 2), 'スポーツの日');
    add(3, vernalEquinox(year), '春分の日');
    add(9, autumnalEquinox(year), '秋分の日');

    var result = {};
    for (var k in base) result[k] = base[k];

    // 国民の休日: 前後がともに「祝日(base)」かつ自身が非祝日・非日曜の平日（祝日法の趣旨）
    var start = new Date(year, 0, 1, 12), end = new Date(year, 11, 31, 12);
    for (var d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      var key = ymd(d);
      if (base[key]) continue;
      if (d.getDay() === 0) continue; // 日曜は対象外
      var prev = new Date(d); prev.setDate(prev.getDate() - 1);
      var next = new Date(d); next.setDate(next.getDate() + 1);
      if (base[ymd(prev)] && base[ymd(next)]) result[key] = '国民の休日';
    }

    // 振替休日: 祝日(result=base+国民の休日)が日曜なら、その後の非祝日を振替休日にする（連休連鎖対応）
    var withCitizen = {};
    for (var k2 in result) withCitizen[k2] = result[k2];
    for (var d2 = new Date(start); d2 <= end; d2.setDate(d2.getDate() + 1)) {
      var key2 = ymd(d2);
      if (!withCitizen[key2]) continue;
      if (d2.getDay() !== 0) continue; // 日曜の祝日のみ振替対象
      var c = new Date(d2);
      do { c.setDate(c.getDate() + 1); } while (withCitizen[ymd(c)] || result[ymd(c)]);
      if (!result[ymd(c)]) result[ymd(c)] = '振替休日';
    }

    _cache[year] = result;
    return result;
  }

  function isNationalHoliday(v) { var d = mkLocal(v); return !!d && !!nationalHolidays(d.getFullYear())[ymd(d)]; }

  // 年末年始: 12/29〜1/3
  function isYearEndNewYear(v) {
    var d = mkLocal(v); if (!d) return false;
    var m = d.getMonth() + 1, day = d.getDate();
    return (m === 12 && day >= 29) || (m === 1 && day <= 3);
  }
  // 盆: 8/13〜8/16
  function isObon(v) {
    var d = mkLocal(v); if (!d) return false;
    return (d.getMonth() + 1) === 8 && d.getDate() >= 13 && d.getDate() <= 16;
  }
  function isSpecialHoliday(v) { var d = mkLocal(v); return !!d && !!SPECIAL_HOLIDAYS[ymd(d)]; }

  // グレーアウト判定（見た目専用・非権威）: 国民の祝日／年末年始／盆／特別祝日 のいずれか。
  function isGrayoutDay(v, opts) {
    opts = opts || {};
    var d = mkLocal(v); if (!d) return false;
    if (isNationalHoliday(d) || isSpecialHoliday(d)) return true;
    if (opts.obon !== false && isObon(d)) return true;          // 既定: 盆も対象（opts.obon=false で無効化可）
    if (opts.yearEnd !== false && isYearEndNewYear(d)) return true;
    return false;
  }

  // 祝日名（無ければ ''）。年末年始/盆/特別も名称を返す。
  function holidayName(v) {
    var d = mkLocal(v); if (!d) return '';
    var n = nationalHolidays(d.getFullYear())[ymd(d)];
    if (n) return n;
    if (SPECIAL_HOLIDAYS[ymd(d)]) return SPECIAL_HOLIDAYS[ymd(d)];
    if (isYearEndNewYear(d)) return '年末年始';
    if (isObon(d)) return '盆';
    return '';
  }

  var API = {
    SPECIAL_HOLIDAYS: SPECIAL_HOLIDAYS,
    nationalHolidays: nationalHolidays,
    isNationalHoliday: isNationalHoliday,
    isYearEndNewYear: isYearEndNewYear,
    isObon: isObon,
    isGrayoutDay: isGrayoutDay,
    holidayName: holidayName,
    ymd: ymd
  };
  global.Holidays = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
