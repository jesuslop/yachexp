import sys
import re
from bs4 import BeautifulSoup
import html_to_markdown


QUESTION_CLASS = "question-bM0Y3r"
QUESTION_CALLOUT = "ad-bubble"


# ------------------------------------------------------------
# LaTeX whitespace normalization
# ------------------------------------------------------------
def normalize_latex_whitespace(latex: str, display: bool) -> str:
    latex = latex.replace("\r\n", "\n").replace("\r", "\n").strip()

    if display:
        lines = [
            re.sub(r"[ \t]+", " ", line).rstrip()
            for line in latex.split("\n")
        ]
        # drop empty leading/trailing lines
        while lines and not lines[0]:
            lines.pop(0)
        while lines and not lines[-1]:
            lines.pop()
        return "\n".join(lines)

    return re.sub(r"\s+", " ", latex)


# ------------------------------------------------------------
# HTML preprocessing
# ------------------------------------------------------------
def preprocess_html(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")

    # --------------------------------------------------------
    # 1. Drop KaTeX HTML rendering (visual junk)
    # --------------------------------------------------------
    for span in soup.select("span.katex-html"):
        span.decompose()

    # --------------------------------------------------------
    # 2. Replace MathML with annotation-only LaTeX
    # --------------------------------------------------------
    for math in soup.find_all("math"):
        annotation = math.find(
            "annotation",
            attrs={"encoding": lambda v: v and "tex" in v.lower()}
        )

        if not annotation or not annotation.text.strip():
            math.decompose()
            continue

        raw_latex = annotation.text
        display = (
            math.get("display", "").lower() == "block"
            or "\n" in raw_latex
        )

        latex = normalize_latex_whitespace(raw_latex, display)

        if display:
            replacement = soup.new_string(
                f"\n\n$$\n{latex}\n$$\n\n"
            )
        else:
            replacement = soup.new_string(f"${latex}$")

        math.replace_with(replacement)

    # --------------------------------------------------------
    # 3. Replace question spans with Obsidian callouts
    #    (plain text, multi-paragraph safe)
    # --------------------------------------------------------
    for span in soup.find_all("span", class_=QUESTION_CLASS):
        # Preserve paragraph structure
        question_text = span.get_text(separator="\n", strip=True)

        # Normalize excessive whitespace but keep paragraphs
        paragraphs = [
            re.sub(r"[ \t]+", " ", p).strip()
            for p in question_text.split("\n\n")
        ]
        question_text = "\n\n".join(p for p in paragraphs if p)

        if not question_text:
            span.decompose()
            continue

        callout = (
            f"\n\n```{QUESTION_CALLOUT}\n"
            f"{question_text}\n"
            f"```\n\n"
        )

        span.replace_with(soup.new_string(callout))

    return str(soup)


# ------------------------------------------------------------
# HTML → Markdown
# ------------------------------------------------------------
def html_to_markdown_with_semantics(html: str) -> str:
    html = preprocess_html(html)
    return html_to_markdown.convert(html)


# ------------------------------------------------------------
# CLI entry point
# ------------------------------------------------------------
def main():
    # Unicode guard (critical for redirected output)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    if len(sys.argv) < 2:
        print("Usage: python html_to_obsidian_md.py input.html [output.md]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None

    with open(input_path, "r", encoding="utf-8") as f:
        html = f.read()

    markdown = html_to_markdown_with_semantics(html)

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(markdown)
    else:
        print(markdown)


if __name__ == "__main__":
    main()
