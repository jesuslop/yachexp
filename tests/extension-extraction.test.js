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

test("buildQAPairsFromConversationPayload respects linear_conversation ordering", () => {
  const extension = loadExtensionModule();
  const payload = {
    mapping: {
      "assistant-1": {
        id: "assistant-1",
        parent: "user-1",
        message: {
          author: { role: "assistant" },
          content: {
            content_type: "multimodal_text",
            parts: [
              {
                content_type: "text",
                text: ["Answer block one", "Answer block two"]
              }
            ]
          }
        }
      },
      "user-1": {
        id: "user-1",
        parent: "root",
        message: {
          author: { role: "user" },
          content: {
            parts: ["Question body"]
          }
        }
      }
    },
    linear_conversation: [
      { id: "user-1" },
      { id: "assistant-1" }
    ]
  };

  const pairs = extension.buildQAPairsFromConversationPayload(payload);

  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].questionMarkdown, "Question body");
  assert.equal(pairs[0].answerMarkdown, "Answer block one\n\nAnswer block two");
});

test("buildQAPairsFromConversationPayload supports flat message lists", () => {
  const extension = loadExtensionModule();
  const payload = {
    conversation: {
      messages: [
        {
          author: { role: "user" },
          content: { parts: ["First question"] }
        },
        {
          author: { role: "assistant" },
          content: { parts: ["First answer"] }
        },
        {
          role: "user",
          content: { parts: ["Second question"] }
        },
        {
          role: "assistant",
          content: { parts: ["Second answer"] }
        }
      ]
    }
  };

  const pairs = extension.buildQAPairsFromConversationPayload(payload);

  assert.equal(pairs.length, 2);
  assert.equal(pairs[0].questionMarkdown, "First question");
  assert.equal(pairs[0].answerMarkdown, "First answer");
  assert.equal(pairs[1].questionMarkdown, "Second question");
  assert.equal(pairs[1].answerMarkdown, "Second answer");
});

test("buildQAPairsFromConversationPayload supports wrapped linear message entries", () => {
  const extension = loadExtensionModule();
  const payload = {
    linear_conversation: [
      {
        message: {
          author: { role: "user" },
          content: { parts: ["Wrapped question"] }
        }
      },
      {
        message: {
          author: { role: "assistant" },
          content: { parts: ["Wrapped answer"] }
        }
      }
    ]
  };

  const pairs = extension.buildQAPairsFromConversationPayload(payload);

  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].questionMarkdown, "Wrapped question");
  assert.equal(pairs[0].answerMarkdown, "Wrapped answer");
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

test("extractMessageMarkdown supports multimodal text arrays", () => {
  const extension = loadExtensionModule();

  const markdown = extension.extractMessageMarkdown({
    content: {
      content_type: "multimodal_text",
      parts: [
        {
          content_type: "text",
          text: ["first multimodal block", "second multimodal block"]
        },
        {
          thoughts: [
            { summary: "Reasoning", content: "trimmed summary" }
          ]
        }
      ]
    }
  });

  assert.equal(
    markdown,
    "first multimodal block\n\nsecond multimodal block\n\nReasoning: trimmed summary"
  );
});

test("extractMessageMarkdown supports nested structured answer content", () => {
  const extension = loadExtensionModule();

  const markdown = extension.extractMessageMarkdown({
    content: {
      content_type: "structured_text",
      parts: [
        {
          content_type: "paragraph",
          content: [
            { text: "Nested paragraph one." },
            {
              content_type: "list",
              children: [
                { markdown: "- Nested bullet" },
                { output: { text: "Nested output block" } }
              ]
            }
          ]
        }
      ]
    }
  });

  assert.equal(
    markdown,
    "Nested paragraph one.\n\n- Nested bullet\n\nNested output block"
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

test("normalizeMarkdownMathDelimiters preserves list indentation for display math blocks", () => {
  const extension = loadExtensionModule();

  const markdown = [
    "- Define",
    "  \\[",
    "  \\zeta(s) = \\sum_{n=1}^\\infty \\frac{1}{n^s}",
    "  \\]",
    "  for \\(\\Re(s) > 1\\)"
  ].join("\n");

  const normalized = extension.normalizeMarkdownMathDelimiters(
    markdown,
    "${latex}$",
    "$$\n{latex}\n$$"
  );

  assert.equal(
    normalized,
    [
      "- Define",
      "  $$",
      "  \\zeta(s) = \\sum_{n=1}^\\infty \\frac{1}{n^s}",
      "  $$",
      "  for $\\Re(s) > 1$"
    ].join("\n")
  );
});

test("normalizeMarkdownMathDelimiters keeps separate display math blocks from bleeding together", () => {
  const extension = loadExtensionModule();

  const markdown = [
    "The statement  ",
    "\\[",
    "1 + 2 + 3 + 4 + \\dots = -\\frac{1}{12}",
    "\\]  ",
    "is **not true in the usual sense of summation**.",
    "",
    "- Define  ",
    "  \\[",
    "  \\zeta(s) = \\sum_{n=1}^\\infty \\frac{1}{n^s}",
    "  \\]",
    "  for \\(\\Re(s) > 1\\)"
  ].join("\n");

  const normalized = extension.normalizeMarkdownMathDelimiters(
    markdown,
    "${latex}$",
    "$$\n{latex}\n$$"
  );

  assert.equal(
    normalized,
    [
      "The statement  ",
      "$$",
      "1 + 2 + 3 + 4 + \\dots = -\\frac{1}{12}",
      "$$",
      "is **not true in the usual sense of summation**.",
      "",
      "- Define  ",
      "  $$",
      "  \\zeta(s) = \\sum_{n=1}^\\infty \\frac{1}{n^s}",
      "  $$",
      "  for $\\Re(s) > 1$"
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

test("normalizeMarkdownEntities removes ChatGPT image group markers", () => {
  const extension = loadExtensionModule();

  assert.equal(
    extension.normalizeMarkdownEntities(
      [
        "Before",
        "",
        'image_group{"aspect_ratio":"1:1","query":["foo"],"num_per_query":1}',
        "",
        "After"
      ].join("\n")
    ),
    "Before\n\nAfter"
  );
});

test("normalizeMarkdownEntities strips unknown widget markers", () => {
  const extension = loadExtensionModule();

  assert.equal(
    extension.normalizeMarkdownEntities(
      "Before genui{\"math_block_widget_always_prefetch_v2\":{\"content\":\"F = dA + A \\\wedge A\"}} After"
    ),
    "Before  After"
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

test("getConversationId reads conversation IDs from query parameters", () => {
  const previousLocation = globalThis.location;
  const previousDocument = globalThis.document;

  globalThis.location = {
    pathname: "/g/g-12345",
    search: "?conversationId=123e4567-e89b-12d3-a456-426614174000"
  };
  globalThis.document = {
    querySelector: () => null
  };

  try {
    const extension = loadExtensionModule();
    assert.equal(
      extension.getConversationId(),
      "123e4567-e89b-12d3-a456-426614174000"
    );
  } finally {
    globalThis.location = previousLocation;
    globalThis.document = previousDocument;
  }
});
