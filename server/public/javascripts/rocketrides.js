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

// Enable sequence of annotation cards on the Dashboard
document.querySelector('.annotation.dashboard-banner button.next').addEventListener('click', function(e) {
  e.preventDefault();
  document.querySelector('.annotation.dashboard-banner').classList.toggle('hidden');
  document.querySelector('.annotation.dashboard-simulate').classList.toggle('hidden');
});

// In mobile / responsive mode, toggle showing details on annotation cards
document.querySelectorAll('.annotation.card').forEach(function(card) {
  card.querySelector('h4').addEventListener('click', function(e) {
    card.querySelector('.description').classList.toggle('expanded');
  });
});