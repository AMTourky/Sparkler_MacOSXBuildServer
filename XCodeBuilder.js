'use strict';
var config = require('./config').config;
var async = require('async');
var path = require('path');
var Utilities = require('./Utilities');
var GitController = require('./GitController').GitController;
var XCodeProject = require('./XCodeProject').XCodeProject;
var Sparkler = require('./Sparkler').Sparkler;

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
	this.sparkler = {};
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
				callback(error);
			}
			else
			{
				callback(null, 'Project built successfully');
			}
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
				callback('Failed to create folders structure');
			}
			else
			{
				console.log('success');
				var repoURL = config[_this.projectName].gitRepoURL;
				_this.gitController = new GitController(_this.projectDirectory, repoURL, _this.branchName);
				callback(error);
			}
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
			console.log(error);
			callback('Failed to set build version!');
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
	tag = tag || '';
	var obIndex = tag.indexOf('{');
	var cbIndex = tag.indexOf('}');
	if (obIndex != -1 && cbIndex != -1 && cbIndex > obIndex && tag.substring(obIndex+1, cbIndex))
	{
		var versionComponents = tag.substring(obIndex+1, cbIndex).split('.');
		return {major: versionComponents[0], minor: versionComponents[1], batch: versionComponents[2]};
	}
	else
	{
		return {major: 0, minor: 0, batch: 0};
	}
};

XCodeBuilder.prototype.tagFromVersion = function(version)
{
	// version(0.0.0)
	return 'build_version{'+version.major+'.'+version.minor+'.'+version.batch+'}';
};

XCodeBuilder.prototype.incrementedVersion = function()
{
	var version = {major: this.currentVersion.major, minor: this.currentVersion.minor, batch: this.currentVersion.batch};
	if (this.isMajor)
	{
		version.major = parseInt(version.major)+1;
		version.minor = 0;
		version.batch = 0;
	}
	else if (this.isMinor)
	{
		version.minor = parseInt(version.minor)+1;
		version.batch = 0;
	}
	else
	{
		version.batch = parseInt(version.batch)+1;
	}
	return version;
};

XCodeBuilder.prototype.willBuild = function(callback)
{
	this.setVersion(callback);
};

XCodeBuilder.prototype.privDSAFilePath = function()
{
	return path.join(this.projectDirectory, this.buildConfig.dsaFileName || 'dsa_priv.pem');
};

XCodeBuilder.prototype.didBuild = function(callback)
{
	var zipFilePath = path.join( this.xcodeProject.outputDirectory, this.xcodeProject.zipFileName());
	this.sparkler = new Sparkler(zipFilePath,  this.privDSAFilePath(), this.xcodeProject.versionString());
	var _this = this;
	async.series(
		[
		function(callback){ _this.updateVersion(callback); },
		function(callback){ _this.sparkler.willSparkle(callback); },
		function(callback){ _this.sparkler.signZipFile(callback); },
		function(callback){ _this.sparkler.createAppcastXMLFile(callback); },
		function(callback){ _this.sparkler.didSparkle(callback); },

		],
		function(error)
		{
			callback(error);
		}
		);
};

XCodeBuilder.prototype.updateVersion = function(callback)
{
	console.log("pushing new tag version");
	var _this = this;
	var tag = _this.tagFromVersion(_this.newVersion);
	async.series(
		[
		function(callback){ _this.gitController.addTag(tag, callback); },
		function(callback){ _this.gitController.pushTag(tag, callback); }

		],
		function(error)
		{
			if (error)
			{
				console.log(error);
				callback('the latest branch already built, please commit new changes');
			}
			else
			{
				callback();
			}
		}
		);
}


XCodeBuilder.prototype.didGitProject = function(callback)
{
	this.projectDirectory = this.gitController.repoDirectory;
	this.buildConfig = this.loadBuildConfig();
	this.xcodeProject = new XCodeProject(this.projectName, this.branchName, this.projectDirectory, path.join(buildsDir, this.projectName, this.branchName, outputDirName), this.buildConfig);
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
		return {};
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