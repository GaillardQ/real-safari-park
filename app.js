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
var park = require('./routes/park');

var app = express();
app.set('port', process.env.PORT || 3000);

var server = app.listen(app.get('port'), function() {
    console.log('Express server listening on port ' + server.address().port);
});

var io = require('socket.io').listen(server, { log: false });
server.listen(8080);

/****** GLOBALES ******/
google_map_key = 'AIzaSyB6al2AF1Y9NP44-ad_cF55BmxnCpgymEY';
env = "dev"; // dev
zone_length = 65;
nb_pokemon_zone = 10;

/****** VIEW ENGINE SETUP ******/
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'twig');
app.set("twig options", {
    strict_variables: false
});

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(app.router);

app.get('/', index.index);
app.get('/park', park.park);

/****** CACHE / DB ******/
var host, port;
if(env == "dev")
{
    host = "127.4.24.1";
    port = 16379;
}
else
{
    host = "";
    port = ""; 
}

var client = redis.createClient(port, host);

client.on("error", function (err) {
    console.log("Redis error : " + err);
});

dbManager.db_connect();

var userSockets = {};

/****************/
/*              */
/*    ERRORS    */
/*              */
/****************/

/// catch 404 and forwarding to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.render('error', {
        message: err.message,
        error: {}
    });
});

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
io.sockets.on('connection', function(socket) {
    socket.on('client_server_auth', function(data){
        handlerAuth(socket, data);
    });
    
    socket.on('client_server_add_user', function(data){
        handlerAddUser(socket, data);
    });
    
    socket.on('client_server_check_log', function(data){
        handlerCheckLog(socket, data);
    });
    
    socket.on('client_server_answer_coords', function(data) {
        handlerPostCoords(data);
    });

    socket.on('client_server_answer_new_points', function(data) {
        handlerPostPokemons(data, socket);
    });
});

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
    function callback()
    {
        console.log("User inserted or updated, we can redirect to the park ! :D");
        authOk(socket)
    }
    dbManager.db_userAuth(data.fb_id, callback);
}

function handlerAddUser(socket, data)
{
    // We store the user in redis
    var user = {};
    user.fb_id = data.fb_id;
    user.updated_at = new Date().getTime();
    
    client.hset("user", "user_"+data.fb_id, JSON.stringify(user), redis.print);
    
    // We store the socket on the server
    userSockets[data.fb_id] = socket;
    
    // We launch the cron
    setInterval(cron, 5000);
}

function handlerCheckLog(socket, data) {
    function callback(is_logged)
    {
        sendResponseCheckLogged(socket, is_logged);
    }
    dbManager.db_checkUserIsLogged(data.fb_id, callback);
}

function handlerPostCoords(data) {
    var id = data.id;
    
    client.hget("user", "user_"+id, function(error, user) {
        if(error == null && user != null)
        {
            var user_data = JSON.parse(user);
            user_data.coords = data.coords;
            checkPokemon(user_data.fb_id, user_data.coords);
            user_data.updated_at = new Date().getTime();
            client.hset("user","user_"+user_data.fb_id, JSON.stringify(user_data), redis.print);
        }
    });
}

function handlerPostPokemons(data, socket) {
    var pokemon, area_pokemon = [];
    // Pour tous les nouveaux points reçus
    for (var i = 0; i < data.pokemons.length; i++) {
        pokemon = {};
        // on crée un pokemon
        pokemon.rarity = getPokemonRarity();
        // on lui attribue ses coordonnées
        pokemon.coords = data.pokemons[i].coords;
        // on le stock dans un tableau
        area_pokemon[i] = pokemon;
    }
    
    var callback_create = function(pokemons)
    {
        var callback_save = function()
        {
            console.log("We have saved the new popped pokemons");
        };
        
        // on sauvegarde ce tableau en base de données
        //dbManager.db_savePoppedPokemons(area_pokemon, callback_save);
        
        // on ajoute ces pokemons dans la liste de ceux de l'utilisateur
        var fb_id = data.user_id;
        
        // on envoi les pokemons à l'utilisateur pour affichage
        
        var json = {pokemons: area_pokemon}
        sendPokemons(json, socket);
    };
    dbManager.db_createNewPokemons(area_pokemon, callback_create);
    
}


/********************* SEND *********************/
function authOk(socket)
{
    socket.emit('server_client_auth_ok', {});
}

function sendResponseCheckLogged(socket, is_logged)
{
    socket.emit('server_client_answer_check_logged', {is_logged: is_logged});
}

function askCoords(fb_id) {

    var socket = userSockets[fb_id];
    socket.emit('server_client_ask_coords', {
        id: fb_id
    });
}

function createAPokemon(fb_id, nb) {
    var socket = userSockets[fb_id];
    socket.emit('server_client_ask_new_points', {
        nb: nb,
        user_id: fb_id,
        radius : zone_length
    });
}

function sendPokemons(json, socket)
{
    socket.emit('server_client_send_pokemons', json);
}

/********************* METIER *********************/
function checkPokemon(fb_id, coords) {
    function callback(_result)
    {
        console.log("We have checked the ploekmon in the area for the user "+fb_id);
        
        var util = require('util');
        
        var data = _result.rows;
        for(var d in data)
        {
            console.log("Pokemon : "+util.inspect(d, false, null));
            // @TODO
            // Ajouter le pokemon dans les infos du user dans redis
        }
        var nb = nb_pokemon_zone - _result.rowCount;
        if(nb > 0)
        {
            createAPokemon(fb_id, nb);
        }
    }
    dbManager.db_checkPokemonInArea(fb_id, coords, zone_length, nb_pokemon_zone, callback);
}

function getPokemonRarity() {
    var r = Math.random();
    var x = Math.floor(r * 10000 + 1);
    if (x == 1) { // 1
        return "06_ultimate"
    }
    else if (x > 1 && x <=300) { // 299
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

/********************* TRAITEMENT *********************/
var cron = function() {
    var u,n,keys,user_data;
    
    var fb_id, updated_at;
    
    client.hgetall("user", function (err, obj) {
        if(obj != null)
        {
            keys = Object.keys( obj );
            keys.forEach(function (user, i) {
                user_data = JSON.parse(obj[user]);
                
                fb_id = user_data.fb_id;
                updated_at = user_data.updated_at;
                
                n = new Date().getTime();
                
                var delta = n - updated_at;
                
                console.log(fb_id+" ("+updated_at+") : "+delta); 
                // Si la date de dernière mise à jour date de plus de 15 secondes, on supprime le user
                if (delta > 15000 || updated_at == undefined) {
                    delete obj[user];
                    
                    client.hdel("user", "user_"+fb_id, function(err) {
                        console.log("Deletion of user : "+fb_id);
                    });
                    
                    return;
                }
                
                // On lui demande ses nouvelles coordonées
                askCoords(fb_id);
            });
        }
    });
};
