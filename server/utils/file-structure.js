'use strict';

// Config:
var config = require('./get-config')();

// Utilities:
var _ = require('lodash');
var constants = require('../constants');
var errorHandler = require('./error-handler');
var path = require('path');
var Promise = require('bluebird');

// Dependencies:
var jsondir = Promise.promisifyAll(require('jsondir'));

module.exports = {
    createModifier: createModifier,
    deletePaths: deletePaths,
    findDirectory: findDirectory,
    findFile: findFile,
    getExtension: getExtension,
    getFileNames: getFileNames
};

function createModifier (options) {
    var preModifier = options && options.pre;
    var postModifier = options && options.post;

    return function (request, response) {
        getFileStructure(config.testDirectory)
        .then(function (fileStructure) {
            if (preModifier) {
                return saveFileStructure(preModifier(fileStructure, request))
                .then(function () {
                    return getFileStructure(config.testDirectory);
                });
            }
            return fileStructure;
        })
        .then(function (newFileStructure) {
            newFileStructure = postModifier ? postModifier(newFileStructure, request) : newFileStructure;
            response.send(JSON.stringify(newFileStructure));
        })
        .catch(function (error) {
            errorHandler(response, error, 'Operation failed.');
        });
    };
}

function getFileStructure (directoryPath) {
    return jsondir.dir2jsonAsync(directoryPath, {
        attributes: ['content']
    })
    .then(function (fileStructure) {
        return getFileUsages(organiseFileStructure(fileStructure));
    });
}

function saveFileStructure (fileStructure) {
    debugger;
    return jsondir.json2dirAsync(disorganiseFileStructure(fileStructure), {
        nuke: true
    });
}

function organiseFileStructure (directory, fileStructure) {
    fileStructure = fileStructure || directory;
    fileStructure.allFiles = fileStructure.allFiles || [];

    var skip = ['name', '-name', 'path', '-path', '-type', 'allFiles', 'files', 'directories', 'isDirectory'];
    _.each(directory, function (item, name) {
        if (item['-type'] === 'd') {
            // Directory:
            directory.directories = directory.directories || [];
            item.isDirectory = true;
            item.name = name;
            item.path = item['-path'];
            directory.directories.push(organiseFileStructure(item, fileStructure));

            delete directory[name];
        } else if (!_.contains(skip, name)) {
            // File:
            // Skip hidden files (starting with ".")...
            if (!/^\./.test(name)) {
                directory.files = directory.files || [];
                item.name = _.last(/(.*?)\./.exec(name));
                item.path = item['-path'];
                item.content = item['-content'];
                directory.files.push(item);
                fileStructure.allFiles.push(item);
            }

            delete directory[name];
        }

        delete item['-content'];
        delete item['-path'];
        delete item['-type'];
    });
    directory.path = directory['-path'];

    delete directory['-name'];
    delete directory['-path'];
    delete directory['-type'];

    return directory;
}

function disorganiseFileStructure (directory) {
    directory['-path'] = directory.path;
    directory['-type'] = 'd';

    (directory.files || []).forEach(function (file) {
        var extension = _.last(/(\..*)$/.exec(file.path));
        directory[file.name + extension] = {
            '-content': file.content,
            '-path': file.path,
            '-type': '-'
        };
    });

    (directory.directories || []).forEach(function (subDirectory) {
        directory[subDirectory.name] = disorganiseFileStructure(subDirectory);
    });

    delete directory.path;
    delete directory.files;
    delete directory.directories;
    delete directory.allFiles;
    delete directory.usages;
    delete directory.isDirectory;
    return directory;
}

function deletePaths (directory) {
    delete directory['-path'];
    _.each(directory, function (item) {
        delete item['-path'];
        if (item['-type'] === 'd') {
            item = deletePaths(item);
        }
    });
    return directory;
}

function findDirectory (directory, directoryPath) {
    if (directory['-path'] === directoryPath) {
        return directory;
    }
    var dir;
    _.each(directory, function (item) {
        if (!dir && item['-type'] === 'd') {
            if (item['-path'] === directoryPath) {
                dir = item;
            } else {
                dir = findDirectory(item, directoryPath);
            }
        }
    });
    return dir;
}

function findFile (directory, filePath) {
    var file;
    _.each(directory, function (item) {
        if (!file) {
            if (item['-path'] === filePath) {
                file = item;
            } else if (item['-type'] === 'd') {
                file = findFile(item, filePath);
            }
        }
    });
    return file;
}

function getFileNames (directoryPath, extension) {
    return jsondir.dir2jsonAsync(directoryPath)
    .then(function (fileStructure) {
        return getFileNamesInDirectory(fileStructure)
        .filter(function (name) {
            return !extension || name.match(new RegExp(extension + '$'));
        });
    });
}

function getExtension (directoryPath) {
    var extension = '';
    do {
        var directoryName = path.basename(directoryPath);
        var extensionKey = directoryName.toUpperCase() + '_EXTENSION';
        extension = constants[extensionKey];
        directoryPath = path.dirname(directoryPath);
    } while (!extension)
    return extension;
}

function getFileNamesInDirectory (directory, names) {
    names = names || [];
    _.each(directory, function (item, name) {
        if (item['-type'] === 'd') {
            // Directory:
            getFileNamesInDirectory(item, names);
        } else if (name !== '-type' && name !== '-path') {
            // File:
            names.push(name);
        }
    });
    return names;
}

function getFileUsages (fileStructure)  {
    var usages = {};
    var match;
    fileStructure.allFiles.forEach(function (file) {
        var findRequires = /require\([\'\"]([\.\/].*?)[\'\"]\)/gm;
        while ((match = findRequires.exec(file.content)) !== null) {
            var usedPath = path.resolve(path.dirname(file.path), _.last(match));
            usages[usedPath] = usages[usedPath] || [];
            usages[usedPath].push(file.path);
        }
    });
    fileStructure.usages = usages;
    return fileStructure;
}
