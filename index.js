const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fs = require('fs');
const http = require('http'); 

// --- SERVER PARA RAILWAY/RENDER ---
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
const COOLDOWN_TIME = 600000; // 10 minutos

const services = [
    { name: 'Crunchyroll', value: 'crunchyroll' },
    { name: 'Fortnite', value: 'fortnite' },
    { name: 'Netflix', value: 'netflix' },
    { name: 'Minecraft', value: 'minecraft' },
    { name: 'Roblox', value: 'roblox' }
];

const commands = [
    new SlashCommandBuilder()
        .setName('gen')
        .setDescription('Generate an account')
        .addStringOption(opt => opt.setName('service').setDescription('Select service').setRequired(true).addChoices(...services)),
    
    new SlashCommandBuilder().setName('stock').setDescription('Check stock status'),
    
        new SlashCommandBuilder()
        .setName('restock')
        .setDescription('Add accounts via text or file')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(opt => opt.setName('service').setDescription('Service').setRequired(true).addChoices(...services))
        .addStringOption(opt => opt.setName('account').setDescription('user:pass (Optional if file is sent)').setRequired(false))
        .addAttachmentOption(opt => opt.setName('file').setDescription('Upload a .txt file with accounts').setRequired(false)),

     new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear all stock from a specific service')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(opt => opt.setName('service').setDescription('Service to clear').setRequired(true).addChoices(...services))
].map(c => c.toJSON());
    


const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
        client.user.setPresence({ status: 'idle' });
    
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('🚀 Commands updated with Roblox included.');
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, user, member } = interaction;
    if (commandName === 'clear') {
        const service = options.getString('service');
        const path = getPath(service);
        if (!fs.existsSync(path)) return interaction.reply({ content: `❌ File for ${service} not found.`, ephemeral: true });
        
        fs.writeFileSync(path, ''); 
        return interaction.reply({ content: `✅ Stock for **${service}** has been cleared!`, ephemeral: true });
    }
    
    const getPath = (s) => (s === 'crunchyroll') ? './stock.txt' : `./${s}.txt`;

    if (commandName === 'gen') {
        const service = options.getString('service');
        
        if (cooldowns.has(user.id)) {
            const exp = cooldowns.get(user.id) + COOLDOWN_TIME;
            if (Date.now() < exp) {
                return interaction.reply({ 
                    content: `❌ Wait ${Math.ceil((exp - Date.now()) / 60000)} min before generating again.`, 
                    ephemeral: true 
                });
            }
        }

        const path = getPath(service);
        if (!fs.existsSync(path)) return interaction.reply({ content: `❌ File ${service}.txt not found.`, ephemeral: true });

        let accounts = fs.readFileSync(path, 'utf8').trim().split(/\s+/).filter(x => x);
        
        if (accounts.length > 0) {
            const acc = accounts.shift();
            fs.writeFileSync(path, accounts.join(' '));
            
            const embed = new EmbedBuilder()
                .setTitle('🍅 Tomato Gen')
                .setColor(0xFF6347)
                .addFields(
                    { name: 'Service', value: service, inline: true },
                    { name: 'Account', value: `\`${acc}\``, inline: true }
                )
                .setFooter({ text: 'Enjoy your account!' });
            
            try {
                await user.send({ embeds: [embed] });
                cooldowns.set(user.id, Date.now());
                await interaction.reply({ content: `✅ **${user.tag}**, check your DMs for the **${service}** account!` });
            } catch {
                await interaction.reply({ content: '❌ I can\'t send you DMs! Please open them in Settings.', ephemeral: true });
            }
        } else {
            await interaction.reply({ content: `❌ Sorry, we are out of stock for **${service}**!` });
        }
    }

    if (commandName === 'stock') {
        const count = (f) => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split(/\s+/).filter(x => x).length : 0;
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Current Stock')
            .setColor(0x5865F2)
            .addFields(
                { name: 'Crunchyroll', value: `${count('./stock.txt')}`, inline: true },
                { name: 'Fortnite', value: `${count('./fortnite.txt')}`, inline: true },
                { name: 'Netflix', value: `${count('./netflix.txt')}`, inline: true },
                { name: 'Minecraft', value: `${count('./minecraft.txt')}`, inline: true },
                { name: 'Roblox', value: `${count('./roblox.txt')}`, inline: true }
            );
        await interaction.reply({ embeds: [embed] });
    }

        if (commandName === 'restock') {
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: "❌ You Don't Have Permission!", ephemeral: true });
        }

        const service = options.getString('service');
        const account = options.getString('account');
        const file = options.getAttachment('file');
        const path = getPath(service);
        let contentToAdd = '';

        if (file) {
            const response = await fetch(file.url);
            const text = await response.text();
            contentToAdd = `\n${text.trim()}`;
        } else if (account) {
            contentToAdd = ` ${account.trim()}`;
        } else {
            return interaction.reply({ content: "❌ Upload a .txt file or type a account.", ephemeral: true });
        }

        fs.appendFileSync(path, contentToAdd);
        return interaction.reply({ content: `✅ Stock of **${service}** updated successfully .`, ephemeral: true });
    }
    
});

client.login(TOKEN);
                                                                                                    
