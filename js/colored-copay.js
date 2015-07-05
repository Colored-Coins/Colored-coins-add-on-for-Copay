

var module = angular.module('copayColoredCoins', ['copayAssetViewTemplates']);

module.config(function(pluginManagerProvider) {
  pluginManagerProvider.registerMenuItem({
    'title': 'Assets',
    'icon': 'icon-pricetag',
    'link': 'assets'
  });
});

module.controller('AssetsController', function() {
  this.assets = []

  this.openAssetModal = function() {

  };

});