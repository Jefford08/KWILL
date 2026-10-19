(function () {
  var bar = document.getElementById('nav-progress');
  if (!bar) return;

  var timer = null;
  var progress = 0;

  function start() {
    if (timer) return;
    progress = 0.08;
    bar.classList.add('active');
    bar.style.transform = 'scaleX(' + progress + ')';
    timer = setInterval(function () {
      progress += (0.9 - progress) * 0.08;
      bar.style.transform = 'scaleX(' + progress + ')';
    }, 120);
  }

  function reset() {
    clearInterval(timer);
    timer = null;
    bar.classList.remove('active');
    bar.style.transform = 'scaleX(0)';
    document.querySelectorAll('.btn.is-loading').forEach(function (b) {
      b.classList.remove('is-loading');
      b.disabled = false;
    });
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target.closest('a[href]');
    if (!link || link.hasAttribute('data-no-loading') || link.hasAttribute('download')) return;
    if (link.target && link.target !== '_self') return;
    var href = link.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|javascript:)/i.test(href)) return;
    if (link.origin !== window.location.origin) return;
    start();
  });

  document.addEventListener('submit', function (e) {
    if (e.defaultPrevented) return;
    var form = e.target;
    if (form.hasAttribute('data-no-loading') || (form.target && form.target !== '_self')) return;
    start();
    var button = e.submitter || form.querySelector('button[type="submit"], button:not([type])');
    if (button && button.classList.contains('btn')) {

      setTimeout(function () { button.classList.add('is-loading'); button.disabled = true; }, 0);
    }
  });

  window.addEventListener('pageshow', function (e) { if (e.persisted) reset(); });
})();
