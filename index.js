const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fs = require('fs');
const http = require('http'); 

// --- SERVIDOR WEB PARA RAILWAY ---
const port = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Eminence Gen Is Online!');
}).listen(port, '0.0.0.0');

const client = new Client({
    intents: [GatewayIntentBits.Guilds] 
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const cooldowns = new Map();
const COOLDOWN_TIME = 600000; 

// Lista de servicios
const services = [
    { name: 'Crunchyroll', value: 'crunchyroll' },
    { name: 'Fortnite', value: 'fortnite' },
    { name: 'Netflix', value: 'netflix' },
    { name: 'Minecraft', value: 'minecraft' },
    { name: 'Roblox', value: 'roblox' },
    { name: 'Epic Games', value: 'epic' }
];

const commands = [
    new SlashCommandBuilder()
        .setName('fgen')
        .setDescription('Generate a free account')
        .addStringOption(opt => opt.setName('service').setDescription('Select service').setRequired(true).addChoices(...services)),
    
    new SlashCommandBuilder()
        .setName('bgen')
        .setDescription('Generate an exclusive account for server boosters and staff')
        .addStringOption(opt => opt.setName('service').setDescription('Select service').setRequired(true).addChoices(...services)),
    
    new SlashCommandBuilder().setName('stock').setDescription('Check stock status'),
    
    new SlashCommandBuilder()
        .setName('restock')
        .setDescription('Add accounts to a service')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(opt => opt.setName('service').setDescription('Service').setRequired(true).addChoices(...services))
        .addStringOption(opt => opt.setName('type').setDescription('Is booster?').setRequired(true).addChoices(
            { name: 'Free', value: 'free' },
            { name: 'Booster', value: 'booster' }
        ))
        .addStringOption(opt => opt.setName('account').setDescription('user:pass').setRequired(false))
        .addAttachmentOption(opt => opt.setName('file').setDescription('Upload .txt file').setRequired(false)),

    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear all stock from a specific service')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(opt => opt.setName('service').setDescription('Service').setRequired(true).addChoices(...services))
        .addStringOption(opt => opt.setName('type').setDescription('Type').setRequired(true).addChoices(
            { name: 'Free', value: 'free' },
            { name: 'Booster', value: 'booster' }
        ))
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    client.user.setPresence({ status: 'dnd' });
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('Commands synchronized.');
    } catch (e) { console.error(e); }
});

const getPath = (serviceName, stockType) => {
    if (stockType === 'booster' && serviceName === 'epic') return './bepic.txt';
    if (serviceName === 'crunchyroll') return './stock.txt';
    return `./${serviceName.toLowerCase()}.txt`;
};

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, user, member } = interaction;
    const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages);
    const isBooster = !!member.premiumSince;
    const bypassCooldown = isStaff || isBooster;

    if (commandName === 'clear') {
        if (!isStaff) return interaction.reply({ content: "❌ No permission!", ephemeral: true });
        const path = getPath(options.getString('service'), options.getString('type'));
        if (!fs.existsSync(path)) return interaction.reply({ content: `❌ File not found.`, ephemeral: true });
        fs.writeFileSync(path, ''); 
        return interaction.reply({ content: `✅ Cleared!`, ephemeral: true });
    }

    if (commandName === 'fgen' || commandName === 'bgen') {
        if (commandName === 'bgen' && !isStaff && !isBooster) return interaction.reply({ content: 'Only for boosters!', ephemeral: true });
        const service = options.getString('service');
        if (!bypassCooldown && cooldowns.has(user.id)) {
            const exp = cooldowns.get(user.id) + COOLDOWN_TIME;
            if (Date.now() < exp) return interaction.reply({ content: `❌ Wait ${Math.ceil((exp - Date.now()) / 60000)} min.`, ephemeral: true });
        }
        const path = getPath(service, commandName === 'bgen' ? 'booster' : 'free');
        if (!fs.existsSync(path)) return interaction.reply({ content: `❌ File not found.`, ephemeral: true });
        let accounts = fs.readFileSync(path, 'utf8').trim().split(/\s+/).filter(x => x);
        if (accounts.length > 0) {
            const acc = accounts.shift();
            fs.writeFileSync(path, accounts.join(' '));
            try {
                await user.send({ embeds: [new EmbedBuilder().setTitle('Account').addFields({name: 'Service', value: service}, {name: 'Acc', value: acc}).setColor(0x5865F2)] });
                if (!bypassCooldown) cooldowns.set(user.id, Date.now());
                await interaction.reply({ content: '✅ Sent to your DMs!', ephemeral: true });
            } catch { await interaction.reply({ content: '❌ Open your DMs!', ephemeral: true }); }
        } else { await interaction.reply({ content: `❌ Out of stock!`, ephemeral: true }); }
    }

    if (commandName === 'stock') {
        await interaction.deferReply({ ephemeral: true });
        const count = (f) => (!fs.existsSync(f)) ? 0 : (fs.readFileSync(f, 'utf8').trim() ? fs.readFileSync(f, 'utf8').trim().split(/\s+/).filter(x => x).length : 0);
        const embed = new EmbedBuilder().setTitle('Current Stock').setColor(0x5865F2)
            .addFields(
                { name: 'Crunchyroll', value: `F: \`${count('./stock.txt')}\` | B: \`${count('./stock.txt')}\``, inline: false },
                { name: 'Fortnite', value: `F: \`${count('./fortnite.txt')}\` | B: \`${count('./fortnite.txt')}\``, inline: false },
                { name: 'Netflix', value: `F: \`${count('./netflix.txt')}\` | B: \`${count('./netflix.txt')}\``, inline: false },
                { name: 'Minecraft', value: `F: \`${count('./minecraft.txt')}\` | B: \`${count('./minecraft.txt')}\``, inline: false },
                { name: 'Roblox', value: `F: \`${count('./roblox.txt')}\` | B: \`${count('./roblox.txt')}\``, inline: false },
                { name: 'Epic Games', value: `F: \`${count('./epic.txt')}\` | B: \`${count('./bepic.txt')}\``, inline: false }
            );
        await interaction.editReply({ embeds: [embed] });
    }

    if (commandName === 'restock') {
        if (!isStaff) return interaction.reply({ content: "❌ No permission!", ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        const path = getPath(options.getString('service'), options.getString('type'));
        let contentToAdd = '';
        try {
            if (options.getAttachment('file')) {
                const response = await fetch(options.getAttachment('file').url);
                contentToAdd = await response.text();
            } else if (options.getString('account')) {
                contentToAdd = options.getString('account');
            }
            fs.appendFileSync(path, `\n${contentToAdd.trim()}`);
            await interaction.editReply({ content: `✅ Updated!` });
        } catch (e) { await interaction.editReply({ content: "❌ Error!" }); }
    }
});

client.login(TOKEN);
      
