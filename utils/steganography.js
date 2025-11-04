const sharp = require('sharp');

async function hideMessage(imageBuffer, message) {
    const messageWithDelimiter = message + '\0';
    const messageBits = Buffer.from(messageWithDelimiter, 'utf8')
        .toString('binary')
        .split('')
        .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
        .join('');
    
    const { data, info } = await sharp(imageBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true });
    
    const pixels = new Uint8Array(data);
    
    for (let i = 0; i < messageBits.length && i < pixels.length; i++) {
        pixels[i] = (pixels[i] & 0xFE) | parseInt(messageBits[i]);
    }
    
    return await sharp(pixels, {
        raw: {
            width: info.width,
            height: info.height,
            channels: info.channels
        }
    }).png().toBuffer();
}

async function extractMessage(imageBuffer) {
    const { data } = await sharp(imageBuffer).raw().toBuffer({ resolveWithObject: true });
    const pixels = new Uint8Array(data);
    
    let messageBits = '';
    let message = '';
    
    for (let i = 0; i < pixels.length; i++) {
        messageBits += (pixels[i] & 1).toString();
        
        if (messageBits.length === 8) {
            const char = String.fromCharCode(parseInt(messageBits, 2));
            if (char === '\0') break;
            message += char;
            messageBits = '';
        }
    }
    
    return message;
}

module.exports = { hideMessage, extractMessage };