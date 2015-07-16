'use strict';

angular.module('copayAddon.coloredCoins').service('UTXOList', function() {
  var root = {},
      txidToUTXO = {};

  root.add = function(txid, utxo) {
    txidToUTXO[txid] = utxo;
  };

  root.get = function(txid) {
    return txidToUTXO[txid];
  };

  return root;
});