/* > Recode script give credits to›
ARCHIETECH

📝 | Created By ARCHIETECH
🖥️ | Base Ori By ARCHIETECH
📝 | Created By ARCHIETECH
📌 |Credits ARCHIETECH
📱 |Chat wa:237695727815
👑 |Github: ARCHIE-TECH
✉️ |Email: archietech@gmail.com

*/


async function LoadDataBase(conn, m) {
  try {
    const botNumber = await conn.decodeJid(conn.user.id);

    if (typeof global.db.users !== 'object') global.db.users = {};
    if (typeof global.db.groups !== 'object') global.db.groups = {};
    if (typeof global.db.settings !== 'object') global.db.settings = {};

    const defaultSettings = { welcome: false, developer: [], reseller: [], bljpm: [], respon: [] };
    for (let key in defaultSettings) {
      if (!(key in global.db.settings)) global.db.settings[key] = defaultSettings[key];
    }

    if (typeof global.db.users[m.sender] !== 'object') global.db.users[m.sender] = {};
    const defaultUser = {};
    for (let key in defaultUser) {
      if (!(key in global.db.users[m.sender])) global.db.users[m.sender][key] = defaultUser[key];
    }

    if (m.isGroup) {
      if (typeof global.db.groups[m.chat] !== 'object') global.db.groups[m.chat] = {};
      const defaultGroup = { antilink: false, antilink2: false };
      for (let key in defaultGroup) {
        if (!(key in global.db.groups[m.chat])) global.db.groups[m.chat][key] = defaultGroup[key];
      }
    }
  } catch (e) {
    throw e;
  }
}

module.exports = LoadDataBase;