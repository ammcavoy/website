// Admin script with GitHub API integration and edit functionality
let selectedPhotos = [];
let existingPhotos = []; // For edit mode
let coverPhotoIndex = 0;
let githubToken = '';
let githubConfig = {
    owner: '',
    repo: '',
    branch: 'main'
};
let editMode = false;
let currentAdventure = null;
let allAdventures = [];
let existingGpxFiles = [];
let newGpxFiles = [];
let gpxFilesToRemove = [];

// Tab management variables
let tabsConfig = null;
let editingTabIndex = -1;

// Load saved token and adventures on page load
window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('github-token');
    if (saved) {
        githubToken = saved;
        document.getElementById('github-token').value = saved;
        showTokenStatus('Token loaded from browser storage', 'success');
    }

    githubConfig.owner = localStorage.getItem('github-owner') || '';
    githubConfig.repo = localStorage.getItem('github-repo') || '';

    if (githubConfig.owner && githubConfig.repo) {
        loadAdventuresList();
    }

    // Load category options from tabs config
    loadAdventureCategoryOptions();
});

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
            loadAdventuresList();
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

// Switch between create and edit mode
function switchMode(mode) {
    editMode = (mode === 'edit');

    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('edit-adventure-selector').style.display = editMode ? 'block' : 'none';
    document.getElementById('adventure-id').disabled = editMode;
    document.getElementById('gpx-optional').style.display = editMode ? 'inline' : 'none';
    document.getElementById('photos-optional').style.display = editMode ? 'inline' : 'none';

    if (!editMode) {
        resetForm();
    }
}

// Load list of existing adventures
async function loadAdventuresList() {
    if (!githubToken) return;

    try {
        const adventuresFile = await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/contents/adventures/adventures.json`);
        const content = atob(adventuresFile.content);
        const data = JSON.parse(content);
        allAdventures = data.adventures || [];

        const select = document.getElementById('existing-adventures');
        select.innerHTML = '<option value="">-- Choose an adventure --</option>';

        allAdventures.forEach((adv, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = adv.title;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading adventures:', error);
    }
}

// Load selected adventure for editing
async function loadAdventureForEdit() {
    const index = document.getElementById('existing-adventures').value;
    if (index === '') return;

    currentAdventure = allAdventures[index];

    // Populate form fields
    document.getElementById('adventure-id').value = currentAdventure.id;
    document.getElementById('adventure-title').value = currentAdventure.title;
    document.getElementById('adventure-description').value = currentAdventure.description;

    // Handle categories (can be single value or array)
    const categories = Array.isArray(currentAdventure.categories)
        ? currentAdventure.categories
        : (currentAdventure.category ? [currentAdventure.category] : []);

    // Uncheck all checkboxes first
    document.querySelectorAll('input[name="categories"]').forEach(cb => cb.checked = false);

    // Check the appropriate checkboxes
    categories.forEach(cat => {
        const checkbox = document.getElementById(`category-${cat}`);
        if (checkbox) checkbox.checked = true;
    });

    // Handle dates
    updateDateFields();
    if (currentAdventure.startDate && currentAdventure.endDate) {
        document.getElementById('adventure-start-date').value = currentAdventure.startDate;
        document.getElementById('adventure-end-date').value = currentAdventure.endDate;
    } else if (currentAdventure.date) {
        document.getElementById('adventure-date').value = currentAdventure.date;
    }

    // Load existing photos
    existingPhotos = currentAdventure.photos || [];
    const coverPhoto = currentAdventure.coverPhoto;
    coverPhotoIndex = existingPhotos.indexOf(coverPhoto);
    if (coverPhotoIndex === -1) coverPhotoIndex = 0;

    // Load existing GPX files
    existingGpxFiles = [];
    newGpxFiles = [];
    gpxFilesToRemove = [];

    if (currentAdventure.gpxFile) {
        existingGpxFiles.push({
            url: currentAdventure.gpxFile,
            label: 'Route',
            type: 'route'
        });
    }

    if (currentAdventure.waypointsFile) {
        existingGpxFiles.push({
            url: currentAdventure.waypointsFile,
            label: 'Waypoints',
            type: 'waypoints'
        });
    }

    if (currentAdventure.gpxFiles && Array.isArray(currentAdventure.gpxFiles)) {
        existingGpxFiles = currentAdventure.gpxFiles.map(gpx => ({
            url: gpx.url || gpx.file,
            label: gpx.label || 'GPS Data',
            type: gpx.type || 'route'
        }));
    }

    displayGpxFiles();
    displayPhotoGrid();
}

// Update date fields based on selected categories
function updateDateFields() {
    const selectedCategories = Array.from(document.querySelectorAll('input[name="categories"]:checked'))
        .map(cb => cb.value);

    // Use date range if any selected category needs it
    const needsRange = selectedCategories.some(cat => ['camping', 'hut-trips', 'other'].includes(cat));

    document.getElementById('single-date-group').style.display = needsRange ? 'none' : 'block';
    document.getElementById('date-range-group').style.display = needsRange ? 'block' : 'none';

    document.getElementById('adventure-date').required = !needsRange;
    document.getElementById('adventure-start-date').required = needsRange;
    document.getElementById('adventure-end-date').required = needsRange;
}

// Analyze GPX file to determine type
async function analyzeGpxFile(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(content, 'text/xml');

            // Check for waypoints
            const waypoints = xmlDoc.getElementsByTagName('wpt');
            const tracks = xmlDoc.getElementsByTagName('trk');
            const routes = xmlDoc.getElementsByTagName('rte');

            // Determine type based on content
            let type = 'route';
            let label = file.name.replace('.gpx', '');

            if (waypoints.length > 0 && tracks.length === 0 && routes.length === 0) {
                type = 'waypoints';
                label = label.includes('waypoint') || label.includes('camp') ? label : 'Waypoints';
            } else if (tracks.length > 0 || routes.length > 0) {
                type = 'route';
                label = label.includes('route') || label.includes('track') ? label : 'Route';
            }

            resolve({ type, label });
        };
        reader.readAsText(file);
    });
}

// Handle GPX file selection
document.getElementById('gpx-files').addEventListener('change', async function(e) {
    const files = Array.from(e.target.files);

    for (const file of files) {
        const analysis = await analyzeGpxFile(file);
        newGpxFiles.push({
            file: file,
            type: analysis.type,
            label: analysis.label
        });
    }

    displayGpxFiles();
});

// Display GPX files (both existing and new)
function displayGpxFiles() {
    const container = document.getElementById('gpx-files-container');
    const listDiv = document.getElementById('existing-gpx-list');

    const allGpxFiles = [
        ...existingGpxFiles.filter(gpx => !gpxFilesToRemove.includes(gpx.url)),
        ...newGpxFiles
    ];

    if (allGpxFiles.length === 0) {
        listDiv.style.display = 'none';
        return;
    }

    listDiv.style.display = 'block';
    container.innerHTML = '';

    // Display existing files
    existingGpxFiles.forEach((gpx, index) => {
        if (gpxFilesToRemove.includes(gpx.url)) return;

        const item = document.createElement('div');
        item.className = 'gpx-file-item';

        const fileName = gpx.url.split('/').pop();
        const icon = gpx.type === 'waypoints' ? '⛺' : '📍';
        const typeLabel = gpx.type === 'waypoints' ? 'Waypoints' : 'Route';

        item.innerHTML = `
            <div class="gpx-file-name">
                <span class="gpx-file-icon">${icon}</span>
                <span><strong>${typeLabel}:</strong> ${fileName}</span>
            </div>
            <button type="button" class="gpx-remove-btn" onclick="removeExistingGpx('${gpx.url}')">Remove</button>
        `;

        container.appendChild(item);
    });

    // Display new files
    newGpxFiles.forEach((gpx, index) => {
        const item = document.createElement('div');
        item.className = 'gpx-file-item';

        const icon = gpx.type === 'waypoints' ? '⛺' : '📍';
        const typeLabel = gpx.type === 'waypoints' ? 'Waypoints' : 'Route';

        item.innerHTML = `
            <div class="gpx-file-name">
                <span class="gpx-file-icon">${icon}</span>
                <span><strong>${typeLabel}:</strong> ${gpx.file.name} <em style="color: green;">(new)</em></span>
            </div>
            <button type="button" class="gpx-remove-btn" onclick="removeNewGpx(${index})">Remove</button>
        `;

        container.appendChild(item);
    });
}

// Remove existing GPX file
function removeExistingGpx(url) {
    gpxFilesToRemove.push(url);
    displayGpxFiles();
}

// Remove new GPX file
function removeNewGpx(index) {
    newGpxFiles.splice(index, 1);
    displayGpxFiles();
}

// Setup date range auto-fill
document.getElementById('adventure-start-date').addEventListener('change', function() {
    const startDate = this.value;
    const endDateField = document.getElementById('adventure-end-date');

    if (startDate && !endDateField.value) {
        // Set end date to start date and set min date
        endDateField.value = startDate;
        endDateField.min = startDate;

        // Automatically focus the end date field
        setTimeout(() => endDateField.focus(), 100);
    } else if (startDate) {
        // Just update the min date
        endDateField.min = startDate;
    }
});

// Handle photo file selection
document.getElementById('photo-files').addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    selectedPhotos = [...selectedPhotos, ...files];
    displayPhotoGrid();
});

// Setup drag-and-drop for adventure photos
document.addEventListener('DOMContentLoaded', () => {
    const adventureDropZone = document.getElementById('adventure-photo-drop-zone');
    if (adventureDropZone) {
        adventureDropZone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            adventureDropZone.classList.add('drag-over');
        });

        adventureDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        adventureDropZone.addEventListener('dragleave', (e) => {
            if (e.target === adventureDropZone) {
                adventureDropZone.classList.remove('drag-over');
            }
        });

        adventureDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            adventureDropZone.classList.remove('drag-over');

            const files = Array.from(e.dataTransfer.files).filter(file =>
                file.type.startsWith('image/')
            );

            if (files.length > 0) {
                selectedPhotos = [...selectedPhotos, ...files];
                displayPhotoGrid();
            }
        });

        // Make the entire drop zone clickable
        adventureDropZone.addEventListener('click', (e) => {
            if (!e.target.classList.contains('browse-btn')) {
                document.getElementById('photo-files').click();
            }
        });
    }
});

// Display photo grid with click-to-select cover
function displayPhotoGrid() {
    const preview = document.getElementById('photo-preview');
    const coverGroup = document.getElementById('cover-photo-group');

    preview.innerHTML = '';

    const allPhotos = [...existingPhotos, ...selectedPhotos];

    if (allPhotos.length === 0) {
        coverGroup.style.display = 'none';
        return;
    }

    coverGroup.style.display = 'block';

    allPhotos.forEach((photo, index) => {
        const item = document.createElement('div');
        item.className = 'photo-item';
        if (index === coverPhotoIndex) {
            item.classList.add('cover');
        }

        const isExisting = index < existingPhotos.length;

        if (isExisting) {
            // Existing photo from server
            item.innerHTML = `
                <img src="${photo}" alt="Photo ${index + 1}">
                <button type="button" class="remove-btn" onclick="removePhoto(${index})">&times;</button>
                ${index === coverPhotoIndex ? '<div class="cover-badge">COVER</div>' : ''}
            `;
        } else {
            // New photo file
            const fileIndex = index - existingPhotos.length;
            const reader = new FileReader();
            reader.onload = function(e) {
                item.innerHTML = `
                    <img src="${e.target.result}" alt="Photo ${index + 1}">
                    <button type="button" class="remove-btn" onclick="removePhoto(${index})">&times;</button>
                    ${index === coverPhotoIndex ? '<div class="cover-badge">COVER</div>' : ''}
                `;
            };
            reader.readAsDataURL(selectedPhotos[fileIndex]);
        }

        item.onclick = (e) => {
            if (!e.target.classList.contains('remove-btn')) {
                setCoverPhoto(index);
            }
        };

        preview.appendChild(item);
    });
}

// Set cover photo
function setCoverPhoto(index) {
    coverPhotoIndex = index;
    displayPhotoGrid();
}

// Remove photo from selection
function removePhoto(index) {
    const isExisting = index < existingPhotos.length;

    if (isExisting) {
        existingPhotos.splice(index, 1);
    } else {
        const fileIndex = index - existingPhotos.length;
        selectedPhotos.splice(fileIndex, 1);
    }

    // Adjust cover photo index if necessary
    if (coverPhotoIndex >= (existingPhotos.length + selectedPhotos.length)) {
        coverPhotoIndex = Math.max(0, existingPhotos.length + selectedPhotos.length - 1);
    }

    displayPhotoGrid();
}

// Reset form
function resetForm() {
    document.getElementById('adventure-form').reset();
    selectedPhotos = [];
    existingPhotos = [];
    existingGpxFiles = [];
    newGpxFiles = [];
    gpxFilesToRemove = [];
    coverPhotoIndex = 0;
    currentAdventure = null;
    displayPhotoGrid();
    displayGpxFiles();
}

// Handle form submission
document.getElementById('adventure-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    if (!githubToken) {
        alert('Please save your GitHub token first');
        return;
    }

    const id = document.getElementById('adventure-id').value.trim();
    const title = document.getElementById('adventure-title').value.trim();
    const description = document.getElementById('adventure-description').value.trim();

    // Validate adventure ID format
    if (!/^[a-z0-9-]+$/.test(id)) {
        alert('Adventure ID must contain only lowercase letters, numbers, and hyphens');
        return;
    }

    // Get selected categories
    const categories = Array.from(document.querySelectorAll('input[name="categories"]:checked'))
        .map(cb => cb.value);

    if (categories.length === 0) {
        alert('Please select at least one category');
        return;
    }

    // Get dates
    let dateData = {};
    const needsRange = categories.some(cat => ['camping', 'hut-trips', 'other'].includes(cat));
    if (needsRange) {
        dateData.startDate = document.getElementById('adventure-start-date').value;
        dateData.endDate = document.getElementById('adventure-end-date').value;
    } else {
        dateData.date = document.getElementById('adventure-date').value;
    }

    const allPhotos = [...existingPhotos, ...selectedPhotos];

    if (allPhotos.length === 0 && !editMode) {
        alert('Please select at least one photo');
        return;
    }

    // GPX files are now optional
    const remainingExisting = existingGpxFiles.filter(gpx => !gpxFilesToRemove.includes(gpx.url));
    const totalGpxFiles = remainingExisting.length + newGpxFiles.length;

    // Build adventure object
    const adventure = {
        id: id,
        title: title,
        categories: categories,
        ...dateData,
        description: description,
        coverPhoto: null, // Will be set after determining photo paths
        gpxFiles: [], // Will be populated during upload
        photos: []
    };

    try {
        await uploadAdventureToGitHub(adventure, newGpxFiles, selectedPhotos, existingPhotos, remainingExisting);
    } catch (error) {
        hideProgress();
        alert(`Upload failed: ${error.message}`);
        console.error('Upload error:', error);
    }
});

// Upload adventure to GitHub (handles both create and edit)
async function uploadAdventureToGitHub(adventure, newGpxFilesList, newPhotos, existingPhotos, remainingGpxFiles) {
    try {
        loadGitHubConfig();
        showProgress('Preparing upload...', 0);

        // Step 1: Get current branch reference
        showProgress('Getting repository info...', 10);
        const refData = await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/refs/heads/${githubConfig.branch}`);
        const latestCommitSha = refData.object.sha;

        // Step 2: Get the current commit
        showProgress('Reading current commit...', 20);
        const commitData = await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/commits/${latestCommitSha}`);
        const treeSha = commitData.tree.sha;

        // Step 3: Read current adventures.json
        showProgress('Reading adventures.json...', 30);
        let adventures = [];
        try {
            const adventuresFile = await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/contents/adventures/adventures.json`);
            const content = atob(adventuresFile.content);
            const data = JSON.parse(content);
            adventures = data.adventures || [];
        } catch (error) {
            console.log('adventures.json not found or empty, starting fresh');
        }

        // Step 4: Create blobs for all files
        const blobs = [];
        const gpxFilesArray = [];

        // Upload new GPX files
        for (let i = 0; i < newGpxFilesList.length; i++) {
            const gpxData = newGpxFilesList[i];
            showProgress(`Uploading GPX file ${i + 1}/${newGpxFilesList.length}...`, 35 + (i / newGpxFilesList.length) * 10);

            const fileName = `${gpxData.type}-${Date.now()}-${i}.gpx`;
            const gpxPath = `adventures/${adventure.id}/${fileName}`;

            const gpxContent = await readFileAsBase64(gpxData.file);
            const gpxBlob = await createBlob(gpxContent);
            blobs.push({
                path: gpxPath,
                sha: gpxBlob.sha,
                mode: '100644',
                type: 'blob'
            });

            gpxFilesArray.push({
                url: gpxPath,
                label: gpxData.label,
                type: gpxData.type
            });
        }

        // Add remaining existing GPX files
        remainingGpxFiles.forEach(gpx => {
            gpxFilesArray.push({
                url: gpx.url,
                label: gpx.label,
                type: gpx.type
            });
        });

        adventure.gpxFiles = gpxFilesArray;

        let photoNumber = 1;

        // Build photos array and determine cover photo
        const finalPhotos = [];
        let coverPhotoPath = '';

        // Upload new photos
        for (let i = 0; i < newPhotos.length; i++) {
            const progress = 45 + (i / (newPhotos.length + existingPhotos.length)) * 35;
            showProgress(`Uploading photo ${i + 1}/${newPhotos.length + existingPhotos.length}...`, progress);

            const photo = newPhotos[i];
            const extension = photo.name.split('.').pop().toLowerCase();
            const globalIndex = existingPhotos.length + i;

            let filename;
            if (globalIndex === coverPhotoIndex) {
                filename = `cover.${extension}`;
            } else {
                filename = `photo-${photoNumber}.${extension}`;
                photoNumber++;
            }

            const photoPath = `adventures/${adventure.id}/${filename}`;
            const photoContent = await readFileAsBase64(photo);
            const photoBlob = await createBlob(photoContent);
            blobs.push({
                path: photoPath,
                sha: photoBlob.sha,
                mode: '100644',
                type: 'blob'
            });

            finalPhotos.push(photoPath);
            if (globalIndex === coverPhotoIndex) {
                coverPhotoPath = photoPath;
            }
        }

        // Add existing photos to final list
        existingPhotos.forEach((photoPath, i) => {
            if (i === coverPhotoIndex && !coverPhotoPath) {
                coverPhotoPath = photoPath;
            }
            if (!finalPhotos.includes(photoPath)) {
                finalPhotos.push(photoPath);
            }
        });

        // Reorder to put cover photo first
        if (coverPhotoPath) {
            const filtered = finalPhotos.filter(p => p !== coverPhotoPath);
            finalPhotos.splice(0, finalPhotos.length, coverPhotoPath, ...filtered);
        }

        adventure.coverPhoto = coverPhotoPath || finalPhotos[0];
        adventure.photos = finalPhotos;

        // Update or add adventure to list
        showProgress('Updating adventure list...', 82);
        const existingIndex = adventures.findIndex(a => a.id === adventure.id);
        if (existingIndex >= 0) {
            adventures[existingIndex] = adventure;
        } else {
            adventures.push(adventure);
        }

        const updatedAdventuresJson = JSON.stringify({ adventures }, null, 2);

        // Upload updated adventures.json
        const jsonBlob = await createBlob(btoa(updatedAdventuresJson));
        blobs.push({
            path: 'adventures/adventures.json',
            sha: jsonBlob.sha,
            mode: '100644',
            type: 'blob'
        });

        // Step 5: Create new tree
        showProgress('Creating file tree...', 85);
        const newTree = await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/trees`, {
            method: 'POST',
            body: JSON.stringify({
                base_tree: treeSha,
                tree: blobs
            })
        });

        // Step 6: Create new commit
        showProgress('Creating commit...', 90);
        const commitMessage = editMode ? `Update adventure: ${adventure.title}` : `Add adventure: ${adventure.title}`;
        const newCommit = await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/commits`, {
            method: 'POST',
            body: JSON.stringify({
                message: commitMessage,
                tree: newTree.sha,
                parents: [latestCommitSha]
            })
        });

        // Step 7: Update branch reference
        showProgress('Pushing to GitHub...', 95);
        await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/refs/heads/${githubConfig.branch}`, {
            method: 'PATCH',
            body: JSON.stringify({
                sha: newCommit.sha
            })
        });

        // Success!
        showProgress('Upload complete!', 100);
        setTimeout(() => {
            hideProgress();
            showSuccess(adventure, newCommit.sha);
        }, 1000);

    } catch (error) {
        console.error('GitHub upload error:', error);
        throw error;
    }
}

// GitHub API helper
async function githubAPI(endpoint, options = {}) {
    const url = `https://api.github.com${endpoint}`;
    const headers = {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    return await response.json();
}

// Create blob on GitHub
async function createBlob(content) {
    return await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({
            content: content,
            encoding: 'base64'
        })
    });
}

// Read file as base64
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Show progress overlay
function showProgress(message, percent) {
    const overlay = document.getElementById('progress-overlay');
    const fill = document.getElementById('progress-bar-fill');
    const msg = document.getElementById('progress-message');

    overlay.classList.add('active');
    fill.style.width = `${percent}%`;
    msg.textContent = message;
}

// Hide progress overlay
function hideProgress() {
    const overlay = document.getElementById('progress-overlay');
    overlay.classList.remove('active');
}

// Show success message
function showSuccess(adventure, commitSha) {
    const outputSection = document.getElementById('output-section');
    const jsonOutput = document.getElementById('json-output');
    const githubLink = document.getElementById('github-link');

    jsonOutput.textContent = JSON.stringify(adventure, null, 2);

    const repoUrl = `https://github.com/${githubConfig.owner}/${githubConfig.repo}`;
    githubLink.innerHTML = `
        <a href="${repoUrl}/commit/${commitSha}" target="_blank">View commit on GitHub</a><br>
        <a href="${repoUrl}/tree/${githubConfig.branch}/adventures/${adventure.id}" target="_blank">View adventure files</a>
    `;

    outputSection.classList.add('active');
    outputSection.scrollIntoView({ behavior: 'smooth' });

    // Reset form
    resetForm();

    // Reload adventures list
    loadAdventuresList();
}

// Load adventure category options from tabs config
async function loadAdventureCategoryOptions() {
    try {
        const response = await fetch('tabs-config.json');
        const config = await response.json();

        const adventuresTab = config.tabs.find(tab => tab.id === 'adventures');
        if (!adventuresTab || !adventuresTab.subtypes) {
            return;
        }

        const container = document.getElementById('adventure-categories');
        if (!container) return;

        // Clear existing checkboxes
        container.innerHTML = '';

        // Add checkboxes from config
        adventuresTab.subtypes.forEach(subtype => {
            const item = document.createElement('div');
            item.className = 'category-checkbox-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `category-${subtype.id}`;
            checkbox.name = 'categories';
            checkbox.value = subtype.id;
            checkbox.addEventListener('change', updateDateFields);

            const label = document.createElement('label');
            label.htmlFor = `category-${subtype.id}`;
            label.textContent = `${subtype.icon || ''} ${subtype.label}`.trim();

            item.appendChild(checkbox);
            item.appendChild(label);
            container.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading category options:', error);
        // Fallback to hardcoded categories if config fails to load
    }
}

// ===== TAB MANAGEMENT FUNCTIONS =====

// Switch between admin sections
function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(section => section.style.display = 'none');

    if (tab === 'home') {
        document.querySelector('.admin-tab-btn:nth-child(1)').classList.add('active');
        document.getElementById('admin-home-section').style.display = 'block';
        loadHomeConfig();
    } else if (tab === 'tabs') {
        document.querySelector('.admin-tab-btn:nth-child(2)').classList.add('active');
        document.getElementById('admin-tabs-section').style.display = 'block';
        loadTabsConfig();
    } else if (tab === 'adventure') {
        document.querySelector('.admin-tab-btn:nth-child(3)').classList.add('active');
        document.getElementById('admin-adventure-section').style.display = 'block';
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
        tabForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const tabId = document.getElementById('tab-id').value.trim();
            const tabLabel = document.getElementById('tab-label').value.trim();
            const tabHeaderText = document.getElementById('tab-header-text').value.trim();
            const tabEnabled = document.getElementById('tab-enabled').checked;

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

// ===== HOME PAGE MANAGEMENT FUNCTIONS =====

let homeConfig = null;
let homePhotos = [];
let homePhotosToDelete = [];
let newHomePhotos = [];

// Load home page configuration
async function loadHomeConfig() {
    try {
        const response = await fetch('home-config.json');
        homeConfig = await response.json();
        populateHomeForm();
    } catch (error) {
        console.error('Error loading home config:', error);
        alert('Error loading home page configuration');
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
    grid.innerHTML = '';

    const allPhotos = [...homePhotos, ...newHomePhotos];
    const selectedPhotos = homeConfig?.selectedProfilePhotos || homeConfig?.profilePhotos || [];

    allPhotos.forEach((photo, index) => {
        const isExisting = index < homePhotos.length;
        const photoPath = isExisting ? photo : URL.createObjectURL(photo);
        const actualPath = isExisting ? photo : `photos/profile-${Date.now()}-${index}.jpg`;
        const isSelected = selectedPhotos.includes(isExisting ? photo : actualPath);

        const photoDiv = document.createElement('div');
        photoDiv.className = 'photo-item';
        if (isSelected) photoDiv.classList.add('selected');

        photoDiv.innerHTML = `
            <img src="${photoPath}" alt="Profile photo ${index + 1}">
            <div class="photo-actions">
                <button type="button" class="photo-select-btn" onclick="toggleHomePhotoSelection(${index}, ${isExisting})">
                    ${isSelected ? 'Selected ✓' : 'Select'}
                </button>
                <button type="button" class="photo-delete-btn" onclick="deleteHomePhoto(${index}, ${isExisting})">Delete</button>
            </div>
        `;

        grid.appendChild(photoDiv);
    });

    if (allPhotos.length === 0) {
        grid.innerHTML = '<p style="color: #999;">No photos uploaded yet. Upload photos above to get started.</p>';
    }
}

// Toggle home photo selection
function toggleHomePhotoSelection(index, isExisting) {
    const allPhotos = [...homePhotos, ...newHomePhotos];
    let selectedPhotos = homeConfig?.selectedProfilePhotos || homeConfig?.profilePhotos || [];

    const photoPath = isExisting ? homePhotos[index] : `photos/profile-${Date.now()}-${index}.jpg`;
    const isSelected = selectedPhotos.includes(photoPath);

    if (isSelected) {
        // Deselect
        selectedPhotos = selectedPhotos.filter(p => p !== photoPath);
    } else {
        // Select (max 2)
        if (selectedPhotos.length >= 2) {
            alert('You can only select 2 profile photos. Deselect one first.');
            return;
        }
        selectedPhotos.push(photoPath);
    }

    // Update config
    if (!homeConfig.selectedProfilePhotos) {
        homeConfig.selectedProfilePhotos = [];
    }
    homeConfig.selectedProfilePhotos = selectedPhotos;

    displayHomePhotoGrid();
}

// Delete home photo
function deleteHomePhoto(index, isExisting) {
    if (!confirm('Are you sure you want to delete this photo?')) {
        return;
    }

    if (isExisting) {
        const photoPath = homePhotos[index];
        homePhotosToDelete.push(photoPath);
        homePhotos.splice(index, 1);

        // Remove from selected if it was selected
        if (homeConfig.selectedProfilePhotos) {
            homeConfig.selectedProfilePhotos = homeConfig.selectedProfilePhotos.filter(p => p !== photoPath);
        }
    } else {
        const newIndex = index - homePhotos.length;
        newHomePhotos.splice(newIndex, 1);
    }

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
        homeForm.addEventListener('submit', async function(e) {
            e.preventDefault();

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
