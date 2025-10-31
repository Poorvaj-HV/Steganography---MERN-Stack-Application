const express = require('express');
const app = express();
const path = require('path');
const mongoose = require('mongoose');
const Encode = require('./models/encode.js');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views/pages'));

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
    res.render('home.ejs');
});

app.get('/encode', (req, res) => {
    res.render('encode.ejs');
});

app.get('/decode', (req, res) => {
    res.render('decode.ejs');
});

app.get('/admin', (req, res) => {
    res.render('admin.ejs');
});

app.get('/about', (req, res) => {
    res.render('about.ejs');
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

app.get('/', (req, res) => {
    res.send('Hii Poovi, you are on root page..!!');
});