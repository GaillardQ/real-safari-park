function initPark(app_id, host) {
    window.fbAsyncInit = function() {
        FB.init({
            appId: app_id,
            status: true, // check login status
            cookie: true, // enable cookies to allow the server to access the session
            xfbml: true // parse XFBML
        });

        FB.getLoginStatus(function(response) {
            if (response.status === 'not_authorized') {
                location.href = "/";
            }
            else if (response.status === 'connected') {
            }
            else {
                location.href = "/";
            }
        });

        // Here we subscribe to the auth.authResponseChange JavaScript event. This event is fired
        // for any authentication related change, such as login, logout or session refresh. This means that
        // whenever someone who was previously logged out tries to log in again, the correct case below 
        // will be handled. 
        FB.Event.subscribe('auth.authResponseChange', function(response) {
            // Here we specify what we do with the response anytime this event occurs. 
            if (response.status === 'connected') {
                // The response object is returned with a status field that lets the app know the current
                // login status of the person. In this case, we're handling the situation where they 
                // have logged in to the app.
                FB.api('/me', function(response) {
                    socket = io.connect(host);
                    // On ne check plus le champs logged : perte de temps
                    /*socket.emit('client_server_check_log', { fb_id:response.id });
                    socket.on('server_client_answer_check_logged', function (data) {
                        if(data.is_logged)
                        {
                            initialize(host)
                        }
                        else {
                            location.href = "/";
                        }
                    });*/
                    socket.emit('client_server_add_user', { fb_id:response.id });
                    initialize(host);
                });
            }
            else if (response.status === 'not_authorized') {
                // In this case, the person is logged into Facebook, but not into the app, so we call
                // FB.login() to prompt them to do so. 
                // In real-life usage, you wouldn't want to immediately prompt someone to login 
                // like this, for two reasons:
                // (1) JavaScript created popup windows are blocked by most browsers unless they 
                // result from direct interaction from people using the app (such as a mouse click)
                // (2) it is a bad experience to be continually prompted to login upon page load.
                location.href = "/";
            }
            else {
                // In this case, the person is not logged into Facebook, so we call the login() 
                // function to prompt them to do so. Note that at this stage there is no indication
                // of whether they are logged into the app. If they aren't then they'll see the Login
                // dialog right after they log in to Facebook. 
                // The same caveats as above apply to the FB.login() call here.
                location.href = "/";
            }
        });
    };

    // Load the SDK asynchronously
    (function(d) {
        var js, id = 'facebook-jssdk',
            ref = d.getElementsByTagName('script')[0];
        if (d.getElementById(id)) {
            return;
        }
        js = d.createElement('script');
        js.id = id;
        js.async = true;
        js.src = "//connect.facebook.net/fr_FR/all.js";
        ref.parentNode.insertBefore(js, ref);
    }(document));
}

function sendCoords(coords) {
    var json = {
        id: user_id,
        coords: {
            lat: coords.k,
            long: coords.B
        }
    };
    socket.emit('client_server_answer_coords', json);
}

function sendPokemonsPlace(json) {
    socket.emit('client_server_answer_new_points', json);
}

function initialize(host) {
    initializeMap();
    
    socket.on('server_client_ask_coords', function(data) {
        user_id = data.id;
        geoLocalization();
    });

    socket.on('server_client_ask_new_points', function(data) {
        var pokemons = [];
        var nb = data.nb;
        user_area_radius = data.radius;

        var p, m, n, d;
        var json = {
            pokemons: []
        };
        for (var i = 0; i < nb; i++) {
            n = Math.random();
            n = (n * 360) + 1;

            d = Math.random();
            d = (d * user_area_radius) + 1;

            p = user_location.destinationPoint(n, d / 1000);
            json.pokemons[i] = {
                coords: p
            }
            json.user_id = data.user_id;
        }
        sendPokemonsPlace(json);
    });

    socket.on('server_client_send_pokemons', function(data) {
        var nb = data.pokemons.length;

        if (map_pokemons !== null && map_pokemons !== undefined) {
            var p;
            for (var i = 0; i < nb; i++) {
                p = map_pokemons[i];
                p.setMap(null);
            }
        }
        
        console.log("All pokemons to show : "+data);
        
        map_pokemons = null;

        for (var i = 0; i < nb; i++) {
            var position = new google.maps.LatLng(data.pokemons[i].coords.k, data.pokemons[i].coords.B);
            console.log('Pokemon ('+data.pokemons[i].png+'): ' + position);
            var pokemon_coords = new google.maps.Marker({
                position: position,
                title: "Pokemon " + i,
                icon: data.pokemons[i].png
            });

            pokemon_coords.setMap(map);
        }
    });
}

function toggleHelp() {
    $("#help-popup").toggle();
}
