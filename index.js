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

// Lista de servicios con Epic Games incluido
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
        .addStringOption(opt => opt.setName('account').setDescription('user:pass (Optional if file is sent)').setRequired(false))
        .addAttachmentOption(opt => opt.setName('file').setDescription('Upload a .txt file (Optional if account is typed)').setRequired(false)),

    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear all stock from a specific service')
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
        await client.user.setUsername('Eminence Gen');
    } catch (e) { console.error('Username update error:', e.message); }
    
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('Commands synchronized.');
    } catch (e) { console.error(e); }
});

// Lógica de archivos: Todo usa el archivo base, excepto Epic en modo booster que usa bepic.txt
const getPath = (serviceName, stockType) => {
    if (stockType === 'booster' && serviceName === 'epic') {
        return './bepic.txt';
    }
    // Para todo lo demás (Free de todos los juegos Y Booster de los otros juegos) usa el archivo normal
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
        if (!isStaff) {
            return interaction.reply({ content: "❌ You don't have permission to use this command!", ephemeral: true });
        }

        const service = options.getString('service');
        const stockType = options.getString('type');
        const path = getPath(service, stockType);
        
        if (!fs.existsSync(path)) return interaction.reply({ content: `❌ File not found.`, ephemeral: true });
        
        fs.writeFileSync(path, ''); 
        return interaction.reply({ content: `✅ Stock for **${service} (${stockType})** has been cleared!`, ephemeral: true });
    }

    if (commandName === 'fgen' || commandName === 'bgen') {
        if (commandName === 'bgen' && !isStaff && !isBooster) {
            return interaction.reply({ content: 'This command is only for server boosters!', ephemeral: true });
        }

        const service = options.getString('service');

        if (!bypassCooldown && cooldowns.has(user.id)) {
            const exp = cooldowns.get(user.id) + COOLDOWN_TIME;
            if (Date.now() < exp) {
                return interaction.reply({ 
                    content: `❌ Wait ${Math.ceil((exp - Date.now()) / 60000)} min before generating again.`, 
                    ephemeral: true 
                });
            }
        }

        const path = getPath(service, commandName === 'bgen' ? 'booster' : 'free');
        if (!fs.existsSync(path)) return interaction.reply({ content: `❌ File for ${service} not found.`, ephemeral: true });

        let accounts = fs.readFileSync(path, 'utf8').trim().split(/\s+/).filter(x => x);
        
        if (accounts.length > 0) {
            const acc = accounts.shift();
            fs.writeFileSync(path, accounts.join(' '));
            
            const dmEmbed = new EmbedBuilder()
                .setTitle(commandName === 'bgen' ? 'Premium Reward Generated' : 'Account Generated')
                .setDescription(commandName === 'bgen' ? 'Exclusive booster account detail.' : 'Your details have been sent to your DMs.')
                .setColor(commandName === 'bgen' ? 0xF47FFF : 0x5865F2)
                .addFields(
                    { name: 'Service', value: `\`${service.toUpperCase()}\``, inline: true },
                    { name: 'Account', value: `\`${acc}\``, inline: true }
                )
                .setFooter({ text: 'Eminence Gen' });
            
            try {
                await user.send({ embeds: [dmEmbed] });
                if (!bypassCooldown) cooldowns.set(user.id, Date.now());

                const serverEmbed = new EmbedBuilder()
                    .setTitle('Account Sent')
                    .setColor(commandName === 'bgen' ? 0xF47FFF : 0x5865F2)
                    .addFields(
                        { name: 'User', value: `<@${user.id}>`, inline: true },
                        { name: 'Account type', value: `\`${service.toUpperCase()}\``, inline: true },
                        { name: 'Type', value: `\`${commandName === 'bgen' ? 'Booster' : 'Free'}\``, inline: true }
                    )
                    .setFooter({ text: 'Check your DMs' });

                await interaction.reply({ embeds: [serverEmbed] });
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
            .setTitle('Current Stock')
            .setColor(0x5865F2)
            .setDescription('**Free Stock / Booster Stock**')
            .addFields(
                { name: 'Crunchyroll', value: `Free: \`${count('./stock.txt')}\` | Booster: \`${count('./stock.txt')}\``, inline: false },
                { name: 'Fortnite', value: `Free: \`${count('./fortnite.txt')}\` | Booster: \`${count('./fortnite.txt')}\``, inline: false },
                { name: 'Netflix', value: `Free: \`${count('./netflix.txt')}\` | Booster: \`${count('./netflix.txt')}\``, inline: false },
                { name: 'Minecraft', value: `Free: \`${count('./minecraft.txt')}\` | Booster: \`${count('./minecraft.txt')}\``, inline: false },
                { name: 'Roblox', value: `Free: \`${count('./roblox.txt')}\` | Booster: \`${count('./roblox.txt')}\``, inline: false },
                { name: 'Epic Games', value: `Free: \`${count('./epic.txt')}\` | Booster: \`${count('./bepic.txt')}\``, inline: false }
            )
            .setFooter({ text: 'Eminence Gen' });
        await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'restock') {
        if (!isStaff) {
            return interaction.reply({ content: "❌ You don't have permission to use this command!", ephemeral: true });
        }

        const service = options.getString('service');
        const stockType = options.getString('type');
        const account = options.getString('account');
        const file = options.getAttachment('file');
        
        if (!account && !file) {
            return interaction.reply({ content: "❌ Provide either an account or a .txt file.", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const path = getPath(service, stockType);
        let contentToAdd = '';

        try {
            if (file) {
                const response = await fetch(file.url);
                const text = await response.text();
                contentToAdd = fs.existsSync(path) ? `\n${text.trim()}` : text.trim();
            } else if (account) {
                contentToAdd = fs.existsSync(path) ? ` ${account.trim()}` : account.trim();
            }

            if (!fs.existsSync(path)) fs.writeFileSync(path, '');
            fs.appendFileSync(path, contentToAdd);

            return interaction.editReply({ content: `✅ Stock for **${service}** updated successfully in \`${path}\`.` });
        } catch (error) {
            console.error(error);
            return interaction.editReply({ content: "❌ Error processing the restock operation." });
        }
    }
});

client.login(TOKEN);
    
