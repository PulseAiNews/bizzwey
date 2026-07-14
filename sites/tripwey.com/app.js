document.querySelectorAll('a[href="#"]').forEach(a=>a.addEventListener('click',e=>e.preventDefault()));
document.querySelector('.hamburger')?.addEventListener('click',()=>document.querySelector('.site-header').classList.toggle('open'));
