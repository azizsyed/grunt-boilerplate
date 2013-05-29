var path = require('path');
var _ = require('lodash');
var lrSnippet = require('grunt-contrib-livereload/lib/utils').livereloadSnippet;

var folderMount = function folderMount(connect, point) {
	return connect.static(path.resolve(point));
};

module.exports = function (grunt) {
	var loadNpmTasks = function () {
		grunt.loadNpmTasks('grunt-contrib-watch');
		grunt.loadNpmTasks('grunt-contrib-compass');
		grunt.loadNpmTasks('grunt-contrib-jshint');
		grunt.loadNpmTasks('grunt-contrib-concat');
		grunt.loadNpmTasks('grunt-contrib-copy');
		grunt.loadNpmTasks('grunt-contrib-uglify');
		grunt.loadNpmTasks('grunt-contrib-clean');
		grunt.loadNpmTasks('grunt-contrib-livereload');
		grunt.loadNpmTasks('grunt-regarde');
		grunt.loadNpmTasks('grunt-contrib-connect');
		grunt.loadNpmTasks('grunt-contrib-livereload');
		grunt.loadNpmTasks('grunt-ghost');
		grunt.loadNpmTasks('grunt-contrib-compress');
		grunt.loadNpmTasks('grunt-smushit');
		grunt.loadNpmTasks('grunt-karma');
	};

	var _ = grunt.util._;

	var scriptsPath = "workspace/scripts/";
	var scriptsDeployPath = "deploy/assets/scripts/"

	var UglifyMapper = function(scripts){
		var mapping = _.map(scripts, function(script){
			return scriptsPath+script;
		});

		return mapping;
	};

	var asset_config = {
		"index":{
			"scripts": ["main.js", "modules/sample.js"],
			"styles": ["test.css"]
		}
	};

	var uglifyUtility = function(){
		var config = {};

		_.forIn(asset_config, function(value, key) {
			var name = 'deploy/assets/scripts/' + key + ".min.js";
			config[name] = UglifyMapper(value.scripts);
		});

		return config;
	};

	// Project configuration.
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		asset_config: asset_config,
		meta: {
			banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' + '<%= grunt.template.today("yyyy-mm-dd") %>\n' + '<%= pkg.homepage ? "* " + pkg.homepage + "\n" : "" %>' + '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' + ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */'
		},
		watch: {
			jshint: {
				files: '<%= jshint.all %>',
				tasks: ['jshint'],
				options: {}
			},
			'compass': {
				files: '<%= compass.dev.options.sassDir %>/**/*.scss',
				tasks: ['compass:dev']
			},
			'templates': {
				files: 'workspace/templates/**/*.*',
				tasks: ['refresh-templates']
			},
			'scripts': {
				files: ['workspace/scripts/**/*.js'],
				tasks: ['refresh-scripts']
			}
		},
		bower: {
			install: {
				options: {
					targetDir: './',
					cleanup: false,
					install: true
				}
			}
		},
		compass: {
			options: {
				force: true,
				config: 'config.rb'
			},
			dev: {
				options: {
					outputStyle: 'expanded'
				}
			},
			sitemap: {
				options: {
					specify: "workspace/styles/sitemap.scss",
					outputStyle: 'expanded'
				}
			},
			glitch: {
				options: {
					specify: "workspace/styles/glitch.scss",
					outputStyle: 'expanded'
				}
			},
			prod: {
				options: {
					environment: 'production'
				}
			}
		},
		jshint: {
			all: [/*'Gruntfile.js', */'workspace/scripts/*.js'],
			options: {
				jshintrc: '.jshintrc'
			}
		},
		assemble: {
			dev: {
				options: {
					expand: true,
					layout: 'workspace/templates/layout/layout.hbs',
					partials: 'workspace/templates/partials/**/*.hbs',
					data: ['workspace/templates/data/**/*.json'],
					development: true,
					production: false,
					pathFilter: "workspace/templates/pages/",
					pageAssets: asset_config
				},
				files: {
					'deploy/': ['workspace/templates/pages/**/*.hbs']
				}
			},
			prod: {
				options: {
					expand: true,
					layout: 'workspace/templates/layout/layout.hbs',
					partials: 'workspace/templates/partials/**/*.hbs',
					data: ['workspace/templates/data/**/*.json'],
					development: false,
					production: true,
					pathFilter: "workspace/templates/pages/",
					pageAssets: asset_config
				},
				files: {
					'deploy/': ['workspace/templates/pages/**/*.hbs']
				}
			}
		},
		copy: {
			scripts: {
				files: [
					{expand: true, cwd: 'workspace/scripts/', flatten: false, src: ['**/*.*'], dest: 'deploy/assets/scripts/'} // flattens results to a single level
				]
			},
			'scripts-lib': {
				files: [
					{expand: true, cwd: 'workspace/scripts/lib', flatten: false, src: ['**/*.*'], dest: 'deploy/assets/scripts/lib'} // flattens results to a single level
				]
			}			
		},
		uglify: {
			scripts: {
				options: {
					mangle: {
						except: ['jQuery']
					}
				},
				files: uglifyUtility()
			}
		},
		clean: {
			html: ['deploy/*.html'],
			scripts: ['deploy/assets/scripts']
		},
		livereload: {
			port: 35729 // Default livereload listening port.
		},
		connect: {
			livereload: {
				options: {
					port: 9001,
					middleware: function(connect, options) {
						return [lrSnippet, folderMount(connect, "deploy"/*options.base*/)]
					}
				}
			}
		},
		// Configuration to be run (and then tested)
		regarde: {
			deploy_css: {
				files: 'deploy/assets/css/*.css',
				tasks: ['livereload']
			},
			deploy_html: {
				files: 'deploy/*.html',
				tasks: ['livereload']
			},
			deploy_scripts: {
				files: 'deploy/assets/scripts/*.js',
				tasks: ['livereload']
			},
			source_css: {
				files: '<%= compass.dev.options.sassDir %>**/*.scss',
				tasks: ['compass:dev']
			},
			source_html: {
				files: 'workspace/templates/**/*.*',
				tasks: ['refresh-templates']
			},
			source_scripts: {
				files: '<%= watch.scripts.files %>',
				tasks: ['refresh-scripts']
			}
		},
		ghost: {
			dist: {
				filesSrc: ['workspace/test/casper/*']
			},
			options: {
				basePath: "____/",
				printFilePaths: true
			}
		},
		compress: {
			deploy: {
				options: {
					archive: 'deploy/build.zip'
				},
				files: [
					{expand: true, cwd: 'deploy/', src: ['**/*', '!build.zip']}
				]
			}
		},
		smushit: {
			deploy: {
				src: ['deploy/assets/images/**/*.png','deploy/assets/images/**/*.jpg']
			},
			sprites: {
				src: ['workspace/images/**/*.png','workspace/images/**/*.jpg']
			}
		},
		karma: {
			unit: {
				configFile: 'karma.conf.js'
			}
		}
	});

	loadNpmTasks();

	//Load task config files; from the 'tasks' subfolder
	grunt.loadTasks('build/tasks');

	grunt.registerTask('refresh-scripts', ['clean:scripts', 'copy:scripts']);
	grunt.registerTask('refresh-templates', ['clean:html', 'assemble:dev']);
	grunt.registerTask('build', ['clean', 'jshint', 'compass:dev', 'assemble:dev', 'copy:scripts']);
	grunt.registerTask('build-dev', ['build', 'compress']);
	grunt.registerTask('build-prod', ['clean', 'jshint', 'compass:prod', 'assemble:prod', 'uglify:scripts', 'copy:scripts-lib', 'compress']);

	grunt.registerTask('live-reload', ['livereload-start', 'connect', 'regarde']);

	// Default task.
	grunt.registerTask('default', ['build-prod']);
	grunt.registerTask('test', ['ghost']);
};
