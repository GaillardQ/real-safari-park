try
{

  var express = require('express');
  var http = require('http');
  var path = require('path');
  var favicon = require('static-favicon');
  var logger = require('morgan');
  var cookieParser = require('cookie-parser');
  var bodyParser = require('body-parser');
  var Twig = require("twig");
  var geolib = require('geolib');
  var redis = require("redis");
  var util = require('util');

  var dico = require('dico-pokemon/dico-pokemon');
  var dbManager = require('db-manager/db-manager');

  var routes = require('./routes');
  var index = require('./routes/index');
  var ws = require('./routes/ws');
  var master = require('./routes/master');
  //var park = require('./routes/park');

  var app = express();
  app.set('port', process.env.PORT || 3000);

  var server = app.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + server.address().port);
  });

  var io = require('socket.io').listen(server, {log: false});
  server.listen(8080);
}
catch (err)
{
  console.log("App.js > Error during the modules affectations (code 001)\n" + err.message);
}

/****** GLOBALES ******/
google_map_key = 'AIzaSyB6al2AF1Y9NP44-ad_cF55BmxnCpgymEY';
debug_mode = false;
env = "dev_c9"; // dev/dev_c9/prod
zone_length = 65;
nb_pokemon_zone = 10;

/****** VIEW ENGINE SETUP ******/
try
{
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'twig');
  app.set("twig options", {
    strict_variables: false
  });
}
catch (err)
{
  console.log("App.js > Error during the view engine init (code 002)\n" + err.message);
}

try
{
  app.use(favicon());
  app.use(logger('dev'));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded());
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(app.router);
}
catch (err)
{
  console.log("App.js > Error during the app usages init (code 003)\n" + err.message);
}

try
{
  app.get('/', index.index);
  app.post('/ws/contact', ws.contact);
  app.get('/master', master.index);
  //app.get('/park', park.park);
}
catch (err)
{
  console.log("App.js > Error during the routing declaration (code 004)\n" + err.message);
}

/****** CACHE / DB ******/
try
{
  var host_redis, port_redis, host_db;
  if (env == "dev")
  {
    host_redis = "127.4.24.1";
    port_redis = 16379;
    host_db = "localhost";
  }
  else if (env == "dev_c9")
  {
    host_redis = "127.4.24.1";
    port_redis = "16379";
    host_db = "real-safari-park.cwazuxifehxl.us-west-2.rds.amazonaws.com";
  }
  else
  {
    host_redis = "";
    port_redis = "";
    host_db = "real-safari-park.cwazuxifehxl.us-west-2.rds.amazonaws.com";
  }

  var client = redis.createClient(port_redis, host_redis);

  client.on("error", function (err) {
    console.log("Redis error : " + err);
  });

  dbManager.db_connect(host_db);

  var userSockets = {};
}
catch (err)
{
  console.log("App.js > Error during the databases init (code 005)\n" + err.message);
}
/****************/
/*              */
/*    ERRORS    */
/*              */
/****************/

try
{
  /// catch 404 and forwarding to error handler
  app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  /// error handlers

  // development error handler
  // will print stacktrace
  if (app.get('env') == 'development') {
    app.use(function (err, req, res, next) {
      res.render('error', {
        message: err.message,
        error: err
      });
    });
  }

  // production error handler
  // no stacktraces leaked to user
  app.use(function (err, req, res, next) {
    res.render('error', {
      message: err.message,
      error: {}
    });
  });
}
catch (err)
{
  console.log("App.js > Error during error handling (code 006)\n" + err.message);
}

module.exports = app;

/*****************/
/*               */
/*      ALL      */
/*               */
/*****************/

/*****************/
/*               */
/*     INDEX     */
/*               */
/*****************/
/* handler */
try
{
  io.sockets.on('connection', function (socket) {
    socket.on('client_server_auth', function (data) {
      handlerAuth(socket, data);
    });

    socket.on('client_server_add_user', function (data) {
      handlerAddUser(socket, data);
    });

    socket.on('client_server_check_log', function (data) {
      handlerCheckLog(socket, data);
    });

    socket.on('client_server_answer_coords', function (data) {
      handlerPostCoords(socket, data);
    });

    socket.on('client_server_answer_new_points', function (data) {
      handlerPostPokemons(data, socket);
    });
  });
}
catch (err)
{
  console.log("App.js > Error during client messages handlering (code 010)\n" + err.message);
}

/****************/
/*              */
/*     PARK     */
/*              */
/****************/

var __users = [];
var __radius = 65;
var __all_pokemons = [];

/********************* MESSAGES *********************/
function handlerAuth(socket, data) {
  try
  {
    function callback()
    {
      if (debug_mode == true)
      {
        console.log("User inserted or updated, we can redirect to the park ! :D");
      }
      authOk(socket, data);
    }
    if (data.fb_id != "unknown_user")
    {
      data.fb_id += "_" + socket.id;
      console.log("You are the user :" + data.fb_id);
      dbManager.db_userAuth(data.fb_id, callback);
    }
    else
    {
      var json = {data: data.fb_id};
      authOk(socket, json);
    }
  }
  catch (err)
  {
    console.log("App.js > Error in the function handlerAuth(socket, data) (code 020)\n" + err.message);
  }
}

function handlerCheckLog(socket, data)
{
  try
  {
    function callback(is_logged)
    {
      sendResponseCheckLogged(socket, is_logged);
    }
    dbManager.db_checkUserIsLogged(data.fb_id, callback);
  }
  catch (err)
  {
    console.log("App.js > Error in the function handlerCheckLog(socket, data) (code 021)\n" + err.message);
  }
}

function handlerPostCoords(socket, data)
{
  try
  {
    var id = data.id;

    client.hget("user", "user_" + id, function (error, user) {
      if (error == null && user != null)
      {
        var user_data = JSON.parse(user);
        user_data.coords = data.coords;
        checkPokemon(user_data.fb_id, user_data.coords, socket);
        user_data.updated_at = new Date().getTime();
        client.hset("user", "user_" + user_data.fb_id, JSON.stringify(user_data), redis.print);
      }
    });
  }
  catch (err)
  {
    console.log("App.js > Error in the function handlerPostCoords(socket, data) (code 022)\n" + err.message);
  }
}

function handlerPostPokemons(data, socket)
{
  try
  {
    var pokemon, area_pokemon = [];
    // Pour tous les nouveaux points reçus

    if (debug_mode == true)
    {
      console.log("We have received a list of points (" + data.pokemons.length + "), we will create the pokemon");
    }
    for (var i = 0; i < data.pokemons.length; i++) {
      pokemon = {};
      // on crée un pokemon
      pokemon.rarity = getPokemonRarity();
      // on lui attribue ses coordonnées
      pokemon.coords = data.pokemons[i].coords;
      // on le stock dans un tableau
      area_pokemon[i] = pokemon;
    }

    var callback_create = function (pokemons)
    {
      var callback_save = function ()
      {
        // on ajoute ces pokemons dans la liste de ceux de l'utilisateur
        // et on met à jour l'info "updated_at" de l'utilisateur
        var fb_id = data.user_id;

        client.hget("user", "user_" + fb_id, function (error, user) {
          if (error == null && user != null)
          {
            var user_data = JSON.parse(user);
            user_data.coords = data.coords;
            user_data.updated_at = new Date().getTime();
            var user_pokemons = new Array();
            var i = 0;
            if (user_data.pokemon != null)
            {
              i = user_data.pokemon.length;
              user_pokemons = user_data.pokemon;
            }
            for (var j = 0; j < pokemons.length; j++)
            {
              var d = pokemons[j];
              if (debug_mode == true)
              {
                console.log("Pokemon : " + util.inspect(d, false, null));
              }

              user_pokemons[i++] = {
                id: d.id,
                name: d.name,
                number: d.number,
                gif: d.gif,
                png: d.png,
                category: d.category,
                place: d.place,
                expires_at: d.expires_at
              };
            }
            client.hset("user", "user_" + user_data.fb_id, JSON.stringify(user_data), redis.print);
          }
        });
        if (debug_mode == true)
        {
          console.log("We have saved the new popped pokemons in redis and in the db");
        }

        // on envoi les pokemons à l'utilisateur pour affichage
        var json = {pokemons: area_pokemon}
        sendPokemons(json, socket);
      };

      // on sauvegarde ce tableau en base de données
      dbManager.db_savePoppedPokemons(pokemons, callback_save);
    };
    dbManager.db_createNewPokemons(area_pokemon, callback_create);
  }
  catch (err)
  {
    console.log("App.js > Error in the function handlerPostCoords(socket, data) (code 023)\n" + err.message);
  }
}


/********************* SEND *********************/
function authOk(socket, data)
{
  try
  {
    // We store the user in redis
    var user = {};
    user.fb_id = data.fb_id;
    user.updated_at = new Date().getTime();

    client.hset("user", "user_" + data.fb_id, JSON.stringify(user), redis.print);

    // We store the socket on the server
    userSockets[data.fb_id] = socket;

    // We launch the cron
    setInterval(cron, 5000);
    socket.emit('server_client_auth_ok', {});
  }
  catch (err)
  {
    console.log("App.js > Error in the function authOk(socket, data) (code 024)\n" + err.message);
  }
}

function sendResponseCheckLogged(socket, is_logged)
{
  try
  {
    socket.emit('server_client_answer_check_logged', {is_logged: is_logged});
  }
  catch (err)
  {
    console.log("App.js > Error in the function sendResponseCheckLogged(socket, is_logged) (code 025)\n" + err.message);
  }
}

function askCoords(fb_id)
{
  try
  {
    var socket = userSockets[fb_id];
    socket.emit('server_client_ask_coords', {
      id: fb_id
    });
  }
  catch (err)
  {
    console.log("App.js > Error in the function askCoords(fb_id) (code 026)\n" + err.message);
  }
}

function createAPokemon(fb_id, nb) {
  try
  {
    var socket = userSockets[fb_id];
    socket.emit('server_client_ask_new_points', {
      nb: nb,
      user_id: fb_id,
      radius: zone_length
    });
  }
  catch (err)
  {
    console.log("App.js > Error in the function createAPokemon(fb_id, nb) (code 027)\n" + err.message);
  }
}

function sendPokemons(json, socket)
{
  try
  {
    socket.emit('server_client_send_pokemons', json);
  }
  catch (err)
  {
    console.log("App.js > Error in the function sendPokemons(json, socket) (code 028)\n" + err.message);
  }
}

/********************* METIER *********************/
function checkPokemon(fb_id, coords, socket)
{
  try
  {
    function callback(_result)
    {
      if (debug_mode == true)
      {
        console.log("We have checked the pokemon in the area for the user " + fb_id);
      }
      
      if(_result != null)
      {
        var data = _result.rows;
        var json = [];
        var i = 0;
        var d, place, ar_place, obj_place;
        for (var j = 0; j < data.length; j++)
        {
          d = data[j];
          if (debug_mode == true)
          {
            console.log("Pokemon : " + util.inspect(d, false, null));
          }
  
          place = d.place;
          place = place.slice(1);
          place = place.substring(0, place.length - 1);
  
          ar_place = place.split(',');
          obj_place = {k: ar_place[0], B: ar_place[1]}
  
          json[i++] = {
            id: d.id,
            name: d.name,
            number: d.number,
            gif: d.gif,
            png: d.png,
            rarity: d.category,
            coords: obj_place,
            expires_at: d.expires_at,
            d: d.d
          };
        }
      
        if (i > 0)
        {
          // Ajouter les pokemons dans les infos du user dans redis
          client.hget("user", "user_" + fb_id, function (error, user) {
            if (error == null && user != null)
            {
              var user_data = JSON.parse(user);
              user_data.updated_at = new Date().getTime();
              user_data.pokemon = json;
              client.hset("user", "user_" + user_data.fb_id, JSON.stringify(user_data), redis.print);
            }
          });
        }
  
        var nb = nb_pokemon_zone - _result.rowCount;
        if (nb > 0)
        {
          createAPokemon(fb_id, nb);
        }
        else
        {
          var json = {pokemons: json}
  
          sendPokemons(json, socket);
        }
      }
    }
    dbManager.db_checkPokemonInArea(fb_id, coords, zone_length, nb_pokemon_zone, callback);
  }
  catch (err)
  {
    console.log("App.js > Error in the function checkPokemon(fb_id, coords, socket) (code 029)\n" + err.message);
  }
}

function getPokemonRarity()
{
  try
  {
    var r = Math.random();
    var x = Math.floor(r * 10000 + 1);
    if (x == 1) { // 1
      return "06_ultimate"
    }
    else if (x > 1 && x <= 300) { // 299
      return "05_very_rare";
    }
    else if (x > 300 && x <= 1100) { // 800
      return "04_rare";
    }
    else if (x > 1100 && x <= 3000) { // 1 900
      return "03_not_common";
    }
    else if (x > 3000 && x <= 6000) { // 3 000
      return "02_common";
    }
    else { // 4000
      return "01_very_common";
    }
  }
  catch (err)
  {
    console.log("App.js > Error in the function getPokemonRarity (code 030)\n" + err.message);
  }
}

/********************* TRAITEMENT *********************/
var cron = function () {
  try
  {
    var u, n, keys, user_data;

    var fb_id, updated_at;

    client.hgetall("user", function (err, obj) {
      if (obj != null)
      {
        keys = Object.keys(obj);
        keys.forEach(function (user, i) {
          user_data = JSON.parse(obj[user]);

          fb_id = user_data.fb_id;
          updated_at = user_data.updated_at;

          n = new Date().getTime();

          var delta = n - updated_at;

          if (debug_mode == true)
          {
            console.log("User :" + fb_id + " (updated at :" + updated_at + ") (delta :" + delta + ")");
          }
          // Si la date de dernière mise à jour date de plus de 15 secondes, on supprime le user
          if (delta > 15000 || updated_at == undefined) {
            delete obj[user];

            client.hdel("user", "user_" + fb_id, function (err) {
              if (debug_mode == true)
              {
                console.log("Deletion of user : " + fb_id);
              }
            });

            return;
          }

          // On lui demande ses nouvelles coordonées
          askCoords(fb_id);
        });
      }
    });
  }
  catch (err)
  {
    console.log("App.js > Error in the function cron (code 031)\n" + err.message);
  }
};
