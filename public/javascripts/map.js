function initializeMap() {
    var mapOptions = {
        zoom: 18,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        zoomControl: true,
        zoomControlOptions: {
            style: google.maps.ZoomControlStyle.SMALL
        },
        streetViewControl: false,
        scaleControl: false,
        mapTypeControl: false,
        panControl: true
    };
    
    map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);

    if (navigator.geolocation) {
        browserSupportFlag = true;

        //On localise le user pour l'afficher sur la map
        navigator.geolocation.getCurrentPosition(
        handlerInitGeolocation,
        function() {
            handlerInitNoGeolocation(browserSupportFlag);
        }, 
        {
            enableHighAccuracy: true
        });

        // on surveille ses déplacements
        navigator.geolocation.getCurrentPosition(handlerFollowGeolocation);
    }
    // Browser doesn't support Geolocation
    else {
        browserSupportFlag = false;
        handlerInitNoGeolocation(browserSupportFlag);
    }
    
    initParkUI();
}

function handlerInitGeolocation(position) {
    user_location = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
    
    actionOnMap();
}

function handlerInitNoGeolocation(errorFlag) {
    if (errorFlag === true) {
        alert("Geolocation service failed.");
    }
    else {
        alert("Your browser doesn't support geolocation. We've placed you in Siberia.");
    }
    
    user_location = home_location;
    map.setCenter(user_location);
    placeUserMarker(user_location);
    
    stopParkLoader();
}

function initParkUI()
{
    if($("#loader-init-ui") != null)
    {
        $("#loader-init-ui").hide();
    }
    
    if($("#map-canvas") != null)
    {
        $("#map-canvas").show();
    }
}

function stopParkLoader()
{
    if($("#park-loader") != null)
    {
        $("#park-loader").hide();
    }
}

function handlerFollowGeolocation(position) {
    user_location = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
}

function actionOnMap() {
    map.setCenter(user_location);

    placeUserMarker(user_location);
    
    // console.log("old_user_location : " + old_user_location);
    // console.log("user_location : " + user_location);
    
    if(old_user_location != user_location)
    {

        if (user_area !== null && user_area !== undefined) {
            user_area.setMap(null);
            user_area = null;
        }
    
        user_area = new google.maps.Circle({
            strokeColor: '#FF0000',
            strokeOpacity: 0.8,
            strokeWeight: 1,
            fillColor: '#FF0000',
            fillOpacity: 0,
            map: map,
            center: user_location,
            radius: 65
    
        });
    }
    
    stopParkLoader()
}

function placeUserMarker(location) {
    if (location != null && location != undefined) {
        user_location = location;
    }
    
    if (user_marker == null) {
        user_marker = new google.maps.Marker({
            position: user_location,
            title: "Your position",
            icon: user_icon
        });

        user_marker.setMap(map);
    }
    else {
        if(old_user_location != user_location)
        {
            user_marker.setPosition(user_location);
            user_marker.setMap(map);
        }
    }
}

function geoLocalization() {
    if (navigator.geolocation) {
        browserSupportFlag = true;

        //On localise le user pour l'afficher sur la map
        navigator.geolocation.getCurrentPosition(
        handlerGeolocalization,

        function() {
            handlerNoGeolocalization(browserSupportFlag);
        }, {
            enableHighAccuracy: true
        });
    }
    // Browser doesn't support Geolocation
    else {
        browserSupportFlag = false;
        handlerNoGeolocalization(browserSupportFlag);
    }
}

function handlerGeolocalization(position) {
    old_user_location = user_location;
    user_location = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
    console.log("User : "+user_location);
    actionOnMap();
    
    sendCoords(user_location);
}

function handlerNoGeolocalization(errorFlag) {
    if (errorFlag === true) {
        alert("Geolocation service failed.");
    }
    else {
        alert("Your browser doesn't support geolocation. We've placed you in Siberia.");
    }
}

/*CREATION POINT DANS CERCLE*/

function toRad(number) {
   return number * Math.PI / 180;
}

function toDeg(number) {
   return number * 180 / Math.PI;
}

google.maps.LatLng.prototype.destinationPoint = function(brng, dist) {
   dist = dist / 6371;  
   brng = toRad(brng);  

   var lat1 = toRad(this.lat()), lon1 = toRad(this.lng());

   var lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) + 
                        Math.cos(lat1) * Math.sin(dist) * Math.cos(brng));

   var lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dist) *
                                Math.cos(lat1), 
                                Math.cos(dist) - Math.sin(lat1) *
                                Math.sin(lat2));

   if (isNaN(lat2) || isNaN(lon2)) return null;

   return new google.maps.LatLng(toDeg(lat2), toDeg(lon2));
}
