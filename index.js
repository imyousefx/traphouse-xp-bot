require('dotenv').config();

const { 
  Client, 
  GatewayIntentBits, 
  SlashCommandBuilder, 
  REST, 
  Routes, 
  EmbedBuilder 
} = require('discord.js');

const express = require('express');

// ====== Web server (عشان Render + UptimeRobot) ======
const app = express();
app.get('/', (req, res) => res.send('Bot is alive 🔥'));
app.listen(3000, () => console.log('Web server running'));

// ====== Discord Client ======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ====== Data (مؤقت - لاحقاً نربطه بقاعدة بيانات) ======
let users = {};

// ====== Commands ======
const commands = [
  new SlashCommandBuilder()
    .setName('top')
    .setDescription('عرض افضل 10 لاعبين XP')
].map(cmd => cmd.toJSON());

// ====== Register Commands ======
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registered');
  } catch (error) {
    console.error(error);
  }
})();

// ====== XP System ======
client.on('messageCreate', message => {
  if (message.author.bot) return;

  if (!users[message.author.id]) {
    users[message.author.id] = {
      xp: 0,
      level: 1
    };
  }

  users[message.author.id].xp += 10;

  let neededXP = users[message.author.id].level * 100;

  if (users[message.author.id].xp >= neededXP) {
    users[message.author.id].level++;
    users[message.author.id].xp = 0;

    message.channel.send(`🔥 ${message.author} لفلت لـ ${users[message.author.id].level}`);
  }
});

// ====== Slash Commands ======
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'top') {
    let sorted = Object.entries(users)
      .sort((a, b) => b[1].xp - a[1].xp)
      .slice(0, 10);

    let description = sorted.map((user, index) => {
      let medal = index === 0 ? '👑' : `#${index + 1}`;
      let colorEmoji = index === 0 ? '🟡' : index === 1 ? '⚪' : index === 2 ? '🟤' : '🔵';

      return `${medal} ${colorEmoji} <@${user[0]}> | Level: ${user[1].level} | XP: ${user[1].xp}`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🏆 Top Players')
      .setDescription(description || 'مافي بيانات')
      .setColor('#8e44ad');

    interaction.reply({ embeds: [embed] });
  }
});

// ====== Ready ======
client.once('ready', () => {
  console.log(`🔥 Logged in as ${client.user.tag}`);
});

// ====== Login ======
client.login(process.env.TOKEN);