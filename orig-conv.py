# userscript
# https://chatgpt.com/c/6972979c-b870-8333-8ee0-67d88a0fb12c

# conversor
# https://gemini.google.com/app/dfa57da1af950d23

import sys
from bs4 import BeautifulSoup
import html_to_markdown

# question span class in userscript HTML output
# "question-bM0Y3r"


def preprocess_html(html: str) -> str:
    """
    1. Remove all KaTeX HTML rendering spans (.katex-html)
    2. Replace MathML <math> elements with LaTeX annotations only
    """
    soup = BeautifulSoup(html, "lxml")

    # --- 1. Drop KaTeX HTML rendering completely ---
    for span in soup.select("span.katex-html"):
        span.decompose()

    # --- 2. Replace MathML with annotation-only LaTeX ---
    for math in soup.find_all("math"):
        annotation = math.find(
            "annotation",
            attrs={"encoding": lambda v: v and "tex" in v.lower()}
        )

        if not annotation or not annotation.text.strip():
            # No canonical TeX → drop math entirely
            math.decompose()
            continue

        latex = annotation.text.strip()
        display = math.get("display", "").lower()
        is_block = display == "block" or "\n" in latex

        if is_block:
            replacement = soup.new_string(
                f"\n\n$$\n{latex}\n$$\n\n"
            )
        else:
            replacement = soup.new_string(f"${latex}$")

        math.replace_with(replacement)

    return str(soup)


def html_to_markdown_with_math(html: str) -> str:
    html = preprocess_html(html)
    return html_to_markdown.convert(html)


def main():
    # Unicode guard (important when redirecting output)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    if len(sys.argv) < 2:
        print("Usage: python html_mathml_to_md.py input.html [output.md]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None

    with open(input_path, "r", encoding="utf-8") as f:
        html = f.read()

    markdown = html_to_markdown_with_math(html)

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(markdown)
    else:
        print(markdown)


if __name__ == "__main__":
    main()
