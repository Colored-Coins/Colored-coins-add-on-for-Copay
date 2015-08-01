'use strict';

angular.module('copayAddon.coloredCoins').service('externalTxSigner', function(lodash, bitcore, UTXOList) {
  var root = {};

  function ExternalTxSigner(credentials) {

    this.derivePrivKeys = function(xPriv, network, tx) {
      var derived = {};
      var xpriv = new bitcore.HDPrivateKey(xPriv, network).derive("m/45'");
      for (var i = 0; i < tx.inputs.length; i++) {
        var path = UTXOList.get(tx.inputs[i].toObject().prevTxId).path;
        if (!derived[path]) {
          derived[path] = xpriv.derive(path).privateKey;
        }
      }
      return derived;
    };

    this.convertInputsToP2SH = function(tx) {
      var inputs = tx.inputs;
      tx.inputs = [];
      lodash.each(inputs, function(input) {
        var txid = input.toObject().prevTxId;
        var utxo = UTXOList.get(txid);
        tx.from(utxo, utxo.publicKeys, utxo.reqSigs);
      });
    };

    this.sign = function(tx) {
      //Derive proper key to sign, for each input
      var derivedPrivKeys = this.derivePrivKeys(credentials.xPrivKey, credentials.network, tx);

      this.convertInputsToP2SH(tx);

      // sign each input
      lodash.each(lodash.values(derivedPrivKeys), function(privKey) {
        tx.sign(privKey);
      });
    };

  }

  root.sign = function(tx, credentials) {
    return new ExternalTxSigner(credentials).sign(tx);
  };


  return root;
});