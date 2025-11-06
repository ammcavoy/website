// Dynamic Admin Section Generator
// Automatically creates admin UI for any tab defined in tabs-config.json

// Store tab-specific managers
const tabManagers = {};

// Initialize dynamic admin sections
async function initializeDynamicAdmins() {
    try {
        const response = await fetch('tabs-config.json');
        const config = await response.json();

        const adminContainer = document.getElementById('admin-sections-container');
        const tabButtonsContainer = document.getElementById('admin-tab-buttons');

        if (!adminContainer || !tabButtonsContainer) {
            console.error('Admin containers not found');
            return;
        }

        config.tabs.forEach((tab, index) => {
            if (!tab.enabled) return;

            // Create admin tab button
            const tabBtn = document.createElement('button');
            tabBtn.className = 'admin-tab-btn';
            tabBtn.id = `admin-tab-btn-${tab.id}`;
            tabBtn.textContent = `Manage ${tab.label}`;
            tabBtn.onclick = () => switchAdminTab(tab.id);
            tabButtonsContainer.appendChild(tabBtn);

            // Generate admin section
            const section = generateAdminSection(tab);
            adminContainer.appendChild(section);

            // Initialize manager for this tab
            tabManagers[tab.id] = new TabContentManager(tab);
        });

    } catch (error) {
        console.error('Error initializing dynamic admins:', error);
    }
}

// Generate admin section HTML for a tab
function generateAdminSection(tab) {
    const section = document.createElement('div');
    section.id = `admin-${tab.id}-section`;
    section.className = 'admin-section';
    section.style.display = 'none';

    section.innerHTML = `
        <h2>Manage ${tab.label}</h2>
        <p>Create, edit, and manage ${tab.label.toLowerCase()} entries.</p>

        <div class="edit-mode-selector">
            <button type="button" class="mode-btn active" onclick="switchContentMode('${tab.id}', 'create')">Create New</button>
            <button type="button" class="mode-btn" onclick="switchContentMode('${tab.id}', 'edit')">Edit Existing</button>
        </div>

        <div id="${tab.id}-edit-selector" style="display: none;">
            <div class="form-group">
                <label for="${tab.id}-existing-items">Select Item to Edit</label>
                <select id="${tab.id}-existing-items" onchange="loadItemForEdit('${tab.id}')">
                    <option value="">-- Choose an item --</option>
                </select>
            </div>
            <div id="${tab.id}-delete-section" style="display: none; margin-top: 1rem;">
                <button type="button" class="delete-btn" onclick="deleteItem('${tab.id}')" style="background-color: #dc3545; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 4px; cursor: pointer;">Delete This Item</button>
            </div>
        </div>

        <form id="${tab.id}-form">
            ${generateFormFields(tab)}

            <button type="submit" class="submit-btn">Save to GitHub</button>
        </form>

        <div id="${tab.id}-output-section" class="output-section">
            <h3>Item Saved Successfully!</h3>
            <p>Your item has been committed to GitHub and will be visible on your website shortly.</p>
            <h4>Item Details</h4>
            <pre id="${tab.id}-json-output"></pre>
            <h4>View on GitHub</h4>
            <p id="${tab.id}-github-link"></p>
        </div>
    `;

    return section;
}

// Generate form fields for a tab
function generateFormFields(tab) {
    let html = `
        <div class="form-group">
            <label for="${tab.id}-id">Item ID *</label>
            <input type="text" id="${tab.id}-id" placeholder="e.g., my-item-2025" required>
            <small>Use lowercase letters, numbers, and hyphens only</small>
        </div>

        <div class="form-group">
            <label for="${tab.id}-title">Title *</label>
            <input type="text" id="${tab.id}-title" placeholder="e.g., My Great Adventure" required>
        </div>
    `;

    // Add category checkboxes if subtypes exist
    if (tab.subtypes && tab.subtypes.length > 0) {
        const checkboxes = tab.subtypes.map(subtype => `
            <div class="category-checkbox-item">
                <input type="checkbox" id="${tab.id}-category-${subtype.id}" name="${tab.id}-categories" value="${subtype.id}" onchange="updateDateFieldsForTab('${tab.id}')">
                <label for="${tab.id}-category-${subtype.id}">${subtype.icon || ''} ${subtype.label}</label>
            </div>
        `).join('');

        html += `
            <div class="form-group">
                <label>Categories * <small>(Select at least one)</small></label>
                <div id="${tab.id}-adventure-categories" class="category-checkboxes">
                    ${checkboxes}
                </div>
            </div>
        `;
    }

    // Add date fields
    html += `
        <div class="form-group" id="${tab.id}-single-date-group">
            <label for="${tab.id}-date">Date *</label>
            <input type="date" id="${tab.id}-date">
        </div>

        <div class="form-group" id="${tab.id}-date-range-group" style="display: none;">
            <label for="${tab.id}-start-date">Start Date *</label>
            <input type="date" id="${tab.id}-start-date">
            <label for="${tab.id}-end-date" style="margin-top: 0.5rem;">End Date *</label>
            <input type="date" id="${tab.id}-end-date">
        </div>

        <div class="form-group">
            <label for="${tab.id}-description">Description *</label>
            <textarea id="${tab.id}-description" placeholder="Write about this item..." required></textarea>
        </div>

        <div class="form-group">
            <label for="${tab.id}-youtube-url">YouTube Video URL <small>(optional)</small></label>
            <input type="url" id="${tab.id}-youtube-url" placeholder="e.g., https://www.youtube.com/watch?v=...">
            <small>Paste a YouTube video URL to display a clickable thumbnail</small>
        </div>

        <div class="form-group">
            <label for="${tab.id}-gpx-files">GPX Files <small>(optional)</small></label>
            <div id="${tab.id}-existing-gpx-list" style="margin-bottom: 1rem; display: none;">
                <div style="font-weight: 500; margin-bottom: 0.5rem;">Current GPX Files:</div>
                <div id="${tab.id}-gpx-files-container"></div>
            </div>
            <input type="file" id="${tab.id}-gpx-files" accept=".gpx" multiple>
            <small>Upload one or more GPX files (routes and waypoints will be auto-detected)</small>
        </div>

        <div class="form-group">
            <label for="${tab.id}-photo-files">Photos <span id="${tab.id}-photos-optional">(add more photos or leave empty)</span></label>
            <div id="${tab.id}-photo-drop-zone" class="photo-drop-zone">
                <input type="file" id="${tab.id}-photo-files" accept="image/*" multiple style="display: none;">
                <p>Drag photos here or <button type="button" class="browse-btn" onclick="document.getElementById('${tab.id}-photo-files').click()">Browse Files</button></p>
            </div>
            <div id="${tab.id}-photo-preview" class="photo-grid"></div>
        </div>

        <div class="form-group" id="${tab.id}-cover-photo-group" style="display: none;">
            <label>Select Cover Photo (click on image)</label>
            <div id="${tab.id}-cover-photo-selector" class="cover-photo-grid"></div>
        </div>
    `;

    return html;
}

// Switch between create and edit mode for a tab
function switchContentMode(tabId, mode) {
    const manager = tabManagers[tabId];
    if (!manager) return;

    manager.editMode = (mode === 'edit');

    // Update button styles
    const section = document.getElementById(`admin-${tabId}-section`);
    const buttons = section.querySelectorAll('.mode-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Show/hide edit selector
    document.getElementById(`${tabId}-edit-selector`).style.display = manager.editMode ? 'block' : 'none';
    document.getElementById(`${tabId}-id`).disabled = manager.editMode;
    const optionalLabel = document.getElementById(`${tabId}-photos-optional`);
    if (optionalLabel) {
        optionalLabel.style.display = manager.editMode ? 'inline' : 'none';
    }

    if (!manager.editMode) {
        manager.resetForm();
    } else {
        // Load items list
        manager.loadItemsList();
    }
}

// Load item for editing
async function loadItemForEdit(tabId) {
    const manager = tabManagers[tabId];
    if (!manager) return;

    await manager.loadItemForEdit();
}

// Delete item
async function deleteItem(tabId) {
    const manager = tabManagers[tabId];
    if (!manager) return;

    await manager.deleteItem();
}

// Update date fields based on selected categories
function updateDateFieldsForTab(tabId) {
    const selectedCategories = Array.from(document.querySelectorAll(`input[name="${tabId}-categories"]:checked`))
        .map(cb => cb.value);

    // Categories that need date range
    const needsRange = selectedCategories.some(cat => ['camping', 'hut-trips', 'other'].includes(cat));

    document.getElementById(`${tabId}-single-date-group`).style.display = needsRange ? 'none' : 'block';
    document.getElementById(`${tabId}-date-range-group`).style.display = needsRange ? 'block' : 'none';

    document.getElementById(`${tabId}-date`).required = !needsRange;
    const startDateField = document.getElementById(`${tabId}-start-date`);
    const endDateField = document.getElementById(`${tabId}-end-date`);
    if (startDateField) startDateField.required = needsRange;
    if (endDateField) endDateField.required = needsRange;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on admin page
    if (document.getElementById('admin-sections-container')) {
        initializeDynamicAdmins();
    }
});
