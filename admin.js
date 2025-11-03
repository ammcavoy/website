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
    document.getElementById('adventure-category').value = currentAdventure.category || 'day-hikes';
    document.getElementById('adventure-description').value = currentAdventure.description;

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

// Update date fields based on category
function updateDateFields() {
    const category = document.getElementById('adventure-category').value;
    const needsRange = ['camping', 'hut-trips', 'other'].includes(category);

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
    const category = document.getElementById('adventure-category').value;
    const description = document.getElementById('adventure-description').value.trim();

    // Validate adventure ID format
    if (!/^[a-z0-9-]+$/.test(id)) {
        alert('Adventure ID must contain only lowercase letters, numbers, and hyphens');
        return;
    }

    // Get dates
    let dateData = {};
    const needsRange = ['camping', 'hut-trips', 'other'].includes(category);
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

    // Check GPX file requirements
    const remainingExisting = existingGpxFiles.filter(gpx => !gpxFilesToRemove.includes(gpx.url));
    const totalGpxFiles = remainingExisting.length + newGpxFiles.length;

    if (totalGpxFiles === 0) {
        alert('Please upload at least one GPX file');
        return;
    }

    // Build adventure object
    const adventure = {
        id: id,
        title: title,
        category: category,
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
