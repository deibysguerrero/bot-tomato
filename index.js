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

// --- CONFIGURACIÓN DE SERVICIOS (Asegúrate que estos nombres coincidan con tus .txt) ---
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
            option.setName('service') // ESTE NOMBRE DEBE SER IGUAL AL QUE USAS EN EL CODIGO
                .setDescription('Select the service')
                .setRequired(true)
                .addChoices(...services)),
    
    new SlashCommandBuilder().setName('stock').setDescription('Check available stock'),
    
    new SlashCommandBuilder()
        .setName('restock')
        .setDescription('Add accounts to stock (Staff Only)')
        .addStringOption(option => 
            option.setName('service')
                .setDescription('Service to restock')
                .setRequired(true)
                .addChoices(...services))
        .addStringOption(option => 
            option.setName('account')
                .setDescription('Account data (user:pass)')
                .setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`✅ Tomato Gen online as ${client.user.tag}`);
    try {
        // Esto registra los comandos específicamente en tu servidor para que sea instantáneo
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('🚀 Commands and Menus updated successfully.');
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, member } = interaction;

    if (commandName === 'gen') {
        const service = options.getString('service'); // Aquí es donde antes daba "null"
        
        if (cooldowns.has(user.id)) {
            const expirationTime = cooldowns.get(user.id) + COOLDOWN_TIME;
            if (Date.now() < expirationTime) {
                const timeLeft = Math.ceil((expirationTime - Date.now()) / 60000);
                return await interaction.reply({ 
                    content: `❌ [PRIVATE] Please wait ${timeLeft} minute(s).`, 
                    ephemeral: true 
                });
            }
        }

        let filePath = (service === 'crunchyroll') ? './stock.txt' : `./${service}.txt`;

        if (!fs.existsSync(filePath)) {
            return await interaction.reply({ content: `❌ Error: ${service} file missing.`, ephemeral: true });
        }

        let content = fs.readFileSync(filePath, 'utf8').trim();
        let allAccounts = content.split(/\s+/).filter(l => l.length > 0);

        if (allAccounts.length > 0) {
            const account = allAccounts.shift();
            fs.writeFileSync(filePath, allAccounts.join(' '));

            const embed = new EmbedBuilder()
                .setTitle('🍅 Tomato Gen - Success!')
                .setColor(0xFF6347)
                .addFields({ name: 'Account Details', value: `\`${account}\`` })
                .setTimestamp();

            try {
                await user.send({ embeds: [embed] });
                cooldowns.set(user.id, Date.now()); 
                await interaction.reply({ 
                    content: `✅ **${user.tag}** generated a **${service}** account!`, 
                    ephemeral: false 
                });
            } catch (e) {
                await interaction.reply({ content: '❌ Open your DMs!', ephemeral: true });
            }
        } else {
            await interaction.reply({ content: `❌ Out of stock for **${service}**!`, ephemeral: false });
        }
    }

    if (commandName === 'stock') {
        const getCount = (file) => {
            if (!fs.existsSync(file)) return 0;
            const data = fs.readFileSync(file, 'utf8').trim();
            return data === "" ? 0 : data.split(/\s+/).length;
        };

        const stockEmbed = new EmbedBuilder()
            .setTitle('📊 Tomato Stock Status')
            .setColor(0x5865F2)
            .addFields(
                { name: '🟠 Crunchyroll', value: `${getCount('./stock.txt')}`, inline: true },
                { name: '🔫 Fortnite', value: `${getCount('./fortnite.txt')}`, inline: true },
                { name: '📺 Netflix', value: `${getCount('./netflix.txt')}`, inline: true },
                { name: '⛏️ Minecraft', value: `${getCount('./minecraft.txt')}`, inline: true }
            );
        
        await interaction.reply({ embeds: [stockEmbed] });
    }

    if (commandName === 'restock') {
        const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages) || 
                      member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isStaff) return await interaction.reply({ content: "❌ No permission!", ephemeral: true });

        const service = options.getString('service');
        const accountData = options.getString('account');
        let filePath = (service === 'crunchyroll') ? './stock.txt' : `./${service}.txt`;

        fs.appendFileSync(filePath, ` ${accountData}`);
        await interaction.reply({ content: `✅ Successfully added account(s) to **${service}**!`, ephemeral: true });
    }
});

client.login(TOKEN);
                 
