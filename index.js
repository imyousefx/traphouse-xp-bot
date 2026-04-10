const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel]
});

const TOKEN = "YOUR_BOT_TOKEN";

// ====== DATABASE (JSON) ======
let data = {};

if (fs.existsSync('./data.json')) {
    data = JSON.parse(fs.readFileSync('./data.json'));
}

function saveData() {
    fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
}

// ====== XP SYSTEM ======

function xpNeeded(level) {
    return 4 * (level ** 2) + 40 * level + 120;
}

function applyBoost(member, xp) {
    if (member.roles.cache.has("HUSTLER_ID")) xp *= 1.1;
    if (member.roles.cache.has("GRINDER_ID")) xp *= 1.15;
    if (member.roles.cache.has("TRAPSTAR_ID")) xp *= 1.25;

    return Math.floor(xp);
}

function addXP(member, amount) {
    const id = member.id;

    if (!data[id]) {
        data[id] = { xp: 0, level: 0 };
    }

    data[id].xp += amount;

    let needed = xpNeeded(data[id].level);

    let leveledUp = false;

    while (data[id].xp >= needed) {
        data[id].xp -= needed;
        data[id].level++;
        leveledUp = true;

        needed = xpNeeded(data[id].level);
    }

    if (leveledUp) {
        updateUserRole(member, data[id].level);
    }

    saveData();
}

// ====== ROLES ======

const levelRoles = {
    1: "1491539811838722059",
    4: "1491539858584244244",
    7: "1491539900313636936",
    10: "1491539932546732164",
    14: "1491539963337244752",
    18: "1491539598449574030",
    22: "1491539563938844672",
    27: "1491539522247463072",
    32: "1491539446678552768",
    40: "1491539401854025798"
};

const allRanks = Object.values(levelRoles);

async function updateUserRole(member, level) {
    let newRoleId = null;

    for (const lvl in levelRoles) {
        if (level >= lvl) {
            newRoleId = levelRoles[lvl];
        }
    }

    if (!newRoleId) return;

    const newRole = member.guild.roles.cache.get(newRoleId);
    if (!newRole) return;

    const rolesToRemove = member.roles.cache.filter(r => allRanks.includes(r.id));

    await member.roles.remove(rolesToRemove);
    await member.roles.add(newRole);
}

// ====== TEXT XP ======

const cooldown = new Set();

client.on('messageCreate', message => {
    if (message.author.bot) return;

    const member = message.member;
    const userId = message.author.id;

    if (cooldown.has(userId)) return;

    cooldown.add(userId);
    setTimeout(() => cooldown.delete(userId), 20000);

    let xp = Math.floor(Math.random() * 8) + 12;

    xp = applyBoost(member, xp);

    addXP(member, xp);
});

// ====== VOICE XP ======

setInterval(() => {
    client.guilds.cache.forEach(guild => {
        guild.channels.cache.forEach(channel => {
            if (!channel.isVoiceBased()) return;

            channel.members.forEach(member => {
                if (
                    channel.members.size > 1 &&
                    !member.voice.selfMute &&
                    !member.voice.selfDeaf &&
                    !member.voice.serverMute &&
                    !member.voice.serverDeaf
                ) {
                    let xp = Math.floor(Math.random() * 5) + 6;

                    if (channel.members.size >= 3) xp += 3;

                    xp = applyBoost(member, xp);

                    addXP(member, xp);
                }
            });
        });
    });
}, 60000);

// ====== COMMANDS ======

client.on('messageCreate', message => {
    if (message.content === "!rank") {
        const user = data[message.author.id];

        if (!user) {
            return message.reply("ما عندك XP بعد!");
        }

        message.reply(`📊 Level: ${user.level}\nXP: ${user.xp}/${xpNeeded(user.level)}`);
    }

    if (message.content === "!top") {
        const sorted = Object.entries(data)
            .sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp)
            .slice(0, 10);

        let msg = "🏆 Top 10:\n";

        sorted.forEach((user, i) => {
            msg += `${i + 1}. <@${user[0]}> - Level ${user[1].level}\n`;
        });

        message.reply(msg);
    }
});

client.login(TOKEN);