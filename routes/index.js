/*
 * GET index page.
 */

exports.index = function(req, res) {

    var app_id = "";
    var url = "";
    if (env == "dev_c9") {
        app_id = "877586918924042";
        url = "http://nodejs-c9-quenting.c9.io/";
    }
    else if(env == "dev")
    {
   	app_id = "545357798899027";
	url = "http://localhost:3000/";
    }
    else {
        app_id = "268047153375207";
        url = req.protocol+"://"+req.headers.host;
    }

    res.render('index', {
        title: 'Real Safari Park',
        app_id: app_id,
        host: url
    });
};
