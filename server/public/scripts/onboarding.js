document.body.addEventListener('change', function(e) {
  if (e.target.name !== 'pilot-type') {
    return;
  }
  document.querySelector('.type-header.is-visible').classList.toggle('is-visible');
  document.querySelector(`.type-header.${e.target.value}-info`).classList.add('is-visible');

  Array.prototype.slice.call(document.querySelectorAll('.pilot-info')).forEach(function(elem) {
    elem.classList.remove('is-visible');
  });
  Array.prototype.slice.call(document.querySelectorAll(`.pilot-info.${e.target.value}-type`)).forEach(function(elem) {
    elem.classList.add('is-visible');
  });
});
