const DEFAULTS = {
    pageTemplate: `# {title}\n\n- **Link:** [{link}]({link})\n- **Date:** {date}\n\n---\n\n`,
    questionTemplate: `\n\n\`\`\`ad-bubble\n{question}\n\`\`\``
};

const pageTemplateInput = document.getElementById('pageTemplate');
const questionTemplateInput = document.getElementById('questionTemplate');
const statusSpan = document.getElementById('status');

// Load settings
document.addEventListener('DOMContentLoaded', restoreOptions);

// Save logic
document.getElementById('save').addEventListener('click', saveOptions);

// Reset logic
document.getElementById('resetPage').addEventListener('click', () => {
    pageTemplateInput.value = DEFAULTS.pageTemplate;
});

document.getElementById('resetQuestion').addEventListener('click', () => {
    questionTemplateInput.value = DEFAULTS.questionTemplate;
});

function saveOptions() {
    browser.storage.local.set({
        pageTemplate: pageTemplateInput.value,
        questionTemplate: questionTemplateInput.value
    }).then(() => {
        showStatus('Saved!');
    });
}

function restoreOptions() {
    browser.storage.local.get({
        pageTemplate: DEFAULTS.pageTemplate,
        questionTemplate: DEFAULTS.questionTemplate
    }).then((items) => {
        pageTemplateInput.value = items.pageTemplate;
        questionTemplateInput.value = items.questionTemplate;
    });
}

function showStatus(msg) {
    statusSpan.textContent = msg;
    statusSpan.classList.add('show');
    setTimeout(() => {
        statusSpan.classList.remove('show');
    }, 2000);
}
