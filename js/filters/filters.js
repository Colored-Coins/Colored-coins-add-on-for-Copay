'use strict';

angular.module('copayPlugin.coloredCoins')
  .filter('stringify', function($sce) {
    return function(json) {
      json = json || [];
      return $sce.trustAsHtml(JSON.stringify(json, null, 4).replace(/\n/g, '<br>'));
    }
  });