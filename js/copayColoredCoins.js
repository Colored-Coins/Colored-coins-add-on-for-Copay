

var module = angular.module('copayAddon.coloredCoins', ['copayAssetViewTemplates']);

module.run(function(addonManager) {
  addonManager.registerAddon({
    menuItem: {
      'title': 'Assets',
      'icon': 'icon-pricetag',
      'link': 'assets'
    },
    view: {
      id: 'assets',
      'class': 'assets',
      template: 'colored-coins/views/assets.html'
    },
    formatPendingTxp: function(txp) {
      if (txp.metadata && txp.metadata.asset) {
        var value = txp.amountStr;
        var asset = txp.metadata.asset;
        txp.amountStr = asset.amount + " unit" + (asset.amount > 1 ? "s" : "") + " of " + asset.assetName + " (" + value + ")";
        txp.showSingle = true;
        txp.toAddress = txp.outputs[0].toAddress; // txproposal
        txp.address = txp.outputs[0].address;     // txhistory
      }
    }
  });
});