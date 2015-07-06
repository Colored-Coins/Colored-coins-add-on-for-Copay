

var module = angular.module('copayPlugin.coloredCoins', ['copayAssetViewTemplates']);

module.config(function(pluginManagerProvider) {
  pluginManagerProvider.registerMenuItem({
    'title': 'Assets',
    'icon': 'icon-pricetag',
    'link': 'assets'
  });

  pluginManagerProvider.registerView('assets', 'assets', 'colored-coins/views/assets.html')
});