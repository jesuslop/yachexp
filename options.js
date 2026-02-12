
// UI Elements
const profileList = document.getElementById('profileList');
const profileNameInput = document.getElementById('profileName');
const filenameInput = document.getElementById('filenameTemplate');
const pageInput = document.getElementById('pageTemplate');
const questionInput = document.getElementById('questionTemplate');
const inlineMathInput = document.getElementById('inlineMathTemplate');
const displayMathInput = document.getElementById('displayMathTemplate');
const statusSpan = document.getElementById('status');
const formTitle = document.getElementById('formTitle');

const settingsUpdateApi = globalThis.YachexpSettingsUpdate;

// State
let profiles = {};
let selectedProfileId = null; // Visually selected in the list
let activeProfileId = null;   // The one actually 'active' (saved in storage)

// We want to track if we should treat the selected one as the 'active' one.
// According to requirements: "Selected profile should be the default one".
// This implies the UI selection dictates what becomes active ON SAVE.

// --- Initialization ---

document.addEventListener('DOMContentLoaded', loadData);

function loadData() {
    browser.storage.local.get(null).then((items) => {
		profiles = items.profiles;
		activeProfileId = items.activeProfileId;

        selectedProfileId = activeProfileId;
        renderSidebar();
        renderForm();
    });
}

// --- Render Logic ---

function renderSidebar() {
    profileList.innerHTML = '';

    // Sort profilesByName
    const sortedIds = Object.keys(profiles).sort((a, b) =>
        (profiles[a].name || "").localeCompare(profiles[b].name || "")
    );

    sortedIds.forEach(id => {
        const li = document.createElement('li');
        li.className = 'profile-item';
        if (id === selectedProfileId) {
            li.classList.add('selected');
        }
        li.textContent = profiles[id].name || "Untitled";
        li.onclick = () => selectProfile(id);
        profileList.appendChild(li);
    });
}

function renderForm() {
    if (!selectedProfileId || !profiles[selectedProfileId]) {
        // Clear form or disable
        return;
    }
    const p = profiles[selectedProfileId];

    // Update inputs checks to avoid overwriting if user is typing? 
    // Actually this only happens on switching profiles.

    profileNameInput.value = p.name || "";
    filenameInput.value = p.filenameTemplate || "";
    pageInput.value = p.pageTemplate || "";
    questionInput.value = p.questionTemplate || "";
    inlineMathInput.value = p.inlineMathTemplate || "";
    displayMathInput.value = p.displayMathTemplate || "";

    formTitle.textContent = `Edit Profile: ${p.name}`;
}

function selectProfile(id) {
    if (selectedProfileId === id) return;

    // Optional: Auto-save current inputs to memory before switching?
    // Yes, we must capture current form state to memory before switching away.
    saveFormToMemory();

    selectedProfileId = id;
    renderSidebar();
    renderForm();
}

function saveFormToMemory() {
    if (!selectedProfileId || !profiles[selectedProfileId]) return;

    profiles[selectedProfileId].name = profileNameInput.value;
    profiles[selectedProfileId].filenameTemplate = filenameInput.value;
    profiles[selectedProfileId].pageTemplate = pageInput.value;
    profiles[selectedProfileId].questionTemplate = questionInput.value;
    profiles[selectedProfileId].inlineMathTemplate = inlineMathInput.value;
    profiles[selectedProfileId].displayMathTemplate = displayMathInput.value;
}

// --- Event Handlers (Form inputs) ---

// We can update state continuously or on blur. 
// Let's update on input so sidebar name updates live
profileNameInput.addEventListener('input', () => {
    if (selectedProfileId && profiles[selectedProfileId]) {
        profiles[selectedProfileId].name = profileNameInput.value;

        // Update sidebar text without full re-render (optimization)
        const activeItem = profileList.querySelector('.profile-item.selected');
        if (activeItem) activeItem.textContent = profileNameInput.value || "Untitled";
        formTitle.textContent = `Edit Profile: ${profileNameInput.value}`;
    }
});

// For other inputs, we can just save to memory when needed (on Save/Switch),
// but doing it on 'change' is safe too.
['change', 'input'].forEach(evt => {
    [filenameInput, pageInput, questionInput, inlineMathInput, displayMathInput].forEach(el => {
        el.addEventListener(evt, () => {
            // We'll trust saveFormToMemory mostly, but updating locally helps
            if (selectedProfileId && profiles[selectedProfileId]) {
                profiles[selectedProfileId][el.id] = el.value;
            }
        });
    });
});


// --- Button Handlers ---

document.getElementById('btnNew').addEventListener('click', () => {
    saveFormToMemory();

    const newId = uuid();
    // Unique name
    let name = "New Profile";
    let counter = 1;
    while (Object.values(profiles).some(p => p.name === name)) {
        counter++;
        name = `New Profile ${counter}`;
    }

    profiles[newId] = {
        name: name,
        pageTemplate: "",
        questionTemplate: "",
        filenameTemplate: "",
        inlineMathTemplate: "",
        displayMathTemplate: ""
    };

    selectedProfileId = newId;
    renderSidebar();
    renderForm();

    // Focus name input
    profileNameInput.focus();
    profileNameInput.select();
});

document.getElementById('btnDelete').addEventListener('click', () => {
    const ids = Object.keys(profiles);
    if (ids.length <= 1) {
        alert("Cannot delete the last profile.");
        return;
    }

    if (confirm("Are you sure you want to delete this profile?")) {
        delete profiles[selectedProfileId];

        // Pick new selection
        const remaining = Object.keys(profiles);
        selectedProfileId = remaining[0]; // exist because length > 1 before delete

        renderSidebar();
        renderForm();
    }
});

document.getElementById('btnSave').addEventListener('click', () => {
    saveFormToMemory();

    activeProfileId = selectedProfileId;

    browser.storage.local.set({
        profiles: profiles,
        activeProfileId: activeProfileId
    }).then(() => {
        showStatus("Configurations Saved!");
    });
});




// --- Export / Import Logic ---

document.getElementById('btnExport').addEventListener('click', () => {
    browser.storage.local.get(null).then((items) => {
        const json = JSON.stringify(items, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const outputFilename = `yachexp-settings-${timestamp}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = outputFilename;
        a.click();

        URL.revokeObjectURL(url);
        showStatus("Settings Exported!");
    });
});

document.getElementById('btnImport').addEventListener('click', () => {
    document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const backup = await browser.storage.local.get(null);
        try {
            const data = JSON.parse(event.target.result);
            const { settings: normalized, resetReason } = await settingsUpdateApi.normalizeSettings(data);
            if (resetReason) {
                await restoreSettings(backup);
                alert(`Imported settings were rejected because ${resetReason}. Previous settings were restored.`);
                return;
            }

            // Basic validation: check if profiles exist
            if (!normalized.profiles) {
                await restoreSettings(backup);
                alert("Invalid settings file: missing 'profiles'. Previous settings were restored.");
                return;
            }

            if (confirm("This will overwrite current settings. Continue?")) {
                const current = await browser.storage.local.get(null);
                await settingsUpdateApi.replaceStorage(normalized, current);
                alert("Settings imported successfully!");
                window.location.reload();
            }
        } catch (err) {
            console.error(err);
            await restoreSettings(backup);
            alert("Error importing settings file: " + err.message + ". Previous settings were restored.");
        }
    };
    reader.readAsText(file);
    // Reset input so same file selection triggers change if needed
    e.target.value = '';
});

// --- Utils ---

function uuid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function showStatus(msg) {
    statusSpan.textContent = msg;
    statusSpan.classList.add('show');
    setTimeout(() => {
        statusSpan.classList.remove('show');
    }, 2000);
}

async function restoreSettings(backup) {
    if (!backup) return;
    const current = await browser.storage.local.get(null);
    await settingsUpdateApi.replaceStorage(backup, current);
}
