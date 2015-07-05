angular.module('copayAssetViewTemplates', ['colored-copay/views/assets.html']);

angular.module("colored-copay/views/assets.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-copay/views/assets.html",
    "<div ng-show=\"assets.assets\" class=\"scroll\" ng-controller=\"AssetsController as assets\">\n" +
    "    <div ng-repeat=\"asset in assets.assets\" ng-click=\"assets.openAssetModal(asset)\"\n" +
    "         class=\"row collapse last-transactions-content\">\n" +
    "        <div class=\"small-1 columns text-center\">\n" +
    "            <i class=\"icon-circle-active size-10\" ng-style=\"{'color':index.backgroundColor}\" style=\"margin-top:8px;\"></i>\n" +
    "            &nbsp;\n" +
    "        </div>\n" +
    "        <div class=\"small-4 columns\">\n" +
    "            <div ng-if=\"!$root.updatingBalance\">\n" +
    "                <span class=\"text-bold size-16\">{{ asset.metadata.assetName }}</span>\n" +
    "            </div>\n" +
    "            <div class=\"ellipsis text-gray size-14\">\n" +
    "                {{ asset.metadata.description }}\n" +
    "            </div>\n" +
    "        </div>\n" +
    "        <div class=\"small-2 columns\">\n" +
    "          <span class=\"size-16\">\n" +
    "            {{ asset.amount }} unit{{ asset.metadata.amount != 1 ? 's' : '' }}\n" +
    "          </span>\n" +
    "        </div>\n" +
    "        <div class=\"small-4 columns\">\n" +
    "            <span class=\"size-14\"><span translate>Issued by</span>: {{ asset.metadata.issuer }}</span>\n" +
    "        </div>\n" +
    "        <div class=\"small-1 columns text-right\">\n" +
    "            <br>\n" +
    "            <i class=\"icon-arrow-right3 size-18\"></i>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</div>\n" +
    "<div class=\"extra-margin-bottom\"></div>\n" +
    "");
}]);



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