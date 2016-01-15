'use strict';
var config = require('./config').config;
var async = require('async');
var path = require('path');
var Utilities = require('./Utilities');
var GitController = require('./GitController').GitController;
var XCodeProject = require('./XCodeProject').XCodeProject;

var buildsDir = './Builds/';
var sourceDirName = 'source';
var outputDirName = 'output';
var buildConfigFileName = 'build_config.js';

var XCodeBuilder = function (projectName, branchName, isMajor, isMinor, isBatch)
{
	this.projectName = projectName;
	this.branchName = branchName;
	this.isMajor = isMajor;
	this.isMinor = isMinor;
	this.isBatch = isBatch;
	this.projectDirectory = '';
	this.gitController = null;
	this.xcodeProject = null;
	this.currentVersion = {};
	this.newVersion = {};
	this.buildConfig = {};
};


XCodeBuilder.prototype.build = function(callback)
{
	var _this = this;
	async.series(
		[
		function(callback){ _this.willGitProject(callback); },
		function(callback){ _this.gitController.prepare(callback); },
		function(callback){ _this.gitController.clone(callback); },
		function(callback){ _this.gitController.checkout(callback); },
		function(callback){ _this.gitController.pull(callback); },
		function(callback){ _this.didGitProject(callback); },
		function(callback){ _this.willBuild(callback); },
		function(callback){ _this.xcodeProject.build(_this.newVersion, callback); },
		function(callback){ _this.didBuild(callback); }

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


XCodeBuilder.prototype.willGitProject = function(callback)
{
	if ( config[this.projectName] )
	{
		var _this = this;
		this.createFolders(function(error)
		{
			console.log('folders created');
			if (error)
			{
				console.log(error);
			}
			else
			{
				console.log('success');
				var repoURL = config[_this.projectName].gitRepoURL;
				_this.gitController = new GitController(_this.projectDirectory, repoURL, _this.branchName);
			}
			callback(error);
		}
		);
	}
};

XCodeBuilder.prototype.setVersion = function(callback)
{
	var _this = this;
	this.gitController.getLastTag(function(error, tag)
	{
		if (error)
		{
			callback(error);
		}
		else
		{
			_this.currentVersion = _this.versionFromTag(tag);
			_this.newVersion = _this.incrementedVersion();
			callback();
		}
	});
};


XCodeBuilder.prototype.versionFromTag = function(tag)
{
	return {major: 1, minor: 1, batch: 1};
};

XCodeBuilder.prototype.incrementedVersion = function()
{
	return {major: 1, minor: 2, batch: 1};
};

XCodeBuilder.prototype.willBuild = function(callback)
{
	this.setVersion(callback);
};

XCodeBuilder.prototype.didBuild = function(callback)
{
	this.updateVersion(callback);
};

XCodeBuilder.prototype.updateVersion = function(callback)
{
	console.log("pushing new tag version");
	this.gitController.addTag(this.newVersion, callback);
}


XCodeBuilder.prototype.didGitProject = function(callback)
{
	this.projectDirectory = this.gitController.repoDirectory;
	this.buildConfig = this.loadBuildConfig();
	this.xcodeProject = new XCodeProject(this.projectDirectory, path.join(buildsDir, this.projectName, this.branchName, outputDirName), this.buildConfig);
	callback();
};

XCodeBuilder.prototype.loadBuildConfig = function()
{
	var buildConfigFilePath = path.join(this.projectDirectory, buildConfigFileName);
	try
	{
		var buildConfig = require('./'+buildConfigFilePath).config;
		return buildConfig;
	}
	catch (error)
	{
		return null;
	}
};

XCodeBuilder.prototype.createFolders = function(callback)
{
	var _this = this;
	async.series(
		[
		function(callback){ _this.createProjectFolder(callback); },
		function(callback){ _this.createBranchFolder(callback); },
		function(callback){ _this.createSourceFolder(callback); },
		function(callback){ _this.createOutputFolder(callback); }
		],
		function(error)
		{
			if (error)
			{
				console.log(error);
			}
			else
			{
				_this.projectDirectory = path.join(buildsDir, _this.projectName, _this.branchName, sourceDirName);
			}
			callback(error);
		}
		);
};

XCodeBuilder.prototype.createProjectFolder = function (callback)
{
	var projectPath = path.join(buildsDir, this.projectName);
	Utilities.createFolder(projectPath, callback);
};

XCodeBuilder.prototype.createBranchFolder = function (callback)
{
	var branchPath = path.join(buildsDir, this.projectName, this.branchName);
	Utilities.createFolder(branchPath, callback);
};

XCodeBuilder.prototype.createSourceFolder = function (callback)
{
	var sourcePath = path.join(buildsDir, this.projectName, this.branchName, sourceDirName);
	Utilities.createFolder(sourcePath, callback);
};

XCodeBuilder.prototype.createOutputFolder = function (callback)
{
	var outputPath = path.join(buildsDir, this.projectName, this.branchName, outputDirName);
	Utilities.createFolder(outputPath, callback);
};

exports.XCodeBuilder = XCodeBuilder;