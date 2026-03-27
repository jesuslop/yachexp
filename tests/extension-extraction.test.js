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
