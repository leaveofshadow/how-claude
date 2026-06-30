#!/usr/bin/env python3
"""
md2html.py — Markdown → 带配图的 HTML 转换器（cc-bestpractice 橙皮书风格）
纯标准库实现，不依赖第三方。

用法： python3 md2html.py input.md output.html [title]
"""
import re
import sys
import html


# ============ 去AI味词替换表 ============
# 基于 anti-ai-tone-checklist.md，替换机械套路表达
AI_TONE_REPLACEMENTS = [
    # hedging 词
    (r'值得注意的是[，,。]?\s*', ''),
    (r'需要指出的是[，,。]?\s*', ''),
    (r'需要强调的是[，,。]?\s*', ''),
    (r'众所周知[，,]?\s*', ''),
    # 机械收尾
    (r'[，。]综上所述[，,。]?', '。'),
    (r'[，。]总而言之[，,。]?', '。'),
    (r'总而言之[，,]?\s*', ''),
    # 互联网黑话
    (r'赋能', '支持'),
    (r'助力', '帮助'),
    (r'抓手', '切入点'),
    (r'闭环(?!）)', '完整流程'),  # 闭环→完整流程（保留括号内的）
    (r'深度赋能', '深度支持'),
    (r'生态闭环', '完整生态'),
    # 空话形容词（谨慎，只在特定搭配）
    (r'无缝衔接', '顺畅衔接'),
    (r'无缝集成', '直接集成'),
]


def de_ai_tone(text):
    """去AI味词替换"""
    for pattern, repl in AI_TONE_REPLACEMENTS:
        text = re.sub(pattern, repl, text)
    return text


# ============ Markdown 解析 ============

def escape_inline_code(text):
    """先提取行内代码，避免被其他处理破坏"""
    placeholders = []
    def stash(m):
        placeholders.append(m.group(1))
        return f'\x00CODE{len(placeholders)-1}\x00'
    text = re.sub(r'`([^`]+)`', stash, text)
    return text, placeholders


def restore_inline_code(text, placeholders):
    for i, code in enumerate(placeholders):
        text = text.replace(f'\x00CODE{i}\x00', f'<code>{html.escape(code)}</code>')
    return text


def inline_format(text):
    """处理行内格式：加粗、链接、行内代码已提取"""
    # 加粗 **text** 或 __text__
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'__([^_]+)__', r'<strong>\1</strong>', text)
    # 斜体 *text（避免和加粗冲突，简单处理）
    # 链接 [text](url)
    def link_repl(m):
        txt, url = m.group(1), m.group(2)
        return f'<a href="{html.escape(url)}">{html.escape(txt)}</a>'
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link_repl, text)
    return text


def parse_table(lines, start):
    """从 start 行开始解析表格，返回 (html_table, next_index)"""
    # 找表格块
    block = []
    i = start
    while i < len(lines) and '|' in lines[i] and lines[i].strip():
        block.append(lines[i].strip())
        i += 1
    if len(block) < 2:
        return None, start

    # 解析行
    def split_row(row):
        # 去首尾 |，按 | 分割
        row = row.strip()
        if row.startswith('|'):
            row = row[1:]
        if row.endswith('|'):
            row = row[:-1]
        return [c.strip() for c in row.split('|')]

    header = split_row(block[0])
    separator = split_row(block[1])
    # 检测对齐
    aligns = []
    for s in separator:
        s = s.strip()
        left = s.startswith(':')
        right = s.endswith(':')
        if left and right:
            aligns.append('center')
        elif right:
            aligns.append('right')
        else:
            aligns.append('left')

    rows = [split_row(r) for r in block[2:]]

    out = ['<table>']
    # thead
    out.append('<thead><tr>')
    for j, h in enumerate(header):
        style = f' style="text-align:{aligns[j]}"' if j < len(aligns) and aligns[j] != 'left' else ''
        out.append(f'<th{style}>{inline_format(h)}</th>')
    out.append('</tr></thead><tbody>')
    for row in rows:
        out.append('<tr>')
        for j, cell in enumerate(row):
            style = f' style="text-align:{aligns[j]}"' if j < len(aligns) and aligns[j] != 'left' else ''
            out.append(f'<td{style}>{inline_format(cell)}</td>')
        out.append('</tr>')
    out.append('</tbody></table>')
    return '\n'.join(out), i


def is_compare_block(lines, i):
    """检测 ❌/✅ 对比块：连续的 '❌ 不推荐' / '✅ 推荐' 代码块或段落"""
    # 模式：```后跟 ❌ 不推荐 ... ``` 和 ```✅ 推荐 ...```
    # 简化：跳过，按普通代码块处理
    return False


def convert(md):
    """主转换函数"""
    md = de_ai_tone(md)

    # 提取代码块（fenced）
    code_blocks = []
    def stash_code(m):
        lang = m.group(1) or ''
        code = m.group(2)
        code_blocks.append((lang, code))
        return f'\x00BLOCK{len(code_blocks)-1}\x00'
    md = re.sub(r'```(\w*)\n(.*?)```', stash_code, md, flags=re.DOTALL)

    lines = md.split('\n')
    out = []
    i = 0
    paragraph = []

    def flush_para():
        nonlocal paragraph
        if paragraph:
            text = ' '.join(paragraph).strip()
            if text:
                out.append(f'<p>{inline_format(text)}</p>')
            paragraph = []

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # 还原代码块占位符的行
        if '\x00BLOCK' in stripped and re.match(r'^\x00BLOCK\d+\x00$', stripped):
            flush_para()
            idx = int(re.search(r'BLOCK(\d+)', stripped).group(1))
            lang, code = code_blocks[idx]
            out.append(f'<pre><code>{html.escape(code)}</code></pre>')
            i += 1
            continue

        # 标题
        m = re.match(r'^(#{1,6})\s+(.+)$', stripped)
        if m:
            flush_para()
            level = len(m.group(1))
            text = inline_format(m.group(2))
            # 去掉 emoji 前缀的标题编号处理保留
            out.append(f'<h{level}>{text}</h{level}>')
            i += 1
            continue

        # 水平线
        if stripped in ('---', '***', '_____'):
            flush_para()
            out.append('<hr/>')
            i += 1
            continue

        # 引用块（含核心建议识别）
        if stripped.startswith('>'):
            flush_para()
            block = []
            while i < len(lines) and lines[i].strip().startswith('>'):
                content = re.sub(r'^>\s?', '', lines[i].strip())
                block.append(content)
                i += 1
            # 判断是否核心建议
            joined = '\n'.join(block)
            is_core = '**核心建议**' in joined or '核心建议' in joined.split('**')[0:1]
            if is_core:
                # 去掉"核心建议"标记前缀
                cleaned = re.sub(r'\*\*核心建议[：:]?\*\*\s*', '', joined)
                cleaned = re.sub(r'^核心建议[：:]?\s*', '', cleaned)
                inner = inline_format(cleaned)
                out.append(f'<blockquote class="core-advice">{inner}</blockquote>')
            else:
                inner = inline_format(joined)
                out.append(f'<blockquote>{inner}</blockquote>')
            continue

        # 表格（行含 | 且下一行是分隔）
        if '|' in stripped and i + 1 < len(lines) and re.match(r'^\s*\|?[\s\-:|]+\|?\s*$', lines[i+1]):
            flush_para()
            tbl, next_i = parse_table(lines, i)
            if tbl:
                out.append(tbl)
                i = next_i
                continue

        # 无序列表
        if re.match(r'^[-*+]\s+', stripped):
            flush_para()
            items = []
            while i < len(lines) and re.match(r'^[-*+]\s+', lines[i].strip()):
                item = re.sub(r'^[-*+]\s+', '', lines[i].strip())
                items.append(f'<li>{inline_format(item)}</li>')
                i += 1
            out.append('<ul>' + ''.join(items) + '</ul>')
            continue

        # 有序列表
        if re.match(r'^\d+\.\s+', stripped):
            flush_para()
            items = []
            while i < len(lines) and re.match(r'^\d+\.\s+', lines[i].strip()):
                item = re.sub(r'^\d+\.\s+', '', lines[i].strip())
                items.append(f'<li>{inline_format(item)}</li>')
                i += 1
            out.append('<ol>' + ''.join(items) + '</ol>')
            continue

        # 空行
        if not stripped:
            flush_para()
            i += 1
            continue

        # 普通段落行
        paragraph.append(stripped)
        i += 1

    flush_para()
    return '\n'.join(out)


# ============ HTML 外壳（套 preview.html 的 CSS）============

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<style>
{css}
</style>
</head>
<body>
{hero}
<div class="content">
{body}
</div>
<script>mermaid.initialize({{startOnLoad:true, theme:'neutral'}});</script>
</body>
</html>
"""

CSS = """
:root {
  --primary: #d97706; --bg: #fffaf3; --card: #ffffff; --border: #fde68a;
  --text: #292524; --muted: #78716c; --code-bg: #f5f5f4;
  --tip: #ecfdf5; --tip-border: #10b981; --warn: #fef3c7; --warn-border: #f59e0b;
}
* { box-sizing: border-box; }
body {
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  background: var(--bg); color: var(--text); line-height: 1.75;
  max-width: 880px; margin: 0 auto; padding: 32px 24px 80px;
}
h1 { font-size: 1.9em; border-bottom: 3px solid var(--primary); padding-bottom: 12px; margin-top: 56px; }
h2 { color: var(--primary); margin-top: 48px; padding-left: 12px; border-left: 5px solid var(--primary); }
h3 { margin-top: 32px; color: #44403c; }
h4 { margin-top: 24px; color: #57534e; }
p { margin: 14px 0; }
a { color: var(--primary); text-decoration: none; border-bottom: 1px dotted; }
a:hover { background: var(--border); }
code { background: var(--code-bg); padding: 2px 6px; border-radius: 4px; font-family: "SF Mono", Consolas, monospace; font-size: 0.9em; color: #b91c1c; }
pre { background: #1c1917; color: #fafaf9; padding: 18px; border-radius: 8px; overflow-x: auto; }
pre code { background: none; color: inherit; padding: 0; }
blockquote { background: var(--tip); border-left: 4px solid var(--tip-border); margin: 20px 0; padding: 14px 18px; border-radius: 0 6px 6px 0; }
blockquote p { margin: 6px 0; }
blockquote.core-advice { background: linear-gradient(135deg, #fef3c7, #fde68a); border-left-color: var(--warn-border); font-size: 1.05em; }
blockquote.core-advice::before { content: "💡 核心建议"; display: block; font-weight: 700; color: #92400e; margin-bottom: 6px; font-size: 0.85em; letter-spacing: 1px; }
table { border-collapse: collapse; width: 100%; margin: 20px 0; background: var(--card); box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
th, td { border: 1px solid var(--border); padding: 10px 14px; text-align: left; }
th { background: var(--primary); color: white; }
tr:nth-child(even) td { background: #fffbeb; }
ul, ol { padding-left: 24px; margin: 14px 0; }
li { margin: 6px 0; }
hr { border: none; border-top: 2px solid var(--border); margin: 40px 0; }
.hero { background: linear-gradient(135deg, #d97706, #b45309); color: white; padding: 36px 32px; border-radius: 12px; margin-bottom: 28px; }
.hero h1 { border: none; color: white; margin: 0 0 10px; padding: 0; font-size: 1.7em; }
.hero .subtitle { opacity: 0.92; font-size: 1.05em; }
.hero .meta { margin-top: 14px; font-size: 0.88em; opacity: 0.85; }
strong { color: #44403c; }
"""


def make_hero(title, subtitle, meta):
    return f'''<div class="hero">
<h1>{html.escape(title)}</h1>
<div class="subtitle">{html.escape(subtitle)}</div>
<div class="meta">{html.escape(meta)}</div>
</div>'''


def main():
    if len(sys.argv) < 3:
        print("用法: python3 md2html.py input.md output.html [title] [subtitle] [meta]")
        sys.exit(1)

    inp, outp = sys.argv[1], sys.argv[2]
    title = sys.argv[3] if len(sys.argv) > 3 else "文档"
    subtitle = sys.argv[4] if len(sys.argv) > 4 else ""
    meta = sys.argv[5] if len(sys.argv) > 5 else ""

    with open(inp, 'r', encoding='utf-8') as f:
        md = f.read()

    # 去掉 markdown frontmatter（--- 包裹的 YAML）
    md = re.sub(r'^---\n.*?\n---\n', '', md, flags=re.DOTALL)

    body = convert(md)
    hero = make_hero(title, subtitle, meta) if subtitle else ''
    html_out = HTML_TEMPLATE.format(title=title, css=CSS, hero=hero, body=body)

    with open(outp, 'w', encoding='utf-8') as f:
        f.write(html_out)
    print(f"✅ 转换完成: {outp}")
    print(f"   原文: {len(md.splitlines())} 行 → HTML: {len(html_out.splitlines())} 行")


if __name__ == '__main__':
    main()
