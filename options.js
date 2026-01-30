
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
        if (items.profiles) {
            profiles = items.profiles;
            activeProfileId = items.activeProfileId;
        } else {
            // Fallback if empty (shouldn't happen with background init)
            // We can init defaults here just in case
            const defaultId = uuid();
            profiles = {
                [defaultId]: {
                    name: "Default",
                    pageTemplate: "",
                    questionTemplate: "",
                    filenameTemplate: "" // etc
                }
            };
            activeProfileId = defaultId;
        }

        // Initial selection: Select the active profile
        // If activeProfileId is missing or invalid, pick first
        if (!profiles[activeProfileId]) {
            const ids = Object.keys(profiles);
            if (ids.length > 0) activeProfileId = ids[0];
        }

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
