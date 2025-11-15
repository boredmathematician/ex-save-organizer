# Save Organizer

A web application for managing save files for Exponential Idle. Users can securely store, organize, and retrieve their game saves with client-side encryption.

## Features

- 🔐 **Client-side Encryption**: Save data is encrypted using AES-GCM before being stored in Firebase
- 🔑 **Google Authentication**: Easy sign-in with Google accounts
- 💾 **Save Management**: Store multiple game saves with metadata (f(t), μ, ψ, σ, etc.)
- 📋 **Copy to Clipboard**: One-click copy of save strings
- 🗑️ **Delete Saves**: Remove unwanted saves with confirmation
- 🌐 **Cross-device Access**: Access your saves from any browser (same Google account)

## Live Demo

🌐 **[https://ex-save-organizer.web.app/](https://ex-save-organizer.web.app/)**

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Styling**: W3.CSS, Font Awesome
- **Backend**: Firebase (Authentication, Realtime Database, Hosting)
- **Encryption**: Web Crypto API (AES-GCM)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- Firebase CLI: `npm install -g firebase-tools`

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/save-organizer.git
   cd save-organizer
   ```

2. **Set up Firebase**
   
   Create a new Firebase project at [console.firebase.google.com](https://console.firebase.google.com):
   - Enable Google Authentication
   - Create a Realtime Database
   - Deploy the database rules from `database.rules.json`

3. **Update Firebase Config**
   
   Edit `public/index.js` and replace the Firebase config with your project's credentials:
   ```javascript
   const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_PROJECT.firebaseapp.com",
       databaseURL: "https://YOUR_PROJECT.firebaseio.com",
       projectId: "YOUR_PROJECT",
       storageBucket: "YOUR_PROJECT.appspot.com",
       messagingSenderId: "YOUR_MESSAGING_ID",
       appId: "YOUR_APP_ID"
   };
   ```

4. **Update `.firebaserc`**
   
   Replace the project ID with yours:
   ```json
   {
     "projects": {
       "default": "YOUR_PROJECT_ID"
     }
   }
   ```

5. **Test locally**
   ```bash
   firebase login
   firebase serve
   ```
   
   Open http://localhost:5000 in your browser

### Deployment

```bash
firebase deploy
```

Your app will be live at `https://YOUR_PROJECT.web.app/`

## How It Works

### Authentication

1. User clicks "Login with Google"
2. Firebase Auth handles Google OAuth
3. User is authenticated and receives a unique Firebase UID

### Encryption

1. **Key Derivation**: Google Provider UID → SHA-256 hash → AES-256 key
2. **IV Generation**: 12-byte random initialization vector (generated once per user)
3. **Encryption**: User's save data → JSON → AES-GCM encryption → Hex string
4. **Storage**: Encrypted data stored in Firebase Realtime Database

### Data Structure

```
users/
  └── {firebase_uid}/
      ├── iv: [12-byte array]           # Initialization vector
      └── data: "9f8e7d6c5b4a..."       # Encrypted save data (hex)
```

### Security

- Data is encrypted client-side before being sent to Firebase
- Encryption key is derived from Google Provider UID (not stored in database)
- Firebase security rules ensure users can only access their own data
- **Note**: This is not zero-knowledge encryption - the Firebase admin can decrypt data if needed

## Database Security Rules

Users can only read/write their own data:

```json
{
  "rules": {
    "$uid": {
      ".read": "auth != null && auth.uid == $uid",
      ".write": "auth != null && auth.uid == $uid"
    }
  }
}
```

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

MIT License - feel free to use and modify!

## Credits

Created for the Exponential Idle community 🎮
