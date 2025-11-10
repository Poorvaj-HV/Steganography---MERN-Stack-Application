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

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

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

// Encode route (with OTP validation)
router.post('/encode', memoryUpload.single('originalImage'), wrapAsync(async (req, res) => {
    // Validate the schema
    let { error } = encodeSchema.validate({
        Encode: {
            title: req.body.Encode.title,
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

    const { title, message, email, otp, password } = req.body.Encode;

    // Checking for duplicate title for this email
    const existingTitle = await Encode.findOne({ email, title });
    if (existingTitle) {
        req.flash('error', 'A message with this title already exists for your email');
        return res.redirect('/encode');
    }

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
        title,
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

    try {
        await newEncode.save();
        // Clear OTP after successful encoding
        otpStore.delete(email);
        req.flash('success', 'Message encoded successfully!');
        res.redirect('/encode');
    } catch (err) {
        if (err.code === 11000) {
            req.flash('error', 'A message with this title already exists for your email');
            return res.redirect('/encode');
        }
        throw err;
    }
}));

// decode routes
router.get('/decode', (req, res) => {
    res.render('pages/decode.ejs');
});

// verify-decode route
router.post('/verify-decode', wrapAsync(async (req, res) => {
    const { email, password } = req.body.Decode || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    // find all encodings for this email
    const records = await Encode.find({ email }).sort('-createdAt');
    if (!records.length) {
        return res.status(404).json({ error: 'No encoded messages found for this email' });
    }

    // filter records whose hashed password matches supplied password
    const matched = [];
    await Promise.all(records.map(async (r) => {
        try {
            if (await bcrypt.compare(password, r.password)) matched.push(r);
        } catch (e) {
            // ignore compare errors for this record
        }
    }));

    if (matched.length === 0) {
        return res.status(401).json({ error: 'Invalid password for this email' });
    }

    // generate one OTP and attach to each matched record (store keyed by record id)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const createdAt = Date.now();
    matched.forEach(r => otpStore.set(r._id.toString(), { otp, createdAt }));

    // send OTP to user's email
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'OTP for Message Decryption',
        text: `Your OTP is: ${otp}. Valid for 5 minutes.`
    });

    // return only matched encryptions to client
    const encryptions = matched.map(r => ({
        _id: r._id,
        title: r.title,
        createdAt: r.createdAt
    }));

    res.json({ message: 'OTP sent to your email', encryptions });
}));

// reveal-message route
router.post('/reveal-message', wrapAsync(async (req, res) => {
    const { email, password, otp, encryptionId } = req.body.Decode;

    // Verify OTP using encryptionId instead of email
    const stored = otpStore.get(encryptionId);
    if (!stored || stored.otp !== otp || Date.now() - stored.createdAt > 5 * 60 * 1000) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Get specific stego image
    const record = await Encode.findById(encryptionId);
    if (!record || record.email !== email) {
        return res.status(404).json({ error: 'Record not found' });
    }

    try {
        // Verify password matches this specific record
        const validPassword = await bcrypt.compare(password, record.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        // Download stego image
        const response = await fetch(record.stegoImage.url);
        if (!response.ok) {
            console.error('Failed to download stego image, status:', response.status);
            return res.status(500).json({ error: 'Failed to download stego image' });
        }
        const arrayBuffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        // Extract and decrypt message
        const payload = await extractMessage(imageBuffer);
        const [ivHex, authTagHex, encryptedHex] = payload.split(':');

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const encrypted = Buffer.from(encryptedHex, 'hex');

        const key = crypto.scryptSync(password, 'salt', 32);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        // Clear OTP using encryptionId
        otpStore.delete(encryptionId);

        res.json({ message: decrypted });
    } catch (err) {
        console.error('Decryption error:', err);
        res.status(400).json({ error: 'Failed to decrypt message' });
    }
}));

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

router.post('/extract-message', wrapAsync(async (req, res) => {
    const { recordId, password } = req.body;

    if (!password) {
        return res.json({ success: false, error: 'Password is required to decrypt.' });
    }

    try {
        // Get specific record by ID
        const record = await Encode.findById(recordId);
        if (!record) {
            return res.json({ success: false, error: 'Record not found' });
        }

        // Verify plaintext password against stored bcrypt hash
        const valid = await bcrypt.compare(password, record.password);
        if (!valid) {
            return res.json({ success: false, error: 'Invalid password' });
        }

        // Download stego image
        const response = await fetch(record.stegoImage.url);
        if (!response.ok) {
            return res.json({ success: false, error: 'Failed to download stego image' });
        }
        const arrayBuffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        // Extract encrypted payload from image
        const payload = await extractMessage(imageBuffer);
        const [ivHex, authTagHex, encryptedHex] = payload.split(':');

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const encrypted = Buffer.from(encryptedHex, 'hex');

        // Derive key from the provided plaintext password
        const key = crypto.scryptSync(password, 'salt', 32);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        res.json({ success: true, message: decrypted });
        
    } catch (err) {
        console.error('Extraction error:', err);
        res.json({ success: false, error: 'Failed to extract message' });
    }
}));

router.get('/about', (req, res) => {
    res.render('pages/about.ejs');
});

module.exports = router;