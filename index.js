const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    REST, 
    Routes, 
    SlashCommandBuilder 
} = require('discord.js');

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

// ===== ENV =====
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// 🔍 Debug
console.log("TOKEN:", TOKEN ? "OK" : "MISSING");
console.log("CLIENT_ID:", CLIENT_ID);

// ===== DATABASE =====
let data = {};

if (fs.existsSync('./data.json')) {
    data = JSON.parse(fs.readFileSync('./data.json'));
}

function save() {
    fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
}

function ensureUser(id) {
    if (!data[id]) {
        data[id] = { xp: 0, level: 0 };
    }
}

// ===== XP =====

function xpNeeded(level) {
    return 4 * (level ** 2) + 40 * level + 120;
}

function addXP(member, amount) {
    const id = member.id;
    ensureUser(id);

    data[id].xp += amount;

    let needed = xpNeeded(data[id].level);

    while (data[id].xp >= needed) {
        data[id].xp -= needed;
        data[id].level++;

        updateUserRole(member, data[id].level);

        needed = xpNeeded(data[id].level);
    }

    save();
}

// ===== ROLES (جاهزة 🔥) =====

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

async function updateUserRole(member, level) {
    const sorted = Object.keys(levelRoles).map(Number).sort((a,b)=>a-b);

    let roleId = null;

    for (const lvl of sorted) {
        if (level >= lvl) roleId = levelRoles[lvl];
    }

    if (!roleId) return;

    const newRole = member.guild.roles.cache.get(roleId);
    if (!newRole) return;

    const allRoles = Object.values(levelRoles);
    const toRemove = member.roles.cache.filter(r => allRoles.includes(r.id));

    await member.roles.remove(toRemove);
    await member.roles.add(newRole);
}

// ===== TEXT XP =====

const cooldown = new Set();

client.on('messageCreate', msg => {
    if (msg.author.bot) return;

    if (cooldown.has(msg.author.id)) return;

    cooldown.add(msg.author.id);
    setTimeout(() => cooldown.delete(msg.author.id), 20000);

    let xp = Math.floor(Math.random() * 8) + 12;

    addXP(msg.member, xp);
});

// ===== VOICE SYSTEM (🔥 مضمون) =====

const voiceUsers = new Map();

client.on('voiceStateUpdate', (oldState, newState) => {
    const member = newState.member;
    if (!member || member.user.bot) return;

    if (!oldState.channel && newState.channel) {
        voiceUsers.set(member.id, newState.channel.id);
    }

    if (oldState.channel && !newState.channel) {
        voiceUsers.delete(member.id);
    }

    if (oldState.channel && newState.channel) {
        voiceUsers.set(member.id, newState.channel.id);
    }
});

setInterval(() => {
    voiceUsers.forEach((channelId, userId) => {

        const guild = client.guilds.cache.first();
        if (!guild) return;

        const member = guild.members.cache.get(userId);
        const channel = guild.channels.cache.get(channelId);

        if (!member || !channel) return;

        if (channel.members.size <= 1) return;

        if (
            member.voice.selfMute ||
            member.voice.selfDeaf ||
            member.voice.serverMute ||
            member.voice.serverDeaf
        ) return;

        let xp = Math.floor(Math.random() * 5) + 6;

        if (channel.members.size >= 3) xp += 3;

        console.log(`VOICE XP ✔ ${member.user.username} +${xp}`);

        addXP(member, xp);

    });
}, 60000);

// ===== SLASH COMMANDS =====

const commands = [
    new SlashCommandBuilder().setName("rank").setDescription("Rank"),
    new SlashCommandBuilder().setName("top").setDescription("Top players")
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    if (!TOKEN || !CLIENT_ID) {
        console.log("❌ ENV ERROR");
        return;
    }

    await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
    );

    console.log("✅ Commands Registered");
})();

// ===== INTERACTIONS =====

client.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;

    ensureUser(i.user.id);

    if (i.commandName === "rank") {
        const user = data[i.user.id];
        return i.reply(`📊 Level: ${user.level}\nXP: ${user.xp}/${xpNeeded(user.level)}`);
    }

    if (i.commandName === "top") {
        const sorted = Object.entries(data)
            .sort((a,b)=>b[1].level - a[1].level || b[1].xp - a[1].xp)
            .slice(0,10);

        let msg = "🏆 Top Players:\n";

        sorted.forEach((u,i)=>{
            msg += `${i+1}. <@${u[0]}> - Level ${u[1].level}\n`;
        });

        return i.reply(msg);
    }
});

// ===== START =====
client.login(TOKEN);