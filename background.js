const CLIENT_ID = "724252874593-5rf8icr8ctkcouecvkc30cr9h6vcnphs.apps.googleusercontent.com";
const DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4"];
var SCOPES = 'https://www.googleapis.com/auth/spreadsheets'

class Flash {

  async getOptions() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get({
        spreadsheetId: '',
        interval: 60 * 15
      }, function (items) {
        resolve(items)
      });
    });
  }

  async setOptions(options) {
    let isValid = await this.checkSpreadsheetId(options.spreadsheetId)
    console.log('valid', isValid);
    return new Promise((resolve, reject) => {
      if (isValid) {
        chrome.storage.sync.set(options, function (x) {
          resolve('Saved')
        });
      } else {
        resolve("Invalid Spreadsheet Id")
      }
    });

  }

  async checkSpreadsheetId(id) {
    await this.updateAuthToken()
    return new Promise((resolve, reject) => {
      gapi.client.sheets.spreadsheets.get({
        "spreadsheetId": id
      })
        .then(function (response) {
          // Handle the results here (response.result has the parsed body).
          console.log("Response", response);
          resolve(true)
        }, function (err) {
          console.error("Execute error", err);
          resolve(false)
        });
    })
  }

  async changeConcept() {
    let response = await this.getValues('A1:C10000')
    console.log(response)
    let cells = response.result.values
    this.row_num = 0
    let cells_copy = [...cells]
    cells.sort((a, b) => {

      let aRecalls = 0
      let bRecalls = 0

      if (a.length === 3) {
        let json = JSON.parse(a[2])
        aRecalls = json.recalls.length
      }

      if (b.length === 3) {
        let json = JSON.parse(b[2])
        bRecalls = json.recalls.length
      }

      return aRecalls - bRecalls
    })
    console.log("cells", cells)
    this.row = cells[0]
    console.log('selected row ', this.row)
    this.row_num = cells_copy.indexOf(cells[0]) + 1
    console.log('selected row_num', this.row_num)
  }

  openRecallTab() {
    return new Promise((resolve, reject) => {
      chrome.tabs.create({ url: 'input.html' }, (response) => {
        resolve(response)
      })
    });
  }

  notify() {
    console.log("nn")
    console.log(this.row[0])
    chrome.notifications.create('a', {
      title: 'Rekall',
      message: this.row[0],
      iconUrl: '/rekall.png',
      type: 'basic',
      requireInteraction: true,
    });
  }

  async notifyNext() {
    if (!this.inProgress) {
      await this.changeConcept()
      await this.notify()
      this.inProgress = true
    }

    setTimeout(async () => {
      this.notifyNext()
    }, this.interval)
  }

  async updateAuthToken() {
    let token = await this.getAuthToken()
    const tokenObj = {
      'access_token': token,
    };
    gapi.client.setToken(tokenObj);
    gapi.auth.setToken(tokenObj);
  }

  async getAuthToken() {
    // The Identity API caches access tokens in memory, so it's ok to call
    // getAuthToken non-interactively any time a token is required. The token
    // cache automatically handles expiration.
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (x) => {
        console.log(x)
        resolve(x);
      });
    });
  }

  async addRecall(recall_text) {
    var json
    if (this.row.length === 3) {
      json = JSON.parse(this.row[2])
    } else if (this.row.length === 2) {
      json = {
        recalls: []
      }
      this.row.push()
    } else {
      console.error("spreadsheet row invalid: ", this.row)
    }

    let recall = { text: recall_text, created_timestamp: Date.now() }
    json.recalls.push(recall)

    let up = {
      "values": [
        [JSON.stringify(json)]
      ]
    }

    var params = {
      spreadsheetId: this.spreadsheetId,
      range: 'C' + this.row_num,
      valueInputOption: 'RAW'
    };
    console.log('Updating cell', params);

    await this.updateAuthToken()
    return new Promise((resolve, reject) => {
      var request = gapi.client.sheets.spreadsheets.values.update(params, up);
      request.then(function (response) {
        resolve(response)
      }, function (reason) {
        console.error('error: ' + reason.result.error.message);
        reject(response.result.error)
      });
    })
  }

  async getValues(range) {
    var params = {
      spreadsheetId: this.spreadsheetId,
      range: range
    };
    console.log('getValues', params);

    await this.updateAuthToken()
    return new Promise((resolve, reject) => {
      var request = gapi.client.sheets.spreadsheets.values.get(params);
      request.then(function (response) {
        resolve(response)
      }, function (reason) {
        console.error('error: ' + reason.result.error.message);
        reject(response.result.error)
      });
    });
  }


  async start() {
    await this.updateAuthToken()
    await this.init()
    let options = await this.getOptions()

    // If spreadsheet is not set show options
    this.spreadsheetId = options.spreadsheetId
    this.interval = options.interval * 1000
    console.log('interval in ms', this.interval)

    chrome.notifications.onClicked.addListener((notificationId) => {
      console.log('notify clicked')
      this.openRecallTab().then((tab) => {
        console.log('tab', tab)
        this.tab = tab
        chrome.notifications.clear(notificationId)
        chrome.windows.update(tab.windowId, { focused: true })
      })
    })

    chrome.notifications.onClosed.addListener((notificationId, byUser) => {
      console.log('notification closed')
      this.inProgress = false
    })

    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
      console.log('tabId closed', tabId)
      console.log('last opened tab', this.tab)
      if (this.tab != null && this.tab.id === tabId) {
        console.log('tab was our input')
        this.inProgress = false
        this.tab = null
      }
    })

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request === 'ready') {
        console.log('input ready', this.row);
        sendResponse(this.row)
      } else {
        console.log('update=', request);
        this.addRecall(request)
        sendResponse()
      }
    });

    // Run at start
    await this.notifyNext()
  }

  async init() {
    return new Promise((resolve, reject) => {
      gapi.client.init({
        // Don't pass client nor scope as these will init auth2, which we don't want
        // clientId: CLIENT_ID,
        // scope: SCOPES,
        discoveryDocs: DISCOVERY_DOCS,
      }).then(function (x) {
        console.log('gapi init success');
        resolve();
      })
    });
  }

}

var f = new Flash()

async function onGAPILoad() {
  console.log('gapi loaded');
  await f.start()
}
