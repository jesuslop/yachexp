// Yet another ChatGPT Exporter 
// Export ChatGPT conversations as clean Markdown

(() => {
  'use strict';

  /********************************************************************
   * Utilities
   ********************************************************************/

  function formatDate(d) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function truncate(text, max = 200) {
    text = text.replace(/\s+/g, ' ').trim();
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  function sanitizeFilename(name) {
    return name
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  }

  function processFilename(template, title, date) {
    if (!template) return sanitizeFilename(title);

    const replacements = {
      '{title}': sanitizeFilename(title),
      '{date}': formatDate(date),
      '{year}': date.getFullYear(),
      '{month}': String(date.getMonth() + 1).padStart(2, '0'),
      '{day}': String(date.getDate()).padStart(2, '0')
    };

    let filename = template;
    for (const [key, val] of Object.entries(replacements)) {
      filename = filename.replace(new RegExp(key, 'g'), val);
    }
    return sanitizeFilename(filename);
  }


  function getConversationTitle() {
    const title = document.title
      ?.replace(/\s*\|\s*ChatGPT.*$/i, '')
      ?.trim();
    return title && title.length ? title : 'ChatGPT Conversation';
  }

  function getConversationLink() {
    return location.href;
  }


  /********************************************************************
   * (1/3) Preprocess HTML
   ********************************************************************/

  function preprocessHTML(html, inlineMathTemplate, displayMathTemplate) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 1. Remove screen-reader-only elements (turn indicators like "You said", "ChatGPT said")
    doc.querySelectorAll('.sr-only').forEach(el => el.remove());

    // 2. Remove KaTeX HTML rendering (visual junk)
    doc.querySelectorAll('span.katex-html').forEach(el => el.remove());

    // 3. Replace MathML with LaTeX notation
    doc.querySelectorAll('math').forEach(math => {
      const annotation = math.querySelector('annotation[encoding*="tex"], annotation[encoding*="TeX"]');

      if (!annotation || !annotation.textContent.trim()) {
        math.remove();
        return;
      }

      const latex = annotation.textContent;
      const display = math.getAttribute('display') === 'block' || latex.includes('\n');

      const template = display ? displayMathTemplate : inlineMathTemplate;

      const fragment = doc.createDocumentFragment();
      const templateWithLatex = template.replace('{latex}', latex);
      const lines = templateWithLatex.split('\n');
      lines.forEach((line, index) => {
        if (index > 0) fragment.appendChild(doc.createElement('br'));
        fragment.appendChild(doc.createTextNode(line));
      });
      math.replaceWith(fragment);
    });

    return doc.body.innerHTML;
  }

  /********************************************************************************
   * (2/3) Markdown generation from question or answer HTML using Turndown converter
   * https://github.com/mixmark-io/turndown
   ********************************************************************************/

  function htmlToMarkdown(html, inlineMathTemplate, displayMathTemplate) {
    // Preprocess HTML first
    html = preprocessHTML(html, inlineMathTemplate, displayMathTemplate);

    var tables = turndownPluginGfm.tables

    // Initialize Turndown with custom options
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: "```",
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined'
    });

    turndownService.use([tables])

    // Disable escaping markdown characters in html source
    turndownService.escape = function (string) {
      return string;
    };

    // ignore paragraphs inside list items to remove empty paragraphs between markdown list items
    turndownService.addRule('inline-paragraphs-in-list', {
      filter: function (node) {
        // Target <p> tags that are direct children of <li>
        return node.nodeName === 'P' && node.parentNode.nodeName === 'LI';
      },
      replacement: function (content) {
        // Return the content without the double newline
        return content;
      }
    });


    // Remove the extra spaces Turndown adds after list items markers

    // save original rule for reuse
    const defaultLiRule = turndownService.rules.array.find(rule =>
      rule.filter === 'li'
    );
    const originalReplacement = defaultLiRule.replacement;

    // Apply Turndown li rule, then replace extra spaces after list items markers
    turndownService.addRule('li-trimmer', {
      filter: 'li',
      replacement: function (content, node, options) {
        // 1. Get Turndown string for list item
        let markdown = originalReplacement.call(this, content, node, options);

        // 2. The Regex:
        // ^(\s*)          -> Group 1: Leading indentation (the 4-space depth)
        // (-|\d+\.)       -> Group 2: The hyphen OR a number with a dot
        // [ \t\xA0]+      -> Matches one or more spaces/tabs/non-breaking spaces
        //
        // We replace it with Group 1 + Group 2 + a single literal space.
        return markdown.replace(/^(\s*)(-|\d+\.)[ \t\xA0]+/, '$1$2 ');
      }
    });

    // There can be intermediate tags between <pre> and <code>
    turndownService.addRule('preCodeToMarkdown', {
      filter: function (node) {
        // Ensure the node is a <pre> tag and contains a <code> tag
        return node.nodeName === 'PRE' && node.querySelector('code');
      },
      replacement: function (content, node) {
        // Extract the actual text content inside the <code> tag, preserving newlines
        const codeContent = node.querySelector('code').textContent; // Get raw text

        // Return the content as a Markdown code block (triple backticks)
        return '```\n' + codeContent + '\n```';
      }
    });


    // Convert to Markdown
    const markdown = turndownService.turndown(html);

    // Clean up excessive newlines
    return markdown
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  }

  /***********************************************************************
   * (3/3) Combine all questions/answer pairs into a final Markdown file
   ***********************************************************************/

  function exportMarkdown(pairs) {
    browser.storage.local.get(null).then(items => {
      // Profile Resolution Logic
      let pageTemplate = "DEFAULT_PAGE_TEMPLATE_NOT_LOADED";
      let questionTemplate = "DEFAULT_QUESTION_TEMPLATE_NOT_LOADED";
      let filenameTemplate = ""; // Default to empty (uses title)
      let inlineMathTemplate = "unconfigured";
      let displayMathTemplate = "unconfigured";

      // Strict profile structure only
      if (items.activeProfileId && items.profiles && items.profiles[items.activeProfileId]) {
        const profile = items.profiles[items.activeProfileId];
        pageTemplate = profile.pageTemplate;
        questionTemplate = profile.questionTemplate;
        filenameTemplate = profile.filenameTemplate;
        inlineMathTemplate = profile.inlineMathTemplate || "unconfigured";
        displayMathTemplate = profile.displayMathTemplate || "unconfigured";
      } else {
        console.log("no active profile found, using default templates");
      }

      const exportDate = new Date();
      const title = getConversationTitle();
      const link = getConversationLink();
      const safeFilename = processFilename(filenameTemplate, title, exportDate);

      // --- PAGE TEMPLATE PROCESSING ---
      let markdown = pageTemplate
        .replace(/{title}/g, title)
        .replace(/{link}/g, link)
        .replace(/{date}/g, formatDate(exportDate));

      // --- CONVERSATION LOOP ---
      pairs.forEach((pair, idx) => {
        const questionHTML = cleanArticle(pair.questionArticle).outerHTML;
        const answerHTML = cleanArticle(pair.answerArticle).outerHTML;

        // Preserve paragraphs in question html text by converting newlines into BRs
        const questionMd = htmlToMarkdown(questionHTML.replace(/\n/g, '<br>'), inlineMathTemplate, displayMathTemplate);

        // --- QUESTION TEMPLATE PROCESSING ---
        const questionBlock = questionTemplate.replace(/{question}/g, questionMd);

        const answerMd = htmlToMarkdown(answerHTML, inlineMathTemplate, displayMathTemplate);

        markdown += questionBlock + '\n\n';
        markdown += answerMd + '\n\n';
      });

      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeFilename}.md`;
      a.click();

      URL.revokeObjectURL(url);
    });
  }

  /********************************************************************
   * Message extraction
   ********************************************************************/

  function getMessageArticles() {
    return Array.from(document.querySelectorAll('article'))
      .map(article => {
        const roleEl = article.querySelector('[data-message-author-role]');
        if (!roleEl) return null;

        return {
          role: roleEl.getAttribute('data-message-author-role'),
          article
        };
      })
      .filter(Boolean);
  }

  function buildQAPairs() {
    const messages = getMessageArticles();
    const pairs = [];
    let pendingUser = null;

    for (const msg of messages) {
      if (msg.role === 'user') {
        pendingUser = msg.article;
      } else if (msg.role === 'assistant' && pendingUser) {
        pairs.push({
          questionArticle: pendingUser,
          answerArticle: msg.article
        });
        pendingUser = null;
      }
    }

    return pairs;
  }

  /********************************************************************
   * Article cleaning
   ********************************************************************/

  function cleanArticle(article) {
    const clone = article.cloneNode(true);
    clone.querySelectorAll(
      'nav, button, svg, [role="toolbar"], [aria-label]'
    ).forEach(el => el.remove());
    return clone;
  }

  /********************************************************************
   * Generation idle detection
   ********************************************************************/

  function waitForGenerationIdle(cb) {
    const obs = new MutationObserver(() => {
      const stopBtn = document.querySelector('button[aria-label*="Stop"]');
      if (!stopBtn) {
        obs.disconnect();
        cb();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  /********************************************************************
   * UI: Export button
   ********************************************************************/

  function createExportButton() {
    const btn = document.createElement('button');
    btn.textContent = 'Export MD';
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      padding: 14px 18px;
      background: #10a37f;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      cursor: pointer;
      opacity: 0.5;
      pointer-events: none;
    `;
    document.body.appendChild(btn);
    return btn;
  }

  function enableButton(btn) {
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  }

  /********************************************************************
   * UI: Modal dialog
   ********************************************************************/

  function createModal(pairs) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.65);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #fff;
      width: 640px;
      max-height: 85vh;
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      padding: 18px;
      box-sizing: border-box;
    `;

    const title = document.createElement('h2');
    title.textContent = 'Export conversation to Markdown';
    title.style.margin = '0 0 14px 0';

    const controls = document.createElement('div');
    controls.style.marginBottom = '10px';

    const btnStyle = `
      cursor: pointer;
      padding: 6px 12px;
      background: #f0f0f0;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 13px;
    `;

    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = 'Select all';
    selectAllBtn.style.cssText = btnStyle + 'margin-right: 10px;';

    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.textContent = 'Deselect all';
    deselectAllBtn.style.cssText = btnStyle;

    controls.append(selectAllBtn, deselectAllBtn);

    const list = document.createElement('div');
    list.style.cssText = `
      flex: 1;
      overflow-y: auto;
      border: 1px solid #ccc;
      padding: 10px;
      margin-bottom: 14px;
    `;

    const checkboxes = [];

    pairs.forEach((pair, idx) => {
      const row = document.createElement('label');
      row.style.cssText = `
        display: flex;
        gap: 10px;
        align-items: flex-start;
        margin-bottom: 8px;
        cursor: pointer;
      `;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.dataset.index = idx;
      cb.style.marginTop = '4px';

      const text = document.createElement('span');
      // Clone and remove sr-only elements before getting text
      const cleanClone = pair.questionArticle.cloneNode(true);
      cleanClone.querySelectorAll('.sr-only').forEach(el => el.remove());
      text.textContent = truncate(cleanClone.innerText);

      row.append(cb, text);
      list.appendChild(row);
      checkboxes.push(cb);
    });

    selectAllBtn.onclick = () => checkboxes.forEach(cb => cb.checked = true);
    deselectAllBtn.onclick = () => checkboxes.forEach(cb => cb.checked = false);

    const footer = document.createElement('div');
    footer.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 14px;
      padding-top: 12px;
      border-top: 1px solid #ddd;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.padding = '10px 18px';

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export';
    exportBtn.style.cssText = `
      padding: 10px 22px;
      background: #10a37f;
      color: #fff;
      border-radius: 6px;
    `;

    footer.append(cancelBtn, exportBtn);
    modal.append(title, controls, list, footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    cancelBtn.onclick = () => overlay.remove();

    exportBtn.onclick = () => {
      const selected = checkboxes
        .filter(cb => cb.checked)
        .map(cb => pairs[cb.dataset.index]);

      exportMarkdown(selected);
      overlay.remove();
    };
  }



  /********************************************************************
   * Bootstrap
   ********************************************************************/

  const exportButton = createExportButton();

  waitForGenerationIdle(() => {
    enableButton(exportButton);
  });

  exportButton.addEventListener('click', () => {
    const pairs = buildQAPairs();
    if (!pairs.length) {
      alert('No exportable conversation found.');
      return;
    }
    createModal(pairs);
  });

})();
