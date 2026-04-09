require('dotenv').config();

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

// 🔐 بياناتك
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// 📂 تحميل البيانات
let data = {};
if (fs.existsSync('data.json')) {
  data = JSON.parse(fs.readFileSync('data.json'));
}

const xp = data.xp || {};
const levels = data.levels || {};
const voiceTime = {};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// 💾 حفظ البيانات
function saveData() {
  fs.writeFileSync('data.json', JSON.stringify({ xp, levels }, null, 2));
}

// 🎮 الأوامر
const commands = [
  new SlashCommandBuilder().setName('rank').setDescription('عرض مستواك'),
  new SlashCommandBuilder().setName('top').setDescription('أفضل اللاعبين')
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );
  console.log("✅ Slash commands registered");
})();

// 🚀 تشغيل
client.once('clientReady', () => {
  console.log(`🔥 Logged in as ${client.user.tag}`);
  client.user.setActivity('/rank');
});

// 💬 XP شات
client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  const id = message.author.id;

  xp[id] = (xp[id] || 0) + 10;
  levels[id] = levels[id] || 1;

  checkLevelUp(message, id);
  saveData(); // 💾 حفظ
});

// 🎧 XP صوت
client.on('voiceStateUpdate', (oldState, newState) => {
  const member = newState.member;
  if (!member || member.user.bot) return;

  if (newState.channelId) {

    if (voiceTime[member.id]) return;

    voiceTime[member.id] = setInterval(() => {

      const voice = member.voice;
      if (!voice.channel) return;

      if (member.guild.afkChannelId === voice.channelId) return;
      if (voice.selfMute || voice.selfDeaf) return;

      const count = voice.channel.members.filter(m => !m.user.bot).size;

      let xpGain = 5;
      if (count === 2) xpGain = 7;
      else if (count >= 3 && count <= 4) xpGain = 10;
      else if (count >= 5) xpGain = 15;

      const id = member.id;

      xp[id] = (xp[id] || 0) + xpGain;
      levels[id] = levels[id] || 1;

      saveData(); // 💾 حفظ

    }, 60000);

  } else {
    clearInterval(voiceTime[member.id]);
    delete voiceTime[member.id];
  }
});

// 🏆 الأوامر
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const id = interaction.user.id;

  // 🎨 Rank Card
  if (interaction.commandName === 'rank') {

    const userXP = xp[id] || 0;
    const userLevel = levels[id] || 1;
    const needed = Math.floor(100 * Math.pow(userLevel, 1.5));

    const canvas = createCanvas(900, 300);
    const ctx = canvas.getContext('2d');

    // خلفية
    ctx.fillStyle = "#0d001a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, 900, 0);
    gradient.addColorStop(0, "#6a00ff");
    gradient.addColorStop(1, "#ff00cc");
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;

    // شعار
    try {
      const logo = await loadImage("logo.png");
      ctx.drawImage(logo, 700, 20, 160, 160);
    } catch {}

    // صورة
    const avatar = await loadImage(interaction.user.displayAvatarURL({ extension: 'png' }));

    ctx.beginPath();
    ctx.arc(120, 160, 80, 0, Math.PI * 2);
    ctx.fillStyle = "#6a00ff";
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(120, 160, 70, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, 50, 90, 140, 140);
    ctx.restore();

    // نص
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(interaction.user.username, 250, 110);

    ctx.fillText(`Level: ${userLevel}`, 250, 160);
    ctx.fillText(`XP: ${userXP} / ${needed}`, 250, 200);

    // بار
    const progress = userXP / needed;

    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(250, 240, 500, 18);

    ctx.fillStyle = "#ff00cc";
    ctx.fillRect(250, 240, 500 * progress, 18);

    await interaction.reply({
      files: [{
        attachment: canvas.toBuffer(),
        name: "rank.png"
      }]
    });
  }

  // 🏆 Top
  if (interaction.commandName === 'top') {

    const leaderboard = Object.keys(levels).map(id => ({
      id,
      level: levels[id],
      xp: xp[id] || 0
    }));

    leaderboard.sort((a, b) => {
      if (b.level === a.level) return b.xp - a.xp;
      return b.level - a.level;
    });

    const embed = {
      color: 0x9B59FF,
      title: "🏆 Trap House Leaderboard",
      fields: []
    };

    for (let i = 0; i < leaderboard.slice(0, 10).length; i++) {
      const user = await client.users.fetch(leaderboard[i].id).catch(() => null);
      if (!user) continue;

      let crown = i === 0 ? "👑 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : "";

      embed.fields.push({
        name: `${crown}#${i + 1} ${user.username}`,
        value: `Level: ${leaderboard[i].level} | XP: ${leaderboard[i].xp}`
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
});

// 🎯 لفل
function checkLevelUp(message, id) {
  const needed = Math.floor(100 * Math.pow(levels[id], 1.5));

  if (xp[id] >= needed) {
    xp[id] = 0;
    levels[id]++;
    message.channel.send(`🔥 <@${id}> وصل لفل ${levels[id]}!`);
  }
}

client.login(TOKEN);