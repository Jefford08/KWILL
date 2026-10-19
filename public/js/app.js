(function () {
  var sidebar = document.getElementById('sidebar');
  var backdrop = document.querySelector('.sidebar-backdrop');
  var openBtn = document.querySelector('[data-sidebar-open]');

  function setSidebar(open) {
    if (!sidebar) return;
    sidebar.classList.toggle('open', open);
    if (backdrop) backdrop.hidden = !open;
    if (openBtn) openBtn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('no-scroll', open);
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-sidebar-open]')) setSidebar(true);
    else if (e.target.closest('[data-sidebar-close]')) setSidebar(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setSidebar(false);
  });

  var EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-3.22 4.44M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';

  document.querySelectorAll('.password-toggle').forEach(function (b) { b.innerHTML = EYE; });
  document.addEventListener('click', function (e) {
    var button = e.target.closest('.password-toggle');
    if (!button) return;
    var input = document.getElementById(button.getAttribute('data-target'));
    if (!input) return;
    var show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.innerHTML = show ? EYE_OFF : EYE;
    button.setAttribute('aria-pressed', String(show));
    button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  var RULES = {
    length: function (pw) { return pw.length >= 8; },
    number: function (pw) { return /\d/.test(pw); },
    special: function (pw) { return /[^A-Za-z0-9\s]/.test(pw); },
  };

  document.querySelectorAll('[data-pw-meter]').forEach(function (meter) {
    var input = document.getElementById(meter.getAttribute('data-pw-meter'));
    if (!input) return;
    var label = meter.querySelector('[data-pw-label]');
    var form = input.form;
    var confirm = form && form.querySelector('[data-pw-confirm]');
    var hint = form && form.querySelector('[data-pw-confirm-hint]');

    function update() {
      var pw = input.value;
      var met = 0;
      Object.keys(RULES).forEach(function (key) {
        var ok = RULES[key](pw);
        if (ok) met += 1;
        var li = meter.querySelector('[data-rule="' + key + '"]');
        if (li) li.classList.toggle('met', ok);
      });
      var strong = met === 3;
      meter.setAttribute('data-score', pw ? String(met) : '0');
      meter.classList.toggle('strong', strong);
      label.textContent = pw ? (strong ? 'Strong' : 'Weak') : 'Weak';
      input.setCustomValidity(pw && !strong ? 'Your password must meet all the requirements below.' : '');
      checkConfirm();
    }

    function checkConfirm() {
      if (!confirm) return;
      var mismatch = confirm.value && confirm.value !== input.value;
      confirm.setCustomValidity(mismatch ? 'Passwords do not match.' : '');
      if (hint) hint.hidden = !mismatch;
    }

    input.addEventListener('input', update);
    if (confirm) confirm.addEventListener('input', checkConfirm);
    update();
  });

  var dialog = document.getElementById('confirm-dialog');

  function askConfirm(form) {
    return new Promise(function (resolve) {
      if (!dialog || typeof dialog.showModal !== 'function') {
        resolve(window.confirm(form.getAttribute('data-confirm')));
        return;
      }
      var tone = form.getAttribute('data-confirm-tone') || 'danger';
      var icon = form.getAttribute('data-confirm-icon') || 'trash';
      var ok = dialog.querySelector('[data-dialog-ok]');
      dialog.querySelector('#confirm-title').textContent = form.getAttribute('data-confirm-title') || 'Are you sure?';
      dialog.querySelector('#confirm-message').textContent = form.getAttribute('data-confirm');
      ok.textContent = form.getAttribute('data-confirm-ok') || 'Delete';
      ok.className = 'btn ' + (tone === 'primary' ? 'btn-primary' : 'btn-danger');
      dialog.setAttribute('data-tone', tone);
      dialog.querySelectorAll('[data-icon]').forEach(function (el) { el.hidden = el.getAttribute('data-icon') !== icon; });
      dialog.returnValue = '';
      dialog.addEventListener('close', function onClose() {
        dialog.removeEventListener('close', onClose);
        resolve(dialog.returnValue === 'ok');
      });
      dialog.showModal();
      dialog.querySelector('[data-dialog-cancel]').focus();
    });
  }

  if (dialog) {
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) dialog.close('cancel');
    });
  }

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.hasAttribute || !form.hasAttribute('data-confirm')) return;
    if (form.dataset.confirmed === '1') return;
    e.preventDefault();
    var submitter = e.submitter;
    askConfirm(form).then(function (confirmed) {
      if (!confirmed) return;
      form.dataset.confirmed = '1';
      var row = form.closest('tr');
      var go = function () {
        if (form.requestSubmit) form.requestSubmit(submitter && submitter.form === form ? submitter : undefined);
        else form.submit();
      };
      if (row) {
        row.classList.add('row-removing');
        setTimeout(go, 380);
      } else {
        go();
      }
    });
  }, true);

  document.querySelectorAll('.toast').forEach(function (toast) {
    var remaining = 4500; // keep in sync with the .toast-timer animation in style.css
    var started = Date.now();
    var timer;
    function dismiss() {
      clearTimeout(timer);
      toast.classList.add('leaving');
      setTimeout(function () { toast.remove(); }, 300);
    }
    function run() {
      started = Date.now();
      timer = setTimeout(dismiss, remaining);
    }
    toast.addEventListener('mouseenter', function () {
      clearTimeout(timer);
      remaining -= Date.now() - started;
      toast.classList.add('paused');
    });
    toast.addEventListener('mouseleave', function () {
      toast.classList.remove('paused');
      run();
    });
    toast.querySelector('[data-toast-close]').addEventListener('click', dismiss);
    requestAnimationFrame(function () { toast.classList.add('visible'); });
    run();

    var key = toast.getAttribute('data-highlight');
    var row = key && document.querySelector('[data-row-id="' + key.replace(/"/g, '') + '"]');
    if (row) {
      row.classList.add('row-saved');
      var rect = row.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(function () { row.classList.remove('row-saved'); }, 2600);
    }
  });

  document.querySelectorAll('[data-reveal-on-change]').forEach(function (input) {
    var box = document.getElementById(input.getAttribute('data-reveal-on-change'));
    if (!box) return;
    var required = box.querySelector('input');
    function sync() {
      var changed = input.value.trim().toLowerCase() !== (input.getAttribute('data-original') || '').toLowerCase();
      box.hidden = !changed;
      if (required) required.required = changed;
    }
    input.addEventListener('input', sync);
    sync();
  });

  document.querySelectorAll('input[data-code-input]').forEach(function (input) {
    input.addEventListener('input', function () {
      input.value = input.value.replace(/\D/g, '').slice(0, 6);
    });
  });

  document.querySelectorAll('[data-cooldown]').forEach(function (button) {
    var left = parseInt(button.getAttribute('data-cooldown'), 10) || 0;
    var original = button.textContent;
    function tick() {
      if (left <= 0) { button.disabled = false; button.textContent = original; return; }
      button.disabled = true;
      button.textContent = original + ' (' + left + 's)';
      left -= 1;
      setTimeout(tick, 1000);
    }
    tick();
  });
})();
