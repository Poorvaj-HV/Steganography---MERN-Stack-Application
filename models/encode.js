const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const encodeSchema = new Schema({
    email: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    }
});

const Encode = mongoose.model('Encode', encodeSchema);
module.exports = Encode;