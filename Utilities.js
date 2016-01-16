'use strict';
var fs = require('fs');
var async = require('async');
var exec = require('child_process').exec;
var glob = require('glob');
var path = require('path');


exports.createFolder = function (folderPath, callback)
{
	async.waterfall(
		[
		function(callback)
		{
			fs.exists(folderPath, function(exists)
			{
				callback(null, exists);
			}
			);
		},
		function(alreadyExists, callback)
		{
			if (!alreadyExists)
			{
				console.log(folderPath, ' does not exists');
				fs.mkdir(folderPath, callback);
			}
			else
			{
				console.log(folderPath, ' already exists');
				callback();
			}
		}
		],
		function(error)
		{
			if (error)
			{
				callback(error);
			}
			else
			{
				callback();
			}
		}
		);
	
};

exports.stringEndsWith = function(string, substr)
{
	var targetIndex = string.lastIndexOf(substr);
	if (targetIndex != -1)
	{
		return string.length - targetIndex == substr.length;
	}
	else
	{
		return false;
	}
};

exports.deleteAllInDirExceptExtensions = function(dir, extensions, callback)
{
	var exceptExtensions = ''
	for (var i = 0 ; i < extensions.length ; i++)
	{
		var ext = extensions[i].replace('.', '');
		exceptExtensions += "|*."+ext;
	}
	exceptExtensions.replace('|', '');
	exceptExtensions = '!('+exceptExtensions+')';
	
	glob(exceptExtensions, {cwd: dir}, function (error, files) 
	{
		if(error)
		{
			callback(error);
		}
		else
		{
			files = files.map( function(file){ return path.join(dir, file); } );
			deletePaths(files, callback);
		}
	});
};

var deletePaths = function(paths, callback)
{
	async.each(paths, function(filePath, callback)
		{
			 fs.stat(filePath, function(error, stats)
			 	{
			 		if (error)
			 		{
			 			callback(error)
			 		}
			 		else if ( stats.isDirectory() )
			 		{
			 			deleteFolder(filePath, callback);
			 		}
			 		else
			 		{
			 			deleteFile(filePath, callback);
			 		}
			 	});
			
			
		},
		function(error)
		{
			callback(error);
		});
};

var deleteFolder = function(folderPath, callback)
{
	exec("rm -rf '"+folderPath+"'", function(error, stdout, stderr)
		{
			callback();
		}
	);
};

var deleteFile = function(filePath, callback)
{
	fs.unlink(filePath, callback);
};
