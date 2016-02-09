'use strict';

var Utilities = require('./Utilities');
var exec = require('child_process').exec;
var path = require('path');
var async = require('async');
var Walker = require('walk');
var fs = require('fs');
var config = require('./config').config;

var walkingOptions = {filters: ['.git', 'Pods']};

var workspaceExtension = '.xcworkspace';
var xcodeProjectExtension = '.xcodeproj';
var builtPackageExtension = '.app';

var XCodeProject = function(projectName, branch, projectDirectory, outputDirectory, buildConfig)
{
	this.projectName = projectName;
	this.branch = branch;
	this.projectDirectory = projectDirectory;
	this.outputDirectory = outputDirectory;
	this.absoluateOutputDirectory = path.join(__dirname, this.outputDirectory);
	this.buildConfig = buildConfig;
	this.buildableFilePath = '';// .xcodeproj OR .xcworkspace
	this.infoPlistFilePath = path.join(this.projectDirectory, buildConfig.plistFilePathRelative);
	this.version = {};
};

XCodeProject.prototype.buildableFileName = function()
{
	return path.basename(this.buildableFilePath);
};

XCodeProject.prototype.zipFileName = function()
{
	var zipName = path.basename(this.buildableFilePath).replace(path.extname(this.buildableFilePath), '');
	zipName += '_v'+this.versionString()+'.zip';
	return zipName;
};

XCodeProject.prototype.versionString = function()
{
	return this.version.major+'.'+this.version.minor+'.'+this.version.batch;
};

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
				callback('Failed to build project');
			}
			else
			{
				callback();
			}
		}
		);
};

XCodeProject.prototype.setBuildableFilePath = function(callback)
{
	if (this.buildConfig && this.buildConfig.buildableFilePathRelative)
	{
		this.buildableFilePath = path.join(this.projectDirectory, this.buildConfig.buildableFilePathRelative);
		console.log("found buildable path in project config: ", this.buildableFilePath);
		callback();
	}
	else
	{
		var _this = this;
		var walker = Walker.walk(this.projectDirectory, walkingOptions);
		var dotXcodeRoot = '';
		walker.on('file', function (root, fileStats, next) 
		{
			if (  Utilities.stringEndsWith(root, workspaceExtension) )
			{
				if ( dotXcodeRoot && root.indexOf(dotXcodeRoot) == -1)
				{
					// no, wrong file, it's a .xcworkspace inside the .xcodeproj
					next();
				}
				_this.buildableFilePath = root;

				console.log('Found the .xcworkspace');
				callback();
			}
			else if ( Utilities.stringEndsWith(root, xcodeProjectExtension) )
			{
				console.log('Found the .xcodeproj');
				_this.buildableFilePath = root;
				dotXcodeRoot = root;
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
	}
};


XCodeProject.prototype.willBuildProject = function(callback)
{
	this.updatePlistFile(callback);
};



XCodeProject.prototype.updatePlistFile = function(callback)
{
	var _this = this;
	async.waterfall(
		[
		function(callback)
		{
			fs.readFile(_this.infoPlistFilePath, function(error, data)
				{
					if(error)
					{
						callback(error);
					}
					else
					{
						callback(null, data.toString());
					}
				});
		}, 
		function(plistInfo, callback)
		{
			_this.updatePlistInfo(plistInfo, callback);
		},
		function(plistInfo, callback)
		{
			fs.writeFile(_this.infoPlistFilePath, plistInfo, callback);
		}
		],
		callback
		);
};


XCodeProject.prototype.updatePlistInfo = function(plistInfo, callback)
{
	var lines = plistInfo.split('\n');

	for(var i = 0 ; i < lines.length ; i++)
	{
		var line = lines[i];
		if ( line.indexOf('SUFeedURL') != -1 )
		{
			lines[i+1] = '\t<string>http://'+config.serverAddress+'/feed?projectName='+this.projectName+'&amp;branchName='+this.branch+'</string>';
			i++;
		}
		else if ( line.indexOf('CFBundleVersion') != -1 || line.indexOf('CFBundleShortVersionString') != -1 )
		{
			lines[i+1] = '\t<string>'+this.versionString()+'</string>';
			i++;
		}
	}
	plistInfo = lines.join('\n');
	callback(null, plistInfo);
};

XCodeProject.prototype.buildProject = function(callback)
{
	var buildableFileName = this.buildableFileName();
	var buildableDirectory = path.dirname(this.buildableFilePath);

	var params = '';
	if (this.isWorkspace())
	{
		var schemeName = this.buildConfig.scehemeName;
		var schemePart = ' -scheme '+schemeName+' ';

		var targetBuild = '-workspace ';
		var targetBuildPart = targetBuild+buildableFileName+' ';

		params = targetBuildPart+schemePart;
	}
	else
	{
		params = ' -project '+buildableFileName;
	}
	
	var buildCommand = "xcodebuild "+params+" CONFIGURATION_BUILD_DIR='"+this.absoluateOutputDirectory+"'";

	exec(buildCommand, {cwd: buildableDirectory, maxBuffer: 100*1024*1024}, function(error, stdout, stderr) 
	{
		if(error) 
		{
			console.log(error);
			console.log(stderr);
			callback(error);
		}
		else 
		{
			// console.log('success command: ', stdout);
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
		function(callback){ _this.zipTheAppToName(callback); }
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

XCodeProject.prototype.zipTheAppToName = function(callback)
{
	exec('zip -r '+this.zipFileName()+' *'+builtPackageExtension, {cwd: this.outputDirectory},function(error)
	{
		callback();
	}
	);
};

exports.XCodeProject = XCodeProject;