'use strict';

var config = require('./config').config;
var XCodeBuilder = require('./XCodeBuilder').XCodeBuilder;
var Feeder = require('./Feeder').Feeder;

var restify = require('restify');

var server = restify.createServer();
server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());
server.server.timeout = config.serverTimeoutInMins*60*1000;

var projectsInProgress = {};

server.get('/build', function (req, res, next) 
{
	var projectKey = req.params.projectName + req.params.branchName;

	console.log('requising build project: ', projectKey);

	if (!projectsInProgress[ projectKey ] )
	{
		projectsInProgress[ projectKey ] = res;
		var xcodeBuilder = new XCodeBuilder(req.params.projectName, req.params.branchName);
		xcodeBuilder.build(function(error, message)
			{
				console.log('Build end, error: ', error, ' Message: ', message);
				var res = projectsInProgress[ projectKey ];
				res.send(200, {'error': error, 'message': message});
				projectsInProgress[ projectKey ] = null;
				return next();
			});
	}
	else
	{
		projectsInProgress[ projectKey ] = res;
		return next();
	}
	if (!config.serverAddress)
	{
		config.serverAddress = req.headers.host;
	}
});


server.get('/feed', function (req, res, next) 
{
	var project = req.params.projectName;
	var branch = req.params.branch;

	var feeder = new  Feeder(project, branch);
	feeder.feed(function(xml)
	{
		res.writeHead(200, {
			'Content-Length': Buffer.byteLength(xml),
			'Content-Type': 'text/xml'
		});
		res.write(xml);
		res.end();
		next();
	});
});


server.get(/\/*\/*\/*\.zip/, restify.serveStatic({
  directory: 'Builds'
}));

server.listen(config.serverPort, function() 
{
	console.log('%s listening at %s', server.name, server.url);
});
