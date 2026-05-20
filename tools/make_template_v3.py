"""
Phase 29-b: shiwagi テンプレ v2 -> v3 化
- 全 sheet*.xml で <v>NaN</v>, <v>Infinity</v>, <v>-Infinity</v>, <v>undefined</v> を削除
- template.js を上書き
"""
import re, base64, io, zipfile, sys
from pathlib import Path

TEMPLATE_JS = Path('template.js')
if not TEMPLATE_JS.exists():
    print("ERROR: template.js が見つからない（カレントディレクトリ確認）")
    sys.exit(1)

js_content = TEMPLATE_JS.read_text(encoding='utf-8')

# EXCEL_TEMPLATE_B64 を抽出（変数名・クォート種別の揺らぎに対応）
m = re.search(r"(EXCEL_TEMPLATE_B64\s*=\s*[\"'])([A-Za-z0-9+/=]+)([\"'])", js_content)
if not m:
    print("ERROR: EXCEL_TEMPLATE_B64 が template.js に見つからない")
    sys.exit(1)

prefix, b64, suffix = m.group(1), m.group(2), m.group(3)
print(f"v2 base64 size: {len(b64)} chars")

# decode
raw = base64.b64decode(b64)
print(f"v2 ZIP size: {len(raw)} bytes")

# ZIP 編集
zin = zipfile.ZipFile(io.BytesIO(raw), 'r')
out_buf = io.BytesIO()
zout = zipfile.ZipFile(out_buf, 'w', zipfile.ZIP_DEFLATED)

total_removed = 0
for name in zin.namelist():
    data = zin.read(name)
    if name.startswith('xl/worksheets/sheet') and name.endswith('.xml'):
        text = data.decode('utf-8')
        before_len = len(text)
        nan_n = text.count('<v>NaN</v>')
        inf_n = len(re.findall(r'<v>-?Infinity</v>', text))
        und_n = text.count('<v>undefined</v>')

        text = re.sub(r'<v>NaN</v>', '', text)
        text = re.sub(r'<v>-?Infinity</v>', '', text)
        text = re.sub(r'<v>undefined</v>', '', text)

        removed = nan_n + inf_n + und_n
        if removed > 0:
            print(f"  {name}: NaN={nan_n}, Infinity={inf_n}, undefined={und_n} 削除")
            total_removed += removed
        data = text.encode('utf-8')
    zout.writestr(name, data)

zin.close()
zout.close()

v3_raw = out_buf.getvalue()
v3_b64 = base64.b64encode(v3_raw).decode('ascii')
print(f"\nv3 ZIP size: {len(v3_raw)} bytes")
print(f"v3 base64 size: {len(v3_b64)} chars")
print(f"削除合計: {total_removed} 件")

if total_removed == 0:
    print("\n注意: テンプレ側に NaN/Infinity/undefined は無かった。")
    print("       実害は HTML 側の書込のみ。template.js は変更しない。")
    sys.exit(0)

# template.js 書き換え
new_js = js_content[:m.start()] + prefix + v3_b64 + suffix + js_content[m.end():]
TEMPLATE_JS.write_text(new_js, encoding='utf-8')
print("template.js 更新完了")
