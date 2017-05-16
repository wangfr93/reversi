/* Include a static file webserver library */
var static = require('node-static');

/* Include the http server library */
var http = require('http');

/* Assume that we are running on Heroku */
var port = process.env.PORT;
var directory = (__dirname + '/public');

console.log('port:', port);
console.log('!port:', !port);

/* If we aren't on Heroku, then we need to readjust the port and directory 
 * information and we know that because port won't be set */
/*
if (typeof port == 'undefined' || !port) {
	directory = './public';
	port = 8080;
}
*/

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
).listen(port || 5000);

console.log('The server is running');

var testBool = typeof false;
console.log('testBool:', testBool);
var typeTestBool = typeof testBool; 
console.log('typeTestBool:', typeTestBool);
console.log('port:', port);
var portOption = (port || 5000);
console.log('portOption:', portOption);

