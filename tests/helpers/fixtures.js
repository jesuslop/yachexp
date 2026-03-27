const fs = require("fs");
const path = require("path");
const { PROJECT_ROOT } = require("./test-globals");

const PROFILE_ADDS = {
  notesTemplate: "Notes: {title}",
  exportFormat: "markdown"
};
const ROOT_ADDS = {
  uiTheme: "classic"
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeV1Settings() {
  const raw = fs.readFileSync(
    path.join(PROJECT_ROOT, "default-settings.json"),
    "utf8"
  );
  return JSON.parse(raw);
}

function stripSchema(settings) {
  const { schema_version, ...rest } = settings;
  return rest;
}

function withSchema(settings, version) {
  return {
    ...settings,
    schema_version: version
  };
}

function applyV2Adds(state) {
  const next = deepClone(state);
  next.uiTheme = ROOT_ADDS.uiTheme;
  Object.values(next.profiles).forEach((profile) => {
    profile.notesTemplate = PROFILE_ADDS.notesTemplate;
    profile.exportFormat = PROFILE_ADDS.exportFormat;
  });
  return next;
}

function applyV3Deletes(state) {
  const next = deepClone(state);
  Object.values(next.profiles).forEach((profile) => {
    delete profile.inlineMathTemplate;
    delete profile.notesTemplate;
  });
  return next;
}

function applyV4Uppercase(state) {
  const next = deepClone(state);
  Object.values(next.profiles).forEach((profile) => {
    if (typeof profile.filenameTemplate === "string") {
      profile.filenameTemplate = profile.filenameTemplate.toUpperCase();
    }
  });
  return next;
}

function uppercaseFilenameTemplateHook(state) {
  return applyV4Uppercase(state);
}

function buildMigrationSteps() {
  const jsonataV1ToV2 = `
    $merge([
      $,
      {
        "uiTheme": "${ROOT_ADDS.uiTheme}",
        "profiles": $merge(
          $map($keys($$.profiles), function($k) {
            {
              $k: $merge([
                $lookup($$.profiles, $k),
                {
                  "notesTemplate": "${PROFILE_ADDS.notesTemplate}",
                  "exportFormat": "${PROFILE_ADDS.exportFormat}"
                }
              ])
            }
          })
        )
      }
    ])
  `;

  const jsonataV2ToV3 = `
    {
      "activeProfileId": $$.activeProfileId,
      "uiTheme": $$.uiTheme,
      "profiles": $merge(
        $map($keys($$.profiles), function($k) {
          {
            $k: {
              "name": $lookup($$.profiles, $k).name,
              "pageTemplate": $lookup($$.profiles, $k).pageTemplate,
              "questionTemplate": $lookup($$.profiles, $k).questionTemplate,
              "filenameTemplate": $lookup($$.profiles, $k).filenameTemplate,
              "displayMathTemplate": $lookup($$.profiles, $k).displayMathTemplate,
              "exportFormat": $lookup($$.profiles, $k).exportFormat
            }
          }
        })
      )
    }
  `;

  const jsonataV1ToV3 = `
    {
      "activeProfileId": $$.activeProfileId,
      "profiles": $merge(
        $map($keys($$.profiles), function($k) {
          {
            $k: {
              "name": $lookup($$.profiles, $k).name,
              "pageTemplate": $lookup($$.profiles, $k).pageTemplate,
              "questionTemplate": $lookup($$.profiles, $k).questionTemplate,
              "filenameTemplate": $lookup($$.profiles, $k).filenameTemplate,
              "displayMathTemplate": $lookup($$.profiles, $k).displayMathTemplate
            }
          }
        })
      )
    }
  `;

  return {
    v1ToV2: { name: "v1-to-v2", from: 1, to: 2, jsonata: jsonataV1ToV2 },
    v2ToV3: { name: "v2-to-v3", from: 2, to: 3, jsonata: jsonataV2ToV3 },
    v1ToV3: { name: "v1-to-v3", from: 1, to: 3, jsonata: jsonataV1ToV3 },
    v1ToV4: {
      name: "v1-to-v4",
      from: 1,
      to: 4,
      hook: uppercaseFilenameTemplateHook
    },
    v2ToV4: {
      name: "v2-to-v4",
      from: 2,
      to: 4,
      hook: uppercaseFilenameTemplateHook
    },
    v3ToV4: {
      name: "v3-to-v4",
      from: 3,
      to: 4,
      hook: uppercaseFilenameTemplateHook
    }
  };
}

function buildJsonataMock(steps) {
  const expressionMap = new Map([
    [steps.v1ToV2.jsonata, applyV2Adds],
    [steps.v2ToV3.jsonata, applyV3Deletes],
    [steps.v1ToV3.jsonata, applyV3Deletes]
  ]);

  return (expression) => {
    const handler = expressionMap.get(expression);
    if (!handler) {
      throw new Error(`Unknown JSONata expression in test: ${expression}`);
    }
    return {
      evaluate: (state) => handler(state)
    };
  };
}

module.exports = {
  makeV1Settings,
  stripSchema,
  withSchema,
  applyV2Adds,
  applyV3Deletes,
  applyV4Uppercase,
  uppercaseFilenameTemplateHook,
  buildMigrationSteps,
  buildJsonataMock
};
