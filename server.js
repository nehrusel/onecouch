const bodyParser = require('body-parser'),
     cors = require('cors'),
     express = require('express'),
     shortid = require('shortid'),
     Cache = require('lru-cache-node');

var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

app.use(bodyParser.json());
app.use(cors());

// Static file serving
app.use('/', express.static(__dirname + '/public'));
app.use('/static', express.static(__dirname + '/public'));

app.post('/createRoom', function(req, res) {
  var roomId = shortid.generate();
  res.end('/rm/' + roomId);
});

app.get('/rm/:roomId', function(req, res) {
  res.sendFile(__dirname + '/public/room.html' );
});


var cache = new Cache(64000);



// Socket communication
var events = {
  // CLIENT EMITTED
  REQUEST_TO_JOIN_ROOM : 'REQUEST_TO_JOIN_ROOM',
  SET_VIDEO_URL : 'SET_VIDEO_URL',
  SET_VIDEO_TIME : 'SET_VIDEO_TIME',
  SET_PLAYING : 'SET_PLAYING',
  REQUEST_SYNC_TIME : 'REQUEST_SYNC_TIME',
  RESPONSE_SYNC_TIME : 'RESPONSE_SYNC_TIME',
  WEBRTC_SEND_SIGNAL : 'WEBRTC_SEND_SIGNAL',
  ICE_CANDIDATE : 'ICE_CANDIDATE',

  // SERVER EMITTED
  INITIAL_ROOM_STATE : 'INITIAL_ROOM_STATE',
  USER_JOINED_ROOM : 'USER_JOINED_ROOM',
  USER_LEFT_ROOM : 'USER_LEFT_ROOM',
  USER_LEFT_ROOM : 'USER_LEFT_ROOM',
  SYNC_VIDEO_URL : 'SYNC_VIDEO_URL',
  SYNC_VIDEO_TIME : 'SYNC_VIDEO_TIME',
  SYNC_PLAYING : 'SYNC_PLAYING',
  FWD_REQUEST_SYNC_TIME : 'FWD_REQUEST_SYNC_TIME',
  FWD_RESPONSE_SYNC_TIME : 'FWD_RESPONSE_SYNC_TIME',
  WEBRTC_FWD_SEND_SIGNAL : 'WEBRTC_FWD_SEND_SIGNAL',
  WEBRTC_FWD_ICE_CANDIDATE : 'FWD_ICE_CANDIDATE',
};

const socketMeta = {};

function roomEmit(roomId, e, data, except) {
  if (!cache.contains(roomId)) { return; }
  const roomState = cache.get(roomId);
  roomState.members.forEach(sockId => {
    if (sockId == except) return;
    const meta = socketMeta[sockId];
    if (!meta) return;
    meta.socket.emit(e, data);
  });
}

function receiverEmit(sockId, e, data) {
  const receiver = socketMeta[sockId];
  if (!receiver) { return; }
  receiver.socket.emit(e, data);
}

io.on('connection', function(socket) {
  socketMeta[socket.id] = { socket: socket, roomId : '' };

  // io.emit(events.USER_JOINED_ROOM, { socketId : socket.id }); // TODO: remove once rooms working

  socket.on(events.REQUEST_TO_JOIN_ROOM, function(data) {
    const roomId = data.roomId;
    if (cache.contains(roomId)) {
      const roomState = cache.get(roomId);
      roomState.members.push(socket.id);
      socket.emit(events.INITIAL_ROOM_STATE, roomState);
    } else { // Create the room
      cache.set(roomId,
        { playing : false,
          videoUrl : null,
          initialized : false,
          members : [ socket.id ]
      });
    }

    socketMeta[socket.id].roomId = data.roomId;
  });


  socket.on(events.SET_VIDEO_URL, function(data) {
    if (!cache.contains(data.roomId)) { return; }
    const roomState = cache.get(data.roomId);
    roomState.videoUrl = data.url;
    roomEmit(data.roomId, events.SYNC_VIDEO_URL, { url : data.url });
  });

  socket.on(events.SET_VIDEO_TIME, function(data) {
    if (!cache.contains(data.roomId)) { return; }
    const roomState = cache.get(data.roomId);

    // For syncing people who join this room in the future.
    roomState.initialized = true;

    // Maybe include a video url hash here to prevent ordering problems?
    roomEmit(data.roomId, events.SYNC_VIDEO_TIME, data);
  });

  socket.on(events.SET_PLAYING, function(data) {
    if (!cache.contains(data.roomId)) { return; }
    const roomState = cache.get(data.roomId);
    
    roomState.initialized = true;
    roomState.playing = data.playing;

    roomEmit(data.roomId, events.SYNC_PLAYING, data);
  });

  socket.on(events.REQUEST_SYNC_TIME, function(data) {
    if (!cache.contains(data.roomId)) { return; }
    roomEmit(data.roomId, events.FWD_REQUEST_SYNC_TIME, { requester : socket.id }, socket.id);
  });

  socket.on(events.RESPONSE_SYNC_TIME, function(data) {
    if (!cache.contains(data.roomId)) { return; }
    receiverEmit(data.requester, events.FWD_RESPONSE_SYNC_TIME, data);
  });

  socket.on(events.WEBRTC_SEND_SIGNAL, function(data) {
    receiverEmit(data.receiverId, events.WEBRTC_FWD_SEND_SIGNAL, data);
  });

  socket.on(events.ICE_CANDIDATE, function(data) {
    receiverEmit(data.receiverId, events.WEBRTC_FWD_ICE_CANDIDATE, data);
  });

  socket.on('disconnect', function() {
    const meta = socketMeta[socket.id];
    if (!meta) { return; }
    delete socketMeta[socket.id];

    if (!cache.contains(meta.roomId)) { return; }
    const roomState = cache.get(meta.roomId);
    
    const i = roomState.members.indexOf(socket.id);
    if (i > -1) {
      roomState.members.splice(i, 1);
    }
    
    roomEmit(meta.roomId, events.USER_LEFT_ROOM, { socketId : socket.id });
  });

});

var port = 3000;
server.listen(port, function() { console.log("Listening on " + port); });
