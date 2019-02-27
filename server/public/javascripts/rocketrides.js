// Small script to handle selection of the pilot legal entity.

document.body.addEventListener('change', function(e) {
  if (e.target.name !== 'pilot-type') {
    return;
  }

  // Show the correct header for the select legal entity.
  var headerPrefix = (e.target.value === 'individual') ? 'Personal' : 'Company';
  document.querySelector('.pilot-header#account-info').innerText = `${headerPrefix} information`;

  // Show any fields that apply to the new pilot type.
  var pilotInfoRows = document.querySelectorAll('.pilot-info');
  pilotInfoRows.forEach(function(row) {
    row.classList.toggle('hidden', !row.classList.contains(e.target.value));
  });
});

document.querySelector('.annotation.simulate .dashboard-banner button.next').addEventListener('click', function(e) {
  document.querySelector('.annotation.simulate .dashboard-banner').addClass('visible')
  document.querySelector('.annotation.simulate .last-step').addClass('visible')
});