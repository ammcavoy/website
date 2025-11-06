// Load home page content from configuration
async function loadHomeContent() {
    try {
        const response = await fetch('home-config.json');
        const config = await response.json();

        // Update profile photos
        if (config.profilePhotos && config.profilePhotos.length > 0) {
            const profileImages = document.querySelectorAll('.profile-image img');
            config.profilePhotos.forEach((photoPath, index) => {
                if (profileImages[index]) {
                    profileImages[index].src = photoPath;
                }
            });
        }

        // Update tagline
        const taglineEl = document.querySelector('.tagline');
        if (taglineEl && config.tagline) {
            taglineEl.textContent = config.tagline;
        }

        // Update about paragraphs
        const aboutText = document.querySelector('.about-text');
        if (aboutText) {
            aboutText.innerHTML = `
                <p>${config.aboutParagraph1 || ''}</p>
                <p>${config.aboutParagraph2 || ''}</p>
            `;
        }

        // Update professional background
        if (config.professionalBackground) {
            const bg = config.professionalBackground;
            const highlightsList = document.querySelector('.about-highlights ul');
            if (highlightsList) {
                highlightsList.innerHTML = `
                    <li><strong>Current:</strong> ${bg.current || ''}</li>
                    <li><strong>Education:</strong> ${bg.education || ''}</li>
                    <li><strong>Specialties:</strong> ${bg.specialties || ''}</li>
                    <li><strong>Technologies:</strong> ${bg.technologies || ''}</li>
                `;
            }
        }

        // Update contact info
        if (config.contact) {
            const contactInfo = document.querySelector('.contact-info');
            if (contactInfo) {
                contactInfo.innerHTML = `
                    <p><strong>Email:</strong> <a href="mailto:${config.contact.email}">${config.contact.email}</a></p>
                    <p><strong>Phone:</strong> ${config.contact.phone}</p>
                    <p><strong>Location:</strong> ${config.contact.location}</p>
                `;
            }
        }

    } catch (error) {
        console.error('Error loading home page content:', error);
    }
}

// Load content when page loads
document.addEventListener('DOMContentLoaded', loadHomeContent);
