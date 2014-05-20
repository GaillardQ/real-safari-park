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
dbManager.db_connect();

var userSockets = new Array();

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

/*** MESSAGES ***/
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
    client.hset("user", "user_"+data.fb_id, data, redis.print);
    /* How to get all the users
    -----------------------------
    client.hkeys("user", function (err, replies) {
        console.log(replies.length + " replies:");
        replies.forEach(function (reply, i) {
            console.log("    " + i + ": " + reply);
        });
    });*/
    
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
    var user = __users[id];
    if(user !== null && user !== undefined)
    {
        __users[id].coords = data.coords;
        checkPokemon(__users[id]);
        __users[id].updated = new Date().getTime();
    }
}

function handlerPostPokemons(data, socket) {
    var pokemon, area_pokemon = [];
    for (var i = 0; i < data.pokemons.length; i++) {
        pokemon = getPokemonData();
        pokemon.coords = data.pokemons[i].coords;
        area_pokemon[i] = pokemon;
    }
    __all_pokemons = __all_pokemons.concat(area_pokemon);
    console.log('user_id : '+data.user_id);
    var user = __users[data.user_id];
    if(user === undefined)
    {
        handlerConnection(socket);
    }
    if(user.pokemons !== null && user.pokemons !== undefined)
    {
        user.pokemons = user.pokemons.concat(area_pokemon);
    }
    else
    {
        user.pokemons = area_pokemon;
    }
    var json = {pokemons: area_pokemon}
    sendPokemons(json, socket);
}


/* send */
function authOk(socket)
{
    socket.emit('server_client_auth_ok', {});
}

function sendResponseCheckLogged(socket, is_logged)
{
    socket.emit('server_client_answer_check_logged', {is_logged: is_logged});
}

function askCoords(user, id) {
    user.socket.emit('server_client_ask_coords', {
        id: id
    });
}

function createAPokemon(user, nb) {
    user.socket.emit('server_client_ask_new_points', {
        nb: nb,
        user_id: user.id
    });
}

function sendPokemons(json, socket)
{
    socket.emit('server_client_send_pokemons', json);
}

/*** METIER ***/
function checkPokemon(user) {
    var user_pokemon = [];
    var p, obj, center;
    for (var i = 0; i < __all_pokemons.length; i++) {   
        p = __all_pokemons[i];
        obj = {
            latitude: p.coords.k,
            longitude: p.coords.A
        };
        center = {
            latitude: user.coords.lat,
            longitude: user.coords.long
        };
        if (geolib.isPointInCircle(obj, center, __radius)) {
            user_pokemon[user_pokemon.length] = p;
        }
    }

    //Création des pokemons
    var nb = 20 - user_pokemon.length;
    if(nb > 0)
    {
        createAPokemon(user, nb);
    }
}

function getPokemonData() {
    var r = Math.random();
    var x = Math.floor(r * 10000 + 1);
    if (x == 1) { // 1
        return selectUltimatePokemon();
    }
    else if (x > 1 && x <=300) { // 299
        return selectVeryRarePokemon();
    }
    else if (x > 300 && x <= 1100) { // 800
        return selectRarePokemon();
    }
    else if (x > 1100 && x <= 3000) { // 1 900
        return selectNotCommonPokemon();
    }
    else if (x > 3000 && x <= 6000) { // 3 000
        return selectCommonPokemon();
    }
    else { // 4000
        return selectVeryCommonPokemon();
    }
}

function selectUltimatePokemon() {
    var n = dico.ultimate.length;
    var index = Math.floor(Math.random()*n);
    return dico.getUltimatePokemon(index);
}

function selectVeryRarePokemon() {
    var n = dico.very_rare.length;
    var index = Math.floor(Math.random()*n);
    return dico.getVeryRarePokemon(index);
}

function selectRarePokemon() {
    var n = dico.rare.length;
    var index = Math.floor(Math.random()*n);
    return dico.getRarePokemon(index);
}

function selectNotCommonPokemon() {
    var n = dico.not_common.length;
    var index = Math.floor(Math.random()*n);
    return dico.getNotCommonPokemon(index);
}

function selectCommonPokemon() {
    var n = dico.common.length;
    var index = Math.floor(Math.random()*n);
    return dico.getCommonPokemon(index);
}

function selectVeryCommonPokemon() {
    var n = dico.very_common.length;
    var index = Math.floor(Math.random()*n);
    return dico.getVeryCommonPokemon(index);
}

/*** TRAITEMENT ***/
var cron = function() {
    var u;
    var n;
    
    client.hkeys("user", function (err, replies) {
        console.log(replies.length + " replies:");
        replies.forEach(function (reply, i) {
            // reply : user_516649118
        });
    })
    
    for (var i = 0; i < __users.length; i++) {
        u = __users[i];
        n = new Date().getTime();

        // Si la date de dernière mise à jour date de plus de 15 secondes, on supprime le user
        if (n - u.updated > 15000) {
            __users.splice(i, 1);
            continue;
        }

        // On lui demande ses nouvelles coordonées
        askCoords(u, i);
    }
};
