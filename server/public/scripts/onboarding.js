document.body.addEventListener('change', function(e) {
  if (e.target.name !== 'pilot-type') {
    return;
  }
  // Show the correct header for legal entity information.
  document.querySelector('.type-header.is-visible').classList.toggle('is-visible');
  document.querySelector(`.type-header.${e.target.value}-info`).classList.add('is-visible');

  // Show any fields that apply to the new pilot type.
  Array.prototype.slice.call(
    document.querySelectorAll('.pilot-info')
  ).forEach(function(elem) {
    elem.classList.toggle(
      'is-visible',
      elem.classList.contains(`${e.target.value}-type`)
    );
  });
});
