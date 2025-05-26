// Function to hide the discount banner and adjust header position
function closeBanner() {
    const banner = document.getElementById('discountBanner');
    banner.style.display = 'none';

    const header = document.querySelector('header');
    header.style.top = '0';
}


// Wait for the DOM to be fully loaded before running scripts
document.addEventListener('DOMContentLoaded', function() {
    const heroText = document.querySelectorAll('.hero-content h1, .hero-content p');

    const heroObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.5
    });

    heroText.forEach(el => {
        heroObserver.observe(el);
    });

});