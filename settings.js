/* 
 * ARCHIETECH WhatsApp Bot Configuration
 * Optimized & Fused Configuration
 * No Enc ? Buy Ke Tele > https://t.me/lopez629
 */

const chalk = require("chalk");
const fs = require("fs");

// ==================== OWNER & BOT SETTINGS ====================
global.owner = "237695717815" // Primary owner
global.backupOwner = "254746559167" // Backup owner
global.namaOwner = "ARCHIETECH"
global.mode_public = true

// ==================== SOCIAL & LINKS ====================
global.linkChannel = "https://whatsapp.com/channel/0029VaYpDLx4tRrrrXsOvZ3U"
global.idChannel = "120363276154401733@newsletter"
global.linkGrup = ""
global.thumbnail = "https://files.catbox.moe/57xv3g.jpg"

// ==================== PERFORMANCE SETTINGS ====================
global.contactPushDelay = 5000
global.messageDelay = 5000

// ==================== UTILITY FUNCTIONS ====================
global.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

global.runtime = function(seconds) {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor(seconds % (3600 * 24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);
    var dDisplay = d > 0 ? d + "d " : "";
    var hDisplay = h > 0 ? h + "h " : "";
    var mDisplay = m > 0 ? m + "m " : "";
    var sDisplay = s > 0 ? s + "s " : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
}

// ==================== CONFIGURATION VALIDATION ====================
function validateConfig() {
    const required = ['owner', 'namaOwner', 'thumbnail'];
    const missing = required.filter(key => !global[key]);
    
    if (missing.length > 0) {
        console.log(chalk.red('❌ Missing required configurations:'), missing.join(', '));
        return false;
    }
    
    console.log(chalk.green('✅ All configurations validated successfully'));
    console.log(chalk.blue('🤖 Bot Owner:'), global.namaOwner);
    console.log(chalk.blue('📞 Owner Number:'), global.owner);
    return true;
}

// ==================== HOT RELOAD CONFIGURATION ====================
let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log(chalk.blue("🔄 Config File Updated:"), chalk.black.bgWhite(`${__filename}`));
    delete require.cache[file];
    require(file);
});

// ==================== INITIALIZATION ====================
console.log(chalk.green('🚀 ARCHIETECH WhatsApp Bot Configuration Loaded'));
console.log(chalk.yellow('📁 Config file:'), __filename);
validateConfig();

module.exports = {
    validateConfig,
    getOwnerInfo: () => ({
        owner: global.owner,
        namaOwner: global.namaOwner,
        backupOwner: global.backupOwner
    })
};