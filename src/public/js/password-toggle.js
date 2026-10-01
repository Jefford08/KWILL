(function () {
  var EYE_ICON =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path>' +
    '<circle cx="12" cy="12" r="3"></circle></svg>';

  var EYE_OFF_ICON =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-3.22 4.44M14.12 14.12a3 3 0 1 1-4.24-4.24"></path>' +
    '<line x1="1" y1="1" x2="23" y2="23"></line></svg>';

  function setIcon(button, isVisible) {
    button.innerHTML = isVisible ? EYE_OFF_ICON : EYE_ICON;
  }

  document.querySelectorAll('.password-toggle').forEach(function (button) {
    setIcon(button, false);
  });

  document.addEventListener('click', function (event) {
    var button = event.target.closest('.password-toggle');
    if (!button) return;

    var input = document.getElementById(button.getAttribute('data-target'));
    if (!input) return;

    var isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    setIcon(button, isHidden);
    button.setAttribute('aria-pressed', String(isHidden));
    button.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
  });
})();
