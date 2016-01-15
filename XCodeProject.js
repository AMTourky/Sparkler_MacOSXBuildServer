'use strict';

var Utilities = require('./Utilities');
var exec = require('child_process').exec;
var path = require('path');
var async = require('async');
var Walker = require('walk');
var walkingOptions = {filters: ['.git', 'Pods']};

var workspaceExtension = '.xcworkspace';
var xcodeProjectExtension = '.xcodeproj';
var builtPackageExtension = '.app';

var XCodeProject = function(projectDirectory, outputDirectory, buildConfig)
{
	this.projectDirectory = projectDirectory;
	this.outputDirectory = outputDirectory;
	this.absoluateOutputDirectory = path.join(__dirname, this.outputDirectory);
	this.buildConfig = buildConfig;
	this.buildableFilePath = '';// .xcodeproj OR .xcworkspace
	this.version = {};
};

XCodeProject.prototype.buildableFileName = function()
{
	return path.basename(this.buildableFilePath);
}

XCodeProject.prototype.isWorkspace = function()
{
	return this.buildableFileName().indexOf(workspaceExtension) != -1;
};

XCodeProject.prototype.build = function(version, callback)
{
	this.version = version;
	var _this = this;
	async.series(
		[
		function(callback){ _this.setBuildableFilePath(callback); },
		function(callback){ _this.willBuildProject(callback); },
		function(callback){ _this.buildProject(callback); },
		function(callback){ _this.didBuildProject(callback); }
		],
		function(error)
		{
			if (error)
			{
				console.log(error);
			}
			else
			{
			}
			callback(error);
		}
		);
};

XCodeProject.prototype.setBuildableFilePath = function(callback)
{
	var _this = this;
	var walker = Walker.walk(this.projectDirectory, walkingOptions);
	var dotXcodeRoot = '';
	walker.on('file', function (root, fileStats, next) 
	{
		if (  Utilities.stringEndsWith(root, workspaceExtension) )
		{
			_this.buildableFilePath = root;

			console.log('Found the .xcworkspace');
			callback();
		}
		else if ( Utilities.stringEndsWith(root, xcodeProjectExtension) )
		{
			console.log('Found the .xcodeproj');
			_this.buildableFilePath = root;
			dotXcodeRoot = path.join(root, '..');
			next();
		}
		else if ( _this.buildableFilePath && dotXcodeRoot && dotXcodeRoot != root )
		{
			console.log('We are waisting time here, stop walking looking for a work space!');
			callback();
		}
		else
		{
			next();
		}
		console.log('File: ', fileStats.name, '\n Root: ', root);

	});

	walker.on('errors', function (root, nodeStatsArray, next) 
	{
		console.log('Error while walking into project directory!');
		callback('Error while walking into project directory!');
	});

	walker.on('end', function () 
	{
		callback('Buildable file not found!');
		console.log('all done');
	});
};


XCodeProject.prototype.willBuildProject = function(callback)
{
	this.changePlistFile(callback);
};



XCodeProject.prototype.changePlistFile = function(callback)
{
	callback();
};


XCodeProject.prototype.buildProject = function(callback)
{
	// this.outputDirectory = "/Users/amtourky/Projects/Sparkle Server/Builds/JolpatX/dev2/output";

	var buildableFileName = this.buildableFileName();
	var buildableDirectory = path.dirname(this.buildableFilePath);

	var params = buildableFileName;
	if (this.isWorkspace)
	{
		var schemeName = this.buildConfig.scehemeName;
		var schemePart = ' -scheme '+schemeName+' ';

		var targetBuild = '-workspace ';
		var targetBuildPart = targetBuild+buildableFileName+' ';

		params = targetBuildPart+schemePart;
	}
	
	var buildCommand = "xcodebuild "+params+"CONFIGURATION_BUILD_DIR='"+this.absoluateOutputDirectory+"'";

	// xcodebuild -workspace JolpatX.xcworkspace -scheme JolpatX CONFIGURATION_BUILD_DIR=Builds/JolpatX/dev2/output
	// xcodebuild -workspace JolpatX.xcworkspace -scheme JolpatX CONFIGURATION_BUILD_DIR=/Users/amtourky/Projects/Sparkle Server/Builds/JolpatX/dev2/output
	
	exec(buildCommand, {cwd: buildableDirectory, maxBuffer: 10*1024*1024}, function(error, stdout, stderr) 
	{
		if(error) 
		{
			console.log(error);
			console.log(stderr);
			callback(error);
		}
		else 
		{
			console.log('success command: ', stdout);
			callback(null, stdout);
		}
	});
};


XCodeProject.prototype.didBuildProject = function(callback)
{
	var _this = this;
	async.series(
		[
		function(callback){ Utilities.deleteAllInDirExceptExtensions(_this.absoluateOutputDirectory, ['app', 'xml', 'zip'], callback); },
		function(callback){ _this.zipTheAppToName(this.buildableFileName()+this.version, callback); }
		],
		function(error)
		{
			if (error)
			{
				console.log(error);
			}
			else
			{
			}
			callback(error);
		}
		);
	callback();
};

XCodeProject.prototype.zipTheAppToName = function(name, callback)
{
	exec('zip -r '+name+' *'+builtPackageExtension, {cwd: self.outputDirectory},function(error)
		{

		}
	);
};

exports.XCodeProject = XCodeProject;