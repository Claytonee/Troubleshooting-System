/**
 * Modal Component
 */
const Modal = (() => {
  function open(title, bodyHtml, footerHtml, wide) {
    $('modal-title').textContent = title;
    $('modal-body').innerHTML = bodyHtml;
    $('modal-footer').innerHTML = footerHtml;
    const box = $('modal-box');
    box.classList.toggle('wide', !!wide);
    box.classList.remove('preview');
    $('modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    $('modal').classList.remove('open');
    document.body.style.overflow = '';
  }

  function init() {
    const overlay = $('modal');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });
  }

  return { open, close, init };
})();
