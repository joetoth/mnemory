chrome.runtime.sendMessage('ready', function (task) {
  document.getElementById('title').textContent = task[0]
  let recall = document.getElementById('recall')
  let notes = document.getElementById('notes')
  let button = document.getElementById('reveal')

  notes.textContent = task[1]

  function removeText() {
    recall.textContent = ''
    recall.removeEventListener('click', removeText)
  }
  recall.addEventListener('click', removeText)


  function submit() {
    if (button.textContent === "Close") {
      chrome.tabs.query({ active: true }, function (tabs) {
        chrome.tabs.remove(tabs[0].id);
      });
    }

    recall.setAttribute('contenteditable', false)
    notes.classList.toggle('hidden')

    chrome.runtime.sendMessage(
      recall.textContent, () => {
        button.classList.toggle('close')
        button.textContent = "Close"
      })
  }

  button.addEventListener('click', submit);
});


