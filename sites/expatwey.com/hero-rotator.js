(() => {
  const image = document.querySelector('[data-hero-rotator]');
  if (!image) return;

  const portfolio = image.dataset.heroRotator;
  const frames = Array.from({ length: 12 }, (_, index) =>
    `https://www.bizzwey.com/assets/portfolio/${portfolio}/v-${String(index).padStart(2, '0')}.jpg`
  );
  const next = image.cloneNode(false);
  next.removeAttribute('data-hero-rotator');
  next.removeAttribute('src');
  next.classList.add('wey-hero-next');
  image.insertAdjacentElement('afterend', next);

  let frame = 0;
  image.src = frames[frame];
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const cycle = () => {
    const following = frames[(frame + 1) % frames.length];
    window.setTimeout(() => {
      const preload = new Image();
      const show = () => {
        next.src = following;
        requestAnimationFrame(() => next.classList.add('is-visible'));
        window.setTimeout(() => {
          image.src = following;
          frame = (frame + 1) % frames.length;
          next.classList.remove('is-visible');
          cycle();
        }, 1200);
      };
      preload.onload = show;
      preload.onerror = show;
      preload.src = following;
    }, 7000);
  };
  cycle();
})();
