require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fs = require('fs');
const http = require('http'); 

// --- SERVIDOR HTTP PARA RENDER (PORT 10000) ---
const port = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Tomato Bot is Active');
}).listen(port, '0.0.0.0');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const cooldowns = new Map();
const COOLDOWN_TIME = 600000; 

const services = [
    { name: 'Crunchyroll', value: 'crunchyroll' },
    { name: 'Fortnite', value: 'fortnite' },
    { name: 'Netflix', value: 'netflix' },
    { name: 'Minecraft', value: 'minecraft' }
];

const commands = [
    new SlashCommandBuilder()
        .setName('gen')
        .setDescription('Generate an account')
        .addStringOption(opt => opt.setName('service').setDescription('Select service').setRequired(true).addChoices(...services)),
    
    new SlashCommandBuilder().setName('stock').setDescription('Check stock status'),
    
    new SlashCommandBuilder()
        .setName('restock')
        .setDescription('Add accounts (Manage Messages Required)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) // <--- PERMISO AQUÍ
        .addStringOption(opt => opt.setName('service').setDescription('Service').setRequired(true).addChoices(...services))
        .addStringOption(opt => opt.setName('account').setDescription('user:pass').setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('🚀 Commands updated with permissions.');
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, user, member } = interaction;

    const getPath = (s) => (s === 'crunchyroll') ? './stock.txt' : `./${s}.txt`;

    if (commandName === 'gen') {
        const service = options.getString('service');
        if (cooldowns.has(user.id)) {
            const exp = cooldowns.get(user.id) + COOLDOWN_TIME;
            if (Date.now() < exp) return interaction.reply({ content: `❌ Wait ${Math.ceil((exp - Date.now()) / 60000)} min.`, ephemeral: true });
        }

        const path = getPath(service);
        if (!fs.existsSync(path)) return interaction.reply({ content: `❌ File missing for ${service}.`, ephemeral: true });

        let accounts = fs.readFileSync(path, 'utf8').trim().split(/\s+/).filter(x => x);
        if (accounts.length > 0) {
            const acc = accounts.shift();
            fs.writeFileSync(path, accounts.join(' '));
            const embed = new EmbedBuilder().setTitle('🍅 Tomato Gen').setColor(0xFF6347).addFields({ name: 'Service', value: service }, { name: 'Account', value: `\`${acc}\`` });
            
            try {
                await user.send({ embeds: [embed] });
                cooldowns.set(user.id, Date.now());
                await interaction.reply({ content: `✅ **${user.tag}** generated a **${service}** account! Check DMs.` });
            } catch { await interaction.reply({ content: '❌ Open your DMs!', ephemeral: true }); }
        } else {
            await interaction.reply({ content: `❌ No stock for ${service}!` });
        }
    }

    if (commandName === 'stock') {
        const count = (f) => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split(/\s+/).filter(x => x).length : 0;
        const embed = new EmbedBuilder().setTitle('📊 Stock Info').setColor(0x5865F2).addFields(
            { name: 'Crunchyroll', value: `${count('./stock.txt')}`, inline: true },
            { name: 'Fortnite', value: `${count('./fortnite.txt')}`, inline: true },
            { name: 'Netflix', value: `${count('./netflix.txt')}`, inline: true },
            { name: 'Minecraft', value: `${count('./minecraft.txt')}`, inline: true }
        );
        await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'restock') {
        // Doble verificación de seguridad
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: "❌ You need 'Manage Messages' permission!", ephemeral: true });
        }

        const service = options.getString('service');
        const account = options.getString('account');
        const path = getPath(service);

        fs.appendFileSync(path, ` ${account}`);
        await interaction.reply({ content: `✅ Successfully added to **${service}**!`, ephemeral: true });
    }
});

client.login(TOKEN);
     
