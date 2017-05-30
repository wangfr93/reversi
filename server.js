/*******************************************/
/* Set up the static file server           */
/*******************************************/


/* Include a static file webserver library */
var static = require('node-static');

/* Include the http server library */
var http = require('http');

/* Assume that we are running on Heroku */
var port = process.env.PORT;
var directory = (__dirname + '/public');

// console.log('port:', port);
// console.log('!port:', !port);

/* If we aren't on Heroku, then we need to readjust the port and directory 
 * information and we know that because port won't be set */
if (typeof port == 'undefined' || !port) {
	directory = './public';
	port = 8080;
}

/* Set up a static webserver that will deliver files from the filesystem */
var file = new static.Server(directory);

/* Construct an http server that gets files from the file server */
var app = http.createServer(
	function(request, response) {
		request.addListener('end', 
			function() {
				file.serve(request, response);
			}
		).resume();
	}
).listen(port);

console.log('The server is running');

/*
var portType = typeof port;
console.log('portType:', portType);
var typeTestBool = typeof portType; 
console.log('typeTestBool:', typeTestBool);
console.log('port:', port);
var portOption = (port || 80);
console.log('portOption:', portOption);
*/


/*******************************************/
/* Set up the web socket server.           */
/*******************************************/

/* A registry of socket_ids and player information */
var players = [];

var io = require('socket.io').listen(app);

io.sockets.on('connection', function(socket) {

	log('Client connection by ' + socket.id);

	function log() {
		var array = ['*** Server Log Message: '];
		for(var i = 0; i < arguments.length; i++) {
			array.push(arguments[i]);
			console.log(arguments[i]);
		}
		socket.emit('log', array);
		socket.broadcast.emit('log', array);
	}

	log('A website connected to the server');

	/* join_room command */
	/* payload: 
	 * 	{
	 * 		'room': 		room to join,
	 *		'username': 	username of person joining
	 *	}
	 *  join_room_response: 
	 *	{
	 * 		'result': 		'success',
	 *		'room': 		room joined,
	 *		'username': 	username that joined,
	 * 		'socket_id': 	the socket id of the person that joined,
	 *		'membership': 	number of people in the room including the new one
	 *  }
	 * or
	 * 	{
	 *		'result': 		'fail',
	 *		'message': 		failure message,
	 * 	}
	 */
	socket.on('join_room', function(payload) {
		log('Join room handler' + JSON.stringify(payload));

		/* Check that the client sent a payload */
		if(('undefined' === typeof payload) || !payload) {
			var errorMessage = 'join_room had no payload, command aborted';
			log(errorMessage);
			socket.emit('join_room response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		/* Check that the payload has a room to join */
		var room = payload.room;
		if(('undefined' === typeof room) || !room) {
			var errorMessage = 'join_room didn\'t specify a room, command aborted';
			log(errorMessage);
			socket.emit('join_room_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		/* Check that a username has been provided */
		var username = payload.username;
		if(('undefined' === typeof username) || !username) {
			var errorMessage = 'join_room didn\'t specify a username, command aborted';
			log(errorMessage);
			socket.emit('join_room_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		/* Store information about this new player */
		players[socket.id] = {};
		players[socket.id].username = username;
		players[socket.id].room = room;

		/* Actually have the user join the room */
		socket.join(room);

		/* Get the room object */
		var roomObject = io.sockets.adapter.rooms[room];

		/* Tell everyone that is already in the room that someone just joined */
		var numClients = roomObject.length;
		var successData = {
							result: 	'success',
							room: 		room,
							username: 	username,
							socket_id: 	socket.id,
							membership: numClients
						  };
		io.in(room).emit('join_room_response', successData);

		for(var socketInRoom in roomObject.sockets) {
			var successData = {
								result: 	'success',
								room: 		room,
								username: 	players[socketInRoom].username,
								socket_id: 	socketInRoom,
								membership: numClients
							  };
			socket.emit('join_room_response', successData);
		}
		log('join_room_success');
	});

	socket.on('disconnect', function(socket) {
		log('Client disconnected ' + JSON.stringify(players[socket.id]));

		if('undefined' !== typeof players[socket.id] && players[socket.id]) {
			var username = players[socket.id].username;
			var room = players[socket.id].room;
			var payload = {
							username: 	username,
							socket_id: socket.id
						  };
			delete players[socket.id];
			io.in(room).emit('player_disconnected', payload);
		} 
	});

	/* join_room command */
	/* payload: 
	 * 	{
	 * 		'room': 		room to join,
	 *		'username': 	username of person sending the message,
	 *		'message': 		message to send
	 *	}
	 *  join_room_response: 
	 *	{
	 * 		'result': 		'success',
	 *		'username': 	username of the person that spoke,
	 *		'message': 		the message spoken
	 *  }
	 * or
	 * 	{
	 *		'result': 		'fail',
	 *		'message': 		failure message,
	 * 	}
	 */
 	socket.on('send_message', function(payload) {
		log('Server received a command', 'send_message', payload);
		if(('undefined' === typeof payload) || !payload) {
			var errorMessage = 'send_message had no payload, command aborted';
			log(errorMessage);
			socket.emit('send_message_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}
		var room = payload.room;
		if(('undefined' === typeof room) || !room) {
			var errorMessage = 'send_message didn\'t specify a room, command aborted';
			log(errorMessage);
			socket.emit('send_message_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}
		var username = payload.username;
		if(('undefined' === typeof username) || !username) {
			var errorMessage = 'send_message didn\'t specify a username, command aborted';
			log(errorMessage);
			socket.emit('send_message_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}
		var message = payload.message;
		if(('undefined' === typeof message) || !message) {
			var errorMessage = 'send_message didn\'t specify a message, command aborted';
			log(errorMessage);
			socket.emit('send_message_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}
		var successData = {
							result: 	'success',
							room: 		room,
							username: 	username,
							message: 	message
						  };
		io.sockets.in(room).emit('send_message_response', successData);
		log('Message sent to room ' + room + 'by' + username);
	});
});



















