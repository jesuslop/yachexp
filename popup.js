const DEFAULTS = {
    pageTemplate: `# {title}\n\n- **Link:** [{link}]({link})\n- **Date:** {date}\n\n---\n\n`,
    questionTemplate: `\n\n\`\`\`ad-bubble\n{question}\n\`\`\``,
    filenameTemplate: `{title}`
};

// UI Elements
const viewManager = document.getElementById('view-manager');
const viewEditor = document.getElementById('view-editor');
const profileSelector = document.getElementById('profileSelector');
const editorTitle = document.getElementById('editorTitle');
const statusSpan = document.getElementById('status');

// Editor Inputs
const filenameInput = document.getElementById('filenameTemplate');
const pageInput = document.getElementById('pageTemplate');
const questionInput = document.getElementById('questionTemplate');

// State
let profiles = {};
let activeProfileId = null;
let editingProfileId = null; // ID of the profile currently being edited

// --- Initialization ---

document.addEventListener('DOMContentLoaded', loadData);

function loadData() {
    browser.storage.local.get(null).then((items) => {
        // Initialization Logic (Clean start / Support new schema only)
        if (!items.profiles) {
            console.log("No profiles found. Initializing fresh defaults.");
            const defaultId = uuid();
            profiles = {
                [defaultId]: {
                    name: "Default",
                    pageTemplate: DEFAULTS.pageTemplate,
                    questionTemplate: DEFAULTS.questionTemplate,
                    filenameTemplate: DEFAULTS.filenameTemplate
                }
            };
            activeProfileId = defaultId;
            saveAll(false); // Save initialization immediately
        } else {
            profiles = items.profiles;
            activeProfileId = items.activeProfileId;
        }
        renderManager();
    });
}

// --- Manager Logic ---

function renderManager() {
    profileSelector.innerHTML = '';

    // Sort profiles by name for display? Or insertion order? Let's do name.
    const sortedIds = Object.keys(profiles).sort((a, b) =>
        profiles[a].name.localeCompare(profiles[b].name)
    );

    sortedIds.forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = profiles[id].name;
        if (id === activeProfileId) opt.selected = true;
        profileSelector.appendChild(opt);
    });

    // Update state if the previously active one was deleted (handled in delete, but safe check)
    if (!profiles[activeProfileId] && sortedIds.length > 0) {
        activeProfileId = sortedIds[0];
        profileSelector.value = activeProfileId;
    }
}

document.getElementById('profileSelector').addEventListener('change', (e) => {
    // Just update local state
    // We don't save activeProfileId until "OK" is clicked, logic says:
    // "Dialog should offer buttons for... ok, to change the active profile"
    // So visual selection changes, but we might want to track "pendingActiveId" vs "savedActiveId"?
    // The requirement says: "Select active profile between a list... Ok buttons are expected to perform functionality... not to just offering on-dialog completion"
    // So selecting in dropdown IS the "selection", clicking OK confirms it.
    // So here strictly we don't save yet.
});

document.getElementById('btnNew').addEventListener('click', () => {
    // "Delete operation should forbid deleting the last existing profile."
    // "Create... There should be UI... CRUD"

    // Simple name prompt
    /* 
       Since I cannot use prompt() comfortably in all extensions (though often works in popup), 
       and I want to avoid blocking, I'll generate a unique name or just "New Profile" 
       and let them rename it? 
       Wait, I didn't add a rename feature in the Editor View. 
       The requirements said: "Editing a profile should do... multiline inputs... new extra field for Filename template... label saying 'Editing... <profile>'"
       It didn't explicitly ask for a Rename field in the editor.
       But "CRUD" implies Update. Renaming is basic. 
       I'll assume the name is immutable or valid to ask via prompt for now to keep UI simple as requested.
    */

    const name = window.prompt("Enter name for new profile:");
    if (!name) return;

    const newId = uuid();
    profiles[newId] = {
        name: name,
        pageTemplate: DEFAULTS.pageTemplate,
        questionTemplate: DEFAULTS.questionTemplate,
        filenameTemplate: DEFAULTS.filenameTemplate
    };

    // Select the new profile
    activeProfileId = newId;
    renderManager();

    // Optionally jump to edit immediately? 
    // "Editing a profile should do the same work as extension is doing now... opening a further modal"
    // So flow: Create -> Selected -> User clicks Edit.
    // Or I can auto-open editor. Let's auto-open for better UX.
    startEditing(newId);
});

document.getElementById('btnEdit').addEventListener('click', () => {
    const selectedId = profileSelector.value;
    if (!selectedId) return;
    startEditing(selectedId);
});

document.getElementById('btnDelete').addEventListener('click', () => {
    const selectedId = profileSelector.value;
    if (!selectedId) return;

    const ids = Object.keys(profiles);
    if (ids.length <= 1) {
        alert("Cannot delete the last profile.");
        return;
    }

    if (confirm(`Delete profile "${profiles[selectedId].name}"?`)) {
        delete profiles[selectedId];
        // If we deleted the "active" one (pending or saved), switch to another
        if (activeProfileId === selectedId) {
            // Pick the first remaining
            activeProfileId = Object.keys(profiles)[0];
        }
        renderManager();
    }
});

document.getElementById('managerOk').addEventListener('click', () => {
    // Commit the selected profile as active
    activeProfileId = profileSelector.value;
    saveAll(true);
});

document.getElementById('managerCancel').addEventListener('click', () => {
    window.close();
});

// --- Editor Logic ---

function startEditing(id) {
    editingProfileId = id;
    const p = profiles[id];

    editorTitle.textContent = `Editing conversion profile ${p.name}`;
    filenameInput.value = p.filenameTemplate || DEFAULTS.filenameTemplate; // fallback if missing property
    pageInput.value = p.pageTemplate;
    questionInput.value = p.questionTemplate;

    viewManager.classList.add('hidden');
    viewEditor.classList.remove('hidden');
}

document.getElementById('editorOk').addEventListener('click', () => {
    // Save changes to memory
    if (profiles[editingProfileId]) {
        profiles[editingProfileId].filenameTemplate = filenameInput.value;
        profiles[editingProfileId].pageTemplate = pageInput.value;
        profiles[editingProfileId].questionTemplate = questionInput.value;
    }

    // Return to Manager
    viewEditor.classList.add('hidden');
    viewManager.classList.remove('hidden');
    editingProfileId = null;

    // We haven't saved to storage yet, user needs to click OK on manager?
    // "Ok buttons are expected to perform functionality and then close modal dialogs"
    // Wait. "Editing a profile... opening a further modal dialog... Standard ok and cancel buttons... Ok buttons are expected to perform functionality and then close modal buttons"
    // Does Editor OK close the Editor OR the whole Popup?
    // Usually "further modal" implies a stack.
    // If I close the popup, the flow is interrupted.
    // "Dialog should offer buttons for editing selected profile... Ok, to change the active profile... and cancel, to close the dialog"
    // This implies Manager OK closes Popup.
    // "Editing a profile should do... opening a further modal... Standard ok and cancel buttons."
    // If Editor OK closes just the Editor, that makes sense.
    // BUT checking user requirement: "not to just offering on-dialog completion notices".
    // I interpret this as: Editor OK saves the profile edits (functionality) and closes the Editor modal (going back to Manager).
    // Manager OK saves the Active Profile selection and closes the Extension Popup.

    // However, if I edit a profile, I probably want that saved permanently even if I Cancel the Manager level?
    // Or is it a transaction?
    // "Implementation will offer a baked in default profile... Dialog should offer buttons for editing... ok... and cancel".
    // I think it's safest to save to storage on Editor OK too, to avoid data loss.
    // But then "Manager Cancel" wouldn't revert edits.
    // "Cancel, to close the dialog without changes".
    // If I Cancel Manager, I assume I want to revert active profile change?
    // If I Edit Profile -> OK -> Cancel Manager. Do I expect my profile edits to persist?
    // Usually "Cancel" on the main dialog means "Discard all session changes".
    // BUT given the complexity, saving on Editor OK is safer for users.
    // Let's stick to: Editor OK updates MEMORY. Manager OK commits MEMORY to STORAGE.
    // That satisfies "Cancel... without changes".
});

document.getElementById('editorCancel').addEventListener('click', () => {
    // Discard changes, return to manager
    viewEditor.classList.add('hidden');
    viewManager.classList.remove('hidden');
    editingProfileId = null;
});

// --- Utilities ---

function saveAll(closeAfter = false) {
    browser.storage.local.set({
        profiles: profiles,
        activeProfileId: activeProfileId
    }).then(() => {
        if (closeAfter) {
            window.close();
        } else {
            showStatus('Saved!');
        }
    });
}

function showStatus(msg) {
    statusSpan.textContent = msg;
    statusSpan.classList.add('show');
    setTimeout(() => {
        statusSpan.classList.remove('show');
    }, 2000);
}

function uuid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

