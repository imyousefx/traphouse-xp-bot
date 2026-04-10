require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const app = express();
app.get('/', (req, res) => res.send('Bot is alive 🔥'));
app.listen(3000, () => console.log('Web server running'));

let users = {};
const cooldown = {};

// 📁 تحميل البيانات
if (fs.existsSync('./data.json')) {
  users = JSON.parse(fs.readFileSync('./data.json'));
}

function saveData() {
  fs.writeFileSync('./data.json', JSON.stringify(users, null, 2));
}

// 🔥 XP SYSTEM
client.on('messageCreate', message => {
  if (message.author.bot) return;

  const userId = message.author.id;

  if (!users[userId]) {
    users[userId] = { xp: 0, level: 1 };
  } else {
    users[userId].xp ??= 0;
    users[userId].level ??= 1;
  }

  // ⏱️ Cooldown 15 ثانية
  if (cooldown[userId] && Date.now() - cooldown[userId] < 15000) return;
  cooldown[userId] = Date.now();

  // 💎 XP عشوائي
  users[userId].xp += Math.floor(Math.random() * 10) + 5;

  let neededXP = users[userId].level * 100;

  if (users[userId].xp >= neededXP) {
    users[userId].level++;
    users[userId].xp = 0;

    message.channel.send(`🔥 ${message.author} لفلت لـ ${users[userId].level}`);
  }

  saveData();
});

// 🧠 COMMANDS
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  if (!users[userId]) {
    users[userId] = { xp: 0, level: 1 };
  }

  // 🔥 RANK
  if (interaction.commandName === 'rank') {
    const xp = users[userId].xp;
    const level = users[userId].level;
    const neededXP = level * 100;
    const progress = ((xp / neededXP) * 100).toFixed(1);

    const embed = new EmbedBuilder()
      .setColor('#8e44ad')
      .setTitle(`🔥 Rank - ${interaction.user.username}`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '💎 Level', value: `${level}`, inline: true },
        { name: '⚡ XP', value: `${xp}/${neededXP}`, inline: true },
        { name: '📊 Progress', value: `${progress}%`, inline: true }
      );

    interaction.reply({ embeds: [embed] });
  }

  // 🏆 TOP
  if (interaction.commandName === 'top') {
    let sorted = Object.entries(users)
      .map(([id, data]) => ({
        id,
        xp: data?.xp ?? 0,
        level: data?.level ?? 1
      }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 10);

    let description = sorted.map((user, index) => {
      let medal = index === 0 ? '👑' : `#${index + 1}`;
      let color = index === 0 ? '🟡' : index === 1 ? '⚪' : index === 2 ? '🟤' : '🔵';

      return `${medal} ${color} <@${user.id}> | Level: ${user.level} | XP: ${user.xp}`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#f1c40f')
      .setTitle('🏆 Top Players')
      .setDescription(description);

    interaction.reply({ embeds: [embed] });
  }
});

// ✅ READY
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// 🔐 LOGIN
client.login(process.env.TOKEN);