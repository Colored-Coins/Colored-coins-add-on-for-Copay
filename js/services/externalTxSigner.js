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

    this.convertInputsToP2SH = function(tx, derivedPrivKeys) {
      var inputs = tx.inputs;
      tx.inputs = [];
      for (var i = 0; i < inputs.length; i++) {
        var input = inputs[i];
        var txid = input.toObject().prevTxId;
        var utxo = UTXOList.get(txid);
        var path = utxo.path;
        var pubKey = derivedPrivKeys[path].publicKey;
        var script = new bitcore.Script(utxo.scriptPubKey.hex).toString();
        var from = {'txId': txid, outputIndex: utxo.vout, satoshis: utxo.satoshis, script: script };
        tx.from(from, [pubKey], utxo.scriptPubKey.reqSigs);
      }
    };

    this.sign = function(tx) {
      //Derive proper key to sign, for each input
      var derivedPrivKeys = this.derivePrivKeys(credentials.xPrivKey, credentials.network, tx);

      this.convertInputsToP2SH(tx, derivedPrivKeys);

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