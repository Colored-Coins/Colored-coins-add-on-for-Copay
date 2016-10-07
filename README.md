# DEPRECATED

This was created for older Copay 1.8.0 which is not supported anymore. Please use https://github.com/Colored-Coins/colored-coins-copay-wallet instead.

----

[Copay](https://github.com/bitpay/copay) addon with support for [Colored Coins](http://coloredcoins.org).

## Installation

### Quick install

The following will setup Copay 1.2.0 with this addon installed:
````
git clone -b colored https://github.com/troggy/copay
cd copay
npm run setup
grunt prod
````

(optional) [Setup AWS S3 bucket](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html) if you want to upload icons to assets. Change profile, bucket and region names in ``bower_components/colored-coins-copay-addon/Procfile``

Run with [foreman](https://www.npmjs.com/package/foreman):
````
nf start
````


### Manual installation

Setup addon from scratch on top of Copay 1.2.0 (won't work for latest version of Copay)

0. Install [Copay 1.2.0](https://github.com/bitpay/copay):
    
1. Install addon and it's dependencies inside Copay folder:

    ````
    bower install colored-coins-copay-addon && cd bower_components/colored-coins-copay-addon && npm i && cd -
    ````

2. Add ``copayAddon.coloredCoins`` module as dependency of ``copayApp.addons`` module (in ``copay/src/js/app.js``):

     ````
     angular.module('copayApp.addons', ['copayAddon.coloredCoins']);
     ````
     
3. Update Copay's Gruntfile (``copay/Grunfile.js``).
    
    Add the following under ``concat.angular.src``:

    ````
    'bower_components/colored-coins-copay-addon/dist/copayColoredCoins.js',
    'bower_components/colored-coins-copay-addon/config.js'
    ````
    
    And under ``concat.foundation.src``:
    
    ````
    'bower_components/colored-coins-copay-addon/css/assets.css'
    ````
    
4. If you are installing this addon on public Copay (in other words, not for development purposes), change
``bower_components/colored-coins-copay-addon/config.js`` so that it has your copay's host name instead of ``localhost``.
You need to have ports 8000, 8100, 8200 to be open for incoming connections for that host.

5. Addon uses S3 bucket to store uploaded asset icons. Configuration:
   - [Configure AWS profile](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html). It should have ``PutObject`` permission on you bucket.
   - Change profile, bucket and region names in ``bower_components/colored-coins-copay-addon/Procfile``

5. Rebuild Copay:

    ````
    grunt
    ````
    
6. Run services with [ff](https://www.npmjs.com/package/foreman):
   
    ````
    foreman start -f bower_components/colored-coins-copay-addon/Procfile
    ````

8. Start Copay. In ``copay`` folder:

    ````
    npm start
    ````

