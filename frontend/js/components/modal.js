/**
 * Modal Component
 */
const Modal = (() => {
  let locked = false; // when true the modal cannot be dismissed (forced flows)

  function open(title, bodyHtml, footerHtml, wide) {
    $('modal-title').textContent = title;
    $('modal-body').innerHTML = bodyHtml;
    $('modal-footer').innerHTML = footerHtml;
    const box = $('modal-box');
    box.classList.toggle('wide', !!wide);
    box.classList.remove('preview');
    $('modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    // Change-password and registration modals carry password fields; give each
    // one its reveal button here rather than asking every caller to remember.
    if (typeof PasswordField !== 'undefined') PasswordField.enhanceAll($('modal-body'));
  }

  // Lock/unlock lets callers (e.g. a forced password change) prevent the user
  // from closing the modal via Escape, overlay click, or a Cancel button.
  function lock() { locked = true; }
  function unlock() { locked = false; }

  function close() {
    if (locked) return;
    $('modal').classList.remove('open');
    document.body.style.overflow = '';
  }

  function init() {
    const overlay = $('modal');
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) overlay._clickedOverlay = true;
    });
    overlay.addEventListener('mouseup', (e) => {
      if (e.target === overlay && overlay._clickedOverlay) close();
      overlay._clickedOverlay = false;
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });
  }

  return { open, close, init, lock, unlock };
})();
