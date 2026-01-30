const DEFAULTS = {
    pageTemplate: `# {title}\n\n- **Link:** [{link}]({link})\n- **Date:** {date}\n\n---\n\n`,
    questionTemplate: `\n\n\`\`\`ad-bubble\n{question}\n\`\`\``,
    filenameTemplate: `{title}`,
    inlineMathTemplate: "${latex}$",
    displayMathTemplate: "\n$$\n{latex}\n$$\n"
};

function uuid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

browser.runtime.onInstalled.addListener(() => {
    browser.storage.local.clear().then(() => {
        const defaultId = uuid();
        const profiles = {
            [defaultId]: {
                name: "Default",
                ...DEFAULTS
            }
        };
        browser.storage.local.set({
            profiles: profiles,
            activeProfileId: defaultId
        });
    });
});
