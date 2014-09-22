
function initMasterIndex(app_id, host) {
    initializeMaster(host);
    
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
            var isMe = false;
            // Here we specify what we do with the response anytime this event occurs. 
            if (response.status === 'connected') {
                // The response object is returned with a status field that lets the app know the current
                // login status of the person. In this case, we're handling the situation where they 
                // have logged in to the app.
                if(true) //si mon id
                {
                    isMe = true;
                }
            }
            
            if(!isMe)
            {
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


function initializeMaster(host) {
    initializeMasterMap();
}