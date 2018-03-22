
var cheerio = require('cheerio');
var request = require('request');
var rp = require('request-promise');
var express = require('express');

var csvWriter = require('csv-write-stream');
var fs = require('fs');
var app = express();
var shirtCounter = 0;


function create_error_log(message){
  // [Tue Feb 16 2016 10:02:12 GMT-0800 (PST)] <error message>

  var d = new Date;
  fs.appendFileSync('./scraper-error.log', `[${d}] ${message}\n`);
}

app.get('/scrape', (req, res)=>{

    var newDate = new Date();
    var tmStamp = `${newDate.getFullYear()}-${newDate.getMonth()}-${newDate.getDate()}`;

    if(!fs.existsSync('./data')){
      fs.mkdirSync('./data');
    }

    var writer = csvWriter({headers: ["Title", "Price", "ImageURL", "URL"]});
    writer.pipe(fs.createWriteStream(`./data/${tmStamp}.csv`));

    var baseurl = 'http://shirts4mike.com/';
    var url = baseurl + 'shirts.php';

    var shirtURLs = [];

    var options = {
      uri: url,
      transform: function(body){
        return cheerio.load(body);
      }
    };

    rp(options)
      .then(function($){

        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.write('Hi, we are scraping the shirts site!');


        // Retrieve the URLs for each shirt from the main list of shirts
        $('.products li a').each(function(index){

          var href = $(this).attr('href');
          href = baseurl + href;

          shirtURLs[index] = href;

        });

        // For each shirt, visit its URL and extract the detailed info of the shirt
        shirtURLs.forEach(function(shirtURL, index, array){

          var shirtOptions = {
            uri: shirtURL,
            transform: function(body){
              return cheerio.load(body);
            }
          };

          rp(shirtOptions)
            .then(function($){

              var shirt = {name:"", price:"", imageURL: "", shirtURL: ""};

              shirt.shirtURL = shirtOptions.uri;

              $('.price').filter(function(){shirt.price = $(this).text();});

              $('.shirt-details h1').filter(function(){shirt.name = $(this).text().substr(4);});

              $('.shirt-picture span img').filter(function() {shirt.imageURL = baseurl + $(this).attr('src');});

              writer.write([shirt.name, shirt.price, shirt.imageURL, shirt.shirtURL])

            })            
            .catch(function(error){
              // console.error(error.message);
              var message = "";
              console.error(error);
              // console.error(error.statusCode);
              if(error.statusCode === 404){
                message = "There’s been a 404 error. Cannot connect to http://shirts4mike.com.";
                
              } else {
                message = error.message;
              }

              // [Tue Feb 16 2016 10:02:12 GMT-0800 (PST)] <error message>

              create_error_log(message);
              
              res.write(message);
              res.end();
            })
            .finally(function(){

              shirtCounter++;

              if(shirtCounter === shirtURLs.length) {
                writer.end();
                res.end();
              }
                
            });

        });

        
      })
      .catch(function(error){
        // console.error(error.message);
        var message = "";
        // console.error(error.statusCode);
        if(error.statusCode === 404){
          message = "There’s been a 404 error. Cannot connect to http://shirts4mike.com.";

        } else {
          message = error.message;
        }
        create_error_log(message);

        res.write(message);
        res.end();
      });


});

app.listen('3000');
console.log('Scraping the T-Shirt site!');

module.exports.app = app;
