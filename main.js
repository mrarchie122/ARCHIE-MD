process.on("uncaughtException", (err) => {
    console.error("🛑 Caught exception:", err);
});

// Global utility functions
global.getBuffer = async (url, options) => {
    try {
        const fetch = require('node-fetch');
        options ? options : {};
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36'
            },
            ...options
        });
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
        const buffer = await res.buffer();
        return buffer;
    } catch (error) {
        console.error('❌ getBuffer error:', error);
        throw error;
    }
};

// Utility function for JID comparison
function areJidsSameUser(jid1, jid2) {
    if (!jid1 || !jid2) return false;
    const user1 = jid1.split('@')[0] || '';
    const user2 = jid2.split('@')[0] || '';
    return user1 === user2;
}

// Load required modules
require("./settings.js");
require("./source/Webp.js");
require("./source/Mess.js");
require("./source/Function.js");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    downloadContentFromMessage,
    makeInMemoryStore,
    jidDecode,
    Browsers
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const PhoneNumber = require("awesome-phonenumber");
const pathModule = require("path");
const { tmpdir } = require("os");
const Crypto = require("crypto");
const readline = require("readline");
const chalk = require("chalk");
const qrcode = require("qrcode-terminal");
const FileType = require("file-type");
const ConfigBaileys = require("./source/Config.js");
const { imageToWebp, writeExifImg } = require("./source/Webp.js");

// Store initialization
const store = makeInMemoryStore({
    logger: pino().child({ level: "silent", stream: "store" })
});

// Enhanced InputNumber with colors and styling
async function InputNumber(promptText) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    console.log(chalk.cyan("╔══════════════════════════════════╗"));
    console.log(chalk.cyan("║         PHONE NUMBER INPUT       ║"));
    console.log(chalk.cyan("╚══════════════════════════════════╝"));
    
    return new Promise((resolve) => {
        rl.question(chalk.yellow("✨ ") + chalk.white(promptText), (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

global.groupMetadataCache = new Map();

// Database setup
const DataBase = require('./source/Database.js');
const database = new DataBase();

// Enhanced database loading
async function loadDatabase() {
    try {
        const load = await database.read() || {};
        global.db = {
            users: load.users || {},
            groups: load.groups || {},
            settings: load.settings || {}
        };
        await database.write(global.db);
        console.log(chalk.green('✅ Database loaded successfully'));
        return global.db;
    } catch (error) {
        console.error(chalk.red('❌ Database loading error:'), error);
        global.db = { users: {}, groups: {}, settings: {} };
        return global.db;
    }
}

// Clear require cache for skyzopedia.js
function clearSkyzopediaCache() {
    try {
        const modulePath = require.resolve('./skyzopedia.js');
        delete require.cache[modulePath];
        console.log(chalk.blue('🔄 Cleared skyzopedia.js cache'));
    } catch (error) {
        console.log(chalk.yellow('ℹ️  skyzopedia.js not cached yet'));
    }
}

// Main bot function
async function startBot() {
    // Load database first
    await loadDatabase();
    
    const { state, saveCreds } = await useMultiFileAuthState("ARCHIETECH");
    const pairingCode = true;

    const sock = makeWASocket({
        browser: Browsers.ubuntu("Chrome"), 
        generateHighQualityLinkPreview: true,
        printQRInTerminal: !pairingCode,
        auth: state,
        getMessage: async (key) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id);
                return msg.message || undefined;
            }
        },
        logger: pino({ level: "silent" }),
        cachedGroupMetadata: async (jid) => {
            if (!global.groupMetadataCache.has(jid)) {
                const metadata = await sock.groupMetadata(jid).catch(_ => {})
                if (metadata) await global.groupMetadataCache.set(jid, metadata); 
                return metadata;
            }
            return global.groupMetadataCache.get(jid);
        }
    });

    // Enhanced phone number input with styling
    if (pairingCode && !sock.authState.creds.registered) {
        console.log(chalk.magenta("╔══════════════════════════════════╗"));
        console.log(chalk.magenta("║        BOT REGISTRATION         ║"));
        console.log(chalk.magenta("╚══════════════════════════════════╝"));
        
        let phoneNumber = await InputNumber("Enter phone number (Example: 237XXX) : ");
        phoneNumber = phoneNumber.replace(/[^0-9]/g, "");
        
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber, "archiemd");
                console.log(chalk.green("╔══════════════════════════════════╗"));
                console.log(chalk.green("║           PAIRING CODE           ║"));
                console.log(chalk.green("╚══════════════════════════════════╝"));
                console.log(chalk.cyan("🔐 CODE : ") + chalk.yellow(code));
                console.log(chalk.green("✅ Use this code to pair your device"));
            } catch (error) {
                console.log(chalk.red("❌ Failed to get pairing code:"), error);
            }
        }, 4000);
    }

    store?.bind(sock.ev);
    sock.ev.on("creds.update", saveCreds);

    // Connection update handler
    sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
        if (!connection) return;

        if (connection === "connecting" && qr && !pairingCode) {
            console.log(chalk.blue("╔══════════════════════════════════╗"));
            console.log(chalk.blue("║           SCAN QR CODE           ║"));
            console.log(chalk.blue("╚══════════════════════════════════╝"));
            qrcode.generate(qr, { small: true });
        }

        if (connection === "close") {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            console.error(chalk.red("🔴 Connection closed:"), lastDisconnect.error);

            switch (reason) {
                case DisconnectReason.badSession:
                    console.log(chalk.red("❌ Bad Session File, Please Delete Session and Scan Again"));
                    process.exit();
                case DisconnectReason.connectionClosed:
                    console.log(chalk.yellow("🔄 Connection closed, reconnecting..."));
                    return startBot();
                case DisconnectReason.connectionLost:
                    console.log(chalk.yellow("📡 Connection lost, trying to reconnect..."));
                    return startBot();
                case DisconnectReason.connectionReplaced:
                    console.log(chalk.red("🔄 Connection Replaced, Another New Session Opened"));
                    return sock.logout();
                case DisconnectReason.restartRequired:
                    console.log(chalk.yellow("🔄 Restart Required..."));
                    return startBot();
                case DisconnectReason.loggedOut:
                    console.log(chalk.red("🔒 Device Logged Out, Please Scan Again"));
                    return sock.logout();
                case DisconnectReason.timedOut:
                    console.log(chalk.yellow("⏰ Connection TimedOut, Reconnecting..."));
                    return startBot();
                default:
                    console.log(chalk.yellow("🔄 Reconnecting..."));
                    return startBot();
            }
        } else if (connection === "open") {
            console.clear();
            console.log(chalk.green("╔══════════════════════════════════╗"));
            console.log(chalk.green("║     BOT SUCCESSFULLY CONNECTED   ║"));
            console.log(chalk.green("╚══════════════════════════════════╝"));
            console.log(chalk.cyan("🤖 Bot Name:") + chalk.white(" ARCHIE-XMD"));
            console.log(chalk.cyan("👤 User:") + chalk.white(" " + sock.user.name));
            console.log(chalk.cyan("🆔 JID:") + chalk.white(" " + sock.user.id));
            
            // Clear cache and reload skyzopedia.js
            clearSkyzopediaCache();
            
            // Auto join group
            try {
                console.log(chalk.blue("🔄 Auto-joining group..."));
                await sock.groupAcceptInvite("Ki3o3JiELjj98KjQDOG8uZ");
                console.log(chalk.green("✅ Successfully joined group"));
            } catch (error) {
                console.log(chalk.yellow("⚠️  Could not auto-join group:"), error.message);
            }
            
            // Auto follow newsletters
            try {
                console.log(chalk.blue("🔄 Auto-following newsletters..."));
                await sock.newsletterFollow("120363276154401733@newsletter");
                await sock.newsletterFollow("120363200367779016@newsletter");
                console.log(chalk.green("✅ Successfully followed newsletters"));
            } catch (error) {
                console.log(chalk.yellow("⚠️  Could not follow newsletters:"), error.message);
            }
        }
    });

    // Message handler
    sock.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message) return;
            
            const processedMsg = await ConfigBaileys(sock, msg);
            if (!processedMsg) return;
            
            if (!sock.public) {
                const botNumbers = sock.user.id.split(":")[0] + "@s.whatsapp.net";
                if (processedMsg.sender !== botNumbers && processedMsg.sender.split("@")[0] !== global.owner) return;
            }
            
            if (processedMsg.isBaileys) return;
            
            console.log(chalk.blue('📨 Processing message...'));
            
            // Force reload skyzopedia.js every time
            clearSkyzopediaCache();
            const skyzopedia = require("./skyzopedia.js");
            await skyzopedia(processedMsg, sock);
            
        } catch (err) {
            console.log(chalk.red("❌ Error processing message:"), err);
        }
    });

    // Group participants update handler
    sock.ev.on("group-participants.update", async (update) => {
        try {
            const { id, author, participants, action } = update;
            const groupMetadata = await sock.groupMetadata(id);
            global.groupMetadataCache.set(id, groupMetadata);
            const welcome = global.db.settings?.welcome;
            if (!welcome) return;
            
            const groupSubject = groupMetadata.subject;
            const commonMessageSuffix = `\n\n📢 Don't forget to join our group:\n\n${global.linkGrup || 'No group link set'}`;

            for (let participant of participants) {
                let messageText = "";
                const authorName = author ? author.split("@")[0] : "";
                const participantName = participant.split("@")[0];

                switch (action) {
                    case "add":
                        messageText = !author || author === participant
                            ? `@${participantName} Welcome to group ${groupSubject}`
                            : `@${authorName} has *added* @${participantName} to the group.`;
                        break;
                    case "remove":
                        messageText = author === participant
                            ? `@${participantName} has *left* the group.`
                            : `@${authorName} has *removed* @${participantName} from the group.`;
                        break;
                    case "promote":
                        messageText = `@${authorName} has *promoted* @${participantName} to *admin*.`;
                        break;
                    case "demote":
                        messageText = `@${authorName} has *demoted* @${participantName} from *admin*.`;
                        break;
                    default:
                        continue;
                }

                messageText += commonMessageSuffix;

                await sock.sendMessage(id, {
                    text: messageText,
                    mentions: [author, participant].filter(Boolean),
                }, { quoted: null });
            }
        } catch (error) {
            console.log(chalk.red('❌ Error sending group update message:'), error);
        }
    });

    sock.public = global.mode_public || false;

    // Decode JID function
    sock.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            const decode = jidDecode(jid) || {};
            return decode.user && decode.server ? `${decode.user}@${decode.server}` : jid;
        }
        return jid;
    };

    // Download and save media message
    sock.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
        const quoted = message.msg ? message.msg : message;
        const mime = (message.msg || message).mimetype || "";
        const messageType = message.mtype ? message.mtype.replace(/Message/gi, "") : mime.split("/")[0];
        const Randoms = Date.now();
        const fil = Randoms;

        const stream = await downloadContentFromMessage(quoted, messageType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const type = await FileType.fromBuffer(buffer);
        const trueFileName = attachExtension ? `./Tmp/${fil}.${type.ext}` : filename;
        
        // Ensure Tmp directory exists
        if (!fs.existsSync('./Tmp')) {
            fs.mkdirSync('./Tmp', { recursive: true });
        }
        
        fs.writeFileSync(trueFileName, buffer);
        return trueFileName;
    };

    // Send sticker function
    sock.sendStimg = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path)
            ? path
            : /^data:.*?\/.*?;base64,/i.test(path)
            ? Buffer.from(path.split(",")[1], "base64")
            : /^https?:\/\//.test(path)
            ? await getBuffer(path)
            : fs.existsSync(path)
            ? fs.readFileSync(path)
            : Buffer.alloc(0);

        const buffer = (options.packname || options.author)
            ? await writeExifImg(buff, options)
            : await imageToWebp(buff);

        const tmpPath = pathModule.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
        fs.writeFileSync(tmpPath, buffer);

        await sock.sendMessage(jid, { sticker: { url: tmpPath }, ...options }, { quoted });
        fs.unlinkSync(tmpPath);

        return buffer;
    };

    // Download media message
    sock.downloadMediaMessage = async (m, type, filename = "") => {
        if (!m || !(m.url || m.directPath)) return Buffer.alloc(0);
        const stream = await downloadContentFromMessage(m, type);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        if (filename) {
            const dir = pathModule.dirname(filename);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            await fs.promises.writeFile(filename, buffer);
        }
        return filename && fs.existsSync(filename) ? filename : buffer;
    };

    // Send contact function
    sock.sendContact = async (jid, kon = [], name, desk = "Bot Developer", quoted = '', opts = {}) => {
        const list = kon.map(i => ({
            displayName: typeof name !== 'undefined' ? name : 'Unknown',
            vcard:
                'BEGIN:VCARD\n' +
                'VERSION:3.0\n' +
                `N:;${name || 'Unknown'};;;\n` +
                `FN:${name || 'Unknown'}\n` +
                'ORG:Unknown\n' +
                'TITLE:\n' +
                `item1.TEL;waid=${i}:+${i}\n` +
                'item1.X-ABLabel:Phone\n' +
                `X-WA-BIZ-DESCRIPTION:${desk}\n` +
                `X-WA-BIZ-NAME:${name || 'Unknown'}\n` +
                'END:VCARD'
        }));

        await sock.sendMessage(
            jid,
            { contacts: { displayName: `${list.length} Contacts`, contacts: list }, ...opts },
            { quoted }
        );
    };

    // Get name function
    sock.getName = async (jid = "", withoutContact = false) => {
        try {
            jid = sock.decodeJid(jid || "");
            withoutContact = sock.withoutContact || withoutContact;

            if (jid.endsWith("@g.us")) {
                try {
                    let v = sock.chats[jid] || {};
                    if (!(v.name || v.subject)) {
                        v = await sock.groupMetadata(jid).catch(() => ({}));
                    }
                    return v.name || v.subject || "Unknown Group";
                } catch {
                    return "Unknown Group";
                }
            } else {
                const v = jid === "0@s.whatsapp.net"
                    ? { jid, vname: "WhatsApp" }
                    : areJidsSameUser(jid, sock.user.id)
                    ? sock.user
                    : sock.chats[jid] || {};

                const safeJid = typeof jid === "string" ? jid : "";
                return (
                    (withoutContact ? "" : v.name) ||
                    v.subject ||
                    v.vname ||
                    v.notify ||
                    v.verifiedName ||
                    (safeJid
                        ? PhoneNumber("+" + safeJid.replace("@s.whatsapp.net", "")).getNumber("international").replace(/[()+-/\s]/g, "")
                        : "Unknown Contact")
                );
            }
        } catch {
            return "Error occurred";
        }
    };
}

// Start the bot
console.log(chalk.cyan("╔══════════════════════════════════╗"));
console.log(chalk.cyan("║        STARTING ARCHIE-XMD       ║"));
console.log(chalk.cyan("║            🤖 BOT 🤖            ║"));
console.log(chalk.cyan("╚══════════════════════════════════╝"));
startBot();

// Database auto-save (silent)
setInterval(async () => {
    if (global.db) {
        await database.write(global.db);
    }
}, 3500);