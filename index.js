require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fs = require('fs');
const http = require('http'); 

const port = process.env.PORT || 10000;
http.createServer((req, res) => { res.end('Reze Gen Is Online!'); }).listen(port, '0.0.0.0');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const services = [
    { name: 'Crunchyroll', value: 'crunchyroll' },
    { name: 'Fortnite', value: 'fortnite' },
    { name: 'Netflix', value: 'netflix' },
    { name: 'Minecraft', value: 'minecraft' },
    { name: 'Roblox', value: 'roblox' },
    { name: 'Epic Games', value: 'epic' },
    { name: 'CC', value: 'cc' }
];

const getPath = (service, type) => {
    const s = service.toLowerCase();
    if (type === 'booster') {
        if (s === 'crunchyroll') return './bstock.txt';
        if (s === 'cc') return './bvcc.txt';
        return `./b${s}.txt`;
    }
    return `./${s}.txt`; // Free sin 'b'
};

const commands = [
    new SlashCommandBuilder().setName('fgen').setDescription('Generate a free account').addStringOption(o => o.setName('service').setDescription('Select the service').setRequired(true).addChoices(...services.filter(s => s.value !== 'cc' && s.value !== 'epic'))),
    new SlashCommandBuilder().setName('bgen').setDescription('Generate an exclusive account').addStringOption(o => o.setName('service').setDescription('Select the service').setRequired(true).addChoices(...services)),
    new SlashCommandBuilder().setName('stock').setDescription('Check current stock'),
    new SlashCommandBuilder().setName('restock').setDescription('Add accounts to stock').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(o => o.setName('service').setDescription('The service').setRequired(true).addChoices(...services))
        .addStringOption(o => o.setName('type').setDescription('Is it booster?').setRequired(true).addChoices({name:'Free',value:'free'},{name:'Booster',value:'booster'}))
        .addStringOption(o => o.setName('account').setDescription('Account details').setRequired(false))
        .addAttachmentOption(o => o.setName('file').setDescription('Upload .txt file').setRequired(false)),
    new SlashCommandBuilder().setName('clear').setDescription('Clear stock of a service').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(o => o.setName('service').setDescription('The service').setRequired(true).addChoices(...services))
        .addStringOption(o => o.setName('type').setDescription('Is it booster?').setRequired(true).addChoices({name:'Free',value:'free'},{name:'Booster',value:'booster'}))
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Bot is online and commands loaded!');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, user, member } = interaction;
    const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages);
    const isBooster = !!member.premiumSince;

    if (commandName === 'stock') {
        await interaction.deferReply({ ephemeral: true });
        const count = (f) => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(x => x.trim()).length : 0;
        const embed = new EmbedBuilder().setTitle('📊 Current Stock').setColor(0x5865F2);
        services.forEach(s => {
            const freeCount = (s.value === 'cc') ? 0 : count(getPath(s.value, 'free'));
            embed.addFields({ name: s.name, value: `Free: \`${freeCount}\` | Booster: \`${count(getPath(s.value, 'booster'))}\``, inline: false });
        });
        await interaction.editReply({ embeds: [embed] });
    }

    if (commandName === 'fgen' || commandName === 'bgen') {
        const path = getPath(options.getString('service'), commandName === 'bgen' ? 'booster' : 'free');
        if (!fs.existsSync(path)) return interaction.reply({content: '❌ File not found.', ephemeral: true});
        let lines = fs.readFileSync(path, 'utf8').split(/\r?\n/).filter(x => x.trim());
        if (!lines.length) return interaction.reply({content: '❌ Out of stock.', ephemeral: true});
        const acc = lines.shift();
        fs.writeFileSync(path, lines.join('\n'));
        try {
            await user.send(`Your ${options.getString('service')} account: \`${acc}\``);
            interaction.reply({content: '✅ Check your DMs!', ephemeral: true});
        } catch { interaction.reply({content: '❌ Please open your DMs.', ephemeral: true}); }
    }

    if (commandName === 'restock') {
        if (!isStaff) return interaction.reply({content: "❌ No permission.", ephemeral: true});
        const path = getPath(options.getString('service'), options.getString('type'));
        let data = options.getAttachment('file') ? await (await fetch(options.getAttachment('file').url)).text() : options.getString('account');
        const current = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
        fs.writeFileSync(path, current + (current ? '\n' : '') + data.trim());
        interaction.reply({content: '✅ Stock updated.', ephemeral: true});
    }

    if (commandName === 'clear') {
        if (!isStaff) return interaction.reply({content: "❌ No permission.", ephemeral: true});
        fs.writeFileSync(getPath(options.getString('service'), options.getString('type')), '');
        interaction.reply({content: '✅ Stock cleared.', ephemeral: true});
    }
});

client.login(TOKEN);
                                                                                                        
