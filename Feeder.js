'use strict';

var path = require('path');
var async = require('async');
var fs = require('fs');
var Mustache = require('mustache');

var appcast_template = 'appcast_template.xml';

var Feeder = function(project, branch)
{
	this.versionsDir = path.join('Builds', project, branch, 'output');
	this.versions = [];
};

Feeder.prototype.feed = function(callback)
{
	var _this = this;
	async.waterfall(
		[
		function(callback)		{ _this.getVersions(callback); },
		function(callback)		{ _this.getAppcastTemplate(callback); },
		function(template, callback)	{ _this.populateTemplateWithVersions(template, callback); }
		],
		function(error, xml)
		{
			callback(xml);
		});
};

Feeder.prototype.getVersions = function(callback)
{
	var _this = this;
	this.getXMLFilePaths(function(files)
	{
		async.each(files, 
			function(file, callback)
			{
				fs.readFile(file, function(error, data)
				{
					if (data)
					{
						_this.versions.push(data.toString());
					}
					callback();
				});
			},
			function()
			{
				callback();
			});
	});
};


Feeder.prototype.getXMLFilePaths = function(callback)
{
	var _this = this;
	fs.readdir(this.versionsDir, function(error, files)
	{
		var filesArr = [];
		if ( files && files.length > 0 )
		{
			files = files.map( function(file) { return path.join(_this.versionsDir, file); } );
			filesArr = files.filter( function(file) { return path.extname(file) == '.xml' ; } );
		}
		callback(filesArr);
	});
};

Feeder.prototype.getAppcastTemplate = function(callback)
{
	fs.readFile(appcast_template, function(error, data)
	{
		callback(null, data.toString() );
	});
};


Feeder.prototype.populateTemplateWithVersions = function(template, callback)
{
	var versionsObject = {versions: this.versions, feedURL: 'http://lol.lol/lol'}
	var appCastXML = Mustache.render(template, versionsObject);
	callback(null, appCastXML);
};

exports.Feeder = Feeder;