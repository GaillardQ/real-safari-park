var socket;

function initIndex(app_id, host) {
    initialize(host);
    socket_auth("unknown_user");
    
    window.fbAsyncInit = function() {
        FB.init({
            appId: app_id,
            status: true, // check login status
            cookie: true, // enable cookies to allow the server to access the session
            xfbml: true // parse XFBML
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
                next(host);
            }
            else if (response.status === 'not_authorized') {
                // In this case, the person is logged into Facebook, but not into the app, so we call
                // FB.login() to prompt them to do so. 
                // In real-life usage, you wouldn't want to immediately prompt someone to login 
                // like this, for two reasons:
                // (1) JavaScript created popup windows are blocked by most browsers unless they 
                // result from direct interaction from people using the app (such as a mouse click)
                // (2) it is a bad experience to be continually prompted to login upon page load.
                FB.login();
            }
            else {
                // In this case, the person is not logged into Facebook, so we call the login() 
                // function to prompt them to do so. Note that at this stage there is no indication
                // of whether they are logged into the app. If they aren't then they'll see the Login
                // dialog right after they log in to Facebook. 
                // The same caveats as above apply to the FB.login() call here.
                FB.login();
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

function next(host)
{
    //console.log('Welcome!  Fetching your information.... ');
    FB.api('/me', function(response) {
        //console.log('Good to see you, ' + response.name + '.');
        socket_auth(response.id);
    });
}

function socket_auth(id)
{
    socket.on('server_client_auth_ok', function (data) {

    });

    socket.emit('client_server_auth', { fb_id:id });
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
    socket = io.connect(host);
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
        displayPokemonsOnMap(data);
    });
}

function displayPokemonsOnMap(data)
{
    var nb = data.pokemons.length;

    if (map_pokemons !== null && map_pokemons !== undefined) {
        var p;
        for (var i = 0; i < map_pokemons.length; i++) {
            p = map_pokemons[i];
            p.setMap(null);
        }
    }

    map_pokemons = null;
    map_pokemons = new Array();
    
    for (var i = 0; i < nb; i++) {
        var position = new google.maps.LatLng(data.pokemons[i].coords.k, data.pokemons[i].coords.B);
        
        var pokemon_coords = new google.maps.Marker({
            position: position,
            title: "Pokemon " + i,
            icon: data.pokemons[i].png
        });
        
        pokemon_coords.setMap(map);
        
        map_pokemons.push(pokemon_coords);
    }
}

function toggleHelp() {
    $("#contact-popup").hide();
    $("#legals-popup").hide();
    $("#help-popup").toggle();
}

function toggleContactForm()
{
    clearContactForm();
    $("#help-popup").hide();
    $("#legals-popup").hide();
    $("#contact-popup").toggle();
}

function clearContactForm()
{
    $('#contact-error').addClass("hidden");
    $('#contact-success').addClass("hidden");
    $('#contact-error').html("");
    $('#contact-success').html("");
    $("#contact-email").val("");
    $("#contact-subject").val(0);
    $("#contact-message").val("");
}

function validContactForm()
{
    var hasError = false;
    var errorMsg = "Le formulaire contient des erreurs :<ul>";
    
    var mail = $("#contact-email").val();
    if(mail == null || mail == "" || typeof(mail) == undefined)
    {
        hasError = true;
        $("#div-contact-email").addClass("has-error");
        errorMsg += "<li>Votre e-mail est vide</li>";
    }
    else
    {
        $("#div-contact-email").removeClass("has-error");
        $("#div-contact-email").addClass("has-success");
    }
        
    var subject = $("#contact-subject").val();
    if(subject == 0)
    {
        hasError = true;
        $("#div-contact-subject").addClass("has-error");
        errorMsg += "<li>Choisissez un sujet</li>";
    }
    else
    {
        $("#div-contact-subject").removeClass("has-error");
        $("#div-contact-subject").addClass("has-success");
    }
    var message = $("#contact-message").val();
    if(message == null || message == "" || typeof(message) == undefined)
    {
        hasError = true;
        $("#div-contact-message").addClass("has-error");
        errorMsg += "<li>Vous devez remplir un message</li>";
    }
    else
    {
        $("#div-contact-message").removeClass("has-error");
        $("#div-contact-message").addClass("has-success");
    }
    
    if(hasError == false)
    {
        sendContactMail(mail, subject,message);
    }
    else
    {
        $("#contact-error").removeClass("hidden");
        $("#contact-error").html(errorMsg);
    }
}

function sendContactMail(mail, subject, message)
{
    var success_msg = "Le message a bien été envoyé.";
    var error_msg   = "Le message n'a pas pu être envoyé, merci de réessayer ultérieurement.";
    $.ajax({
        url:"/ws/contact",
        type : 'POST', // Le type de la requête HTTP, ici devenu POST
        data : {
            email: mail,
            subject: subject,
            message: message
        },
        success:function(result)
        {
            if(result.code == 200)
            {
                $('#contact-error').addClass("hidden");
                $('#contact-success').removeClass("hidden");
                $('#contact-success').html(success_msg);
            }
            else
            {
                $('#contact-success').addClass("hidden");
                $('#contact-error').removeClass("hidden");
                $('#contact-error').html(error_msg);
            }
        },
        error:function(result, status, err)
        {
            $('#contact-success').addClass("hidden");
            $('#contact-error').removeClass("hidden");
            $('#contact-error').html(error_msg);
            console.log("Error send message : "+err);
        }
    });
}

function toggleLegals()
{
    $("#help-popup").hide();
    $("#contact-popup").hide();
    $("#legals-popup").toggle();
}
