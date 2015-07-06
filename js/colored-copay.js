

var module = angular.module('copayColoredCoins', ['copayAssetViewTemplates']);

module.config(function(pluginManagerProvider) {
  pluginManagerProvider.registerMenuItem({
    'title': 'Assets',
    'icon': 'icon-pricetag',
    'link': 'assets'
  });

  pluginManagerProvider.registerView('assets', 'assets', 'colored-copay/views/assets.html')
});