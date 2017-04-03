const express = require('express');
const bodyParser = require("body-parser");
const Rx = require("rxjs/Rx");
const cors = require('cors')
const path = require('path')

const app = express();
const http = require('http').Server(app);

app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const io = require('socket.io')(http);
const md5Pass = '98c04d88b2886a3ec57a0fb92619d444'
const md5 = require('blueimp-md5')
const fs = require('fs')

let state = {
  // device_id: payload
}
let deviceList = {
  // device_id: {
  //   device_id: 
  //   access_token 
  // }
}

try {
  deviceList = JSON.parse(fs.readFileSync("./saved_device_list", 'utf8'))
} catch (e) {
  console.log('error parsing saved file')
  deviceList = {}
}

const data$ = new Rx.Subject()
app.post('/message', function (req, res) {
  if (!deviceList[req.body.bit_id]) {
    res.sendStatus(403)
    return
  }
  state[req.body.bit_id] = req.body
  data$.next(state)
  res.sendStatus(200)
})

app.post('/devicelist', function (req, res) {
  if (md5(req.body.password) !== md5Pass) {
    res.sendStatus(403)
    return
  }

  let deviceListTest = {}

  req.body.device_list.map(device => {
    deviceListTest[device.device_id] = device
  })

  try {
    let deviceListStr = JSON.stringify(deviceListTest)
    fs.writeFileSync("./saved_device_list", deviceListStr)
  } catch (e) {
    res.sendStatus(500)
    return
  }

  deviceList = deviceListTest
  state = {}

  res.sendStatus(200)
})

app.get('/status', function (req, res) {
  res.send(JSON.stringify(state))
})

app.get('/devicelist', function (req, res) {
  let filteredList = {}
  Object.keys(deviceList).forEach(deviceId => {
    filteredList[deviceId] = deviceList[deviceId]
    delete filteredList[deviceId].access_token
  })
  res.send(JSON.stringify(filteredList))
})

app.use('/', express.static(path.join(__dirname, 'lb-client/build')))

io.on('connection', function(socket){
  data$
    .sample(Rx.Observable.interval(10000))
    .subscribe(function(state) {
      socket.emit('state', state);
    })
})

http.listen(80, function listening() {
  console.log('Listening on 80');
})