/*
 * grunt-contrib-coffee
 * http://gruntjs.com/
 *
 * Copyright (c) 2012 Álvaro Vilanova Vidal
 * Licensed under the MIT license.
 */

module.exports = function(grunt) {
  'use strict';

  var fs = require('fs');
  var os = require('os');
  var path = require('path');
  var helpers = require('grunt-lib-contrib').init(grunt);

  // TODO: ditch this when grunt v0.4 is released
  grunt.util = grunt.util || grunt.utils;

  var withTscCommand = function (cmdpath, cb) {
    var cmd = cmdpath || 'tsc';
    grunt.util.spawn({'cmd': cmd}, function (error) {
      if (error) {
        grunt.fatal(cmd + ' cannot be run. Try ' + 'npm install -g typescript'.cyan);
      }
      else {
        cb(cmd);
      }
    });
  };

  var cmdToString = function (cmd) {
    var args = grunt.util._.reduce(cmd.args, function (m, s) { return m + ' ' + s; }, '');
    return cmd.cmd + args;
  };

  var isAmbientFile = function (filepath) {
    var ends = grunt.util._.endsWith;
    return ends(filepath, '.d.ts') || ends(filepath, '.d.js');
  };

  var isDirTarget = function (trgpath) {
    return grunt.util._.last(trgpath) === path.sep;
  };

  var isMultiTarget = function (trgpath) {
    var paths = grunt.file.expand(trgpath);
    if (paths.length > 1) {
      return true;
    }
    else {
      var p = (paths.length === 1) ? paths[0] : trgpath;
      return grunt.util._.str.include(p, '*') || isDirTarget(p);
    }
  };

  // TODO: Use _.omit when grunt 0.4 is released
  var removeInvalidOpts = function (options) {
    var copy = {};
    var keys = ['tsc', 'basePath', 'flatten', 'out', 'exec'];
    for (var key in options) {
      if (!grunt.util._.contains(keys, key)) {
        copy[key] = options[key];
      }
    }
    return copy;
  };

  var compile = function (tscpath, srcs, trg, options, baseOutputPath, cb) {
    if (srcs.length === 1) {
      compileOneToOne(tscpath, srcs[0], trg, options, baseOutputPath, cb);
    }
    else if (srcs.length > 1) {
      compileManyToOne(tscpath, srcs, trg, options, baseOutputPath, cb);
    }
    else {
      cb();
    }
  };

  var tmpPath = function (filepath) {
    var rndstr = (Math.floor(Math.random() * 1000000)).toString();
    var name = rndstr + path.basename(filepath);
    return path.join(os.tmpDir(), name);
  };

  var jsPath = function (filepath) {
    return path.join(path.dirname(filepath),
                     path.basename(filepath, path.extname(filepath)) + ".js");
  };

  var optsToTscArgs = function (options) {
    options = removeInvalidOpts(options);

    if (options.reference) {
      var files = grunt.file.expand(options.reference);
      options.reference = files;
    }

    return helpers.optsToArgs(options);
  };

  var checkCompilerOutput = function (trg, error, result, success) {
    if (error) {
      grunt.warn(result.stderr);
      grunt.warn(result.stdout);
    }
    else {
      grunt.log.write(trg + "...");
      grunt.log.ok();
      if (grunt.util._.isFunction(success)) {
        success();
      }
    }
  };

  var compileOneToOne = function (tscpath, src, trg, options, baseOutputPath, cb) {
    var cmd = {
      cmd : tscpath,
      args : [src]
    };
    cmd.args.push.apply(cmd.args, optsToTscArgs(options));
    grunt.verbose.writeln(cmdToString(cmd));

    var backupPath = '';
    var srcpath = jsPath(src);
    if (fs.existsSync(srcpath)) {
      backupPath = tmpPath(srcpath);
      grunt.file.copy(srcpath, backupPath);
    }

	if (baseOutputPath){
		trg = srcpath.replace(baseOutputPath,trg);
	}

    grunt.util.spawn(cmd, function (error, result) {
      checkCompilerOutput(trg, error, result, function () {
        grunt.file.copy(srcpath, trg);
        fs.unlinkSync(srcpath);
      });
      if (backupPath.length > 0) {
        grunt.file.copy(backupPath, srcpath);
      }
      cb();
    });
  };

  var compileManyToOne = function (tscpath, srcs, trg, options, baseOutputPath, cb) {
	srcs.forEach(function(src){
		compileOneToOne(tscpath, src, trg, options, baseOutputPath, cb);
	});
  };

  grunt.registerMultiTask('typescript', 'Compile TypeScript files to JavaScript', function() {
    var done = this.async();

	var self = this;
	var baseOutputPath = null;
	
	if (this.data.options && this.data.options.baseOutputPath){
		baseOutputPath = this.data.options.baseOutputPath;
	}

    var options = helpers.options(this, {
      basePath          : '',
      comments          : false,
      const             : false,
      //declarations      : false,
      flatten           : false,
      minw              : false,
      module            : 'commonjs',
      noerroronwith     : false,
      nolib             : false,
      nooptimizemodules : false,
      noresolve         : false,
      //reference         : false,
      //sourcemap         : false,
      style             : false,
      target            : 'ES3',
      tsc               : ''
    });
    grunt.verbose.writeflags(options, 'Options');

    // TODO: ditch this when grunt v0.4 is released
    this.files = this.files || helpers.normalizeMultiTaskFiles(this.data, this.target);

    // Compute compiler pases
    var files = grunt.util._.map(this.files, function (file) {
      var dest = path.normalize(file.dest);
      var srcs = grunt.file.expand(file.src);
      if (isMultiTarget(dest)) {
        var basePath = helpers.findBasePath(srcs, options.basePath);
        return grunt.util._.map(srcs, function (src) {
          var trg = helpers.buildIndividualDest(dest, src, basePath, options.flatten);
          if (isDirTarget(dest)) {
            trg = path.join(dest, trg);
          }
          grunt.file.mkdir(path.dirname(trg));
          return {dest: trg, src: [src]};
        });
      }
      else {
        return {dest: dest, src: srcs};
      }
    });

    // Normalize pases
    files = grunt.util._.compact(grunt.util._.flatten(files));

    // Ignore ambient compilation pases
    files = grunt.util._.reject(files, function (file) {
      return isAmbientFile(file.dest);
    });

	var count = files[0].src.length;
	var almostDone = grunt.util._.after(count, done);

    // Execute pases in parallel
    withTscCommand(options.tsc, function (tsc) {
      grunt.util.async.forEachLimit(files, os.cpus().length, function (file, finish) {
		var dest = file.dest;
		
		if (dest.indexOf("*.js")!=-1){
			dest = path.dirname(file.dest);
		}
		else{
			//dest = "deploy/assets/scripts"
		}
		
        grunt.file.mkdir(dest);
        compile(tsc, file.src, dest, options, baseOutputPath, function () {
          finish();
          almostDone();
        });
      });
    });
  });
};

