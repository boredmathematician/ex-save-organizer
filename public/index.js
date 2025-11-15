// Global state
let provider;
let db;
let app;

let _name;
let _uid;
let _key;
let hashedKey;

let iv;
let saves;

// Initialize Firebase on DOM load
document.addEventListener('DOMContentLoaded', function () {
    const firebaseConfig = {
        apiKey: "AIzaSyA-ueHwRHMOIrcGjaiQd3a4A2zByxBDFwE",
        authDomain: "ex-save-organizer.firebaseapp.com",
        databaseURL: "https://ex-save-organizer-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "ex-save-organizer",
        storageBucket: "ex-save-organizer.appspot.com",
        messagingSenderId: "727173770401",
        appId: "1:727173770401:web:e6a1ef784bdbd7c55614e0",
        measurementId: "G-YBW4YXX0Y7"
    };
    app = firebase.initializeApp(firebaseConfig);
    provider = new firebase.auth.GoogleAuthProvider();
    db = firebase.database();
});

// ============================================================================
// AUTH FUNCTIONS
// ============================================================================

function googleLogin() {
    document.getElementById("login").setAttribute("class", "hide");
    document.getElementById("loader").style = "";
    
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            return firebase.auth().signInWithPopup(provider);
        })
        .then(result => {
            const user = result.user;
            _name = user.displayName;
            _uid = user.uid;
            _key = user.providerData.find(x => x.providerId === "google.com").uid;
            init();
        })
        .catch(error => {
            console.error("Login error:", error);
            document.getElementById("login").setAttribute("class", "show");
            document.getElementById("loader").style = "display: none;";
        });
}

function logout() {
    _name = undefined;
    _uid = undefined;
    _key = undefined;
    hashedKey = undefined;
    iv = undefined;
    saves = undefined;
    
    firebase.auth().signOut();
    showContent();
}

// ============================================================================
// DATABASE FUNCTIONS (REFACTORED - NO MORE JANK!)
// ============================================================================

function insertIntoDB(key, value, encrypt) {
    if (!encrypt) {
        return db.ref(_uid + "/" + key).set(value);
    } else {
        const hashArray = Array.from(new Uint8Array(value));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return db.ref(_uid + "/" + key).set(hashHex);
    }
}

// REFACTORED: Proper Promise-based Firebase read with hashed key
async function fetchFromDBWithHashedKey(key) {
    const hashedKeyValue = await digestMessage(_key);
    const snapshot = await db.ref(hashedKeyValue + "/" + key).once('value');
    return snapshot.val();
}

// REFACTORED: Proper Promise-based Firebase read with UID
async function fetchFromDBWithUID(key) {
    const snapshot = await db.ref(_uid + "/" + key).once('value');
    return snapshot.val();
}

// ============================================================================
// SAVE MANAGEMENT
// ============================================================================

async function newSave() {
    const name = document.getElementById("name").value;
    
    if (!name) {
        alert("Please enter a name for the save");
        return;
    }
    
    let text = "Save added.";
    
    if (saves.hasOwnProperty(name)) {
        text = "Save updated";
    }
    
    saves[name] = {
        ft: document.getElementById("ft").value,
        lft: document.getElementById("lft").value,
        mu: document.getElementById("mu").value,
        psi: document.getElementById("psi").value,
        sigma: document.getElementById("sigma").value,
        export: document.getElementById("export").value
    };

    // Clear input fields
    const inputs = ["name", "ft", "lft", "mu", "psi", "sigma", "export"];
    for (const input of inputs) {
        document.getElementById(input).value = "";
    }
    
    // Encrypt and save
    const cipherText = await encryptData(_key, saves, iv);
    await insertIntoDB("data", cipherText, true);
    
    popUp(text);
    showContent();
}

function popUp(text) {
    document.getElementById("save-text").innerHTML = text;
    document.getElementById("saved").classList.add("show");
    setTimeout(() => {
        document.getElementById("saved").classList.remove("show");
    }, 1000);
}

function copy(data) {
    navigator.clipboard.writeText(data);
    popUp("Save copied.");
}

async function removeRow(saveName) {
    const save = saves[saveName];

    if (confirm(
        "Are you sure you want to delete `" + saveName + "`? It has the following values:\r\n" +
        "f(t) = " + save.ft + "\r\n" +
        "Lifetime f(t) = " + save.lft + "\r\n" +
        "\u03BC = " + save.mu + "\r\n" +
        "\u03C8 = " + save.psi + "\r\n" +
        "\u03C3 = " + save.sigma + "\r\n" +
        "Note that this action CANNOT BE UNDONE!"
    )) {
        delete saves[saveName];
        const ciphertext = await encryptData(_key, saves, iv);
        await insertIntoDB("data", ciphertext, true);
        showContent();
    }
}

// ============================================================================
// INITIALIZATION (REFACTORED - NO MORE POLLING LOOPS!)
// ============================================================================

async function init() {
    if (_uid) {
        try {
            hashedKey = await digestMessage(_key);

            // Load or generate IV
            iv = await fetchFromDBWithUID("iv");
            if (!iv) {
                iv = await fetchFromDBWithHashedKey("iv");
                if (iv) {
                    await insertIntoDB("iv", iv, false);
                    await insertIntoDB("migrated-from", hashedKey, false);
                } else {
                    iv = Array.from(window.crypto.getRandomValues(new Uint8Array(12)));
                    await insertIntoDB("iv", iv, false);
                }
            }

            // Load encrypted save data
            let saveHex = await fetchFromDBWithUID("data");
            
            if (!saveHex) {
                // Try to migrate from old hashed key location
                saveHex = await fetchFromDBWithHashedKey("saves");
                if (saveHex) {
                    await insertIntoDB("data", saveHex, false);
                } else {
                    // Try to migrate from very old unencrypted format
                    const oldSaves = await fetchFromDBWithUID("saves");
                    if (oldSaves) {
                        saves = {};
                        for (let saveName of oldSaves) {
                            const oldSave = await fetchFromDBWithUID(saveName);
                            saves[oldSave[0]] = {
                                ft: oldSave[1],
                                lft: oldSave[2],
                                mu: oldSave[3],
                                psi: oldSave[4],
                                sigma: oldSave[5],
                                export: oldSave[6]
                            };
                            await insertIntoDB(oldSave[0], null, false); // Delete old save
                        }
                        const ciphertext = await encryptData(_key, saves, iv);
                        await insertIntoDB("data", ciphertext, true);
                        await insertIntoDB("saves", null, false); // Delete old saves list
                    }
                }
            }

            // Decrypt saves if we have encrypted data
            if (!saves) {
                if (!saveHex) {
                    saves = {};
                } else {
                    const bytes = hexToBytes(saveHex);
                    const decrypted = await decryptData(_key, bytes, iv);
                    saves = JSON.parse(decrypted);
                }
            }
        } catch (error) {
            console.error("Initialization error:", error);
            saves = {}; // Fallback to empty saves on error
        }
    }

    showContent();
}

// ============================================================================
// UI FUNCTIONS
// ============================================================================

function openTab(evt, tabName) {
    // Hide all tabs
    const tabs = document.getElementsByClassName("tabs");
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].style.display = "none";
    }
    
    // Remove active class from all tab buttons
    const tablinks = document.getElementsByClassName("tablink");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" w3-gray", "");
    }
    
    // Show selected tab and mark button as active
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " w3-gray";
}

function showContent() {
    if (!_uid) {
        // Not logged in
        document.getElementById("login").setAttribute("class", "show");
        document.getElementById("content").setAttribute("class", "hide");
        document.getElementById("loggedin").setAttribute("class", "text-color text-bold hide");
    } else {
        // Logged in
        document.getElementById("loader").style = "display: none;";
        document.getElementById("login").setAttribute("class", "hide");
        document.getElementById("content").setAttribute("class", "show");
        
        const userDetails = document.getElementById("loggedin");
        userDetails.setAttribute("class", "text-color text-bold show");
        userDetails.innerHTML = "Logged in as " + _name + " (<span class=\"logout\" onclick=\"logout()\"><u> Log out. </u></span>)";

        // Populate saves table
        const table = document.getElementById("existing-saves");
        const rowCount = table.rows.length;
        
        // Delete all rows except header
        for (let i = 1; i < rowCount; i++) {
            table.deleteRow(1);
        }

        // Add save rows
        let rowIndex = 1;
        Object.entries(saves).forEach(([name, save]) => {
            const row = table.insertRow(rowIndex);

            row.insertCell(0).innerHTML = name;
            row.insertCell(1).innerHTML = save.ft;
            row.insertCell(2).innerHTML = save.lft;
            row.insertCell(3).innerHTML = save.mu;
            row.insertCell(4).innerHTML = save.psi;
            row.insertCell(5).innerHTML = save.sigma;

            // Copy button
            let cell = row.insertCell(6);
            let span = document.createElement("span");
            span.className = "fa fa-copy";
            span.style.cursor = "pointer";
            span.onclick = function () { copy(save.export); };
            cell.appendChild(span);

            // Delete button
            cell = row.insertCell(7);
            span = document.createElement("span");
            span.className = "fa fa-trash";
            span.style.cursor = "pointer";
            span.onclick = function () { removeRow(name); };
            cell.appendChild(span);
            
            rowIndex++;
        });
    }
}

// ============================================================================
// CRYPTO FUNCTIONS
// ============================================================================

async function digestMessage(message) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-384', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

async function encryptData(key, value, iv) {
    const valueJSON = JSON.stringify(value);
    const msgUint8 = new TextEncoder().encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);

    const aesKey = await window.crypto.subtle.importKey(
        "raw",
        hashBuffer,
        "AES-GCM",
        true,
        ["encrypt", "decrypt"]
    );

    const enc = new TextEncoder();
    const msg = enc.encode(valueJSON);

    const ciphertext = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: Uint8Array.from(iv)
        },
        aesKey,
        msg
    );

    return ciphertext;
}

async function decryptData(key, ciphertext, iv) {
    const msgUint8 = new TextEncoder().encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);

    const aesKey = await window.crypto.subtle.importKey(
        "raw",
        hashBuffer,
        "AES-GCM",
        true,
        ["encrypt", "decrypt"]
    );

    const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: Uint8Array.from(iv)
        },
        aesKey,
        ciphertext
    );

    const dec = new TextDecoder();
    const plaintext = dec.decode(decryptedBuffer);
    return plaintext;
}

function hexToBytes(hex) {
    const bytes = [];
    for (let c = 0; c < hex.length; c += 2) {
        bytes.push(parseInt(hex.substr(c, 2), 16));
    }
    return Uint8Array.from(bytes).buffer;
}