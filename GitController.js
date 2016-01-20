'use strict';
var exec = require('child_process').exec;
var async = require('async');
var path = require('path');
var fs = require('fs');

var GitController = function(directory, repoURL, branchName)
{
	this.directory = directory;
	this.repoDirectory = directory;
	this.repoURL = repoURL;
	this.branchName = branchName;
};

GitController.prototype.prepare = function(callback)
{
	this.setRepoDirectory(callback);
};

GitController.prototype.setRepoDirectory = function(callback)
{
	var _this = this;
	async.waterfall(
		[
		function(callback)
		{
			fs.readdir(_this.directory, callback);
		}, 
		function(files, callback)
		{
			for (var index in files)
			{
				if (files[index].toLowerCase().indexOf('ds_store') == -1)
				{
					callback(null, files[index]);
					break;
				}
			}
			callback(null, null);
		}, 
		function(firstFolder, callback)
		{
			if (firstFolder)
			{
				_this.repoDirectory = path.join(_this.directory, firstFolder);
			}
			callback();
		}
		],
		function(error, result)
		{
			if (error)
			{
				callback('Failed to set repo directory!');
			}
			else
			{
				callback();
			}
		}
		);
};



GitController.prototype.clone = function(callback)
{
	console.log('clonning git repo');
	var _this = this;
	async.waterfall(
		[
		function(callback)
		{
			_this.getCurrentRepoURL(callback);
		}, 
		function(currentRepoURL, callback)
		{
			if (currentRepoURL != _this.repoURL)
			{
				_this.executeCommand('git clone -b '+_this.branchName+' '+_this.repoURL,  function(error, stdout) 
				{
					if (error) 
					{
						callback(error);
					}
					else
					{
						_this.setRepoDirectory(callback);
					}
				});
			}
			else
			{
				callback();
			}
		}
		],
		function(error)
		{
			if (error)
			{
				callback("Failed to clone project");
			}
			else
			{
				callback();
			}
		}
		);
};

GitController.prototype.getCurrentRepoURL = function(callback)
{
	console.log('getting current repo URL');
	this.executeCommand('git config --get remote.origin.url', function(error, stdout) 
	{
		if (error)
		{
			callback(null, null);
		}
		else
		{
			stdout = stdout.replace(/\s+/g,'');
			callback(null, stdout);
		}
	});
};


GitController.prototype.getCurrentBranchName = function(callback)
{
	console.log('getting current branch');
	this.executeCommand('git name-rev --name-only HEAD', function(error, stdout) 
	{
		if (error)
		{
			callback(null, null);
		}
		else
		{
			stdout = stdout.replace(/\s+/g,'');
			callback(null, stdout);
		}
	});
};

GitController.prototype.checkout = function(callback)
{
	console.log('checking out');
	var _this = this;
	async.waterfall(
		[
		function(callback)
		{
			_this.getCurrentBranchName(callback);
		}, 
		function(currentBranch, callback)
		{
			if (currentBranch != _this.branchName)
			{
				_this.executeCommand('git checkout '+_this.branchName, function(error, stdout) 
				{
					console.log('git checkout: ' + stdout);
					if(error) 
					{
						console.log(error);
						callback(error);
					}
					else 
					{
						callback();
					}
				});
			}
			else
			{
				callback();
			}
		}
		],
		function(error)
		{
			if (error)
			{
				callback("Failed to checout");
			}
			else
			{
				callback();
			}
		}
		);
};

GitController.prototype.pull = function(callback)
{
	console.log('pulling');
	this.executeCommand('git pull', function(error, stdout) 
	{
		console.log('git checkout: ' + stdout);
		if(error) 
		{
			console.log(error);
			callback('Failed to pull!');
		}
		else 
		{
			callback();
		}
	});
};

GitController.prototype.getLastTag = function(callback)
{
	this.executeCommand('git describe --tags $(git rev-list --tags --max-count=1)', function(error, stdout) 
	{
		console.log('git last tag: ' + stdout);
		stdout = stdout || '';
		stdout = stdout.replace(/\s+/g,'');
		callback(null, stdout);
	});
};


GitController.prototype.addTag = function(tag, callback)
{
	console.log('adding tag');
	this.executeCommand('git tag '+tag, function(error, stdout) 
	{
		if(error) 
		{
			callback(error);
		}
		else 
		{

			callback(stdout);
		}
	});
};


GitController.prototype.pushTag = function(tag, callback)
{
	console.log('pushing tag');
	this.executeCommand('git push origin '+tag, function(error, stdout) 
	{
		if(error) 
		{
			callback(error);
		}
		else 
		{
			callback();
		}
	});
};

GitController.prototype.getCurrentCommitID = function(callback)
{
	
	this.executeCommand( 'git rev-parse HEAD', function(error, stdout) 
	{
		if(error) 
		{
			callback(error);
		}
		else 
		{
			stdout = stdout.replace(/\s+/g,'');
			callback(null, stdout);
		}
	});
};

GitController.prototype.getCommitIDWithTag = function(tag, callback)
{
	this.executeCommand( 'git rev-list -1 ' + tag, function(error, stdout) 
	{
		if(error) 
		{
			callback(error);
		}
		else 
		{
			stdout = stdout.replace(/\s+/g,'');
			callback(null, stdout);
		}
	});
};


GitController.prototype.executeCommand = function(command, callback)
{
	console.log('execute command: ', command);
	exec(command, {cwd: this.repoDirectory}, function(error, stdout, stderr) 
	{
		if(error) 
		{
			console.log('error');
			console.log(stderr);
			callback(error);
		}
		else 
		{
			console.log('command result: ', stdout);
			callback(null, stdout);
		}
	});
};



exports.GitController = GitController;
