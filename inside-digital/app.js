/* Inside Digital — progressive enhancement; no external tracking or account collection. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  const navToggle = $('#nav-toggle');
  const nav = $('#primary-nav');
  const closeNav = (restoreFocus = false) => {
    const wasOpen = nav?.classList.contains('is-open');
    nav?.classList.remove('is-open');
    navToggle?.setAttribute('aria-expanded', 'false');
    navToggle?.setAttribute('aria-label', 'Open navigation');
    if (wasOpen && restoreFocus) navToggle?.focus();
  };
  navToggle?.addEventListener('click', () => {
    const opened = nav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(opened));
    navToggle.setAttribute('aria-label', opened ? 'Close navigation' : 'Open navigation');
  });
  $$('#primary-nav a').forEach(link => link.addEventListener('click', () => closeNav()));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeNav(true);
  });
  document.addEventListener('pointerdown', (event) => {
    if (nav?.classList.contains('is-open') && !nav.contains(event.target) && !navToggle?.contains(event.target)) closeNav();
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 820) closeNav();
  });

  const cards = $$('.product-card');
  const filters = $$('.filter-button');
  const searchInput = $('#product-search');
  const filterStatus = $('#filter-status');
  const empty = $('#no-results');
  let selectedCategory = 'all';

  const updateResults = () => {
    const query = (searchInput?.value || '').trim().toLocaleLowerCase();
    let count = 0;
    cards.forEach(card => {
      const categoryMatch = selectedCategory === 'all' || card.dataset.category === selectedCategory;
      const searchMatch = !query || (card.dataset.search || '').toLocaleLowerCase().includes(query)
        || (card.textContent || '').toLocaleLowerCase().includes(query);
      const show = categoryMatch && searchMatch;
      card.hidden = !show;
      if (show) count += 1;
    });
    if (empty) empty.hidden = count !== 0;
    if (filterStatus) filterStatus.textContent = count === 1 ? '1 product found' : count + ' products found';
  };
  filters.forEach(button => button.addEventListener('click', () => {
    selectedCategory = button.dataset.filter || 'all';
    filters.forEach(item => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    updateResults();
  }));
  searchInput?.addEventListener('input', updateResults);
  $('#reset-filters')?.addEventListener('click', () => {
    selectedCategory = 'all';
    if (searchInput) searchInput.value = '';
    filters.forEach(button => {
      const active = button.dataset.filter === 'all';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    updateResults();
    searchInput?.focus();
  });
  $('#header-search')?.addEventListener('click', () => {
    $('#products')?.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    searchInput?.focus({preventScroll: true});
  });
  updateResults();

  // All product status text is deliberately descriptive rather than claiming a live app.
  const productInfo = {
    mauritius: {
      kicker: 'MEDIA & NEWS',
      name: 'Inside Mauritius',
      description: 'Local reporting and information made accessible on the Inside Mauritius website.',
      highlights: ['Mauritius headlines and community updates', 'Videos and news categories', 'A direct link to the live news website'],
      url: 'https://mr.insidemauritius.com/',
      linkText: 'Visit Inside Mauritius'
    },
    linkbook: {
      kicker: 'SOCIAL PROJECT',
      name: 'LinkBook',
      description: 'A social platform project focused on friendship, connection, sharing, and community interaction. Availability and features are not guaranteed by this showcase.',
      highlights: ['Community-oriented product direction', 'Profiles and sharing are part of the project vision', 'App-specific login and functionality belong in the app itself'],
      url: '#contact',
      linkText: 'Ask about LinkBook'
    },
    virelo: {
      kicker: 'CREATIVE PROJECT',
      name: 'Virelo',
      description: 'A creative short-video platform project built around personal expression and discovery. This portal does not provide video uploading or playback.',
      highlights: ['Short-form video and creativity', 'A product home for future launch information', 'Standalone app functionality would live in the app'],
      url: '#contact',
      linkText: 'Ask about Virelo'
    },
    hearts: {
      kicker: 'COMMUNITY PROJECT',
      name: 'Island Hearts',
      description: 'A concept for helping people make thoughtful, meaningful connections. This showcase does not collect personal profiles.',
      highlights: ['Thoughtful user experience', 'Privacy-first design principles', 'Separate registration and safety systems needed for a real service'],
      url: '#contact',
      linkText: 'Ask about Island Hearts'
    }
  };
  const dialog = $('#product-dialog');
  const title = $('#dialog-title');
  const kicker = $('#dialog-kicker');
  const desc = $('#dialog-desc');
  const list = $('#dialog-list');
  const cta = $('#dialog-cta');

  $$('[data-product]').forEach(trigger => trigger.addEventListener('click', () => {
    const item = productInfo[trigger.dataset.product];
    if (!item || !dialog || typeof dialog.showModal !== 'function') return;
    if (title) title.textContent = item.name;
    if (kicker) kicker.textContent = item.kicker;
    if (desc) desc.textContent = item.description;
    if (list) {
      list.replaceChildren();
      item.highlights.forEach(point => {
        const li = document.createElement('li');
        li.textContent = point;
        list.append(li);
      });
    }
    if (cta) {
      cta.href = item.url;
      cta.firstChild.textContent = item.linkText + ' ';
      if (item.url.startsWith('http')) {
        cta.target = '_blank';
        cta.rel = 'noopener noreferrer';
      } else {
        cta.removeAttribute('target');
        cta.removeAttribute('rel');
      }
    }
    dialog.showModal();
    document.body.classList.add('modal-open');
  }));
  $('#dialog-close')?.addEventListener('click', () => dialog?.close());
  dialog?.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog?.addEventListener('close', () => document.body.classList.remove('modal-open'));
  cta?.addEventListener('click', () => {
    if (cta.getAttribute('href')?.startsWith('#')) dialog?.close();
  });
})();
