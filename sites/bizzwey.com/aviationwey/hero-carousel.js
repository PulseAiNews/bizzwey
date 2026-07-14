(() => {
  const carousel = document.querySelector('[data-hero-carousel]');
  if (!carousel || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const primary = carousel.querySelector('img');
  const count = Number(carousel.dataset.heroCount || 0);
  const basePath = carousel.dataset.heroPath || 'assets/hero-carousel';
  const slides = count > 1
    ? Array.from({ length: count }, (_, index) => `${basePath}/${String(index + 1).padStart(2, '0')}.webp`)
    : (carousel.dataset.heroSlides || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (!primary || slides.length < 2) return;

  const nextImage = document.createElement('img');
  nextImage.className = 'hero-slide';
  nextImage.alt = '';
  nextImage.setAttribute('aria-hidden', 'true');
  carousel.append(nextImage);

  const shuffled = [...slides];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const random = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[random]] = [shuffled[random], shuffled[index]];
  }
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
        window.setTimeout(showNext, 4000);
      }, 1000);
    };
    preload.onerror = () => {
      index = next;
      window.setTimeout(showNext, 4000);
    };
    preload.src = shuffled[next];
  };

  shuffled.slice(1, 4).forEach((src) => {
    const preload = new Image();
    preload.src = src;
  });
  window.setTimeout(showNext, 5000);
})();
