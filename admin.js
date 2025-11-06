// Admin Script - Modular Tab Management System
// Manages admin interface for tabs defined in tabs-config.json

// Core System Variables
let githubToken = '';
let githubConfig = {
    owner: '',
    repo: '',
    branch: 'main'
};

// Tab management variables
let tabsConfig = null;
let editingTabIndex = -1;

// Home page management variables
let homeConfig = null;
let homePhotos = [];
let homePhotosToDelete = [];
let newHomePhotos = [];

// Initialization - Load saved GitHub credentials
window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('github-token');
    if (saved) {
        githubToken = saved;
        document.getElementById('github-token').value = saved;
        showTokenStatus('Token loaded from browser storage', 'success');
    }

    githubConfig.owner = localStorage.getItem('github-owner') || '';
    githubConfig.repo = localStorage.getItem('github-repo') || '';
});

// GitHub API Integration

// Save GitHub token
async function saveToken() {
    const token = document.getElementById('github-token').value.trim();

    if (!token) {
        showTokenStatus('Please enter a token', 'error');
        return;
    }

    try {
        const response = await fetch('https://api.github.com/user/repos', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error('Invalid token or insufficient permissions');
        }

        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        const user = await userResponse.json();

        githubToken = token;
        localStorage.setItem('github-token', token);

        const repoName = prompt('Enter your repository name (e.g., "website"):', 'website');
        if (repoName) {
            githubConfig.owner = user.login;
            githubConfig.repo = repoName;
            localStorage.setItem('github-owner', user.login);
            localStorage.setItem('github-repo', repoName);

            showTokenStatus(`✓ Connected to ${user.login}/${repoName}`, 'success');
        }

    } catch (error) {
        showTokenStatus(`Error: ${error.message}`, 'error');
        console.error('Token validation error:', error);
    }
}

function showTokenStatus(message, type) {
    const status = document.getElementById('token-status');
    status.textContent = message;
    status.className = `token-status ${type}`;
}

function loadGitHubConfig() {
    githubConfig.owner = localStorage.getItem('github-owner') || '';
    githubConfig.repo = localStorage.getItem('github-repo') || '';

    if (!githubConfig.owner || !githubConfig.repo) {
        throw new Error('GitHub repository not configured. Please save your token first.');
    }
}


// Tab Management System

// Switch between admin sections
function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(section => section.style.display = 'none');

    // Find and activate the button that was clicked
    const clickedBtn = event?.target;
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }

    if (tab === 'home') {
        document.getElementById('admin-home-section').style.display = 'block';
        loadHomeConfig();
    } else if (tab === 'tabs') {
        document.getElementById('admin-tabs-section').style.display = 'block';
        loadTabsConfig();
    } else if (tab === 'adventure') {
        document.getElementById('admin-adventure-section').style.display = 'block';
    } else {
        // Handle dynamic tab sections
        const sectionId = `admin-${tab}-section`;
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'block';
        }
    }
}

// Load tabs configuration
async function loadTabsConfig() {
    try {
        const response = await fetch('tabs-config.json');
        tabsConfig = await response.json();
        displayTabsList();
    } catch (error) {
        console.error('Error loading tabs config:', error);
        alert('Error loading tabs configuration');
    }
}

// Display list of tabs
function displayTabsList() {
    const container = document.getElementById('tabs-list');
    container.innerHTML = '';

    if (!tabsConfig || !tabsConfig.tabs || tabsConfig.tabs.length === 0) {
        container.innerHTML = '<p>No tabs configured yet.</p>';
        return;
    }

    tabsConfig.tabs.forEach((tab, index) => {
        const item = document.createElement('div');
        item.className = 'tab-item';

        const subtypesHtml = tab.subtypes && tab.subtypes.length > 0
            ? `<div class="tab-subtypes">
                ${tab.subtypes.map(st => `<span class="subtype-badge">${st.icon || ''} ${st.label}</span>`).join('')}
               </div>`
            : '<div class="tab-subtypes"><span style="color: #999;">No subtypes</span></div>';

        item.innerHTML = `
            <div class="tab-item-header">
                <div>
                    <div class="tab-item-title">${tab.label} <small style="color: #999;">(${tab.id})</small></div>
                    <small style="color: ${tab.enabled ? 'green' : 'red'};">${tab.enabled ? 'Enabled' : 'Disabled'}</small>
                </div>
                <div class="tab-item-actions">
                    <button class="edit-tab-btn" onclick="editTab(${index})">Edit</button>
                    <button class="delete-tab-btn" onclick="deleteTab(${index})">Delete</button>
                </div>
            </div>
            ${subtypesHtml}
        `;

        container.appendChild(item);
    });
}

// Edit a tab
function editTab(index) {
    editingTabIndex = index;
    const tab = tabsConfig.tabs[index];

    document.getElementById('tab-editor-title').textContent = 'Edit Tab';
    document.getElementById('editing-tab-id').value = tab.id;
    document.getElementById('tab-id').value = tab.id;
    document.getElementById('tab-id').disabled = true; // Can't change ID when editing
    document.getElementById('tab-label').value = tab.label;
    document.getElementById('tab-header-text').value = tab.headerText || '';
    document.getElementById('tab-enabled').checked = tab.enabled;

    // Clear and populate subtypes
    const container = document.getElementById('subtypes-container');
    container.innerHTML = '';

    if (tab.subtypes && tab.subtypes.length > 0) {
        tab.subtypes.forEach(subtype => {
            addSubtypeField(subtype);
        });
    }

    // Scroll to form
    document.getElementById('tab-form').scrollIntoView({ behavior: 'smooth' });
}

// Delete a tab
async function deleteTab(index) {
    const tab = tabsConfig.tabs[index];

    if (!confirm(`Are you sure you want to delete the "${tab.label}" tab? This cannot be undone.`)) {
        return;
    }

    tabsConfig.tabs.splice(index, 1);

    try {
        await saveTabsConfig();
        displayTabsList();
        alert('Tab deleted successfully!');
    } catch (error) {
        alert('Error deleting tab: ' + error.message);
    }
}

// Add a subtype field to the form
function addSubtypeField(subtype = null) {
    const container = document.getElementById('subtypes-container');

    const field = document.createElement('div');
    field.className = 'subtype-field';
    field.innerHTML = `
        <input type="text"
               class="subtype-icon"
               placeholder="Icon"
               value="${subtype?.icon || ''}"
               data-field="icon">
        <input type="text"
               class="subtype-id"
               placeholder="Subtype ID (e.g., web-apps)"
               value="${subtype?.id || ''}"
               data-field="id"
               required>
        <input type="text"
               class="subtype-label"
               placeholder="Subtype Label (e.g., Web Apps)"
               value="${subtype?.label || ''}"
               data-field="label"
               required>
        <button type="button" class="remove-subtype-btn" onclick="removeSubtypeField(this)">Remove</button>
    `;

    container.appendChild(field);
}

// Remove a subtype field
function removeSubtypeField(button) {
    button.parentElement.remove();
}

// Cancel tab editing
function cancelTabEdit() {
    editingTabIndex = -1;
    document.getElementById('tab-editor-title').textContent = 'Create New Tab';
    document.getElementById('tab-form').reset();
    document.getElementById('tab-id').disabled = false;
    document.getElementById('editing-tab-id').value = '';
    document.getElementById('tab-header-text').value = '';
    document.getElementById('subtypes-container').innerHTML = '';
}

// Handle tab form submission
document.addEventListener('DOMContentLoaded', () => {
    const tabForm = document.getElementById('tab-form');
    if (tabForm) {
        console.log('Tab form found, attaching submit handler');
        tabForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Tab form submitted');

            const tabId = document.getElementById('tab-id').value.trim();
            const tabLabel = document.getElementById('tab-label').value.trim();
            const tabHeaderText = document.getElementById('tab-header-text').value.trim();
            const tabEnabled = document.getElementById('tab-enabled').checked;

            console.log('Tab data:', { tabId, tabLabel, tabHeaderText, tabEnabled });

            // Validate tab ID format
            if (!/^[a-z0-9-]+$/.test(tabId)) {
                alert('Tab ID must contain only lowercase letters, numbers, and hyphens');
                return;
            }

            // Collect subtypes
            const subtypes = [];
            const subtypeFields = document.querySelectorAll('.subtype-field');
            subtypeFields.forEach(field => {
                const icon = field.querySelector('[data-field="icon"]').value.trim();
                const id = field.querySelector('[data-field="id"]').value.trim();
                const label = field.querySelector('[data-field="label"]').value.trim();

                if (id && label) {
                    // Validate subtype ID
                    if (!/^[a-z0-9-]+$/.test(id)) {
                        alert(`Subtype ID "${id}" must contain only lowercase letters, numbers, and hyphens`);
                        return;
                    }
                    subtypes.push({ id, label, icon });
                }
            });

            const tab = {
                id: tabId,
                label: tabLabel,
                dataFile: `${tabId}/${tabId}.json`,
                enabled: tabEnabled,
                headerText: tabHeaderText,
                subtypes: subtypes
            };

            try {
                if (editingTabIndex >= 0) {
                    // Update existing tab
                    tabsConfig.tabs[editingTabIndex] = tab;
                } else {
                    // Check if tab ID already exists
                    if (tabsConfig.tabs.some(t => t.id === tabId)) {
                        alert('A tab with this ID already exists');
                        return;
                    }
                    // Add new tab
                    tabsConfig.tabs.push(tab);
                }

                await saveTabsConfig();
                displayTabsList();
                cancelTabEdit();
                alert('Tab saved successfully!');
            } catch (error) {
                alert('Error saving tab: ' + error.message);
            }
        });
    }
});

// Save tabs config to GitHub
async function saveTabsConfig() {
    if (!githubToken) {
        throw new Error('Please save your GitHub token first');
    }

    loadGitHubConfig();
    showProgress('Saving tabs configuration...', 0);

    try {
        // Get current branch reference
        showProgress('Getting repository info...', 20);
        const refData = await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/refs/heads/${githubConfig.branch}`);
        const latestCommitSha = refData.object.sha;

        // Get the current commit
        showProgress('Reading current commit...', 40);
        const commitData = await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/commits/${latestCommitSha}`);
        const treeSha = commitData.tree.sha;

        // Create blob for tabs-config.json
        showProgress('Uploading configuration...', 60);
        const configContent = JSON.stringify(tabsConfig, null, 2);
        // Encode UTF-8 to base64 (supports emojis and special characters)
        const configBase64 = btoa(unescape(encodeURIComponent(configContent)));
        const configBlob = await createBlob(configBase64);

        // Create new tree
        showProgress('Creating file tree...', 70);
        const newTree = await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/trees`, {
            method: 'POST',
            body: JSON.stringify({
                base_tree: treeSha,
                tree: [{
                    path: 'tabs-config.json',
                    sha: configBlob.sha,
                    mode: '100644',
                    type: 'blob'
                }]
            })
        });

        // Create new commit
        showProgress('Creating commit...', 85);
        const newCommit = await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/commits`, {
            method: 'POST',
            body: JSON.stringify({
                message: 'Update tabs configuration',
                tree: newTree.sha,
                parents: [latestCommitSha]
            })
        });

        // Update branch reference
        showProgress('Pushing to GitHub...', 95);
        await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/refs/heads/${githubConfig.branch}`, {
            method: 'PATCH',
            body: JSON.stringify({
                sha: newCommit.sha
            })
        });

        showProgress('Complete!', 100);
        setTimeout(() => hideProgress(), 1000);

    } catch (error) {
        hideProgress();
        throw error;
    }
}

// Home Page Management

// Load home page configuration
async function loadHomeConfig() {
    try {
        const response = await fetch('home-config.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        homeConfig = await response.json();
        populateHomeForm();
    } catch (error) {
        console.error('Error loading home config:', error);
        alert('Error loading home page configuration: ' + error.message);
    }
}

// Populate home page form with current values
function populateHomeForm() {
    if (!homeConfig) return;

    document.getElementById('home-tagline').value = homeConfig.tagline || '';
    document.getElementById('home-about').value = homeConfig.about || homeConfig.aboutParagraph1 || '';

    document.getElementById('home-current').value = homeConfig.professionalBackground?.current || '';
    document.getElementById('home-education').value = homeConfig.professionalBackground?.education || '';
    document.getElementById('home-specialties').value = homeConfig.professionalBackground?.specialties || '';
    document.getElementById('home-technologies').value = homeConfig.professionalBackground?.technologies || '';

    document.getElementById('home-email').value = homeConfig.contact?.email || '';
    document.getElementById('home-phone').value = homeConfig.contact?.phone || '';
    document.getElementById('home-location').value = homeConfig.contact?.location || '';

    // Initialize photo collection
    homePhotos = [...(homeConfig.allProfilePhotos || homeConfig.profilePhotos || [])];
    homePhotosToDelete = [];
    newHomePhotos = [];
    displayHomePhotoGrid();
}

// Display home page photo grid
function displayHomePhotoGrid() {
    const grid = document.getElementById('home-photo-grid');
    if (!grid) {
        console.error('home-photo-grid element not found');
        return;
    }

    grid.innerHTML = '';

    const allPhotos = [...homePhotos, ...newHomePhotos];
    const selectedPhotos = homeConfig?.selectedProfilePhotos || homeConfig?.profilePhotos || [];

    console.log('Displaying home photo grid:', {
        totalPhotos: allPhotos.length,
        existingPhotos: homePhotos.length,
        newPhotos: newHomePhotos.length,
        selectedCount: selectedPhotos.length,
        selectedPhotos: selectedPhotos
    });

    allPhotos.forEach((photo, index) => {
        const isExisting = index < homePhotos.length;
        const photoPath = isExisting ? photo : URL.createObjectURL(photo);
        // For existing photos, use the actual path. For new photos, use the stored path from homePhotos
        const actualPath = isExisting ? photo : photo.tempPath || `photos/profile-${Date.now()}-${index}.jpg`;

        // Store temp path on new photo objects for consistency
        if (!isExisting && !photo.tempPath) {
            photo.tempPath = actualPath;
        }

        const isSelected = selectedPhotos.includes(actualPath);

        const photoDiv = document.createElement('div');
        photoDiv.className = 'photo-item';
        photoDiv.dataset.photoPath = actualPath; // Store for easy access
        photoDiv.dataset.photoIndex = index;
        photoDiv.dataset.isExisting = isExisting;
        if (isSelected) photoDiv.classList.add('selected');

        // Create img element
        const img = document.createElement('img');
        img.src = photoPath;
        img.alt = `Profile photo ${index + 1}`;
        photoDiv.appendChild(img);

        // Create delete button (red X in top right)
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'remove-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.onclick = function(e) {
            e.stopPropagation();
            window.deleteHomePhoto(index, isExisting);
        };
        photoDiv.appendChild(deleteBtn);

        // Create selected badge (like COVER badge)
        if (isSelected) {
            const badge = document.createElement('div');
            badge.className = 'selected-badge';
            badge.innerHTML = '✓ SELECTED';
            photoDiv.appendChild(badge);
        }

        // Make entire photo clickable to select/deselect
        photoDiv.onclick = function(e) {
            if (!e.target.classList.contains('remove-btn')) {
                window.toggleHomePhotoSelection(index, isExisting);
            }
        };

        console.log(`Photo ${index} created - selected: ${isSelected}`);

        grid.appendChild(photoDiv);
    });

    if (allPhotos.length === 0) {
        grid.innerHTML = '<p style="color: #999;">No photos uploaded yet. Upload photos above to get started.</p>';
    } else {
        console.log('Photo grid populated with', allPhotos.length, 'photos');
    }
}

// Toggle home photo selection
window.toggleHomePhotoSelection = function(index, isExisting) {
    console.log('Toggle photo selection:', { index, isExisting });

    const allPhotos = [...homePhotos, ...newHomePhotos];
    let selectedPhotos = [...(homeConfig?.selectedProfilePhotos || homeConfig?.profilePhotos || [])];

    // Get the correct photo path - for new photos, use the tempPath stored on the object
    let photoPath;
    if (isExisting) {
        photoPath = homePhotos[index];
    } else {
        const newIndex = index - homePhotos.length;
        const photo = newHomePhotos[newIndex];
        photoPath = photo.tempPath || `photos/profile-${Date.now()}-${newIndex}.jpg`;
        if (!photo.tempPath) {
            photo.tempPath = photoPath;
        }
    }

    const isSelected = selectedPhotos.includes(photoPath);

    console.log('Photo selection state:', { photoPath, isSelected, currentlySelected: selectedPhotos });

    if (isSelected) {
        // Deselect
        selectedPhotos = selectedPhotos.filter(p => p !== photoPath);
        console.log('Deselected photo:', photoPath);
    } else {
        // Select (max 2)
        if (selectedPhotos.length >= 2) {
            alert('You can only select 2 profile photos. Deselect one of the currently selected photos first by clicking it.');
            return;
        }
        selectedPhotos.push(photoPath);
        console.log('Selected photo:', photoPath);
    }

    // Update config
    if (!homeConfig.selectedProfilePhotos) {
        homeConfig.selectedProfilePhotos = [];
    }
    homeConfig.selectedProfilePhotos = selectedPhotos;

    console.log('New selection:', selectedPhotos);
    displayHomePhotoGrid();
}

// Delete home photo
window.deleteHomePhoto = function(index, isExisting) {
    console.log('Delete photo clicked:', { index, isExisting });

    if (!confirm('Are you sure you want to delete this photo from your collection? It will be removed when you save.')) {
        console.log('Delete cancelled by user');
        return;
    }

    if (isExisting) {
        const photoPath = homePhotos[index];
        console.log('Deleting existing photo:', photoPath);
        homePhotosToDelete.push(photoPath);
        homePhotos.splice(index, 1);

        // Remove from selected if it was selected
        if (homeConfig.selectedProfilePhotos) {
            homeConfig.selectedProfilePhotos = homeConfig.selectedProfilePhotos.filter(p => p !== photoPath);
            console.log('Removed from selected photos');
        }
    } else {
        const newIndex = index - homePhotos.length;
        console.log('Deleting new photo at index:', newIndex);
        newHomePhotos.splice(newIndex, 1);
    }

    console.log('Photos remaining:', { existing: homePhotos.length, new: newHomePhotos.length });
    displayHomePhotoGrid();
}

// Handle photo file selection
document.addEventListener('DOMContentLoaded', () => {
    const photoInput = document.getElementById('home-photo-files');
    if (photoInput) {
        photoInput.addEventListener('change', function() {
            const files = Array.from(this.files);
            newHomePhotos.push(...files);
            displayHomePhotoGrid();
            this.value = ''; // Reset input
        });
    }

    // Setup drag-and-drop for home photos
    const dropZone = document.getElementById('home-photo-drop-zone');
    if (dropZone) {
        dropZone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        dropZone.addEventListener('dragleave', (e) => {
            // Only remove highlight if leaving the drop zone entirely
            if (e.target === dropZone) {
                dropZone.classList.remove('drag-over');
            }
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');

            const files = Array.from(e.dataTransfer.files).filter(file =>
                file.type.startsWith('image/')
            );

            if (files.length > 0) {
                newHomePhotos.push(...files);
                displayHomePhotoGrid();
            }
        });

        // Make the entire drop zone clickable to open file picker
        dropZone.addEventListener('click', (e) => {
            // Don't trigger if clicking the button
            if (!e.target.classList.contains('browse-btn')) {
                document.getElementById('home-photo-files').click();
            }
        });
    }
});

// Handle home form submission
document.addEventListener('DOMContentLoaded', () => {
    const homeForm = document.getElementById('home-form');
    if (homeForm) {
        console.log('Home form found, attaching submit handler');
        homeForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Home form submitted');

            const updatedConfig = {
                allProfilePhotos: homePhotos, // All photos in collection
                selectedProfilePhotos: homeConfig?.selectedProfilePhotos || [],
                tagline: document.getElementById('home-tagline').value.trim(),
                about: document.getElementById('home-about').value.trim(),
                professionalBackground: {
                    current: document.getElementById('home-current').value.trim(),
                    education: document.getElementById('home-education').value.trim(),
                    specialties: document.getElementById('home-specialties').value.trim(),
                    technologies: document.getElementById('home-technologies').value.trim()
                },
                contact: {
                    email: document.getElementById('home-email').value.trim(),
                    phone: document.getElementById('home-phone').value.trim(),
                    location: document.getElementById('home-location').value.trim()
                }
            };

            try {
                await saveHomeConfig(updatedConfig, newHomePhotos, homePhotosToDelete);
                alert('Home page updated successfully!');
                // Reload to show new photos
                await loadHomeConfig();
            } catch (error) {
                alert('Error saving home page: ' + error.message);
            }
        });
    }
});

// Save home config to GitHub
async function saveHomeConfig(config, newPhotos = [], photosToDelete = []) {
    if (!githubToken) {
        throw new Error('Please save your GitHub token first');
    }

    loadGitHubConfig();
    showProgress('Saving home page...', 0);

    try {
        // Get current branch reference
        showProgress('Getting repository info...', 10);
        const refData = await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/refs/heads/${githubConfig.branch}`);
        const latestCommitSha = refData.object.sha;

        // Get the current commit
        showProgress('Reading current commit...', 20);
        const commitData = await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/commits/${latestCommitSha}`);
        const treeSha = commitData.tree.sha;

        const treeItems = [];

        // Upload new photos if provided
        if (newPhotos.length > 0) {
            showProgress('Uploading new photos...', 30);

            for (let i = 0; i < newPhotos.length; i++) {
                const photo = newPhotos[i];
                const timestamp = Date.now();
                const photoPath = `photos/profile-${timestamp}-${i}.jpg`;

                // Read photo as base64
                const photoBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result.split(',')[1]);
                    reader.readAsDataURL(photo);
                });

                // Create blob for photo
                const photoBlob = await createBlob(photoBase64);

                treeItems.push({
                    path: photoPath,
                    sha: photoBlob.sha,
                    mode: '100644',
                    type: 'blob'
                });

                // Add new photo path to config
                config.allProfilePhotos.push(photoPath);
            }
        }

        // Handle deleted photos (mark them as deleted in tree)
        if (photosToDelete.length > 0) {
            showProgress('Removing deleted photos...', 50);
            photosToDelete.forEach(photoPath => {
                treeItems.push({
                    path: photoPath,
                    sha: null, // null sha means delete
                    mode: '100644',
                    type: 'blob'
                });

                // Remove from config
                config.allProfilePhotos = config.allProfilePhotos.filter(p => p !== photoPath);
                if (config.selectedProfilePhotos) {
                    config.selectedProfilePhotos = config.selectedProfilePhotos.filter(p => p !== photoPath);
                }
            });
        }

        // Create blob for home-config.json
        showProgress('Uploading configuration...', 60);
        const configContent = JSON.stringify(config, null, 2);
        const configBase64 = btoa(unescape(encodeURIComponent(configContent)));
        const configBlob = await createBlob(configBase64);

        treeItems.push({
            path: 'home-config.json',
            sha: configBlob.sha,
            mode: '100644',
            type: 'blob'
        });

        // Create new tree
        showProgress('Creating file tree...', 70);
        const newTree = await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/trees`, {
            method: 'POST',
            body: JSON.stringify({
                base_tree: treeSha,
                tree: treeItems
            })
        });

        // Create new commit
        showProgress('Creating commit...', 85);
        const newCommit = await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/commits`, {
            method: 'POST',
            body: JSON.stringify({
                message: 'Update home page configuration and photos',
                tree: newTree.sha,
                parents: [latestCommitSha]
            })
        });

        // Update branch reference
        showProgress('Pushing to GitHub...', 95);
        await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/refs/heads/${githubConfig.branch}`, {
            method: 'PATCH',
            body: JSON.stringify({
                sha: newCommit.sha
            })
        });

        showProgress('Complete!', 100);
        homeConfig = config;
        setTimeout(() => hideProgress(), 1000);

    } catch (error) {
        hideProgress();
        throw error;
    }
}
