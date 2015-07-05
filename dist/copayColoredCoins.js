angular.module('copayAssetViewTemplates', ['colored-copay/views/assets.html']);

angular.module("colored-copay/views/assets.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-copay/views/assets.html",
    "<h1>Assets</h1>");
}]);



var module = angular.module('copayColoredCoins', ['copayAssetViewTemplates']);

module.config(function(pluginManagerProvider) {
  pluginManagerProvider.registerMenuItem({
    'title': 'Assets',
    'icon': 'icon-pricetag',
    'link': 'assets'
  });
});