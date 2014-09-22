/*
 * WS .
 */
var nodemailer = require('nodemailer');

exports.contact = function(req, res) {
    var json = {}

    var mail = req.body.email;
    var subject = req.body.subject;
    var message = req.body.message;
    
    var transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: 'contact.realsafaripark@gmail.com',
            pass: '10ApQmWn'
        }
    });
    
    var mailOptions = {
        from: 'An user <'+mail+'>', // sender address
        to: 'real.safari.park@gmail.com', // list of receivers
        replyTo: mail,
        subject: '[CONTACT] '+subject+' ('+mail+')', // Subject line
        text: message, // plaintext body
        html: n2br(message, true) // html body
    };

    if(transporter != null && mailOptions != null)
    {
        transporter.sendMail(mailOptions, function(error, info){
            if(error){
                json.code = 500;
                console.log(info.response);
            }else{
                json.code = 200;
            }
        });                                     
    }
    else
    {
        json.code = 500;
    }
    res.json(json);
};

function n2br(str, is_xhtml) {
  // Adjust comment to avoid issue on phpjs.org display
  var breakTag = (is_xhtml || typeof is_xhtml === 'undefined') ? '<br ' + '/>' : '<br>'; 
  
  return (str + '')
    .replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + breakTag + '$2');
}
