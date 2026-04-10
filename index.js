const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    REST, 
    Routes, 
    SlashCommandBuilder 
} = require('discord.js');

const { createCanvas, loadImage } = require('canvas');
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
const CLIENT_ID = "YOUR_CLIENT_ID";

// ===== DATABASE =====
let data = {};
if (fs.existsSync('./data.json')) {
    data = JSON.parse(fs.readFileSync('./data.json'));
}

function save() {
    fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
}

// ===== XP SYSTEM =====

function xpNeeded(level) {
    return 4 * (level ** 2) + 40 * level + 120;
}

function applyBoost(member, xp) {
    if (member.roles.cache.has("1491539598449574030")) xp *= 1.1;
    if (member.roles.cache.has("1491539563938844672")) xp *= 1.15;
    if (member.roles.cache.has("1491539446678552768")) xp *= 1.25;
    return Math.floor(xp);
}

function addUser(id) {
    if (!data[id]) {
        data[id] = {
            xp: 0,
            level: 0,
            coins: 0,
            lastDaily: 0
        };
    }
}

function addXP(member, amount) {
    const id = member.id;
    addUser(id);

    data[id].xp += amount;
    data[id].coins += Math.floor(amount / 2);

    let needed = xpNeeded(data[id].level);

    while (data[id].xp >= needed) {
        data[id].xp -= needed;
        data[id].level++;
        updateUserRole(member, data[id].level);
        needed = xpNeeded(data[id].level);
    }

    save();
}

// ===== ROLES (محفوظة 🔥) =====

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
    setTimeout(()=>cooldown.delete(msg.author.id), 20000);

    let xp = Math.floor(Math.random() * 8) + 12;
    xp = applyBoost(msg.member, xp);

    addXP(msg.member, xp);
});

// ===== VOICE XP =====

setInterval(()=>{
    client.guilds.cache.forEach(guild=>{
        guild.channels.cache.forEach(channel=>{
            if (!channel.isVoiceBased()) return;

            channel.members.forEach(member=>{
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

// ===== RANK CARD =====

async function createRankCard(member, user) {
    const canvas = createCanvas(800, 250);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0,0,800,250);

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(200,180,500,25);

    const needed = xpNeeded(user.level);
    const progress = user.xp / needed;

    ctx.fillStyle = "#22c55e";
    ctx.fillRect(200,180,500 * progress,25);

    ctx.fillStyle = "#fff";
    ctx.font = "28px sans-serif";
    ctx.fillText(member.user.username,200,80);

    ctx.font = "22px sans-serif";
    ctx.fillText(`Level: ${user.level}`,200,120);
    ctx.fillText(`${user.xp}/${needed}`,200,150);

    const avatar = await loadImage(member.user.displayAvatarURL({extension:'png'}));
    ctx.drawImage(avatar,40,40,120,120);

    return canvas.toBuffer();
}

// ===== SLASH COMMANDS =====

const commands = [
    new SlashCommandBuilder().setName("rank").setDescription("Rank card"),
    new SlashCommandBuilder().setName("top").setDescription("Leaderboard"),
    new SlashCommandBuilder().setName("daily").setDescription("Daily reward")
];

const rest = new REST({version:'10'}).setToken(TOKEN);

(async()=>{
    await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        {body: commands}
    );
})();

// ===== INTERACTIONS =====

client.on('interactionCreate', async i=>{
    if (!i.isChatInputCommand()) return;

    addUser(i.user.id);

    if (i.commandName === "rank") {
        const buffer = await createRankCard(i.member, data[i.user.id]);

        return i.reply({
            files:[{attachment:buffer,name:"rank.png"}]
        });
    }

    if (i.commandName === "top") {
        const sorted = Object.entries(data)
            .sort((a,b)=>b[1].level - a[1].level || b[1].xp - a[1].xp)
            .slice(0,10);

        let msg = "🏆 Top 10:\n";
        sorted.forEach((u,i)=>{
            msg += `${i+1}. <@${u[0]}> - Lvl ${u[1].level}\n`;
        });

        return i.reply(msg);
    }

    if (i.commandName === "daily") {
        const user = data[i.user.id];
        const now = Date.now();

        if (now - user.lastDaily < 86400000) {
            return i.reply({content:"⏳ رجع بكرا!", ephemeral:true});
        }

        user.lastDaily = now;
        user.coins += 200;

        save();

        return i.reply("💰 أخذت 200 كوين!");
    }
});

client.login(TOKEN);