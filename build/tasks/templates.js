/**
 * Task: template
 * Description:
 * Dependencies: grunt, fs, consolidate, any templates being rendered
 */

module.exports = function(grunt) {

  // Grunt utilities
  var file      = grunt.file,
      log       = grunt.log,
      kindOf    = grunt.util.kindOf
      _         = grunt.util._;

  // external dependencies
  var Handlebars  = require('handlebars'),
      path        = require('path'),
      fs          = require('fs'),
      util        = require('util');

  var extensions = {
    "handlebars"  : "handlebars",
    "hbt"         : "handlebars",
    "hb"          : "handlebars",
    "handlebar"   : "handlebars",
    "mustache"    : "handlebars"
  };

  grunt.registerMultiTask('templates', 'Compile template files to HTML with specified engines', function(){

    var helpers = require('grunt-lib-contrib').init(grunt);

    var defaults = {
      layout: '',
      partials: {},
      data: {}
    };

    var options = _.extend(defaults, this.data.options || {});
    logBlock("options: ", util.inspect(options));

    var data = this.data;

    // validate that the source object exists
    // and there are files at the source.
    if(!this.files[0].src) {
      grunt.warn('Missing src property.');
      return false;
    }
    if(this.files[0].src.length === 0) {
      grunt.warn('Source files not found.');
      return false;
    }

	console.log("SRC: " + this.files[0].src.length);

    var src = file.expand(this.files[0].src);

    // validate that the dest object exists
    if(!this.files[0].dest || this.files[0].dest.length === 0) {
      grunt.warn('Missing dest property.');
      return false;
    }
    var dest = path.normalize(this.files[0].dest);

    // find an engine to use
    var engine = data.engine || options.engine || getEngineOf(src);
    if(!engine) {
      grunt.warn('No compatible engine available');
      return false;
    }

    // validate that the layout file exists
    var layout = path.normalize(options.layout);
    if(!fs.existsSync(layout)) {
      grunt.warn('Layout file (' + layout + ') not found.');
      return false;
    }

    var partials      = file.expand(options.partials);
    var dataFiles     = file.expand(options.data);
    var fileExt       = extension(src);
    var filenameRegex = /[^\\\/:*?"<>|\r\n]+$/i;
    var fileExtRegex  = new RegExp("\." + fileExt + "$");

    log.writeln(fileExtRegex);

    var done = this.async();

    // clear out the partials and data objects on options
    options.partials = {};
    options.data = {};

    // load layout
    var layoutName = _.first(layout.match(filenameRegex)).replace(fileExtRegex,'');
    layout = fs.readFileSync(layout, 'utf8');
    layout = Handlebars.compile(layout);

    // load partials if specified
    if(partials && partials.length > 0) {
      log.writeln(('\n' + 'Begin processing partials...').grey);

      partials.forEach(function(filepath) {
        var filename = _.first(filepath.match(filenameRegex)).replace(fileExtRegex, '');
        log.writeln(('Processing ' + filename + ' partial').cyan);
        var partial = fs.readFileSync(filepath, 'utf8');
        partial = Handlebars.compile(partial);

        // register the partial with handlebars
        Handlebars.registerPartial(filename, partial);

      });
      log.writeln('\n');
    }

    // load data if specified
    if(dataFiles && dataFiles.length > 0) {
      log.writeln(('\n' + 'Begin processing data...').grey);

      dataFiles.forEach(function(filepath) {
        var filename = _.first(filepath.match(filenameRegex)).replace(/\.json/,'');
        log.writeln(('Processing ' + filename + ' data').cyan);

        if(filename === 'data') {
          // if this is the base data.json file, load it into the options.data object directly
          options.data = _.extend(options.data || {}, file.readJSON(filepath));
        } else {
          // otherwise it's an element in options.data
          var d = file.readJSON(filepath);
          if(d[filename]) {
            // json object contains root object name so extend it in options.json
            options.data[filename] = _.extend(options.data[filename] || {}, d[filename]);
          } else {
            // add the entire object
            options.data[filename] = _.extend(options.data[filename] || {}, d);
          }
        }

      });
      log.writeln('\n');
      logBlock("options.data", util.inspect(options.data));
    }

    options.layout = layout;
    options.layoutName = layoutName;

    // build each page
    log.writeln(('\n' + 'Building pages...').grey);

    var basePath = src;//helpers.findBasePath(src, true);

    src.forEach(function(srcFile) {
      srcFile = path.normalize(srcFile);
      filename = path.basename(srcFile).replace(fileExtRegex,'');

      log.writeln(('Processing ' + filename + ' page').cyan);

      relative = path.dirname(srcFile);
      relative = _(relative).strRight(basePath).trim(path.sep);
      relative = relative.replace(/\.\.(\/|\\)/g, '');

	  console.log("Dest: " + dest);
	  console.log("Relative: " + relative);
	  console.log("Filename: " + filename);

      destFile = path.join(dest, filename + '.html');

      log.writeln(('\t' + 'Src: ' + srcFile));
      log.writeln(('\t' + 'Dest: ' + destFile));

      build(srcFile, filename, options, function(err, result) {
        err && grunt.warn(err) && done(false);
        if(err) return;

        file.write(destFile, result);
        log.writeln('File ' + filename.magenta + ' created.');

      });

    });

  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  var build = function(src, filename, options, callback) {

    var page                = fs.readFileSync(src, 'utf8'),
        layout              = options.layout,
        context             = {};
        context.layoutName  = _(options.layoutName).humanize();
        context.pageName    = _(filename).humanize();
        context[filename]   = 'active';
        context.production  = options.production;

    try {
      page = Handlebars.compile(page);
      Handlebars.registerPartial("body", page);

      context = _.extend(context, options.data);
      page = layout(context);

      callback(null, page);
    } catch(err) {
      callback(err);
      return;
    };
  };

  var detectDestType = function(dest) {
    if(_.endsWith(dest, path.sep)) {
      return "directory";
    } else {
      return "file";
    }
  };

  var logBlock = function(heading, message) {
    log.writeln(heading.cyan);
    log.writeln(message);
    log.writeln();
  };

  var getEngineOf = function(fileName) {
    var ext = extension(fileName);
    return  _( _(extensions).keys() ).include(ext) ? extensions[ext] : false;
  }

  var extension = function(fileName) {
    log.writeln('extension');
    log.writeln(fileName);
    if(kindOf(fileName) === "array" && fileName.length > 0) {
      fileName = fileName[0];
    }
    return _(fileName.match(/[^.]*$/)).last();
  }

};