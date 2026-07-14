(() => {
  const carousel = document.querySelector('[data-hero-carousel]');
  if (!carousel || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const primary = carousel.querySelector('img');
  const slides = (carousel.dataset.heroSlides || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (!primary || slides.length < 2) return;

  const nextImage = document.createElement('img');
  nextImage.className = 'hero-slide';
  nextImage.alt = '';
  nextImage.setAttribute('aria-hidden', 'true');
  carousel.append(nextImage);

  const shuffled = slides.sort(() => Math.random() - .5);
  const first = primary.getAttribute('src');
  const start = shuffled.indexOf(first);
  if (start > 0) [shuffled[0], shuffled[start]] = [shuffled[start], shuffled[0]];
  let index = 0;

  const showNext = () => {
    const next = (index + 1) % shuffled.length;
    const preload = new Image();
    preload.onload = () => {
      nextImage.src = shuffled[next];
      requestAnimationFrame(() => nextImage.classList.add('is-visible'));
      window.setTimeout(() => {
        primary.src = shuffled[next];
        nextImage.classList.remove('is-visible');
        index = next;
        window.setTimeout(showNext, 5000);
      }, 1000);
    };
    preload.onerror = () => {
      index = next;
      window.setTimeout(showNext, 5000);
    };
    preload.src = shuffled[next];
  };
  window.setTimeout(showNext, 5000);
})();
