const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync.js');
const Encode = require('../models/encode.js');
const { encodeSchema, decodeSchema } = require('../schema.js');
const ExpressError = require('../utils/ExpressError.js');
const multer = require('multer');
const { storage, cloudinary } = require('../cloudConfig.js');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const streamifier = require('streamifier');
const bcrypt = require('bcrypt');
const validator = require('validator');

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

// OTP storage
const otpStore = new Map();

// Email transporter using Gmail App Password
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


router.get('/home', (req, res) => {
    res.render('pages/home.ejs');
});

router.get('/encode', (req, res) => {
    res.render('pages/encode.ejs');
});

router.post('/send-otp', async ( req, res ) => {
    const { email } = req.body;
    if (!validator.isEmail(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, { otp, createdAt: Date.now() });

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your OTP for Steganography Verification',
            text: `Your OTP is: ${otp}. It is valid for 5 minutes.`
        });

        res.status(200).json({ message: 'OTP sent successfully to your email.' });
    } catch (err) {
        console.error('Email sending failed: ', err);
        res.status(500).json({ error: 'Failed to send OTP. Please try again later.'});
    }
});

// ✅ Encode route (with OTP validation)
router.post('/encode', memoryUpload.single('originalImage'), wrapAsync(async (req, res) => {
    // Validate the schema
    let { error } = encodeSchema.validate({
        Encode: {
            message: req.body.Encode.message,
            email: req.body.Encode.email,
            otp: req.body.Encode.otp,
            password: req.body.Encode.password
        }
    });

    if (error) {
        let errMsg = error.details.map((el) => el.message).join(',');
        throw new ExpressError(400, errMsg);
    }

    const { message, email, otp, password } = req.body.Encode;

    // OTP validation
    const stored = otpStore.get(email);
    if (!stored || stored.otp !== otp || Date.now() - stored.createdAt > 5 * 60 * 1000) {
        throw new ExpressError(400, 'Invalid or expired OTP.');
    }
    
    // Upload original image
    const originalUpload = await uploadBufferToCloudinary(req.file.buffer, 'stegohide_DEV/originals', 'orig');

    // Encrypt and hide message
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(password, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(message, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    const payload = `${iv.toString('hex')}:${authTag}:${encrypted}`;
    const stegoBuffer = await hideMessage(req.file.buffer, payload);

    // Upload stego image
    const stegoUpload = await uploadBufferToCloudinary(stegoBuffer, 'stegohide_DEV/stegos', 'stego');

    // Hash password and save to DB
    const hashedPassword = await bcrypt.hash(password, 12);
    const newEncode = new Encode({
        originalImage: {
            url: originalUpload.secure_url,
            filename: originalUpload.public_id
        },
        stegoImage: {
            url: stegoUpload.secure_url,
            filename: stegoUpload.public_id
        },
        email,
        password: hashedPassword
    });
    await newEncode.save();

    // Clear OTP after successful encoding
    otpStore.delete(email);

    req.flash('success', 'Message encoded successfully!');
    res.redirect('/encode');
}));

router.get('/decode', (req, res) => {
    res.render('pages/decode.ejs');
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