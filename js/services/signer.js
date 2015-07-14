
angular.module('copayAddon.coloredCoins').service('externalTxSigner', function(lodash, bitcore) {
  var root = {};

  function ExternalTxSigner(credentials, txidToUTXO) {

    this.derivePrivKeys = function(xPriv, network, tx) {
      var derived = {};
      var xpriv = new bitcore.HDPrivateKey(xPriv, network).derive("m/45'");
      for (var i = 0; i < tx.inputs.length; i++) {
        var path = txidToUTXO[tx.inputs[i].toObject().prevTxId].path;
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
        var utxo = txidToUTXO[txid];
        var path = utxo.path;
        var pubKey = derivedPrivKeys[path].publicKey;
        var script = new bitcore.Script(utxo.scriptPubKey.hex).toString();
        var from = {'txId': txid, outputIndex: utxo.index, satoshis: utxo.value, script: script };
        tx.from(from, [pubKey], utxo.scriptPubKey.reqSigs);
      }
    };

    this.sign = function(tx) {
      //Derive proper key to sign, for each input
      var derivedPrivKeys = this.derivePrivKeys(credentials.xPrivKey, credentials.network, tx);

      this.convertInputsToP2SH(tx, derivedPrivKeys);

      // sign each input
      lodash.each(lodash.values(derivedPrivKeys), function(privKey) {
        tx.sign(privKey);  //2NCLER6hbQYaTxP5fac5SuZvUFDRMc2RvLE
      });
    };

  }

  root.sign = function(tx, credentials, txidToUTXO) {
    return new ExternalTxSigner(credentials, txidToUTXO).sign(tx);
  };


  return root;
});