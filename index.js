require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fs = require('fs');
const http = require('http'); 

// --- SERVER PARA RAILWAY/RENDER ---
const port = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Reze Gen Is Online!');
}).listen(port, '0.0.0.0');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
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
    { name: 'Roblox', value: 'roblox' },
    { name: 'Epic Games', value: 'epic' },
    { name: 'CC', value: 'cc' }
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
        .addStringOption(opt => opt.setName('account').setDescription('user:pass (Optional if file is sent)').setRequired(false))
        .addAttachmentOption(opt => opt.setName('file').setDescription('Upload a .txt file with accounts').setRequired(false)),

    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear all stock from a specific service and type')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(opt => opt.setName('service').setDescription('Service to clear').setRequired(true).addChoices(...services))
        .addStringOption(opt => opt.setName('type').setDescription('Type to clear').setRequired(true).addChoices(
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
        console.log('🚀 Commands updated.');
    } catch (e) { console.error(e); }
});

// Lógica flexible para permitir la mezcla
const getPath = (serviceName, stockType) => {
    const name = serviceName.toLowerCase();
    if (name === 'crunchyroll' && stockType === 'booster') return './bstock.txt';
    if (name === 'cc') return './bvcc.txt';
    if (stockType === 'booster') return `./b${name}.txt`;
    return `./${name}.txt`;
};

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, user, member } = interaction;

    const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages);
    const isBooster = !!member.premiumSince;
    const bypassCooldown = isStaff || isBooster;

    if (commandName === 'clear') {
        if (!isStaff) return interaction.reply({ content: "❌ You Don't Have Permission!", ephemeral: true });
        
        const path = getPath(options.getString('service'), options.getString('type'));
        if (fs.existsSync(path)) fs.writeFileSync(path, ''); 
        return interaction.reply({ content: `✅ Stock cleared!`, ephemeral: true });
    }

    if (commandName === 'fgen' || commandName === 'bgen') {
        if (commandName === 'bgen' && !bypassCooldown) return interaction.reply({ content: '❌ Booster/Staff only!', ephemeral: true });

        const service = options.getString('service');
        const stockType = commandName === 'bgen' ? 'booster' : 'free';
        const path = getPath(service, stockType);
        
        if (!fs.existsSync(path)) return interaction.reply({ content: `❌ File not found.`, ephemeral: true });

        let fileContent = fs.readFileSync(path, 'utf8').trim();
        if (!fileContent) return interaction.reply({ content: `❌ Out of stock!`, ephemeral: true });

        let accounts = fileContent.split(/\r?\n/).filter(x => x.trim() !== '');
        const acc = accounts.shift();
        fs.writeFileSync(path, accounts.join('\n'));
            
        const dmEmbed = new EmbedBuilder()
            .setTitle('Account Generated!')
            .setColor(commandName === 'bgen' ? 0xF47FFF : 0xFF6347)
            .addFields({ name: 'Service', value: `\`${service.toUpperCase()}\``, inline: true }, { name: 'Account', value: `\`${acc}\``, inline: true });
            
        try {
            await user.send({ embeds: [dmEmbed] });
            if (!bypassCooldown) cooldowns.set(user.id, Date.now());
            await interaction.reply({ content: '✅ Check your DMs!', ephemeral: true });
        } catch {
            await interaction.reply({ content: '❌ Open your DMs!', ephemeral: true });
        }
    }

    if (commandName === 'stock') {
        await interaction.deferReply({ ephemeral: true });
        const count = (f) => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(x => x.trim() !== '').length : 0;
        
        const embed = new EmbedBuilder().setTitle('📊 Current Stock').setColor(0x5865F2);
        services.forEach(s => embed.addFields({ name: s.name, value: `Free: \`${count(getPath(s.value, 'free'))}\` | Booster: \`${count(getPath(s.value, 'booster'))}\``, inline: false }));
        await interaction.editReply({ embeds: [embed] });
    }

    if (commandName === 'restock') {
        if (!isStaff) return interaction.reply({ content: "❌ You Don't Have Permission!", ephemeral: true });

        const path = getPath(options.getString('service'), options.getString('type'));
        let contentToAdd = '';
        if (options.getAttachment('file')) {
            const response = await fetch(options.getAttachment('file').url);
            contentToAdd = await response.text();
        } else {
            contentToAdd = options.getString('account');
        }

        const currentContent = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
        fs.writeFileSync(path, currentContent + (currentContent ? '\n' : '') + contentToAdd.trim());

        return interaction.reply({ content: `✅ Stock updated!`, ephemeral: true });
    }
});

client.login(TOKEN);
    
