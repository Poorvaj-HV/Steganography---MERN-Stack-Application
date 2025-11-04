// A utility function to wrap async route handlers and pass errors to next()

module.exports = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};