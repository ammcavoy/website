// Generic Content Loader - Works for all tabs
let contentData = [];
let tabConfig = null;
let tabId = null;
let activeSubtypeFilter = null;

// Extract YouTube video ID from URL
function extractYouTubeVideoId(url) {
    if (!url) return null;

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

// Get tab ID from URL parameter
function getTabIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab');
}

// Load tab configuration
async function loadTabConfig() {
    try {
        const response = await fetch('tabs-config.json');
        const config = await response.json();

        tabId = getTabIdFromUrl();
        if (!tabId) {
            throw new Error('No tab specified in URL');
        }

        tabConfig = config.tabs.find(t => t.id === tabId);
        if (!tabConfig) {
            throw new Error(`Tab configuration not found for: ${tabId}`);
        }

        // Update page title and header
        document.getElementById('page-title').textContent = `${tabConfig.label} - Adam McAvoy`;
        document.getElementById('page-header-text').textContent = tabConfig.headerText || '';
    } catch (error) {
        console.error('Error loading tab config:', error);
        displayError('Failed to load tab configuration');
    }
}

// Load content data from tab's data file
async function loadContent() {
    try {
        const response = await fetch(tabConfig.dataFile);
        const data = await response.json();

        // Support multiple data formats: {adventures: []}, {entries: []}, {test: []}
        contentData = data.adventures || data.entries || data[tabId] || [];

        // Sort by date (most recent first)
        contentData.sort((a, b) => {
            const dateA = new Date(a.startDate || a.date);
            const dateB = new Date(b.startDate || b.date);
            return dateB - dateA;
        });

        // Get filter from URL
        const params = new URLSearchParams(window.location.search);
        activeSubtypeFilter = params.get('subtype');

        displayContent();
    } catch (error) {
        console.error('Error loading content:', error);
        displayNoContent();
    }
}

// Display content in the grid
function displayContent() {
    const grid = document.getElementById('content-grid');

    if (!contentData || contentData.length === 0) {
        displayNoContent();
        return;
    }

    // Filter by subtype if active
    let filtered = contentData;
    if (activeSubtypeFilter) {
        filtered = contentData.filter(item => {
            if (Array.isArray(item.categories)) {
                return item.categories.includes(activeSubtypeFilter);
            }
            if (item.category) {
                return item.category === activeSubtypeFilter;
            }
            return false;
        });
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="no-content">No ${tabConfig.label.toLowerCase()} found for this category.</div>`;
        return;
    }

    grid.innerHTML = '';

    filtered.forEach((item, index) => {
        const card = createContentCard(item, index);
        grid.appendChild(card);
    });
}

// Create a single content card
function createContentCard(item, index) {
    const card = document.createElement('div');
    card.className = 'adventure-card';
    card.onclick = () => openContentModal(item);

    // Create media (cover photo, map preview, or placeholder)
    let mediaHtml = '';
    if (item.coverPhoto) {
        mediaHtml = `<img src="${item.coverPhoto}" alt="${item.title}" class="adventure-cover-photo">`;
    } else if (getGpxFiles(item).length > 0) {
        mediaHtml = `<div id="map-preview-${index}" class="adventure-map-preview"></div>`;
    } else {
        mediaHtml = `<div class="adventure-placeholder"></div>`;
    }

    // Format date
    const formattedDate = formatDate(item);

    // Get category badges
    const categories = Array.isArray(item.categories) ?
        item.categories : (item.category ? [item.category] : []);

    const categoryLabels = {};
    if (tabConfig.subtypes) {
        tabConfig.subtypes.forEach(st => {
            categoryLabels[st.id] = st.label;
        });
    }

    const categoryBadges = categories
        .map(cat => {
            const subtype = tabConfig.subtypes?.find(s => s.id === cat);
            const label = subtype?.label || cat;
            const icon = subtype?.icon || '';
            return `<div class="adventure-category-badge">${icon} ${label}</div>`;
        })
        .join('');

    card.innerHTML = `
        ${mediaHtml}
        <div class="adventure-card-content">
            <div class="adventure-category-badges">${categoryBadges}</div>
            <h3 class="adventure-card-title">${item.title}</h3>
            <div class="adventure-card-date">${formattedDate}</div>
        </div>
    `;

    // Initialize map preview if needed
    if (!item.coverPhoto && getGpxFiles(item).length > 0) {
        setTimeout(() => initMapPreview(index, item), 100);
    }

    return card;
}

// Format date or date range
function formatDate(item) {
    if (item.startDate && item.endDate) {
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        const startMonth = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endFull = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `${startMonth} - ${endFull}`;
    } else if (item.date) {
        const date = new Date(item.date);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    return 'Date TBD';
}

// Get GPX files from item
function getGpxFiles(item) {
    const gpxFiles = [];

    if (item.gpxFiles && Array.isArray(item.gpxFiles)) {
        return item.gpxFiles;
    }

    if (item.gpxFile) {
        gpxFiles.push({
            url: item.gpxFile,
            label: 'Route',
            type: 'route'
        });
    }

    if (item.waypointsFile) {
        gpxFiles.push({
            url: item.waypointsFile,
            label: 'Waypoints',
            type: 'waypoints'
        });
    }

    return gpxFiles;
}

// Initialize map preview on card
function initMapPreview(index, item) {
    const mapDiv = document.getElementById(`map-preview-${index}`);
    if (!mapDiv) return;

    try {
        const map = L.map(mapDiv, {
            zoomControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            tap: false
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        const gpxFiles = getGpxFiles(item);
        if (gpxFiles.length > 0) {
            const primaryGpx = gpxFiles[0];
            new L.GPX(primaryGpx.url, {
                async: true,
                marker_options: {
                    startIconUrl: null,
                    endIconUrl: null,
                    shadowUrl: null
                },
                polyline_options: {
                    color: '#2E7D32',
                    weight: 3,
                    opacity: 0.8
                }
            }).on('loaded', function(e) {
                map.fitBounds(e.target.getBounds(), { padding: [10, 10] });
            }).addTo(map);
        }
    } catch (error) {
        console.error('Error initializing map preview:', error);
    }
}

// Open content modal
function openContentModal(item) {
    let modal = document.getElementById('content-modal');
    if (!modal) {
        modal = createModal();
        document.body.appendChild(modal);
    }

    // Format date
    const formattedDate = formatDate(item);

    // Build photo gallery HTML
    let photosHtml = '';
    if (item.photos && item.photos.length > 0) {
        const photoElements = item.photos
            .map(photo => `<img src="${photo}" alt="${item.title}" class="modal-photo">`)
            .join('');

        photosHtml = `
            <div class="modal-photos">
                <h3>Photos</h3>
                ${photoElements}
            </div>
        `;
    }

    // Build YouTube section
    let youtubeSection = '';
    if (item.youtubeUrl) {
        const videoId = extractYouTubeVideoId(item.youtubeUrl);
        if (videoId) {
            const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
            youtubeSection = `
                <div class="modal-youtube">
                    <h3>Video</h3>
                    <a href="${item.youtubeUrl}" target="_blank" rel="noopener noreferrer">
                        <img src="${thumbnailUrl}" alt="YouTube Video" class="youtube-thumbnail">
                        <div class="youtube-play-button"></div>
                    </a>
                </div>
            `;
        }
    }

    modal.querySelector('.modal-content').innerHTML = `
        <button class="modal-close" onclick="closeContentModal()">&times;</button>
        ${item.coverPhoto ? `<img src="${item.coverPhoto}" alt="${item.title}" class="modal-header-image" id="modal-header-image">` : ''}
        <div class="modal-body">
            <h2 class="modal-title">${item.title}</h2>
            <div class="modal-date">${formattedDate}</div>
            <div class="modal-description">${item.description}</div>
            ${youtubeSection}
            ${getGpxFiles(item).length > 0 ? '<div id="modal-map" class="modal-map"></div>' : ''}
            ${photosHtml}
        </div>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Make header image clickable
    if (item.coverPhoto && item.photos) {
        const headerImg = document.getElementById('modal-header-image');
        const coverIndex = item.photos.indexOf(item.coverPhoto);
        if (headerImg) {
            headerImg.style.cursor = 'pointer';
            headerImg.onclick = () => openLightbox(item.photos, coverIndex >= 0 ? coverIndex : 0);
        }
    }

    // Make all gallery photos clickable
    const galleryPhotos = modal.querySelectorAll('.modal-photo');
    galleryPhotos.forEach((img, index) => {
        img.style.cursor = 'pointer';
        img.onclick = () => openLightbox(item.photos, index);
    });

    // Initialize map if GPX files exist
    const gpxFilesToMap = getGpxFiles(item);
    if (gpxFilesToMap.length > 0) {
        setTimeout(() => initModalMap(gpxFilesToMap), 100);
    }
}

// Close content modal
function closeContentModal() {
    const modal = document.getElementById('content-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Create modal element
function createModal() {
    const modal = document.createElement('div');
    modal.id = 'content-modal';
    modal.className = 'modal adventure-modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeContentModal()"></div>
        <div class="modal-content"></div>
    `;
    return modal;
}

// Initialize map in modal
function initModalMap(gpxFiles) {
    const mapDiv = document.getElementById('modal-map');
    if (!mapDiv) return;

    try {
        const map = L.map(mapDiv, {
            zoomControl: true
        }).setView([39.5, -105.8], 10);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        let allBounds = [];

        gpxFiles.forEach(gpxData => {
            const isWaypoints = gpxData.type === 'waypoints';

            new L.GPX(gpxData.url, {
                async: true,
                marker_options: {
                    startIconUrl: isWaypoints ? null : 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-start.png',
                    endIconUrl: isWaypoints ? null : 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-end.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-shadow.png',
                    wptIconUrls: {
                        '': isWaypoints ? '' : null
                    }
                },
                polyline_options: {
                    color: isWaypoints ? '#1976D2' : '#2E7D32',
                    weight: isWaypoints ? 2 : 4,
                    opacity: 0.8
                }
            }).on('loaded', function(e) {
                allBounds.push(e.target.getBounds());
                if (allBounds.length === gpxFiles.length) {
                    let combinedBounds = allBounds[0];
                    for (let i = 1; i < allBounds.length; i++) {
                        combinedBounds.extend(allBounds[i]);
                    }
                    map.fitBounds(combinedBounds, { padding: [20, 20] });
                }
            }).on('addpoint', function(e) {
                if (isWaypoints && e.point_type === 'waypoint') {
                    const marker = e.point;
                    marker.setIcon(L.divIcon({
                        className: 'custom-gpx-marker',
                        html: '⛺',
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    }));
                }
            }).addTo(map);
        });

        // Add download footer
        const downloadHtml = gpxFiles.map(gpx =>
            `<a href="${gpx.url}" download>${gpx.label || 'GPS Data'}</a>`
        ).join(' | ');

        const footer = document.createElement('div');
        footer.className = 'map-download-footer';
        footer.innerHTML = `Download: ${downloadHtml}`;
        mapDiv.appendChild(footer);

    } catch (error) {
        console.error('Error initializing modal map:', error);
    }
}

// Open lightbox for photo viewing
function openLightbox(photos, startIndex = 0) {
    let lightbox = document.getElementById('lightbox');
    if (!lightbox) {
        lightbox = createLightbox();
        document.body.appendChild(lightbox);
    }

    let currentIndex = startIndex;

    function showPhoto(index) {
        currentIndex = index;
        const img = lightbox.querySelector('.lightbox-image');
        img.src = photos[index];

        const counter = lightbox.querySelector('.lightbox-counter');
        counter.textContent = `${index + 1} / ${photos.length}`;

        const prevBtn = lightbox.querySelector('.lightbox-prev');
        const nextBtn = lightbox.querySelector('.lightbox-next');

        prevBtn.style.display = index > 0 ? 'block' : 'none';
        nextBtn.style.display = index < photos.length - 1 ? 'block' : 'none';
    }

    lightbox.querySelector('.lightbox-prev').onclick = () => {
        if (currentIndex > 0) showPhoto(currentIndex - 1);
    };

    lightbox.querySelector('.lightbox-next').onclick = () => {
        if (currentIndex < photos.length - 1) showPhoto(currentIndex + 1);
    };

    lightbox.classList.add('active');
    showPhoto(startIndex);
}

// Close lightbox
function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
    }
}

// Create lightbox element
function createLightbox() {
    const lightbox = document.createElement('div');
    lightbox.id = 'lightbox';
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
        <div class="lightbox-overlay" onclick="closeLightbox()"></div>
        <div class="lightbox-content">
            <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
            <img src="" alt="Photo" class="lightbox-image">
            <div class="lightbox-counter"></div>
            <button class="lightbox-prev">&#10094;</button>
            <button class="lightbox-next">&#10095;</button>
        </div>
    `;
    return lightbox;
}

// Display no content message
function displayNoContent() {
    const grid = document.getElementById('content-grid');
    grid.innerHTML = `<div class="no-content">No ${tabConfig?.label?.toLowerCase() || 'content'} available yet.</div>`;
}

// Display error message
function displayError(message) {
    const grid = document.getElementById('content-grid');
    grid.innerHTML = `<div class="error-message">${message}</div>`;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadTabConfig();
    await loadContent();
});
