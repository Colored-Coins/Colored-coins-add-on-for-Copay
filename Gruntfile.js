'use strict';

module.exports = function (grunt) {

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-html2js');

  grunt.initConfig({
    concat: {
      options: {
      },
      dist: {
        src: [
          './js/templates.js',
          './js/colored-copay.js'
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
        dest: './js/templates.js',
        module: 'copayAssetViewTemplates'
      }
    }
  });

  grunt.registerTask('default', [
    'html2js',
    'concat'
  ]);

};