module.exports = function (grunt) {
    var loadNpmTasks = function () {
        grunt.loadNpmTasks('grunt-compass');
        grunt.loadNpmTasks('grunt-contrib-jshint');
        grunt.loadNpmTasks('grunt-contrib-watch');
        grunt.loadNpmTasks('grunt-contrib-concat');
        grunt.loadNpmTasks('grunt-contrib-jasmine');
        grunt.loadNpmTasks('grunt-bower-task');
    };

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        meta: {
            banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' + '<%= grunt.template.today("yyyy-mm-dd") %>\n' + '<%= pkg.homepage ? "* " + pkg.homepage + "\n" : "" %>' + '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' + ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */'
        },
        watch: {
            jshint: {
                files: '<%= jshint.all %>',
                tasks: ['jshint'],
                options: {}
            },
            'compass-dev': {
                files: '<%= compass.dev.src %>/**/*.scss',
                tasks: ['compass:dev']
            },
            'compass-lib': {
                files: '<%= compass.lib.src %>/**/*.scss',
                tasks: ['compass:lib']
            },
            'templates': {
                files: 'workspace/templates/**/*.*',
                tasks: ['templates']
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
            dev: {
                src: 'workspace/scss/project',
                dest: 'deploy/assets/css',
                outputstyle: 'expanded',
                linecomments: true
            },
            lib: {
                src: 'workspace/scss/lib',
                dest: 'deploy/assets/lib',
                outputstyle: 'expanded',
                linecomments: true
            }
        },
        jshint: {
            all: ['Gruntfile.js', 'deploy/assets/scripts/*.js', 'deploy/assets/scripts/modules/**/*.js'],
            options: {
                jshintrc: '.jshintrc'
            }
        },
        templates: {
            dev: {
                options: {
                    engine: "handlebars",
                    language: "en-us",
                    flatten: false,
                    production: false,
                    layout: 'workspace/templates/layout.mustache',
                    partials: 'workspace/templates/partials/**/*.mustache',
                    data: ['workspace/templates/data/**/*.json']
                },
                files: {
                    'deploy/': ['workspace/templates/pages/**/*.mustache']
                }
            }
        },
        jasmine: {
            src: 'deploy/assets/scripts/modules/*.js',
            options: {
                specs: 'workspace/test/jasmine/specs/**/*.js',
                vendor: ['deploy/assets/scripts/lib/jquery/*.js'],
                junit: {
                    path: 'workspace/test/jasmine/junit',
                    consolidate: true
                }
            }
        },
        typescript: {
            compile: {
                files: {
                    'deploy/assets/scripts/modules/sample.js': ['workspace/scripts/sample.ts']
                },
                options: {}
            },
            options: {
                //basePath: 'test'
                comments: false,
                noresolve: false
            }
        },
        casper: {
            dist: {
                src: ['workspace/test/casper/*.js'],

                // CasperJS test command options
                options: {
                    // Allows you to pass variables to casper that can be accesed in files,
                    // for example, if you used the following args object then
                    // casper.cli.get('username') would return 'colin'
                    /*
                    */
                    args: {
                        //username: 'colin'
                        basePath: 'workspace/test/casper/'
                    },
                    // Exports results of test to a xUnit XML file
                    //xunit: 'workspace/casper/test/xunit/userSuite.xml',
                    // Outputs additional log messages
                    direct: true,
                    // Sets logging level, check out http://casperjs.org/logging.html
                    logLevel: 'info',
                    // Specifies files to be included for each test file
                    /*
                    includes: [
                        'tests/config.js',
                        'lib/jquery.min.js'],
                    // Adds tests from specified files before running the test suite
                    pre: ['tests/pre-test.js'],
                    // Adds tests from specified files after running the test suite
                    post: ['tests/post-test.js'],
                    */
                    // Terminates test suite upon failure of first test
                    failFast: false,

                    // grunt-ghost specific options
                    // Prints the command given to CasperJS
                    printCommand: false,

                    // Prints list of filepaths
                    printFilePaths: true
                }
            }
        },
        uglify: {}
    });

    loadNpmTasks();

    //Load task config files; from the 'tasks' subfolder
    grunt.loadTasks('build/tasks');

    grunt.registerTask('lint', ['jshint']);
    grunt.registerTask('build', ['bower:install', 'compass', 'templates', 'typescript']);

    // Default task.
    grunt.registerTask('default', ['lint', 'compass:dev', 'templates']);
    grunt.registerTask('test', ['jasmine']);
    grunt.registerTask('test-full', ['jasmine', 'casper']);
};