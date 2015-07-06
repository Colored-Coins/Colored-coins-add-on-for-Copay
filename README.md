Experimental plugin for [Copay](https://github.com/bitpay/copay) adding support for [Colored Coins](http://coloredcoins.org).

## Installation

1. In Copay instance folder:

    ````
    bower install git@github.com:troggy/copay-colored-coins-plugin.git
    ````

2. Add ``copayPlugin.coloredCoins`` module to as dependency of ``copayApp.plugins`` module:

     ````
     angular.module('copayApp.plugins', ['copayPlugin.coloredCoins']);
     ````

3. Update Copay's Gruntfile. Add the following under ``concat.angular.src``:

    ````
    'bower_components/copay-colored-coins-plugin/dist/copayColoredCoins.js'
    ````

