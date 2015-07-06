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
          './js/copayColoredCoins.js',
          './js/controllers/*.js',
          './js/services/*.js',
          './dist/templates.js'
        ],
        dest: './dist/copayColoredCoins.js'
      }
    },
    html2js: {
      app: {
        options: {
          rename: function(moduleName) {
            return 'colored-coins/' + moduleName.replace('../', '');
          }
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