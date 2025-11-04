const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync.js');
const Encode = require('../models/encode.js');
const { encodeSchema, decodeSchema } = require('../schema.js');
const ExpressError = require('../utils/ExpressError.js');
const multer = require('multer');
const { storage, cloudinary } = require('../cloudConfig.js');
const crypto = require('crypto');
// const nodemailer = require('nodemailer');
const streamifier = require('streamifier');
const bcrypt = require('bcrypt');

const { hideMessage, extractMessage } = require('../utils/steganography.js');

// keep existing cloud-storage multer for routes that upload directly to Cloudinary
const upload = multer({ storage });

// memory multer for encode route so we can access req.file.buffer
const memoryUpload = multer({ storage: multer.memoryStorage() });

// helper to upload a Buffer to Cloudinary and return the upload result
function uploadBufferToCloudinary(buffer, folder = '', filename = '') {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder, public_id: filename ? `${filename}-${Date.now()}` : undefined },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        streamifier.createReadStream(buffer).pipe(uploadStream);
    });
}

// // OTP storage
// const otpStore = new Map();

// // Email transporter
// const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS
//     }
// });


router.get('/home', (req, res) => {
    res.render('pages/home.ejs');
});

router.get('/encode', (req, res) => {
    res.render('pages/encode.ejs');
});

/*
  POST /encode
  - Uses memoryUpload to get original image buffer
  - Encrypts message with AES-256-GCM using password-derived key
  - Hides the encrypted payload inside the original image (steganography.hideMessage)
  - Uploads original + generated stego buffers to Cloudinary via uploadBufferToCloudinary
  - Hashes password with bcrypt and saves document to MongoDB
*/
router.post('/encode', memoryUpload.single('originalImage'), wrapAsync(async (req, res) => {
    let { error } = encodeSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(',');
        throw new ExpressError(400, errMsg);
    }

    const { message, email, password } = req.body.Encode;

    if (!req.file || !req.file.buffer) {
        throw new ExpressError(400, 'Original image file is required');
    }

    // AES-256-GCM encryption
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(password, 'salt', 32); // consistent derivation; same at decode
    const iv = crypto.randomBytes(12); // recommended length for GCM
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encryptedMessage = cipher.update(message, 'utf8', 'hex');
    encryptedMessage += cipher.final('hex');
    const authTagHex = cipher.getAuthTag().toString('hex');

    // Store combined payload as encrypted:authTag:ivHex
    const storedMessage = `${encryptedMessage}:${authTagHex}:${iv.toString('hex')}`;

    // Hide the storedMessage string inside the original image buffer
    const originalBuffer = req.file.buffer;
    const stegoBuffer = await hideMessage(originalBuffer, storedMessage);

    // Upload original image and stego image buffers to Cloudinary
    const origUpload = await uploadBufferToCloudinary(originalBuffer, 'stegohide_DEV/originals', `orig-${Date.now()}`);
    const stegoUpload = await uploadBufferToCloudinary(stegoBuffer, 'stegohide_DEV/stegos', `stego-${Date.now()}`);

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 12);

    const newEncode = new Encode({
        originalImage: {
            url: origUpload.secure_url,
            filename: origUpload.public_id
        },
        stegoImage: {
            url: stegoUpload.secure_url,
            filename: stegoUpload.public_id
        },
        // store the combined encrypted payload (so decode can use it without fetching image if desired)
        message: storedMessage,
        email,
        password: hashedPassword
    });

    await newEncode.save();
    req.flash('success', 'Message encoded and stego image created successfully!');
    res.redirect('/encode');
}));

router.get('/decode', (req, res) => {
    res.render('pages/decode.ejs');
});

// // Send OTP for decode
// router.post('/decode/send-otp', wrapAsync(async (req, res) => {
//     const { email } = req.body;
    
//     if (!email.endsWith('@gmail.com')) {
//         return res.status(400).json({ error: 'Only Gmail addresses are allowed' });
//     }
    
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     otpStore.set(email, { otp, expires: Date.now() + 300000 });
    
//     const mailOptions = {
//         from: process.env.EMAIL_USER,
//         to: email,
//         subject: 'Steganography App - Decode Verification',
//         text: `Your OTP for decoding is: ${otp}. Valid for 5 minutes.`
//     };
    
//     await transporter.sendMail(mailOptions);
//     res.json({ success: true, message: 'OTP sent successfully' });
// }));

// // Decode with OTP verification
// router.post('/decode', wrapAsync(async (req, res) => {
//     let { error } = decodeSchema.validate(req.body);
//     if (error) {
//         let errMsg = error.details.map((el) => el.message).join(',');
//         throw new ExpressError(400, errMsg);
//     }
    
//     const { email, password } = req.body.Decode;
    
//     const encodedData = await Encode.findOne({ email });
//     if (!encodedData) {
//         throw new ExpressError(404, 'No encoded data found for this email');
//     }
    
//     const isValidPassword = await bcrypt.compare(password, encodedData.password);
//     if (!isValidPassword) {
//         throw new ExpressError(401, 'Invalid password');
//     }
    
//     const [encryptedMessage, authTag, iv] = encodedData.message.split(':');
//     const algorithm = 'aes-256-gcm';
//     const key = crypto.scryptSync(password, 'salt', 32);
//     const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
//     decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
//     let decryptedMessage = decipher.update(encryptedMessage, 'hex', 'utf8');
//     decryptedMessage += decipher.final('utf8');
    
//     res.json({
//         success: true,
//         message: decryptedMessage,
//         originalImage: encodedData.originalImage.url,
//         stegoImage: encodedData.stegoImage.url
//     });
// }));

// router.get('/decode/:id', (req, res) => {
//     let { id } = req.params;
//     const eData = Encode.findById(id);
//     console.log(eData);
// });

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