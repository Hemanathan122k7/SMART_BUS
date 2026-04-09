/**
 * Sidebar Navigation Component
 * Handles sidebar menu interactions and section switching
 */

document.addEventListener('DOMContentLoaded', function() {
    const sidebarItems = document.querySelectorAll('.sidebar-menu li');
    const contentSections = document.querySelectorAll('.content-section');

    // Add click event to each sidebar menu item
    sidebarItems.forEach(item => {
        item.addEventListener('click', function() {
            // Get the target section from data attribute
            const targetSection = this.getAttribute('data-section');

            // Remove active class from all items and sections
            sidebarItems.forEach(i => i.classList.remove('active'));
            contentSections.forEach(s => s.classList.remove('active'));

            // Add active class to clicked item
            this.classList.add('active');

            // Show the corresponding content section
            const section = document.getElementById(targetSection);
            if (section) {
                section.classList.add('active');
            }
        });
    });
});

/**
 * Function to programmatically switch sections
 * @param {string} sectionId - ID of the section to display
 */
function switchSection(sectionId) {
    const sidebarItems = document.querySelectorAll('.sidebar-menu li');
    const contentSections = document.querySelectorAll('.content-section');

    // Remove active class from all
    sidebarItems.forEach(i => i.classList.remove('active'));
    contentSections.forEach(s => s.classList.remove('active'));

    // Find and activate the target
    sidebarItems.forEach(item => {
        if (item.getAttribute('data-section') === sectionId) {
            item.classList.add('active');
        }
    });

    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
    }
}
