const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync.js');
const { encodeSchema } = require('../schema.js');
const ExpressError = require('../utils/ExpressError.js');
const Encode = require('../models/encode.js');

// Multer configuration
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, 'public/uploads/');
//     },
//     filename: (req, file, cb) => {
//         cb(null, Date.now() + '-' + file.originalname);
//     }
// });
// const upload = multer({ storage });

// Simple steganography function
// function hideMessage(imageBuffer, message) {
//     const messageBytes = Buffer.from(message, 'utf8');
//     const lengthBytes = Buffer.alloc(4);
//     lengthBytes.writeUInt32BE(messageBytes.length, 0);
    
//     const dataToHide = Buffer.concat([lengthBytes, messageBytes]);
//     const modifiedImage = Buffer.from(imageBuffer);
    
//     for (let i = 0; i < dataToHide.length * 8 && i < modifiedImage.length; i++) {
//         const byteIndex = Math.floor(i / 8);
//         const bitIndex = i % 8;
//         const bit = (dataToHide[byteIndex] >> (7 - bitIndex)) & 1;
//         modifiedImage[54 + i] = (modifiedImage[54 + i] & 0xFE) | bit;
//     }
    
//     return modifiedImage;
// }


router.get('/home', (req, res) => {
    res.render('pages/home.ejs');
});

router.get('/encode', (req, res) => {
    res.render('pages/encode.ejs');
});

// router.post('/encode', wrapAsync, upload.single('image'), async(req, res, next) => {
//     try {
//         const { message, email } = req.body;
//         const imageFile = req.file;
        
//         if (!imageFile || !message) {
//             return res.status(400).send('Image and message are required');
//         }
        
//         // Read the uploaded image
//         const imageBuffer = require('fs').readFileSync(imageFile.path);
        
//         // Hide message in image
//         const encodedImage = hideMessage(imageBuffer, message);
        
//         // Save encoded image
//         const encodedPath = `public/uploads/encoded-${Date.now()}.png`;
//         require('fs').writeFileSync(encodedPath, encodedImage);
        
//         // Save to database
//         const newEncode = new Encode({ 
//             email, 
//             image: imageFile.filename,
//             encodedImage: encodedPath.replace('public/', ''),
//             message: message.substring(0, 50) + '...' // Store preview only
//         });
//         await newEncode.save();
        
//         res.json({ 
//             success: true, 
//             encodedImage: encodedPath.replace('public/', ''),
//             message: 'Message encoded successfully!' 
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).send('Encoding failed');
//     }
// });

router.get('/decode', (req, res) => {
    res.render('pages/decode.ejs');
});

router.get('/decode/:id', (req, res) => {
    let { id } = req.params;
    const eData = Encode.findById(id);
    console.log(eData);
});

// Admin credentials
const ADMIN_EMAIL = 'poorvaj@gmail.com';
const ADMIN_USERNAME = 'poorvaj';
const ADMIN_PASSWORD = 'P29';

// Admin authentication middleware
function requireAdmin(req, res, next) {     // middleware to check if admin is logged in
    if (req.session.isAdmin) {
        return next();
    }
    res.redirect('/admin');
}

router.get('/admin', (req, res) => {    // admin login page
    if (req.session.isAdmin) {      // prevent already logged-in admins from seeing the login page again
        return res.redirect('/listings');
    }
    res.render('pages/admin.ejs');
});

router.post('/admin/login', (req, res) => {     // form action routes to here
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        req.flash('success', 'Logged in successfully as admin');
        res.redirect('/listings');
    } else {
        req.flash('error', 'Invalid admin credentials');
        res.redirect('/admin');
    }
});

router.post('/admin/logout', (req, res) => {    // admin logout
    req.session.isAdmin = false;
    req.flash('success', 'Logged out successfully');
    res.redirect('/admin');
});

router.get('/listings', requireAdmin, async(req, res) => {
    const allData = await Encode.find({});
    res.render('pages/listing.ejs', { allData });
});

router.get('/about', (req, res) => {
    res.render('pages/about.ejs');
});

module.exports = router;