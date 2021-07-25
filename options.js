// Saves options to chrome.storage
async function save_options() {
  var spreadsheetId = document.getElementById('spreadsheetId').value;
  var interval = document.getElementById('interval').value;

  var bkg = chrome.extension.getBackgroundPage();
  let result = await bkg.f.setOptions({
    "spreadsheetId": spreadsheetId,
    "interval": interval
  })

  document.getElementById('status').textContent = result
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
async function restore_options() {
  var bkg = chrome.extension.getBackgroundPage();
  options = await bkg.f.getOptions()
  console.log(options);
  document.getElementById('spreadsheetId').value = options.spreadsheetId;
  document.getElementById('interval').value = options.interval;
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
