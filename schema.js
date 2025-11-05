// schema for server side validation using Joi -> without this encoding and decoding form fields can be bypassed or submitted using tools like Hopscotch, Postman etc.

const Joi = require('joi');

module.exports.encodeSchema = Joi.object({
    Encode: Joi.object({
        message : Joi.string().required().max(500),
        email: Joi.string().required().email(),
        otp: Joi.string().required().min(6).length(6),
        password: Joi.string().required().min(5).max(20),
    }).required(),
});

module.exports.decodeSchema = Joi.object({
    Decode: Joi.object({
        email: Joi.string().required().email().pattern(/@gmail\.com$/),
        password: Joi.string().required().min(5).max(20),
        emailVerified: Joi.string().valid('true').required(),
    }).required(),
});
