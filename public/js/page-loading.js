(function () {
  var overlay = document.getElementById('page-loading');
  if (!overlay) return;

  var showTimer = null;
  var safetyTimer = null;

  function show() {
    // Small delay so a fast response doesn't just flash the overlay.
    showTimer = setTimeout(function () {
      overlay.classList.add('visible');
      overlay.setAttribute('aria-hidden', 'false');
    }, 150);
    // In case navigation never completes (e.g. the request errors without
    // reloading the page), don't leave the overlay stuck forever.
    safetyTimer = setTimeout(hide, 60000);
  }

  function hide() {
    clearTimeout(showTimer);
    clearTimeout(safetyTimer);
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
  }

  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    var link = event.target.closest('a[href]');
    if (!link) return;
    if (link.hasAttribute('data-no-loading') || link.hasAttribute('download')) return;
    if (link.target && link.target !== '' && link.target !== '_self') return;

    var href = link.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return;
    if (link.origin !== window.location.origin) return;

    show();
  });

  document.addEventListener('submit', function (event) {
    if (event.defaultPrevented) return;
    var form = event.target;
    if (form.hasAttribute('data-no-loading')) return;
    if (form.target && form.target !== '' && form.target !== '_self') return;
    show();
  });

  // Page restored from the browser's back/forward cache never re-runs this
  // script's initial state, so make sure a lingering overlay clears.
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) hide();
  });
})();
