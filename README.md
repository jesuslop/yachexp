# Yet another ChatGPT exporter

<img src="icon.svg" width="100">

This is a Firefox extension to export ChatGPT conversations from [chatgpt.com](https://chatgpt.com) to clean Markdown, including custom template support for the export process. This extension is intended for users who do not have API access but want to download a clean Markdown version of their conversations.

![img1](./doc-img/conversion-example.png)

It is a healthy habit to download local versions of valuable conversations for future reference and to future-proof them, since conversation links can and do "rot" (there is no persistence commitment from OpenAI). Hand-picked saving helps highlight important exchanges from the noise. Saving to local Markdown lets you attach conversations to other annotated content, so you can cross-reference and integrate personal and AI-produced content with your own tools and workflow.

Since ChatGPT conversations can get very long, the tool lets you select which questions to export (including all of them) from conversation snippet hints.

<img src="./doc-img/question-selection2.png" width="500">

The export process is highly customizable, letting you configure export profiles that target the exact Markdown flavor your tools expect, such as Obsidian or Typora.

For instance, you can format questions as Obsidian callouts/admonitions and control their visual style with an Obsidian plugin such as the [admonition plugin](https://github.com/javalent/admonitions), plus an Obsidian CSS snippet (I use [this one](./extra/obsidian-bubble-callout.css) for a rounded "bubble" effect).

![img1](./doc-img/bubble-question-small.png)

Similarly, you can adjust the front-matter of the generated Markdown by exporting document attributes (such as title or link) in your desired format, or by including them as semantic document properties (if your tool supports them, as Obsidian does).

Templating is easy to use. It substitutes named placeholders in curly braces with their values. For instance, you could specify `${latex}$` in the inline math template to use single-dollar delimiters for inline math, where `latex` can be substituted by, say, `e=mc^2` for the famous equation in the conversation. Line breaks are respected.

Care has been taken to output LaTeX mathematical expressions correctly. There are two common conventions to express math in Markdown: one uses dollar and double-dollar delimiters (for inline and displayed math styles), and the other uses round and square brackets. This tool lets you decide your exact rendering.

You can configure as many export profiles as you want, for instance when targeting different Markdown-consuming tools. Each export profile allows template-based customization so you can tailor the export process to fit your exact needs with a reasonable balance between configuration effort and export flexibility.

## Features

- Selective export of all conversation questions or only cherry picked ones
- Template based export customization
  1. Page front-matter
  2. User question format
  3. Inline and displayed LaTeX math expressions.
- Multiple exporting profiles
- Mature HTML to Markdown conversion third party engine: [Turndown](https://github.com/mixmark-io/turndown)
- Configuration backup/restore by export/import readable JSON configuration files.

## Scope

The project does not aim to cover the full variability of all possible conversations a user can have. It is a single-person effort to solve a personal task and share it with others who have a similar need. For instance, image carousels are dropped and will remain unsupported.

## Beta Notice

This is a beta release. Expect rough edges, and please report bugs with clear reproduction steps.

## Internals

The extension uses the [Turndown](https://github.com/mixmark-io/turndown) library as converter engine and has a double-pass strategy:

- The first pass prepares received HTML for the conversation, with the main task of extracting the LaTeX source intent from math expressions.
- The second pass runs a customized Turndown conversion, tweaking the process with custom rules to get good-looking output for complex nested lists or code snippets.

Both passes use rules that operate at the abstract syntax tree level to avoid brittle regex hacks, but this kind of tool can break depending on future changes to the [chatgpt.com](https://chatgpt.com) site.

## Installation (AMO Unlisted)
1. Download the unlisted XPI from the release page.
2. Open Firefox and drag the XPI into the browser window, or use `about:addons` > gear icon > “Install Add-on From File”.
3. Confirm permissions and refresh any ChatGPT tabs.

## Known Limitations
- Image carousel not exported.
- Internal rendering changes on chatgpt.com could break extension functionality.

## Support
While the project is MIT-licensed, free-forever open source software (FOSS), users are invited to help project continuity by reporting bugs and by funding the work. 

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S6S01TM19B)

## License

MIT License

Copyright (c) 2026 Jesús López

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
