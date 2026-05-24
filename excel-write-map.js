// shiwagi Excel 書込マップ (Phase 38-b4)
// 目的: index.html の fillWaterSheet (L5072-5341) と fillQualityReportSheet (L5901-6003) の write 構造を
//       1 か所に集約した reference document。実 write 経路の動的化は Phase 38-b4+ で実施。
//
// 設計の元: kake b2 (70%) + yoshiwa b1 (30%) + shiwagi 固有 2-列マップ拡張
// base commit: 8a7ba5e (Phase 23-B-2、null_skip 3 keys 適用済)
// 抽出: Phase 38-b4 Stage 1 報告 (2026-05-24)

(function () {
  'use strict';

  // ===== シート定義 =====
  // shiwagi 固有: wb.getWorksheet(index) で番号ベース取得 (他 4 アプリは名前ベース)
  // 念のため name も両持ちにし、将来名前ベース移行時の互換性を確保
  const SHEETS = {
    DAILY_WATER:       { name: '日常水質',       index: 1 },
    EQUIPMENT:         { name: '機器運転時間',   index: 2 },
    MECHANICAL:        { name: '日常機械設備',   index: 3 },
    ELECTRICAL:        { name: '日常電気設備',   index: 4 },
    MONTHLY_REPORT:    { name: '水質管理報告',   index: 5 },
    MONTHLY_OPERATION: { name: '運転管理月報',   index: 6 }
  };

  // ===== helper 関数 =====
  // _daily: daily 書込位置を返す
  //   row_offset: 週内行オフセット (offset=weekOffsets[w] を別途加算する)
  //   mon_col:    mon 曜日の列番号 (tue/wed/thu/nextMon は +1/+2/+3/+4)
  //               shiwagi 固有: 累積読値=9 (dayColMap), 水質/inspector=10 (dayColMapWQ)
  function _daily(row_offset, mon_col) {
    return { sheet: SHEETS.DAILY_WATER, row_offset: row_offset, mon_col: mon_col };
  }

  // _monthly: monthly 書込位置を返す
  //   block: 1=row1 ページ (dataRow1=7+d, L5922), 2=row2 ページ (dataRow2=49+d, L5923)
  //   col:   列番号 (A=1)
  function _monthly(block, col) {
    return { sheet: SHEETS.MONTHLY_REPORT, block: block, col: col };
  }

  // _entry: 統一エントリー
  function _entry(daily, monthly, null_skip) {
    return {
      storage_unit: 'key',
      section: null,
      daily: daily || null,
      monthly: monthly || null,
      null_skip: !!null_skip
    };
  }

  // ===== 書込マップ本体 (ALL_FIELDS 36 keys、index.html L1449-1460 順) =====
  const EXCEL_WRITE_MAP = {
    // --- 累積読値 (Row 4-9, mon_col=9 = dayColMap) ---
    power200v:        _entry(_daily(4, 9),   null),
    power100v:        _entry(_daily(5, 9),   null),
    diesel:           _entry(_daily(6, 9),   null),
    returnSludge:     _entry(_daily(7, 9),   null),
    excessSludge:     _entry(_daily(8, 9),   null),
    discharge:        _entry(_daily(9, 9),   null),

    // --- 水温 (Row 13-15, mon_col=10) → monthly block 1 col 3-6 ---
    tempIn:           _entry(_daily(13, 10), _monthly(1, 3)),
    tempDitch:        _entry(_daily(14, 10), _monthly(1, 4)),
    tempFinal:        _entry(null,           _monthly(1, 5),  true),  // Phase 23-B-2 null_skip
    tempOut:          _entry(_daily(15, 10), _monthly(1, 6)),

    // --- 外観 (Row 16-18, mon_col=10) → monthly block 1 col 7-10 ---
    appearanceIn:     _entry(_daily(16, 10), _monthly(1, 7)),
    appearanceDitch:  _entry(_daily(17, 10), _monthly(1, 8)),
    appearanceFinal:  _entry(null,           _monthly(1, 9)),         // monthly only
    appearanceOut:    _entry(_daily(18, 10), _monthly(1, 10)),

    // --- 透視度 (Row 19-20, mon_col=10) → monthly block 2 col 3-5 ---
    transIn:          _entry(_daily(19, 10), _monthly(2, 3)),
    transFinal:       _entry(null,           _monthly(2, 4),  true),  // Phase 23-B-2 null_skip
    transOut:         _entry(_daily(20, 10), _monthly(2, 5)),

    // --- 臭気 (Row 21-23, mon_col=10) → monthly block 1 col 11-14 ---
    odorIn:           _entry(_daily(21, 10), _monthly(1, 11)),
    odorDitch:        _entry(_daily(22, 10), _monthly(1, 12)),
    odorFinal:        _entry(null,           _monthly(1, 13)),        // monthly only
    odorOut:          _entry(_daily(23, 10), _monthly(1, 14)),

    // --- PH (Row 24-26, mon_col=10) → monthly block 1 col 15-18 ---
    phIn:             _entry(_daily(24, 10), _monthly(1, 15)),
    phDitch:          _entry(_daily(25, 10), _monthly(1, 16)),
    phFinal:          _entry(null,           _monthly(1, 17), true),  // Phase 23-B-2 null_skip
    phOut:            _entry(_daily(26, 10), _monthly(1, 18)),

    // --- SV (Row 27-30, mon_col=10) → sv30 のみ monthly block 2 col 8 ---
    sv10:             _entry(_daily(27, 10), null),
    sv20:             _entry(_daily(28, 10), null),
    sv30:             _entry(_daily(29, 10), _monthly(2, 8)),
    sv24h:            _entry(_daily(30, 10), null),

    // --- MLSS / MLDO / 汚泥界面 ---
    // MLDO: daily 行なし (L5213 コメント「テンプレに MLDO 行がない」明記) → monthly のみ (yoshiwa-style)
    mlss:             _entry(_daily(31, 10), _monthly(2, 6)),
    mldo:             _entry(null,           _monthly(2, 7)),         // monthly only, yoshiwa-style
    sludgeLevel:      _entry(_daily(32, 10), null),

    // --- 塩素 (Row 33-34) → chlorine のみ monthly block 2 col 9 ---
    chlorine:         _entry(_daily(33, 10), _monthly(2, 9)),
    chlorineDose:     _entry(_daily(34, 10), null),                   // shiwagi 固有 (他 4 アプリにない)

    // --- 備考 → monthly のみ block 2 col 10 ---
    bikou:            _entry(null,           _monthly(2, 10)),        // monthly only

    // --- 測定者 (Row 12, mon_col=10 = inspColMap) ---
    inspector:        _entry(_daily(12, 10), null)
  };

  // ===== NULL_SKIP_KEYS_DIRECT (動的算出、Phase 23-B-2 適用 3 キー) =====
  const NULL_SKIP_KEYS_DIRECT = Object.keys(EXCEL_WRITE_MAP)
    .filter(function (k) { return EXCEL_WRITE_MAP[k].null_skip; });

  // ===== ALL_FIELDS 期待値 (index.html L1449-1460 と同順) =====
  const ALL_FIELDS_EXPECTED = [
    'power200v', 'power100v', 'diesel', 'returnSludge', 'excessSludge', 'discharge',
    'tempIn', 'tempDitch', 'tempFinal', 'tempOut',
    'appearanceIn', 'appearanceDitch', 'appearanceFinal', 'appearanceOut',
    'transIn', 'transFinal', 'transOut',
    'odorIn', 'odorDitch', 'odorFinal', 'odorOut',
    'phIn', 'phDitch', 'phFinal', 'phOut',
    'sv10', 'sv20', 'sv30', 'sv24h',
    'mlss', 'mldo', 'sludgeLevel',
    'chlorine', 'chlorineDose',
    'bikou', 'inspector'
  ];

  // ===== 整合性検証 =====
  function verifyAgainstShiwagiFields() {
    const issues = [];
    const mapKeys = Object.keys(EXCEL_WRITE_MAP);

    // Verify 1: ALL_FIELDS ↔ MAP 双方向 (missing / extra)
    const missingInMap = ALL_FIELDS_EXPECTED.filter(function (k) { return mapKeys.indexOf(k) < 0; });
    const extraInMap   = mapKeys.filter(function (k) { return ALL_FIELDS_EXPECTED.indexOf(k) < 0; });
    if (missingInMap.length) issues.push('MAP missing keys: ' + missingInMap.join(','));
    if (extraInMap.length)   issues.push('MAP extra keys: '   + extraInMap.join(','));

    // Verify 2: NULL_SKIP_KEYS_DIRECT 期待値
    const expectedNullSkip = ['tempFinal', 'transFinal', 'phFinal'];
    const actualSorted   = NULL_SKIP_KEYS_DIRECT.slice().sort();
    const expectedSorted = expectedNullSkip.slice().sort();
    if (JSON.stringify(actualSorted) !== JSON.stringify(expectedSorted)) {
      issues.push('null_skip mismatch: expected=[' + expectedSorted.join(',') + '] actual=[' + actualSorted.join(',') + ']');
    }

    // Verify 3-5: 終沈 3 キーの monthly 構造 (col 数値, block ∈ {1,2}, daily===null)
    for (let i = 0; i < expectedNullSkip.length; i++) {
      const k = expectedNullSkip[i];
      const entry = EXCEL_WRITE_MAP[k];
      if (!entry) { issues.push(k + ': entry missing'); continue; }
      if (entry.daily !== null) issues.push(k + ': daily should be null, got ' + JSON.stringify(entry.daily));
      if (!entry.monthly) { issues.push(k + ': monthly should not be null'); continue; }
      if (typeof entry.monthly.col !== 'number') issues.push(k + ': monthly.col not number (' + entry.monthly.col + ')');
      if ([1, 2].indexOf(entry.monthly.block) < 0) issues.push(k + ': monthly.block not in {1,2} (' + entry.monthly.block + ')');
    }

    // Verify 6: SHEETS index 1-6 整合
    const expectedIndices = [1, 2, 3, 4, 5, 6];
    const actualIndices = Object.keys(SHEETS).map(function (k) { return SHEETS[k].index; }).sort(function (a, b) { return a - b; });
    if (JSON.stringify(actualIndices) !== JSON.stringify(expectedIndices)) {
      issues.push('SHEETS indices mismatch: expected=' + JSON.stringify(expectedIndices) + ' actual=' + JSON.stringify(actualIndices));
    }

    // Verify 7: daily entries の mon_col ∈ {9, 10} (shiwagi 固有 2 列マップ整合)
    for (let i = 0; i < mapKeys.length; i++) {
      const k = mapKeys[i];
      const entry = EXCEL_WRITE_MAP[k];
      if (entry.daily && [9, 10].indexOf(entry.daily.mon_col) < 0) {
        issues.push(k + ': daily.mon_col not in {9,10} (' + entry.daily.mon_col + ')');
      }
    }

    if (issues.length) {
      console.error('[excel-write-map.js] verify FAILED (' + issues.length + ' issues):');
      issues.forEach(function (msg) { console.error('  - ' + msg); });
      return false;
    }
    console.log('[excel-write-map.js] verify OK (36 keys, 3 null_skip, 6 sheets, mon_col groups {9,10})');
    return true;
  }

  // ===== グローバル公開 =====
  window.EXCEL_WRITE_MAP = EXCEL_WRITE_MAP;
  window.EXCEL_WRITE_MAP_SHEETS = SHEETS;
  window.NULL_SKIP_KEYS_DIRECT = NULL_SKIP_KEYS_DIRECT;
  window.EXCEL_WRITE_MAP_NULL_SKIP_KEYS_DIRECT = NULL_SKIP_KEYS_DIRECT;
  window.verifyAgainstShiwagiFields = verifyAgainstShiwagiFields;

  // ===== 自動 verify (読込時に 1 回) =====
  try {
    verifyAgainstShiwagiFields();
  } catch (e) {
    console.error('[excel-write-map.js] verify threw:', e);
  }
})();
