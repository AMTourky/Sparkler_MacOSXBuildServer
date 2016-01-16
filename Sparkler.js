'use strict';

// var config = require('./config').config;
// var async = require('async');
// var path = require('path');
// var mustache = require('mustache');
var exec = require('child_process').exec;


var Sparkler = function (zipFilePath, dsaPrivFilePath, versionString)
{
	this.zipFilePath = zipFilePath;
	this.dsaPrivFilePath = dsaPrivFilePath;
	this.versionString = versionString;
	this.dsaSignature = '';
};


Sparkler.prototype.signZipFile = function(callback)
{
	var _this = this;
	exec('ruby ./sign_update.rb '+this.zipFilePath+' '+this.dsaPrivFilePath, function(error, stdout, stderr) 
	{
		if (!error && !stderr)
		{
			_this.dsaSignature = stdout;
		}
		callback(error || stderr);
	});
};

Sparkler.prototype.createAppcastXMLFile = function(callback)
{
	callback();
};

exports.Sparkler = Sparkler;