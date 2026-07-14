(() => {
  const menu = document.querySelector('.menu');
  const nav = document.querySelector('.main-nav');
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!open));
    nav?.classList.toggle('is-open', !open);
  });
  document.querySelector('form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const field = event.currentTarget.querySelector('input');
    if (field?.value) field.placeholder = 'Merci — l’inscription sera ouverte avec le lancement éditorial.';
  });
})();
