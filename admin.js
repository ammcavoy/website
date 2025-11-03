// Admin script with GitHub API integration
let selectedPhotos = [];
let coverPhotoIndex = 0;
let githubToken = '';
let githubConfig = {
    owner: '', // Will be auto-detected
    repo: '',  // Will be auto-detected
    branch: 'main'
};

// Load saved token from localStorage
window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('github-token');
    if (saved) {
        githubToken = saved;
        document.getElementById('github-token').value = saved;
        showTokenStatus('Token loaded from browser storage', 'success');
    }
});

// Save GitHub token
async function saveToken() {
    const token = document.getElementById('github-token').value.trim();

    if (!token) {
        showTokenStatus('Please enter a token', 'error');
        return;
    }

    // Test the token
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

        // Try to detect the repo from the current URL
        const repos = await response.json();

        // Get user info
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        const user = await userResponse.json();

        // Store token
        githubToken = token;
        localStorage.setItem('github-token', token);

        // Prompt for repo info
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

// Show token status message
function showTokenStatus(message, type) {
    const status = document.getElementById('token-status');
    status.textContent = message;
    status.className = `token-status ${type}`;
}

// Load GitHub config from localStorage
function loadGitHubConfig() {
    githubConfig.owner = localStorage.getItem('github-owner') || '';
    githubConfig.repo = localStorage.getItem('github-repo') || '';

    if (!githubConfig.owner || !githubConfig.repo) {
        throw new Error('GitHub repository not configured. Please save your token first.');
    }
}

// Handle photo file selection
document.getElementById('photo-files').addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    selectedPhotos = files;

    // Display preview
    const preview = document.getElementById('photo-preview');
    const coverSelector = document.getElementById('cover-photo-selector');

    preview.innerHTML = '';
    coverSelector.innerHTML = '';

    if (files.length === 0) return;

    // Show photo previews
    files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const item = document.createElement('div');
            item.className = 'file-preview-item';
            item.innerHTML = `
                <img src="${e.target.result}" alt="Photo ${index + 1}">
                <button type="button" class="remove-btn" onclick="removePhoto(${index})">&times;</button>
            `;
            preview.appendChild(item);
        };
        reader.readAsDataURL(file);
    });

    // Create cover photo selector
    coverSelector.innerHTML = '<label>Select Cover Photo:</label><br>';
    files.forEach((file, index) => {
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'cover-photo';
        radio.value = index;
        radio.id = `cover-${index}`;
        radio.checked = index === 0;
        radio.addEventListener('change', () => {
            coverPhotoIndex = index;
        });

        const label = document.createElement('label');
        label.htmlFor = `cover-${index}`;
        label.textContent = ` Photo ${index + 1}`;
        label.style.marginRight = '1rem';

        coverSelector.appendChild(radio);
        coverSelector.appendChild(label);
    });
});

// Remove photo from selection
function removePhoto(index) {
    selectedPhotos.splice(index, 1);

    // Trigger change event to update preview
    const dataTransfer = new DataTransfer();
    selectedPhotos.forEach(file => dataTransfer.items.add(file));
    document.getElementById('photo-files').files = dataTransfer.files;

    // Manually trigger the change handler
    const event = new Event('change');
    document.getElementById('photo-files').dispatchEvent(event);

    // Adjust cover photo index if necessary
    if (coverPhotoIndex >= selectedPhotos.length) {
        coverPhotoIndex = Math.max(0, selectedPhotos.length - 1);
    }
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
    const date = document.getElementById('adventure-date').value;
    const description = document.getElementById('adventure-description').value.trim();
    const gpxFile = document.getElementById('gpx-file').files[0];

    // Validate adventure ID format
    if (!/^[a-z0-9-]+$/.test(id)) {
        alert('Adventure ID must contain only lowercase letters, numbers, and hyphens');
        return;
    }

    if (selectedPhotos.length === 0) {
        alert('Please select at least one photo');
        return;
    }

    if (!gpxFile) {
        alert('Please select a GPX file');
        return;
    }

    // Generate the adventure object
    const coverPhotoPath = `adventures/${id}/${getPhotoFileName(selectedPhotos[coverPhotoIndex], coverPhotoIndex, true)}`;

    // Build photos array with cover photo first, then other photos
    const photosArray = selectedPhotos.map((photo, index) => {
        if (index === coverPhotoIndex) {
            return coverPhotoPath; // Use cover.ext naming for the cover photo
        }
        return `adventures/${id}/${getPhotoFileName(photo, index)}`;
    });

    const adventure = {
        id: id,
        title: title,
        date: date,
        description: description,
        coverPhoto: coverPhotoPath,
        gpxFile: `adventures/${id}/route.gpx`,
        photos: photosArray
    };

    try {
        await uploadAdventureToGitHub(adventure, gpxFile, selectedPhotos);
    } catch (error) {
        hideProgress();
        alert(`Upload failed: ${error.message}`);
        console.error('Upload error:', error);
    }
});

// Get photo file name
function getPhotoFileName(file, index, isCover = false) {
    const extension = file.name.split('.').pop().toLowerCase();
    if (isCover) {
        return `cover.${extension}`;
    }
    return `photo-${index + 1}.${extension}`;
}

// Upload adventure to GitHub
async function uploadAdventureToGitHub(adventure, gpxFile, photos) {
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

        // Add new adventure
        adventures.push(adventure);
        const updatedAdventuresJson = JSON.stringify({ adventures }, null, 2);

        // Step 4: Create blobs for all files
        showProgress('Uploading files...', 40);
        const blobs = [];

        // Upload GPX file
        const gpxContent = await readFileAsBase64(gpxFile);
        const gpxBlob = await createBlob(gpxContent);
        blobs.push({
            path: `adventures/${adventure.id}/route.gpx`,
            sha: gpxBlob.sha,
            mode: '100644',
            type: 'blob'
        });

        // Upload photos
        for (let i = 0; i < photos.length; i++) {
            const progress = 40 + (i / photos.length) * 30;
            showProgress(`Uploading photo ${i + 1}/${photos.length}...`, progress);

            const photoContent = await readFileAsBase64(photos[i]);
            const photoBlob = await createBlob(photoContent);
            blobs.push({
                path: `adventures/${adventure.id}/${getPhotoFileName(photos[i], i, i === coverPhotoIndex)}`,
                sha: photoBlob.sha,
                mode: '100644',
                type: 'blob'
            });
        }

        // Upload updated adventures.json
        const jsonBlob = await createBlob(btoa(updatedAdventuresJson));
        blobs.push({
            path: 'adventures/adventures.json',
            sha: jsonBlob.sha,
            mode: '100644',
            type: 'blob'
        });

        // Step 5: Create new tree
        showProgress('Creating file tree...', 75);
        const newTree = await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/trees`, {
            method: 'POST',
            body: JSON.stringify({
                base_tree: treeSha,
                tree: blobs
            })
        });

        // Step 6: Create new commit
        showProgress('Creating commit...', 85);
        const newCommit = await githubAPI(`/repos/${githubConfig.owner}/${githubConfig.repo}/git/commits`, {
            method: 'POST',
            body: JSON.stringify({
                message: `Add adventure: ${adventure.title}`,
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
    document.getElementById('adventure-form').reset();
    selectedPhotos = [];
    document.getElementById('photo-preview').innerHTML = '';
    document.getElementById('cover-photo-selector').innerHTML = '';
}
