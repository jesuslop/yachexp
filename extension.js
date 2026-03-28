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

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function stripHtml(html) {
    return String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function textToHtml(text) {
    return String(text || '')
      .trim()
      .split(/\n{2,}/)
      .filter(Boolean)
      .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  function applyMathTemplate(template, latex) {
    return String(template || '').replace(/{latex}/g, latex);
  }

  function protectMarkdownCodeSpans(markdown) {
    const placeholders = [];
    let protectedMarkdown = String(markdown || '');

    const storePlaceholder = match => {
      const token = `__YACHEXP_CODE_${placeholders.length}__`;
      placeholders.push(match);
      return token;
    };

    protectedMarkdown = protectedMarkdown.replace(
      /(?:^|\n)(```|~~~)[^\n]*\n[\s\S]*?\n\1(?=\n|$)/g,
      storePlaceholder
    );

    protectedMarkdown = protectedMarkdown.replace(
      /`[^`\n]+`/g,
      storePlaceholder
    );

    return { placeholders, protectedMarkdown };
  }

  function restoreMarkdownCodeSpans(markdown, placeholders) {
    return placeholders.reduce(
      (current, value, index) => current.replace(`__YACHEXP_CODE_${index}__`, value),
      markdown
    );
  }

  function extractEntityLabel(entityPayload) {
    try {
      const parsed = JSON.parse(entityPayload);
      if (Array.isArray(parsed) && typeof parsed[1] === 'string' && parsed[1].trim()) {
        return parsed[1].trim();
      }
    } catch {
      // Fall through to raw payload cleanup below.
    }

    const rawParts = String(entityPayload || '')
      .split(',')
      .map(part => part.replace(/^[\s"'[\]]+|[\s"'[\]]+$/g, ''))
      .filter(Boolean);

    return rawParts[1] || '';
  }

  function normalizeMarkdownEntities(markdown) {
    return String(markdown || '').replace(
      /entity([\s\S]*?)/g,
      (_, entityPayload) => extractEntityLabel(entityPayload)
    );
  }

  function normalizeMarkdownMathDelimiters(markdown, inlineMathTemplate, displayMathTemplate) {
    const { placeholders, protectedMarkdown } = protectMarkdownCodeSpans(markdown);

    const normalized = normalizeMarkdownEntities(protectedMarkdown)
      .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, latex) => applyMathTemplate(displayMathTemplate, latex.trim()))
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, latex) => applyMathTemplate(inlineMathTemplate, latex.trim()));

    return restoreMarkdownCodeSpans(normalized, placeholders);
  }

  function getConversationId() {
    const pathMatch = location.pathname.match(/\/c\/([0-9a-f-]+)/i);
    if (pathMatch?.[1]) {
      return pathMatch[1];
    }

    const canonicalHref = document
      .querySelector('link[rel="canonical"]')
      ?.getAttribute('href');
    const canonicalMatch = canonicalHref?.match(/\/c\/([0-9a-f-]+)/i);
    return canonicalMatch?.[1] || null;
  }

  function getClientBootstrapData() {
    const raw = document.querySelector('#client-bootstrap')?.textContent;
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function getPageWindow() {
    try {
      return window.wrappedJSObject || window;
    } catch {
      return window;
    }
  }

  function isConversationPayload(value) {
    return !!(
      value &&
      typeof value === 'object' &&
      value.mapping &&
      typeof value.mapping === 'object'
    );
  }

  function findConversationPayload(root, maxNodes = 2000) {
    if (!root || typeof root !== 'object') {
      return null;
    }

    const queue = [root];
    const seen = new WeakSet();
    let visited = 0;

    while (queue.length && visited < maxNodes) {
      const current = queue.shift();
      if (!current || typeof current !== 'object') {
        continue;
      }
      if (seen.has(current)) {
        continue;
      }
      seen.add(current);
      visited += 1;

      if (isConversationPayload(current)) {
        return current;
      }

      if (Array.isArray(current)) {
        current.forEach(item => {
          if (item && typeof item === 'object') {
            queue.push(item);
          }
        });
        continue;
      }

      Object.values(current).forEach(value => {
        if (value && typeof value === 'object') {
          queue.push(value);
        }
      });
    }

    return null;
  }

  function getConversationPayloadFromGlobals() {
    const pageWindow = getPageWindow();
    const candidates = [
      pageWindow.__REACT_QUERY_CACHE__,
      pageWindow.__reactRouterContext,
      pageWindow.__NEXT_DATA__,
      pageWindow.__INITIAL_STATE__,
      pageWindow.__REMIX_CONTEXT__
    ];

    for (const candidate of candidates) {
      const found = findConversationPayload(candidate);
      if (found) {
        return found;
      }
    }

    return null;
  }

  async function fetchConversationPayload() {
    const conversationId = getConversationId();
    if (!conversationId) {
      return null;
    }

    const headers = {
      Accept: 'application/json'
    };
    const accessToken = getClientBootstrapData()?.session?.accessToken;
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    try {
      const response = await fetch(`/backend-api/conversation/${conversationId}`, {
        credentials: 'include',
        cache: 'no-store',
        headers
      });

      if (!response.ok) {
        return null;
      }

      const payload = await response.json();
      return isConversationPayload(payload) ? payload : null;
    } catch {
      return null;
    }
  }

  function getMessageRole(message) {
    return message?.author?.role || message?.role || null;
  }

  function extractPartText(part) {
    if (typeof part === 'string') {
      return part;
    }

    if (!part || typeof part !== 'object') {
      return '';
    }

    if (typeof part.text === 'string') {
      return part.text;
    }

    if (typeof part.content === 'string') {
      return part.content;
    }

    if (Array.isArray(part.parts)) {
      return part.parts.map(extractPartText).filter(Boolean).join('\n\n');
    }

    return '';
  }

  function extractMessageMarkdown(message) {
    const content = message?.content;
    if (!content || typeof content !== 'object') {
      return '';
    }

    if (Array.isArray(content.parts)) {
      return content.parts
        .map(extractPartText)
        .filter(Boolean)
        .join('\n\n')
        .trim();
    }

    if (typeof content.text === 'string') {
      return content.text.trim();
    }

    if (typeof content.result === 'string') {
      return content.result.trim();
    }

    return '';
  }

  function getOrderedConversationMessages(payload) {
    if (!isConversationPayload(payload)) {
      return [];
    }

    const mapping = payload.mapping;
    const lineage = [];
    const seen = new Set();
    let currentId = payload.current_node;

    while (currentId && mapping[currentId] && !seen.has(currentId)) {
      const node = mapping[currentId];
      lineage.push(node);
      seen.add(currentId);
      currentId = node.parent;
    }

    const nodes = lineage.length ? lineage.reverse() : Object.values(mapping);

    return nodes
      .map(node => node?.message)
      .filter(Boolean);
  }

  function buildQAPairsFromConversationPayload(payload) {
    const messages = getOrderedConversationMessages(payload);
    const pairs = [];
    let pendingUser = null;

    for (const message of messages) {
      const role = getMessageRole(message);
      const markdown = extractMessageMarkdown(message);
      const isHidden = !!message?.metadata?.is_visually_hidden_from_conversation;

      if (!role || !markdown || isHidden) {
        continue;
      }

      if (role === 'user') {
        pendingUser = markdown;
        continue;
      }

      if (role === 'assistant' && pendingUser) {
        pairs.push({
          questionMarkdown: pendingUser,
          answerMarkdown: markdown,
          previewText: pendingUser
        });
        pendingUser = null;
      }
    }

    return pairs;
  }

  function getPairQuestionMarkdown(pair, inlineMathTemplate, displayMathTemplate) {
    if (typeof pair.questionMarkdown === 'string') {
      return normalizeMarkdownMathDelimiters(
        pair.questionMarkdown.trim(),
        inlineMathTemplate,
        displayMathTemplate
      );
    }

    if (typeof pair.questionHtml === 'string') {
      return htmlToMarkdown(
        pair.questionHtml.replace(/\n/g, '<br>'),
        inlineMathTemplate,
        displayMathTemplate
      );
    }

    if (pair.questionArticle) {
      const questionHTML = cleanArticle(pair.questionArticle).outerHTML;
      return htmlToMarkdown(
        questionHTML.replace(/\n/g, '<br>'),
        inlineMathTemplate,
        displayMathTemplate
      );
    }

    return '';
  }

  function getPairAnswerMarkdown(pair, inlineMathTemplate, displayMathTemplate) {
    if (typeof pair.answerMarkdown === 'string') {
      return normalizeMarkdownMathDelimiters(
        pair.answerMarkdown.trim(),
        inlineMathTemplate,
        displayMathTemplate
      );
    }

    if (typeof pair.answerHtml === 'string') {
      return htmlToMarkdown(
        pair.answerHtml,
        inlineMathTemplate,
        displayMathTemplate
      );
    }

    if (pair.answerArticle) {
      const answerHTML = cleanArticle(pair.answerArticle).outerHTML;
      return htmlToMarkdown(answerHTML, inlineMathTemplate, displayMathTemplate);
    }

    return '';
  }

  function getPairPreviewText(pair) {
    if (typeof pair.previewText === 'string' && pair.previewText.trim()) {
      return pair.previewText.trim();
    }

    if (typeof pair.questionMarkdown === 'string') {
      return pair.questionMarkdown.trim();
    }

    if (typeof pair.questionHtml === 'string') {
      return stripHtml(pair.questionHtml);
    }

    if (pair.questionArticle) {
      const cleanClone = pair.questionArticle.cloneNode(true);
      cleanClone.querySelectorAll('.sr-only').forEach(el => el.remove());
      return cleanClone.innerText.trim();
    }

    return '';
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
      const replacementTarget = math.closest('.katex-display') || math.closest('.katex') || math;

      if (!annotation || !annotation.textContent.trim()) {
        replacementTarget.remove();
        return;
      }

      const latex = annotation.textContent;
      const display = math.getAttribute('display') === 'block' || latex.includes('\n');

      const template = display ? displayMathTemplate : inlineMathTemplate;

      const fragment = doc.createDocumentFragment();
      const templateWithLatex = applyMathTemplate(template, latex);
      const lines = templateWithLatex.split('\n');
      lines.forEach((line, index) => {
        if (index > 0) fragment.appendChild(doc.createElement('br'));
        fragment.appendChild(doc.createTextNode(line));
      });
      replacementTarget.replaceWith(fragment);
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
        const questionMd = getPairQuestionMarkdown(
          pair,
          inlineMathTemplate,
          displayMathTemplate
        );

        // --- QUESTION TEMPLATE PROCESSING ---
        const questionBlock = questionTemplate.replace(/{question}/g, questionMd);

        const answerMd = getPairAnswerMarkdown(
          pair,
          inlineMathTemplate,
          displayMathTemplate
        );

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

  function buildQAPairsFromDOM() {
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

  async function buildQAPairs() {
    const cachedPayload = getConversationPayloadFromGlobals();
    const cachedPairs = buildQAPairsFromConversationPayload(cachedPayload);
    if (cachedPairs.length) {
      return cachedPairs;
    }

    const fetchedPayload = await fetchConversationPayload();
    const fetchedPairs = buildQAPairsFromConversationPayload(fetchedPayload);
    if (fetchedPairs.length) {
      return fetchedPairs;
    }

    return buildQAPairsFromDOM();
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
      text.textContent = truncate(getPairPreviewText(pair));

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
   * Export flow
   ********************************************************************/

  async function startExport() {
    const pairs = await buildQAPairs();
    if (!pairs.length) {
      alert('No exportable conversation found.');
      return;
    }
    createModal(pairs);
  }

  function handleExportRequest() {
    startExport().catch(error => {
      console.error('yachexp export failed', error);
      alert('No exportable conversation found.');
    });
  }

  /********************************************************************
   * Bootstrap
   ********************************************************************/

  browser.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'yachexp-export') {
      return;
    }
    handleExportRequest();
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      buildQAPairsFromConversationPayload,
      extractMessageMarkdown,
      getPairAnswerMarkdown,
      getPairQuestionMarkdown,
      getOrderedConversationMessages,
      isConversationPayload,
      getConversationId,
      normalizeMarkdownEntities,
      normalizeMarkdownMathDelimiters,
      textToHtml
    };
  }

})();
