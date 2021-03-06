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

		if(room !== 'lobby') {
			send_game_update(socket, room, 'initial update');
		}
	});

	socket.on('disconnect', function() {
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

	/* send_message command */
	/* payload: 
	 * 	{
	 * 		'room': 		room to join,
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
		var username = players[socket.id].username;
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
		io.in(room).emit('send_message_response', successData);
		log('Message sent to room ' + room + ' by ' + username);
	});

	/* invite command */
	/* payload: 
	 * 	{
	 * 		'requested_user': 	the socket id of the person to be invited,
	 *	}
	 *  invite_response: 
	 *	{
	 * 		'result': 		'success',
	 *		'socket_id': 	the socket id of the person being invited,
	 *  }
	 * or
	 * 	{
	 *		'result': 		'fail',
	 *		'message': 		failure message,
	 * 	}
	 *  invited: 
	 *	{
	 * 		'result': 		'success',
	 *		'socket_id': 	the socket id of the person being invited,
	 *  }
	 * or
	 * 	{
	 *		'result': 		'fail',
	 *		'message': 		failure message,
	 * 	}
	 */
 	socket.on('invite', function(payload) {
		log('invite with ' + JSON.stringify(payload));

		/* Check to make sure that a payload was sent */
		if(('undefined' === typeof payload) || !payload) {
			var errorMessage = 'invite had no payload, command aborted';
			log(errorMessage);
			socket.emit('invite_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		/* Check that the message can be traced to a username */
		var username = players[socket.id].username;
		if(('undefined' === typeof username) || !username) {
			var errorMessage = 'invite can\'t identify who sent the message';
			log(errorMessage);
			socket.emit('invite_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		var requested_user = payload.requested_user;
		if(('undefined' === typeof requested_user) || !requested_user) {
			var errorMessage = 'invite didn\'t specify a requested user, command aborted';
			log(errorMessage);
			socket.emit('invite_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		var room = players[socket.id].room;
		var roomObject = io.sockets.adapter.rooms[room];

		/* Make sure the user being invited is in the room */
		if(!roomObject.sockets.hasOwnProperty(requested_user)) {
			var errorMessage = 'invite requested a user that wasn\'t in the room, command aborted';
			log(errorMessage);
			socket.emit('invite_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		/* If everything is okay, respond to the inviter that it was successful */
		var successData = {
							result: 	'success',
							socket_id: 	requested_user,
						  };

		socket.emit('invite_response', successData);

		/* Tell the invitee that they have been invited */

		var successData = {
							result: 	'success',
							socket_id: 	socket.id,
						  };

		socket.to(requested_user).emit('invited', successData);

		log('invite successful');
	});


	/* uninvite command */
	/* payload: 
	 * 	{
	 * 		'requested_user': 	the socket id of the person to be uninvited,
	 *	}
	 *  uninvite_response: 
	 *	{
	 * 		'result': 		'success',
	 *		'socket_id': 	the socket id of the person being uninvited,
	 *  }
	 * or
	 * 	{
	 *		'result': 		'fail',
	 *		'message': 		failure message,
	 * 	}
	 *  uninvited: 
	 *	{
	 * 		'result': 		'success',
	 *		'socket_id': 	the socket id of the person doing the uninviting,
	 *  }
	 * or
	 * 	{
	 *		'result': 		'fail',
	 *		'message': 		failure message,
	 * 	}
	 */
 	socket.on('uninvite', function(payload) {
		log('uninvite with ' + JSON.stringify(payload));

		/* Check to make sure that a payload was sent */
		if(('undefined' === typeof payload) || !payload) {
			var errorMessage = 'uninvite had no payload, command aborted';
			log(errorMessage);
			socket.emit('uninvite_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		/* Check that the message can be traced to a username */
		var username = players[socket.id].username;
		if(('undefined' === typeof username) || !username) {
			var errorMessage = 'uninvite can\'t identify who sent the message';
			log(errorMessage);
			socket.emit('uninvite_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		var requested_user = payload.requested_user;
		if(('undefined' === typeof requested_user) || !requested_user) {
			var errorMessage = 'uninvite didn\'t specify a requested user, command aborted';
			log(errorMessage);
			socket.emit('uninvite_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		var room = players[socket.id].room;
		var roomObject = io.sockets.adapter.rooms[room];

		/* Make sure the user being invited is in the room */
		if(!roomObject.sockets.hasOwnProperty(requested_user)) {
			var errorMessage = 'invite requested a user that wasn\'t in the room, command aborted';
			log(errorMessage);
			socket.emit('invite_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		/* If everything is okay, respond to the uninviter that it was successful */
		var successData = {
							result: 	'success',
							socket_id: 	requested_user,
						  };

		socket.emit('uninvite_response', successData);

		/* Tell the uninvitee that they have been uninvited */

		var successData = {
							result: 	'success',
							socket_id: 	socket.id,
						  };

		socket.to(requested_user).emit('uninvited', successData);

		log('uninvite successful');
	});

	/* game_start command */
	/* payload: 
	 * 	{
	 * 		'requested_user': 	the socket id of the person to play with,
	 *	}
	 *  game_start_response: 
	 *	{
	 * 		'result': 		'success',
	 *		'socket_id': 	the socket id of the person you are playing with,
	 *		'game_id': 		id of the game session
	 *  }
	 * or
	 * 	{
	 *		'result': 		'fail',
	 *		'message': 		failure message,
	 * 	}
	 */
 	socket.on('game_start', function(payload) {
		log('game_start with ' + JSON.stringify(payload));

		/* Check to make sure that a payload was sent */
		if(('undefined' === typeof payload) || !payload) {
			var errorMessage = 'game_start had no payload, command aborted';
			log(errorMessage);
			socket.emit('game_start_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		/* Check that the message can be traced to a username */
		var username = players[socket.id].username;
		if(('undefined' === typeof username) || !username) {
			var errorMessage = 'game_start can\'t identify who sent the message';
			log(errorMessage);
			socket.emit('game_start_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		/* Check to make sure that a person was specified to start a game with */
		var requested_user = payload.requested_user;
		if(('undefined' === typeof requested_user) || !requested_user) {
			var errorMessage = 'game_start didn\'t specify a requested user, command aborted';
			log(errorMessage);
			socket.emit('game_start_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		var room = players[socket.id].room;
		var roomObject = io.sockets.adapter.rooms[room];

		/* Make sure the user being invited is in the room */
		if(!roomObject.sockets.hasOwnProperty(requested_user)) {
			var errorMessage = 'game_start requested a user that wasn\'t in the room, command aborted';
			log(errorMessage);
			socket.emit('game_start_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		/* If everything is okay, respond to the game_starter that it was successful */
		var game_id = Math.floor((1+Math.random()) * 0x10000).toString(16).substring(1);
		var successData = {
							result: 	'success',
							socket_id: 	requested_user,
							game_id: 	game_id,
						  };

		socket.emit('game_start_response', successData);

		/* Tell the other player to play */
		var successData = {
							result: 	'success',
							socket_id: 	socket.id,
							game_id: 	game_id,
						  };

		socket.to(requested_user).emit('game_start_response', successData);

		log('game_start successful');
	});

 	/* play_token command */
	/* payload: 
	 * 	{
	 * 		'row': 		0-7 the row to play the token on,
	 *		'col': 		0-7 the col to play the token on,
	 * 		'color': 	'white or black',
	 *	}
	 *  if successful a success message will be followed by a game update message
	 *  play_token_response: 
	 *	{
	 * 		'result': 		'success',
	 *  }
	 * or
	 * 	{
	 *		'result': 		'fail',
	 *		'message': 		failure message,
	 * 	}
	 */
 	socket.on('play_token', function(payload) {
		log('play_token with ' + JSON.stringify(payload));

		/* Check to make sure that a payload was sent */
		if(('undefined' === typeof payload) || !payload) {
			var errorMessage = 'play_token had no payload, command aborted';
			log(errorMessage);
			socket.emit('play_token_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		/* Check that the player has previously registered */
		var player = players[socket.id];
		if(('undefined' === typeof player) || !player) {
			var errorMessage = 'server doesn\'t recognize you (try going back one screen)';
			log(errorMessage);
			socket.emit('play_token_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		/* Check that the player has previously registered */
		var username = players[socket.id].username;
		if(('undefined' === typeof username) || !username) {
			var errorMessage = 'play_token  can\'t identify who sent the message';
			log(errorMessage);
			socket.emit('play_token_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		/* Check that the player has previously registered */
		var game_id = players[socket.id].room;
		if(('undefined' === typeof game_id) || !game_id) {
			var errorMessage = 'play_token can\'t find your game board';
			log(errorMessage);
			socket.emit('play_token_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		var row = payload.row;
		if(('undefined' === typeof row) || row < 0 || row > 7) {
			var errorMessage = 'play_token didn\'t specify a valid row, command aborted';
			log(errorMessage);
			socket.emit('play_token_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		var col = payload.col;
		if(('undefined' === typeof col) || col < 0 || col > 7) {
			var errorMessage = 'play_token didn\'t specify a valid col, command aborted';
			log(errorMessage);
			socket.emit('play_token_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		var color = payload.color;
		if(('undefined' === typeof color) || !color || (color != 'white' && color != 'black')) {
			var errorMessage = 'play_token didn\'t specify a valid color, command aborted';
			log(errorMessage);
			socket.emit('play_token_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		var game = games[game_id];
		if(('undefined' === typeof game) || !game) {
			var errorMessage = 'play_token couldn\'t find your game board';
			log(errorMessage);
			socket.emit('play_token_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		/* If the current attempt at playing a token is out of turn, then error */
		if(color != game.whose_turn) {
			var errorMessage = 'play_token message played out of turn';
			log(errorMessage);
			socket.emit('play_token_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}
		/* If the wrong socket is playing the color */
		if( ((game.whose_turn === 'white') && (game.player_white.socket != socket.id)) || 
			((game.whose_turn === 'black') && (game.player_black.socket != socket.id)) ) {
			var errorMessage = 'play_token turn played by wrong player';
			log(errorMessage);
			socket.emit('play_token_response', {
												result: 	'fail',
												message: 	errorMessage
											  }

			);
			return;
		}

		/* Send response */
		var success_data = {
							 resule: 'success',
		};
		socket.emit('play_token', success_data);

		/* Execute the move */
		if(color == 'white') {
			game.board[row][col] = 'w';
			flip_board('w', row, col, game.board);
			game.whose_turn = 'black';	
			game.legal_moves = calculate_valid_moves('b', game.board); 
		} else if(color == 'black') {
			game.board[row][col] = 'b';
			flip_board('b', row, col, game.board);
			game.whose_turn = 'white';
			game.legal_moves = calculate_valid_moves('w', game.board);
		}

		var d = new Date();
		game.last_move_time = d.getTime();

		send_game_update(socket, game_id, 'played a token');

	});
});


/*******************************************/
/* This is code related to the game state  */
/*******************************************/

/* A registry of currently created games */
var games = [];

function create_new_game() {
	var new_game = {};
	new_game.player_white = {};
	new_game.player_black = {};
	new_game.player_white.socket = '';
	new_game.player_white.username = '';
	new_game.player_black.socket = '';
	new_game.player_black.username = '';

	var d = new Date();
	new_game.last_move_time = d.getTime(); 

	new_game.whose_turn = 'black';
	new_game.board = [
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],						
						[' ', ' ', ' ', 'w', 'b', ' ', ' ', ' '],
						[' ', ' ', ' ', 'b', 'w', ' ', ' ', ' '],
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
					 ];
	new_game.legal_moves = calculate_valid_moves('b', new_game.board);

	return new_game;
}


/* Check if there is a color 'who' on the line starting at (r, c) or
 * anywhere further by adding dr and dc to (r, c) */
 function check_line_match(who, dr, dc, r, c, board) {
 	if(board[r][c] === who){
 		return true;
 	}
 	if(board[r][c] === ' '){
 		return false;
 	}
 	if((r+dr < 0) || (r+dr > 7)){
		return false;
	}
	if((c+dc < 0) || (c+dc > 7)){
		return false;
	}
	return check_line_match(who, dr, dc, r+dr, c+dc, board);
 }

/* Check if the position at (r, c) contains the opposite of 'who' on the 'board'
 * and if the line indicated by adding dr to r and dc to c eventually ends in 
 * the 'who' color */
function valid_move(who, dr, dc, r, c, board) {
	var other;
	if(who === 'b') {
		other = 'w';
	} else if(who === 'w') {
		other = 'b';
	} else {
		log('Houston, we have a color problem: ' + who);
		return false;
	}

	if((r+dr < 0) || (r+dr > 7)){
		return false;
	}
	if((c+dc < 0) || (c+dc > 7)){
		return false;
	}
	if(board[r+dr][c+dc] != other) {
		return false;	
	}
	if((r+dr+dr < 0) || (r+dr+dr > 7)){
		return false;
	}
	if((c+dc+dc < 0) || (c+dc+dc > 7)){
		return false;
	}
	return check_line_match(who, dr, dc, r+dr+dr, c+dc+dc, board);
}

function calculate_valid_moves(who, board) {
	var valid = [
				 [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
				 [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
				 [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],						
				 [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
				 [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
				 [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
				 [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
				 [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
			 	];

	for(var row = 0; row < 8; row++) {
		for(var col = 0; col < 8; col++) {
			if(board[row][col] === ' ') {
				nw = valid_move(who, -1, -1, row, col, board);
				nn = valid_move(who, -1,  0, row, col, board);
				ne = valid_move(who, -1,  1, row, col, board);

				ww = valid_move(who,  0, -1, row, col, board);
				ee = valid_move(who,  0,  1, row, col, board);

				sw = valid_move(who,  1, -1, row, col, board);
				ss = valid_move(who,  1,  0, row, col, board);
				se = valid_move(who,  1,  1, row, col, board);

				if( nw || nn || ne || ww || ee || sw || ss || se ) {
					valid[row][col] = who;
				}
			}
		}
	}
	return valid;
}

function flip_line(who, dr, dc, r, c, board) {
	if((r+dr < 0) || (r+dr > 7)){
		return false;
	}
	if((c+dc < 0) || (c+dc > 7)){
		return false;
	}
	if(board[r+dr][c+dc] === ' ') {
		return false;	
	}
	if(board[r+dr][c+dc] === who) {
		return true;	
	} else {
		if(flip_line(who, dr, dc, r+dr, c+dc, board)) {
			board[r+dr][c+dc] = who;
			return true;
		} else {
			return false;
		}
	}
}

function flip_board(who, row, col, board) {
	flip_line(who, -1, -1, row, col, board);
	flip_line(who, -1,  0, row, col, board);
	flip_line(who, -1,  1, row, col, board);

	flip_line(who,  0, -1, row, col, board);
	flip_line(who,  0,  1, row, col, board);

	flip_line(who,  1, -1, row, col, board);
	flip_line(who,  1,  0, row, col, board);
	flip_line(who,  1,  1, row, col, board);
}

function send_game_update(socket, game_id, message) {

	/* Check to see if a game with game_id already exists */
	if(('undefined' === typeof games[game_id]) || !games[game_id]) {
		/* No game exists, so make one */
		console.log('No game exists. Creating ' + game_id + ' for ' + socket.id);
		games[game_id] = create_new_game();
	} 

	/* Make sure that only 2 people are in the game room */
	var roomObject; 
	var numClients;
	do {
		roomObject = io.sockets.adapter.rooms[game_id];
		numClients = roomObject.length;
		if(numClients > 2) {
			console.log('Too many clients in room: ' + game_id + ' #: ' + numClients);
			if(games[game_id].player_white.socket == roomObject.sockets[0]) {
				games[game_id].player_white.socket = '';
				games[game_id].player_white.username = '';
			}
			if(games[game_id].player_black.socket == roomObject.sockets[0]) {
				games[game_id].player_black.socket = '';
				games[game_id].player_black.username = '';
			}
			/* Kick one of the extra people out */
			var sacrifice = Object.keys(roomObject.sockets)[0];
			io.of('/').connected[sacrifice].leave(game_id);
		}
	}
	while((numClients-1) > 2);

	/* Assign this socket a color */
	/* If the current player isn't assigned a color */
	if((games[game_id].player_white.socket != socket.id) && (games[game_id].player_black.socket != socket.id)) {
		console.log('Player isn\'t assigned a color: ' + socket.id);
		/* And there isn't a color to give them */
		if((games[game_id].player_black.socket != '') && (games[game_id].player_white.socket != '')) {
			games[game_id].player_white.socket = ''; 
			games[game_id].player_white.username = '';
			games[game_id].player_black.socket = ''; 
			games[game_id].player_black.username = '';
		}
	}

	/* Assign colors to the player if not already done */
	if(games[game_id].player_white.socket == '') {
		if(games[game_id].player_black.socket != socket.id) {
			games[game_id].player_white.socket = socket.id; 
			games[game_id].player_white.username = players[socket.id].username;
		}
	}
	if(games[game_id].player_black.socket == '') {
		if(games[game_id].player_white.socket != socket.id) {
			games[game_id].player_black.socket = socket.id; 
			games[game_id].player_black.username = players[socket.id].username;
		}
	}

	/* Send game update */
	var success_data = {
						 result: 	'success',
						 game: 		games[game_id],
						 message: 	message,
						 game_id: 	game_id,
					    };

	io.in(game_id).emit('game_update', success_data);

	/* Check to see if the game is over */
	var row, col;
	var count = 0;
	var black = 0;
	var white = 0;
	for(row = 0; row < 8; row++) { 
		for(col = 0; col < 8; col++) {
			if(games[game_id].legal_moves[row][col] != ' ') {
				count++;
			}
			if(games[game_id].board[row][col] === 'b') {
				black++;
			}
			if(games[game_id].board[row][col] === 'w') {
				white++;
			}
		}
	}
	if(count == 0) {
		/* Send game over message */
		var winner = 'tie game';
		if(black > white) {
			winner = 'black';
		}
		if(white > black) {
			winner = 'white';
		}
		var success_data = {
							 result: 	'success',
							 game: 		games[game_id],
							 who_won: 	winner,
							 game_id: 	game_id
						   }
		io.in(game_id).emit('game_over', success_data);

		/* Delete old games after one hour */
		setTimeout(function(id) {
			return function() {
				delete games[id];
			}
		} (game_id), 60*60*1000);
	}
}



















