import re

with open('web-tikz.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Extract CSS
style_match = re.search(r'<style>(.*?)</style>', html, re.DOTALL)
if style_match:
    css_content = style_match.group(1).strip()
    with open('style.css', 'w', encoding='utf-8') as f:
        f.write(css_content)

# Extract JS
# We need to get the LAST <script> tag which contains the app logic.
script_matches = list(re.finditer(r'<script>(.*?)</script>', html, re.DOTALL))
if script_matches:
    # The first script sets MathJax, the second script is the app logic
    js_content = script_matches[-1].group(1).strip()
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(js_content)

# Modify HTML
new_html = re.sub(r'<style>.*?</style>', r'<link rel="stylesheet" href="style.css">', html, flags=re.DOTALL)
new_html = re.sub(r'<script>\s*let nodes = \[\].*?</script>', r'<script src="app.js"></script>', new_html, flags=re.DOTALL)

with open('web-tikz.html', 'w', encoding='utf-8') as f:
    f.write(new_html)
