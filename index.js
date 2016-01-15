'use strict';
var Utilities = require('./Utilities');
var XCodeBuilder = require('./XCodeBuilder').XCodeBuilder;
var restify = require('restify');
var server = restify.createServer();
server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

server.get('/build', function (req, res, next) 
{
	// res.send('ok, will build now!');

	var xcodeBuilder = new XCodeBuilder(req.params.projectName, req.params.branchName);
	xcodeBuilder.build(function(error, message)
		{
			console.log('Build end, error: ', error, ' Message: ', message);
			res.send(200, {'error': error, 'message': message});
			return next();
		});

});


server.listen(4545, function() 
{
	console.log('%s listening at %s', server.name, server.url);
});