/*
 * Assemble
 * https://github.com/assemble/
 *
 * Copyright (c) 2013 Upstage
 * Licensed under the MIT license.
 */

module.exports = function(grunt) {

  // Grunt utils
  var file   = grunt.file;
  var log    = grunt.log;
  var kindOf = grunt.util.kindOf;
  var _      = grunt.util._;

  // Node utils
  var path   = require('path');
  var fs     = require('fs');
  var util   = require('util');

  // NPM utils
  var lodash = require('lodash'); // required to ensure correct version is used

  // Assemble utils
  var assemble   = require('./assemble-util-tools');
  var utils      = assemble.Utils;
  var extensions = utils.ExtensionMap;


  grunt.registerMultiTask('assemble', 'Compile template files with specified engines', function(){
    var done = this.async();
    var self = this;

    // functions for use in build steps
    var optionsConfiguration = function(assemble, next) {
      grunt.log.writeln('validating options');

      var src = false;
      assemble.files.forEach(function(fp) {
        if(!src) {
          src = fp.src;
        }
      });

      if(!src || src.length === 0) {
        grunt.warn('No source files found.');
        done(false);
      }

      // find an engine to use
      assemble.options.engine = assemble.options.engine || getEngineOf(src);
      if(!assemble.options.engine) {
        grunt.warn('No compatible engine available');
        done(false);
      }

      if (assemble.options.engine=="handlebars"){
        var Swag = require("swag");
      }

      assemble.engineLoader = utils.EngineLoader(assemble.options);
      var engine = null;
      assemble.engineLoader.getEngine(function(err, results) {
        if(err) {
          console.log(err);
          return;
        }
        engine = assemble.engine = results;
      });

      assemble.yamlPreprocessor = assemble.engineLoader.getPreprocessor('YamlPreprocessor');

      assemble.fileExt = extension(src);
      assemble.filenameRegex = /[^\\\/:*?"<>|\r\n]+$/i;
      assemble.fileExtRegex = new RegExp("\\." + assemble.fileExt + "$");

      assemble.partials = file.expand(assemble.options.partials);
      assemble.options.partials = {};

      assemble.dataFiles = file.expand(assemble.options.data);
      assemble.options.data = {};

      next(assemble);
    };

    var assembleDefaultLayout = function(assemble, next) {
      grunt.log.writeln('assembling default layout');

      // load default layout
      var defaultLayoutData = {};

      loadLayout(
        assemble.options.layout,
        assemble,
        function(err, results) {
          if(!err) {
            assemble.options.defaultLayoutName = results.layoutName;
            assemble.options.defaultLayout = results.layout;
            defaultLayoutData = results.data;
          } else {
            grunt.warn(err.message);
          }
        });

      // merge any layoutData with options
      assemble.options.data = _.extend(defaultLayoutData.context, assemble.options.data || {});

      next(assemble);
    };

    var assemblePartials = function(assemble, next) {
      grunt.log.writeln('assembling partials');

      var complete = 0;
      var increment = 10;

      // load partials if specified
      var partials = assemble.partials;
      if(partials && partials.length > 0) {
        complete = 0;
        increment = Math.round(partials.length / 10);
        grunt.log.write(('\n' + 'Processing partials...').grey);

        partials.forEach(function(filepath) {
          var filename = _.first(filepath.match(assemble.filenameRegex)).replace(assemble.fileExtRegex, '');
          grunt.verbose.writeln(('Processing ' + filename + ' partial').cyan);
          if(complete%increment === 0) {
            grunt.log.write('.'.cyan);
          }

          var partial = fs.readFileSync(filepath, 'utf8');

          partial = assemble.engine.compile(partial, {
            preprocessers: [
              assemble.yamlPreprocessor(filename, function(output) {
                assemble.options.data[output.name] = _.extend(output.output.context, assemble.options.data[output.name] || {});
              })
            ]
          });

          // register the partial with the engine
          assemble.engine.engine.registerPartial(filename, partial);
          complete++;
        });
        grunt.log.notverbose.writeln('\n');
      }

      next(assemble);
    };

    var assembleData = function(assemble, next) {
      grunt.log.writeln('assembling data');

      // load data if specified
      var dataFiles = assemble.dataFiles;
      if(dataFiles && dataFiles.length > 0) {
        complete = 0;
        increment = Math.round(dataFiles.length / 10);
        grunt.log.writeln(('\n' + 'Begin processing data...').grey);

        dataFiles.forEach(function(filepath) {
          var ext = path.extname(filepath);
          var filename = path.basename(filepath, ext);

          var fileReader = dataFileReaderFactory(ext);

          if(complete%increment === 0) {
            grunt.log.notverbose.write('.'.cyan);
          }

          if(filename === 'data') {
            // if this is the base data file, load it into the options.data object directly
            assemble.options.data = _.extend(assemble.options.data || {}, fileReader(filepath));
          } else {
            // otherwise it's an element in options.data
            var d = fileReader(filepath);
            if(d[filename]) {
              // json object contains root object name so extend it in options.json
              assemble.options.data[filename] = _.extend(assemble.options.data[filename] || {}, d[filename]);
            } else {
              // add the entire object
              assemble.options.data[filename] = _.extend(assemble.options.data[filename] || {}, d);
            }
          }
          complete++;
        });
        grunt.log.writeln('\n');
      }

      next(assemble);
    };

    var assemblePages = function(assemble, next) {
      // build each page
      grunt.log.writeln(('\n' + 'Building pages...').grey);

      var src = false;

      var pages = [];
      var tags = [];
      var categories = [];
      var assetsPath = assemble.options.assets;

      assemble.task.files.forEach(function(filePair) {

        // validate that the source object exists
        // and there are files at the source.
        if(!filePair.src) {
          grunt.warn('Missing src property.');
          return false;
        }
        if(filePair.src.length === 0) {
          grunt.warn('Source files not found.');
          return false;
        }

        // validate that the dest object exists
        if(!filePair.dest || filePair.dest.length === 0) {
          grunt.warn('Missing dest property.');
          return false;
        }

        src = src || filePair.src;
        var basePath = findBasePath(src, true);

        // some of the following code for figuring out
        // the destination files has been taken/inspired
        // by the grunt-contrib-copy project
        //https://github.com/gruntjs/grunt-contrib-copy
        var isExpandedPair = filePair.orig.expand || false;
        var destFile;

        filePair.src.forEach(function(srcFile) {

          srcFile  = path.normalize(srcFile);
          filename = path.basename(srcFile, path.extname(srcFile));

          if(detectDestType(filePair.dest) === 'directory') {
            destFile = (isExpandedPair) ?
                        filePair.dest :
                        path.join(filePair.dest,
                                  (assemble.options.flatten ?
                                    path.basename(srcFile) :
                                    srcFile));
          } else {
            destFile = filePair.dest;
          }

          destFile = path.join(path.dirname(destFile),
                               path.basename(destFile, path.extname(destFile))
                              ) + assemble.options.ext;

          grunt.verbose.writeln('Reading ' + filename.magenta);

          // setup options.assets so it's the relative path to the
          // dest assets folder from the new dest file
          // TODO: this needs to be looked at again after the
          // other dest changes
          grunt.verbose.writeln('AssetsPath: ' + assetsPath);
          grunt.verbose.writeln('DestFile: ' + path.dirname(destFile));
          assemble.options.assets = urlNormalize(
            path.relative(
              path.resolve(path.dirname(destFile)),
              path.resolve(assetsPath)
            ));

          grunt.verbose.writeln(('\t' + 'Src: '    + srcFile));
          grunt.verbose.writeln(('\t' + 'Dest: '   + destFile));
          grunt.verbose.writeln(('\t' + 'Assets: ' + assemble.options.assets));

          var page = fs.readFileSync(srcFile, 'utf8');
          try {
            grunt.verbose.writeln('compiling page ' + filename.magenta);
            var pageContext = {};

            page = assemble.engine.compile(page, {
              preprocessers: [
                assemble.yamlPreprocessor(filename, function(output) {
                  grunt.verbose.writeln(output.name + ' data retreived');
                  pageContext = output.output.context;
                })
              ]
            });

            //Modify the destFile output based on the option "pathFilter"
            destFile = destFile.replace(assemble.options.pathFilter, "");

            var pageObj = {
              filename: filename,
              basename: filename,
              src: srcFile,
              dest: destFile,
              assets: assemble.options.assets,
              ext: assemble.options.ext,
              page: page,
              data: pageContext
            };

            pages.push(pageObj);

            tags = updateTags(tags, pageObj, pageContext);
            categories = updateCategories(categories, pageObj, pageContext);

          } catch(err) {
            grunt.warn(err);
            return;
          }
        }); // filePair.src.forEach
      }); // this.files.forEach

      grunt.verbose.writeln('information compiled');

      assemble.options.pages = pages;
      assemble.options.tags = tags;
      assemble.options.categories = categories;


      next(assemble);
    };

    var renderPages = function(assemble, next) {

      grunt.log.writeln(('\n' + 'Rendering pages...').grey);

      var html_tidy_options = {
        'max_char': 0,
        'indent_size': 4,
        'indent_char': ' ',
        'brace_style': 'end-expand',
        'indent_scripts': 'keep'
      };

      assemble.options.pages.forEach(function(page) {

        grunt.verbose.writeln(require('util').inspect(page));

        build(page, assemble, function(err, result) {
          if(err) {
            grunt.warn(err);
            done(false);
            return;
          }

          //HTML TIDY!
          var output = style_html(result, html_tidy_options);

          file.write(page.dest, output);
          grunt.log.ok('File ' + (page.basename + page.ext).magenta + ' created.' + ' ok '.green);
        }); // build

      });

      next(assemble);
    };

    //done();

    // assemble everything
    var assembler = assemble.init(this)
        .step(optionsConfiguration)
        .step(assembleDefaultLayout)
        .step(assemblePartials)
        .step(assembleData)
        .step(assemblePages)
        .step(renderPages)
        .build(function(err, results) {
          if(err) {
            grunt.warn(err);
            done(false);
          }
          done();
        });

  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  var findBasePath = function(srcFiles, basePath) {
    if (basePath === false) {
      return '';
    }

    if (grunt.util.kindOf(basePath) === 'string' && basePath.length >= 1) {
      return grunt.util._(path.normalize(basePath)).trim(path.sep);
    }

    var foundPath;
    var basePaths = [];
    var dirName;

    srcFiles.forEach(function(srcFile) {
      srcFile = path.normalize(srcFile);
      dirName = path.dirname(srcFile);

      basePaths.push(dirName.split(path.sep));
    });

    basePaths = grunt.util._.intersection.apply([], basePaths);

    foundPath = path.join.apply(path, basePaths);

    if (foundPath === '.') {
      foundPath = '';
    }

    return foundPath;
  };


  var build = function(currentPage, assemble, callback) {

    var src = currentPage.srcFile;
    var filename = currentPage.filename;
    var options = assemble.options;

    grunt.verbose.writeln('currentPage: ' + currentPage);
    var page           = currentPage.page,
        pageContext    = currentPage.data,
        layout         = options.defaultLayout,
        data           = options.data,
        pages          = options.pages,
        engine         = options.engine,
        EngineLoader   = options.EngineLoader,
        context        = {};

    context.layoutName = _(options.defaultLayoutName).humanize();
    context.pageName   = _(filename).humanize();
    context.pageName   = filename;

    grunt.verbose.writeln('variables loaded');

    //options.data = null;

    try {

      // omit the tags and categories from pageContext when merging
      var pageTags = pageContext.tags || [];
      var pageCategories = pageContext.categories || [];
      pageContext = lodash.omit(pageContext, ['tags', 'categories']);

      options.data   = undefined;
      options.pages  = undefined;
      options.layout = undefined;
      context        = _.extend(context, options, data, pageContext);
      options.data   = data;
      options.pages  = pages;


      // if pageContext contains a layout, use that one instead
      // of the default layout
      if(pageContext && pageContext.layout) {

        var pageLayoutName = null,
            pageLayout = null,
            pageLayoutContext = {};

        context = processContext(grunt, context);

        loadLayout(
          context.layout,
          assemble,
          function(err, results) {
            if(!err) {
              pageLayoutName = results.layoutName;
              pageLayout = results.layout;
              pageLayoutContext = results.data.context;
            } else {
              grunt.warn(err.message);
            }
          }
        );

        if(pageLayout) {
          layout = pageLayout;
          context.layoutName = pageLayoutName;
          data = _.extend(data, pageLayoutContext);

          // extend again
          options.data   = undefined;
          options.pages  = undefined;
          options.layout = undefined;
          context        = _.extend(context, options, data, pageContext);
          options.data   = data;
          options.pages  = pages;
        }
      }


      pageContext.tags = pageTags;
      pageContext.categories = pageCategories;

      context = processContext(grunt, context);

      //Add ability to set custom scripts for specific pages
      context.pageScripts = [];

      if (options.pageAssets && options.pageAssets[currentPage.filename]){
        context.pageScripts = options.production? currentPage.filename+".min.js" : options.pageAssets[currentPage.filename].scripts;
        context.styleSheets = options.pageAssets[currentPage.filename].styles;
      }


      // add the list of pages back to the context so
      // it's available in the templates
      context.pages = pages;
      context.currentPage = currentPage;

      // make sure the currentPage assets is used
      context.assets = currentPage.assets;

      // add a sections array to the engine to be used by
      // helpers
      assemble.engine.engine.sections = [];

      assemble.engine.engine.registerPartial("body", page);
      page = layout(context);

      callback(null, page);
    } catch(err) {
      callback(err);
      return;
    }
  };

  var processContext = function(grunt, context) {
      var originalConfigData = grunt.config.data;
      grunt.config.data = _.extend(originalConfigData, context);
      context = grunt.config.process(context);
      grunt.config.data = originalConfigData;

      return context;
  };

  var loadLayout = function(src, assemble, callback) {

    var loadFile = true;
    var layout = '';
    var layoutName = 'layout';

    // if the src is empty, create a default layout in memory
    if(src === '' || src.length === 0) {
      loadFile = false;
      layout = "{{>body}}";
    }

    if(loadFile) {
      // validate that the layout file exists
      grunt.verbose.writeln(src);
      layout = path.normalize(src);
      grunt.verbose.writeln(layout);

      if(!fs.existsSync(layout)) {
        var err = 'Layout file (' + layout + ') not found.';
        grunt.warn(err);
        if(callback) {
          callback({message: err}, null);
        }
        return false;
      }

      // load layout
      layoutName = _.first(layout.match(assemble.filenameRegex)).replace(assemble.fileExtRegex,'');
      layout = fs.readFileSync(layout, 'utf8');
    }

    var layoutData = {};
    layout = assemble.engine.compile(layout, {
      preprocessers: [
        assemble.yamlPreprocessor(layoutName, function(output) {
          grunt.verbose.writeln(output.name + ' data retreived');
          layoutData = output.output;
        })
      ]
    });

    var results = {
      layoutName: layoutName,
      layout: layout,
      data: layoutData
    };

    if(callback) {
      callback(null, results);
    }
    return results;
  };

  var detectDestType = function(dest) {
    if(_.endsWith(path.normalize(dest), path.sep)) {
      return "directory";
    } else {
      return "file";
    }
  };

  var logBlock = function(heading, message) {
    grunt.verbose.writeln(heading.cyan);
    grunt.verbose.writeln(message);
    grunt.verbose.writeln();
  };

  var getEngineOf = function(fileName) {
    var ext = extension(fileName);
    return  _( _(extensions).keys() ).include(ext) ? extensions[ext] : false;
  };

  var extension = function(fileName) {
    grunt.verbose.writeln('extension');
    grunt.verbose.writeln(fileName);
    if(kindOf(fileName) === "array" && fileName.length > 0) {
      fileName = fileName[0];
    }
    return _(fileName.match(/[^.]*$/)).last();
  };

  var urlNormalize = function(urlString) {
    return urlString.replace(/\\/g, '/');
  };

  var dataFileReaderFactory = function(ext) {
    var reader = grunt.file.readJSON;
    switch(ext) {
      case '.json':
        reader = grunt.file.readJSON;
        break;

      case '.yml':
      case '.yaml':
        reader = grunt.file.readYAML;
        break;
    }
    return reader;
  };

  var mergeOptionsArrays = function(target, name) {
    var globalArray = grunt.config(['assemble', 'options', name]) || [];
    var targetArray = grunt.config(['assemble', target, 'options', name]) || [];
    return _.union(globalArray, targetArray);
  };

  var updateTags = function(tags, page, context) {
    if(!context.tags) {
      return tags;
    }

    var pageTags = context.tags || [];
    if(toString.call(pageTags) !== '[object Array]') {
      pageTags = [pageTags];
    }

    pageTags.forEach(function(pageTag) {
      var tagIndex = lodash.findIndex(tags, function(tag) {
        return tag.tag === pageTag;
      });
      if(tagIndex === -1) {
        tags.push({ tag: pageTag, pages: [page] });
      } else {
        tags[tagIndex].pages.push(page);
      }
    });
    return tags;
  };

  var updateCategories = function(categories, page, context) {
    if(!context.categories) {
      return categories;
    }

    var pageCategories = context.categories || [];
    if(toString.call(pageCategories) !== '[object Array]') {
      pageCategories = [pageCategories];
    }

    pageCategories.forEach(function(pageCategory) {
      var categoryIndex = lodash.findIndex(categories, function(category) {
        return category.category === pageCategory;
      });
      if(categoryIndex === -1) {
        categories.push({ category: pageCategory, pages: [page] });
      } else {
        categories[categoryIndex].pages.push(page);
      }
    });
    return categories;
  };

};


























/*

 Style HTML
---------------

  Written by Nochum Sossonko, (nsossonko@hotmail.com)

  Based on code initially developed by: Einar Lielmanis, <elfz@laacz.lv>
    http://jsbeautifier.org/


  You are free to use this in any way you want, in case you find this useful or working for you.

  Usage:
    style_html(html_source);

    style_html(html_source, options);

  The options are:
    indent_size (default 4)          — indentation size,
    indent_char (default space)      — character to indent with,
    max_char (default 250)            -  maximum amount of characters per line (0 = disable)
    brace_style (default "collapse") - "collapse" | "expand" | "end-expand"
            put braces on the same line as control statements (default), or put braces on own line (Allman / ANSI style), or just put end braces on own line.
    unformatted (defaults to inline tags) - list of tags, that shouldn't be reformatted
    indent_scripts (default normal)  - "keep"|"separate"|"normal"

    e.g.

    style_html(html_source, {
      'indent_size': 2,
      'indent_char': ' ',
      'max_char': 78,
      'brace_style': 'expand',
      'unformatted': ['a', 'sub', 'sup', 'b', 'i', 'u']
    });
*/

function style_html(html_source, options) {
    //Wrapper function to invoke all the necessary constructors and deal with the output.

    var multi_parser,
    indent_size,
    indent_character,
    max_char,
    brace_style,
    unformatted;

    options = options || {};
    indent_size = options.indent_size || 4;
    indent_character = options.indent_char || ' ';
    brace_style = options.brace_style || 'collapse';
    max_char = options.max_char == 0 ? Infinity : options.max_char || 250;
    unformatted = options.unformatted || ['a', 'span', 'bdo', 'em', 'strong', 'dfn', 'code', 'samp', 'kbd', 'var', 'cite', 'abbr', 'acronym', 'q', 'sub', 'sup', 'tt', 'i', 'b', 'big', 'small', 'u', 's', 'strike', 'font', 'ins', 'del', 'pre', 'address', 'dt', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

    function Parser() {

        this.pos = 0; //Parser position
        this.token = '';
        this.current_mode = 'CONTENT'; //reflects the current Parser mode: TAG/CONTENT
        this.tags = { //An object to hold tags, their position, and their parent-tags, initiated with default values
            parent: 'parent1',
            parentcount: 1,
            parent1: ''
        };
        this.tag_type = '';
        this.token_text = this.last_token = this.last_text = this.token_type = '';

        this.Utils = { //Uilities made available to the various functions
            whitespace: "\n\r\t ".split(''),
            single_token: 'br,input,link,meta,!doctype,basefont,base,area,hr,wbr,param,img,isindex,?xml,embed,?php,?,?='.split(','), //all the single tags for HTML
            extra_liners: 'head,body,/html'.split(','), //for tags that need a line of whitespace before them
            in_array: function (what, arr) {
                for (var i = 0; i < arr.length; i++) {
                    if (what === arr[i]) {
                        return true;
                    }
                }
                return false;
            }
        }

        this.get_content = function () { //function to capture regular content between tags

            var input_char = '',
                content = [],
                space = false; //if a space is needed

            while (this.input.charAt(this.pos) !== '<') {
                if (this.pos >= this.input.length) {
                    return content.length ? content.join('') : ['', 'TK_EOF'];
                }

                input_char = this.input.charAt(this.pos);
                this.pos++;
                this.line_char_count++;

                if (this.Utils.in_array(input_char, this.Utils.whitespace)) {
                    if (content.length) {
                        space = true;
                    }
                    this.line_char_count--;
                    continue; //don't want to insert unnecessary space
                } else if (space) {
                    if (this.line_char_count >= this.max_char) { //insert a line when the max_char is reached
                        content.push('\n');
                        for (var i = 0; i < this.indent_level; i++) {
                            content.push(this.indent_string);
                        }
                        this.line_char_count = 0;
                    } else {
                        content.push(' ');
                        this.line_char_count++;
                    }
                    space = false;
                }
                content.push(input_char); //letter at-a-time (or string) inserted to an array
            }
            return content.length ? content.join('') : '';
        }

        this.get_contents_to = function (name) { //get the full content of a script or style to pass to js_beautify
            if (this.pos == this.input.length) {
                return ['', 'TK_EOF'];
            }
            var input_char = '';
            var content = '';
            var reg_match = new RegExp('\<\/' + name + '\\s*\>', 'igm');
            reg_match.lastIndex = this.pos;
            var reg_array = reg_match.exec(this.input);
            var end_script = reg_array ? reg_array.index : this.input.length; //absolute end of script
            if (this.pos < end_script) { //get everything in between the script tags
                content = this.input.substring(this.pos, end_script);
                this.pos = end_script;
            }
            return content;
        }

        this.record_tag = function (tag) { //function to record a tag and its parent in this.tags Object
            if (this.tags[tag + 'count']) { //check for the existence of this tag type
                this.tags[tag + 'count']++;
                this.tags[tag + this.tags[tag + 'count']] = this.indent_level; //and record the present indent level
            } else { //otherwise initialize this tag type
                this.tags[tag + 'count'] = 1;
                this.tags[tag + this.tags[tag + 'count']] = this.indent_level; //and record the present indent level
            }
            this.tags[tag + this.tags[tag + 'count'] + 'parent'] = this.tags.parent; //set the parent (i.e. in the case of a div this.tags.div1parent)
            this.tags.parent = tag + this.tags[tag + 'count']; //and make this the current parent (i.e. in the case of a div 'div1')
        }

        this.retrieve_tag = function (tag) { //function to retrieve the opening tag to the corresponding closer
            if (this.tags[tag + 'count']) { //if the openener is not in the Object we ignore it
                var temp_parent = this.tags.parent; //check to see if it's a closable tag.
                while (temp_parent) { //till we reach '' (the initial value);
                    if (tag + this.tags[tag + 'count'] === temp_parent) { //if this is it use it
                        break;
                    }
                    temp_parent = this.tags[temp_parent + 'parent']; //otherwise keep on climbing up the DOM Tree
                }
                if (temp_parent) { //if we caught something
                    this.indent_level = this.tags[tag + this.tags[tag + 'count']]; //set the indent_level accordingly
                    this.tags.parent = this.tags[temp_parent + 'parent']; //and set the current parent
                }
                delete this.tags[tag + this.tags[tag + 'count'] + 'parent']; //delete the closed tags parent reference...
                delete this.tags[tag + this.tags[tag + 'count']]; //...and the tag itself
                if (this.tags[tag + 'count'] == 1) {
                    delete this.tags[tag + 'count'];
                } else {
                    this.tags[tag + 'count']--;
                }
            }
        }

        this.get_tag = function (peek) { //function to get a full tag and parse its type
            var input_char = '',
                content = [],
                space = false,
                tag_start, tag_end,
                peek = typeof peek !== 'undefined' ? peek : false,
                orig_pos = this.pos,
                orig_line_char_count = this.line_char_count;

            do {
                if (this.pos >= this.input.length) {
                    if (peek) {
                        this.pos = orig_pos;
                        this.line_char_count = orig_line_char_count;
                    }
                    return content.length ? content.join('') : ['', 'TK_EOF'];
                }

                input_char = this.input.charAt(this.pos);
                this.pos++;
                this.line_char_count++;

                if (this.Utils.in_array(input_char, this.Utils.whitespace)) { //don't want to insert unnecessary space
                    space = true;
                    this.line_char_count--;
                    continue;
                }

                if (input_char === "'" || input_char === '"') {
                    if (!content[1] || content[1] !== '!') { //if we're in a comment strings don't get treated specially
                        input_char += this.get_unformatted(input_char);
                        space = true;
                    }
                }

                if (input_char === '=') { //no space before =
                    space = false;
                }

                if (content.length && content[content.length - 1] !== '=' && input_char !== '>' && space) { //no space after = or before >
                    if (this.line_char_count >= this.max_char) {
                        this.print_newline(false, content);
                        this.line_char_count = 0;
                    } else {
                        content.push(' ');
                        this.line_char_count++;
                    }
                    space = false;
                }
                if (input_char === '<') {
                    tag_start = this.pos - 1;
                }
                content.push(input_char); //inserts character at-a-time (or string)
            } while (input_char !== '>');

            var tag_complete = content.join('');
            var tag_index;
            if (tag_complete.indexOf(' ') != -1) { //if there's whitespace, thats where the tag name ends
                tag_index = tag_complete.indexOf(' ');
            } else { //otherwise go with the tag ending
                tag_index = tag_complete.indexOf('>');
            }
            var tag_check = tag_complete.substring(1, tag_index).toLowerCase();
            if (tag_complete.charAt(tag_complete.length - 2) === '/' || this.Utils.in_array(tag_check, this.Utils.single_token)) { //if this tag name is a single tag type (either in the list or has a closing /)
                if (!peek) {
                    this.tag_type = 'SINGLE';
                }
            } else if (tag_check === 'script') { //for later script handling
                if (!peek) {
                    this.record_tag(tag_check);
                    this.tag_type = 'SCRIPT';
                }
            } else if (tag_check === 'style') { //for future style handling (for now it justs uses get_content)
                if (!peek) {
                    this.record_tag(tag_check);
                    this.tag_type = 'STYLE';
                }
            } else if (this.is_unformatted(tag_check, unformatted)) { // do not reformat the "unformatted" tags
                var comment = this.get_unformatted('</' + tag_check + '>', tag_complete); //...delegate to get_unformatted function
                content.push(comment);
                // Preserve collapsed whitespace either before or after this tag.
                if (tag_start > 0 && this.Utils.in_array(this.input.charAt(tag_start - 1), this.Utils.whitespace)) {
                    content.splice(0, 0, this.input.charAt(tag_start - 1));
                }
                tag_end = this.pos - 1;
                if (this.Utils.in_array(this.input.charAt(tag_end + 1), this.Utils.whitespace)) {
                    content.push(this.input.charAt(tag_end + 1));
                }
                this.tag_type = 'SINGLE';
            } else if (tag_check.charAt(0) === '!') { //peek for <!-- comment
                if (tag_check.indexOf('[if') != -1) { //peek for <!--[if conditional comment
                    if (tag_complete.indexOf('!IE') != -1) { //this type needs a closing --> so...
                        var comment = this.get_unformatted('-->', tag_complete); //...delegate to get_unformatted
                        content.push(comment);
                    }
                    if (!peek) {
                        this.tag_type = 'START';
                    }
                } else if (tag_check.indexOf('[endif') != -1) { //peek for <!--[endif end conditional comment
                    this.tag_type = 'END';
                    this.unindent();
                } else if (tag_check.indexOf('[cdata[') != -1) { //if it's a <[cdata[ comment...
                    var comment = this.get_unformatted(']]>', tag_complete); //...delegate to get_unformatted function
                    content.push(comment);
                    if (!peek) {
                        this.tag_type = 'SINGLE'; //<![CDATA[ comments are treated like single tags
                    }
                } else {
                    var comment = this.get_unformatted('-->', tag_complete);
                    content.push(comment);
                    this.tag_type = 'SINGLE';
                }
            } else if (!peek) {
                if (tag_check.charAt(0) === '/') { //this tag is a double tag so check for tag-ending
                    this.retrieve_tag(tag_check.substring(1)); //remove it and all ancestors
                    this.tag_type = 'END';
                } else { //otherwise it's a start-tag
                    this.record_tag(tag_check); //push it on the tag stack
                    this.tag_type = 'START';
                }
                if (this.Utils.in_array(tag_check, this.Utils.extra_liners)) { //check if this double needs an extra line
                    this.print_newline(true, this.output);
                }
            }

            if (peek) {
                this.pos = orig_pos;
                this.line_char_count = orig_line_char_count;
            }

            return content.join(''); //returns fully formatted tag
        }

        this.get_unformatted = function (delimiter, orig_tag) { //function to return unformatted content in its entirety

            if (orig_tag && orig_tag.toLowerCase().indexOf(delimiter) != -1) {
                return '';
            }
            var input_char = '';
            var content = '';
            var space = true;
            do {

                if (this.pos >= this.input.length) {
                    return content;
                }

                input_char = this.input.charAt(this.pos);
                this.pos++

                if (this.Utils.in_array(input_char, this.Utils.whitespace)) {
                    if (!space) {
                        this.line_char_count--;
                        continue;
                    }
                    if (input_char === '\n' || input_char === '\r') {
                        content += '\n';
                        /*  Don't change tab indention for unformatted blocks.  If using code for html editing, this will greatly affect <pre> tags if they are specified in the 'unformatted array'
            for (var i=0; i<this.indent_level; i++) {
              content += this.indent_string;
            }
            space = false; //...and make sure other indentation is erased
            */
                        this.line_char_count = 0;
                        continue;
                    }
                }
                content += input_char;
                this.line_char_count++;
                space = true;


            } while (content.toLowerCase().indexOf(delimiter) == -1);
            return content;
        }

        this.get_token = function () { //initial handler for token-retrieval
            var token;

            if (this.last_token === 'TK_TAG_SCRIPT' || this.last_token === 'TK_TAG_STYLE') { //check if we need to format javascript
                var type = this.last_token.substr(7)
                token = this.get_contents_to(type);
                if (typeof token !== 'string') {
                    return token;
                }
                return [token, 'TK_' + type];
            }
            if (this.current_mode === 'CONTENT') {
                token = this.get_content();
                if (typeof token !== 'string') {
                    return token;
                } else {
                    return [token, 'TK_CONTENT'];
                }
            }

            if (this.current_mode === 'TAG') {
                token = this.get_tag();
                if (typeof token !== 'string') {
                    return token;
                } else {
                    var tag_name_type = 'TK_TAG_' + this.tag_type;
                    return [token, tag_name_type];
                }
            }
        }

        this.get_full_indent = function (level) {
            level = this.indent_level + level || 0;
            if (level < 1) return '';

            return Array(level + 1).join(this.indent_string);
        }

        this.is_unformatted = function (tag_check, unformatted) {
            //is this an HTML5 block-level link?
            if (!this.Utils.in_array(tag_check, unformatted)) {
                return false;
            }

            if (tag_check.toLowerCase() !== 'a' || !this.Utils.in_array('a', unformatted)) {
                return true;
            }

            //at this point we have an  tag; is its first child something we want to remain
            //unformatted?
            var next_tag = this.get_tag(true /* peek. */ );
            if (next_tag && this.Utils.in_array(next_tag, unformatted)) {
                return true;
            } else {
                return false;
            }
        }

        this.printer = function (js_source, indent_character, indent_size, max_char, brace_style) { //handles input/output and some other printing functions

            this.input = js_source || ''; //gets the input for the Parser
            this.output = [];
            this.indent_character = indent_character;
            this.indent_string = '';
            this.indent_size = indent_size;
            this.brace_style = brace_style;
            this.indent_level = 0;
            this.max_char = max_char;
            this.line_char_count = 0; //count to see if max_char was exceeded

            for (var i = 0; i < this.indent_size; i++) {
                this.indent_string += this.indent_character;
            }

            this.print_newline = function (ignore, arr) {
                this.line_char_count = 0;
                if (!arr || !arr.length) {
                    return;
                }
                if (!ignore) { //we might want the extra line
                    while (this.Utils.in_array(arr[arr.length - 1], this.Utils.whitespace)) {
                        arr.pop();
                    }
                }
                arr.push('\n');
                for (var i = 0; i < this.indent_level; i++) {
                    arr.push(this.indent_string);
                }
            }

            this.print_token = function (text) {
                this.output.push(text);
            }

            this.indent = function () {
                this.indent_level++;
            }

            this.unindent = function () {
                if (this.indent_level > 0) {
                    this.indent_level--;
                }
            }
        }
        return this;
    }

    /*_____________________--------------------_____________________*/

    multi_parser = new Parser(); //wrapping functions Parser
    multi_parser.printer(html_source, indent_character, indent_size, max_char, brace_style); //initialize starting values

    while (true) {
        var t = multi_parser.get_token();
        multi_parser.token_text = t[0];
        multi_parser.token_type = t[1];

        if (multi_parser.token_type === 'TK_EOF') {
            break;
        }

        switch (multi_parser.token_type) {
            case 'TK_TAG_START':
                multi_parser.print_newline(false, multi_parser.output);
                multi_parser.print_token(multi_parser.token_text);
                multi_parser.indent();
                multi_parser.current_mode = 'CONTENT';
                break;
            case 'TK_TAG_STYLE':
            case 'TK_TAG_SCRIPT':
                multi_parser.print_newline(false, multi_parser.output);
                multi_parser.print_token(multi_parser.token_text);
                multi_parser.current_mode = 'CONTENT';
                break;
            case 'TK_TAG_END':
                //Print new line only if the tag has no content and has child
                if (multi_parser.last_token === 'TK_CONTENT' && multi_parser.last_text === '') {
                    var tag_name = multi_parser.token_text.match(/\w+/)[0];
                    var tag_extracted_from_last_output = multi_parser.output[multi_parser.output.length - 1].match(/<\s*(\w+)/);
                    if (tag_extracted_from_last_output === null || tag_extracted_from_last_output[1] !== tag_name) multi_parser.print_newline(true, multi_parser.output);
                }
                multi_parser.print_token(multi_parser.token_text);
                multi_parser.current_mode = 'CONTENT';
                break;
            case 'TK_TAG_SINGLE':
                // Don't add a newline before elements that should remain unformatted.
                var tag_check = multi_parser.token_text.match(/^\s*<([a-z]+)/i);
                if (!tag_check || !multi_parser.Utils.in_array(tag_check[1], unformatted)) {
                    multi_parser.print_newline(false, multi_parser.output);
                }
                multi_parser.print_token(multi_parser.token_text);
                multi_parser.current_mode = 'CONTENT';
                break;
            case 'TK_CONTENT':
                if (multi_parser.token_text !== '') {
                    multi_parser.print_token(multi_parser.token_text);
                }
                multi_parser.current_mode = 'TAG';
                break;
            case 'TK_STYLE':
            case 'TK_SCRIPT':
                if (multi_parser.token_text !== '') {
                    multi_parser.output.push('\n');
                    var text = multi_parser.token_text;
                    if (multi_parser.token_type == 'TK_SCRIPT') {
                        var _beautifier = typeof js_beautify == 'function' && js_beautify;
                    } else if (multi_parser.token_type == 'TK_STYLE') {
                        var _beautifier = typeof css_beautify == 'function' && css_beautify;
                    }

                    if (options.indent_scripts == "keep") {
                        var script_indent_level = 0;
                    } else if (options.indent_scripts == "separate") {
                        var script_indent_level = -multi_parser.indent_level;
                    } else {
                        var script_indent_level = 1;
                    }

                    var indentation = multi_parser.get_full_indent(script_indent_level);
                    if (_beautifier) {
                        // call the Beautifier if avaliable
                        text = _beautifier(text.replace(/^\s*/, indentation), options);
                    } else {
                        // simply indent the string otherwise
                        var white = text.match(/^\s*/)[0];
                        var _level = white.match(/[^\n\r]*$/)[0].split(multi_parser.indent_string).length - 1;
                        var reindent = multi_parser.get_full_indent(script_indent_level - _level);
                        text = text.replace(/^\s*/, indentation)
                            .replace(/\r\n|\r|\n/g, '\n' + reindent)
                            .replace(/\s*$/, '');
                    }
                    if (text) {
                        multi_parser.print_token(text);
                        multi_parser.print_newline(true, multi_parser.output);
                    }
                }
                multi_parser.current_mode = 'TAG';
                break;
        }
        multi_parser.last_token = multi_parser.token_type;
        multi_parser.last_text = multi_parser.token_text;
    }
    return multi_parser.output.join('');
}

// Add support for CommonJS. Just put this file somewhere on your require.paths
// and you will be able to `var html_beautify = require("beautify").html_beautify`.
if (typeof exports !== "undefined") {
    exports.html_beautify = style_html;
}