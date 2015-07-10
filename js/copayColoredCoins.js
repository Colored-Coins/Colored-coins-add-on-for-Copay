

var module = angular.module('copayAddon.coloredCoins', ['copayAssetViewTemplates']);

module.config(function(addonManagerProvider) {
  addonManagerProvider.registerAddon({
    menuItem: {
      'title': 'Assets',
      'icon': 'icon-pricetag',
      'link': 'assets'
    },
    view: {
      id: 'assets',
      'class': 'assets',
      template: 'colored-coins/views/assets.html'
    }
  });
});