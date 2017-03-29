const express = require('express');
const bodyParser = require("body-parser");
const Rx = require("rxjs/Rx");
var cors = require('cors')

const app = express();
var http = require('http').Server(app);

app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const io = require('socket.io')(http);

const state = {
  // device_id: payload
}

const data$ = new Rx.Subject()
app.post('/message', function (req, res) {
  state[req.body.bit_id] = req.body
  data$.next(state)
})

app.get('/status', function (req, res) {
  res.send(JSON.stringify(state))
})


io.on('connection', function(socket){
  data$
    .sample(Rx.Observable.interval(10000))
    .subscribe(function(state) {
      socket.emit('state', state);
      /*console.log(state)
      wss.broadcast = function broadcast(state) {
        wss.clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(state);
          }
        });
      };*/
    })
})

http.listen(8000, function listening() {
  console.log('Listening on 8000');
})