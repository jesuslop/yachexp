const test = require("node:test");
const assert = require("node:assert/strict");

function loadExtensionModule() {
  const extensionPath = require.resolve("../extension.js");
  delete require.cache[extensionPath];

  globalThis.browser = {
    runtime: {
      onMessage: {
        addListener: () => {}
      }
    },
    storage: {
      local: {
        get: async () => ({})
      }
    }
  };

  return require(extensionPath);
}

test("buildQAPairsFromConversationPayload pairs user and assistant mapping messages", () => {
  const extension = loadExtensionModule();
  const payload = {
    current_node: "assistant-1",
    mapping: {
      root: {
        id: "root",
        parent: null,
        message: {
          author: { role: "system" },
          content: { parts: ["system prompt"] }
        }
      },
      "user-1": {
        id: "user-1",
        parent: "root",
        message: {
          author: { role: "user" },
          content: { parts: ["markdown prose\nwith multiple lines"] }
        }
      },
      "assistant-1": {
        id: "assistant-1",
        parent: "user-1",
        message: {
          author: { role: "assistant" },
          content: { parts: ["## Heading\n\nAnswer body"] }
        }
      }
    }
  };

  const pairs = extension.buildQAPairsFromConversationPayload(payload);

  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].questionMarkdown, "markdown prose\nwith multiple lines");
  assert.equal(pairs[0].answerMarkdown, "## Heading\n\nAnswer body");
  assert.equal(pairs[0].previewText, "markdown prose\nwith multiple lines");
});

test("extractMessageMarkdown supports string and object parts", () => {
  const extension = loadExtensionModule();

  const markdown = extension.extractMessageMarkdown({
    content: {
      parts: [
        "first block",
        { text: "second block" },
        { content: "third block" },
        { parts: ["nested fourth"] }
      ]
    }
  });

  assert.equal(
    markdown,
    "first block\n\nsecond block\n\nthird block\n\nnested fourth"
  );
});

test("normalizeMarkdownMathDelimiters rewrites configured math delimiters without touching code", () => {
  const extension = loadExtensionModule();

  const markdown = [
    "Inline math: \\(e=mc^2\\)",
    "",
    "\\[",
    "U \\mapsto \\Omega^k(U)",
    "\\]",
    "",
    "`\\(leave me alone\\)`",
    "",
    "```tex",
    "\\[",
    "also_leave_me_alone",
    "\\]",
    "```"
  ].join("\n");

  const normalized = extension.normalizeMarkdownMathDelimiters(
    markdown,
    "${latex}$",
    "$$\n{latex}\n$$"
  );

  assert.equal(
    normalized,
    [
      "Inline math: $e=mc^2$",
      "",
      "$$",
      "U \\mapsto \\Omega^k(U)",
      "$$",
      "",
      "`\\(leave me alone\\)`",
      "",
      "```tex",
      "\\[",
      "also_leave_me_alone",
      "\\]",
      "```"
    ].join("\n")
  );
});

test("normalizeMarkdownEntities converts ChatGPT entity markers to their display text", () => {
  const extension = loadExtensionModule();

  assert.equal(
    extension.normalizeMarkdownEntities(
      '**entity["scientific_concept","Riemann curvature tensor","differential geometry"]**'
    ),
    "**Riemann curvature tensor**"
  );
});

test("pair markdown extraction applies active math templates to payload markdown", () => {
  const extension = loadExtensionModule();

  assert.equal(
    extension.getPairQuestionMarkdown(
      {
        questionMarkdown: "Question with \\(a+b\\) inline math."
      },
      "@@{latex}@@",
      "<<\n{latex}\n>>"
    ),
    "Question with @@a+b@@ inline math."
  );

  assert.equal(
    extension.getPairAnswerMarkdown(
      {
        answerMarkdown: [
          "Before",
          "",
          '**entity["scientific_concept","Riemann curvature tensor","differential geometry"]**',
          "",
          "\\[",
          "A = B",
          "\\]",
          "",
          "After"
        ].join("\n")
      },
      "@@{latex}@@",
      "<<\n{latex}\n>>"
    ),
    "Before\n\n**Riemann curvature tensor**\n\n<<\nA = B\n>>\n\nAfter"
  );
});
