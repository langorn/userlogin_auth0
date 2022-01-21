var router = require('express').Router();
const { text } = require('express');
const { requiresAuth } = require('express-openid-connect');
const { createUser , queryUser, queryUsers, updateUser, activateUser, userStatistic, updateUserName } = require('../db/sqldb');
const nodemailer = require("nodemailer");
const configFile = require('../config.json');
var transporter;

// swagger document
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
// const swaggerDocument = require('./swagger.json');

const swaggerDocument = {
  openapi: 3.0.n,
  swaggerDefinition: {
      info: {
          title: "User Management API",
          description: "User Management API DOCS",
          contact: {
              name: "Mark Tai"
          },
          servers: ["http://localhost:3000"]
      }
  },
  apis: ["./routes/index*.js"]
}

var options = {
  explorer: true,
};

// initial of nodemailer
async function buildMailServer() {
    let testAccount = nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
          user: configFile.GMAIL_USERNAME,
          pass: configFile.GMAIL_PASSWORD
      }
  });
}
buildMailServer();

const swaggerDocs = swaggerJsDoc(swaggerDocument);
router.use('/api-docs', swaggerUi.serve);
router.get('/api-docs', swaggerUi.setup(swaggerDocs, options));


router.get('/', function (req, res, next) {

  res.render('index', {
    title: 'User Login System',
    isAuthenticated: req.oidc.isAuthenticated()
  });
});

router.get('/login', (req, res) => res.oidc.login({ returnTo: '/afterlogin' }));

router.get('/afterlogin', async (req, res) => {
  if (req.oidc.user) {
      let thedata = await queryUser(req.oidc.user['email']);
      let verifiedCode = (Math.random() + 1).toString(31).substring(3);
      
      // if user exist
      // update the count of login and last sessions
      if (thedata.result.length >= 1) {
          let isEmailVerified = getRegisterSource(req.oidc.user['sub'], thedata.result[0]['email_verified']);
          // if user is verified, add login count
          if (isEmailVerified) {
              updateUser(thedata.result[0]);
          } else {
              //send confirmation letter
              res.redirect('/unverified');
          }
      } else if (thedata.result.length == 0) {
      // if not exist , create user in db record.
          createUser(req.oidc.user, verifiedCode);
          sendConfirmation(req.oidc.user['email'], verifiedCode);

          let sub_arr = req.oidc.user['sub'].split('|');
          if (sub_arr[0] == 'auth0') {
              //send confirmation letter
              res.redirect('/unverified');
          }

      } else {
          console.log(`the length is : ${thedata.result.length}`);
      }
      res.redirect('/dashboard');
  } 

});

router.get('/dashboard', requiresAuth(), async (req, res) => {
  if (req.oidc.user) {
    let thedata = await queryUser(req.oidc.user['email']);

    let isEmailVerified = getRegisterSource(req.oidc.user['sub'], thedata.result[0]['email_verified']);
    // if user is verified, add login count
    if (isEmailVerified) {
        res.render('dashboard', {
          title: 'Dashboard',
          isAuthenticated: req.oidc.isAuthenticated()
        });
    } else {
        //send confirmation letter
        res.redirect('/unverified');
    }
  } else {
      res.redirect('/')
  }

});

// Routes
/**
 * @swagger
 * /users:
 *   get:
 *     description: Query all users.
 *     responses:
 *       200:
 *         description: query successful.
 */
router.get('/users', async (req, res) => {

    let pgs = req.query.pgs;
    let users = await queryUsers(pgs);
    console.log(users);
    res.send(users);
});


// Routes
/**
 * @swagger
 * /statistics:
 *   get:
 *     description: Query user statistics data 
 *     responses:
 *       200:
 *         description: query successful.
 */
router.get('/statistics', async (req, res) => {
    let statistics = await userStatistic();
    console.log(statistics);
    res.send(statistics);
});

router.post('/updateUserName', requiresAuth(),  async (req, res) => {
  if (req.oidc.user) {
      let thedata = await queryUser(req.oidc.user['email']);
      if (thedata.result.length >= 1) {
          await updateUserName(thedata.result[0]['id'], req.body.name);
          res.send('update success');
      }
      res.send('update success');
      // return result;
  }
  res.send('update success');
   console.log(req.body.name);

});


function getRegisterSource (sub, email_verified) {
  let result = false;
  let textArr = sub.split('|');
  if (textArr && textArr.length > 0) {
      console.log(textArr);
      console.log(email_verified);
      if (textArr[0] != 'facebook' && textArr[0] != 'google-oauth2' && email_verified == 1) {
          result = true;
      } else if (textArr[0] == 'facebook' || textArr[0] == 'google-oauth2') {
          result = true;
      }
  } 
  return result;
}

function sendConfirmation (email, verifiedCode) {

  let site_url = `${configFile.WEBSITE_URL_EMAIL}?gmail=${email}&code=${verifiedCode}`;
  transporter.sendMail({
      from: 'bolehlands@gmail.com', // sender address
      to: email, // list of receivers
      subject: "Welcome Email", // Subject line
      //text: "Hello world?", // plain text body
      html: `This email is sent through <b>GMAIL SMTP SERVER</b><a href="${site_url}">${site_url}, <br> Click This Link TO Activate Your Account</a>`, // html body
  });
}


router.get('/unverified', requiresAuth(), async function (req, res, next) {
    if (req.oidc.user) {
      let thedata = await queryUser(req.oidc.user['email']);

      let isEmailVerified = getRegisterSource(req.oidc.user['sub'], thedata.result[0]['email_verified']);
      // if user is verified, add login count
      if (isEmailVerified) {
          res.redirect('/dashboard')
      } else {
        res.render('unverified', {
          title: 'Please Check Your Mail Again'
        });
      }
    } 

    res.render('unverified', {
      title: 'Please Check Your Mail Again'
    });

});

router.get('/resend/activation', async function (req, res, next) {
    if (req.oidc.user) {
        let thedata = await queryUser(req.oidc.user['email']);
        if (thedata.result.length >= 1) {
            sendConfirmation(req.oidc.user['email'], thedata.result[0]['verified_code']);
        }
        res.send('Activation sent!');
    } else {
        res.send('Please Log in First!');
    }
});

router.get('/activation', async function (req, res, next) {
    let gmail = req.query.gmail;
    let code = req.query.code;
    let result = await activateUser(gmail, code);
    let email_verified = false;
    let msg = 'Verification Code Invalid';
    if (result && result['email_verified']) {
        email_verified = true;
        msg = 'Account Activated...';
    };
    res.render('activation', {
      title: 'Account Activation',
      isAccVerified: msg
    });
});

router.get('/profile', requiresAuth(), function (req, res, next) {
  res.render('profile', {
    userProfile: JSON.stringify(req.oidc.user, null, 2),
    title: 'Profile page'
  });
});

module.exports = router;
