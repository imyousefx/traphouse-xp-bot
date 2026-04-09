require('dotenv').config();

const fs = require('fs');
const { 
  Client, 
  GatewayIntentBits, 
  SlashCommandBuilder, 
  REST, 
  Routes, 
  EmbedBuilder 
} = require('discord.js');

const express = require('express');

// ===== Web server =====
const app = express();
app.get('/', (req, res) => res.send('Bot is alive 🔥'));
app.listen(3000, () => console.log('Web server running'));

// ===== Load Data =====
let users = {};

if (fs.existsSync('./data.json')) {
  users = JSON.parse(fs.readFileSync('./data.json'));
}

// ===== Save Function =====
function saveData() {
  fs.writeFileSync('./data.json', JSON.stringify(users, null, 2));
}

// ===== Discord Client =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== Commands =====
const commands = [
  new SlashCommandBuilder()
    .setName('top')
    .setDescription('عرض افضل 10 لاعبين'),

  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('عرض رتبتك')
].map(cmd => cmd.toJSON());

// ===== Register =====
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Commands registered');
  } catch (error) {
    console.error(error);
  }
})();

// ===== XP System =====
client.on('messageCreate', message => {
  if (message.author.bot) return;

  if (!users[message.author.id]) {
    users[message.author.id] = { xp: 0, level: 1 };
  }

  users[message.author.id].xp += 10;

  let neededXP = users[message.author.id].level * 100;

  if (users[message.author.id].xp >= neededXP) {
    users[message.author.id].level++;
    users[message.author.id].xp = 0;

    message.channel.send(`🔥 ${message.author} لفلت لـ ${users[message.author.id].level}`);
  }

  saveData(); // 💾 نحفظ كل رسالة
});

// ===== Commands =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // ===== TOP =====
  if (interaction.commandName === 'top') {
    let sorted = Object.entries(users)
      .sort((a, b) => b[1].xp - a[1].xp)
      .slice(0, 10);

    let description = sorted.map((user, index) => {
      let medal = index === 0 ? '👑' : `#${index + 1}`;
      return `${medal} <@${user[0]}> | Level: ${user[1].level} | XP: ${user[1].xp}`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🏆 Top Players')
      .setDescription(description || 'مافي بيانات')
      .setColor('#8e44ad');

    interaction.reply({ embeds: [embed] });
  }

  // ===== RANK =====
  if (interaction.commandName === 'rank') {
    let user = interaction.user;

    if (!users[user.id]) {
      users[user.id] = { xp: 0, level: 1 };
    }

    let data = users[user.id];
    let neededXP = data.level * 100;
    let progress = ((data.xp / neededXP) * 100).toFixed(1);

    const embed = new EmbedBuilder()
      .setColor('#8e44ad')
      .setTitle(`🔥 Rank - ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '💎 Level', value: `${data.level}`, inline: true },
        { name: '⚡ XP', value: `${data.xp} / ${neededXP}`, inline: true },
        { name: '📊 Progress', value: `${progress}%`, inline: true }
      );

    interaction.reply({ embeds: [embed] });
  }
});

// ===== Ready =====
client.once('ready', () => {
  console.log(`🔥 Logged in as ${client.user.tag}`);
});

// ===== Login =====
client.login(process.env.TOKEN);