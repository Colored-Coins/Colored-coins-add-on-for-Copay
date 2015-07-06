'use strict';

module.exports = function (grunt) {

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-html2js');

  grunt.initConfig({
    clean: ['./dist/templates.js'],
    concat: {
      options: {
      },
      dist: {
        src: [
          './dist/templates.js',
          './js/**/*.js'
        ],
        dest: './dist/copayColoredCoins.js'
      }
    },
    html2js: {
      app: {
        options: {
          base: '../'
        },
        src: ['./views/{,*/}*.html'],
        dest: './dist/templates.js',
        module: 'copayAssetViewTemplates'
      }
    }
  });

  grunt.registerTask('default', [
    'html2js',
    'concat',
    'clean'
  ]);

};