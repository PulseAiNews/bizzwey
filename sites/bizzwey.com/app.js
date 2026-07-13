(() => {
  "use strict";

  const translations = window.BIZZWey_TRANSLATIONS || {};
  const languageSelect = document.querySelector("#language-select");
  const languageMeta = {
    en: { dir: "ltr", locale: "en_US" }, fr: { dir: "ltr", locale: "fr_FR" },
    es: { dir: "ltr", locale: "es_ES" }, de: { dir: "ltr", locale: "de_DE" },
    it: { dir: "ltr", locale: "it_IT" }, pt: { dir: "ltr", locale: "pt_PT" },
    nl: { dir: "ltr", locale: "nl_NL" }, pl: { dir: "ltr", locale: "pl_PL" },
    tr: { dir: "ltr", locale: "tr_TR" }, ar: { dir: "rtl", locale: "ar_AE" },
    zh: { dir: "ltr", locale: "zh_CN" }, ja: { dir: "ltr", locale: "ja_JP" },
    ko: { dir: "ltr", locale: "ko_KR" }, hi: { dir: "ltr", locale: "hi_IN" },
    id: { dir: "ltr", locale: "id_ID" }, ru: { dir: "ltr", locale: "ru_RU" }
  };

  const translatableNodes = [...document.querySelectorAll("[data-i18n]")];

  function setMetaContent(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.setAttribute("content", value);
  }

  function translatePage(language) {
    const locale = translations[language] ? language : "en";
    const copy = translations[locale];
    const meta = languageMeta[locale] || languageMeta.en;

    translatableNodes.forEach((node) => {
      const key = node.dataset.i18n;
      const value = copy[key] ?? translations.en[key];
      if (typeof value === "string") node.innerHTML = value;
    });

    document.documentElement.lang = locale;
    document.documentElement.dir = meta.dir;
    document.title = `BizzWey — ${copy.heroTitlePlain}`;
    setMetaContent('meta[name="description"]', copy.heroLead);
    setMetaContent('meta[property="og:title"]', `BizzWey — ${copy.heroTitlePlain}`);
    setMetaContent('meta[property="og:description"]', copy.heroLead);
    setMetaContent('meta[property="og:locale"]', meta.locale);

    if (languageSelect) languageSelect.value = locale;
    try { localStorage.setItem("bizzwey-language", locale); } catch (_) { /* storage is optional */ }
  }

  function initialLanguage() {
    // BizzWey always opens in English. The selector remains available for the
    // current visit without allowing an earlier browser choice to override it.
    return "en";
  }

  languageSelect?.addEventListener("change", (event) => translatePage(event.target.value));
  translatePage(initialLanguage());

  const header = document.querySelector(".site-header");
  const updateHeader = () => header?.classList.toggle("scrolled", window.scrollY > 24);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  const menuButton = document.querySelector(".menu-toggle");
  const mobileNav = document.querySelector("#mobile-nav");

  function closeMenu() {
    if (!menuButton || !mobileNav) return;
    menuButton.setAttribute("aria-expanded", "false");
    mobileNav.hidden = true;
    document.body.classList.remove("menu-open");
  }

  menuButton?.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    if (mobileNav) mobileNav.hidden = isOpen;
    document.body.classList.toggle("menu-open", !isOpen);
  });

  mobileNav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  window.addEventListener("resize", () => {
    if (window.innerWidth > 1080) closeMenu();
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("js-ready");
  const revealNodes = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealNodes.forEach((node) => node.classList.add("visible"));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });
    revealNodes.forEach((node) => revealObserver.observe(node));
  }

  const orbitalStage = document.querySelector("#orbital-stage");
  if (orbitalStage && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    orbitalStage.addEventListener("pointermove", (event) => {
      const bounds = orbitalStage.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 10;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 10;
      orbitalStage.style.transform = `perspective(900px) rotateX(${-y}deg) rotateY(${x}deg)`;
    });
    orbitalStage.addEventListener("pointerleave", () => {
      orbitalStage.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
    });
  }

  // Each portfolio card has its own set of twelve real photographs. The
  // browser picks a different file every three seconds and never immediately
  // repeats the current image.
  const portfolioCards = [...document.querySelectorAll(".all-brands > a")];
  const portfolioVariants = 12;
  function setPortfolioPhoto(card, cardNumber) {
    const previous = Number(card.dataset.photoVariant ?? -1);
    let next = Math.floor(Math.random() * portfolioVariants);
    if (portfolioVariants > 1 && next === previous) next = (next + 1) % portfolioVariants;
    card.dataset.photoVariant = String(next);

    const photo = document.createElement("i");
    photo.className = "brand-photo";
    photo.setAttribute("aria-hidden", "true");
    const folder = String(cardNumber).padStart(2, "0");
    const filename = String(next).padStart(2, "0");
    photo.style.backgroundImage = `url("assets/portfolio/${folder}/v-${filename}.jpg")`;
    card.append(photo);
    requestAnimationFrame(() => photo.classList.add("is-visible"));
    const previousPhoto = card.querySelector(".brand-photo.is-visible:not(:last-child)");
    if (previousPhoto) {
      previousPhoto.classList.remove("is-visible");
      window.setTimeout(() => previousPhoto.remove(), 720);
    }
  }

  portfolioCards.forEach((card, index) => {
    const cardNumber = index + 1;
    setPortfolioPhoto(card, cardNumber);
    if (!reduceMotion) {
      // Stagger only the start. Once running, every photograph remains on
      // screen for exactly three seconds.
      window.setTimeout(() => {
        setPortfolioPhoto(card, cardNumber);
        window.setInterval(() => setPortfolioPhoto(card, cardNumber), 3000);
      }, 260 + index * 83);
    }
  });

})();
