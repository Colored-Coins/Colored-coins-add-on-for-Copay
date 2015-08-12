'use strict';

var MAX_IMAGE_SIZE = 300000;

var formidable = require('formidable'),
    AWS = require('aws-sdk'),
    fs = require('fs'),
    http = require('http');

AWS.config.region = 'eu-central-1';

var bucket = 'copay-asset-icons';

var isImage = function(mime) {
  return mime.indexOf('image/') == 0;
};

var sendError = function(res, err) {
  res.writeHead(500, {'content-type': 'application/json'});
  res.write(err.toString());
  console.log(err);
  res.end();
};

var s3bucket = new AWS.S3({params: {Bucket: bucket}});
http.createServer(function(req, res) {
  if (req.url == '/upload' && req.method.toLowerCase() == 'post') {
    // parse a file upload
    var form = new formidable.IncomingForm();

    var icon;
    var key;
    form.parse(req, function(err, fields, files) {
      icon = files.upload;
      key = fields.title + icon.name.substr(icon.name.lastIndexOf('.'));
    });

    form.on('end', function() {
      if (isImage(icon.type) && icon.size < MAX_IMAGE_SIZE) {
        fs.readFile(icon.path, function(err, data) {
          if (err) {
            return sendError(res, err);
          }
          var params = { Key: key, Body: data };
          s3bucket.putObject(params, function(err, data) {
            if (err) {
              return sendError(res, err);
            } else {
              res.writeHead(200, {'content-type': 'application/json'});
              res.write('https://s3.' + AWS.config.region + '.amazonaws.com/' + bucket + '/' + encodeURIComponent(key));
              res.end();
            }
          });
        });
      } else {
        res.writeHead(400, {'content-type': 'application/json'});
        res.write("Expected image of size up to " + (MAX_IMAGE_SIZE / 1000) + "Kb");
        res.end();
      }
    });
  }

/*
  // show a file upload form
  res.writeHead(200, {'content-type': 'text/html'});
  res.end(
      '<form action="/upload" enctype="multipart/form-data" method="post">'+
          '<input type="text" name="title"><br>'+
          '<input type="file" name="upload" multiple="multiple"><br>'+
          '<input type="submit" value="Upload">'+
          '</form>'
  );
*/
}).listen(8200);