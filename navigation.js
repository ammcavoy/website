// Dynamic navigation system
let tabsConfig = null;
let currentTab = null;
let currentSubtype = null;

// Load tabs configuration
async function loadTabsConfig() {
    try {
        const response = await fetch('tabs-config.json');
        tabsConfig = await response.json();
        return tabsConfig;
    } catch (error) {
        console.error('Error loading tabs config:', error);
        return null;
    }
}

// Determine current page/tab
function getCurrentPage() {
    const path = window.location.pathname;
    const page = path.split('/').pop().replace('.html', '');

    if (page === '' || page === 'index') {
        return 'home';
    }
    return page;
}

// Get current subtype from URL
function getCurrentSubtype() {
    const params = new URLSearchParams(window.location.search);
    return params.get('subtype');
}

// Initialize navigation
async function initNavigation() {
    const config = await loadTabsConfig();
    if (!config) return;

    const page = getCurrentPage();
    currentSubtype = getCurrentSubtype();

    // Find current tab
    currentTab = config.tabs.find(tab => tab.id === page);

    // Render navigation
    renderNavigation(config, page);

    // If on a tab page with subtypes, render subtype navigation
    if (currentTab && currentTab.subtypes && currentTab.subtypes.length > 0) {
        renderSubtypeNavigation(currentTab, currentSubtype);
    }
}

// Render main navigation
function renderNavigation(config, currentPage) {
    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu) return;

    // Clear existing items
    navMenu.innerHTML = '';

    // Add Home link
    const homeLi = document.createElement('li');
    const homeLink = document.createElement('a');
    homeLink.href = 'index.html#home';
    homeLink.textContent = 'Home';
    if (currentPage === 'home') {
        homeLink.classList.add('active');
    }
    homeLi.appendChild(homeLink);
    navMenu.appendChild(homeLi);

    // Add tab links
    config.tabs.forEach(tab => {
        if (!tab.enabled) return;

        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `${tab.id}.html`;
        a.textContent = tab.label;

        if (currentPage === tab.id) {
            a.classList.add('active');
        }

        li.appendChild(a);
        navMenu.appendChild(li);
    });

    // Add Contact link
    const contactLi = document.createElement('li');
    const contactLink = document.createElement('a');
    contactLink.href = 'index.html#contact';
    contactLink.textContent = 'Contact';
    contactLi.appendChild(contactLink);
    navMenu.appendChild(contactLi);
}

// Render subtype navigation (appears below main nav)
function renderSubtypeNavigation(tab, activeSubtype) {
    // Check if subtype nav already exists
    let subtypeNav = document.getElementById('subtype-navigation');

    if (!subtypeNav) {
        // Create subtype navigation container
        subtypeNav = document.createElement('div');
        subtypeNav.id = 'subtype-navigation';
        subtypeNav.className = 'subtype-nav';

        // Insert after navbar
        const navbar = document.querySelector('.navbar');
        navbar.parentNode.insertBefore(subtypeNav, navbar.nextSibling);
    }

    // Clear and populate
    subtypeNav.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'container';

    const subtypeList = document.createElement('ul');
    subtypeList.className = 'subtype-list';

    // Add "All" option
    const allLi = document.createElement('li');
    const allLink = document.createElement('a');
    allLink.href = `${tab.id}.html`;
    allLink.textContent = 'All';
    if (!activeSubtype) {
        allLink.classList.add('active');
    }
    allLi.appendChild(allLink);
    subtypeList.appendChild(allLi);

    // Add subtype links
    tab.subtypes.forEach(subtype => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `${tab.id}.html?subtype=${subtype.id}`;
        a.innerHTML = `${subtype.icon || ''} ${subtype.label}`;

        if (activeSubtype === subtype.id) {
            a.classList.add('active');
        }

        li.appendChild(a);
        subtypeList.appendChild(li);
    });

    container.appendChild(subtypeList);
    subtypeNav.appendChild(container);
}

// Export current filter state for use by page scripts
function getActiveFilter() {
    return {
        tab: currentTab,
        subtype: currentSubtype
    };
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initNavigation);
