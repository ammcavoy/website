// Adventures loader and display script
let adventuresData = [];
let activeSubtypeFilter = null;

// Extract YouTube video ID from URL
function extractYouTubeVideoId(url) {
    if (!url) return null;

    // Handle various YouTube URL formats
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/v\/([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

// Load adventures from JSON file
async function loadAdventures() {
    try {
        const response = await fetch('adventures/adventures.json');
        const data = await response.json();

        // Sort adventures by date (most recent first)
        adventuresData = data.adventures.sort((a, b) => {
            // Get the date to compare - use startDate if it exists, otherwise use date
            const dateA = new Date(a.startDate || a.date);
            const dateB = new Date(b.startDate || b.date);
            // Sort in descending order (most recent first)
            return dateB - dateA;
        });

        // Get filter from URL
        const params = new URLSearchParams(window.location.search);
        activeSubtypeFilter = params.get('subtype');

        displayAdventures();
    } catch (error) {
        console.error('Error loading adventures:', error);
        displayNoAdventures();
    }
}

// Display adventures in the grid
function displayAdventures() {
    const grid = document.getElementById('adventures-grid');

    if (!adventuresData || adventuresData.length === 0) {
        displayNoAdventures();
        return;
    }

    // Filter adventures by subtype if filter is active
    let filteredAdventures = adventuresData;
    if (activeSubtypeFilter) {
        filteredAdventures = adventuresData.filter(adv => {
            // Check if adventure has this category
            if (Array.isArray(adv.categories)) {
                return adv.categories.includes(activeSubtypeFilter);
            }
            // Legacy support: convert single category to array
            if (adv.category) {
                return adv.category === activeSubtypeFilter;
            }
            return false;
        });
    }

    if (filteredAdventures.length === 0) {
        grid.innerHTML = '<div class="no-adventures">No adventures found for this category.</div>';
        return;
    }

    grid.innerHTML = '';

    filteredAdventures.forEach((adventure, index) => {
        const card = createAdventureCard(adventure, index);
        grid.appendChild(card);
    });
}

// Create a single adventure card
function createAdventureCard(adventure, index) {
    const card = document.createElement('div');
    card.className = 'adventure-card';
    card.onclick = () => openAdventureModal(adventure);

    // Create cover photo, map preview, or placeholder
    let mediaHtml = '';
    if (adventure.coverPhoto) {
        mediaHtml = `<img src="${adventure.coverPhoto}" alt="${adventure.title}" class="adventure-cover-photo">`;
    } else if (adventure.gpxFile) {
        mediaHtml = `<div id="map-preview-${index}" class="adventure-map"></div>`;
    } else {
        // Placeholder for adventures without cover photo or GPX
        mediaHtml = `<div class="adventure-placeholder"></div>`;
    }

    // Format date(s)
    let formattedDate;
    if (adventure.startDate && adventure.endDate) {
        const start = new Date(adventure.startDate);
        const end = new Date(adventure.endDate);
        formattedDate = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (adventure.date) {
        const date = new Date(adventure.date);
        formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } else {
        formattedDate = 'Date TBD';
    }

    // Get category labels
    const categoryLabels = {
        'day-hikes': 'Day Hike',
        'camping': 'Camping',
        'backcountry-lines': 'Backcountry',
        'hut-trips': 'Hut Trip',
        'other': 'Adventure',
        '14ers': '14er'
    };

    // Get categories (always use array)
    let categories = [];
    if (Array.isArray(adventure.categories)) {
        categories = adventure.categories;
    } else if (adventure.category) {
        // Legacy support: convert single category to array
        categories = [adventure.category];
    }

    const categoryBadgesHtml = categories
        .map(cat => `<div class="adventure-category-badge">${categoryLabels[cat] || cat}</div>`)
        .join('');

    card.innerHTML = `
        ${mediaHtml}
        <div class="card-content">
            <div class="adventure-category-badges">${categoryBadgesHtml}</div>
            <h3>${adventure.title}</h3>
            <div class="adventure-date">${formattedDate}</div>
        </div>
    `;

    // If using map preview, initialize it after the card is added to DOM
    if (!adventure.coverPhoto && adventure.gpxFile) {
        setTimeout(() => initMapPreview(index, adventure.gpxFile), 100);
    }

    return card;
}

// Initialize a small map preview for the card
function initMapPreview(index, gpxFile) {
    const mapElement = document.getElementById(`map-preview-${index}`);
    if (!mapElement) return;

    const map = L.map(`map-preview-${index}`, {
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false
    }).setView([39.5, -105.5], 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Load GPX file
    new L.GPX(gpxFile, {
        async: true,
        marker_options: {
            startIconUrl: null,
            endIconUrl: null,
            shadowUrl: null
        }
    }).on('loaded', function(e) {
        map.fitBounds(e.target.getBounds());
    }).addTo(map);
}

// Open adventure detail modal
function openAdventureModal(adventure) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('adventure-modal');
    if (!modal) {
        modal = createModal();
        document.body.appendChild(modal);
    }

    // Format date(s)
    let formattedDate;
    if (adventure.startDate && adventure.endDate) {
        const start = new Date(adventure.startDate);
        const end = new Date(adventure.endDate);
        const startStr = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        const endStr = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        formattedDate = `${startStr} - ${endStr}`;
    } else if (adventure.date) {
        const date = new Date(adventure.date);
        formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } else {
        formattedDate = 'Date TBD';
    }

    // Build photos HTML
    let photosHtml = '';
    if (adventure.photos && adventure.photos.length > 0) {
        photosHtml = `
            <div class="modal-photos">
                <h3>Photos</h3>
                ${adventure.photos.map((photo, index) =>
                    `<img src="${photo}" alt="${adventure.title}" class="modal-photo">`
                ).join('')}
            </div>
        `;
    }

    // Extract YouTube video ID if URL exists
    let youtubeSection = '';
    if (adventure.youtubeUrl) {
        const videoId = extractYouTubeVideoId(adventure.youtubeUrl);
        if (videoId) {
            const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
            youtubeSection = `
                <div class="modal-youtube">
                    <h3>Video</h3>
                    <a href="${adventure.youtubeUrl}" target="_blank" rel="noopener noreferrer">
                        <img src="${thumbnailUrl}" alt="YouTube Video" class="youtube-thumbnail">
                        <div class="youtube-play-button"></div>
                    </a>
                </div>
            `;
        }
    }

    modal.querySelector('.modal-content').innerHTML = `
        <button class="modal-close" onclick="closeAdventureModal()">&times;</button>
        ${adventure.coverPhoto ? `<img src="${adventure.coverPhoto}" alt="${adventure.title}" class="modal-header-image" id="modal-header-image">` : ''}
        <div class="modal-body">
            <h2 class="modal-title">${adventure.title}</h2>
            <div class="modal-date">${formattedDate}</div>
            <div class="modal-description">${adventure.description}</div>
            ${youtubeSection}
            ${getGpxFiles(adventure).length > 0 ? '<div id="modal-map" class="modal-map"></div>' : ''}
            ${photosHtml}
        </div>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Make header image clickable
    if (adventure.coverPhoto && adventure.photos) {
        const headerImg = document.getElementById('modal-header-image');
        const coverIndex = adventure.photos.indexOf(adventure.coverPhoto);
        if (headerImg) {
            headerImg.style.cursor = 'pointer';
            headerImg.onclick = () => openLightbox(adventure.photos, coverIndex >= 0 ? coverIndex : 0);
        }
    }

    // Make all gallery photos clickable
    const galleryPhotos = modal.querySelectorAll('.modal-photo');
    galleryPhotos.forEach((img, index) => {
        img.onclick = () => openLightbox(adventure.photos, index);
    });

    // Initialize map if GPX files exist
    const gpxFilesToMap = getGpxFiles(adventure);
    if (gpxFilesToMap.length > 0) {
        setTimeout(() => initModalMap(gpxFilesToMap), 100);
    }
}

// Close adventure modal
function closeAdventureModal() {
    const modal = document.getElementById('adventure-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

// Create modal element
function createModal() {
    const modal = document.createElement('div');
    modal.id = 'adventure-modal';
    modal.className = 'adventure-modal';
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeAdventureModal();
        }
    };

    const content = document.createElement('div');
    content.className = 'modal-content';
    modal.appendChild(content);

    return modal;
}

// Initialize full-size map in modal with multiple GPX files
function initModalMap(gpxFiles) {
    const mapElement = document.getElementById('modal-map');
    if (!mapElement) return;

    console.log('Initializing modal map with', gpxFiles.length, 'GPX files:', gpxFiles);

    const map = L.map('modal-map').setView([39.5, -105.5], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const allBounds = L.latLngBounds();
    let loadedCount = 0;

    // Load all GPX files
    gpxFiles.forEach((gpxFile, index) => {
        const isWaypoint = gpxFile.type === 'waypoints';

        // For waypoint-only files, manually parse and add markers
        if (isWaypoint) {
            console.log('Loading waypoint file:', gpxFile.url);
            fetch(gpxFile.url)
                .then(response => response.text())
                .then(gpxText => {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(gpxText, 'text/xml');
                    const waypoints = xmlDoc.getElementsByTagName('wpt');

                    console.log('Found', waypoints.length, 'waypoints in', gpxFile.url);

                    Array.from(waypoints).forEach(wpt => {
                        const lat = parseFloat(wpt.getAttribute('lat'));
                        const lon = parseFloat(wpt.getAttribute('lon'));
                        const nameElement = wpt.getElementsByTagName('name')[0];
                        const name = nameElement ? nameElement.textContent : 'Waypoint';

                        console.log('Adding waypoint marker:', name, 'at', lat, lon);

                        const marker = L.marker([lat, lon], {
                            icon: L.divIcon({
                                className: 'custom-gpx-marker',
                                html: '⛺',
                                iconSize: [30, 30],
                                iconAnchor: [15, 30]
                            })
                        }).addTo(map);

                        marker.bindPopup(`<strong>${name}</strong>`);
                        allBounds.extend([lat, lon]);
                    });

                    loadedCount++;
                    console.log('Loaded count:', loadedCount, '/', gpxFiles.length);
                    if (loadedCount === gpxFiles.length && allBounds.isValid()) {
                        console.log('All files loaded, fitting bounds:', allBounds);
                        map.fitBounds(allBounds, { padding: [50, 50] });
                    }
                })
                .catch(error => {
                    console.error('Error loading waypoint file:', error);
                    loadedCount++;
                });
        } else {
            // For route/track files, use the GPX plugin
            const gpxLayer = new L.GPX(gpxFile.url, {
                async: true,
                marker_options: {
                    startIconUrl: '',
                    endIconUrl: '',
                    shadowUrl: ''
                },
                polyline_options: {
                    color: '#2c5f4f',
                    weight: 4,
                    opacity: 0.8
                }
            });

            gpxLayer.on('loaded', function(e) {
                const bounds = e.target.getBounds();
                if (bounds.isValid()) {
                    allBounds.extend(bounds);
                }

                loadedCount++;
                if (loadedCount === gpxFiles.length && allBounds.isValid()) {
                    map.fitBounds(allBounds, { padding: [50, 50] });
                }
            });

            gpxLayer.addTo(map);
        }
    });

    // Add download footer to map
    const downloadFooter = document.createElement('div');
    downloadFooter.className = 'map-download-footer';

    // Store gpxFiles data on the map element for the download function
    mapElement.dataset.gpxFiles = JSON.stringify(gpxFiles);

    downloadFooter.innerHTML = `
        <button class="map-download-btn" onclick="downloadAllGpxFiles()">
            ⬇ Download All GPX Files
        </button>
    `;
    mapElement.appendChild(downloadFooter);
}

// Display message when no adventures are available
function displayNoAdventures() {
    const grid = document.getElementById('adventures-grid');
    grid.innerHTML = '<div class="no-adventures">No adventures yet. Check back soon!</div>';
}

// Utility function to truncate text
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

// Lightbox functionality
let currentLightboxImages = [];
let currentLightboxIndex = 0;

function openLightbox(images, index) {
    currentLightboxImages = images;
    currentLightboxIndex = index;

    // Create lightbox if it doesn't exist
    let lightbox = document.getElementById('lightbox');
    if (!lightbox) {
        lightbox = createLightbox();
        document.body.appendChild(lightbox);
    }

    showLightboxImage();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

function nextLightboxImage() {
    currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxImages.length;
    showLightboxImage();
}

function prevLightboxImage() {
    currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxImages.length) % currentLightboxImages.length;
    showLightboxImage();
}

function showLightboxImage() {
    const img = document.getElementById('lightbox-image');
    const counter = document.getElementById('lightbox-counter');

    img.src = currentLightboxImages[currentLightboxIndex];
    counter.textContent = `${currentLightboxIndex + 1} / ${currentLightboxImages.length}`;
}

function createLightbox() {
    const lightbox = document.createElement('div');
    lightbox.id = 'lightbox';
    lightbox.className = 'lightbox';

    lightbox.innerHTML = `
        <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
        <button class="lightbox-nav prev" onclick="prevLightboxImage()">‹</button>
        <button class="lightbox-nav next" onclick="nextLightboxImage()">›</button>
        <div class="lightbox-content">
            <img id="lightbox-image" class="lightbox-image" src="" alt="">
        </div>
        <div id="lightbox-counter" class="lightbox-counter"></div>
    `;

    // Close on background click
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;

        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') prevLightboxImage();
        if (e.key === 'ArrowRight') nextLightboxImage();
    });

    return lightbox;
}

// Get GPX files from adventure object (supports both old and new format)
function getGpxFiles(adventure) {
    const gpxFiles = [];

    // New format: gpxFiles array
    if (adventure.gpxFiles && Array.isArray(adventure.gpxFiles)) {
        return adventure.gpxFiles.map(gpx => ({
            url: gpx.url || gpx.file,
            name: gpx.name || gpx.url.split('/').pop(),
            label: gpx.label || gpx.name || 'Download GPX',
            type: gpx.type || 'route'
        }));
    }

    // Old format: single gpxFile (backward compatibility)
    if (adventure.gpxFile) {
        gpxFiles.push({
            url: adventure.gpxFile,
            name: `${adventure.id}-route.gpx`,
            label: 'Route',
            type: 'route'
        });
    }

    // Check for waypoints file
    if (adventure.waypointsFile) {
        gpxFiles.push({
            url: adventure.waypointsFile,
            name: `${adventure.id}-waypoints.gpx`,
            label: 'Waypoints',
            type: 'waypoints'
        });
    }

    return gpxFiles;
}

// Download GPX file
function downloadGpxFile(url, filename) {
    fetch(url)
        .then(response => response.blob())
        .then(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        })
        .catch(error => {
            console.error('Download failed:', error);
            alert('Failed to download GPX file. Please try again.');
        });
}

// Download all GPX files for the current adventure
function downloadAllGpxFiles() {
    const mapElement = document.getElementById('modal-map');
    if (!mapElement || !mapElement.dataset.gpxFiles) return;

    const gpxFiles = JSON.parse(mapElement.dataset.gpxFiles);

    // Download each file with a small delay between downloads
    gpxFiles.forEach((gpx, index) => {
        setTimeout(() => {
            downloadGpxFile(gpx.url, gpx.name);
        }, index * 500); // 500ms delay between each download
    });
}

// Load adventures when page loads
document.addEventListener('DOMContentLoaded', loadAdventures);
