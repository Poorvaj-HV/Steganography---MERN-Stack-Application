const express = require('express');
const app = express();
const path = require('path');
const mongoose = require('mongoose');
const Encode = require('./models/encode.js');
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');
const wrapAsync = require('./utils/wrapAsync.js');
const ExpressError = require('./utils/ExpressError.js');
// const multer = require('multer');
// const sharp = require('sharp');
// remainder - apply wrapAsync where needed in routes that use async functions ****

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

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

const MONGO_URL = "mongodb://127.0.0.1:27017/steganoDB";

main()
  .then(() => {
    console.log("Connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
    await mongoose.connect(MONGO_URL);
}

app.get('/home', (req, res) => {
    res.render('pages/home.ejs');
});

app.get('/encode', (req, res) => {
    res.render('pages/encode.ejs');
});

// app.post('/encode', wrapAsync, upload.single('image'), async(req, res, next) => {
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

app.get('/decode', (req, res) => {
    res.render('pages/decode.ejs');
});

app.get('/decode/:id', (req, res) => {
    let { id } = req.params;
    const eData = Encode.findById(id);
    console.log(eData);
});

app.get('/admin', (req, res) => {
    res.render('pages/admin.ejs');
});

app.get('/listings', async(req, res) => {
    const allData = await Encode.find({});
    res.render('pages/listing.ejs', { allData });
});

app.get('/about', (req, res) => {
    res.render('pages/about.ejs');
});

app.get('/testencode', async(req, res) => {
    let sampleData = new Encode({
        email: "poovi@gmail.com",
        image: "sampleImage.jpg"
    });

    await sampleData.save();
    console.log("Sample data saved to database");
    res.send("Test encode data saved to database");
});

app.listen(8000, () => {
    console.log('Server is running on port 8000');
});

app.use((req, res, next) => {
    next(new ExpressError(404, 'Page Not Found'));
});

app.use((err, req, res, next) => {
    let { statusCode=500, message="Something went wrong..!!" } = err;
    res.status(statusCode).send(message);
});

app.get('/', (req, res) => {
    res.send('Hii Poovi, you are on root page..!!');
});