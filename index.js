const express = require('express');
const bodyParser = require("body-parser");
const Rx = require("rxjs/Rx");
const cors = require('cors')
const path = require('path')
const littlebits = require('@littlebits/cloud-http')

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

function sendOutput(percent = 100, duration_ms = -1) {
  let deviceIds = Object.keys(deviceList)
  let num = 0
  const next = () => {
    let currentDeviceId = deviceIds[num]
    if (!currentDeviceId) {
      return
    }

    let outputFn = littlebits
      .defaults({ access_token: deviceList[currentDeviceId].access_token })
      .output.defaults({
          device_id: currentDeviceId,
          percent,
          duration_ms
      })
    
    outputFn((err, res) => {
      if (err) {
        console.log(`error sending output to ${currentDeviceId}`, deviceList[currentDeviceId].access_token, err)
        console.log(deviceList)
      } else {
        console.log(`successfully sent ${percent} output to ${currentDeviceId}`)
      }
      num++
      setTimeout(next, 500)
    })
  }
  next()
}

app.post('/turnon', function (req, res) {
  sendOutput()
  res.sendStatus(200)
})

app.post('/turnoff', function (req, res) {
  sendOutput(0)
  res.sendStatus(200)
})

const data$ = new Rx.Subject()
app.post('/message', function (req, res) {
  if (!deviceList[req.body.bit_id]) {
    console.log('device '+ req.body.bit_id + ' not in the deviceList')
    res.sendStatus(403)
    return
  }
  state[req.body.bit_id] = req.body
  data$.next(state)
  res.sendStatus(200)
})

app.get('/forcevalue/:bit_id/:value_id', function (req, res) {
  var num = parseInt(req.params.value_id, 10)
  if (!num) {
    res.send('invalid value. not a number.')
    return
  }

  var forced = {
    "type":"amplitude",
    "timestamp":1491892973539,
    "user_id":1,
    "bit_id":req.params.bit_id,
    "payload":{
      "percent":num,
      "delta":"amplitude"
    }
  }

  if (!deviceList[forced.bit_id]) {
    res.send('device '+ forced.bit_id + ' not in the deviceList')
    return
  }

  state[forced.bit_id] = forced
  data$.next(state)
  res.send('value forced successfully')
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

app.get('/devicestatus', function (req, res) {
  let statusMessage = ''

  Object.keys(deviceList).forEach(deviceId => {
    let inState = (state[deviceId]) ? 'OK' : 'NOT PINGING'
    statusMessage += '\n'
    statusMessage += deviceId + ': ' + inState
  })
  res.send(statusMessage)
})

app.get('/devicelist', function (req, res) {
  let filteredList = {}
  Object.keys(deviceList).forEach(deviceId => {
    filteredList[deviceId] = Object.assign({}, deviceList[deviceId])
    delete filteredList[deviceId].access_token
  })
  res.send(JSON.stringify(filteredList))
})

app.use('/', express.static(path.join(__dirname, 'lb-client/build')))
app.use('/admin', express.static(path.join(__dirname, 'lb-admin/build')))

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