# 🖼️ StegoHide - Steganography-Based Secure Message Hiding System  
### MERN Stack | Image Steganography (LSB Method)**

This project implements a **secure message-hiding system** using **Image Steganography**, built using the **MERN Stack (MongoDB, Express, Node.js)** and **Cloudinary** for image handling.

The system allows users to securely **hide secret text messages inside images** using the **Least Significant Bit (LSB)** technique and can generate a downloadable **stego image** that visually looks identical to the original. The hidden
message can be extracted only using the correct decoding mechanism.

---

## 🎯 **Project Overview**

This application demonstrates the concept of **digital steganography**, where confidential information is hidden inside a digital medium (image) in a way that prevents detection.

Users can:

- 📝 Encode text inside an image  
- 🖼️ Download the stego image  
- 🔍 Decode hidden messages  
- ☁️ Upload images to cloud storage (Cloudinary)  
- 📊 Manage stored data via Admin Panel  
- 🔐 Hide data instead of just encrypting it  

---

## 🔐 **How Steganography Works (LSB Method)**

The project uses the **Least Significant Bit (LSB)** algorithm:

1. Every image pixel = 3 color channels (R, G, B)  
2. Each channel has 8 bits  
3. The *last bit (LSB)* of each channel is replaced with message bits  
4. Human eyes cannot detect the 1-bit change → image looks the same  
5. Reversing the process extracts the hidden message  

**Capacity Formula:**  
```
Maximum text = (Total Pixels × 3) / 8  characters
```

---

## 🚀 **Tech Stack**

### **Frontend**
- HTML, CSS, JavaScript  
- EJS Templates  
- Bootstrap for Responsive UI and styling, Tailwind CSS(Home Page)

### **Backend**
- Node.js  
- Express.js  
- Custom LSB Algorithm  
- Cloudinary API  

### **Database**
- MongoDB Atlas - Cloud Storage

### **Other Tools**
- Multer  
- Cloudinary Storage  
- Mongoose  

## 📩 OTP Verification using Gmail App Password

This project includes a secure **OTP (One-Time Password) email verification system** powered by **Gmail App Passwords**.

### How It Works
- Backend generates a 6-digit OTP.
- OTP is emailed via Gmail SMTP using Nodemailer.
- OTP auto-expires after a short time.
- User is verified only if OTP matches.

### Why Gmail App Password?
- Normal Gmail passwords are blocked by Google for SMTP.
- App Password enables secure backend email sending.
- Works only when 2FA is enabled.

---

## ⚙️ **Features**

- ✔ Encode Text into Image  
- ✔ Decode Hidden Messages  
- ✔ Cloud Storage Support  
- ✔ Admin Dashboard  
- ✔ Error Handling & Validation  

---

## 📏 **Image Requirements**

| Type | Recommendation |
|------|---------------|
| Minimum Size | 300×300 px |
| Maximum Size | 1920×1080 px |
| Format | PNG, JPG |

---

## 📊 **System Architecture**

```
User → Upload Image → Node.js Server
     → LSB Encoder → Generate Stego Image
     → Cloudinary Upload → MongoDB Save
     → Decode → Extract Message
```

---

## 🧪 **Testing**

- Tested with 50+ sample images  
- Verified pixel-level accuracy  
- 100% decode success rate  

---

## 🔒 **Security Advantages**

- Hidden communication  
- Email based authentication 
- Security for both Encryption and Decryption process.
- Difficult to detect  
- Useful for secure transmission  

---

## 📚 **Use Cases**

- Secure messaging  
- Forensics  
- Authentication  
- Watermarking  

---

## 🛠️ **Future Enhancements**

- AES Encryption for added security  
- ML-based stego/tamper detection model integration as Middleware layer
- React/Next.js front-end  
- Video/audio steganography  

---

## 👨‍💻 **Developed By**

**Poorvaj H V**  
Final Year Computer Science Student