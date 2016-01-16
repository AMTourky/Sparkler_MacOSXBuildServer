'use strict';

// var config = require('./config').config;
var async = require('async');
var path = require('path');
var fs = require('fs');
var Utilities = require('./Utilities');
var config = require('./config').config;
var Mustache = require('mustache');
var exec = require('child_process').exec;

var appcast_template = 'app_element_template.xml';

var Sparkler = function (zipFilePath, dsaPrivFilePath, versionString)
{
	this.zipFilePath = zipFilePath;
	this.dsaPrivFilePath = dsaPrivFilePath;
	this.versionString = versionString;
	this.zipFileLength = 0;
	this.dsaSignature = '';
};

Sparkler.prototype.willSparkle = function(callback)
{
	var _this = this;
	fs.stat(this.zipFilePath, function(error, stats)
	{
		_this.zipFileLength = stats.size;
		callback();
	});
};

Sparkler.prototype.downloadURL = function()
{
	var url = config.isHTTPS ? 'https://' : 'http://';
	url += config.serverAddress;
	url += '/' + path.relative('Builds', this.zipFilePath);
	return url;
};

Sparkler.prototype.projectName = function()
{
	return path.basename(this.zipFilePath, '.zip');
};

Sparkler.prototype.appCastFilePath = function()
{
	var outputDir = path.dirname(this.zipFilePath);
	var zipNameNoExt = this.projectName();
	return path.join(outputDir, zipNameNoExt+'.xml');
};

Sparkler.prototype.signZipFile = function(callback)
{
	var _this = this;
	exec('ruby ./sign_update.rb '+this.zipFilePath+' '+this.dsaPrivFilePath, function(error, stdout, stderr) 
	{
		if (!error && !stderr)
		{
			stdout = stdout.replace(/\s+/g,'');
			_this.dsaSignature = stdout;
		}
		callback(error || stderr);
	});
};

Sparkler.prototype.createAppcastXMLFile = function(callback)
{
	var _this = this;
	async.waterfall(
		[
		function(callback)
		{
			fs.readFile(appcast_template, callback);
		}, 
		function(data, callback)
		{
			var fileContent = data.toString();
			var appCastObject = {
				title: _this.projectName,
				now: new Date(),
				url: _this.downloadURL(),
				dsaSignature: _this.dsaSignature,
				version: _this.versionString,
				length: _this.zipFileLength
			};
			var appCastXML = Mustache.render(fileContent, appCastObject);
			callback(null, appCastXML);
		},
		function(appCastXML, callback)
		{
			fs.writeFile(_this.appCastFilePath(), appCastXML, callback);
		}
		],
		callback
		);
};

Sparkler.prototype.didSparkle = function(callback)
{
	callback();
};

exports.Sparkler = Sparkler;