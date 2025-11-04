const express = require('express');
const app = express();
const path = require('path');
const mongoose = require('mongoose');
// const Encode = require('./models/encode.js');  // removed as not used directly here
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');
// const wrapAsync = require('./utils/wrapAsync.js'); -- removed as not used directly here
const ExpressError = require('./utils/ExpressError.js');
// const { encodeSchema } = require('./schema.js'); removed as not used directly here

const pagesRoutes = require('./routes/pages.js');

// const multer = require('multer');
// const sharp = require('sharp');
// remainder - apply wrapAsync where needed in routes that use async functions **** and use encodeSchema for validation in post routes

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

app.use('/', pagesRoutes);    // use the routes defined in routes/pages.js


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

// app.get('/testencode', async(req, res) => {
//     let sampleData = new Encode({
//         email: "poovi@gmail.com",
//         image: "sampleImage.jpg"
//     });

//     await sampleData.save();
//     console.log("Sample data saved to database");
//     res.send("Test encode data saved to database");
// });

app.listen(8000, () => {
    console.log('Server is running on port 8000');
});

app.use((req, res, next) => {
    next(new ExpressError(404, 'Page Not Found..!!'));
});

app.use((err, req, res, next) => {
    let { statusCode=500, message="Something went wrong..!!" } = err;
    res.status(statusCode).render('error.ejs', { message });
    // res.status(statusCode).send(message);
});

app.get('/', (req, res) => {
    res.send('Hii Poovi, you are on root page..!!');
});