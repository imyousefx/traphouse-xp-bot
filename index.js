// 🔥 Web Server (عشان Render + UptimeRobot)
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot is alive 🔥');
});

app.listen(3000, () => {
  console.log('Web server running');
});

// 🔽 باقي الكود
require('dotenv').config();

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

// 🔐 بيانات
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// 📁 قاعدة البيانات
let data = {};
if (fs.existsSync('data.json')) {
  data = JSON.parse(fs.readFileSync('data.json'));
}

// 🎮 البوت
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

// 🧠 نظام XP
function addXP(userId, amount) {
  if (!data[userId]) {
    data[userId] = { xp: 0, level: 1 };
  }

  data[userId].xp += amount;

  let needed = data[userId].level * 200;

  if (data[userId].xp >= needed) {
    data[userId].xp = 0;
    data[userId].level++;
  }

  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

// 🎤 XP صوتي
setInterval(() => {
  client.guilds.cache.forEach(guild => {
    guild.members.cache.forEach(member => {
      if (
        member.voice.channel &&
        !member.voice.selfDeaf &&
        !member.voice.serverDeaf
      ) {
        addXP(member.id, 5);
      }
    });
  });
}, 60000);

// 🧾 أوامر
const commands = [
  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Show your rank'),

  new SlashCommandBuilder()
    .setName('top')
    .setDescription('Top players')
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

// 📡 تسجيل الأوامر
(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log('Slash commands registered');
  } catch (err) {
    console.error(err);
  }
})();

// 🚀 عند تشغيل البوت
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// 🧾 تنفيذ الأوامر
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  if (!data[userId]) {
    data[userId] = { xp: 0, level: 1 };
  }

  // 🧍 /rank
  if (interaction.commandName === 'rank') {
    const canvas = createCanvas(800, 250);
    const ctx = canvas.getContext('2d');

    // خلفية
    ctx.fillStyle = '#1e1e2f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // اسم
    ctx.fillStyle = '#ffffff';
    ctx.font = '30px Arial';
    ctx.fillText(interaction.user.username, 250, 80);

    // لفل
    ctx.font = '25px Arial';
    ctx.fillText(`Level: ${data[userId].level}`, 250, 130);
    ctx.fillText(`XP: ${data[userId].xp}`, 250, 170);

    // صورة
    const avatar = await loadImage(interaction.user.displayAvatarURL({ extension: 'png' }));
    ctx.drawImage(avatar, 50, 50, 150, 150);

    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'rank.png' });

    await interaction.reply({ files: [attachment] });
  }

  // 🏆 /top
  if (interaction.commandName === 'top') {
    const sorted = Object.entries(data)
      .sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp)
      .slice(0, 10);

    const embed = new EmbedBuilder()
      .setTitle('🏆 Top Players')
      .setColor('#a855f7');

    let desc = '';

    sorted.forEach((user, i) => {
      desc += `**#${i + 1}** <@${user[0]}> — Lv.${user[1].level} | XP: ${user[1].xp}\n`;
    });

    embed.setDescription(desc);

    await interaction.reply({ embeds: [embed] });
  }
});

// 🔐 تشغيل البوت
client.login(TOKEN);