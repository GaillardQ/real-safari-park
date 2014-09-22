/***********/
/*** MAP ***/
/***********/
var map;
var mapMaster;

var home_location = new google.maps.LatLng(45.771831, 4.8705933999999615);
var browserSupportFlag =  new Boolean();

var user_location;
var old_user_location;
var user_marker;
var user_icon = "../images/user/user.png";
var user_area;

var user_area_radius = 65;
/****************/
/*** MESSAGES ***/
/****************/
var socket;

/************/
/*** USER ***/
/************/
var user_id;

/***************/
/*** POKEMON ***/
/***************/
var map_pokemons;
