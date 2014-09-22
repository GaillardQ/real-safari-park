/*
 * WS .
 */
var nodemailer = require('nodemailer');

exports.contact = function(req, res) {
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
        subject: '[CONTACT] '+subject+' ('+mail+')', // Subject line
        text: message, // plaintext body
        html: n2br(message, true) // html body
    };

    if(transporter != null && mailOptions != null)
    {
        transporter.sendMail(mailOptions, function(error, info){
            if(error){
                console.log(error);
            }else{
                console.log('Message sent: ' + info.response);
            }
        });                                     
    }
    
};

function n2br(str, is_xhtml) {

  var breakTag = (is_xhtml || typeof is_xhtml === 'undefined') ? '<br ' + '/>' : '<br>'; // Adjust comment to avoid issue on phpjs.org display

  return (str + '')
    .replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + breakTag + '$2');
}
