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

  function applyIndentedMultilineTemplate(template, latex, indent) {
    const rendered = applyMathTemplate(template, latex);
    if (!indent) {
      return rendered;
    }

    return rendered
      .split('\n')
      .map(line => `${indent}${line}`)
      .join('\n');
  }

  function normalizeDisplayMathBlocks(markdown, displayMathTemplate) {
    const lines = String(markdown || '').split('\n');
    const normalizedLines = [];

    for (let i = 0; i < lines.length; i += 1) {
      const openMatch = lines[i].match(/^([ \t>]*)\\\[\s*$/);
      if (!openMatch) {
        normalizedLines.push(lines[i]);
        continue;
      }

      const indent = openMatch[1] || '';
      const latexLines = [];
      let closingIndex = -1;

      for (let j = i + 1; j < lines.length; j += 1) {
        if (/^[ \t>]*\\\]\s*$/.test(lines[j])) {
          closingIndex = j;
          break;
        }

        if (indent && lines[j].startsWith(indent)) {
          latexLines.push(lines[j].slice(indent.length));
        } else {
          latexLines.push(lines[j]);
        }
      }

      if (closingIndex === -1) {
        normalizedLines.push(lines[i]);
        continue;
      }

      const latex = latexLines.join('\n').trim();
      normalizedLines.push(
        applyIndentedMultilineTemplate(displayMathTemplate, latex, indent)
      );
      i = closingIndex;
    }

    return normalizedLines.join('\n');
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

  function cleanFastPrefix(text) {
    if (typeof text !== 'string') {
      return '';
    }
    return text
      .replace(/^fast\|/i, '')
      .replace(/fast\|[^]*/g, '')
      .trim();
  }

  function cleanAuxiliaryStatusText(markdown) {
    if (typeof markdown !== 'string') {
      return '';
    }

    const lines = markdown.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed) {
        return true;
      }

      if (/^<(?:\/)?(?:summary|details)>/i.test(trimmed)) {
        return false;
      }

      const cleanLine = trimmed
        .replace(/^[-*+]\s+/, '')
        .replace(/^<(?:\/)?(?:summary|details)>\s*/i, '')
        .replace(/<\/(?:summary|details)>\s*$/i, '')
        .trim();

      if (!cleanLine) {
        return false;
      }

      if (/^searched\s+(\d+|the|several|a\s+few)\s+(website|site|web|page)s?$/i.test(cleanLine)) {
        return false;
      }

      if (/^searching(\s+the\s+web|\.\.\.)?$/i.test(cleanLine)) {
        return false;
      }

      if (/^(worked|thought|reasoned)\s+for\s+(a\s+couple\s+of|a\s+few|a|\d+|\d+\.\d+)\s+(second|minute)s?$/i.test(cleanLine)) {
        return false;
      }

      if (/^thinking(\s+process|\.\.\.)?$/i.test(cleanLine)) {
        return false;
      }

      if (/^summary$/i.test(cleanLine)) {
        return false;
      }

      return true;
    });

    return filteredLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function extractEntityLabel(entityPayload) {
    try {
      const parsed = JSON.parse(entityPayload);
      if (Array.isArray(parsed)) {
        if (typeof parsed[1] === 'string' && parsed[1].trim() && !/^fast\|/i.test(parsed[1].trim())) {
          return parsed[1].trim();
        }
        for (const item of parsed) {
          if (typeof item === 'string' && item.trim() && !/^fast\|/i.test(item.trim())) {
            return item.trim();
          }
        }
        if (typeof parsed[1] === 'string' && parsed[1].trim()) {
          return cleanFastPrefix(parsed[1].trim());
        }
        if (typeof parsed[0] === 'string' && parsed[0].trim()) {
          return cleanFastPrefix(parsed[0].trim());
        }
      }
    } catch {
      // Fall through to raw payload cleanup below.
    }

    const rawParts = String(entityPayload || '')
      .split(',')
      .map(part => part.replace(/^[\s"'[\]]+|[\s"'[\]]+$/g, ''))
      .filter(Boolean);

    const nonFast = rawParts.find(p => !/^fast\|/i.test(p));
    if (nonFast) {
      return nonFast;
    }

    return rawParts[1] ? cleanFastPrefix(rawParts[1]) : (rawParts[0] ? cleanFastPrefix(rawParts[0]) : '');
  }

  function normalizeMarkdownEntities(markdown) {
    return String(markdown || '')
      .replace(/(?:\n\s*)?image_group[\s\S]*?(?:\s*\n)?/g, '\n\n')
      .replace(
        /entity([\s\S]*?)/g,
        (_, entityPayload) => extractEntityLabel(entityPayload)
      )
      .replace(/(?:genui|fast|[^]+)[\s\S]*?/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function normalizeMarkdownMathDelimiters(markdown, inlineMathTemplate, displayMathTemplate) {
    const { placeholders, protectedMarkdown } = protectMarkdownCodeSpans(markdown);

    const normalized = normalizeDisplayMathBlocks(
      normalizeMarkdownEntities(protectedMarkdown),
      displayMathTemplate
    )
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, latex) => applyMathTemplate(inlineMathTemplate, latex.trim()));

    return restoreMarkdownCodeSpans(normalized, placeholders);
  }

  function getConversationId() {
    const pathMatch = location.pathname.match(/\/c\/([0-9a-f-]+)/i);
    if (pathMatch?.[1]) {
      return pathMatch[1];
    }

    const search = typeof location?.search === 'string' ? location.search : '';
    const searchParams = new URLSearchParams(search);
    const searchParamId = searchParams.get('conversationId')
      || searchParams.get('conversation_id')
      || searchParams.get('cid');
    if (searchParamId) {
      return searchParamId;
    }

    const canonicalHref = document
      .querySelector('link[rel="canonical"]')
      ?.getAttribute('href');
    const canonicalMatch = canonicalHref?.match(/\/c\/([0-9a-f-]+)/i);
    if (canonicalMatch?.[1]) {
      return canonicalMatch[1];
    }

    const ogUrl = document
      .querySelector('meta[property="og:url"]')
      ?.getAttribute('content');
    const ogMatch = ogUrl?.match(/\/c\/([0-9a-f-]+)/i);
    return ogMatch?.[1] || null;
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

  function tryGetValue(getter, fallback = null) {
    try {
      const value = getter();
      return value === undefined ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function getMessageContent(message) {
    return message?.content || message?.message?.content || null;
  }

  function isConversationMessage(value) {
    try {
      return !!(
        value &&
        typeof value === 'object' &&
        getMessageRole(value) &&
        getMessageContent(value)
      );
    } catch {
      return false;
    }
  }

  function hasConversationMessages(value) {
    return Array.isArray(value) && value.some(isConversationMessage);
  }

  function getPayloadMessageArrays(value) {
    if (!value || typeof value !== 'object') {
      return [];
    }

    return [
      tryGetValue(() => value.linear_conversation, null),
      tryGetValue(() => value.messages, null),
      tryGetValue(() => value.conversation.messages, null),
      tryGetValue(() => value.conversation.linear_conversation, null),
      tryGetValue(() => value.current_conversation.messages, null),
      tryGetValue(() => value.current_conversation.linear_conversation, null),
      tryGetValue(() => value.data.messages, null),
      tryGetValue(() => value.data.linear_conversation, null)
    ].filter(hasConversationMessages);
  }

  function isConversationPayload(value) {
    try {
      return !!(
        value &&
        typeof value === 'object' &&
        (
          (value.mapping && typeof value.mapping === 'object') ||
          getPayloadMessageArrays(value).length
        )
      );
    } catch {
      return false;
    }
  }

  function findConversationPayload(root, maxNodes = 5000) {
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

      const values = tryGetValue(() => Object.values(current), []);
      values.forEach(value => {
        if (value && typeof value === 'object') {
          queue.push(value);
        }
      });
    }

    return null;
  }

  function getConversationPayloadFromGlobals() {
    const roots = [window];
    const pageWindow = getPageWindow();
    if (pageWindow && pageWindow !== window) {
      roots.unshift(pageWindow);
    }

    const candidates = [getClientBootstrapData()];

    roots.forEach(root => {
      const reactRouterContext = tryGetValue(() => root.__reactRouterContext);
      const reactRouterDataRouter = tryGetValue(() => root.__reactRouterDataRouter);

      candidates.push(
        tryGetValue(() => root.__REACT_QUERY_CACHE__),
        reactRouterContext,
        tryGetValue(() => reactRouterContext?.state),
        tryGetValue(() => reactRouterContext?.state?.loaderData),
        reactRouterDataRouter,
        tryGetValue(() => reactRouterDataRouter?.state),
        tryGetValue(() => reactRouterDataRouter?.state?.loaderData),
        tryGetValue(() => reactRouterDataRouter?.state?.matches),
        tryGetValue(() => root.__NEXT_DATA__),
        tryGetValue(() => root.__INITIAL_STATE__),
        tryGetValue(() => root.__REMIX_CONTEXT__)
      );
    });

    for (const candidate of candidates) {
      const found = findConversationPayload(candidate);
      if (found) {
        return found;
      }
    }

    return null;
  }

  function getAccessTokenFromGlobals() {
    const bootstrapToken = getClientBootstrapData()?.session?.accessToken;
    if (bootstrapToken) {
      return bootstrapToken;
    }

    const roots = [window];
    const pageWindow = getPageWindow();
    if (pageWindow && pageWindow !== window) {
      roots.unshift(pageWindow);
    }

    for (const root of roots) {
      const candidates = [
        tryGetValue(() => root.__NEXT_DATA__?.props?.pageProps?.session?.accessToken),
        tryGetValue(() => root.__INITIAL_STATE__?.session?.accessToken),
        tryGetValue(() => root.__remixContext?.state?.loaderData?.root?.session?.accessToken),
        tryGetValue(() => root.__REMIX_CONTEXT__?.state?.loaderData?.root?.session?.accessToken)
      ];

      const token = candidates.find(candidate => typeof candidate === 'string' && candidate.length);
      if (token) {
        return token;
      }
    }

    return null;
  }

  async function fetchSessionAccessToken() {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        return null;
      }

      const session = await response.json();
      return session?.accessToken || null;
    } catch {
      return null;
    }
  }

  async function getAccessToken() {
    return getAccessTokenFromGlobals() || await fetchSessionAccessToken();
  }

  async function fetchConversationPayload() {
    const conversationId = getConversationId();
    if (!conversationId) {
      return null;
    }

    const headers = {
      Accept: 'application/json'
    };
    const accessToken = await getAccessToken();
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
    return message?.author?.role || message?.role || message?.message?.author?.role || message?.message?.role || null;
  }

  function extractPartText(part) {
    if (typeof part === 'string') {
      return cleanFastPrefix(part);
    }

    if (Array.isArray(part)) {
      return part.map(extractPartText).filter(Boolean).join('\n\n');
    }

    if (!part || typeof part !== 'object') {
      return '';
    }

    const collected = [];

    if (typeof part.text === 'string' && part.text.trim()) {
      const txt = cleanFastPrefix(part.text);
      if (txt) collected.push(txt);
    } else if (Array.isArray(part.text)) {
      const extracted = part.text.map(extractPartText).filter(Boolean).join('\n\n');
      if (extracted) collected.push(extracted);
    }

    if (typeof part.summary === 'string' && part.summary.trim()) {
      const summaryText = cleanFastPrefix(part.summary);
      const detail = typeof part.content === 'string'
        ? cleanFastPrefix(part.content)
        : extractPartText(part.content);

      if (summaryText && detail) {
        collected.push(`${summaryText}: ${detail}`);
      } else if (summaryText) {
        collected.push(summaryText);
      } else if (detail) {
        collected.push(detail);
      }
    } else if (typeof part.content === 'string' && part.content.trim()) {
      const txt = cleanFastPrefix(part.content);
      if (txt) collected.push(txt);
    } else if (Array.isArray(part.content) || (part.content && typeof part.content === 'object')) {
      const extracted = extractPartText(part.content);
      if (extracted) collected.push(extracted);
    }

    if (typeof part.result === 'string' && part.result.trim()) {
      const txt = cleanFastPrefix(part.result);
      if (txt) collected.push(txt);
    } else if (Array.isArray(part.result) || (part.result && typeof part.result === 'object')) {
      const extracted = extractPartText(part.result);
      if (extracted) collected.push(extracted);
    }

    if (typeof part.output === 'string' && part.output.trim()) {
      const txt = cleanFastPrefix(part.output);
      if (txt) collected.push(txt);
    } else if (Array.isArray(part.output) || (part.output && typeof part.output === 'object')) {
      const extracted = extractPartText(part.output);
      if (extracted) collected.push(extracted);
    }

    if (typeof part.markdown === 'string' && part.markdown.trim()) {
      const txt = cleanFastPrefix(part.markdown);
      if (txt) collected.push(txt);
    }

    if (typeof part.value === 'string' && part.value.trim()) {
      const txt = cleanFastPrefix(part.value);
      if (txt) collected.push(txt);
    }

    if (Array.isArray(part.thoughts)) {
      const extracted = part.thoughts.map(extractPartText).filter(Boolean).join('\n\n');
      if (extracted) collected.push(extracted);
    }

    if (Array.isArray(part.parts)) {
      const extracted = part.parts.map(extractPartText).filter(Boolean).join('\n\n');
      if (extracted) collected.push(extracted);
    }

    if (Array.isArray(part.messages)) {
      const extracted = part.messages.map(extractPartText).filter(Boolean).join('\n\n');
      if (extracted) collected.push(extracted);
    }

    if (Array.isArray(part.children)) {
      const extracted = part.children.map(extractPartText).filter(Boolean).join('\n\n');
      if (extracted) collected.push(extracted);
    }

    return collected.filter(Boolean).join('\n\n');
  }

  function extractMessageMarkdown(message) {
    const content = getMessageContent(message);
    if (!content || typeof content !== 'object') {
      return '';
    }

    return extractPartText(content).trim();
  }

  function getOrderedConversationMessages(payload) {
    if (!isConversationPayload(payload)) {
      return [];
    }

    const mapping = tryGetValue(() => payload.mapping, null);
    if (!mapping || typeof mapping !== 'object') {
      const messageArray = getPayloadMessageArrays(payload)[0] || [];
      return messageArray.map(entry => entry?.message || entry).filter(Boolean);
    }

    const linearConversation = tryGetValue(() => payload.linear_conversation, null);
    if (Array.isArray(linearConversation) && linearConversation.length) {
      return linearConversation
        .map(entry => {
          if (!entry) {
            return null;
          }

          if (entry.message) {
            return entry.message;
          }

          if (typeof entry === 'string') {
            return mapping[entry]?.message || null;
          }

          if (typeof entry.id === 'string') {
            return mapping[entry.id]?.message || null;
          }

          return null;
        })
        .filter(Boolean);
    }

    const lineage = [];
    const seen = new Set();
    let currentId = tryGetValue(() => payload.current_node, null);

    while (currentId && tryGetValue(() => mapping[currentId], null) && !seen.has(currentId)) {
      const node = tryGetValue(() => mapping[currentId], null);
      if (!node) {
        break;
      }
      lineage.push(node);
      seen.add(currentId);
      currentId = tryGetValue(() => node.parent, null);
    }

    const nodes = lineage.length ? lineage.reverse() : tryGetValue(() => Object.values(mapping), []);

    return nodes
      .map(node => tryGetValue(() => node?.message, null))
      .filter(Boolean);
  }

  function isSummaryOrThoughtMessage(message, markdown) {
    if (!message) return false;

    const contentType = tryGetValue(() => message?.content?.content_type, null);
    if (contentType === 'thoughts' || contentType === 'user_editable_context' || contentType === 'system_error') {
      return true;
    }

    const channel = tryGetValue(() => message?.metadata?.channel, null);
    if (channel === 'thought' || channel === 'comment') {
      return true;
    }

    const messageType = tryGetValue(() => message?.metadata?.message_type, null);
    if (messageType === 'summary' || messageType === 'thought' || messageType === 'reasoning') {
      return true;
    }

    const rawContentStr = JSON.stringify(getMessageContent(message) || '');
    if (/fast\|/i.test(rawContentStr)) {
      return true;
    }

    const rawMarkdown = markdown || extractMessageMarkdown(message);
    if (/^fast\|/i.test(rawMarkdown.trim())) {
      return true;
    }

    return false;
  }

  function buildQAPairsFromConversationPayload(payload) {
    const messages = getOrderedConversationMessages(payload);
    const pairs = [];
    let pendingUser = null;
    let pendingAssistant = [];

    const flushPair = () => {
      if (pendingUser && pendingAssistant.length) {
        const mainAnswers = pendingAssistant.filter(entry => !isSummaryOrThoughtMessage(entry.message, entry.markdown));
        const entriesToUse = mainAnswers.length ? mainAnswers : pendingAssistant;
        const combinedAnswer = entriesToUse
          .map(entry => entry.markdown)
          .filter(Boolean)
          .join('\n\n')
          .trim();

        if (combinedAnswer) {
          pairs.push({
            questionMarkdown: pendingUser,
            answerMarkdown: combinedAnswer,
            previewText: pendingUser
          });
        }
        pendingUser = null;
        pendingAssistant = [];
      }
    };

    for (const message of messages) {
      const role = tryGetValue(() => getMessageRole(message), null);
      const markdown = tryGetValue(() => extractMessageMarkdown(message), '');
      const isHidden = !!tryGetValue(() => message?.metadata?.is_visually_hidden_from_conversation, false);

      if (!role || !markdown || isHidden) {
        continue;
      }

      if (role === 'user') {
        flushPair();
        pendingUser = markdown;
        pendingAssistant = [];
        continue;
      }

      if (role === 'assistant' && pendingUser) {
        pendingAssistant.push({ message, markdown });
      }
    }

    flushPair();

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
      const markdown = htmlToMarkdown(
        pair.questionHtml.replace(/\n/g, '<br>'),
        inlineMathTemplate,
        displayMathTemplate
      );
      return markdown || stripHtml(pair.questionHtml);
    }

    if (pair.questionArticle) {
      const cleanClone = cleanArticle(pair.questionArticle);
      const questionHTML = cleanClone.outerHTML;
      const markdown = htmlToMarkdown(
        questionHTML.replace(/\n/g, '<br>'),
        inlineMathTemplate,
        displayMathTemplate
      );
      return markdown || cleanClone.textContent.trim();
    }

    return '';
  }

  function getPairAnswerMarkdown(pair, inlineMathTemplate, displayMathTemplate) {
    let rawAnswer = '';
    if (typeof pair.answerMarkdown === 'string') {
      rawAnswer = normalizeMarkdownMathDelimiters(
        pair.answerMarkdown.trim(),
        inlineMathTemplate,
        displayMathTemplate
      );
    } else if (typeof pair.answerHtml === 'string') {
      const markdown = htmlToMarkdown(
        pair.answerHtml,
        inlineMathTemplate,
        displayMathTemplate
      );
      rawAnswer = markdown || stripHtml(pair.answerHtml);
    } else if (pair.answerArticle) {
      const cleanClone = cleanArticle(pair.answerArticle);
      const answerHTML = cleanClone.outerHTML;
      const markdown = htmlToMarkdown(answerHTML, inlineMathTemplate, displayMathTemplate);
      rawAnswer = markdown || cleanClone.textContent.trim();
    }

    return cleanAuxiliaryStatusText(rawAnswer);
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

    // 2b. Remove image carousel/search-image blocks that should not appear in Markdown exports.
    doc.querySelectorAll('[class*="group/search-image"]').forEach(el => {
      const card = el.closest('div[style*="aspect-ratio"]') || el;
      card.remove();
    });
    doc.querySelectorAll('button[aria-label^="Open image details for "]').forEach(el => {
      const card = el.closest('div[style*="aspect-ratio"]') || el;
      card.remove();
    });

    // 2c. Remove details/summary disclosure widgets or search/thought status indicators
    doc.querySelectorAll('details, summary').forEach(el => {
      const text = el.textContent.trim();
      if (
        !text ||
        /^searched\s+/i.test(text) ||
        /^(worked|thought|reasoned)\s+for\s+/i.test(text) ||
        /^thinking/i.test(text) ||
        /^summary$/i.test(text)
      ) {
        el.remove();
      } else {
        const parent = el.parentNode;
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        el.remove();
      }
    });

    doc.querySelectorAll('button, span.select-none, [data-testid="thought-summary"], [data-testid="search-summary"]').forEach(el => {
      const text = el.textContent.trim();
      if (
        /^searched\s+(\d+|the|several|a\s+few)\s+(website|site|web|page)s?$/i.test(text) ||
        /^(worked|thought|reasoned)\s+for\s+(a\s+couple\s+of|a\s+few|a|\d+|\d+\.\d+)\s+(second|minute)s?$/i.test(text) ||
        /^searching(\s+the\s+web|\.\.\.)?$/i.test(text) ||
        /^thinking(\s+process|\.\.\.)?$/i.test(text)
      ) {
        el.remove();
      }
    });

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
    const markdown = cleanAuxiliaryStatusText(
      normalizeMarkdownEntities(turndownService.turndown(html))
    );

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

  function getConversationDomDiagnostics() {
    return {
      threadPresent: !!document.querySelector('#thread'),
      turnSectionCount: document.querySelectorAll('#thread section[data-turn]').length,
      turnSectionIdCount: document.querySelectorAll('#thread section[data-turn-id][data-turn]').length,
      roleNodeCount: document.querySelectorAll('#thread [data-message-author-role]').length,
      userRoleNodeCount: document.querySelectorAll('#thread [data-message-author-role="user"]').length,
      assistantRoleNodeCount: document.querySelectorAll('#thread [data-message-author-role="assistant"]').length,
      agentTurnCount: document.querySelectorAll('#thread .agent-turn').length,
      textMessageCount: document.querySelectorAll('#thread .text-message').length,
      markdownCount: document.querySelectorAll('#thread .markdown').length,
      userMessageTestIdCount: document.querySelectorAll('#thread [data-testid="user-message"]').length
    };
  }

  function nodeHasText(node) {
    return !!(node?.innerText?.trim() || node?.textContent?.trim());
  }

  function firstTextNode(root, selectors) {
    if (!root) {
      return null;
    }

    for (const selector of selectors) {
      const candidates = Array.from(root.querySelectorAll(selector));
      const candidate = candidates.find(nodeHasText);
      if (candidate) {
        return candidate;
      }
    }

    return nodeHasText(root) ? root : null;
  }

  function extractAllTurnContentNodes(turnSection, role) {
    if (!turnSection || !role) {
      return [];
    }

    const roleNode = role === 'assistant'
      ? turnSection.querySelector('[data-message-author-role="assistant"], [data-testid="assistant-turn"], .agent-turn') || turnSection
      : turnSection.querySelector('[data-message-author-role="user"], [data-testid="user-message"]') || turnSection;

    const selectors = [
      '.markdown',
      '.prose',
      '[data-testid="user-message"]',
      '[data-testid="assistant-turn"]',
      '.whitespace-pre-wrap',
      'p',
      'pre',
      'ul',
      'ol',
      'table'
    ];

    const nodes = [];
    const seen = new Set();

    for (const selector of selectors) {
      const candidates = Array.from(roleNode.querySelectorAll(selector));
      for (const candidate of candidates) {
        if (nodeHasText(candidate) && !seen.has(candidate)) {
          let isDescendantOfSeen = false;
          for (const s of seen) {
            if (s.contains(candidate)) {
              isDescendantOfSeen = true;
              break;
            }
          }
          if (!isDescendantOfSeen) {
            seen.add(candidate);
            nodes.push(candidate);
          }
        }
      }
      if (nodes.length && (selector === '.markdown' || selector === '.prose')) {
        break;
      }
    }

    return nodes;
  }

  function extractTurnContentNode(turnSection, role) {
    const nodes = extractAllTurnContentNodes(turnSection, role);
    return nodes[0] || (role === 'assistant'
      ? turnSection.querySelector('[data-message-author-role="assistant"]')
      : turnSection.querySelector('[data-message-author-role="user"]')) || null;
  }

  function getModernTurnRole(turn) {
    const dataTurn = turn.getAttribute('data-turn');
    if (dataTurn === 'user' || dataTurn === 'assistant') {
      return dataTurn;
    }

    if (turn.querySelector('[data-message-author-role="user"], [data-testid="user-message"]')) {
      return 'user';
    }

    if (turn.querySelector('[data-message-author-role="assistant"], [data-testid="assistant-turn"], .agent-turn')) {
      return 'assistant';
    }

    return null;
  }

  function extractModernTurnContentNode(turn, role) {
    const nodes = extractAllTurnContentNodes(turn, role);
    return nodes[0] || turn;
  }

  function buildQAPairsFromTurnSections() {
    const turns = Array.from(
      document.querySelectorAll('#thread section')
    );
    const pairs = [];
    let pendingUser = null;
    let pendingAssistantHtml = [];

    const flushPair = () => {
      if (pendingUser && pendingAssistantHtml.length) {
        const combinedAnswerHtml = pendingAssistantHtml.join('\n\n').trim();
        if (combinedAnswerHtml) {
          pairs.push({
            questionHtml: pendingUser.html,
            answerHtml: combinedAnswerHtml,
            previewText: pendingUser.previewText
          });
        }
        pendingUser = null;
        pendingAssistantHtml = [];
      }
    };

    for (const turn of turns) {
      const role = getModernTurnRole(turn);
      if (role === 'user') {
        const userNode = extractTurnContentNode(turn, 'user') || extractModernTurnContentNode(turn, 'user');
        if (!userNode) {
          continue;
        }

        const questionHtml = userNode.outerHTML || userNode.innerHTML || '';
        const previewText = userNode.innerText?.trim() || userNode.textContent?.trim() || '';
        if (!questionHtml && !previewText) {
          continue;
        }

        flushPair();
        pendingUser = {
          html: questionHtml,
          previewText
        };
        pendingAssistantHtml = [];
        continue;
      }

      if (role === 'assistant' && pendingUser) {
        const assistantNodes = extractAllTurnContentNodes(turn, 'assistant');
        const nodesToUse = assistantNodes.length
          ? assistantNodes
          : [extractTurnContentNode(turn, 'assistant') || extractModernTurnContentNode(turn, 'assistant')].filter(Boolean);

        for (const assistantNode of nodesToUse) {
          const answerHtml = assistantNode.outerHTML || assistantNode.innerHTML || '';
          if (answerHtml.trim()) {
            pendingAssistantHtml.push(answerHtml);
          }
        }
      }
    }

    flushPair();

    return pairs;
  }

  function getMessageArticles() {
    const seenContainers = new Set();

    return Array.from(document.querySelectorAll('[data-message-author-role]'))
      .map(roleEl => {
        const role = roleEl.getAttribute('data-message-author-role');
        if (role !== 'user' && role !== 'assistant') {
          return null;
        }

        if (roleEl.parentElement?.closest('[data-message-author-role]')) {
          return null;
        }

        const article = roleEl.closest('article') || roleEl;
        if (seenContainers.has(article)) {
          return null;
        }
        seenContainers.add(article);

        return { role, article };
      })
      .filter(Boolean);
  }

  function buildQAPairsFromDOM() {
    const messages = getMessageArticles();
    const pairs = [];
    let pendingUser = null;
    let pendingAssistantArticles = [];

    const flushPair = () => {
      if (pendingUser && pendingAssistantArticles.length) {
        if (pendingAssistantArticles.length === 1) {
          pairs.push({
            questionArticle: pendingUser,
            answerArticle: pendingAssistantArticles[0]
          });
        } else {
          const wrapper = document.createElement('div');
          for (const article of pendingAssistantArticles) {
            wrapper.appendChild(article.cloneNode(true));
          }
          pairs.push({
            questionArticle: pendingUser,
            answerArticle: wrapper
          });
        }
        pendingUser = null;
        pendingAssistantArticles = [];
      }
    };

    for (const msg of messages) {
      if (msg.role === 'user') {
        flushPair();
        pendingUser = msg.article;
        pendingAssistantArticles = [];
      } else if (msg.role === 'assistant' && pendingUser) {
        pendingAssistantArticles.push(msg.article);
      }
    }

    flushPair();

    return pairs;
  }

  function getPairRawAnswerText(pair) {
    if (!pair) {
      return '';
    }

    if (typeof pair.answerMarkdown === 'string') {
      return normalizeMarkdownEntities(pair.answerMarkdown).trim();
    }

    if (typeof pair.answerHtml === 'string') {
      return stripHtml(pair.answerHtml);
    }

    if (pair.answerArticle) {
      return pair.answerArticle.innerText?.trim() || pair.answerArticle.textContent?.trim() || '';
    }

    return '';
  }

  function scoreQAPairs(pairs) {
    return pairs.reduce((score, pair) => {
      const answerText = getPairRawAnswerText(pair);
      if (!answerText) {
        return score;
      }

      return score + 1000 + Math.min(answerText.length, 1000);
    }, 0);
  }

  async function buildQAPairs() {
    let cachedPayload = null;
    const candidates = [];

    try {
      cachedPayload = getConversationPayloadFromGlobals();
      const cachedPairs = buildQAPairsFromConversationPayload(cachedPayload);
      if (cachedPairs.length) {
        candidates.push({ source: 'cached payload', pairs: cachedPairs });
      }
    } catch (error) {
      console.warn('yachexp: cached payload extraction failed', error);
    }

    let fetchedPayload = null;
    try {
      fetchedPayload = await fetchConversationPayload();
      const fetchedPairs = buildQAPairsFromConversationPayload(fetchedPayload);
      if (fetchedPairs.length) {
        candidates.push({ source: 'fetched payload', pairs: fetchedPairs });
      }
    } catch (error) {
      console.warn('yachexp: fetched payload extraction failed', error);
    }

    try {
      const turnPairs = buildQAPairsFromTurnSections();
      if (turnPairs.length) {
        candidates.push({ source: 'turn sections', pairs: turnPairs });
      }
    } catch (error) {
      console.warn('yachexp: turn section extraction failed', error);
    }

    try {
      const domPairs = buildQAPairsFromDOM();
      if (domPairs.length) {
        candidates.push({ source: 'message articles', pairs: domPairs });
      }
    } catch (error) {
      console.warn('yachexp: DOM extraction failed', error);
    }

    if (candidates.length) {
      const best = candidates
        .map(candidate => ({
          ...candidate,
          score: scoreQAPairs(candidate.pairs)
        }))
        .sort((a, b) => b.score - a.score)[0];

      if (best.score > 0) {
        console.info('yachexp: using conversation extraction source', {
          source: best.source,
          pairs: best.pairs.length,
          score: best.score
        });
        return best.pairs;
      }
    }

    console.warn('yachexp: no conversation pairs found', {
      diagnostics: getConversationDomDiagnostics(),
      location: {
        href: location.href,
        pathname: location.pathname
      },
      payloadFound: !!cachedPayload,
      fetchedPayloadFound: !!fetchedPayload
    });

    return [];
  }

  /********************************************************************
   * Article cleaning
   ********************************************************************/

  function cleanArticle(article) {
    const clone = article.cloneNode(true);
    clone.querySelectorAll(
      'nav, button, svg, [role="toolbar"], [aria-hidden="true"], .sr-only'
    ).forEach(el => el.remove());
    return clone;
  }

  /********************************************************************
   * UI: Modal dialog
   ********************************************************************/

  function createModal(pairs) {
    const host = document.createElement('yachexp-export-ui');
    host.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: block;
      isolation: isolate;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      font-size: 14px;
      line-height: 1.4;
      color: #111;
      color-scheme: light;
    `;

    const shadowRoot = host.attachShadow({ mode: 'open' });
    const styles = document.createElement('style');
    styles.textContent = `
      :host {
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        font-size: 14px;
        line-height: 1.4;
        color: #111;
        color-scheme: light;
      }

      *, *::before, *::after {
        box-sizing: border-box;
      }

      .yachexp-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(0, 0, 0, 0.65);
      }

      .yachexp-modal {
        display: flex;
        flex-direction: column;
        width: min(640px, calc(100vw - 32px));
        height: min(700px, calc(100vh - 32px));
        min-height: 0;
        padding: 18px;
        overflow: hidden;
        border-radius: 10px;
        background: #fff;
        color: #111;
      }

      .yachexp-title {
        flex: 0 0 auto;
        margin: 0 0 14px;
        font-size: 1.25rem;
        font-weight: 600;
      }

      .yachexp-controls {
        flex: 0 0 auto;
        margin-bottom: 10px;
      }

      .yachexp-button {
        appearance: none;
        padding: 7px 12px;
        border: 1px solid #bbb;
        border-radius: 5px;
        background: #f0f0f0;
        color: #111;
        font: inherit;
        cursor: pointer;
      }

      .yachexp-button:focus-visible,
      .yachexp-checkbox:focus-visible {
        outline: 2px solid #087f5b;
        outline-offset: 2px;
      }

      .yachexp-select-all {
        margin-right: 10px;
      }

      .yachexp-list {
        flex: 1 1 auto;
        min-height: 0;
        margin-bottom: 14px;
        padding: 10px;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        border: 1px solid #ccc;
      }

      .yachexp-row {
        display: flex;
        width: 100%;
        min-width: 0;
        gap: 10px;
        align-items: flex-start;
        margin-bottom: 8px;
        color: #111;
        font: inherit;
        cursor: pointer;
      }

      .yachexp-checkbox {
        flex: 0 0 16px;
        width: 16px;
        height: 16px;
        margin: 4px 0 0;
        appearance: auto;
        accent-color: #10a37f;
        opacity: 1;
      }

      .yachexp-text {
        display: block;
        min-width: 0;
        color: #111;
        font: inherit;
        white-space: normal;
        overflow-wrap: anywhere;
      }

      .yachexp-footer {
        display: flex;
        flex: 0 0 auto;
        justify-content: flex-end;
        gap: 14px;
        padding-top: 12px;
        border-top: 1px solid #ddd;
      }

      .yachexp-export {
        border-color: #0d8d6f;
        background: #10a37f;
        color: #fff;
      }
    `;
    shadowRoot.appendChild(styles);

    const overlay = document.createElement('div');
    overlay.className = 'yachexp-overlay';

    const modal = document.createElement('div');
    modal.className = 'yachexp-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'yachexp-dialog-title');

    const title = document.createElement('h2');
    title.id = 'yachexp-dialog-title';
    title.className = 'yachexp-title';
    title.textContent = 'Export conversation to Markdown';

    const controls = document.createElement('div');
    controls.className = 'yachexp-controls';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.type = 'button';
    selectAllBtn.className = 'yachexp-button yachexp-select-all';
    selectAllBtn.textContent = 'Select all';

    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.type = 'button';
    deselectAllBtn.className = 'yachexp-button';
    deselectAllBtn.textContent = 'Deselect all';

    controls.append(selectAllBtn, deselectAllBtn);

    const list = document.createElement('div');
    list.className = 'yachexp-list';

    const checkboxes = [];

    pairs.forEach((pair, idx) => {
      const row = document.createElement('label');
      row.className = 'yachexp-row';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'yachexp-checkbox';
      cb.checked = true;
      cb.dataset.index = idx;

      const text = document.createElement('span');
      text.className = 'yachexp-text';
      text.textContent = truncate(getPairPreviewText(pair));

      row.append(cb, text);
      list.appendChild(row);
      checkboxes.push(cb);
    });

    selectAllBtn.onclick = () => checkboxes.forEach(cb => cb.checked = true);
    deselectAllBtn.onclick = () => checkboxes.forEach(cb => cb.checked = false);

    const footer = document.createElement('div');
    footer.className = 'yachexp-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'yachexp-button';
    cancelBtn.textContent = 'Cancel';

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'yachexp-button yachexp-export';
    exportBtn.textContent = 'Export';

    footer.append(cancelBtn, exportBtn);
    modal.append(title, controls, list, footer);
    overlay.appendChild(modal);
    shadowRoot.appendChild(overlay);
    document.body.appendChild(host);

    cancelBtn.onclick = () => host.remove();

    exportBtn.onclick = () => {
      const selected = checkboxes
        .filter(cb => cb.checked)
        .map(cb => pairs[cb.dataset.index]);

      exportMarkdown(selected);
      host.remove();
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
      fetchConversationPayload,
      getPairAnswerMarkdown,
      getPairQuestionMarkdown,
      getOrderedConversationMessages,
      getAccessToken,
      isConversationPayload,
      getConversationId,
      normalizeMarkdownEntities,
      normalizeMarkdownMathDelimiters,
      cleanFastPrefix,
      cleanAuxiliaryStatusText,
      htmlToMarkdown,
      textToHtml
    };
  }

})();

