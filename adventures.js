// Adventures loader and display script
let adventuresData = [];

// Load adventures from JSON file
async function loadAdventures() {
    try {
        const response = await fetch('adventures/adventures.json');
        const data = await response.json();
        adventuresData = data.adventures;
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

    grid.innerHTML = '';

    adventuresData.forEach((adventure, index) => {
        const card = createAdventureCard(adventure, index);
        grid.appendChild(card);
    });
}

// Create a single adventure card
function createAdventureCard(adventure, index) {
    const card = document.createElement('div');
    card.className = 'adventure-card';
    card.onclick = () => openAdventureModal(adventure);

    // Create cover photo or map preview
    let mediaHtml = '';
    if (adventure.coverPhoto) {
        mediaHtml = `<img src="${adventure.coverPhoto}" alt="${adventure.title}" class="adventure-cover-photo">`;
    } else if (adventure.gpxFile) {
        mediaHtml = `<div id="map-preview-${index}" class="adventure-map"></div>`;
    }

    // Format date
    const date = new Date(adventure.date);
    const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    card.innerHTML = `
        ${mediaHtml}
        <div class="card-content">
            <h3>${adventure.title}</h3>
            <div class="adventure-date">${formattedDate}</div>
            <div class="adventure-description">${truncateText(adventure.description, 120)}</div>
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

    // Format date
    const date = new Date(adventure.date);
    const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Build photos HTML
    let photosHtml = '';
    if (adventure.photos && adventure.photos.length > 0) {
        photosHtml = `
            <div class="modal-photos">
                <h3>Photos</h3>
                ${adventure.photos.map(photo =>
                    `<img src="${photo}" alt="${adventure.title}" class="modal-photo" onclick="window.open('${photo}', '_blank')">`
                ).join('')}
            </div>
        `;
    }

    modal.querySelector('.modal-content').innerHTML = `
        <button class="modal-close" onclick="closeAdventureModal()">&times;</button>
        ${adventure.coverPhoto ? `<img src="${adventure.coverPhoto}" alt="${adventure.title}" class="modal-header-image">` : ''}
        <div class="modal-body">
            <h2 class="modal-title">${adventure.title}</h2>
            <div class="modal-date">${formattedDate}</div>
            <div class="modal-description">${adventure.description}</div>
            ${adventure.gpxFile ? '<div id="modal-map" class="modal-map"></div>' : ''}
            ${photosHtml}
        </div>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Initialize map if GPX file exists
    if (adventure.gpxFile) {
        setTimeout(() => initModalMap(adventure.gpxFile), 100);
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

// Initialize full-size map in modal
function initModalMap(gpxFile) {
    const mapElement = document.getElementById('modal-map');
    if (!mapElement) return;

    const map = L.map('modal-map').setView([39.5, -105.5], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Load GPX file
    new L.GPX(gpxFile, {
        async: true,
        marker_options: {
            startIconUrl: 'https://raw.githubusercontent.com/mpetazzoni/leaflet-gpx/master/pin-icon-start.png',
            endIconUrl: 'https://raw.githubusercontent.com/mpetazzoni/leaflet-gpx/master/pin-icon-end.png',
            shadowUrl: 'https://raw.githubusercontent.com/mpetazzoni/leaflet-gpx/master/pin-shadow.png'
        },
        polyline_options: {
            color: '#2c5f4f',
            weight: 4,
            opacity: 0.8
        }
    }).on('loaded', function(e) {
        map.fitBounds(e.target.getBounds());
    }).addTo(map);
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

// Load adventures when page loads
document.addEventListener('DOMContentLoaded', loadAdventures);
