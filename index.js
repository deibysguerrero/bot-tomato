require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fs = require('fs');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const cooldowns = new Map();
const COOLDOWN_TIME = 600000; 

// --- CONFIGURACIÓN DE SERVICIOS ---
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
        .addStringOption(option => 
            option.setName('service').setDescription('Select the service').setRequired(true).addChoices(...services)),
    
    new SlashCommandBuilder().setName('stock').setDescription('Check current stock'),
    
    new SlashCommandBuilder()
        .setName('restock')
        .setDescription('Add accounts to stock (Staff Only)')
        .addStringOption(option => 
            option.setName('service').setDescription('Service to restock').setRequired(true).addChoices(...services)) // AQUÍ ESTABA EL ERROR
        .addStringOption(option => 
            option.setName('account').setDescription('Account data (user:pass)').setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`✅ Tomato Gen online as ${client.user.tag}`);
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('🚀 Commands and Menus updated.');
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, member } = interaction;

    // Función para obtener la ruta del archivo
    const getPath = (srv) => (srv === 'crunchyroll') ? './stock.txt' : `./${srv}.txt`;

    // --- COMANDO GEN ---
    if (commandName === 'gen') {
        const service = options.getString('service');
        if (!service) return await interaction.reply({ content: '❌ Invalid service.', ephemeral: true });

        if (cooldowns.has(user.id)) {
            const exp = cooldowns.get(user.id) + COOLDOWN_TIME;
            if (Date.now() < exp) {
                const left = Math.ceil((exp - Date.now()) / 60000);
                return await interaction.reply({ content: `❌ Wait ${left} min.`, ephemeral: true });
            }
        }

        const filePath = getPath(service);
        if (!fs.existsSync(filePath)) return await interaction.reply({ content: `❌ Error: ${service} file missing.`, ephemeral: true });

        let content = fs.readFileSync(filePath, 'utf8').trim();
        let accounts = content.split(/\s+/).filter(l => l.length > 0);

        if (accounts.length > 0) {
            const acc = accounts.shift();
            fs.writeFileSync(filePath, accounts.join(' '));

            const embed = new EmbedBuilder()
                .setTitle('🍅 Tomato Gen Success!')
                .setColor(0xFF6347)
                .addFields({ name: 'Service', value: service }, { name: 'Account', value: `\`${acc}\`` })
                .setTimestamp();

            try {
                await user.send({ embeds: [embed] });
                cooldowns.set(user.id, Date.now());
                await interaction.reply({ content: `✅ **${user.tag}** generated a **${service}** account!`, ephemeral: false });
            } catch (e) {
                await interaction.reply({ content: '❌ DMs closed!', ephemeral: true });
            }
        } else {
            await interaction.reply({ content: `❌ Out of stock for **${service}**!`, ephemeral: false });
        }
    }

    // --- COMANDO STOCK ---
    if (commandName === 'stock') {
        const count = (f) => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split(/\s+/).filter(x => x).length : 0;
        const embed = new EmbedBuilder()
            .setTitle('📊 Tomato Stock Status')
            .setColor(0x5865F2)
            .addFields(
                { name: '🟠 Crunchyroll', value: `${count('./stock.txt')}`, inline: true },
                { name: '🔫 Fortnite', value: `${count('./fortnite.txt')}`, inline: true },
                { name: '📺 Netflix', value: `${count('./netflix.txt')}`, inline: true },
                { name: '⛏️ Minecraft', value: `${count('./minecraft.txt')}`, inline: true }
            );
        await interaction.reply({ embeds: [embed] });
    }

    // --- COMANDO RESTOCK ---
    if (commandName === 'restock') {
        const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages) || member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isStaff) return await interaction.reply({ content: "❌ No permission!", ephemeral: true });

        const service = options.getString('service');
        const account = options.getString('account');
        const filePath = getPath(service);

        try {
            fs.appendFileSync(filePath, ` ${account}`);
            await interaction.reply({ content: `✅ Added to **${service}**!`, ephemeral: true });
        } catch (e) {
            await interaction.reply({ content: "❌ Error writing file.", ephemeral: true });
        }
    }
});

client.login(TOKEN);
                 
